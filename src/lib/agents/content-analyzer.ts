import { BaseAgent } from './agent-interface';
import { AI_MODELS } from '../constants/models';

/**
 * Input for the content analyzer agent
 */
export interface ContentAnalyzerInput {
  /**
   * Content to analyze (page text, social media thread, etc.)
   */
  content: string;
  
  /**
   * User question (optional)
   */
  question?: string;
  
  /**
   * Previous conversation history (optional)
   */
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  
  /**
   * Analysis options
   */
  options?: {
    /**
     * Whether to include sentiment analysis
     */
    includeSentiment?: boolean;
    
    /**
     * Whether to extract key topics/themes
     */
    includeTopics?: boolean;
    
    /**
     * How detailed the summary should be (1-5)
     */
    summaryDetailLevel?: number;
  };
}

/**
 * Output from content analyzer
 */
export interface ContentAnalyzerOutput {
  /**
   * Title or heading derived from content
   */
  title: string;
  
  /**
   * Concise summary of the content
   */
  summary: string;
  
  /**
   * Sentiment analysis results (if requested)
   */
  sentiment?: {
    /**
     * Overall sentiment (positive, negative, neutral, mixed)
     */
    type: 'positive' | 'negative' | 'neutral' | 'mixed';
    
    /**
     * Confidence score (0-1)
     */
    confidence: number;
  };
  
  /**
   * Key topics or themes in the content
   */
  topics?: string[];
  
  /**
   * Answer to user's question (if provided)
   */
  answer?: string;
  
  /**
   * Markdown formatted report
   */
  markdownReport: string;
  
  /**
   * Additional metadata about the analysis
   */
  metadata: {
    /**
     * Process time in milliseconds
     */
    processingTimeMs: number;
    
    /**
     * AI model used for analysis
     */
    modelUsed: string;
    
    /**
     * Character count of original content
     */
    contentLength: number;
  };
}

/**
 * General content analyzer agent for summarizing and analyzing web content,
 * social media threads, and other text. Includes conversational capabilities
 * to answer questions about the content.
 */
export class ContentAnalyzerAgent extends BaseAgent<ContentAnalyzerInput, ContentAnalyzerOutput> {
  constructor() {
    super(
      'Content Analyzer',
      'Analyzes and summarizes text content with conversational capabilities'
    );
  }
  
