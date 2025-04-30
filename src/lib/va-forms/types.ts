export interface VAFormField {
  id: string;
  label: string;
  value: string;
  type: 'text' | 'checkbox' | 'radio' | 'date' | 'select';
  required?: boolean;
  options?: string[]; // For select/radio fields
}

export interface VAForm {
  formNumber: string;  // e.g., "21-526EZ"
  formTitle: string;
  dateScanned?: string;
  fields: VAFormField[];
  sections: {
    title: string;
    fields: string[]; // Array of field IDs
  }[];
}

export interface OCRResult {
  confidence: number;
  text: string;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface FormProcessingResult {
  formIdentified: boolean;
  formNumber?: string;
  formTitle?: string;
  fields: {
    [key: string]: {
      value: string;
      confidence: number;
    };
  };
  rawOCR: OCRResult[];
}

export interface FormSummary {
  formNumber: string;
  formTitle: string;
  keyFindings: string[];
  missingRequired: string[];
  recommendations: string[];
  digitalFormUrl?: string;
} 