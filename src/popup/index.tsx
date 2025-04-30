import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { Settings } from '@/components/settings';
import { VAFormProcessorComponent } from '@/components/va-form-processor';
import { WebSearch } from '@/components/web-search';
import { Button } from "@/components/ui/button";
import { 
  BarChart, 
  FileText, 
  Search, 
  Settings as SettingsIcon, 
  Clipboard,
  Globe,
  Download,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// Import global styles
import '@/styles/globals.css';

// Import logo
import logo from '../../icons/agilesix_logo.jpg';

interface AnalysisResult {
  sentiment: string;
  confidence: number;
  text: string;
  markdown?: string;
  chunkIndex?: number;
  totalChunks?: number;
}

const ensureContentScriptLoaded = async (tabId: number): Promise<void> => {
  try {
    // Try to send a ping message first
    const pingResponse = await new Promise<any>((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, { action: "ping" }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    }).catch(() => null);

    if (pingResponse) {
      return; // Content script is already running
    }

    // Content script needs to be injected
    console.log('Injecting content script...');
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });

    // Wait for script to initialize
    await new Promise(resolve => setTimeout(resolve, 300));
  } catch (error) {
    console.error('Error ensuring content script is loaded:', error);
    throw new Error('Failed to initialize content script. Please refresh the page and try again.');
  }
};

