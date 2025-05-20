import { BaseAgent } from './agent-interface';
import { MEDALLIA_SURVEY_PROMPT } from '../constants/prompts';
import { AI_MODELS } from '../constants/models';

/**
 * Input for the survey analyzer agent
 */
export interface SurveyAnalyzerInput {
  /**
   * Raw survey data to analyze
   */
  surveyData: {
    /**
     * CSAT scores and related metrics
     */
    quantitativeData?: {
      [key: string]: any;
    };
    
    /**
     * VA.gov Debt Portal Questionnaire data
     */
    debtPortalSurvey?: {
      [key: string]: any;
    };
    
    /**
     * VA.gov VFS Questionnaire data
     */
    vfsQuestionnaire?: {
      [key: string]: any;
    };
    
    /**
     * VA.gov A11 Questionnaire (intercept survey) data
     */
    a11Questionnaire?: {
      [key: string]: any;
    };
  };
  
  /**
   * Specific configuration options for the analysis
   */
  options?: {
    /**
     * Whether to include previous period metrics for comparison
     */
    includePreviousPeriod?: boolean;
    
    /**
     * Maximum number of example quotes per theme
     */
    maxExampleQuotes?: number;
    
    /**
     * Whether to use markdown formatting in the output
     */
    useMarkdown?: boolean;
  };
}

/**
 * Output from the survey analyzer agent
 */
export interface SurveyAnalyzerOutput {
  /**
   * Complete report in markdown format
   */
  markdownReport: string;
  
  /**
   * Structured data from the analysis
   */
  structuredData: {
    quantitativeData: {
      metrics: Array<{
        name: string;
        score: number;
        previousPeriod?: number;
        change?: number;
        confidenceLevel: string;
        marginOfError: number;
        sampleSize: number;
      }>;
    };
    qualitativeData: {
      majorThemes: Array<{
        name: string;
        description: string;
      }>;
      surveys: {
        debtPortal?: any;
        vfsQuestionnaire?: any;
        a11Questionnaire?: any;
      };
    };
  };
  
  /**
   * Any issues encountered during analysis
   */
  issues?: Array<{
    type: string;
    message: string;
    severity: 'warning' | 'error';
  }>;
  
  /**
   * Processing metadata
   */
  metadata: {
    processingTimeMs: number;
    modelUsed: string;
    templateSource: string;
  };
}

/**
 * Survey analyzer agent that processes VA.gov user feedback
 * and generates reports following the Medallia template
 */
export class SurveyAnalyzerAgent extends BaseAgent<SurveyAnalyzerInput, SurveyAnalyzerOutput> {
  constructor() {
    super(
      'Survey Analyzer',
      'Analyzes VA.gov user survey data and generates structured reports'
    );
  }
  
  /**
   * Generate a comprehensive survey analysis report
   */
  async process(input: SurveyAnalyzerInput): Promise<SurveyAnalyzerOutput> {
    const startTime = Date.now();
    const issues: Array<{type: string, message: string, severity: 'warning' | 'error'}> = [];
    
    try {
      // Validate input data
      if (!input.surveyData) {
        throw new Error('No survey data provided');
      }
      
      // Set default options
      const options = {
        includePreviousPeriod: true,
        maxExampleQuotes: 3,
        useMarkdown: true,
        ...input.options
      };
      
      // Get API key from storage
      const data = await chrome.storage.sync.get(['apiKey']);
      
      if (!data.apiKey) {
        throw new Error('API key not configured. Please set up your API key in the extension settings.');
      }
      
      // Prepare the prompt with survey data
      const userPrompt = `Please analyze the following VA.gov survey data and generate a report following the Medallia template structure:
      
${JSON.stringify(input.surveyData, null, 2)}

Include ${options.maxExampleQuotes} example quotes per theme and ${options.includePreviousPeriod ? 'include' : 'exclude'} previous period metrics.`;
      
      // Call OpenAI API
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${data.apiKey}`
        },
        body: JSON.stringify({
          model: AI_MODELS.SURVEY_ANALYSIS,
          messages: [
            {
              role: 'system',
              content: MEDALLIA_SURVEY_PROMPT
            },
            {
              role: 'user',
              content: userPrompt
            }
          ],
          response_format: { type: 'json_object' }
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `API request failed: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error.message || 'Unknown API error');
      }
      
