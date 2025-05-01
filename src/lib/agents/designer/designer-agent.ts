import { BaseAgent } from '../agent-interface';
import { FormData, FormField } from '@/components/form-schema';
import { BuilderOutput } from '../builder/builder-agent';

/**
 * Input type for the designer agent
 */
export interface DesignerInput {
  /** Builder output with structured form data */
  builderOutput: BuilderOutput;
  /** Design preferences */
  preferences?: {
    /** Layout style */
    layout?: 'single-page' | 'multi-step' | 'tabbed';
    /** Theme colors */
    theme?: {
      primary?: string;
      secondary?: string;
    };
    /** Accessibility level */
    accessibility?: 'standard' | 'enhanced';
  };
}

/**
 * Output type for the designer agent
 */
export interface DesignerOutput {
  /** Enhanced form data with design improvements */
  enhancedFormData: FormData;
  /** Design metadata */
  designMetadata: {
    /** Applied layout style */
    layout: 'single-page' | 'multi-step' | 'tabbed';
    /** UI component mapping for special fields */
    componentMappings: Record<string, string>;
    /** Field ordering within sections */
    fieldOrder: Record<string, string[]>;
    /** Processing time in milliseconds */
    processingTimeMs: number;
  };
}

/**
 * Designer agent creates user-friendly form layouts
 * - Implements multi-step navigation for complex forms
 * - Optimizes field arrangement for better usability
 * - Applies appropriate UI components for different field types
 */
export class DesignerAgent extends BaseAgent<DesignerInput, DesignerOutput> {
  constructor() {
    super(
      'Designer Agent',
      'Creates user-friendly form layouts from structured data'
    );
  }
  
  /**
   * Process the builder output and enhance the form design
   * @param input The builder output with structured form data
   * @returns Enhanced form data with design improvements
   */
  async process(input: DesignerInput): Promise<DesignerOutput> {
    const startTime = Date.now();
    
    try {
      const { formData } = input.builderOutput;
      console.log(`Enhancing form design for ${formData.formNumber}`);
      
      // Determine the best layout based on form complexity
      const layout = this.determineOptimalLayout(formData, input.preferences?.layout);
      
      // Create a copy of the form data to enhance
      const enhancedFormData = JSON.parse(JSON.stringify(formData)) as FormData;
      
      // Optimize field order within sections
      const fieldOrder = this.optimizeFieldOrder(enhancedFormData);
      
      // Determine the best UI components for each field
      const componentMappings = this.determineFieldComponents(enhancedFormData);
      
      // Apply component optimizations to fields
      this.applyComponentMappings(enhancedFormData, componentMappings);
      
      // Reorder sections for optimal flow
      this.optimizeSectionOrder(enhancedFormData);
      
      // Set confidence based on the percentage of fields with optimized components
      const optimizedFieldCount = Object.keys(componentMappings).length;
      const optimizationRatio = enhancedFormData.fields.length > 0
        ? optimizedFieldCount / enhancedFormData.fields.length
        : 0;
      this.setConfidence(0.7 + optimizationRatio * 0.3); // Scale between 0.7 and 1.0
      
      const processingTimeMs = Date.now() - startTime;
      
      return {
        enhancedFormData,
        designMetadata: {
          layout,
          componentMappings,
          fieldOrder,
          processingTimeMs
        }
      };
    } catch (error) {
      console.error('Error in DesignerAgent:', error);
      this.setConfidence(0);
      throw error;
    }
  }
  
  /**
   * Determine the optimal layout based on form complexity
   * @param formData The form data
   * @param preferredLayout The preferred layout from input preferences
   * @returns The optimal layout type
   */
  private determineOptimalLayout(
    formData: FormData,
    preferredLayout?: 'single-page' | 'multi-step' | 'tabbed'
  ): 'single-page' | 'multi-step' | 'tabbed' {
    // If a preferred layout is specified, use it
    if (preferredLayout) {
      return preferredLayout;
    }
    
    // Otherwise, determine based on form complexity
    const totalFields = formData.fields.length;
    const sectionCount = formData.sections.length;
    
    if (totalFields > 30 || sectionCount > 5) {
      return 'multi-step'; // Complex forms with many fields or sections
    } else if (sectionCount >= 3) {
      return 'tabbed'; // Medium complexity forms with several sections
    } else {
      return 'single-page'; // Simple forms with few fields or sections
    }
  }
  
