import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Sliders, Check, Clipboard, Loader2 } from "lucide-react";
import ReactMarkdown from 'react-markdown';

interface EnhancedAnalysisProps {
  onAnalyze: (text: string, options: AnalysisOptions) => Promise<void>;
  isAnalyzing: boolean;
  result?: {
    markdown?: string;
    text?: string;
    sentiment?: string;
    confidence?: number;
  };
}

export interface AnalysisOptions {
  detectionMode: 'standard' | 'detailed' | 'emotional';
  includeTopics: boolean;
  includeSuggestions: boolean;
}

export function EnhancedAnalysis({ 
  onAnalyze,
  isAnalyzing,
  result
}: EnhancedAnalysisProps) {
  const [text, setText] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [options, setOptions] = useState<AnalysisOptions>({
    detectionMode: 'detailed',
    includeTopics: true,
    includeSuggestions: true
  });

  const handleAnalyze = () => {
    if (text.trim()) {
      onAnalyze(text, options);
    }
  };

  const handleCopy = () => {
    if (result?.markdown) {
      navigator.clipboard.writeText(result.markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-full">
      <div className="space-y-6 max-w-full">
        <Card className="border border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-medium flex items-center space-x-2">
              <Sliders className="h-5 w-5 text-primary" />
              <span>Enhanced Sentiment Analysis</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Content to Analyze</label>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter text to analyze..."
                className="min-h-[200px] resize-y"
              />
            </div>
            
            <div className="space-y-3">
              <label className="block text-sm font-medium mb-2">Analysis Options</label>
              
              <div>
                <label className="block text-xs mb-1">Detection Mode</label>
                <Select 
                  value={options.detectionMode}
                  onValueChange={(value: 'standard' | 'detailed' | 'emotional') => 
                    setOptions({...options, detectionMode: value})
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard (Positive/Negative/Neutral)</SelectItem>
                    <SelectItem value="detailed">Detailed (Multiple aspects)</SelectItem>
                    <SelectItem value="emotional">Emotional (Focus on feelings)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="include-topics"
                  checked={options.includeTopics}
                  onChange={(e) => setOptions({...options, includeTopics: e.target.checked})}
                  className="rounded border-gray-300"
                />
                <label htmlFor="include-topics" className="text-sm">Identify main topics/themes</label>
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="include-suggestions"
                  checked={options.includeSuggestions}
                  onChange={(e) => setOptions({...options, includeSuggestions: e.target.checked})}
                  className="rounded border-gray-300"
                />
                <label htmlFor="include-suggestions" className="text-sm">
                  Include response suggestions
                </label>
              </div>
            </div>
            
            <Button 
              className="w-full"
              onClick={handleAnalyze}
              disabled={isAnalyzing || !text.trim()}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <BarChart className="mr-2 h-4 w-4" />
                  Analyze Content
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6 max-w-full">
        <Card className="border border-border/50 shadow-sm">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-medium">Analysis Results</CardTitle>
            {result?.markdown && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleCopy}
                className="h-8"
              >
                {copied ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Clipboard className="mr-2 h-4 w-4" />
                    Copy
                  </>
                )}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {result?.markdown ? (
              <div className="prose prose-sm max-w-none overflow-auto max-h-[500px]">
                <ReactMarkdown>{result.markdown}</ReactMarkdown>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                {isAnalyzing ? (
                  <div className="flex flex-col items-center space-y-2">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span>Processing your content...</span>
                  </div>
                ) : (
                  "No analysis yet"
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 