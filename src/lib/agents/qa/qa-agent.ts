import { BaseAgent } from '../agent-interface';
import { FormData, FormField } from '@/components/form-schema';
import { DesignerOutput } from '../designer/designer-agent';

/**
 * Input type for the QA agent
 */
export interface QAInput {
  /** Designer output with enhanced form data */
  designerOutput: DesignerOutput;
  /** Original document text (if available) */
  originalText?: string;
  /** QA requirements */
  requirements?: {
    /** Minimum confidence threshold */
    minConfidence?: number;
    /** Whether to verify required fields are present */
    checkRequiredFields?: boolean;
    /** Whether to verify field formats */
    checkFieldFormats?: boolean;
  };
}

/**
 * QA issue severity levels
 */
export enum IssueSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error'
}

/**
 * QA issue type
 */
export interface QAIssue {
  /** Field ID (if applicable) */
  fieldId?: string;
  /** Issue message */
  message: string;
  /** Issue severity */
  severity: IssueSeverity;
  /** Suggested fix (if available) */
  suggestion?: string;
}

/**
 * Required field check result
 */
export interface RequiredFieldCheck {
  /** List of required fields that are missing values */
  missingRequiredFields: string[];
  /** List of fields that might be required based on the form context */
  potentiallyRequiredFields: string[];
}

/**
 * Field format validation result
 */
export interface FieldFormatValidation {
  /** Fields with invalid formats */
  invalidFormats: Record<string, string>;
  /** Fields with suspicious values */
  suspiciousValues: Record<string, string>;
}

/**
 * Output type for the QA agent
 */
export interface QAOutput {
  /** Validated form data (with potential fixes applied) */
  validatedFormData: FormData;
  /** QA issues found */
  issues: QAIssue[];
  /** Overall confidence score (0-1) */
  overallConfidence: number;
  /** Field-level confidence scores */
  fieldConfidence: Record<string, number>;
  /** QA metadata */
  metadata: {
    /** Required field check results */
    requiredFieldCheck: RequiredFieldCheck;
    /** Field format validation results */
    formatValidation: FieldFormatValidation;
    /** Processing time in milliseconds */
    processingTimeMs: number;
    /** Whether the form passed QA (meets minimum requirements) */
    passedQA: boolean;
  };
}

/**
 * QA agent verifies extraction accuracy and completeness
 * - Identifies potentially missing required fields
 * - Checks for inconsistencies in the extracted data
 * - Provides confidence scores for the overall form processing
 */
export class QAAgent extends BaseAgent<QAInput, QAOutput> {
  // Common field types and their validation patterns
  private readonly fieldPatterns: Record<string, RegExp> = {
    'email': /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    'phone': /^(\+\d{1,3}[- ]?)?\(?(\d{3})\)?[- ]?(\d{3})[- ]?(\d{4})$/,
    'ssn': /^(?:\d{3}-\d{2}-\d{4}|\d{9})$/,
    'zip': /^\d{5}(-\d{4})?$/,
    'date': /^\d{4}-\d{2}-\d{2}$|^\d{1,2}\/\d{1,2}\/\d{2,4}$/
  };
  
  // Fields that are typically required in forms
  private readonly commonRequiredFields: string[] = [
    'name', 'firstName', 'lastName', 'address', 'phone', 'email', 
    'dob', 'birthDate', 'dateOfBirth', 'ssn', 'socialSecurityNumber'
  ];
  
  constructor() {
    super(
      'QA Agent',
      'Verifies extraction accuracy and completeness'
    );
  }
  
