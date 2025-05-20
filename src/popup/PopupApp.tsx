import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { AnalysisButtons } from '../components/AnalysisButtons';
import { Textarea } from '../components/ui/textarea';
import { Button } from '../components/ui/button';

/**
 * Main component for the extension popup
 */
export function PopupApp() {
  const [pageContent, setPageContent] = useState<string>('');
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>('content');
  
  // Get current tab page content on initial load
  useEffect(() => {
    const fetchPageContent = async () => {
      try {
        // Get current active tab
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const currentTab = tabs[0];
        
        if (!currentTab.id) return;
        
        // Execute content script to get page text
        const result = await chrome.tabs.sendMessage(currentTab.id, { action: 'getPageContent' });
        
        if (result?.content) {
          setPageContent(result.content);
        }
      } catch (error) {
        console.error('Error fetching page content:', error);
      }
    };
    
    fetchPageContent();
  }, []);
  
  // Handle completed analysis
  const handleAnalysisComplete = (result: any) => {
    setAnalysisResult(result);
    setActiveTab('results');
  };
  
  return (
    <div className="w-[500px] p-4 max-h-[600px] flex flex-col">
      <header className="mb-4">
        <h1 className="text-xl font-bold">Sentiment Analyzer</h1>
        <p className="text-sm text-gray-500">Analyze page content or custom text</p>
      </header>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-grow flex flex-col">
        <TabsList className="mb-2">
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        
        <TabsContent value="content" className="flex-grow flex flex-col">
          <Card className="flex-grow flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle>Page Content</CardTitle>
              <CardDescription>Edit the content or paste your own text to analyze</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col">
              <Textarea 
                className="flex-grow mb-4 min-h-[300px]"
                placeholder="Page content will appear here. You can edit it or paste your own text."
                value={pageContent}
                onChange={(e) => setPageContent(e.target.value)}
              />
              
              <div className="flex justify-between items-center mt-auto">
                <Button 
                  variant="outline" 
                  onClick={async () => {
                    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
                    const currentTab = tabs[0];
                    if (!currentTab.id) return;
                    
                    const result = await chrome.tabs.sendMessage(currentTab.id, { action: 'getPageContent' });
                    if (result?.content) {
                      setPageContent(result.content);
                    }
                  }}
                >
                  Refresh Content
                </Button>
                
                <AnalysisButtons 
                  content={pageContent} 
                  onAnalysisComplete={handleAnalysisComplete}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="results" className="flex-grow flex flex-col">
          <Card className="flex-grow">
            <CardHeader>
              <CardTitle>
                {analysisResult?.type === 'medallia' ? 'Medallia Survey Analysis' : 'Content Analysis'} Results
              </CardTitle>
              <CardDescription>
                {analysisResult?.type === 'medallia' 
                  ? 'Specialized analysis for VA.gov survey data' 
                  : 'General content analysis and summary'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!analysisResult && (
                <div className="text-center py-8">
                  <p className="text-gray-500">Run an analysis to see results here</p>
                </div>
              )}
              
              {analysisResult?.type === 'general' && (
                <div className="prose prose-sm max-w-none overflow-auto max-h-[400px]">
                  <h2>{analysisResult.result.title}</h2>
                  
                  <h3>Summary</h3>
                  <p>{analysisResult.result.summary}</p>
                  
                  {analysisResult.result.sentiment && (
                    <>
                      <h3>Sentiment</h3>
                      <p>
                        <strong>{analysisResult.result.sentiment.type}</strong> 
                        ({Math.round(analysisResult.result.sentiment.confidence * 100)}% confidence)
                      </p>
                    </>
                  )}
                  
                  {analysisResult.result.topics && analysisResult.result.topics.length > 0 && (
                    <>
                      <h3>Topics</h3>
                      <div className="flex flex-wrap gap-2">
                        {analysisResult.result.topics.map((topic: string, index: number) => (
                          <span key={index} className="bg-gray-100 px-2 py-1 rounded text-xs">
                            {topic}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
              
              {analysisResult?.type === 'medallia' && (
                <div className="prose prose-sm max-w-none overflow-auto max-h-[400px]">
                  <div dangerouslySetInnerHTML={{ 
                    __html: analysisResult.result.markdownReport
                      .replace(/# /g, '<h1>')
                      .replace(/## /g, '<h2>')
                      .replace(/### /g, '<h3>')
                      .replace(/#### /g, '<h4>')
                      .replace(/\n/g, '<br />')
                  }} />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
              <CardDescription>Configure extension settings</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500 mb-4">
                API key and other configuration settings will go here.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 