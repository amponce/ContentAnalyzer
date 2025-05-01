import { useState } from 'react';
import { FormField, FormFieldValue } from './form-schema';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

interface DynamicFormFieldProps {
  field: FormField;
  onChange: (id: string, value: FormFieldValue) => void;
  readOnly?: boolean;
}

export function DynamicFormField({ field, onChange, readOnly = false }: DynamicFormFieldProps) {
  const [value, setValue] = useState<FormFieldValue>(field.value);
  
  const handleChange = (newValue: FormFieldValue) => {
    setValue(newValue);
    onChange(field.id, newValue);
  };

  // Render controls based on field type
  const renderFieldControl = () => {
    if (readOnly) {
      return renderReadOnlyValue();
    }

    switch (field.type) {
      case 'text':
        return (
          <Input
            id={field.id}
            value={value as string || ''}
            onChange={(e) => handleChange(e.target.value)}
            className="w-full"
            placeholder={`Enter ${field.label.toLowerCase()}`}
          />
        );

      case 'textarea':
        return (
          <Textarea
            id={field.id}
            value={value as string || ''}
            onChange={(e) => handleChange(e.target.value)}
            className="resize-y min-h-[80px]"
            placeholder={`Enter ${field.label.toLowerCase()}`}
          />
        );

      case 'checkbox':
        return (
          <div className="flex items-center space-x-2">
            <Checkbox 
              id={field.id}
              checked={value === true || value === 'true'}
              onCheckedChange={(checked) => 
                handleChange(checked ? true : false)
              }
            />
            <label 
              htmlFor={field.id}
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              {value === true || value === 'true' ? 'Yes' : 'No'}
            </label>
          </div>
        );

      case 'radio':
        if (!field.options || field.options.length === 0) {
          return (
            <Input
              type="text"
              id={field.id}
              value={value as string || ''}
              onChange={(e) => handleChange(e.target.value)}
              className="w-full"
            />
          );
        }
        
        return (
          <RadioGroup
            value={value as string || ''}
            onValueChange={(val: string) => handleChange(val)}
            className="flex flex-col space-y-1"
          >
            {field.options.map((option) => (
              <div key={option} className="flex items-center space-x-2">
                <RadioGroupItem value={option} id={`${field.id}-${option}`} />
                <Label htmlFor={`${field.id}-${option}`}>{option}</Label>
              </div>
            ))}
          </RadioGroup>
        );

      case 'select':
        if (!field.options || field.options.length === 0) {
          return (
            <Input
              type="text"
              id={field.id}
              value={value as string || ''}
              onChange={(e) => handleChange(e.target.value)}
              className="w-full"
            />
          );
        }
        
        return (
          <Select 
            value={value as string || ''} 
            onValueChange={(val: string) => handleChange(val)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {field.options.map((option) => (
                <SelectItem key={option} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'date':
        const dateValue = value ? new Date(value as string) : undefined;
        
        return (
          <div className="grid gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !value && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateValue ? format(dateValue, "PPP") : <span>Select date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateValue}
                  onSelect={(date) => {
                    if (date) {
                      handleChange(format(date, "yyyy-MM-dd"));
                    } else {
                      handleChange('');
                    }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        );

      // Handle nested objects or arrays with custom rendering
      case 'object':
      case 'array':
        return (
          <Textarea
            id={field.id}
            value={typeof value === 'object' ? JSON.stringify(value, null, 2) : '{}'}
            onChange={(e) => {
              try {
                handleChange(JSON.parse(e.target.value));
              } catch (err) {
                // Keep the text as is even if it's invalid JSON while editing
                setValue(e.target.value);
              }
            }}
            className="resize-y min-h-[120px] font-mono text-sm"
          />
        );

      default:
        return (
          <Input
            type="text"
            id={field.id}
            value={value as string || ''}
            onChange={(e) => handleChange(e.target.value)}
            className="w-full"
          />
        );
    }
  };

  // Render read-only view of the field
  const renderReadOnlyValue = () => {
    switch (field.type) {
      case 'checkbox':
        return (
          <div className="flex items-center">
            {value === true || value === 'true' ? (
              <span className="flex items-center">
                <svg className="h-4 w-4 text-green-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Yes
              </span>
            ) : (
              <span className="flex items-center">
                <svg className="h-4 w-4 text-red-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                No
              </span>
            )}
          </div>
        );

      case 'date':
        if (!value) return <span className="text-gray-400 italic">Not provided</span>;
        try {
          return <span>{format(new Date(value as string), "PPP")}</span>;
        } catch (e) {
          return <span>{value as string}</span>;
        }

      case 'object':
      case 'array':
        return (
          <pre className="bg-gray-50 p-2 rounded-md text-xs overflow-auto max-h-[120px]">
            {JSON.stringify(value, null, 2)}
          </pre>
        );

      default:
        return value ? (
          <span className="break-words">{value as string}</span>
        ) : (
          <span className="text-gray-400 italic">Not provided</span>
        );
    }
  };

  return (
    <div className="mb-4">
      <Label 
        htmlFor={field.id} 
        className="text-sm font-medium text-gray-700 mb-1 block"
      >
        {field.label}
        {field.type === 'date' && (
          <span className="ml-1 text-xs text-gray-500">(Date)</span>
        )}
      </Label>
      
      <div className={cn(
        "relative", 
        readOnly ? "rounded-md min-h-[36px] p-2 bg-gray-50" : ""
      )}>
        {renderFieldControl()}
      </div>
    </div>
  );
} 