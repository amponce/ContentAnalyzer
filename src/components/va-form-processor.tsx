import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, FileText, Download } from "lucide-react";
import { VAFormProcessor as FormProcessor } from '@/lib/va-forms/form-processor';
import type { FormProcessingResult, FormSummary } from '@/lib/va-forms/types';

export function VAFormProcessorComponent() {
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<FormProcessingResult | null>(null);
  const [summary, setSummary] = useState<FormSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setProcessing(true);
    setError(null);

    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const imageData = e.target?.result as string;
        
        // Get API key from storage
        const { apiKey } = await chrome.storage.sync.get(['apiKey']);
        if (!apiKey) {
          throw new Error('Please configure your OpenAI API key first');
        }

        const processor = new FormProcessor(apiKey);
        
        // Process the form
        const processingResult = await processor.processScannedForm(imageData);
        setResult(processingResult);

        if (processingResult.formIdentified) {
          // Generate summary
          const formSummary = await processor.generateFormSummary(processingResult);
          setSummary(formSummary);
        }
      };

      reader.readAsDataURL(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setProcessing(false);
    }
  };

  const handleCreateDigitalForm = async () => {
    if (!result) return;

    try {
      setProcessing(true);
      const { apiKey } = await chrome.storage.sync.get(['apiKey']);
      const processor = new FormProcessor(apiKey);
      await processor.createDigitalForm(result);
      // Handle the digital form creation result
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>VA Form Processor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="form-upload">Upload VA Form</Label>
            <Input
              id="form-upload"
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileUpload}
              disabled={processing}
            />
          </div>

          {processing && (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Processing form...</span>
            </div>
          )}

          {error && (
            <div className="text-red-500 p-2 rounded bg-red-50">
              {error}
            </div>
          )}

          {result && summary && (
            <div className="space-y-4">
              <div className="border rounded p-4">
                <h3 className="font-semibold mb-2">Form Details</h3>
                <p>Form Number: {result.formNumber}</p>
                <p>Form Title: {result.formTitle}</p>
              </div>

              <div className="border rounded p-4">
                <h3 className="font-semibold mb-2">Summary</h3>
                <ul className="list-disc pl-4 space-y-1">
                  {summary.keyFindings.map((finding, i) => (
                    <li key={i}>{finding}</li>
                  ))}
                </ul>
              </div>

              {summary.missingRequired.length > 0 && (
                <div className="border rounded p-4 bg-yellow-50">
                  <h3 className="font-semibold mb-2">Missing Required Fields</h3>
                  <ul className="list-disc pl-4 space-y-1">
                    {summary.missingRequired.map((field, i) => (
                      <li key={i}>{field}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleCreateDigitalForm}
                  disabled={processing}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Create Digital Form
                </Button>
                {summary.digitalFormUrl && (
                  <Button
                    variant="outline"
                    onClick={() => window.open(summary.digitalFormUrl)}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download Digital Form
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 