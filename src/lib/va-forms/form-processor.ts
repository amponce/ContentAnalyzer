import { VAForm, FormProcessingResult, FormSummary, OCRResult, VAFormTemplate } from './types';
import { AI_MODELS } from '../constants/ai-models';
import { getFormTemplate } from './form-templates';

export class VAFormProcessor {
  private apiKey: string;
  private visionModel: string = AI_MODELS.VISION;  // gpt-4o-audio-preview for OCR
  private textModel: string = AI_MODELS.TEXT_PROCESSING;  // o4-mini for text processing
  private formModel: string = AI_MODELS.FORM_PROCESSING;  // gpt-4o for form understanding

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Process a scanned VA form image
   */
  async processScannedForm(imageData: string): Promise<FormProcessingResult> {
    try {
      // First run OCR on the image using Vision model
      const ocrResults = await this.performOCR(imageData);
      
      // Identify the form type using Form Processing model
      const formIdentification = await this.identifyFormType(ocrResults);
      
      if (!formIdentification.formNumber) {
        return {
          formIdentified: false,
          fields: {},
          rawOCR: ocrResults
        };
      }

      // Get the form template
      const template = await getFormTemplate(formIdentification.formNumber);
      if (!template) {
        throw new Error(`No template found for form ${formIdentification.formNumber}`);
      }

      // Extract form fields using the template
      const fields = await this.extractFormFields(ocrResults, template);

      return {
        formIdentified: true,
        formNumber: formIdentification.formNumber,
        formTitle: formIdentification.formTitle,
        fields,
        rawOCR: ocrResults
      };
    } catch (error) {
      console.error('Error processing form:', error);
      throw error;
    }
  }