  /**
   * Process the designer output and verify form data quality
   * @param input The designer output with enhanced form data
   * @returns Validated form data with quality assessment
   */
  async process(input: QAInput): Promise<QAOutput> {
    const startTime = Date.now();
    
    try {
      const { enhancedFormData } = input.designerOutput;
      console.log(`Performing QA on form ${enhancedFormData.formNumber}`);
      
      // Make a copy of the form data for validation
      const validatedFormData = JSON.parse(JSON.stringify(enhancedFormData)) as FormData;
      
      // Initialize results
      const issues: QAIssue[] = [];
      const fieldConfidence: Record<string, number> = {};
      
      // Check required fields
      const requiredFieldCheck = this.checkRequiredFields(validatedFormData);
      
      // Add issues for missing required fields
      requiredFieldCheck.missingRequiredFields.forEach(fieldId => {
        const field = validatedFormData.fields.find(f => f.id === fieldId);
        if (field) {
          issues.push({
            fieldId,
            message: `Required field "${field.label}" is missing a value`,
            severity: IssueSeverity.ERROR,
            suggestion: 'Please provide a value for this required field'
          });
        }
      });
      
      // Add warnings for potentially required fields
      requiredFieldCheck.potentiallyRequiredFields.forEach(fieldId => {
        const field = validatedFormData.fields.find(f => f.id === fieldId);
        if (field) {
          issues.push({
            fieldId,
            message: `Field "${field.label}" might be required but is empty`,
            severity: IssueSeverity.WARNING,
            suggestion: 'Consider providing a value if applicable'
          });
        }
      });
      
      // Validate field formats
      const formatValidation = this.validateFieldFormats(validatedFormData);
      
      // Add issues for invalid formats
      Object.entries(formatValidation.invalidFormats).forEach(([fieldId, issue]) => {
        const field = validatedFormData.fields.find(f => f.id === fieldId);
        if (field) {
          issues.push({
            fieldId,
            message: `Invalid format for "${field.label}": ${issue}`,
            severity: IssueSeverity.ERROR,
            suggestion: 'Correct the format according to the expected pattern'
          });
        }
      });
      
      // Add warnings for suspicious values
      Object.entries(formatValidation.suspiciousValues).forEach(([fieldId, issue]) => {
        const field = validatedFormData.fields.find(f => f.id === fieldId);
        if (field) {
          issues.push({
            fieldId,
            message: `Suspicious value in "${field.label}": ${issue}`,
            severity: IssueSeverity.WARNING,
            suggestion: 'Verify this value for accuracy'
          });
        }
      });
      
      // Calculate field-level confidence scores
      validatedFormData.fields.forEach(field => {
        // Base confidence on field completeness and format correctness
        let confidence = 0.5; // Default confidence
        
        // Increase confidence for fields with values
        if (field.value !== undefined && field.value !== null && field.value !== '') {
          confidence += 0.3;
          
          // Further increase for fields that pass format validation
          if (!formatValidation.invalidFormats[field.id] && 
              !formatValidation.suspiciousValues[field.id]) {
            confidence += 0.2;
          }
        } else if (requiredFieldCheck.missingRequiredFields.includes(field.id)) {
          // Decrease confidence for missing required fields
          confidence -= 0.3;
        }
        
        fieldConfidence[field.id] = Math.max(0, Math.min(1, confidence));
      });
      
      // Calculate overall confidence
      const totalConfidence = Object.values(fieldConfidence).reduce((sum, c) => sum + c, 0);
      const overallConfidence = validatedFormData.fields.length > 0
        ? totalConfidence / validatedFormData.fields.length
        : 0;
      this.setConfidence(overallConfidence);
      
      // Determine if the form passed QA
      const minConfidence = input.requirements?.minConfidence ?? 0.7;
      const passedQA = overallConfidence >= minConfidence && 
                       requiredFieldCheck.missingRequiredFields.length === 0 &&
                       Object.keys(formatValidation.invalidFormats).length === 0;
      
      const processingTimeMs = Date.now() - startTime;
      
      return {
        validatedFormData,
        issues,
        overallConfidence,
        fieldConfidence,
        metadata: {
          requiredFieldCheck,
          formatValidation,
          processingTimeMs,
          passedQA
        }
      };
    } catch (error) {
      console.error('Error in QAAgent:', error);
      this.setConfidence(0);
      throw error;
    }
  }
  
