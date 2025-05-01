import { useState, useEffect } from 'react';
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
import { CalendarIcon, ChevronDown, ChevronUp, Plus, Trash } from "lucide-react";

interface DynamicFormFieldProps {
  field: FormField;
  onChange: (id: string, value: FormFieldValue) => void;
  readOnly?: boolean;
}

export function DynamicFormField({ field, onChange, readOnly = false }: DynamicFormFieldProps) {
  const [value, setValue] = useState<FormFieldValue>(field.value);
  const [expanded, setExpanded] = useState(false);
  
  // Update local state when prop changes
  useEffect(() => {
    setValue(field.value);
  }, [field.value]);
  
  const handleChange = (newValue: FormFieldValue) => {
    setValue(newValue);
    onChange(field.id, newValue);
  };

  // Check if value is a boolean object (like marital status)
  const isBooleanObject = (val: any): boolean => {
    if (typeof val !== 'object' || val === null) return false;
    
    // Check if all values are booleans
    return Object.values(val).every(v => typeof v === 'boolean' || v === 'true' || v === 'false');
  };
  
  // Check if value is an employment record
  const isEmploymentRecord = (val: any): boolean => {
    if (typeof val !== 'object' || val === null) return false;
    
    // Check for typical employment record fields
    const keys = Object.keys(val);
    return keys.some(key => 
      key.includes('employer') || 
      key.includes('Date') || 
      key.includes('salary') || 
      key.includes('position')
    );
  };

  // Render controls based on field type and detected value structure
  const renderFieldControl = () => {
    if (readOnly) {
      return renderReadOnlyValue();
    }

    // Special handling for detected field types
    if (field.id.toLowerCase().includes('maritalstatus') || isBooleanObject(value)) {
      return renderBooleanObjectEditor();
    }
    
    if (field.id.toLowerCase().includes('employment') || isEmploymentRecord(value)) {
      return renderEmploymentEditor();
    }
    
    // Handle known field types
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

      // Handle generic objects and arrays
      case 'object':
      case 'array':
        if (Array.isArray(value)) {
          return renderArrayEditor();
        } else if (value !== null && typeof value === 'object') {
          return renderObjectEditor();
        }
        
        // Fallback for raw JSON editing
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

  // Render a structured editor for boolean objects (like marital status)
  const renderBooleanObjectEditor = () => {
    if (!value || typeof value !== 'object') {
      // Initialize with an empty object if not set
      const initialValue = {};
      handleChange(initialValue);
      return null;
    }

    return (
      <div className="grid gap-3 p-3 border rounded-md">
        {Object.entries(value as Record<string, boolean>).map(([key, val]) => (
          <div key={key} className="flex items-center space-x-3">
            <Checkbox
              id={`${field.id}-${key}`}
              checked={!!val}
              onCheckedChange={(checked) => {
                const newValue = {
                  ...(value as object),
                  [key]: checked
                };
                handleChange(newValue);
              }}
            />
            <Label htmlFor={`${field.id}-${key}`}>
              {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
            </Label>
          </div>
        ))}
      </div>
    );
  };

  // Render a structured editor for employment records
  const renderEmploymentEditor = () => {
    if (!value || typeof value !== 'object') {
      // Initialize with an empty object if not set
      const initialValue = {
        employerName: '',
        employerAddress: '',
        fromDate: '',
        toDate: '',
        position: ''
      };
      handleChange(initialValue);
      return null;
    }

    return (
      <div className="grid gap-3 p-3 border rounded-md">
        <Button 
          variant="ghost" 
          className="flex justify-between w-full mb-2" 
          onClick={() => setExpanded(!expanded)}
        >
          <span>Employment Details</span>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </Button>
        
        {expanded && (
          <div className="grid gap-3">
            {Object.entries(value as Record<string, any>).map(([key, val]) => {
              // Skip non-string fields for simplicity
              if (typeof val === 'object' && val !== null) return null;
              
              if (key.toLowerCase().includes('date')) {
                const dateValue = val ? new Date(val as string) : undefined;
                return (
                  <div key={key} className="grid gap-1">
                    <Label htmlFor={`${field.id}-${key}`}>
                      {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !val && "text-muted-foreground"
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
                            const newValue = {
                              ...(value as object),
                              [key]: date ? format(date, "yyyy-MM-dd") : ''
                            };
                            handleChange(newValue);
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                );
              }
              
              return (
                <div key={key} className="grid gap-1">
                  <Label htmlFor={`${field.id}-${key}`}>
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  </Label>
                  <Input
                    id={`${field.id}-${key}`}
                    value={val as string || ''}
                    onChange={(e) => {
                      const newValue = {
                        ...(value as object),
                        [key]: e.target.value
                      };
                      handleChange(newValue);
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Render a generic object editor
  const renderObjectEditor = () => {
    if (!value || typeof value !== 'object') return null;
    
    return (
      <div className="grid gap-3 p-3 border rounded-md">
        <Button 
          variant="ghost" 
          className="flex justify-between w-full mb-2" 
          onClick={() => setExpanded(!expanded)}
        >
          <span>Object Properties</span>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </Button>
        
        {expanded && (
          <div className="grid gap-3">
            {Object.entries(value as Record<string, any>).map(([key, val]) => {
              // Handle nested objects recursively
              if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
                return (
                  <div key={key} className="border-l-2 pl-3 my-2">
                    <Label className="font-medium">{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</Label>
                    <div className="mt-2">
                      <Textarea
                        id={`${field.id}-${key}`}
                        value={JSON.stringify(val, null, 2)}
                        onChange={(e) => {
                          try {
                            const newValue = {
                              ...(value as object),
                              [key]: JSON.parse(e.target.value)
                            };
                            handleChange(newValue);
                          } catch (err) {
                            // Ignore JSON parsing errors during editing
                          }
                        }}
                        className="resize-y min-h-[80px] font-mono text-sm"
                      />
                    </div>
                  </div>
                );
              }
              
              return (
                <div key={key} className="grid gap-1">
                  <Label htmlFor={`${field.id}-${key}`}>
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  </Label>
                  <Input
                    id={`${field.id}-${key}`}
                    value={String(val || '')}
                    onChange={(e) => {
                      const newValue = {
                        ...(value as object),
                        [key]: e.target.value
                      };
                      handleChange(newValue);
                    }}
                  />
                </div>
              );
            })}
            
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2" 
              onClick={() => {
                const key = prompt("Enter property name:");
                if (key) {
                  const newValue = {
                    ...(value as object),
                    [key]: ""
                  };
                  handleChange(newValue);
                }
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Property
            </Button>
          </div>
        )}
      </div>
    );
  };

  // Render an array editor
  const renderArrayEditor = () => {
    const arrayValue = Array.isArray(value) ? value : [];
    
    return (
      <div className="grid gap-3 p-3 border rounded-md">
        <Button 
          variant="ghost" 
          className="flex justify-between w-full mb-2" 
          onClick={() => setExpanded(!expanded)}
        >
          <span>Array Items ({arrayValue.length})</span>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </Button>
        
        {expanded && (
          <div className="grid gap-3">
            {arrayValue.map((item, index) => (
              <div key={index} className="flex gap-2 items-start">
                <div className="flex-1">
                  {typeof item === 'object' && item !== null ? (
                    <Textarea
                      value={JSON.stringify(item, null, 2)}
                      onChange={(e) => {
                        try {
                          const newArray = [...arrayValue];
                          newArray[index] = JSON.parse(e.target.value);
                          handleChange(newArray);
                        } catch (err) {
                          // Ignore JSON parsing errors during editing
                        }
                      }}
                      className="resize-y min-h-[80px] font-mono text-sm"
                    />
                  ) : (
                    <Input
                      value={String(item || '')}
                      onChange={(e) => {
                        const newArray = [...arrayValue];
                        newArray[index] = e.target.value;
                        handleChange(newArray);
                      }}
                    />
                  )}
                </div>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => {
                    const newArray = arrayValue.filter((_, i) => i !== index);
                    handleChange(newArray);
                  }}
                >
                  <Trash className="h-4 w-4" />
                </Button>
              </div>
            ))}
            
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2" 
              onClick={() => {
                const newArray = [...arrayValue, ""];
                handleChange(newArray);
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Item
            </Button>
          </div>
        )}
      </div>
    );
  };

  // Render read-only view of the field
  const renderReadOnlyValue = () => {
    // Special handling for boolean objects
    if (isBooleanObject(value)) {
      return (
        <div className="grid gap-1">
          {Object.entries(value as Record<string, boolean>).map(([key, val]) => (
            <div key={key} className="flex items-center space-x-2">
              {val ? (
                <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              <span>{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</span>
            </div>
          ))}
        </div>
      );
    }

    // Special handling for employment records
    if (isEmploymentRecord(value)) {
      return (
        <div className="grid gap-1">
          <Button 
            variant="ghost" 
            className="flex justify-between w-full mb-2" 
            onClick={() => setExpanded(!expanded)}
          >
            <span>Employment Details</span>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </Button>
          
          {expanded && Object.entries(value as Record<string, any>).map(([key, val]) => {
            if (typeof val === 'object' && val !== null) return null;
            return (
              <div key={key} className="grid grid-cols-[1fr,2fr] gap-1 text-sm">
                <span className="font-medium">{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:</span>
                <span>{String(val || 'Not provided')}</span>
              </div>
            );
          })}
        </div>
      );
    }

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
        // Complex object/array handling
        const displayValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value || '');
        
        if (displayValue.length > 100) {
          return (
            <div>
              <Button 
                variant="ghost" 
                className="text-xs mb-1" 
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? 'Collapse' : 'Expand'} {Array.isArray(value) ? 'Array' : 'Object'}
              </Button>
              {expanded ? (
                <pre className="bg-gray-50 p-2 rounded-md text-xs overflow-auto max-h-[300px]">
                  {displayValue}
                </pre>
              ) : (
                <span className="text-gray-600 text-sm">
                  {Array.isArray(value) 
                    ? `Array with ${value.length} items` 
                    : `Object with ${Object.keys(value || {}).length} properties`}
                </span>
              )}
            </div>
          );
        }
        
        return (
          <pre className="bg-gray-50 p-2 rounded-md text-xs overflow-auto max-h-[120px]">
            {displayValue}
          </pre>
        );

      default:
        return value ? (
          <span className="break-words">{String(value)}</span>
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