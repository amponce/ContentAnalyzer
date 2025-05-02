import { BaseAgent } from '../agent-interface';
import { FormField, FormSection, FormData } from '@/components/form-schema';
import { ParserOutput } from '../parser/parser-agent';

/**
 * Input type for the builder agent
 */
export interface BuilderInput {
  /** Parser output with extracted fields */
  parserOutput: ParserOutput;
  /** Form number if known */
  formNumber?: string;
  /** Form title if known */
  formTitle?: string;
}

/**
 * Output type for the builder agent
 */
export interface BuilderOutput {
  /** Complete structured form data */
  formData: FormData;
  /** Metadata about the form building process */
  metadata: {
    /** Time taken to build the form */
    processingTimeMs: number;
    /** Number of fields processed */
    fieldCount: number;
    /** Number of sections created */
    sectionCount: number;
    /** Fields that couldn't be categorized */
    uncategorizedFields: string[];
  };
}

/**
 * Builder agent transforms raw extracted data into structured form objects
 * - Validates field values against expected formats
 * - Resolves ambiguities in field identification
 * - Groups related fields into logical sections
 */
export class BuilderAgent extends BaseAgent<BuilderInput, BuilderOutput> {
  // Key terms used to categorize fields into sections
  private readonly sectionKeywords: Record<string, string[]> = {
    'Personal Information': [
      'name', 'first', 'last', 'middle', 'ssn', 'social', 'security', 'dob', 'birth', 
      'address', 'city', 'state', 'zip', 'phone', 'email', 'gender', 'marital'
    ],
    'Employment Information': [
      'employer', 'employment', 'job', 'occupation', 'position', 'salary', 'income',
      'hire', 'start', 'end', 'work', 'company'
    ],
    'Financial Information': [
      'income', 'salary', 'wage', 'pay', 'expense', 'bank', 'account', 'finance',
      'asset', 'liability', 'debt', 'loan', 'mortgage', 'rent', 'tax'
    ],
    'Medical Information': [
      'health', 'medical', 'doctor', 'hospital', 'insurance', 'condition', 'treatment',
      'medication', 'diagnosis', 'symptom', 'allergy', 'illness', 'injury'
    ],
    'Education Information': [
      'education', 'school', 'college', 'university', 'degree', 'diploma', 'major',
      'grade', 'graduate', 'student', 'study', 'academic'
    ],
    'Family Information': [
      'family', 'spouse', 'husband', 'wife', 'child', 'children', 'dependent',
      'parent', 'mother', 'father', 'sibling', 'brother', 'sister'
    ],
    'Other Information': [] // Fallback category
  };
  
  constructor() {
    super(
      'Builder Agent',
      'Transforms raw extracted data into structured form objects'
    );
  }
  
  /**
   * Process the parser output and create structured form data
   * @param input The parser output with extracted fields
   * @returns Structured form data with fields organized into sections
   */
  async process(input: BuilderInput): Promise<BuilderOutput> {
    const startTime = Date.now();
    
    try {
      console.log(`Building form structure with ${input.parserOutput.fields.length} fields`);
      
      // Create structured form data
      const formData: FormData = {
        formNumber: input.formNumber || 'UNKNOWN',
        formTitle: input.formTitle || 'Untitled Form',
        dateScanned: new Date().toISOString(),
        fields: this.validateFields(input.parserOutput.fields),
        sections: [] // Will be populated below
      };
      
      // Check if the parser provided sections - use those if available
      if (input.parserOutput.metadata?.sections && input.parserOutput.metadata.sections.length > 0) {
        console.log("Using original form sections from parser");
        formData.sections = input.parserOutput.metadata.sections;
      } else {
        // Fall back to grouping fields into sections if parser didn't provide sections
        console.log("Parser didn't provide sections, grouping fields");
        formData.sections = this.groupFieldsIntoSections(formData.fields);
      }
      
      // Count uncategorized fields (those in "Other Information" section)
      const otherSection = formData.sections.find(s => s.title === 'Other Information');
      const uncategorizedFields = otherSection ? otherSection.fields : [];
      
      // Set confidence based on categorization success
      const categorizedFieldsCount = formData.fields.length - uncategorizedFields.length;
      const categorizedRatio = formData.fields.length > 0 
        ? categorizedFieldsCount / formData.fields.length 
        : 0;
      this.setConfidence(0.5 + categorizedRatio * 0.5); // Scale between 0.5 and 1.0
      
      const processingTimeMs = Date.now() - startTime;
      
      return {
        formData,
        metadata: {
          processingTimeMs,
          fieldCount: formData.fields.length,
          sectionCount: formData.sections.length,
          uncategorizedFields
        }
      };
    } catch (error) {
      console.error('Error in BuilderAgent:', error);
      this.setConfidence(0);
      throw error;
    }
  }
  
  /**
   * Validate fields and ensure they have proper types and values
   * @param fields The extracted fields
   * @returns Validated fields
   */
  private validateFields(fields: FormField[]): FormField[] {
    return fields.map(field => {
      // Clone the field to avoid modifying the original
      const validatedField = { ...field };
      
      // Validate based on field type
      switch (field.type) {
        case 'date':
          // Ensure date is in proper format
          if (typeof field.value === 'string' && field.value) {
            try {
              const date = new Date(field.value);
              if (isNaN(date.getTime())) {
                validatedField.value = ''; // Invalid date
              }
            } catch (e) {
              validatedField.value = ''; // Invalid date
            }
          }
          break;
          
        case 'checkbox':
          // Ensure checkbox value is boolean
          validatedField.value = !!field.value;
          break;
          
        case 'text':
        case 'textarea':
          // Ensure text values are strings
          if (typeof field.value !== 'string') {
            validatedField.value = String(field.value || '');
          }
          break;
          
        // Other field types don't need special validation
      }
      
      return validatedField;
    });
  }
  
  /**
   * Group fields into logical sections based on their labels and content
   * @param fields The form fields
   * @returns Organized sections with field references
   */
  private groupFieldsIntoSections(fields: FormField[]): FormSection[] {
    // Initialize sections with empty field arrays
    const sections: FormSection[] = Object.keys(this.sectionKeywords).map(title => ({
      title,
      fields: []
    }));
    
    // Get index of "Other Information" section for uncategorized fields
    const otherSectionIndex = sections.findIndex(s => s.title === 'Other Information');
    
    // Categorize each field
    fields.forEach(field => {
      const fieldId = field.id;
      const label = field.label.toLowerCase();
      
      // Try to match field to a section
      let matched = false;
      
      // Check each section except "Other Information"
      for (let i = 0; i < sections.length; i++) {
        if (i === otherSectionIndex) continue; // Skip "Other Information" for now
        
        const section = sections[i];
        const keywords = this.sectionKeywords[section.title];
        
        // Check if field label contains any keyword for this section
        if (keywords.some(keyword => label.includes(keyword.toLowerCase()))) {
          section.fields.push(fieldId);
          matched = true;
          break;
        }
      }
      
      // If no match found, add to "Other Information"
      if (!matched && otherSectionIndex !== -1) {
        sections[otherSectionIndex].fields.push(fieldId);
      }
    });
    
    // Remove empty sections
    return sections.filter(section => section.fields.length > 0);
  }
} 