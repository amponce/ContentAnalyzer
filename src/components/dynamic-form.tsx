import React, { useState, useEffect } from 'react';
import { FormData, FormFieldValue } from './form-schema';
import { DynamicFormSection } from './dynamic-form-section';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  Download, 
  ArrowLeft, 
  Printer, 
  Save, 
  Edit, 
  Clipboard, 
  ZoomIn,
  ZoomOut,
  Search,
  X
} from "lucide-react";

interface DynamicFormProps {
  formData: FormData;
  onSave?: (updatedFormData: FormData) => void;
  onClose?: () => void;
  readOnly?: boolean;
}

export function DynamicForm({ 
  formData, 
  onSave, 
  onClose, 
  readOnly: initialReadOnly = false 
}: DynamicFormProps) {
  const [data, setData] = useState<FormData>(formData);
  const [editMode, setEditMode] = useState(!initialReadOnly);
  const [searchTerm, setSearchTerm] = useState('');
  const [zoomLevel, setZoomLevel] = useState(100);
  const [saving, setSaving] = useState(false);
  
  // Update internal state when formData changes
  useEffect(() => {
    setData(formData);
  }, [formData]);
  
  // Handle field changes
  const handleFieldChange = (id: string, value: FormFieldValue) => {
    setData(prevData => ({
      ...prevData,
      fields: prevData.fields.map(field => 
        field.id === id ? { ...field, value } : field
      )
    }));
  };
  
  // Handle form save
  const handleSaveForm = async () => {
    if (!onSave) return;
    
    setSaving(true);
    try {
      await onSave(data);
      setEditMode(false);
    } catch (error) {
      console.error('Error saving form:', error);
    } finally {
      setSaving(false);
    }
  };
  
  // Handle print
  const handlePrint = () => {
    window.print();
  };
  
  // Handle copy to clipboard
  const handleCopyToClipboard = async () => {
    try {
      const textData = data.fields
        .map(field => `${field.label}: ${
          typeof field.value === 'object' 
            ? JSON.stringify(field.value) 
            : field.value
        }`)
        .join('\n');
      
      await navigator.clipboard.writeText(textData);
      alert('Form data copied to clipboard');
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };
  
  // Zoom controls
  const increaseZoom = () => {
    setZoomLevel(prev => Math.min(prev + 10, 150));
  };
  
  const decreaseZoom = () => {
    setZoomLevel(prev => Math.max(prev - 10, 80));
  };
  
  // Search handling
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };
  
  return (
    <div className="bg-white min-h-screen print:p-0" style={{ fontSize: `${zoomLevel}%` }}>
      <header className="bg-[#1a365d] text-white p-4 shadow-md print:hidden">
        <div className="container mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <h1 className="font-semibold text-2xl tracking-wide">Form Viewer</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto py-8 px-4 print:py-0 print:px-0">
        {/* Controls */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 print:hidden">
          {/* Back button */}
          {onClose && (
            <Button 
              variant="outline" 
              onClick={onClose}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Close
            </Button>
          )}
          
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
          
          {/* Action buttons */}
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
                    <div className="h-4 w-4 border-2 border-t-transparent border-white rounded-full animate-spin mr-2" />
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
        
        {/* Form header */}
        <Card className="mb-8 shadow-sm print:shadow-none print:border-none">
          <CardHeader className="bg-gray-50 print:bg-transparent">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center">
              <div>
                <CardTitle className="text-2xl">{data.formTitle || 'Form'}</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Form Number: {data.formNumber || 'N/A'}
                </CardDescription>
              </div>
              <div className="print:hidden">
                <span className="inline-block px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded-full">
                  {data.dateScanned ? new Date(data.dateScanned).toLocaleDateString() : 'Date unknown'}
                </span>
              </div>
            </div>
          </CardHeader>
        </Card>
        
        {/* Form sections */}
        <div className="print:columns-2 print:gap-4">
          {data.sections.map((section, index) => (
            <DynamicFormSection
              key={`${section.title}-${index}`}
              section={section}
              fields={data.fields}
              onChange={handleFieldChange}
              readOnly={!editMode}
              searchTerm={searchTerm}
            />
          ))}
        </div>
        
        {/* Form footer */}
        <div className="flex justify-between py-4 mt-8 border-t print:hidden">
          <p className="text-sm text-muted-foreground">
            Processed by Content Analyzer
          </p>
          {data.formNumber && (
            <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800">
              Form {data.formNumber}
            </span>
          )}
        </div>
      </main>
    </div>
  );
} 