      const content = result.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error('No content received from API');
      }
      
      // Parse the structured data
      const parsedData = JSON.parse(content);
      
      // Generate markdown report from structured data
      const markdownReport = this.generateMarkdownReport(parsedData);
      
      // Calculate confidence based on data quality and completeness
      const confidence = this.calculateConfidence(parsedData);
      this.setConfidence(confidence);
      
      const processingTimeMs = Date.now() - startTime;
      
      return {
        markdownReport,
        structuredData: parsedData,
        issues,
        metadata: {
          processingTimeMs,
          modelUsed: AI_MODELS.SURVEY_ANALYSIS,
          templateSource: 'Medallia.md'
        }
      };
      
    } catch (error) {
      console.error('Survey analysis failed:', error);
      this.setConfidence(0);
      throw error;
    }
  }
  
  /**
   * Generate markdown report from structured data
   */
  private generateMarkdownReport(data: any): string {
    let markdown = `# Medallia Report\n\n`;
    
    // QUANTITATIVE DATA SECTION
    markdown += `## QUANTITATIVE DATA\n\n`;
    
    if (data.quantitativeData?.metrics?.length) {
      markdown += `### CSAT Scores\n\n`;
      
      markdown += `| Metric | Score | Previous Period | Change | Confidence Level | Margin of Error |\n`;
      markdown += `|--------|-------|----------------|--------|------------------|----------------|\n`;
      
      for (const metric of data.quantitativeData.metrics) {
        markdown += `| ${metric.name} | ${metric.score.toFixed(2)}% | ${metric.previousPeriod?.toFixed(2)}% | ${metric.change >= 0 ? '+' : ''}${metric.change?.toFixed(2)}% | ${metric.confidenceLevel} | ±${metric.marginOfError.toFixed(2)}% |\n`;
      }
      
      markdown += `\n`;
    }
    
    // QUALITATIVE DATA SECTION
    markdown += `## QUALITATIVE DATA SECTION\n\n`;
    
    // Major Themes
    if (data.qualitativeData?.majorThemes?.length) {
      markdown += `### Major Themes Across All Surveys\n`;
      
      for (let i = 0; i < data.qualitativeData.majorThemes.length; i++) {
        const theme = data.qualitativeData.majorThemes[i];
        markdown += `${i + 1}. ${theme.name} - ${theme.description}\n`;
      }
      
      markdown += `\n`;
    }
    
    // FSR Custom Survey
    if (data.qualitativeData?.surveys?.debtPortal) {
      const debtPortal = data.qualitativeData.surveys.debtPortal;
      
      markdown += `### FSR Custom Survey (VA.gov Debt Portal Questionnaire)\n\n`;
      
      // Question 1
      if (debtPortal.completionEase) {
        markdown += `#### 1. "I was able to easily complete this form online."\n\n`;
        markdown += `Total Responses: ${debtPortal.completionEase.totalResponses}\n\n`;
        
        markdown += `| Response | Count | Percentage |\n`;
        markdown += `|----------|-------|------------|\n`;
        
        for (const item of debtPortal.completionEase.breakdown) {
          markdown += `| ${item.response} | ${item.count} | ${item.percentage.toFixed(1)}% |\n`;
        }
        
        markdown += `\n`;
      }
      
      // Question 2
      if (debtPortal.confusingAreas) {
        markdown += `#### 2. "Did you find any section of the form confusing or unclear?"\n\n`;
        markdown += `Total Responses: ${debtPortal.confusingAreas.totalResponses}\n\n`;
        
        markdown += `| Section | Count | Percentage |\n`;
        markdown += `|---------|-------|------------|\n`;
        
        for (const item of debtPortal.confusingAreas.breakdown) {
          markdown += `| ${item.section} | ${item.count} | ${item.percentage.toFixed(1)}% |\n`;
        }
        
        markdown += `\n`;
      }
      
      // Question 3
      if (debtPortal.improvements) {
        markdown += `#### 3. "What specific changes would you like to see to make the form more user-friendly?"\n\n`;
        markdown += `Total Responses: ${debtPortal.improvements.totalResponses}\n`;
        markdown += `Responses with "None" or "N/A": ${debtPortal.improvements.noSuggestions} (${((debtPortal.improvements.noSuggestions / debtPortal.improvements.totalResponses) * 100).toFixed(1)}%)\n\n`;
        
        markdown += `**Key Themes:**\n`;
        
        for (const theme of debtPortal.improvements.themes) {
          markdown += `1. ${theme.name} - ${theme.mentions} mentions\n`;
          
          for (const example of theme.examples) {
            markdown += `   * "${example}"\n`;
          }
        }
        
        markdown += `\n`;
      }
    }
    
    // VFS Questionnaire
    if (data.qualitativeData?.surveys?.vfsQuestionnaire) {
      const vfs = data.qualitativeData.surveys.vfsQuestionnaire;
      
      markdown += `### VA.gov VFS Questionnaire\n\n`;
      markdown += `${vfs.totalResponses} responses\n`;
      
      if (vfs.averageSatisfaction) {
        markdown += `What is your overall satisfaction with this site? Average: ${vfs.averageSatisfaction.toFixed(2)} (out of 5)\n\n`;
      }
      
      if (vfs.tasks) {
        markdown += `#### "What task were you trying to do today?"\n\n`;
        markdown += `Total Responses: ${vfs.tasks.totalResponses}\n\n`;
        
        markdown += `**Key Themes:**\n`;
        
        for (const theme of vfs.tasks.themes) {
          markdown += `1. ${theme.name} - ${theme.mentions} mentions\n`;
          
          for (const example of theme.examples) {
            markdown += `   * "${example}"\n`;
          }
        }
        
        markdown += `\n`;
      }
      
      if (vfs.bugs && vfs.bugs.length > 0) {
        markdown += `**Reported Bugs:**\n`;
        
        for (const bug of vfs.bugs) {
          markdown += `* ${bug.date} - ${bug.url} - "${bug.description}"\n`;
        }
        
        markdown += `\n`;
      }
    }
    
    // A11 Questionnaire
    if (data.qualitativeData?.surveys?.a11Questionnaire) {
      const a11 = data.qualitativeData.surveys.a11Questionnaire;
      
      markdown += `### VA.gov A11 Questionnaire (intercept survey)\n\n`;
      markdown += `${a11.totalResponses} responses\n`;
      markdown += `Decline percent: ${a11.declinePercent}% Submission percent: ${a11.submissionPercent}%\n\n`;
      
      if (a11.ratingRationale && a11.ratingRationale.themes) {
        markdown += `#### "Why did you select that rating?"\n\n`;
        
        markdown += `**Key Themes:**\n`;
        
        for (const theme of a11.ratingRationale.themes) {
          markdown += `1. ${theme.name} - ${theme.mentions} mentions\n`;
          
          for (const example of theme.examples) {
            markdown += `   * "${example}"\n`;
          }
        }
      }
    }
    
    return markdown;
  }
  
  /**
   * Calculate overall confidence score based on data quality
   */
  private calculateConfidence(data: any): number {
    let confidenceScore = 0.5; // Start with a neutral score
    
    // Check quantitative data quality
    if (data.quantitativeData?.metrics?.length > 0) {
      confidenceScore += 0.2;
    }
    
    // Check qualitative data quality
    if (data.qualitativeData?.majorThemes?.length > 0) {
      confidenceScore += 0.1;
    }
    
    // Check individual survey data
    if (data.qualitativeData?.surveys?.debtPortal) {
      confidenceScore += 0.1;
    }
    
    if (data.qualitativeData?.surveys?.vfsQuestionnaire) {
      confidenceScore += 0.05;
    }
    
    if (data.qualitativeData?.surveys?.a11Questionnaire) {
      confidenceScore += 0.05;
    }
    
    // Ensure confidence is between 0 and 1
    return Math.max(0, Math.min(1, confidenceScore));
  }
} 