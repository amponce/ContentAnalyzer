import { FormProcessingResult, FormSummary, OCRResult } from './types';
import { AI_MODELS } from '../constants/ai-models';

export class VAFormProcessor {
  private apiKey: string;
  private visionModel: string = AI_MODELS.VISION;  // gpt-4o-audio-preview for OCR
  private textModel: string = AI_MODELS.TEXT_PROCESSING;  // o4-mini for text processing
  private formModel: string = AI_MODELS.FORM_PROCESSING;  // gpt-4o for form understanding

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Process any government form image
   */
  async processScannedForm(imageData: string): Promise<FormProcessingResult> {
    try {
      // First run OCR on the image using Vision model
      const ocrResults = await this.performOCR(imageData);
      
      // Get the combined OCR text
      const ocrText = ocrResults.map(r => r.text).join(' ');
      
      // Identify form type and extract all fields in a single AI call
      const formInfo = await this.identifyAndExtractFields(ocrText);
      
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
      
      return {
        formIdentified: formIdentified,
        formNumber: formInfo.formNumber || (hasExtractedFields ? 'GENERIC' : 'UNKNOWN'),
        formTitle: formInfo.formTitle || (hasExtractedFields ? 'Generic Form' : 'Unknown Form Type'),
        fields,
        rawOCR: ocrResults
      };
    } catch (error) {
      console.error('Error processing form:', error);
      // Return partial results if possible
      return {
        formIdentified: false,
        fields: {},
        rawOCR: []
      };
    }
  }

  /**
   * Perform OCR on the image using Vision model
   */
  private async performOCR(imageData: string): Promise<OCRResult[]> {
    try {
      console.log('Starting OCR processing...');
      
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
              content: 'You are a document OCR system. Extract ALL text from the image, preserving layout when possible.'
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Extract all text content from this form, including headers, field labels, and any filled-in information.'
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
      console.error("OCR failed:", error);
      throw error;
    }
  }

  /**
   * Split a large text into logical chunks for better processing
   */
  private splitIntoLogicalChunks(text: string): string[] {
    // Split by double line breaks which often indicate section boundaries
    let chunks = text.split(/\n\s*\n/);
    
    // If we have very few chunks, try splitting by lines
    if (chunks.length < 3) {
      chunks = text.split(/\n/);
      
      // Group chunks together to avoid too many small chunks
      const groupedChunks: string[] = [];
      let currentChunk = '';
      
      chunks.forEach(line => {
        if (currentChunk.length + line.length > 500) {
          groupedChunks.push(currentChunk);
          currentChunk = line;
        } else {
          currentChunk += (currentChunk ? '\n' : '') + line;
        }
      });
      
      if (currentChunk) {
        groupedChunks.push(currentChunk);
      }
      
      return groupedChunks;
    }
    
    return chunks;
  }

  /**
   * Identify form type and extract all fields using AI
   */
  private async identifyAndExtractFields(text: string): Promise<{
    formNumber: string;
    formTitle: string;
    fields: Record<string, string | number | boolean>;
  }> {
    try {
      console.log("Starting form field extraction using AI...");
      
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
              content: `You are a form processing expert. Your task is to:
              1. Identify the government form type and number if possible
              2. Extract all key fields and their values from the form text
              3. Return a structured JSON response
              
              Important:
              - Even if you can't identify the exact form type, still extract ALL fields
              - Set formNumber to "GENERIC" and formTitle to "Generic Form" if you can't determine them
              - If a field value is missing or couldn't be determined, use an empty string, don't use null values
              
              For field extraction:
              - Use camelCase IDs for field names (e.g., 'fullName', 'socialSecurityNumber')
              - Extract ALL fields that appear to have values
              - Include standard fields like name, address, phone, SSN, dates, etc.
              - For checkboxes, return boolean true/false
              - For dates, return MM/DD/YYYY format when possible
              - For currency, return numeric values without $ or commas
              - Do NOT include field labels in the values
              - Do NOT make up information - if a field is not present, use empty string instead of null/undefined`
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
          return { formNumber: '', formTitle: '', fields: {} };
        }
        
        // Sanitize fields object
        const sanitizedFields = parsedResult.fields || {};
        
        // Log fields for debugging
        console.log(`Form number identified: ${parsedResult.formNumber || 'Unknown'}`);
        console.log(`Form title identified: ${parsedResult.formTitle || 'Unknown'}`);
        console.log(`Number of fields extracted: ${Object.keys(sanitizedFields).length}`);
        
        return {
          formNumber: parsedResult.formNumber || '',
          formTitle: parsedResult.formTitle || '',
          fields: sanitizedFields
        };
      } catch (error) {
        console.error('Failed to parse form analysis response:', error);
        // Return empty data instead of throwing
        return { formNumber: '', formTitle: '', fields: {} };
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
              content: `You are a form analysis expert. Review the form data and provide a summary with key findings and recommendations.

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
    // Create a simple structure with the form data
    return {
      formNumber: result.formNumber,
      formTitle: result.formTitle,
      dateScanned: new Date().toISOString(),
      fields: Object.entries(result.fields).map(([id, data]) => ({
        id,
        label: this.formatFieldLabel(id),
        value: data.value,
        type: this.inferFieldType(id, data.value)
      })),
      sections: [{
        title: 'Form Data',
        fields: Object.keys(result.fields)
      }]
    };
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
      .replace(' V A', ' VA');
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
    
    // Check for number-only fields
    if (/^\d+(\.\d+)?$/.test(value)) {
      return 'text'; // Using text for numbers to preserve formatting
    }
    
    // Default to text
    return 'text';
  }
} 