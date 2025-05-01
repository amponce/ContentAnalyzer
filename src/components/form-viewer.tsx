import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { 
  Download, 
  ArrowLeft, 
  Printer, 
  Save, 
  Edit, 
  Clipboard, 
  Check, 
  X, 
  AlertCircle,
  Loader2,
  Search,
  ZoomIn,
  ZoomOut,
  Copy,
  CheckCircle2,
  CalendarIcon
} from "lucide-react";

interface FormField {
  id: string;
  label: string;
  value: string;
  type: string;
  options?: string[]; // For select/radio fields
}

interface FormData {
  formNumber: string;
  formTitle: string;
  dateScanned: string;
  fields: FormField[];
  sections: {
    title: string;
    fields: string[];
  }[];
}

export function FormViewer() {
  const [formData, setFormData] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editedData, setEditedData] = useState<Record<string, string>>({});
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [zoomLevel, setZoomLevel] = useState(100);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  
  useEffect(() => {
    // Get form data from query parameters
    const queryParams = new URLSearchParams(window.location.search);
    const formDataParam = queryParams.get('formData');
    
    if (formDataParam) {
      try {
        const decodedData = decodeURIComponent(formDataParam);
        const parsedData = JSON.parse(decodedData);
        setFormData(parsedData);
        
        // Initialize edited data with current values
        const initialEditedData: Record<string, string> = {};
        parsedData.fields.forEach((field: FormField) => {
          initialEditedData[field.id] = field.value.toString();
        });
        setEditedData(initialEditedData);
        
      } catch (err) {
        console.error('Error parsing form data:', err);
        setError('Could not load form data');
      }
    } else {
      setError('No form data provided');
    }
    
    setLoading(false);
  }, []);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary mb-4" />
          <div className="text-lg font-medium">Loading form data...</div>
          <p className="text-sm text-muted-foreground">Please wait while we prepare your form</p>
        </div>
      </div>
    );
  }
  
  if (error || !formData) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
        <div className="w-full max-w-md">
          <div className="p-4 mb-6 border border-red-300 bg-red-50 text-red-700 rounded-md">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 mr-2" />
              <p>{error || 'Form data not available'}</p>
            </div>
          </div>
          <Button onClick={() => window.close()} className="w-full">Close Window</Button>
        </div>
      </div>
    );
  }
  
  const handleFieldChange = (fieldId: string, value: string) => {
    setEditedData({
      ...editedData,
      [fieldId]: value
    });
  };
  
  const handleSaveForm = async () => {
    setSaving(true);
    
    try {
      // Create updated form data
      const updatedFormData = {
        ...formData,
        fields: formData.fields.map(field => ({
          ...field,
          value: editedData[field.id] || field.value
        }))
      };
      
      // Download the form as JSON
      const blob = new Blob([JSON.stringify(updatedFormData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${formData.formNumber || 'va-form'}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setEditMode(false);
    } catch (err) {
      console.error('Error saving form:', err);
    } finally {
      setSaving(false);
    }
  };
  
  const handleCopyToClipboard = async () => {
    try {
      const textData = Object.entries(formData.fields.reduce((acc: Record<string, string>, field) => {
        acc[field.label] = field.value;
        return acc;
      }, {})).map(([label, value]) => `${label}: ${value}`).join('\n');
      
      await navigator.clipboard.writeText(textData);
      alert('Form data copied to clipboard');
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };
  
  const handlePrint = () => {
    window.print();
  };
  
  const handleCopyFieldValue = (fieldId: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000); // Reset after 2 seconds
  };
  
  const increaseZoom = () => {
    setZoomLevel(prev => Math.min(prev + 10, 150));
  };
  
  const decreaseZoom = () => {
    setZoomLevel(prev => Math.max(prev - 10, 80));
  };
  
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };
  
  const filterFieldsBySearch = (fields: string[]) => {
    if (!searchTerm.trim()) return fields;
    
    return fields.filter(fieldId => {
      const field = formData?.fields.find(f => f.id === fieldId);
      if (!field) return false;
      
      const matchLabel = field.label.toLowerCase().includes(searchTerm.toLowerCase());
      const matchValue = field.value.toString().toLowerCase().includes(searchTerm.toLowerCase());
      return matchLabel || matchValue;
    });
  };

  // Render the appropriate form field component based on field type
  const renderFieldEditor = (field: FormField) => {
    const value = editedData[field.id] || '';
    
    switch (field.type) {
      case 'checkbox':
        return (
          <div className="flex items-center space-x-2">
            <Checkbox 
              id={field.id}
              checked={value === 'true'}
              onCheckedChange={(checked) => 
                handleFieldChange(field.id, checked ? 'true' : 'false')
              }
            />
            <label 
              htmlFor={field.id}
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              {value === 'true' ? 'Yes' : 'No'}
            </label>
          </div>
        );
        
      case 'radio':
        if (!field.options || field.options.length === 0) {
          // Fallback to text input if no options provided
          return (
            <Input
              type="text"
              id={field.id}
              value={value}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              className="w-full"
            />
          );
        }
        
        return (
          <RadioGroup
            value={value}
            onValueChange={(val: string) => handleFieldChange(field.id, val)}
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
          // Fallback to text input if no options provided
          return (
            <Input
              type="text"
              id={field.id}
              value={value}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              className="w-full"
            />
          );
        }
        
        return (
          <Select 
            value={value} 
            onValueChange={(val: string) => handleFieldChange(field.id, val)}
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
                  {value ? format(new Date(value), "PPP") : <span>Select date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={value ? new Date(value) : undefined}
                  onSelect={(date: Date | undefined) => handleFieldChange(field.id, date ? format(date, "yyyy-MM-dd") : '')}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        );
        
      case 'textarea':
        return (
          <Textarea
            id={field.id}
            value={value}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            className="resize-y min-h-[80px]"
            placeholder={`Enter ${field.label.toLowerCase()}`}
          />
        );
        
      case 'text':
      default:
        return (
          <Input
            type="text"
            id={field.id}
            value={value}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            className="w-full"
            placeholder={`Enter ${field.label.toLowerCase()}`}
          />
        );
    }
  };

  // Render the appropriate read-only field display component
  const renderFieldDisplay = (field: FormField) => {
    switch (field.type) {
      case 'checkbox':
        return (
          <div className="flex items-center">
            {field.value === 'true' ? (
              <Check className="h-4 w-4 text-green-600 mr-2" />
            ) : (
              <X className="h-4 w-4 text-red-600 mr-2" />
            )}
            <span>{field.value === 'true' ? 'Yes' : 'No'}</span>
          </div>
        );
        
      case 'radio':
      case 'select':
      case 'text':
      case 'textarea':
      case 'date':
      default:
        // For all other types, display the value with highlighting
        const highlightSearch = (text: string) => {
          if (!searchTerm.trim()) return text;
          
          const parts = text.split(new RegExp(`(${searchTerm})`, 'gi'));
          return (
            <>
              {parts.map((part, i) => 
                part.toLowerCase() === searchTerm.toLowerCase() 
                  ? <span key={i} className="bg-yellow-200">{part}</span>
                  : part
              )}
            </>
          );
        };
        
        return (
          <div className="flex justify-between items-center">
            <span className="break-words mr-6">
              {field.value 
                ? highlightSearch(field.value.toString()) 
                : <span className="text-gray-400 italic">Not provided</span>
              }
            </span>
            {field.value && (
              <button 
                onClick={() => handleCopyFieldValue(field.id, field.value.toString())}
                className="absolute right-2 top-2 p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-200 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Copy field value"
              >
                {copiedField === field.id ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            )}
          </div>
        );
    }
  };
  
  // Group fields by section
  const renderFields = () => {
    // Filter sections with matching fields when searching
    return formData?.sections.map((section, sectionIndex) => {
      // Filter fields by search term
      const filteredFields = filterFieldsBySearch(section.fields);
      
      // Skip sections with no matching fields when searching
      if (searchTerm.trim() !== '' && filteredFields.length === 0) {
        return null;
      }
      
      return (
        <Card key={sectionIndex} className="mb-8 print:mb-4 shadow-sm print:shadow-none">
          <CardHeader className="bg-gray-50 print:bg-transparent">
            <CardTitle className="text-lg flex items-center justify-between">
              <span>{section.title}</span>
              <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full">
                {filteredFields.length} {filteredFields.length === 1 ? 'field' : 'fields'}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              {filteredFields.map(fieldId => {
                const field = formData.fields.find(f => f.id === fieldId);
                if (!field) return null;
                
                return (
                  <div key={field.id} className="mb-4 group">
                    <Label 
                      htmlFor={field.id} 
                      className="text-sm font-medium text-gray-700 mb-1 block flex items-center"
                    >
                      {searchTerm.trim() ? (
                        <>
                          {field.label.split(new RegExp(`(${searchTerm})`, 'gi')).map((part, i) => 
                            part.toLowerCase() === searchTerm.toLowerCase() 
                              ? <span key={i} className="bg-yellow-200">{part}</span>
                              : part
                          )}
                        </>
                      ) : (
                        <span>{field.label}</span>
                      )}
                      
                      {field.type === 'date' && (
                        <span className="ml-1 text-xs text-gray-500">(Date)</span>
                      )}
                    </Label>
                    
                    <div className={cn(
                      "relative border rounded-md min-h-[36px]", 
                      editMode ? "" : "p-2 bg-gray-50 group-hover:bg-gray-100 transition-colors"
                    )}>
                      {editMode 
                        ? renderFieldEditor(field)
                        : renderFieldDisplay(field)
                      }
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      );
    });
  };

  return (
    <div className="bg-white min-h-screen print:p-0" style={{ fontSize: `${zoomLevel}%` }}>
      <header className="bg-[#1a365d] text-white p-4 shadow-md print:hidden">
        <div className="container mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <h1 className="font-semibold text-2xl tracking-wide">Content Analyzer</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto py-8 px-4 print:py-0 print:px-0">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 print:hidden">
          <Button 
            variant="outline" 
            onClick={() => window.close()}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Close
          </Button>
          
          {/* Search and zoom controls */}
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <div className="relative flex-grow">
              <Search className="absolute left-2 top-2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search form fields..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="pl-8 w-full"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-2 text-gray-400 hover:text-gray-700"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="icon"
                onClick={decreaseZoom}
                title="Zoom out"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="flex items-center text-sm font-medium px-2 border rounded-md">
                {zoomLevel}%
              </span>
              <Button 
                variant="outline" 
                size="icon"
                onClick={increaseZoom}
                title="Zoom in"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div className="flex gap-2 w-full md:w-auto justify-end">
            {editMode ? (
              <>
                <Button 
                  variant="outline" 
                  onClick={() => setEditMode(false)}
                >
                  Cancel
                </Button>
                <Button 
                  variant="default"
                  onClick={handleSaveForm}
                  disabled={saving}
                  className="flex items-center gap-2"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Form
                </Button>
              </>
            ) : (
              <>
                <Button 
                  variant="outline" 
                  onClick={handlePrint}
                  className="flex items-center gap-2"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
                <Button 
                  variant="outline"
                  onClick={handleCopyToClipboard}
                  className="flex items-center gap-2"
                >
                  <Clipboard className="h-4 w-4 mr-2" />
                  Copy Data
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setEditMode(true)}
                  className="flex items-center gap-2"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button 
                  variant="default"
                  onClick={handleSaveForm}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </>
            )}
          </div>
        </div>

        <Card className="mb-8 shadow-sm print:shadow-none print:border-none">
          <CardHeader className="bg-gray-50 print:bg-transparent">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center">
              <div>
                <CardTitle className="text-2xl">{formData?.formTitle || 'Form'}</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Form Number: {formData?.formNumber || 'N/A'}
                </CardDescription>
              </div>
              <div className="print:hidden">
                <span className="inline-block px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded-full">
                  {formData?.dateScanned ? new Date(formData.dateScanned).toLocaleDateString() : 'Date unknown'}
                </span>
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="print:columns-2 print:gap-4">
          {renderFields()}
        </div>
        
        <div className="flex justify-between py-4 mt-8 border-t print:hidden">
          <p className="text-sm text-muted-foreground">
            Processed by Content Analyzer
          </p>
          {formData?.formNumber && (
            <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800">
              Form {formData.formNumber}
            </span>
          )}
        </div>
      </main>
    </div>
  );
} 