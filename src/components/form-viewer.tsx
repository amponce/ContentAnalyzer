import { useState, useEffect } from 'react';
import { FormData } from './form-schema';
import { DynamicForm } from './dynamic-form';
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FormViewer() {
  const [formData, setFormData] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    // Get form data from query parameters
    const queryParams = new URLSearchParams(window.location.search);
    const formDataParam = queryParams.get('formData');
    
    if (formDataParam) {
      try {
        const decodedData = decodeURIComponent(formDataParam);
        const parsedData = JSON.parse(decodedData);
        setFormData(parsedData);
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
  
  const handleSave = async (updatedFormData: FormData) => {
    try {
      // Download the form as JSON
      const blob = new Blob([JSON.stringify(updatedFormData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${updatedFormData.formNumber || 'form'}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      return true;
    } catch (err) {
      console.error('Error saving form:', err);
      throw err;
    }
  };
  
  return (
    <DynamicForm 
      formData={formData} 
      onSave={handleSave}
      onClose={() => window.close()} 
    />
  );
} 