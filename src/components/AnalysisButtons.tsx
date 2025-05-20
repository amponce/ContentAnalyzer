import { useState } from 'react';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { createContentAnalyzer, createSurveyAnalyzer } from '../lib/agents';

interface AnalysisButtonsProps {
  /**
   * Content to analyze
   */
  content: string;
  
  /**
   * Callback for when analysis is complete
   */
  onAnalysisComplete?: (result: any) => void;
  
  /**
   * Optional class name for styling
   */
  className?: string;
}

/**
 * Component that provides buttons for different types of content analysis
 */
export function AnalysisButtons({ content, onAnalysisComplete, className }: AnalysisButtonsProps) {
  const [isLoading, setIsLoading] = useState<{
    general: boolean;
    medallia: boolean;
  }>({
    general: false,
    medallia: false
  });
  
  /**
   * Run general content analysis
   */
  const handleGeneralAnalysis = async () => {
    if (!content || isLoading.general) return;
    
    setIsLoading(prev => ({ ...prev, general: true }));
    
    try {
      const contentAnalyzer = createContentAnalyzer();
      
      const result = await contentAnalyzer.process({
        content,
        options: {
          includeSentiment: true,
          includeTopics: true,
          summaryDetailLevel: 3
        }
      });
      
      console.log('General analysis complete:', result);
      
      if (onAnalysisComplete) {
        onAnalysisComplete({
          type: 'general',
          result
        });
      }
    } catch (error) {
      console.error('Error performing general analysis:', error);
    } finally {
      setIsLoading(prev => ({ ...prev, general: false }));
    }
  };
  
  /**
   * Run Medallia survey analysis
   */
  const handleMedalliaAnalysis = async () => {
    if (!content || isLoading.medallia) return;
    
    setIsLoading(prev => ({ ...prev, medallia: true }));
    
    try {
      const surveyAnalyzer = createSurveyAnalyzer();
      
      // For simplicity, we're treating the content as raw survey data
      // In a real application, you'd need to parse/format this correctly
      const result = await surveyAnalyzer.process({
        surveyData: {
          // Parse the content into appropriate survey data format
          // This is a simple example; real implementation would need proper parsing
          quantitativeData: {
            rawData: content
          },
          a11Questionnaire: {
            responses: content,
            totalResponses: 0, // Would be calculated from parsing
            declinePercent: 0,
            submissionPercent: 0
          },
          vfsQuestionnaire: {
            responses: content
          },
          debtPortalSurvey: {
            responses: content
          }
        },
        options: {
          includePreviousPeriod: true,
          maxExampleQuotes: 3
        }
      });
      
      console.log('Medallia analysis complete:', result);
      
      if (onAnalysisComplete) {
        onAnalysisComplete({
          type: 'medallia',
          result
        });
      }
    } catch (error) {
      console.error('Error performing Medallia analysis:', error);
    } finally {
      setIsLoading(prev => ({ ...prev, medallia: false }));
    }
  };
  
  return (
    <div className={`flex flex-row gap-3 ${className || ''}`}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="default" 
              onClick={handleGeneralAnalysis}
              disabled={isLoading.general || !content}
            >
              {isLoading.general ? (
                <>
                  <span className="animate-spin mr-2">⭮</span>
                  Analyzing...
                </>
              ) : (
                <>General Analysis</>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Analyze general content, social media threads, etc.</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="secondary" 
              onClick={handleMedalliaAnalysis}
              disabled={isLoading.medallia || !content}
            >
              {isLoading.medallia ? (
                <>
                  <span className="animate-spin mr-2">⭮</span>
                  Analyzing...
                </>
              ) : (
                <>Medallia Analysis</>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Specialized analysis for VA.gov survey data</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
} 