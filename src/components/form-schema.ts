/**
 * Dynamic form schema that handles any field structure
 * This approach avoids hardcoding specific form fields and can adapt to any form type
 */

// Generic field type that can be any primitive value or nested object/array
export type FormFieldValue = 
  | string 
  | number 
  | boolean 
  | Date 
  | null 
  | undefined
  | { [key: string]: FormFieldValue }
  | FormFieldValue[];

// Field definition with metadata
export interface FormField {
  id: string;
  label: string;
  type: string;
  value: FormFieldValue;
  options?: string[];
}

// Section of related fields
export interface FormSection {
  title: string;
  fields: string[]; // IDs of fields in this section
}

// Complete form data structure
export interface FormData {
  formNumber: string;
  formTitle: string;
  dateScanned: string;
  fields: FormField[];
  sections: FormSection[];
}

// This approach allows for flexible rendering of any form structure
// without hardcoding specific field names or hierarchies 