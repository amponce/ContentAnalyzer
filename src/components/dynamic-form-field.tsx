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

  // Check if value is a JSON object (might be a structured object)
  const tryParseJSONObject = (val: any): any => {
    if (typeof val === 'object' && val !== null) return val;
    
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          return parsed;
        }
      } catch (e) {
        // Not valid JSON
      }
    }
    return null;
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
    
    // Handle any JSON object as a dynamic form with fields based on its structure
    const jsonObject = tryParseJSONObject(value);
    if (jsonObject) {
      // Check if this looks like a name-related field
      if (field.id.toLowerCase().includes('name') || field.label.toLowerCase().includes('name')) {
        return (
          <div className="grid gap-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {Object.entries(jsonObject).map(([key, val]) => (
                <div key={key}>
                  <Label htmlFor={`${field.id}-${key}`}>
                    {key.replace(/([A-Z])/g, ' $1')
                       .replace(/^./, str => str.toUpperCase())
                       .replace(/name/i, 'Name')}
                  </Label>
                  <Input 
                    id={`${field.id}-${key}`}
                    value={String(val || '')}
                    onChange={(e) => {
                      const updatedObj = { ...jsonObject, [key]: e.target.value };
                      handleChange(JSON.stringify(updatedObj));
                    }}
                    placeholder={`Enter ${key}`}
                    readOnly={readOnly}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      }
      
      // Check if this is related to phone/call preferences
      const isPhoneField = 
        field.id.toLowerCase().includes('phone') || 
        field.id.toLowerCase().includes('telephone') ||
        field.label.toLowerCase().includes('phone') || 
        field.label.toLowerCase().includes('telephone');
        
      const hasBooleanPreferences = Object.entries(jsonObject).some(([_, v]) => 
        typeof v === 'boolean' || v === 'true' || v === 'false'
      );
      
      if (isPhoneField && hasBooleanPreferences) {
        // Find the phone number field - either a field explicitly named number or the non-boolean field
        const phoneEntry = Object.entries(jsonObject).find(([k, _]) => 
          k.toLowerCase() === 'number' || k.toLowerCase() === 'phone' || k.toLowerCase() === 'telephone'
        ) || Object.entries(jsonObject).find(([_, v]) => 
          typeof v !== 'boolean' && v !== 'true' && v !== 'false'
        );
        
        const phoneKey = phoneEntry ? phoneEntry[0] : 'number';
        const phoneValue = phoneEntry ? String(phoneEntry[1] || '') : '';
        
        return (
          <div className="space-y-3">
            <Input
              type="tel"
              id={`${field.id}-${phoneKey}`}
              value={phoneValue}
              onChange={(e) => {
                const updatedObj = { ...jsonObject, [phoneKey]: e.target.value };
                handleChange(JSON.stringify(updatedObj));
              }}
              className="w-full"
              placeholder="Phone number"
              readOnly={readOnly}
            />
            
            <div className="text-sm font-medium">Call preferences:</div>
            <div className="grid grid-cols-1 gap-2">
              {Object.entries(jsonObject).filter(([_, v]) => 
                typeof v === 'boolean' || v === 'true' || v === 'false'
              ).map(([key, val]) => (
                <div key={key} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${field.id}-${key}`}
                    checked={val === true || val === 'true'}
                    onCheckedChange={(checked) => {
                      const updatedObj = { ...jsonObject, [key]: !!checked };
                      handleChange(JSON.stringify(updatedObj));
                    }}
                    disabled={readOnly}
                  />
                  <Label htmlFor={`${field.id}-${key}`} className="text-sm">
                    {key.replace(/([A-Z])/g, ' $1')
                       .replace(/^./, str => str.toUpperCase())}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        );
      }
      
      // Default JSON editor for any other structured object
      return (
        <div className="grid gap-3 p-3 border rounded-md">
          <Button 
            variant="ghost" 
            className="flex justify-between w-full mb-2" 
            onClick={() => setExpanded(!expanded)}
          >
            <span>{field.label} Details</span>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </Button>
          
          {expanded && (
            <div className="grid gap-3">
              {Object.entries(jsonObject).map(([key, val]) => {
                // Skip complex nested objects for simple rendering
                if (typeof val === 'object' && val !== null) {
                  return (
                    <div key={key} className="border-l-2 pl-3 my-2">
                      <Label className="font-medium">
                        {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                      </Label>
                      <div className="mt-2">
                        <Textarea
                          id={`${field.id}-${key}`}
                          value={JSON.stringify(val, null, 2)}
                          onChange={(e) => {
                            try {
                              const updatedObj = {
                                ...jsonObject,
                                [key]: JSON.parse(e.target.value)
                              };
                              handleChange(JSON.stringify(updatedObj));
                            } catch (e) {
                              // Ignore JSON errors during typing
                            }
                          }}
                          className="resize-y min-h-[80px] font-mono text-sm"
                          readOnly={readOnly}
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
                    {typeof val === 'boolean' || val === 'true' || val === 'false' ? (
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`${field.id}-${key}`}
                          checked={val === true || val === 'true'}
                          onCheckedChange={(checked) => {
                            const updatedObj = {
                              ...jsonObject,
                              [key]: !!checked
                            };
                            handleChange(JSON.stringify(updatedObj));
                          }}
                          disabled={readOnly}
                        />
                        <span className="text-sm">{val === true || val === 'true' ? 'Yes' : 'No'}</span>
                      </div>
                    ) : (
                      <Input
                        id={`${field.id}-${key}`}
                        value={String(val || '')}
                        onChange={(e) => {
                          const updatedObj = {
                            ...jsonObject,
                            [key]: e.target.value
                          };
                          handleChange(JSON.stringify(updatedObj));
                        }}
                        readOnly={readOnly}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
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
        // Offer both calendar and direct input options for dates
        return (
          <div className="grid gap-2">
            <div className="flex items-center gap-2">
              <Input
                type="text"
                id={`${field.id}-direct`}
                value={value as string || ''}
                onChange={(e) => handleChange(e.target.value)}
                className="w-full"
                placeholder="MM/DD/YYYY"
                pattern="\d{1,2}/\d{1,2}/\d{4}"
                readOnly={readOnly}
              />
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="px-2"
                    type="button"
                  >
                    <CalendarIcon className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={value ? new Date(value as string) : undefined}
                    onSelect={(date) => handleChange(date ? format(date, 'MM/dd/yyyy') : null)}
                    initialFocus
                    captionLayout="dropdown"
                    fromYear={1900}
                    toYear={new Date().getFullYear()}
                    defaultMonth={value ? new Date(value as string) : new Date(1980, 0)}
                    disabled={readOnly}
                    classNames={{
                      caption_label: "hidden", // Hide default caption
                      dropdown_month: "w-fit",
                      dropdown_year: "w-fit",
                      dropdown: "p-1 focus:outline-none focus:ring-1 focus:ring-primary rounded-md",
                      nav_button: cn(
                        "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
                        "border border-gray-200 rounded-md hover:bg-gray-100"
                      ),
                      table: "w-full border-collapse space-y-1",
                      head_cell: "text-muted-foreground text-xs font-normal",
                      cell: "h-9 w-9 text-center",
                      day: cn(
                        "h-8 w-8 text-sm p-0 font-normal",
                        "hover:bg-accent hover:text-accent-foreground",
                        "rounded-md aria-selected:opacity-100",
                        "focus:outline-none focus:ring-1 focus:ring-primary"
                      ),
                      day_selected: "bg-primary text-primary-foreground",
                      day_today: "bg-accent text-accent-foreground",
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
            {field.id.toLowerCase().includes('birth') && (
              <div className="text-xs text-gray-500">
                Enter date directly as MM/DD/YYYY or use calendar icon
              </div>
            )}
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

      case 'phone':
        return (
          <Input
            type="tel"
            id={field.id}
            value={value as string || ''}
            onChange={(e) => handleChange(e.target.value)}
            className="w-full"
            placeholder="(123) 456-7890"
            pattern="[0-9()-\s]+"
            readOnly={readOnly}
          />
        );

      case 'email':
      case 'email-input':
        return (
          <Input
            type="email"
            id={field.id}
            value={value as string || ''}
            onChange={(e) => handleChange(e.target.value)}
            className="w-full"
            placeholder="email@example.com"
            readOnly={readOnly}
          />
        );

      case 'ssn-input':
        return (
          <Input
            type="text"
            id={field.id}
            value={value as string || ''}
            onChange={(e) => handleChange(e.target.value)}
            className="w-full font-mono"
            placeholder="XXX-XX-XXXX"
            pattern="[0-9-]+"
            maxLength={11}
            readOnly={readOnly}
          />
        );

      case 'street-address':
      case 'address-field':
        return (
          <Input
            type="text"
            id={field.id}
            value={value as string || ''}
            onChange={(e) => handleChange(e.target.value)}
            className="w-full"
            placeholder="Street address"
            readOnly={readOnly}
          />
        );

      case 'city':
        return (
          <Input
            type="text"
            id={field.id}
            value={value as string || ''}
            onChange={(e) => handleChange(e.target.value)}
            className="w-full"
            placeholder="City"
            readOnly={readOnly}
          />
        );

      case 'state':
        return (
          <Input
            type="text"
            id={field.id}
            value={value as string || ''}
            onChange={(e) => handleChange(e.target.value)}
            className="w-full"
            placeholder="State"
            maxLength={2}
            readOnly={readOnly}
          />
        );

      case 'postal-code':
        return (
          <Input
            type="text"
            id={field.id}
            value={value as string || ''}
            onChange={(e) => handleChange(e.target.value)}
            className="w-full"
            placeholder="Zip code"
            pattern="[0-9-]+"
            maxLength={10}
            readOnly={readOnly}
          />
        );

      case 'county':
        return (
          <Input
            type="text"
            id={field.id}
            value={value as string || ''}
            onChange={(e) => handleChange(e.target.value)}
            className="w-full"
            placeholder="County"
            readOnly={readOnly}
          />
        );

      case 'first-name':
      case 'last-name':
      case 'middle-name':
      case 'name-field':
        return (
          <Input
            type="text"
            id={field.id}
            value={value as string || ''}
            onChange={(e) => handleChange(e.target.value)}
            className="w-full"
            placeholder={field.label}
            readOnly={readOnly}
          />
        );

      case 'name-composite':
        try {
          // Parse the name object
          const nameObj = typeof value === 'string' ? JSON.parse(value) : (value as any || {});
          
          return (
            <div className="grid gap-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label htmlFor={`${field.id}-firstName`}>First Name</Label>
                  <Input 
                    id={`${field.id}-firstName`}
                    value={nameObj.firstName || ''}
                    onChange={(e) => {
                      const updatedName = {
                        ...nameObj,
                        firstName: e.target.value
                      };
                      handleChange(JSON.stringify(updatedName));
                    }}
                    placeholder="First name"
                    readOnly={readOnly}
                  />
                </div>
                <div>
                  <Label htmlFor={`${field.id}-middleName`}>Middle Name</Label>
                  <Input 
                    id={`${field.id}-middleName`}
                    value={nameObj.middleName || ''}
                    onChange={(e) => {
                      const updatedName = {
                        ...nameObj,
                        middleName: e.target.value
                      };
                      handleChange(JSON.stringify(updatedName));
                    }}
                    placeholder="Middle name"
                    readOnly={readOnly}
                  />
                </div>
                <div>
                  <Label htmlFor={`${field.id}-lastName`}>Last Name</Label>
                  <Input 
                    id={`${field.id}-lastName`}
                    value={nameObj.lastName || ''}
                    onChange={(e) => {
                      const updatedName = {
                        ...nameObj,
                        lastName: e.target.value
                      };
                      handleChange(JSON.stringify(updatedName));
                    }}
                    placeholder="Last name"
                    readOnly={readOnly}
                  />
                </div>
              </div>
            </div>
          );
        } catch (e) {
          console.warn("Failed to render name composite field:", e);
          return (
            <Input
              type="text"
              id={field.id}
              value={value as string || ''}
              onChange={(e) => handleChange(e.target.value)}
              className="w-full"
              placeholder="Full Name"
              readOnly={readOnly}
            />
          );
        }

      case 'phone-with-preferences':
        try {
          // Parse the call time preferences
          const callTimeObj = typeof value === 'string' ? JSON.parse(value) : (value as any || {});
          
          if (!callTimeObj.number) {
            callTimeObj.number = '';
          }
          
          return (
            <div>
              <div className="mb-3">
                <Input
                  type="tel"
                  id={field.id}
                  value={callTimeObj.number || ''}
                  onChange={(e) => {
                    const updatedCallTime = {
                      ...callTimeObj,
                      number: e.target.value
                    };
                    handleChange(JSON.stringify(updatedCallTime));
                  }}
                  className="w-full"
                  placeholder="(123) 456-7890"
                  pattern="[0-9()-\s]+"
                  readOnly={readOnly}
                />
              </div>
              
              <div className="text-sm font-medium mb-2">Best time to call:</div>
              <div className="grid grid-cols-3 gap-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={`${field.id}-morning`}
                    checked={!!callTimeObj.morning}
                    onCheckedChange={(checked) => {
                      const updatedCallTime = {
                        ...callTimeObj,
                        morning: !!checked
                      };
                      handleChange(JSON.stringify(updatedCallTime));
                    }}
                    disabled={readOnly}
                  />
                  <Label htmlFor={`${field.id}-morning`} className="text-sm">Morning</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={`${field.id}-afternoon`}
                    checked={!!callTimeObj.afternoon}
                    onCheckedChange={(checked) => {
                      const updatedCallTime = {
                        ...callTimeObj,
                        afternoon: !!checked
                      };
                      handleChange(JSON.stringify(updatedCallTime));
                    }}
                    disabled={readOnly}
                  />
                  <Label htmlFor={`${field.id}-afternoon`} className="text-sm">Afternoon</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={`${field.id}-evening`}
                    checked={!!callTimeObj.evening}
                    onCheckedChange={(checked) => {
                      const updatedCallTime = {
                        ...callTimeObj,
                        evening: !!checked
                      };
                      handleChange(JSON.stringify(updatedCallTime));
                    }}
                    disabled={readOnly}
                  />
                  <Label htmlFor={`${field.id}-evening`} className="text-sm">Evening</Label>
                </div>
              </div>
            </div>
          );
        } catch (e) {
          console.warn("Failed to render phone with preferences field:", e);
          return (
            <Input
              type="tel"
              id={field.id}
              value={value as string || ''}
              onChange={(e) => handleChange(e.target.value)}
              className="w-full"
              placeholder="(123) 456-7890"
              pattern="[0-9()-\s]+"
              readOnly={readOnly}
            />
          );
        }

      case 'json-object':
      case 'complex-object':
        try {
          const jsonObj = typeof value === 'string' ? JSON.parse(value) : (value as any || {});
          
          return (
            <div className="grid gap-3 p-3 border rounded-md">
              <Button 
                variant="ghost" 
                className="flex justify-between w-full mb-2" 
                onClick={() => setExpanded(!expanded)}
              >
                <span>{field.label}</span>
                {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </Button>
              
              {expanded && (
                <div className="grid gap-3">
                  {Object.entries(jsonObj).map(([key, val]) => {
                    // Handle nested objects
                    if (typeof val === 'object' && val !== null) {
                      return (
                        <div key={key} className="border-l-2 pl-3 my-2">
                          <Label className="font-medium">
                            {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                          </Label>
                          <div className="mt-2">
                            <Textarea
                              id={`${field.id}-${key}`}
                              value={JSON.stringify(val, null, 2)}
                              onChange={(e) => {
                                try {
                                  const parsedValue = JSON.parse(e.target.value);
                                  const updatedObj = {
                                    ...jsonObj,
                                    [key]: parsedValue
                                  };
                                  handleChange(JSON.stringify(updatedObj));
                                } catch (e) {
                                  // Ignore JSON errors during typing
                                }
                              }}
                              className="resize-y min-h-[80px] font-mono text-sm"
                              readOnly={readOnly}
                            />
                          </div>
                        </div>
                      );
                    }
                    
                    // Handle boolean values
                    if (typeof val === 'boolean' || val === 'true' || val === 'false') {
                      return (
                        <div key={key} className="flex items-center space-x-2">
                          <Checkbox
                            id={`${field.id}-${key}`}
                            checked={val === true || val === 'true'}
                            onCheckedChange={(checked) => {
                              const updatedObj = {
                                ...jsonObj,
                                [key]: !!checked
                              };
                              handleChange(JSON.stringify(updatedObj));
                            }}
                            disabled={readOnly}
                          />
                          <Label htmlFor={`${field.id}-${key}`}>
                            {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                          </Label>
                        </div>
                      );
                    }
                    
                    // Simple string/number values
                    return (
                      <div key={key} className="grid gap-1">
                        <Label htmlFor={`${field.id}-${key}`}>
                          {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                        </Label>
                        <Input
                          id={`${field.id}-${key}`}
                          value={String(val || '')}
                          onChange={(e) => {
                            const updatedObj = {
                              ...jsonObj,
                              [key]: e.target.value
                            };
                            handleChange(JSON.stringify(updatedObj));
                          }}
                          readOnly={readOnly}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        } catch (e) {
          console.warn("Failed to parse JSON object:", e);
          return (
            <Input
              type="text"
              id={field.id}
              value={value as string || ''}
              onChange={(e) => handleChange(e.target.value)}
              className="w-full"
              readOnly={readOnly}
            />
          );
        }

      case 'boolean-group':
        try {
          const boolObj = typeof value === 'string' ? JSON.parse(value) : (value as any || {});
          
          return (
            <div className="grid gap-2">
              {Object.entries(boolObj).map(([key, val]) => {
                const isBoolean = typeof val === 'boolean' || val === 'true' || val === 'false';
                
                if (!isBoolean) {
                  // Handle non-boolean values (like a main field value)
                  return (
                    <div key={key} className="grid gap-1">
                      <Label htmlFor={`${field.id}-${key}`}>
                        {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                      </Label>
                      <Input
                        id={`${field.id}-${key}`}
                        value={String(val || '')}
                        onChange={(e) => {
                          const updatedObj = {
                            ...boolObj,
                            [key]: e.target.value
                          };
                          handleChange(JSON.stringify(updatedObj));
                        }}
                        readOnly={readOnly}
                      />
                    </div>
                  );
                }
                
                // Handle boolean values as checkboxes
                return (
                  <div key={key} className="flex items-center space-x-2">
                    <Checkbox
                      id={`${field.id}-${key}`}
                      checked={val === true || val === 'true'}
                      onCheckedChange={(checked) => {
                        const updatedObj = {
                          ...boolObj,
                          [key]: !!checked
                        };
                        handleChange(JSON.stringify(updatedObj));
                      }}
                      disabled={readOnly}
                    />
                    <Label htmlFor={`${field.id}-${key}`}>
                      {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    </Label>
                  </div>
                );
              })}
            </div>
          );
        } catch (e) {
          console.warn("Failed to parse boolean group:", e);
          return (
            <Input
              type="text"
              id={field.id}
              value={value as string || ''}
              onChange={(e) => handleChange(e.target.value)}
              className="w-full"
              readOnly={readOnly}
            />
          );
        }

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