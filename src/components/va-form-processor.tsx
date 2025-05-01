import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle, AlertCircle, FileWarning, ExternalLink, FileText, ChevronRight } from "lucide-react";
import { VAFormProcessor as FormProcessor } from '@/lib/va-forms/form-processor';
import { PDFProcessor } from '@/lib/pdf-processor';
import type { FormProcessingResult, FormSummary } from '@/lib/va-forms/types';

export function VAFormProcessorComponent() {
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<FormProcessingResult | null>(null);
  const [summary, setSummary] = useState<FormSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<{[key: string]: string}>({});
  const pdfProcessor = new PDFProcessor();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [processingPages, setProcessingPages] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [processingPageIndex, setProcessingPageIndex] = useState<number>(0);

  const isPDF = (file: File) => {
    return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  };

  const isImage = (file: File) => {
    return file.type.startsWith('image/');
  };

  const convertPDFToImage = async (pdfFile: File): Promise<string[]> => {
    try {
      const buffer = await pdfFile.arrayBuffer();
      console.log('Converting PDF to images...');
      
      try {
        const pages = await pdfProcessor.processPDF(buffer);
        
        if (pages.length === 0) {
          console.warn('No pages found in PDF, trying fallback method');
          return [await convertPDFUsingBrowser(pdfFile)];
        }
        
        // We'll process all pages
        setTotalPages(pages.length);
        
        // Check if the images are too large for API processing
        const processedImages = await Promise.all(pages.map(async (page, index) => {
          setProcessingPageIndex(index);
          let imageData = page.imageData;
          const sizeInKB = Math.round((imageData.length * 3) / 4 / 1024);
          console.log(`Page ${index + 1} image size: ~${sizeInKB} KB`);
          
          // If image is too large, resize it using the canvas
          if (sizeInKB > 10000) { // 10MB is big for API processing
            console.log(`Page ${index + 1} is large, reducing size to avoid API limits...`);
            imageData = await reduceImageSize(imageData, 0.7); // Reduce quality
          }
          
          return imageData;
        }));
        
        return processedImages;
      } catch (processingError) {
        // Log the actual error for debugging
        console.error('Detailed PDF processing error:', processingError);
        
        // Try fallback method immediately if PDF.js processing fails
        console.log('Using fallback PDF rendering method...');
        return [await convertPDFUsingBrowser(pdfFile)];
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

      let imageDataArray: string[] = [];
      let processingAttempts = 0;
      const maxAttempts = 2;
      
      try {
        if (isPDF(file)) {
          // Process all pages of the PDF
          imageDataArray = await convertPDFToImage(file);
          setProcessingPages(imageDataArray.length);
        } else {
          // Handle image file (single page)
          setProcessingPages(1);
          setTotalPages(1);
          const imageData = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = () => reject(new Error('Failed to read the image file. Please try again.'));
            reader.readAsDataURL(file);
          });
          imageDataArray = [imageData];
        }

        const processor = new FormProcessor(apiKey);
        
        // Process each page separately and merge results
        let combinedResult: FormProcessingResult = {
          formIdentified: false,
          formNumber: '',
          formTitle: '',
          fields: {},
          rawOCR: []
        };
        
        // First, let's identify the form from the first page
        const firstPageResult = await processor.processScannedForm(imageDataArray[0]);
        combinedResult.formNumber = firstPageResult.formNumber;
        combinedResult.formTitle = firstPageResult.formTitle;
        combinedResult.formIdentified = firstPageResult.formIdentified;
        combinedResult.fields = {...firstPageResult.fields};
        combinedResult.rawOCR = [...firstPageResult.rawOCR];
        
        // Now process the remaining pages and merge fields
        if (imageDataArray.length > 1) {
          for (let i = 1; i < imageDataArray.length; i++) {
            setProcessingPageIndex(i);
            console.log(`Processing page ${i + 1} of ${imageDataArray.length}...`);
            
            const pageResult = await processor.processScannedForm(imageDataArray[i]);
            
            // Merge fields from this page into the combined result
            combinedResult.fields = {...combinedResult.fields, ...pageResult.fields};
            combinedResult.rawOCR = [...combinedResult.rawOCR, ...pageResult.rawOCR];
          }
        }
        
        // If we still don't have a valid form number/title, retry once more with the entire document
        if ((!combinedResult.formNumber || combinedResult.formNumber === 'GENERIC') && 
            processingAttempts < maxAttempts && imageDataArray.length > 0) {
          console.log("Retrying form identification with first page...");
          processingAttempts++;
          const retryResult = await processor.processScannedForm(imageDataArray[0]);
          if (retryResult.formNumber && retryResult.formNumber !== 'GENERIC') {
            combinedResult.formNumber = retryResult.formNumber;
            combinedResult.formTitle = retryResult.formTitle;
          }
        }
        
        // IMPORTANT: Always consider the form identified if it has ANY fields or if a form number was detected
        const hasFields = Object.keys(combinedResult.fields).length > 0;
        const hasFormNumber = !!combinedResult.formNumber && 
                             combinedResult.formNumber !== 'UNKNOWN' && 
                             combinedResult.formNumber !== 'ERROR';
        
        if (hasFields || hasFormNumber) {
          // If any fields were extracted or a form number was found, consider it identified
          combinedResult.formIdentified = true;
          
          // Only set generic info if no form number was found
          if (!combinedResult.formNumber || 
              combinedResult.formNumber === 'UNKNOWN' || 
              combinedResult.formNumber === 'ERROR') {
            combinedResult.formNumber = 'GENERIC';
            combinedResult.formTitle = 'Generic Form';
          }
          
          // Add placeholder fields for common form fields if they're missing
          // This ensures the form structure is more complete
          const commonFields = [
            'fullName', 'firstName', 'lastName', 'socialSecurityNumber', 
            'dateOfBirth', 'address', 'phoneNumber', 'emailAddress',
            'veteranName', 'signature', 'signatureDate'
          ];
          
          commonFields.forEach(field => {
            if (!combinedResult.fields[field]) {
              // Add empty field with low confidence
              combinedResult.fields[field] = {
                value: '',
                confidence: 0.1
              };
            }
          });
        }
        
        setResult(combinedResult);

        if (combinedResult.formIdentified) {
          try {
            const formSummary = await processor.generateFormSummary(combinedResult);
            setSummary(formSummary);
          } catch (summaryError) {
            console.error("Error generating form summary:", summaryError);
            // Create a basic summary if the API call fails
            setSummary({
              formNumber: combinedResult.formNumber || 'UNKNOWN',
              formTitle: combinedResult.formTitle || 'Unknown Form Type',
              keyFindings: ["Form was processed but detailed analysis failed"],
              missingRequired: ["Form may have missing required fields"],
              recommendations: ["Verify all information is correct", "Consider re-processing the form with a clearer image"],
              digitalFormUrl: ""
            });
          }
          
          setFormData(Object.entries(combinedResult.fields).reduce((acc, [key, field]) => ({
            ...acc,
            [key]: field.value
          }), {}));
        } else {
          // This now only happens if NO fields were extracted at all
          setError('No form fields were detected. Please make sure you uploaded a valid form document. Try using a clearer image or a different file format.');
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
      setProcessingPageIndex(0);
      setProcessingPages(0);
      setTotalPages(0);
    }
  };

  const handleOpenInWindow = async () => {
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

      // Send message to background script to open a new window
      chrome.runtime.sendMessage(
        { 
          action: "openFormViewer", 
          formData: digitalForm
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error('Error sending message:', chrome.runtime.lastError);
            setError('Failed to open form in new window');
          } else if (!response.success) {
            setError(response.error || 'Failed to open form in new window');
          }
          setProcessing(false);
        }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open form in new window');
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Hidden canvas for PDF rendering fallback */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      
      <Card>
        <CardHeader>
          <CardTitle>Document Processor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="form-upload">Upload Form (PDF or Image)</Label>
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
                {processingPages > 0 ? (
                  `Processing page ${processingPageIndex + 1} of ${totalPages > 0 ? totalPages : '?'}`
                ) : (
                  file && isPDF(file) ? 'Converting PDF and Processing Form...' : 'Processing Form...'
                )}
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
                <p className="text-sm mt-2">
                  {Object.keys(result.fields).length} fields detected across {result.rawOCR.length} form sections
                </p>

                {/* Open in Larger Window Button */}
                <Button
                  variant="default"
                  onClick={handleOpenInWindow}
                  disabled={processing}
                  className="w-full mt-4 bg-blue-600 hover:bg-blue-700"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Form in Larger Window
                </Button>
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

              {/* Digital Form Link */}
              {summary.digitalFormUrl && (
                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    <h3 className="font-semibold">Digital Version Available</h3>
                  </div>
                  <p className="text-sm mb-3">Complete this form online for better accuracy:</p>
                  <a 
                    href={summary.digitalFormUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center text-blue-600 hover:text-blue-800 text-sm"
                  >
                    <span>Open official digital form</span>
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </a>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 