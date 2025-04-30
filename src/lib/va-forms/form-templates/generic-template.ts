import { VAFormTemplate } from '../types';
import { 
  PERSONAL_INFO_FIELDS,
  SERVICE_INFO_FIELDS, 
  CONTACT_INFO_FIELDS,
  MEDICAL_INFO_FIELDS,
  DEPENDENT_INFO_FIELDS,
  EMPLOYMENT_INFO_FIELDS,
  DECLARATION_FIELDS
} from '../common-fields';

/**
 * Creates a generic template for VA forms that don't have specific templates
 */
export function createGenericTemplate(formNumber: string): VAFormTemplate {
  const formTitle = formNumber === 'N/A' ? 
    'Unidentified VA Form' : 
    `VA Form ${formNumber}`;
  
  // Create a basic field extractor pattern for common fields
  const createBasicExtractor = (fieldName: string, pattern?: string) => {
    const defaultPattern = pattern || 
      `${fieldName}[:\\s]*(.*?)(?:\\s|$|\\n|\\r|\\.|,)`;
    
    return {
      patterns: [defaultPattern],
      preprocessor: (value: string) => value.trim(),
      validator: (value: string) => value.length > 0
    };
  };
  
  // Create field extractors for all common fields
  const fieldExtractors: any = {};
  
  // Add extractors for all field types
  const allFields = [
    ...PERSONAL_INFO_FIELDS,
    ...SERVICE_INFO_FIELDS,
    ...CONTACT_INFO_FIELDS,
    ...MEDICAL_INFO_FIELDS,
    ...DEPENDENT_INFO_FIELDS,
    ...EMPLOYMENT_INFO_FIELDS,
    ...DECLARATION_FIELDS
  ];
  
  allFields.forEach(field => {
    fieldExtractors[field.id] = createBasicExtractor(field.label);
  });
  
  return {
    formNumber: formNumber,
    formTitle: formTitle,
    sections: [
      {
        title: 'Personal Information',
        fields: PERSONAL_INFO_FIELDS
      },
      {
        title: 'Service Information',
        fields: SERVICE_INFO_FIELDS
      },
      {
        title: 'Contact Information',
        fields: CONTACT_INFO_FIELDS
      },
      {
        title: 'Medical Information',
        fields: MEDICAL_INFO_FIELDS
      },
      {
        title: 'Dependent Information',
        fields: DEPENDENT_INFO_FIELDS
      },
      {
        title: 'Employment Information',
        fields: EMPLOYMENT_INFO_FIELDS
      },
      {
        title: 'Declaration',
        fields: DECLARATION_FIELDS
      }
    ],
    fieldExtractors
  };
} 