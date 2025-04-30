import { VAFormTemplate } from '../types';
import { VA5655Template } from './va5655';

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
  const templateLoader = formTemplates[formNumber];
  if (!templateLoader) {
    return null;
  }
  return await templateLoader();
}

export async function loadAllTemplates(): Promise<void> {
  // Templates are loaded statically for now
  // In the future, this could load templates from a database or API
} 