  /**
   * Optimize the order of fields within each section
   * @param formData The form data
   * @returns Mapping of section title to ordered field IDs
   */
  private optimizeFieldOrder(formData: FormData): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    
    // Field type priority (most important first)
    const fieldTypePriority: Record<string, number> = {
      'text': 1,        // Basic text fields first
      'checkbox': 2,    // Simple yes/no questions next
      'radio': 3,       // Selection options after that
      'select': 4,      // Dropdowns after radio buttons
      'date': 5,        // Date selectors next
      'textarea': 6,    // Multi-line text areas later
      'object': 7,      // Complex nested objects later
      'array': 8        // Array fields last
    };
    
    // Process each section
    formData.sections.forEach(section => {
      // Get the fields in this section
      const sectionFields = section.fields
        .map(id => formData.fields.find(f => f.id === id))
        .filter(Boolean) as FormField[];
      
      // Sort fields by type priority
      const sortedFields = [...sectionFields].sort((a, b) => {
        const priorityA = fieldTypePriority[a.type] || 999;
        const priorityB = fieldTypePriority[b.type] || 999;
        return priorityA - priorityB;
      });
      
      // Store the sorted field IDs
      result[section.title] = sortedFields.map(f => f.id);
      
      // Update the section's field order
      section.fields = result[section.title];
    });
    
    return result;
  }
  
  /**
   * Determine the best UI component for each field
   * @param formData The form data
   * @returns Mapping of field ID to component type
   */
  private determineFieldComponents(formData: FormData): Record<string, string> {
    const componentMappings: Record<string, string> = {};
    
    formData.fields.forEach(field => {
      const { id, label, type, value } = field;
      
      // Determine the best component based on field properties
      let component = type; // Default to the field type
      
      // Special handling for different types
      if (type === 'text') {
        // Check for specialized text inputs
        if (label.toLowerCase().includes('email')) {
          component = 'email-input';
        } else if (label.toLowerCase().includes('phone')) {
          component = 'phone-input';
        } else if (label.toLowerCase().includes('password')) {
          component = 'password-input';
        } else if (label.toLowerCase().includes('search')) {
          component = 'search-input';
        } else if (label.toLowerCase().includes('url')) {
          component = 'url-input';
        } else if (label.toLowerCase().includes('number') || 
                  label.toLowerCase().includes('amount') ||
                  label.toLowerCase().includes('count')) {
          component = 'number-input';
        }
      } else if (type === 'object') {
        // Detect special object types
        if (typeof value === 'object' && value !== null) {
          const keys = Object.keys(value);
          
          if (keys.some(k => k.toLowerCase().includes('married') || 
                            k.toLowerCase().includes('single') || 
                            k.toLowerCase().includes('divorced'))) {
            component = 'marital-status-selector';
          } else if (keys.some(k => k.toLowerCase().includes('employer') || 
                                   k.toLowerCase().includes('job'))) {
            component = 'employment-card';
          } else if (keys.some(k => k.toLowerCase().includes('address'))) {
            component = 'address-card';
          }
        }
      }
      
      componentMappings[id] = component;
    });
    
    return componentMappings;
  }
  
  /**
   * Apply component mappings to form fields
   * @param formData The form data to update
   * @param componentMappings Mapping of field ID to component type
   */
  private applyComponentMappings(
    formData: FormData,
    componentMappings: Record<string, string>
  ): void {
    // Update each field with its optimal component
    formData.fields.forEach(field => {
      if (componentMappings[field.id]) {
        // In a real implementation, we would add component-specific properties
        // For now, we'll just add a componentType property for reference
        (field as any).componentType = componentMappings[field.id];
      }
    });
  }
  
  /**
   * Optimize the order of sections for logical flow
   * @param formData The form data to update
   */
  private optimizeSectionOrder(formData: FormData): void {
    // Section priority (most important first)
    const sectionPriority: Record<string, number> = {
      'Personal Information': 1,
      'Family Information': 2,
      'Employment Information': 3,
      'Financial Information': 4,
      'Medical Information': 5,
      'Education Information': 6,
      'Other Information': 999 // Always last
    };
    
    // Sort sections by priority
    formData.sections.sort((a, b) => {
      const priorityA = sectionPriority[a.title] || 50;
      const priorityB = sectionPriority[b.title] || 50;
      return priorityA - priorityB;
    });
  }
} 