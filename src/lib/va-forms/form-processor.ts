import { FormProcessingResult, FormSummary, OCRResult } from './types';
import { AI_MODELS } from '../constants/ai-models';
import { createFormProcessingPipeline } from '../agents';

// Add this agent tracking function
let agentUsageTracking: {
  parserCalled: boolean;
  builderCalled: boolean;
  designerCalled: boolean;
  qaCalled: boolean;
  lastRun: Date | null;
} = {
  parserCalled: false,
  builderCalled: false,
  designerCalled: false,
  qaCalled: false,
  lastRun: null
};

// Export for testing/monitoring
export const getAgentUsage = () => {
  return { ...agentUsageTracking };
};

// Reset agent tracking
export const resetAgentUsage = () => {
  agentUsageTracking = {
    parserCalled: false,
    builderCalled: false,
    designerCalled: false,
    qaCalled: false,
    lastRun: null
  };
};

// General form number detection patterns (works for various agencies)
const FORM_PATTERNS = [
  // Generic form patterns
  /form\s*(?:no|number|#)?\s*[:\-]?\s*([a-z0-9\-\.]+)/i,
  /form\s+([a-z0-9\-\.]+)/i,
  
  // Agency-specific patterns (but not assuming only one agency)
  /([a-z]+)[\s\-]form[\s\-]([a-z0-9\-\.]+)/i, // Matches "VA Form 10-10EZ" or "IRS Form W-9"
  /((?:va|irs|hud|ss|cms|dhs)\s*\d+[\-\.][a-z0-9\-\.]+)/i // Common agency prefixes
];

export class VAFormProcessor {
  private apiKey: string;
  private visionModel: string = AI_MODELS.VISION;  // gpt-4o-audio-preview for OCR
  private textModel: string = AI_MODELS.TEXT_PROCESSING;  // o4-mini for text processing
  private formModel: string = AI_MODELS.FORM_PROCESSING;  // gpt-4o for form understanding
  private maxRetries: number = 2; // Number of retries for API calls

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Process any government form image
   */
  async processScannedForm(imageData: string): Promise<FormProcessingResult> {
    try {
      console.log('Starting form processing...');
      
      // First run OCR on the image using Vision model
      const ocrResults = await this.performOCR(imageData);
      
      // Get the combined OCR text
      const ocrText = ocrResults.map(r => r.text).join('\n\n');
      
      // Try to identify form number directly from OCR text
      const directFormInfo = this.extractFormInfoFromText(ocrText);
      
      if (!ocrText || ocrText.trim().length < 50) {
        console.warn('OCR text is too short, might be insufficient for processing');
        return {
          formIdentified: !!directFormInfo.formNumber,
          formNumber: directFormInfo.formNumber || 'UNKNOWN',
          formTitle: directFormInfo.formTitle || 'OCR Failed - Text Extraction Incomplete',
          fields: {},
          rawOCR: ocrResults
        };
      }
      
      // Try to identify form type and extract fields (with retry mechanism)
      let formInfo = null;
      let attempts = 0;
      let lastError = null;
      
      while (attempts < this.maxRetries + 1) {
        try {
          formInfo = await this.identifyAndExtractFields(ocrText);
          
          // If we found a form number directly from OCR but not from AI,
          // use the direct form info
          if (directFormInfo.formNumber && !formInfo.formNumber) {
            formInfo.formNumber = directFormInfo.formNumber;
            formInfo.formTitle = directFormInfo.formTitle || 'Government Form';
          }
          
          // If we got at least some fields, break out of retry loop
          if (Object.keys(formInfo.fields || {}).length > 0) {
            break;
          }
          
          // If no fields were extracted, try again with a different prompt strategy
          console.log(`Retry ${attempts + 1}: No fields extracted, trying again with different approach`);
          attempts++;
        } catch (error) {
          console.error(`Attempt ${attempts + 1} failed:`, error);
          lastError = error;
          attempts++;
          // Small delay before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      if (!formInfo && lastError) {
        throw lastError;
      }
      
      if (!formInfo) {
        formInfo = { 
          formNumber: directFormInfo.formNumber || '', 
          formTitle: directFormInfo.formTitle || '', 
          fields: {} 
        };
      }
      
      // Transform the field data into the expected format - with null/undefined safety
      const fields = Object.entries(formInfo.fields || {}).reduce((acc, [key, value]) => {
        // Handle null or undefined values safely
        if (value === null || value === undefined) {
          console.log(`Warning: Null or undefined value found for field "${key}", using empty string instead`);
          acc[key] = {
            value: '',
            confidence: 0.5 // Lower confidence for null values
          };
        } else {
          acc[key] = {
            value: String(value), // Use String() instead of toString() for better null safety
            confidence: 0.9 // Default confidence for AI extraction
          };
        }
        return acc;
      }, {} as Record<string, {value: string, confidence: number}>);

      // Always consider the form as identified if we have extracted any fields
      const hasExtractedFields = Object.keys(fields).length > 0;
      const formIdentified = hasExtractedFields || !!formInfo.formNumber;
      
      // Log successful field extraction
      console.log(`Extracted ${Object.keys(fields).length} fields from the form`);
      
      // Determine the proper form number format
      let formNumber = formInfo.formNumber || directFormInfo.formNumber;
      if (formNumber) {
        // Clean up spaces in form numbers
        formNumber = formNumber.replace(/\s+/g, '-').trim();
      }
      
      return {
        formIdentified: formIdentified,
        formNumber: formNumber || (hasExtractedFields ? 'GENERIC' : 'UNKNOWN'),
        formTitle: formInfo.formTitle || directFormInfo.formTitle || (hasExtractedFields ? 'Generic Form' : 'Unknown Form Type'),
        fields,
        rawOCR: ocrResults,
        sections: formInfo.sections || undefined
      };
    } catch (error) {
      console.error('Error processing form:', error);
      // Return partial results if possible
      return {
        formIdentified: false,
        formNumber: 'ERROR',
        formTitle: 'Error Processing Form',
        fields: {},
        rawOCR: []
      };
    }
  }

  /**
   * Try to extract form number and title directly from OCR text
   */
  private extractFormInfoFromText(text: string): { formNumber: string; formTitle: string } {
    let formNumber = '';
    let formTitle = '';

    // Try to find form title
    const titleMatches = [
      /APPLICATION\s+FOR\s+(.*?)(?:\n|$)/i,
      /(?:DEPARTMENT|OFFICE|BUREAU)\s+OF\s+(.*?)(?:\n|$)/i,
      /(?:^|\n)([^:\n]+?)\s+FORM(?:\s|\n|$)/i,
      /FORM\s+.*?\n(.*?)(?:\n|$)/i
    ];

    for (const pattern of titleMatches) {
      const match = text.match(pattern);
      if (match && match[1]) {
        formTitle = match[1].trim();
        break;
      }
    }

    // Try to find form number using patterns
    for (const pattern of FORM_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        // Some patterns have multiple capture groups
        formNumber = match[2] ? `${match[1]}-${match[2]}` : match[1];
        formNumber = formNumber.trim();
        break;
      }
    }

    // Look for OMB form numbers as fallback
    if (!formNumber) {
      const ombMatch = text.match(/OMB.*?(\d+[\-\.]\d+)/i);
      if (ombMatch && ombMatch[1]) {
        formNumber = ombMatch[1].trim();
      }
    }

    return { formNumber, formTitle };
  }

  /**
   * Perform OCR on the image using Vision model with retry
   */
  private async performOCR(imageData: string): Promise<OCRResult[]> {
    let attempts = 0;
    let lastError = null;
    
    while (attempts < this.maxRetries + 1) {
      try {
        console.log(`OCR processing attempt ${attempts + 1}...`);
        
        // Validate the image data
        if (!imageData || !imageData.startsWith('data:')) {
          throw new Error('Invalid image data format');
        }
        
        // Check image size
        const approxSize = Math.round((imageData.length * 3) / 4);
        console.log(`Approximate image size: ${Math.round(approxSize / 1024)} KB`);
        
        // Log OpenAI API call
        console.log(`Calling OpenAI API with model: ${this.visionModel}`);
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          body: JSON.stringify({
            model: this.visionModel,
            messages: [
              {
                role: 'system',
                content: `You are a document OCR system specialized in government forms of all types. Extract ALL text from the image, preserving layout and structure as much as possible. Pay special attention to:
                1. Form numbers and titles
                2. Field labels and their values
                3. Any filled-in information
                4. Checkboxes and their states (checked/unchecked)
                5. Tables and structured data
                
                Include all visible text, even if it appears to be a header, footer, or instruction.`
              },
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: 'This is a government form that needs to be digitized. Extract ALL text content, preserving the structure and relationships between field labels and values.'
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: imageData
                    }
                  }
                ]
              }
            ]
          })
        });

        if (!response.ok) {
          // Log error details
          const errorText = await response.text().catch(() => 'No error text available');
          console.error(`API Error Response: ${response.status} - ${response.statusText}`);
          console.error(`Error details: ${errorText}`);
          
          // Throw specific errors based on response status
          if (response.status === 400) {
            throw new Error(`OCR request failed: The image may be too large or in an unsupported format. Try using a clearer image or reducing its size.`);
          } else if (response.status === 401) {
            throw new Error(`OCR request failed: Invalid API key. Please check your OpenAI API key in settings.`);
          } else {
            throw new Error(`OCR request failed: ${response.status} - ${response.statusText}`);
          }
        }

        const data = await response.json();
        console.log('OCR processing completed successfully');
        const extractedText = data.choices?.[0]?.message?.content || '';
        
        if (!extractedText || extractedText.trim().length < 50) {
          console.warn('OCR produced too little text, trying again...');
          attempts++;
          continue;
        }
        
        // Split the text into logical chunks for better processing
        const textChunks = this.splitIntoLogicalChunks(extractedText);
        console.log(`Extracted ${textChunks.length} text chunks from the document`);
        
        return textChunks.map((text, index) => ({
          text,
          confidence: 0.95,
          // Add position information if available
          boundingBox: {
            x: 0,
            y: index * 100, // Approximate vertical position
            width: 1000,
            height: 100
          }
        }));
      } catch (error) {
        console.error(`OCR attempt ${attempts + 1} failed:`, error);
        lastError = error;
        attempts++;
        
        // If we've hit our retry limit, throw the last error
        if (attempts >= this.maxRetries + 1) {
          throw lastError;
        }
        
        // Small delay before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // This shouldn't be reached due to the throw in the loop, but TypeScript needs it
    throw lastError;
  }

  /**
   * Split a large text into logical chunks for better processing
   */
  private splitIntoLogicalChunks(text: string): string[] {
    // First try to preserve form structure by splitting on multiple line breaks
    let chunks = text.split(/\n{3,}/);
    
    // If we have very few chunks, try splitting by double line breaks
    if (chunks.length < 3) {
      chunks = text.split(/\n\s*\n/);
    }
    
    // If still few chunks, try single line breaks but group them intelligently
    if (chunks.length < 3) {
      const lines = text.split(/\n/);
      
      // Group chunks together to avoid too many small chunks
      const groupedChunks: string[] = [];
      let currentChunk = '';
      
      lines.forEach(line => {
        // If this line looks like a section header, start a new chunk
        if (/^[A-Z\s]{5,}:?$/.test(line.trim()) || /^[IVX]+\.\s+/.test(line.trim())) {
          if (currentChunk) {
            groupedChunks.push(currentChunk);
          }
          currentChunk = line;
        }
        // If current chunk is getting long, start a new one
        else if (currentChunk.length + line.length > 750) {
          groupedChunks.push(currentChunk);
          currentChunk = line;
        } else {
          currentChunk += (currentChunk ? '\n' : '') + line;
        }
      });
      
      if (currentChunk) {
        groupedChunks.push(currentChunk);
      }
      
      return groupedChunks.length > 1 ? groupedChunks : [text];
    }
    
    // If we still have only one chunk, just return the whole text
    return chunks.length > 1 ? chunks : [text];
  }

  /**
   * Identify form type and extract all fields using AI
   */
  private async identifyAndExtractFields(text: string): Promise<{
    formNumber: string;
    formTitle: string;
    fields: Record<string, string | number | boolean>;
    sections?: {title: string, fields: string[]}[];
  }> {
    try {
      console.log("Starting form field extraction using AI...");
      
      // Look for specific form identifiers first
      const directFormInfo = this.extractFormInfoFromText(text);
      
      // Check if this is a VA Form 5655
      const isVAForm5655 = directFormInfo.formNumber?.includes('5655') || 
                           text.includes('FINANCIAL STATUS REPORT') ||
                           text.includes('VA FORM 5655');
      
      let formHint = '';
      
      if (isVAForm5655) {
        formHint = `This is a VA Form 5655 (Financial Status Report). 
This form has several important sections:
- Section I: Personal Data (Social Security Number, Name, Address, Phone, Date of Birth, Marital Status)
- Section II: Income
- Section III: Expenses
- Section IV: Discretionary Income
- Section V: Assets
- Section VI: Installment Contracts and Other Debts
- Section VII: Additional Data
- Section VIII: Applicant Certifications

Pay close attention to these specific fields and organize them accordingly.`;
      } else if (directFormInfo.formNumber) {
        formHint = `This appears to be Form ${directFormInfo.formNumber}${directFormInfo.formTitle ? ` (${directFormInfo.formTitle})` : ''}. `;
      }
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.formModel,
          messages: [
            {
              role: 'system',
              content: `You are a government form processing expert specializing in extracting structured data from any government form (VA, IRS, SSA, DMV, HUD, etc.). Your task is to:

1. Identify the form type and number (if present)
2. Extract ALL fields and their values from the OCR text
3. Identify the form sections EXACTLY as they appear in the original document
4. Group fields precisely as they appear in the original form
5. Return a structured JSON response

Important guidelines:
- Preserve the exact original form structure, sections, and fields
- Capture form structure in the sections array, matching the original document's organization
- Group related fields exactly as they are grouped in the original form (e.g., keep address fields together including county)
- Keep field names consistent with the original form labels
- Extract ALL visible fields, including checkboxes, sections, and multi-part answers
- Preserve the order of fields and sections from the original document
- For date fields, provide the date in a simple format that doesn't require calendar navigation
- For name fields, respect the original form structure (don't split unless the form has separate fields)
- For checkbox fields like "best time to call", use boolean values for the options
- For empty fields, use an empty string value

${formHint}

Your JSON response must follow this format:
{
  "formNumber": "10-334", // The form number, or "GENERIC" if unknown
  "formTitle": "Tribal Documentation Form", // The exact form title
  "fields": {
    // All extracted fields with their values
  },
  "sections": [
    {
      "title": "SECTION I: VETERAN IDENTIFICATION INFORMATION",
      "fields": ["veteransName", "dateOfBirth", "currentMailingAddress", "city", "state", "zipCode", "county", "vaMemberId", "localVaMedicalCenter", "veteranTelephoneNumber", "signature", "date"] 
    },
    // Other sections from the form
  ]
}`
            },
            {
              role: 'user',
              content: text
            }
          ],
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        console.error(`Field extraction API error: ${response.status} - ${response.statusText}`);
        const errorText = await response.text().catch(() => 'No error text available');
        console.error(`Error details: ${errorText}`);
        throw new Error(`Form analysis request failed: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.choices?.[0]?.message?.content) {
        console.error('No content in API response');
        throw new Error('Invalid form analysis response format');
      }

      try {
        console.log("Parsing AI response...");
        const content = data.choices[0].message.content;
        const parsedResult = JSON.parse(content);
        
        // Handle malformed responses
        if (!parsedResult) {
          console.error('Parsed result is null or undefined');
          return { 
            formNumber: directFormInfo.formNumber || '', 
            formTitle: directFormInfo.formTitle || '', 
            fields: {} 
          };
        }
        
        // Clean up complex fields that might be objects or arrays
        const sanitizedFields = { ...parsedResult.fields || {} };
        Object.keys(sanitizedFields).forEach(key => {
          const value = sanitizedFields[key];
          if (value === "[object Object]") {
            sanitizedFields[key] = '';
          } else if (typeof value === 'object' && value !== null) {
            try {
              // Stringify objects so they can be displayed
              sanitizedFields[key] = JSON.stringify(value);
            } catch (err) {
              sanitizedFields[key] = '';
            }
          }
        });
        
        // If this is VA Form 5655, ensure we use the correct form title
        if (isVAForm5655) {
          parsedResult.formNumber = parsedResult.formNumber || '5655';
          parsedResult.formTitle = parsedResult.formTitle || 'Financial Status Report';
        }
        
        // If the AI didn't find a form number but we found one directly, use ours
        const formNumber = parsedResult.formNumber || directFormInfo.formNumber || '';
        const formTitle = parsedResult.formTitle || directFormInfo.formTitle || '';
        
        // Log fields for debugging
        console.log(`Form number identified: ${formNumber || 'Unknown'}`);
        console.log(`Form title identified: ${formTitle || 'Unknown'}`);
        console.log(`Number of fields extracted: ${Object.keys(sanitizedFields).length}`);
        
        // Get sections if available
        const sections = parsedResult.sections || [];
        
        return {
          formNumber: formNumber,
          formTitle: formTitle,
          fields: sanitizedFields,
          sections: sections
        };
      } catch (error) {
        console.error('Failed to parse form analysis response:', error);
        // Return direct form info if available
        return { 
          formNumber: directFormInfo.formNumber || '', 
          formTitle: directFormInfo.formTitle || '', 
          fields: {} 
        };
      }
    } catch (error) {
      console.error('Form identification and extraction failed:', error);
      // Return empty data instead of throwing
      return { formNumber: '', formTitle: '', fields: {} };
    }
  }

  /**
   * Generate a summary of the processed form
   */
  async generateFormSummary(result: FormProcessingResult): Promise<FormSummary> {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.textModel,
          messages: [
            {
              role: 'system',
              content: `You are a government form analysis expert. Review the form data and provide a summary with key findings and recommendations.

For any form, even if you don't recognize its specific type:
1. Analyze all extracted fields and their values
2. Identify any likely missing required fields based on the context
3. Provide helpful recommendations for the user 
4. If possible, suggest an official government website where this form can be completed digitally

Return a JSON object with: 
- keyFindings: array of strings with important observations
- missingRequired: array of likely required fields that are missing
- recommendations: array of advice for improving the form
- digitalFormUrl: string URL to an official digital version (if known)`
            },
            {
              role: 'user',
              content: JSON.stringify({
                formNumber: result.formNumber,
                formTitle: result.formTitle,
                fields: result.fields
              })
            }
          ],
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        throw new Error(`Summary generation failed: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.choices?.[0]?.message?.content) {
        throw new Error('Invalid summary response format');
      }

      try {
        const summary = JSON.parse(data.choices[0].message.content);
        return {
          formNumber: result.formNumber || 'UNKNOWN',
          formTitle: result.formTitle || 'Unknown Form Type',
          keyFindings: summary.keyFindings || [],
          missingRequired: summary.missingRequired || [],
          recommendations: summary.recommendations || [],
          digitalFormUrl: summary.digitalFormUrl || ''
        };
      } catch (error) {
        console.error('Failed to parse summary response:', error);
        throw new Error('Failed to generate form summary');
      }
    } catch (error) {
      console.error('Summary generation failed:', error);
      throw error;
    }
  }

  /**
   * Create a digital version of the form
   */
  async createDigitalForm(result: FormProcessingResult): Promise<any> {
    try {
      console.log("Creating digital form with agent pipeline...");
      
      // Try to use the agent pipeline if available
      try {
        // Create the agent pipeline
        const pipeline = createFormProcessingPipeline();
        
        // Create a simple page array from rawOCR
        const pages = result.rawOCR.map(ocr => ({
          text: ocr.text,
          imageData: null // We don't have the original image data here
        }));
        
        // Only proceed if we have OCR data
        if (pages.length > 0) {
          console.log("✅ Running form through agent pipeline");
          console.log(`Form has ${Object.keys(result.fields).length} fields and ${result.rawOCR.length} OCR chunks`);
          
          // Track agent usage
          agentUsageTracking.lastRun = new Date();
          
          // Mark parser as already done since we're starting with OCR results
          agentUsageTracking.parserCalled = true;
          console.log("✓ Parser agent (bypassed, using OCR results)");
          
          // Create simple parser output to feed to builder
          const parserOutput = {
            rawText: result.rawOCR.map(ocr => ocr.text).join('\n\n'),
            fields: Object.entries(result.fields).map(([id, field]) => ({
              id,
              label: this.formatFieldLabel(id),
              type: this.inferFieldType(id, String(field.value)),
              value: field.value
            })),
            confidence: 0.9,
            metadata: {}
          };
          
          // Use the builder agent
          console.log("⏳ Running builder agent...");
          const builderResult = await pipeline.runStage('builder', {
            parserOutput,
            formNumber: result.formNumber,
            formTitle: result.formTitle
          });
          agentUsageTracking.builderCalled = true;
          console.log(`✓ Builder agent completed (${builderResult.formData.sections.length} sections created)`);
          
          // Use the designer agent
          console.log("⏳ Running designer agent...");
          const designerResult = await pipeline.runStage('designer', {
            builderOutput: builderResult
          });
          agentUsageTracking.designerCalled = true;
          console.log(`✓ Designer agent completed (layout: ${designerResult.designMetadata.layout})`);
          
          // Use the QA agent
          console.log("⏳ Running QA agent...");
          const qaResult = await pipeline.runStage('qa', {
            designerOutput: designerResult,
            originalText: parserOutput.rawText
          });
          agentUsageTracking.qaCalled = true;
          console.log(`✓ QA agent completed (issues found: ${qaResult.issues.length})`);
          
          // Use the validated form data from the QA agent
          console.log("✅ Agent pipeline completed successfully!");
          return {
            formNumber: result.formNumber || 'UNKNOWN',
            formTitle: result.formTitle || 'Generic Form',
            dateScanned: new Date().toISOString(),
            fields: qaResult.validatedFormData.fields,
            sections: qaResult.validatedFormData.sections,
            // Add agent metadata for debugging
            agentMetadata: {
              builderConfidence: builderResult.metadata.confidence,
              designerLayout: designerResult.designMetadata.layout,
              qaIssues: qaResult.issues.length,
              agentPipelineUsed: true
            }
          };
        }
      } catch (agentError) {
        console.warn("❌ Agent pipeline error, falling back to default processing:", agentError);
        // Fall back to the original implementation
      }
      
      // Default implementation (original code)
      // Use a dynamic approach that works with ANY government form
      let groupedSections = [];
      
      // Check if we have original form sections from the AI extraction
      if (result.sections && result.sections.length > 0) {
        console.log("Using original form sections detected by AI");
        groupedSections = result.sections;
      } else {
        console.log("No original sections detected, grouping fields by category");
        // Group fields by logical categories based on field content
        const fieldIds = Object.keys(result.fields);
        
        // Create field mappings to categorize fields
        const fieldCategories: {[category: string]: string[]} = {
          'Personal Information': [
            'name', 'ssn', 'social', 'security', 'birth', 'dob', 'gender', 'sex',
            'marital', 'spouse', 'dependents', 'age'
          ],
          'Contact Information': [
            'address', 'street', 'city', 'state', 'zip', 'postal', 'phone', 
            'telephone', 'email', 'fax', 'contact', 'county', 'mailing'
          ],
          'Employment Information': [
            'employ', 'job', 'occupation', 'work', 'position', 'title', 'salary',
            'income', 'earnings', 'wage', 'company', 'business', 'profession'
          ],
          'Financial Information': [
            'income', 'salary', 'wage', 'earnings', 'expense', 'payment', 'cost',
            'financial', 'money', 'pay', 'deduction', 'tax', 'net', 'gross', 'total'
          ],
          'Asset Information': [
            'asset', 'property', 'own', 'value', 'worth', 'saving', 'account', 'bank',
            'cash', 'investment', 'stock', 'bond', 'fund', 'real estate', 'vehicle', 'car'
          ],
          'Debt Information': [
            'debt', 'loan', 'credit', 'owe', 'payment', 'monthly payment', 'balance',
            'creditor', 'installment', 'finance', 'liability', 'obligation'
          ],
          'Medical Information': [
            'health', 'medical', 'condition', 'disability', 'treatment', 'diagnosis',
            'doctor', 'hospital', 'care', 'insurance', 'symptom', 'medication'
          ],
          'Military/Service Information': [
            'military', 'service', 'veteran', 'branch', 'army', 'navy', 'marine',
            'air force', 'discharge', 'duty', 'rank', 'served'
          ],
          'Document Information': [
            'form', 'document', 'application', 'signature', 'sign', 'date', 'complete',
            'submit', 'file', 'number', 'reference', 'id', 'identification'
          ]
        };
        
        // Create empty groups for each category
        const groupedFields: {[group: string]: string[]} = {};
        Object.keys(fieldCategories).forEach(category => {
          groupedFields[category] = [];
        });
        
        // Add a catch-all category
        groupedFields['Other Information'] = [];
        
        // Sort each field into the appropriate category
        fieldIds.forEach(fieldId => {
          const fieldName = fieldId.toLowerCase();
          const fieldLabel = this.formatFieldLabel(fieldId).toLowerCase();
          
          // Try to find matching category
          let assigned = false;
          for (const [category, keywords] of Object.entries(fieldCategories)) {
            if (keywords.some(keyword => 
              fieldName.includes(keyword) || fieldLabel.includes(keyword)
            )) {
              groupedFields[category].push(fieldId);
              assigned = true;
              break;
            }
          }
          
          // If not assigned to any specific category, add to Other Information
          if (!assigned) {
            groupedFields['Other Information'].push(fieldId);
          }
        });
        
        // Remove empty groups
        Object.keys(groupedFields).forEach(group => {
          if (groupedFields[group].length === 0) {
            delete groupedFields[group];
          }
        });
        
        // Ensure we have at least one group
        if (Object.keys(groupedFields).length === 0) {
          groupedFields['Form Data'] = fieldIds;
        }
        
        // Create sections from our dynamically assigned groups
        groupedSections = Object.entries(groupedFields).map(([title, fields]) => ({
          title,
          fields
        }));
      }
      
      // Prepare fields with types
      const processedFields = Object.entries(result.fields).map(([id, data]) => {
        let fieldValue = data.value;
        let fieldType = 'text';
        
        // Handle objects and arrays that might have been stringified
        try {
          if (typeof fieldValue === 'string' && 
              (fieldValue.startsWith('{') || fieldValue.startsWith('['))) {
            // Try to parse as JSON
            const parsed = JSON.parse(fieldValue);
            if (typeof parsed === 'object' && parsed !== null) {
              // Preserve the structure as JSON string
              fieldValue = JSON.stringify(parsed);
              
              // Detect if this is a complex object with nested structure
              const isComplexObject = Object.values(parsed).some(v => typeof v === 'object' && v !== null);
              
              // Auto-detect field type based on content patterns
              if (isComplexObject) {
                fieldType = 'complex-object';
              } else {
                const hasBooleanValues = Object.values(parsed).some(v => 
                  typeof v === 'boolean' || v === 'true' || v === 'false'
                );
                
                if (hasBooleanValues) {
                  // Could be preferences, checkboxes, options
                  fieldType = 'boolean-group';
                } else {
                  // Simple object with string/number values
                  fieldType = 'json-object';
                }
              }
            }
          }
        } catch (e) {
          // Not JSON, keep as is
        }
        
        // Infer field type if not already set by JSON analysis
        if (fieldType === 'text') {
          fieldType = this.inferFieldType(id, String(fieldValue));
        }
        
        return {
          id,
          label: this.formatFieldLabel(id),
          value: String(fieldValue),
          type: fieldType
        };
      });
      
      // Create a digital form representation
      return {
        formNumber: result.formNumber || 'UNKNOWN',
        formTitle: result.formTitle || 'Generic Form',
        dateScanned: new Date().toISOString(),
        fields: processedFields,
        sections: groupedSections
      };
    } catch (error) {
      console.error('Error creating digital form:', error);
      // Fallback to a simple structure
      return {
        formNumber: result.formNumber || 'UNKNOWN',
        formTitle: result.formTitle || 'Generic Form',
        dateScanned: new Date().toISOString(),
        fields: Object.entries(result.fields).map(([id, data]) => ({
          id,
          label: this.formatFieldLabel(id),
          value: String(data.value),
          type: 'text'
        })),
        sections: [{
          title: 'Form Data',
          fields: Object.keys(result.fields)
        }]
      };
    }
  }

  /**
   * Format camelCase field ID to readable label
   */
  private formatFieldLabel(id: string): string {
    return id
      // Insert a space before all uppercase letters
      .replace(/([A-Z])/g, ' $1')
      // Replace first character with uppercase
      .replace(/^./, str => str.toUpperCase())
      // Fix specific acronyms
      .replace(' S S N', ' SSN')
      .replace(' D O B', ' DOB')
      .replace(' V A', ' VA')
      .replace(' I R S', ' IRS')
      .replace(' D M V', ' DMV');
  }

  /**
   * Infer field type from field ID and value
   */
  private inferFieldType(id: string, value: string): string {
    // Check for boolean values
    if (value === 'true' || value === 'false') {
      return 'checkbox';
    }
    
    // Check for date fields
    if (id.toLowerCase().includes('date') || /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) {
      return 'date';
    }
    
    // Check for longer text that might need a textarea
    if (value.length > 100 || id.toLowerCase().includes('comment') || id.toLowerCase().includes('description')) {
      return 'textarea';
    }
    
    // Check for number-only fields
    if (/^\d+(\.\d+)?$/.test(value)) {
      return 'text'; // Using text for numbers to preserve formatting
    }
    
    // Default to text
    return 'text';
  }
} 