  /**
   * Process content to generate summary, sentiment analysis, and answer questions
   */
  async process(input: ContentAnalyzerInput): Promise<ContentAnalyzerOutput> {
    const startTime = Date.now();
    
    try {
      // Validate input
      if (!input.content) {
        throw new Error('No content provided for analysis');
      }
      
      // Set default options
      const options = {
        includeSentiment: true,
        includeTopics: true,
        summaryDetailLevel: 3,
        ...input.options
      };
      
      // Get API key from storage
      const data = await chrome.storage.sync.get(['apiKey']);
      
      if (!data.apiKey) {
        throw new Error('API key not configured. Please set up your API key in the extension settings.');
      }
      
      // Prepare system prompt based on what we're trying to do
      let systemPrompt: string;
      
      if (input.question) {
        // If user asked a question, we focus on answering it
        systemPrompt = `You are an intelligent content analyst and question answering system.
        
First, analyze and understand the provided content thoroughly.
        
Then answer the user's specific question about this content. Your answer should:
1. Be directly based on the content provided
2. Be accurate and factual
3. Be comprehensive but concise
4. Include relevant quotes from the content when appropriate
5. Acknowledge if the question cannot be fully answered based on the provided content

Your response should be a JSON object with the following structure:
{
  "title": "Concise title or heading derived from the content",
  "summary": "Brief 2-3 sentence summary of the overall content",
  "sentiment": ${options.includeSentiment ? '{ "type": "positive|negative|neutral|mixed", "confidence": number between 0-1 }' : 'null'},
  "topics": ${options.includeTopics ? '["topic1", "topic2", "topic3"]' : 'null'},
  "answer": "Your detailed answer to the user's question based on the content"
}`;
      } else {
        // Otherwise we focus on summarization and analysis
        systemPrompt = `You are an intelligent content analyst and summarizer.
        
Analyze the provided content and create a comprehensive analysis. Your analysis should:
1. Extract the most important information
2. Identify key themes and topics
3. Evaluate the tone and sentiment
4. Create a coherent, well-structured summary at an appropriate level of detail

Your response should be a JSON object with the following structure:
{
  "title": "Concise title or heading derived from the content",
  "summary": "${options.summaryDetailLevel <= 2 ? 'Brief 2-3 sentence summary' : options.summaryDetailLevel >= 4 ? 'Detailed multi-paragraph summary' : 'Balanced paragraph summary'} of the content",
  "sentiment": ${options.includeSentiment ? '{ "type": "positive|negative|neutral|mixed", "confidence": number between 0-1 }' : 'null'},
  "topics": ${options.includeTopics ? '["topic1", "topic2", "topic3"]' : 'null'},
  "keyPoints": ["important point 1", "important point 2", "important point 3"]
}`;
      }
      
      // Build conversation messages
      const messages = [
        { role: 'system', content: systemPrompt }
      ];
      
      // Add conversation history if available
      if (input.conversationHistory && input.conversationHistory.length > 0) {
        input.conversationHistory.forEach(msg => {
          messages.push({
            role: msg.role, 
            content: msg.content
          });
        });
      }
      
      // Add current content and question
      if (input.question) {
        messages.push({
          role: 'user',
          content: `Content to analyze: 
${input.content}

My question: ${input.question}`
        });
      } else {
        messages.push({
          role: 'user',
          content: `Please analyze this content: 
${input.content}`
        });
      }
      
      // Call OpenAI API
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${data.apiKey}`
        },
        body: JSON.stringify({
          model: AI_MODELS.TEXT_PROCESSING,
          messages,
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
      
      // Parse the response data
      const parsedData = JSON.parse(content);
      
      // Set confidence based on quality of data
      this.setConfidence(parsedData.sentiment?.confidence || 0.7);
      
      // Generate markdown report
      const markdownReport = this.generateMarkdownReport(parsedData, input);
      
      const processingTimeMs = Date.now() - startTime;
      
      return {
        title: parsedData.title || 'Content Analysis',
        summary: parsedData.summary,
        sentiment: parsedData.sentiment,
        topics: parsedData.topics,
        answer: parsedData.answer,
        markdownReport,
        metadata: {
          processingTimeMs,
          modelUsed: AI_MODELS.TEXT_PROCESSING,
          contentLength: input.content.length
        }
      };
      
    } catch (error) {
      console.error('Content analysis failed:', error);
      this.setConfidence(0);
      throw error;
    }
  }
  
  /**
   * Generate a markdown report from the analysis data
   */
  private generateMarkdownReport(data: any, input: ContentAnalyzerInput): string {
    let markdown = `# ${data.title || 'Content Analysis'}\n\n`;
    
    // Add summary section
    markdown += `## Summary\n\n${data.summary}\n\n`;
    
    // Add sentiment if available
    if (data.sentiment) {
      const sentimentIcon = 
        data.sentiment.type === 'positive' ? '✅' :
        data.sentiment.type === 'negative' ? '❌' :
        data.sentiment.type === 'mixed' ? '🔄' : '📊';
      
      markdown += `## Sentiment Analysis\n\n`;
      markdown += `${sentimentIcon} **${data.sentiment.type.charAt(0).toUpperCase() + data.sentiment.type.slice(1)}** (${Math.round(data.sentiment.confidence * 100)}% confidence)\n\n`;
    }
    
    // Add key points if available
    if (data.keyPoints && data.keyPoints.length > 0) {
      markdown += `## Key Points\n\n`;
      
      data.keyPoints.forEach((point: string) => {
        markdown += `- ${point}\n`;
      });
      
      markdown += '\n';
    }
    
    // Add topics if available
    if (data.topics && data.topics.length > 0) {
      markdown += `## Topics\n\n`;
      markdown += data.topics.map((topic: string) => `\`${topic}\``).join(' · ') + '\n\n';
    }
    
    // Add answer to question if available
    if (data.answer) {
      markdown += `## Answer\n\n`;
      markdown += `> ${input.question}\n\n`;
      markdown += `${data.answer}\n\n`;
    }
    
    // Add content excerpt
    const contentPreview = input.content.length > 300 
      ? input.content.substring(0, 300) + '...' 
      : input.content;
    
    markdown += `## Content Preview\n\n`;
    markdown += `\`\`\`\n${contentPreview}\n\`\`\`\n`;
    
    return markdown;
  }
} 