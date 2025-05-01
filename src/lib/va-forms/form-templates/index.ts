import { VAFormTemplate } from '../types';

/**
 * Creates a universal template for any government form
 * This approach uses pure AI detection without pre-defined fields
 */
function createGenericTemplate(formNumber: string): VAFormTemplate {
  const formTitle = formNumber === 'UNKNOWN' ? 
    'Unidentified Government Form' : 
    `Form ${formNumber}`;
  
  // Create a minimal template structure that the processor can use
  // Actual fields will be determined by AI during processing
  return {
    formNumber: formNumber,
    formTitle: formTitle,
    sections: [
      {
        title: 'Form Data',
        fields: [] // Empty - will be populated dynamically
      }
    ],
    fieldExtractors: {}  // Empty - we'll use AI extraction instead of regex
  };
}

export async function getFormTemplate(formNumber: string): Promise<VAFormTemplate> {
  // Always use a universal template that doesn't require predefined form structures
  // This allows our system to work with ANY government form without specific hardcoding
  return createGenericTemplate(formNumber);
}

export async function loadAllTemplates(): Promise<void> {
  // Templates are loaded dynamically based on the form being processed
  // No need to preload specific templates since we use AI-driven extraction
} 