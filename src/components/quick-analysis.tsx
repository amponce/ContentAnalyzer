import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Clipboard, Globe, History, BarChart } from "lucide-react";

interface QuickAnalysisProps {
  onAnalyzeSelected: () => void;
  onAnalyzePage: () => void;
  onAnalyzeClipboard: () => void;
}

export function QuickAnalysis({ 
  onAnalyzeSelected, 
  onAnalyzePage, 
  onAnalyzeClipboard 
}: QuickAnalysisProps) {
  return (
    <div className="w-[800px] min-h-[600px] p-6 bg-background">
      <div className="flex items-center space-x-3 mb-8">
        <BarChart className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight">Content Analyzer</h1>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card className="border border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-medium flex items-center space-x-2">
                <History className="h-5 w-5 text-primary" />
                <span>Quick Analysis</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                variant="secondary" 
                className="w-full justify-start text-left font-normal hover:bg-primary hover:text-primary-foreground transition-colors py-6"
                onClick={onAnalyzeSelected}
              >
                <FileText className="h-5 w-5 mr-3" />
                Analyze Selected Text
              </Button>

              <Button 
                variant="secondary" 
                className="w-full justify-start text-left font-normal hover:bg-primary hover:text-primary-foreground transition-colors py-6"
                onClick={onAnalyzePage}
              >
                <Globe className="h-5 w-5 mr-3" />
                Analyze Full Page
              </Button>

              <Button 
                variant="secondary" 
                className="w-full justify-start text-left font-normal hover:bg-primary hover:text-primary-foreground transition-colors py-6"
                onClick={onAnalyzeClipboard}
              >
                <Clipboard className="h-5 w-5 mr-3" />
                Analyze Clipboard
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-medium">Analysis Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No analysis yet
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 