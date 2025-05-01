import { FormSection, FormField, FormFieldValue } from './form-schema';
import { DynamicFormField } from './dynamic-form-field';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DynamicFormSectionProps {
  section: FormSection;
  fields: FormField[];
  onChange: (id: string, value: FormFieldValue) => void;
  readOnly?: boolean;
  searchTerm?: string;
}

export function DynamicFormSection({ 
  section, 
  fields, 
  onChange,
  readOnly = false,
  searchTerm = '',
}: DynamicFormSectionProps) {
  // Filter fields based on search term if provided
  const filteredFieldIds = searchTerm.trim() !== '' 
    ? section.fields.filter(fieldId => {
        const field = fields.find(f => f.id === fieldId);
        if (!field) return false;
        
        // Search in label
        const matchLabel = field.label.toLowerCase().includes(searchTerm.toLowerCase());
        
        // Search in value
        let valueStr = '';
        if (typeof field.value === 'string' || typeof field.value === 'number' || typeof field.value === 'boolean') {
          valueStr = String(field.value);
        } else if (field.value !== null && field.value !== undefined) {
          valueStr = JSON.stringify(field.value);
        }
        
        const matchValue = valueStr.toLowerCase().includes(searchTerm.toLowerCase());
        
        return matchLabel || matchValue;
      })
    : section.fields;
  
  // Skip empty sections when searching
  if (searchTerm.trim() !== '' && filteredFieldIds.length === 0) {
    return null;
  }
  
  // Get the actual field objects
  const sectionFields = filteredFieldIds
    .map(id => fields.find(field => field.id === id))
    .filter(Boolean) as FormField[];
  
  return (
    <Card className="mb-8 shadow-sm">
      <CardHeader className="bg-gray-50">
        <CardTitle className="text-lg flex items-center justify-between">
          <span>{section.title}</span>
          <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full">
            {sectionFields.length} {sectionFields.length === 1 ? 'field' : 'fields'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          {sectionFields.map(field => (
            <DynamicFormField
              key={field.id}
              field={field}
              onChange={onChange}
              readOnly={readOnly}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
} 