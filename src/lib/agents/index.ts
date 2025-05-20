/**
 * Multi-Agent Form Processing Architecture
 * ---------------------------------------
 * This module provides a complete agent-based architecture for form processing.
 * It includes specialized agents for each stage of the process, working in a pipeline.
 */

// Export agent interfaces
export * from './agent-interface';

// Export individual agents
export * from './parser/parser-agent';
export * from './builder/builder-agent';
export * from './designer/designer-agent';
export * from './qa/qa-agent';
export * from './survey-analyzer';
export * from './content-analyzer';

// Import all agents
import { ParserAgent } from './parser/parser-agent';
import { BuilderAgent } from './builder/builder-agent';
import { DesignerAgent } from './designer/designer-agent';
import { QAAgent } from './qa/qa-agent';
import { SurveyAnalyzerAgent } from './survey-analyzer';
import { ContentAnalyzerAgent } from './content-analyzer';

/**
 * Result type for form processing pipeline
 */
export interface FormProcessingResult {
  /**
   * Final form data with validated fields
   */
  formData: any;
  
  /**
   * Metadata from each stage of processing
   */
  metadata: {
    parsing: any;
    building: any;
    design: any;
    qa: any;
  };
  
  /**
   * Any issues identified during processing
   */
  issues: Array<any>;
  
  /**
   * Overall confidence in the result
   */
  confidence: number;
}

/**
 * Form processing pipeline factory
 * Creates an agent pipeline for processing forms
 * @returns Object with methods to process forms
 */
export function createFormProcessingPipeline() {
  // Create instances of all agents
  const parserAgent = new ParserAgent();
  const builderAgent = new BuilderAgent();
  const designerAgent = new DesignerAgent();
  const qaAgent = new QAAgent();
  
  return {
    /**
     * Process a form through the entire pipeline
     * @param pages Array of PDF pages as images
     * @param options Processing options
     * @returns Complete form processing result
     */
    async processForm(
      pages: any[], 
      options?: {
        formNumber?: string;
        formTitle?: string;
        designPreferences?: any;
        qaRequirements?: any;
      }
    ): Promise<FormProcessingResult> {
      try {
        console.log(`Starting form processing pipeline for ${pages.length} pages`);
        
        // Step 1: Parse the form
        const parserResult = await parserAgent.process({
          pages,
          targetFields: [],
          mode: 'standard'
        });
        
        // Step 2: Build structured form data
        const builderResult = await builderAgent.process({
          parserOutput: parserResult,
          formNumber: options?.formNumber,
          formTitle: options?.formTitle
        });
        
        // Step 3: Enhance form design
        const designerResult = await designerAgent.process({
          builderOutput: builderResult,
          preferences: options?.designPreferences
        });
        
        // Step 4: Perform QA
        const qaResult = await qaAgent.process({
          designerOutput: designerResult,
          originalText: parserResult.rawText,
          requirements: options?.qaRequirements
        });
        
        // Combine results
        return {
          formData: qaResult.validatedFormData,
          metadata: {
            parsing: parserResult.metadata,
            building: builderResult.metadata,
            design: designerResult.designMetadata,
            qa: qaResult.metadata
          },
          issues: qaResult.issues,
          confidence: qaResult.overallConfidence
        };
      } catch (error) {
        console.error('Error in form processing pipeline:', error);
        throw error;
      }
    },
    
    /**
     * Get all agents in the pipeline
     * @returns Array of all agents
     */
    getAgents() {
      return [
        parserAgent,
        builderAgent,
        designerAgent,
        qaAgent
      ];
    },
    
    /**
     * Run only a specific stage of the pipeline
     * @param stage The stage to run
     * @param input Input for the stage
     * @returns Output from the stage
     */
    async runStage(stage: 'parser' | 'builder' | 'designer' | 'qa', input: any): Promise<any> {
      switch (stage) {
        case 'parser':
          return await parserAgent.process(input);
        case 'builder':
          return await builderAgent.process(input);
        case 'designer':
          return await designerAgent.process(input);
        case 'qa':
          return await qaAgent.process(input);
        default:
          throw new Error(`Unknown pipeline stage: ${stage}`);
      }
    }
  };
}

/**
 * Create an instance of the survey analyzer agent for Medallia reports
 * @returns Survey analyzer agent
 */
export function createSurveyAnalyzer() {
  return new SurveyAnalyzerAgent();
}

/**
 * Create an instance of the content analyzer agent for general content analysis
 * @returns Content analyzer agent
 */
export function createContentAnalyzer() {
  return new ContentAnalyzerAgent();
} 