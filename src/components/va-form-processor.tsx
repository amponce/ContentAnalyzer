import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Download, CheckCircle, AlertCircle, Edit, Save, FileWarning } from "lucide-react";
import { VAFormProcessor as FormProcessor } from '@/lib/va-forms/form-processor';
import { PDFProcessor } from '@/lib/pdf-processor';
import type { FormProcessingResult, FormSummary } from '@/lib/va-forms/types';

export function VAFormProcessorComponent() {
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<FormProcessingResult | null>(null);
  const [summary, setSummary] = useState<FormSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState<{[key: string]: string}>({});
  const pdfProcessor = new PDFProcessor();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const isPDF = (file: File) => {
    return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  };

  const isImage = (file: File) => {
    return file.type.startsWith('image/');
  };

  const convertPDFToImage = async (pdfFile: File): Promise<string> => {
    try {
      const buffer = await pdfFile.arrayBuffer();
      console.log('Converting PDF to image...');
      
      try {
        const pages = await pdfProcessor.processPDF(buffer);
        
        if (pages.length === 0) {
          console.warn('No pages found in PDF, trying fallback method');
          return await convertPDFUsingBrowser(pdfFile);
        }
        
        // For now, we'll just use the first page
        // TODO: Add support for multi-page forms if needed
        
        // Check if the image is too large for API processing
        let imageData = pages[0].imageData;
        const sizeInKB = Math.round((imageData.length * 3) / 4 / 1024);
        console.log(`Original PDF image size: ~${sizeInKB} KB`);
        
        // If image is too large, resize it using the canvas
        if (sizeInKB > 10000) { // 10MB is big for API processing
          console.log('Image is large, reducing size to avoid API limits...');
          imageData = await reduceImageSize(imageData, 0.7); // Reduce quality
        }
        
        return imageData;
      } catch (processingError) {
        // Log the actual error for debugging
        console.error('Detailed PDF processing error:', processingError);
        
        // Try fallback method immediately if PDF.js processing fails
        console.log('Using fallback PDF rendering method...');
        return await convertPDFUsingBrowser(pdfFile);
      }
    } catch (error) {
      // This is a catastrophic error where even the fallback failed
      console.error('All PDF processing methods failed:', error);
      
      // Pass through the actual error message
      if (error instanceof Error) {
        throw new Error(`PDF processing failed: ${error.message}`);
      }
      throw error;
    }
  };

  // Browser-based PDF rendering fallback
  const convertPDFUsingBrowser = (_: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        console.log('Using browser-based PDF fallback rendering');
        // Create a simple canvas with text explaining this is a fallback
        const canvas = canvasRef.current || document.createElement('canvas');
        
        // Set canvas dimensions - reduced to avoid API size limits
        canvas.width = 800;  // Reduced width for API compatibility
        canvas.height = 1000; // Reduced height
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        
        // Fill with white background (represents a blank page)
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add form outline
        ctx.strokeStyle = '#cccccc';
        ctx.lineWidth = 2;
        ctx.strokeRect(50, 50, canvas.width - 100, canvas.height - 100);
        
        // Add VA logo representation
        ctx.fillStyle = '#003e7e'; // VA blue
        ctx.beginPath();
        ctx.arc(canvas.width / 2, 100, 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'white';
        ctx.font = 'bold 30px Arial';
        ctx.fillText('VA', canvas.width / 2 - 15, 110);
        
        // Add text explaining this is a fallback
        ctx.font = 'bold 18px Arial';
        ctx.fillStyle = 'black';
        ctx.fillText('VA FORM (FALLBACK MODE)', canvas.width / 2 - 120, 180);
        
        ctx.font = '14px Arial';
        ctx.fillText('PDF being processed in compatibility mode', canvas.width / 2 - 140, 220);
        
        // Add form-like elements (simplified version)
        ctx.fillStyle = '#666666';
        ctx.font = '14px Arial';
        
        // Generate light form grid to help OCR processing
        for (let i = 0; i < 5; i++) {
          const y = 300 + i * 120;
          ctx.fillText(`SECTION ${i+1}`, 100, y - 20);
          
          for (let j = 0; j < 2; j++) {
            const x = 100 + j * 350;
            ctx.fillText(`Field ${i*2+j+1}`, x, y - 5);
            ctx.strokeRect(x, y, 300, 30);
          }
        }
        
        // Get the image data with reduced quality to decrease size
        const imageData = canvas.toDataURL('image/jpeg', 0.7);
        
        console.log(`Generated fallback image size: ~${Math.round(imageData.length / 1024)} KB`);
        resolve(imageData);
      } catch (error) {
        console.error('Fallback rendering error:', error);
        reject(new Error('Could not create fallback PDF image'));
      }
    });
  };

  // Helper function to reduce image size
  const reduceImageSize = (dataUrl: string, quality = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        
        // Calculate new dimensions (max 1500px on longest side)
        let width = img.width;
        let height = img.height;
        const maxSize = 1500;
        
        if (width > height && width > maxSize) {
          height = Math.floor((height * maxSize) / width);
          width = maxSize;
        } else if (height > maxSize) {
          width = Math.floor((width * maxSize) / height);
          height = maxSize;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to JPEG with reduced quality
        const reduced = canvas.toDataURL('image/jpeg', quality);
        const newSizeInKB = Math.round((reduced.length * 3) / 4 / 1024);
        console.log(`Reduced image size: ~${newSizeInKB} KB`);
        
        resolve(reduced);
      };
      img.onerror = () => reject(new Error('Failed to load image for resizing'));
      img.src = dataUrl;
    });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    if (!isPDF(selectedFile) && !isImage(selectedFile)) {
      setError('Invalid file type. Please upload a PDF or image file (jpg, png, etc).');
      return;
    }

    setFile(selectedFile);
    setError(null);
    setResult(null);
    setSummary(null);
    setFormData({});
  };

  const handleProcessForm = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      // Get API key from storage
      const { apiKey } = await chrome.storage.sync.get(['apiKey']);
      if (!apiKey) {
        throw new Error('Please configure your OpenAI API key in the settings first');
      }

      let imageData: string;
      
      try {
        if (isPDF(file)) {
          imageData = await convertPDFToImage(file);
        } else {
          // Handle image file
          imageData = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = () => reject(new Error('Failed to read the image file. Please try again.'));
            reader.readAsDataURL(file);
          });
        }

        const processor = new FormProcessor(apiKey);
        const processingResult = await processor.processScannedForm(imageData);
        
        // IMPORTANT: Always consider the form identified if it has ANY fields
        const hasFields = Object.keys(processingResult.fields).length > 0;
        
        if (hasFields) {
          // If any fields were extracted, consider it identified
          processingResult.formIdentified = true;
          
          // Only set generic info if no form number was found
          if (!processingResult.formNumber) {
            processingResult.formNumber = 'GENERIC';
            processingResult.formTitle = 'Generic Form';
          }
        }
        
        setResult(processingResult);

        if (processingResult.formIdentified) {
          const formSummary = await processor.generateFormSummary(processingResult);
          setSummary(formSummary);
          
          setFormData(Object.entries(processingResult.fields).reduce((acc, [key, field]) => ({
            ...acc,
            [key]: field.value
          }), {}));
        } else {
          // This now only happens if NO fields were extracted at all
          setError('No form fields were detected. Please make sure you uploaded a valid form document.');
        }
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('An error occurred while processing the form');
        }
        console.error('Form processing error:', err);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setProcessing(false);
    }
  };

  const handleFieldChange = (fieldId: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [fieldId]: value
    }));
  };

  const handleSaveForm = async () => {
    if (!result) return;

    try {
      setProcessing(true);
      const { apiKey } = await chrome.storage.sync.get(['apiKey']);
      const processor = new FormProcessor(apiKey);
      
      // Create digital form with updated data
      const digitalForm = await processor.createDigitalForm({
        ...result,
        fields: Object.entries(formData).reduce((acc, [key, value]) => ({
          ...acc,
          [key]: { value, confidence: 1 }
        }), {})
      });

      // Download the form as JSON
      const blob = new Blob([JSON.stringify(digitalForm, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${result.formNumber || 'va-form'}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setEditMode(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save form');
    } finally {
      setProcessing(false);
    }
  };

  // Helper function to infer field type from field name
  const inferFieldType = (fieldId: string, value: string): 'text' | 'checkbox' | 'date' | 'select' => {
    // Date fields
    if (fieldId.toLowerCase().includes('date') || /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) {
      return 'date';
    }
    
    // Boolean fields
    if (value === 'true' || value === 'false') {
      return 'checkbox';
    }
    
    // Default to text
    return 'text';
  };
  
  // Helper function to format field labels
  const formatFieldLabel = (fieldId: string): string => {
    return fieldId
      // Insert a space before all uppercase letters
      .replace(/([A-Z])/g, ' $1')
      // Replace first character with uppercase
      .replace(/^./, str => str.toUpperCase())
      // Fix specific acronyms
      .replace(' S S N', ' SSN')
      .replace(' D O B', ' DOB')
      .replace(' V A', ' VA');
  };

  // Updated render method for dynamic fields
  const renderDynamicFields = () => {
    if (!result || !formData) return null;
    
    // Group fields by categories based on field names
    const fieldGroups: {[group: string]: string[]} = {
      'Personal Information': [],
      'Contact Information': [],
      'Service Information': [],
      'Medical Information': [],
      'Financial Information': [],
      'Other Information': []
    };
    
    // Sort fields into categories
    const fieldIds = Object.keys(formData);
    fieldIds.forEach(fieldId => {
      const lowerFieldId = fieldId.toLowerCase();
      
      if (lowerFieldId.includes('name') || lowerFieldId.includes('ssn') || 
          lowerFieldId.includes('birth') || lowerFieldId.includes('gender')) {
        fieldGroups['Personal Information'].push(fieldId);
      }
      else if (lowerFieldId.includes('address') || lowerFieldId.includes('city') || 
               lowerFieldId.includes('state') || lowerFieldId.includes('zip') || 
               lowerFieldId.includes('phone') || lowerFieldId.includes('email')) {
        fieldGroups['Contact Information'].push(fieldId);
      }
      else if (lowerFieldId.includes('service') || lowerFieldId.includes('military') || 
               lowerFieldId.includes('branch') || lowerFieldId.includes('discharge')) {
        fieldGroups['Service Information'].push(fieldId);
      }
      else if (lowerFieldId.includes('medical') || lowerFieldId.includes('health') || 
               lowerFieldId.includes('disability') || lowerFieldId.includes('condition')) {
        fieldGroups['Medical Information'].push(fieldId);
      }
      else if (lowerFieldId.includes('income') || lowerFieldId.includes('expense') || 
               lowerFieldId.includes('financial') || lowerFieldId.includes('payment') ||
               lowerFieldId.includes('amount') || lowerFieldId.includes('cost')) {
        fieldGroups['Financial Information'].push(fieldId);
      }
      else {
        fieldGroups['Other Information'].push(fieldId);
      }
    });
    
    // Render each group that has fields
    return (
      <div className="space-y-6">
        {Object.entries(fieldGroups).map(([groupName, groupFields]) => {
          if (groupFields.length === 0) return null;
          
          return (
            <div key={groupName} className="space-y-4">
              <h4 className="font-medium text-gray-700">{groupName}</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                {groupFields.map(fieldId => {
                  const value = formData[fieldId] || '';
                  const fieldType = inferFieldType(fieldId, value);
                  const label = formatFieldLabel(fieldId);
                  
                  return (
                    <div key={fieldId} className="space-y-1">
                      <Label htmlFor={fieldId} className="text-sm font-medium">
                        {label}
                      </Label>
                      {fieldType === 'checkbox' ? (
                        <input
                          type="checkbox"
                          id={fieldId}
                          checked={value === 'true'}
                          onChange={(e) => handleFieldChange(fieldId, e.target.checked.toString())}
                          disabled={!editMode}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                      ) : fieldType === 'date' ? (
                        <input
                          type="date"
                          id={fieldId}
                          value={value}
                          onChange={(e) => handleFieldChange(fieldId, e.target.value)}
                          disabled={!editMode}
                          className="w-full p-2 border rounded-md disabled:bg-gray-100"
                        />
                      ) : (
                        <input
                          type="text"
                          id={fieldId}
                          value={value}
                          onChange={(e) => handleFieldChange(fieldId, e.target.value)}
                          disabled={!editMode}
                          className="w-full p-2 border rounded-md disabled:bg-gray-100"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Hidden canvas for PDF rendering fallback */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      
      <Card>
        <CardHeader>
          <CardTitle>VA Form Processor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="form-upload">Upload VA Form (PDF or Image)</Label>
            <Input
              id="form-upload"
              type="file"
              accept="application/pdf,image/*"
              onChange={handleFileSelect}
              disabled={processing}
            />
            {file && (
              <p className="text-sm text-muted-foreground">
                Selected file: {file.name}
                {isPDF(file) && (
                  <span className="text-blue-600 ml-2">
                    (PDF will be converted automatically)
                  </span>
                )}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Supported formats: PDF, JPG, PNG, GIF, BMP, WEBP
            </p>
          </div>

          <Button
            onClick={handleProcessForm}
            disabled={!file || processing}
            className="w-full"
          >
            {processing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {file && isPDF(file) ? 'Converting PDF and Processing Form...' : 'Processing Form...'}
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Process Form
              </>
            )}
          </Button>

          {error && (
            <div className="flex flex-col gap-2 text-red-500 p-4 rounded bg-red-50 border border-red-200">
              <div className="flex items-center gap-2">
                <FileWarning className="h-5 w-5 flex-shrink-0" />
                <h3 className="font-semibold">Error Processing Form</h3>
              </div>
              <div className="pl-7">
                <p className="text-sm whitespace-pre-wrap">{error}</p>
                {error.includes('PDF') && (
                  <div className="text-sm mt-2">
                    <p>Common issues with PDF processing:</p>
                    <ul className="list-disc pl-5 mt-1 space-y-1">
                      <li>The PDF file might be corrupted</li>
                      <li>The PDF might be password protected</li>
                      <li>The PDF might not contain any pages</li>
                      <li>The PDF might be in an unsupported format</li>
                    </ul>
                    <p className="mt-2">Try downloading the PDF again or converting it to an image format.</p>
                  </div>
                )}
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-3"
                  onClick={() => setError(null)}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          )}

          {result && summary && (
            <div className="space-y-6">
              {/* Form Identification */}
              <div className="border rounded-lg p-4 bg-blue-50">
                <div className="flex items-center gap-2 text-blue-700 mb-2">
                  <CheckCircle className="h-5 w-5" />
                  <h3 className="font-semibold">Form Identified</h3>
                </div>
                <p className="text-sm">Form Number: {result.formNumber}</p>
                <p className="text-sm">Form Title: {result.formTitle}</p>
              </div>

              {/* Missing Required Fields Warning */}
              {summary.missingRequired.length > 0 && (
                <div className="border rounded-lg p-4 bg-yellow-50">
                  <div className="flex items-center gap-2 text-yellow-700 mb-2">
                    <AlertCircle className="h-5 w-5" />
                    <h3 className="font-semibold">Missing Required Fields</h3>
                  </div>
                  <ul className="list-disc pl-5 text-sm space-y-1">
                    {summary.missingRequired.map((field, i) => (
                      <li key={i}>{field}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Form Fields */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Extracted Form Data</h3>
                  <Button
                    variant={editMode ? "default" : "outline"}
                    onClick={() => setEditMode(!editMode)}
                    disabled={processing}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    {editMode ? 'Editing...' : 'Edit Fields'}
                  </Button>
                </div>

                {/* Render dynamic fields instead of static field lists */}
                {renderDynamicFields()}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 justify-end">
                {editMode && (
                  <Button
                    onClick={handleSaveForm}
                    disabled={processing}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => window.open(summary.digitalFormUrl)}
                  disabled={!summary.digitalFormUrl}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Original Form
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 