  /**
   * Check for missing required fields
   * @param formData The form data to check
   * @returns Required field check results
   */
  private checkRequiredFields(formData: FormData): RequiredFieldCheck {
    const missingRequiredFields: string[] = [];
    const potentiallyRequiredFields: string[] = [];
    
    // Check each field
    formData.fields.forEach(field => {
      const { id, value } = field;
      const isEmpty = value === undefined || value === null || value === '';
      
      if (isEmpty) {
        // Check if this field is likely required
        const isLikelyRequired = this.isLikelyRequiredField(field);
        
        if (isLikelyRequired) {
          missingRequiredFields.push(id);
        } else if (this.mightBeRequiredField(field)) {
          potentiallyRequiredFields.push(id);
        }
      }
    });
    
    return {
      missingRequiredFields,
      potentiallyRequiredFields
    };
  }
  
  /**
   * Check if a field is likely required
   * @param field The field to check
   * @returns Whether the field is likely required
   */
  private isLikelyRequiredField(field: FormField): boolean {
    const labelLower = field.label.toLowerCase();
    
    // Check for common required field names
    return this.commonRequiredFields.some(reqField => 
      labelLower.includes(reqField.toLowerCase())
    );
  }
  
  /**
   * Check if a field might be required (but less certain)
   * @param field The field to check
   * @returns Whether the field might be required
   */
  private mightBeRequiredField(field: FormField): boolean {
    const labelLower = field.label.toLowerCase();
    
    // Check for terms that suggest importance
    return labelLower.includes('required') || 
           labelLower.includes('necessary') ||
           labelLower.includes('must') ||
           labelLower.includes('needed');
  }
  
  /**
   * Validate field formats
   * @param formData The form data to validate
   * @returns Field format validation results
   */
  private validateFieldFormats(formData: FormData): FieldFormatValidation {
    const invalidFormats: Record<string, string> = {};
    const suspiciousValues: Record<string, string> = {};
    
    // Check each field
    formData.fields.forEach(field => {
      const { id, type, value } = field;
      
      // Skip empty fields
      if (value === undefined || value === null || value === '') {
        return;
      }
      
      // Validate based on field type
      switch (type) {
        case 'date':
          // Validate date format
          if (typeof value === 'string' && !this.fieldPatterns['date'].test(value)) {
            invalidFormats[id] = 'Invalid date format';
          }
          break;
          
        case 'text':
          // Check for specific text field types based on label
          const labelLower = field.label.toLowerCase();
          
          if (labelLower.includes('email') && 
              typeof value === 'string' && 
              !this.fieldPatterns['email'].test(value)) {
            invalidFormats[id] = 'Invalid email format';
          } else if (labelLower.includes('phone') && 
                    typeof value === 'string' && 
                    !this.fieldPatterns['phone'].test(value)) {
            invalidFormats[id] = 'Invalid phone number format';
          } else if ((labelLower.includes('ssn') || labelLower.includes('social security')) && 
                    typeof value === 'string' && 
                    !this.fieldPatterns['ssn'].test(value)) {
            invalidFormats[id] = 'Invalid SSN format';
          } else if (labelLower.includes('zip') && 
                    typeof value === 'string' && 
                    !this.fieldPatterns['zip'].test(value)) {
            invalidFormats[id] = 'Invalid ZIP code format';
          }
          
          // Check for suspiciously short values in important fields
          if (typeof value === 'string' && 
              (labelLower.includes('name') || labelLower.includes('address')) && 
              value.length < 3) {
            suspiciousValues[id] = 'Value appears too short';
          }
          break;
          
        case 'object':
          // Check for empty objects
          if (typeof value === 'object' && 
              value !== null && 
              Object.keys(value).length === 0) {
            suspiciousValues[id] = 'Object appears to be empty';
          }
          break;
      }
    });
    
    return {
      invalidFormats,
      suspiciousValues
    };
  }
} 