  /**
   * Perform OCR on the image using GPT-4 Vision
   */
  private async performOCR(imageData: string): Promise<OCRResult[]> {
    try {
      // First check if the image format is compatible (some models don't support certain image formats)
      if (imageData.startsWith('data:text/plain') || imageData.startsWith('data:application/octet-stream')) {
        console.warn('Image data is in an unsupported format, trying fallback with generic OCR');
        return this.performOCRWithFallback(imageData);
      }
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.visionModel,  // Using gpt-4o-audio-preview for best OCR accuracy
          messages: [
            {
              role: 'system',
              content: 'You are a document OCR system. Extract text from the image and return it in JSON format with the following structure: { "text_elements": [{ "text": string, "confidence": number }] }'
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Please analyze this VA form image and extract all text. Return the results in JSON format.'
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: imageData
                  }
                }
              ]
            }
          ],
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        const errorBody = await response.text();
        // If vision model fails with specific errors, try fallback
        if (response.status === 429) {
          console.warn('Primary vision model rate limited, trying fallback...');
          return this.performOCRWithFallback(imageData);
        } else if (response.status >= 500) {
          console.warn('Primary vision model server error, trying fallback...');
          return this.performOCRWithFallback(imageData);
        } else if (response.status === 401) {
          throw new Error('OCR failed: Invalid API key or unauthorized access');
        } else if (response.status === 400) {
          // Check for model compatibility issues
          if (errorBody.includes('does not support image_url') || 
              errorBody.includes('invalid_value') ||
              errorBody.includes('invalid_request_error')) {
            console.warn('Primary OCR failed with model compatibility error, attempting fallback:', errorBody);
            return this.performOCRWithFallback(imageData);
          }
          throw new Error(`OCR failed: Bad request - ${errorBody}`);
        } else {
          throw new Error(`OCR failed: ${response.status} - ${response.statusText} - ${errorBody}`);
        }
      }

      const data = await response.json();
      
      if (!data.choices?.[0]?.message?.content) {
        throw new Error('OCR failed: Empty or invalid response from vision model');
      }

      try {
        const parsedContent = JSON.parse(data.choices[0].message.content);
        if (!Array.isArray(parsedContent?.text_elements)) {
          throw new Error('OCR failed: Invalid response format - missing text_elements array');
        }
        
        const results = parsedContent.text_elements.map((element: any) => {
          if (typeof element.text !== 'string') {
            throw new Error('OCR failed: Invalid text element format - text must be string');
          }
          return {
            text: element.text,
            confidence: typeof element.confidence === 'number' ? element.confidence : 0.9
          };
        });

        if (results.length === 0) {
          throw new Error('OCR failed: No text elements found in the image');
        }

        return results;
      } catch (error) {
        if (error instanceof SyntaxError) {
          console.error('Failed to parse OCR JSON response:', error);
          throw new Error('OCR failed: Invalid JSON in model response');
        }
        throw error;
      }
    } catch (error) {
      // If any error occurs during primary OCR, try fallback as last resort
      if (error instanceof Error && !error.message.includes('Invalid API key')) {
        console.warn('Primary OCR failed with error, attempting fallback:', error.message);
        return this.performOCRWithFallback(imageData);
      }
      throw error;
    }
  }

  /**
   * Fallback OCR using gpt-4.1
   */
  private async performOCRWithFallback(imageData: string): Promise<OCRResult[]> {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: AI_MODELS.VISION_FALLBACK,  // Using gpt-4.1 as fallback
          messages: [
            {
              role: 'system',
              content: 'You are a document OCR system. Extract text from the image and return it in JSON format with the following structure: { "text_elements": [{ "text": string, "confidence": number }] }'
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Please analyze this VA form image and extract all text. Return the results in JSON format.'
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: imageData
                  }
                }
              ]
            }
          ],
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        const errorBody = await response.text();
        if (response.status === 401) {
          throw new Error('OCR fallback failed: Invalid API key or unauthorized access');
        } else if (response.status === 400) {
          throw new Error(`OCR fallback failed: Bad request - ${errorBody}`);
        } else {
          throw new Error(`OCR fallback failed: ${response.status} - ${response.statusText} - ${errorBody}`);
        }
      }

      const data = await response.json();
      
      if (!data.choices?.[0]?.message?.content) {
        throw new Error('OCR fallback failed: Empty or invalid response from vision model');
      }

      try {
        const parsedContent = JSON.parse(data.choices[0].message.content);
        if (!Array.isArray(parsedContent?.text_elements)) {
          throw new Error('OCR fallback failed: Invalid response format - missing text_elements array');
        }
        
        const results = parsedContent.text_elements.map((element: any) => {
          if (typeof element.text !== 'string') {
            throw new Error('OCR fallback failed: Invalid text element format - text must be string');
          }
          return {
            text: element.text,
            confidence: typeof element.confidence === 'number' ? element.confidence : 0.8  // Lower default confidence for fallback
          };
        });

        if (results.length === 0) {
          throw new Error('OCR fallback failed: No text elements found in the image');
        }

        return results;
      } catch (error) {
        if (error instanceof SyntaxError) {
          throw new Error('OCR fallback failed: Invalid JSON in model response');
        }
        throw error;
      }
    } catch (error) {
      console.error('OCR fallback failed:', error);
      throw error;
    }
  }

  private async identifyFormType(ocrResults: OCRResult[]) {
    const formText = ocrResults.map(r => r.text).join(' ');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.formModel,  // Using gpt-4o for form understanding
        messages: [
          {
            role: 'system',
            content: 'You are a VA form identification expert. Analyze the text and identify the VA form number and title. Return the result in JSON format with formNumber and formTitle fields.'
          },
          {
            role: 'user',
            content: formText
          }
        ],
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      // If form model fails, try fallback
      if (response.status === 429 || response.status >= 500) {
        console.warn('Primary form model failed, trying fallback...');
        return this.identifyFormTypeWithFallback(formText);
      }
      throw new Error(`Form identification request failed: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.choices?.[0]?.message?.content) {
      throw new Error('Invalid form identification response format');
    }

    try {
      return JSON.parse(data.choices[0].message.content);
    } catch (error) {
      console.error('Failed to parse form identification response:', error);
      throw new Error('Failed to identify form type');
    }
  }

  /**
   * Fallback form identification using gpt-4.1
   */
  private async identifyFormTypeWithFallback(formText: string) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: AI_MODELS.FORM_PROCESSING_FALLBACK,  // Using gpt-4.1 as fallback
        messages: [
          {
            role: 'system',
            content: 'You are a VA form identification expert. Analyze the text and identify the VA form number and title. Return the result in JSON format with formNumber and formTitle fields.'
          },
          {
            role: 'user',
            content: formText
          }
        ],
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      throw new Error(`Form identification fallback request failed: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.choices?.[0]?.message?.content) {
      throw new Error('Invalid form identification fallback response format');
    }

    try {
      return JSON.parse(data.choices[0].message.content);
    } catch (error) {
      console.error('Failed to parse form identification fallback response:', error);
      throw new Error('Failed to identify form type');
    }
  }

  private async extractFormFields(ocrResults: OCRResult[], template: VAFormTemplate) {
    const fields: { [key: string]: { value: string; confidence: number } } = {};
    const ocrText = ocrResults.map(r => r.text).join(' ');

    // Process each field using its extractor
    for (const [fieldId, extractor] of Object.entries(template.fieldExtractors)) {
      let fieldValue = '';
      let confidence = 0;

      // Try each pattern until we find a match
      for (const pattern of extractor.patterns) {
        const regex = new RegExp(pattern, 'i');
        const match = regex.exec(ocrText);
        
        if (match) {
          fieldValue = match[1] || match[0];
          if (extractor.preprocessor) {
            fieldValue = extractor.preprocessor(fieldValue);
          }
          
          // Validate the extracted value if a validator is provided
          if (extractor.validator && !extractor.validator(fieldValue)) {
            continue;
          }
          
          // Use the confidence of the OCR result that contains this text
          const ocrResult = ocrResults.find(r => r.text.includes(fieldValue));
          confidence = ocrResult?.confidence || 0.5;
          break;
        }
      }

      fields[fieldId] = {
        value: fieldValue,
        confidence
      };
    }

    return fields;
  }

  async generateFormSummary(result: FormProcessingResult): Promise<FormSummary> {
    const template = await getFormTemplate(result.formNumber!);
    if (!template) {
      throw new Error(`No template found for form ${result.formNumber}`);
    }

    const missingRequired = template.sections
      .flatMap(section => section.fields)
      .filter(field => field.required && !result.fields[field.id]?.value)
      .map(field => field.label);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.textModel,  // Using o4-mini for text processing
        messages: [
          {
            role: 'system',
            content: 'You are a VA form processing assistant. Analyze the form data and provide a clear summary with key findings and recommendations. Return the result in JSON format.'
          },
          {
            role: 'user',
            content: JSON.stringify({
              formNumber: result.formNumber,
              formTitle: result.formTitle,
              fields: result.fields,
              missingRequired
            })
          }
        ],
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      // If text model fails, try fallback
      if (response.status === 429 || response.status >= 500) {
        console.warn('Primary text model failed, trying fallback...');
        return this.generateFormSummaryWithFallback(result, missingRequired);
      }
      throw new Error(`Summary generation request failed: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.choices?.[0]?.message?.content) {
      throw new Error('Invalid summary response format');
    }

    try {
      const summary = JSON.parse(data.choices[0].message.content);
      return {
        formNumber: result.formNumber!,
        formTitle: result.formTitle!,
        keyFindings: summary.keyFindings || [],
        missingRequired,
        recommendations: summary.recommendations || [],
        digitalFormUrl: summary.digitalFormUrl
      };
    } catch (error) {
      console.error('Failed to parse summary response:', error);
      throw new Error('Failed to generate form summary');
    }
  }

  /**
   * Fallback form summary using o3
   */
  private async generateFormSummaryWithFallback(result: FormProcessingResult, missingRequired: string[]): Promise<FormSummary> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: AI_MODELS.TEXT_PROCESSING_HIGH_ACCURACY,  // Using o3 for higher accuracy
        messages: [
          {
            role: 'system',
            content: 'You are a VA form processing assistant. Analyze the form data and provide a clear summary with key findings and recommendations. Return the result in JSON format.'
          },
          {
            role: 'user',
            content: JSON.stringify({
              formNumber: result.formNumber,
              formTitle: result.formTitle,
              fields: result.fields,
              missingRequired
            })
          }
        ],
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      throw new Error(`Summary generation fallback request failed: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.choices?.[0]?.message?.content) {
      throw new Error('Invalid summary fallback response format');
    }

    try {
      const summary = JSON.parse(data.choices[0].message.content);
      return {
        formNumber: result.formNumber!,
        formTitle: result.formTitle!,
        keyFindings: summary.keyFindings || [],
        missingRequired,
        recommendations: summary.recommendations || [],
        digitalFormUrl: summary.digitalFormUrl
      };
    } catch (error) {
      console.error('Failed to parse summary fallback response:', error);
      throw new Error('Failed to generate form summary');
    }
  }

  async createDigitalForm(result: FormProcessingResult): Promise<VAForm> {
    const template = await getFormTemplate(result.formNumber!);
    if (!template) {
      throw new Error(`No template found for form ${result.formNumber}`);
    }

    return {
      formNumber: result.formNumber!,
      formTitle: result.formTitle!,
      dateScanned: new Date().toISOString(),
      fields: template.sections.flatMap(section =>
        section.fields.map(field => ({
          ...field,
          value: result.fields[field.id]?.value || ''
        }))
      ),
      sections: template.sections.map(section => ({
        title: section.title,
        fields: section.fields.map(f => f.id)
      }))
    };
  }
} 