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
  return createGenericTemplate(formNumber);
}

export async function loadAllTemplates(): Promise<void> {
  // Templates are loaded statically for now
  // In the future, this could load templates from a database or API
} 