function Popup() {
  const [activeView, setActiveView] = useState<'analysis' | 'forms' | 'search' | 'settings'>('analysis');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const portRef = useRef<chrome.runtime.Port | null>(null);

  useEffect(() => {
    // Establish connection with background script
    const port = chrome.runtime.connect({ name: "popup" });
    portRef.current = port;

    // Set up message listener
    const messageListener = (message: any) => {
      console.log('Popup received message:', message);
      if (message.type === 'analysisResult') {
        setResults(prev => [...prev, {
          sentiment: message.data.sentiment,
          confidence: message.data.confidence,
          text: message.data.text,
          markdown: message.data.markdown,
          chunkIndex: message.data.chunkIndex,
          totalChunks: message.data.totalChunks
        }]);
        setError(null);
        setLoading(false);
      } else if (message.type === 'analysisError') {
        setError(message.error);
        setLoading(false);
      }
    };

    port.onMessage.addListener(messageListener);
    
    // Cleanup on unmount
    return () => {
      port.onMessage.removeListener(messageListener);
      port.disconnect();
      portRef.current = null;
    };
  }, []);

  const sendMessage = useCallback((message: any) => {
    if (portRef.current) {
      portRef.current.postMessage(message);
    } else {
      console.error('No connection to background script');
      setError('Lost connection to extension. Please refresh.');
    }
  }, []);

  const handleAnalyzeSelected = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('Starting selected text analysis...');
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        throw new Error('No active tab found');
      }

      console.log('Ensuring content script is loaded...');
      // Ensure content script is loaded
      await ensureContentScriptLoaded(tab.id);
      
      console.log('Requesting selected text...');
      // Now send message to content script
      const response = await new Promise<any>((resolve, reject) => {
        chrome.tabs.sendMessage(tab.id!, { action: "getSelectedText" }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Error getting selected text:', chrome.runtime.lastError);
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            console.log('Received selected text response:', response);
            resolve(response);
          }
        });
      });

      if (response?.error) {
        throw new Error(response.error);
      }
      if (!response?.selectedText) {
        throw new Error('No text selected');
      }

      console.log('Sending text for sentiment analysis...');
      // Send to background script through port
      sendMessage({
        action: "analyzeSentiment",
        text: response.selectedText
      });
    } catch (err) {
      console.error('Failed to analyze selected text:', err);
      setError(err instanceof Error ? err.message : 'Failed to analyze selected text');
      setLoading(false);
    }
  };

  const handleAnalyzePage = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('Starting page analysis...');
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        throw new Error('No active tab found');
      }

      console.log('Ensuring content script is loaded...');
      // Ensure content script is loaded
      await ensureContentScriptLoaded(tab.id);

      console.log('Requesting page content...');
      // Now send message to content script
      const response = await new Promise<any>((resolve, reject) => {
        chrome.tabs.sendMessage(tab.id!, { action: "analyzePage" }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Error getting page content:', chrome.runtime.lastError);
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            console.log('Received page content response:', response);
            resolve(response);
          }
        });
      });

      if (response?.error) {
        throw new Error(response.error);
      }
      if (!response?.chunks?.length) {
        throw new Error('No content found to analyze');
      }

      console.log('Sending all chunks for sentiment analysis...');
      // Process all chunks sequentially
      for (const chunk of response.chunks) {
        // Send chunk through port
        sendMessage({
          action: "analyzeSentiment",
          text: chunk.text,
          chunkIndex: chunk.index,
          totalChunks: response.chunks.length
        });
        // Add a small delay between chunks to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (err) {
      console.error('Failed to analyze page:', err);
      setError(err instanceof Error ? err.message : 'Failed to analyze page');
      setLoading(false);
    }
  };

  const handleAnalyzeClipboard = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('Reading clipboard content...');
      const text = await navigator.clipboard.readText();
      if (!text) {
        throw new Error('Clipboard is empty');
      }

      console.log('Sending clipboard text for sentiment analysis...');
      // Send through port
      sendMessage({
        action: "analyzeSentiment",
        text
      });
    } catch (err) {
      console.error('Failed to read clipboard:', err);
      setError(err instanceof Error ? err.message : 'Failed to read clipboard');
      setLoading(false);
    }
  };

  const clearResults = () => {
    setResults([]);
    setError(null);
  };

  const handleExportCSV = () => {
    if (results.length === 0) return;

    try {
      console.log('Preparing CSV export...');
      let csvContent = [];
      
      // Check if we have comment analysis data
      const hasCommentAnalysis = results.some(result => 
        result.markdown && result.markdown.includes('Individual Comments')
      );
      
      if (hasCommentAnalysis) {
        // Export in detailed format with individual comments
        csvContent.push('Comment,Sentiment,Confidence,Themes,Summary');
        
        results.forEach(result => {
          // Try to parse the detailed data from markdown if available
          try {
            // Simple parsing logic to extract comments from markdown
            const commentRegex = /### Comment \d+\s+\*\*Sentiment\*\*: (\w+) \((\d+)% confidence\)\s+(?:\*\*Themes\*\*: (.*?)\s+)?(?:\*\*Summary\*\*: (.*?)\s+)?\*\*Text\*\*:\s+([\s\S]+?)(?=---|\n### Comment|\Z)/g;
            let match;
            
            if (result.markdown) {
              while ((match = commentRegex.exec(result.markdown)) !== null) {
                const sentiment = match[1] || '';
                const confidence = match[2] || '';
                const themes = match[3] || '';
                const summary = match[4] || '';
                const text = (match[5] || '').trim().replace(/"/g, '""');
                
                csvContent.push(`"${text}","${sentiment}","${confidence}%","${themes}","${summary}"`);
              }
            } else {
              // Fallback if markdown parsing fails
              csvContent.push(`"${result.text.replace(/"/g, '""')}","${result.sentiment}","${Math.round(result.confidence * 100)}%","",""`)
            }
          } catch (err) {
            console.error('Error parsing markdown for CSV:', err);
            // Fallback to simple format
            csvContent.push(`"${result.text.replace(/"/g, '""')}","${result.sentiment}","${Math.round(result.confidence * 100)}%","",""`)
          }
        });
      } else {
        // Simple format for backward compatibility
        csvContent.push('Response ID,Sentiment,Confidence,Text');
        results.forEach((result, index) => 
          csvContent.push(`${index + 1},"${result.sentiment}","${Math.round(result.confidence * 100)}%","${result.text.replace(/"/g, '""')}"`)
        );
      }
      
      const blob = new Blob([csvContent.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', 'sentiment-analysis.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      console.log('CSV export completed');
    } catch (err) {
      console.error('Failed to export CSV:', err);
      setError('Failed to export CSV: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleExportMarkdown = () => {
    if (results.length === 0) return;

    const markdownContent = results.map((result, index) => 
      `# Analysis ${index + 1}\n\n` +
      `- Sentiment: ${result.sentiment}\n` +
      `- Confidence: ${Math.round(result.confidence * 100)}%\n\n` +
      `${result.markdown || result.text}\n\n---\n`
    ).join('\n');

    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'sentiment-analysis.md');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderContent = () => {
    switch (activeView) {
      case 'forms':
        return <VAFormProcessorComponent />;
      case 'search':
        return <WebSearch />;
      case 'settings':
        return <Settings onSave={() => setActiveView('analysis')} />;
      default:
        return (
          <>
            <div className="grid gap-2">
              <Button
                variant="outline"
                className="w-full justify-start text-sm font-normal"
                onClick={handleAnalyzeSelected}
                disabled={loading}
              >
                <FileText className="h-4 w-4 mr-2" />
                Analyze Selected Text
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start text-sm font-normal"
                onClick={handleAnalyzePage}
                disabled={loading}
              >
                <Globe className="h-4 w-4 mr-2" />
                Analyze Full Page
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start text-sm font-normal"
                onClick={handleAnalyzeClipboard}
                disabled={loading}
              >
                <Clipboard className="h-4 w-4 mr-2" />
                Analyze Clipboard
              </Button>
            </div>

            <div className="border-t pt-4">
              <div className="text-sm font-medium mb-2">Analysis Results</div>
              {renderResults()}
              {(results.length > 0 || error) && (
                <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearResults}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    Clear
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleExportCSV}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleExportMarkdown}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export Markdown
                  </Button>
                </div>
              )}
            </div>
          </>
        );
    }
  };

  const renderResults = () => {
    if (loading) {
      const lastResult = results[results.length - 1];
      const showProgress = lastResult?.chunkIndex !== undefined && lastResult?.totalChunks !== undefined;
      
      return (
        <div className="text-sm text-gray-500">
          <div className="animate-pulse mb-2">
            Analyzing content...
          </div>
          {showProgress && lastResult.chunkIndex !== undefined && lastResult.totalChunks !== undefined && (
            <div className="text-xs">
              Processing chunk {lastResult.chunkIndex + 1} of {lastResult.totalChunks}
            </div>
          )}
        </div>
      );
    }

    if (error) {
      return (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      );
    }

    if (results.length === 0) {
      return (
        <div className="text-sm text-gray-500">
          No analysis yet
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {results.map((result, index) => (
          <div key={index} className="rounded-lg border bg-card text-card-foreground shadow-sm">
            {/* Header with sentiment info */}
            <div className={`p-4 flex items-center justify-between rounded-t-lg ${
              result.sentiment === 'positive' ? 'bg-green-50 dark:bg-green-900/20' :
              result.sentiment === 'negative' ? 'bg-red-50 dark:bg-red-900/20' :
              'bg-gray-50 dark:bg-gray-900/20'
            }`}>
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center justify-center w-10 h-10 rounded-full ${
                  result.sentiment === 'positive' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                  result.sentiment === 'negative' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                  'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300'
                }`}>
                  {result.sentiment === 'positive' ? '✓' : 
                   result.sentiment === 'negative' ? '✗' : '•'}
                </span>
                <div className="flex flex-col">
                  <span className="text-lg font-semibold capitalize">
                    {result.sentiment}
                  </span>
                  {result.chunkIndex !== undefined && result.totalChunks !== undefined && (
                    <span className="text-sm text-muted-foreground">
                      Chunk {result.chunkIndex + 1} of {result.totalChunks}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-sm px-3 py-1.5 rounded-full bg-background font-medium">
                {Math.round(result.confidence * 100)}% confidence
              </div>
            </div>
            
            {/* Content */}
            <div className="p-6">
              {result.markdown ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown
                    components={{
                      h1: ({node, ...props}) => <h1 className="text-2xl font-bold mb-4" {...props} />,
                      h2: ({node, ...props}) => <h2 className="text-xl font-semibold mt-6 mb-3" {...props} />,
                      h3: ({node, ...props}) => <h3 className="text-lg font-medium mt-4 mb-2" {...props} />,
                      p: ({node, ...props}) => <p className="text-base leading-relaxed mb-4" {...props} />,
                      ul: ({node, ...props}) => <ul className="my-4 space-y-2" {...props} />,
                      li: ({node, ...props}) => <li className="flex items-center gap-2" {...props} />,
                      blockquote: ({node, ...props}) => (
                        <blockquote className="border-l-4 border-muted pl-4 italic my-4" {...props} />
                      ),
                      strong: ({node, ...props}) => <strong className="font-semibold" {...props} />,
                    }}
                  >
                    {result.markdown}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-base text-muted-foreground">{result.text}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="w-[400px] min-h-[300px] bg-white">
      <header className="bg-[#1a365d] text-white p-4 rounded-t-lg shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <BarChart className="h-5 w-5 text-blue-200" />
            <h1 className="font-semibold text-lg ml-2 tracking-wide">Content Analyzer</h1>
          </div>
          <img src={logo} alt="Content Analyzer Logo" className="h-8 w-8" />
        </div>
        <div className="text-blue-200 text-xs mt-1 font-medium tracking-wide">
          Analyze sentiment and feedback from any page
        </div>
      </header>

      <main className="p-4 space-y-4">
        {renderContent()}

        <div className="border-t pt-4 space-y-2">
          <Button
            variant="outline"
            className={`w-full justify-start text-sm font-normal ${activeView === 'forms' ? 'bg-gray-100' : ''}`}
            onClick={() => setActiveView('forms')}
          >
            <FileText className="h-4 w-4 mr-2" />
            VA Forms
          </Button>

          <Button
            variant="outline"
            className={`w-full justify-start text-sm font-normal ${activeView === 'search' ? 'bg-gray-100' : ''}`}
            onClick={() => setActiveView('search')}
          >
            <Search className="h-4 w-4 mr-2" />
            Web Search
          </Button>

          <Button
            variant="outline"
            className={`w-full justify-start text-sm font-normal ${activeView === 'settings' ? 'bg-gray-100' : ''}`}
            onClick={() => setActiveView('settings')}
          >
            <SettingsIcon className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </main>
    </div>
  );
}

// Create root and render
const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
); 