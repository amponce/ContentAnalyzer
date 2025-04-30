import { VAFormTemplate } from '../types';
import { VA5655Template } from './va5655';
import { createGenericTemplate } from './generic-template';

export interface FormTemplateRegistry {
  [formNumber: string]: () => Promise<VAFormTemplate>;
}

const formTemplates: FormTemplateRegistry = {
  '5655': async () => VA5655Template
};

export async function registerFormTemplate(formNumber: string, template: VAFormTemplate) {
  formTemplates[formNumber] = async () => template;
}

export async function getFormTemplate(formNumber: string): Promise<VAFormTemplate | null> {
  // Clean formNumber to handle variations in format (e.g., "VA-5655", "VA 5655", etc.)
  const cleanedFormNumber = formNumber.replace(/^va[\s-]*/i, '').trim();
  
  const templateLoader = formTemplates[cleanedFormNumber];
  if (!templateLoader) {
    console.warn(`No specific template found for form ${formNumber}, using generic template`);
    // Return a generic template instead of null
    return createGenericTemplate(formNumber);
  }
  return await templateLoader();
}

export async function loadAllTemplates(): Promise<void> {
  // Templates are loaded statically for now
  // In the future, this could load templates from a database or API
} 