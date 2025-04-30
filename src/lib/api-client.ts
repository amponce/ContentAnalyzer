import OpenAI from 'openai';
import { AI_MODELS } from './constants/ai-models';
import { PDFProcessor } from './pdf-processor';

// Supported MIME types for document processing
export const SUPPORTED_MIME_TYPES = {
  // Text files
  'text/plain': ['.txt'],
  'text/markdown': ['.md'],
  'text/html': ['.html'],
  'text/javascript': ['.js'],
  'text/css': ['.css'],
  'text/x-python': ['.py'],
  'text/x-ruby': ['.rb'],
  'text/x-java': ['.java'],
  'text/x-c': ['.c'],
  'text/x-c++': ['.cpp'],
  'text/x-csharp': ['.cs'],
  'text/x-php': ['.php'],
  'text/x-golang': ['.go'],
  'text/x-tex': ['.tex'],
  'application/typescript': ['.ts'],
  
  // Documents
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  
  // Other
  'application/json': ['.json'],
  'application/x-sh': ['.sh']
} as const;

// Image requirements
export const IMAGE_REQUIREMENTS = {
  maxSize: 20 * 1024 * 1024, // 20MB
  lowRes: {
    width: 512,
    height: 512
  },
  highRes: {
    shortSide: 768,
    longSide: 2000
  },
  supportedTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
} as const;

export class APIClient {
  private client: OpenAI;
  private pdfProcessor: PDFProcessor;
  
  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true // Required for browser extensions
    });
    this.pdfProcessor = new PDFProcessor();
  }

  /**
   * Process text content for sentiment analysis
   */
  async analyzeSentiment(text: string) {
    const completion = await this.client.chat.completions.create({
      model: AI_MODELS.TEXT_PROCESSING,
      messages: [
        {
          role: "system",
          content: "You are a sentiment analyzer. Analyze the sentiment of the given text and respond with a JSON object containing 'sentiment' (positive, negative, or neutral) and 'confidence' (a number between 0 and 1)."
        },
        {
          role: "user",
          content: text
        }
      ],
      response_format: { type: "json_object" }
    });

    const content = completion.choices[0].message.content;
    if (!content) {
      throw new Error('No content received from OpenAI');
    }
    const result = JSON.parse(content);
    
    // Include the original text in the response
    return {
      ...result,
      text: text
    };
  }

  /**
   * Process VA form images using vision API
   */
  async processFormImage(imageData: string, detail: 'low' | 'high' | 'auto' = 'high') {
    try {
      console.log(`Processing form image with vision model: ${AI_MODELS.VISION}`);
      
      // Check image size and format
      if (!imageData.startsWith('data:')) {
        throw new Error('Invalid image format. Must be a data URL.');
      }
      
      // Estimate image size (rough calculation)
      const sizeInKB = Math.round((imageData.length * 3) / 4 / 1024);
      console.log(`Approximate image size: ${sizeInKB} KB`);
      
      // Check if image is too large
      if (sizeInKB > 20000) { // 20MB
        console.warn('Image is very large, may cause API issues');
      }
      
      const completion = await this.client.chat.completions.create({
        model: AI_MODELS.VISION,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Please analyze this VA form image. Extract all text and their positions. For each text element, provide the confidence score and bounding box coordinates."
              },
              {
                type: "image_url",
                image_url: {
                  url: imageData,
                  detail
                }
              }
            ]
          }
        ]
      });

      console.log('Vision API processing completed successfully');
      return completion.choices[0].message.content;
    } catch (error: any) {
      console.error('Error in vision API processing:', error);
      
      // Provide more helpful error message
      if (error.response?.status === 400) {
        throw new Error(`Vision API error: The image may be too large or in an unsupported format (${error.message})`);
      } else if (error.response?.status === 401) {
        throw new Error('Vision API error: Invalid API key. Please check your settings.');
      } else {
        throw error;
      }
    }
  }

  /**
   * Perform web search
   */
  async webSearch(query: string) {
    const completion = await this.client.chat.completions.create({
      model: AI_MODELS.WEB_SEARCH,
      web_search_options: {},
      messages: [
        {
          role: "user",
          content: query
        }
      ]
    });

    return completion.choices[0].message.content;
  }

  /**
   * Validate file for processing
   */
  validateFile(file: File): { valid: boolean; error?: string } {
    // Check file type
    if (!file.type) {
      return { valid: false, error: 'File type cannot be determined' };
    }

    // For images
    if (file.type.startsWith('image/')) {
      if (!IMAGE_REQUIREMENTS.supportedTypes.includes(file.type as "image/png" | "image/jpeg" | "image/webp" | "image/gif")) {
        return { valid: false, error: 'Unsupported image type' };
      }
      if (file.size > IMAGE_REQUIREMENTS.maxSize) {
        return { valid: false, error: 'Image size exceeds 20MB limit' };
      }
      return { valid: true };
    }

    // For documents
    const supportedTypes = Object.keys(SUPPORTED_MIME_TYPES);
    if (!supportedTypes.includes(file.type)) {
      return { valid: false, error: 'Unsupported file type' };
    }

    return { valid: true };
  }

  /**
   * Process a PDF form and extract its contents
   */
  async processPDFForm(file: File) {
    const buffer = await file.arrayBuffer();
    
    // Extract form fields
    const formFields = await this.pdfProcessor.extractFormFields(buffer);
    
    // Convert PDF pages to images and process each with Vision API
    const pages = await this.pdfProcessor.processPDF(buffer);
    const processedPages = await Promise.all(
      pages.map(async (page) => {
        const visionResult = await this.processFormImage(page.imageData);
        return {
          pageNumber: page.pageNumber,
          dimensions: {
            width: page.width,
            height: page.height
          },
          visionAnalysis: visionResult
        };
      })
    );

    return {
      formFields,
      pages: processedPages
    };
  }

  /**
   * Process a document file
   */
  async processDocument(file: File) {
    const validation = this.validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Convert file to base64
    const buffer = await file.arrayBuffer();
    
    // Handle PDFs
    if (file.type === 'application/pdf') {
      return this.processPDFForm(file);
    }
    
    // Handle images
    if (file.type.startsWith('image/')) {
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      return this.processFormImage(`data:${file.type};base64,${base64}`);
    }

    throw new Error('Document processing not yet implemented for this file type');
  }
} 