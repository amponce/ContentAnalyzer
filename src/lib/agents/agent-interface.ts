/**
 * Base interface for all form processing agents
 */
export interface Agent<InputType, OutputType> {
  /**
   * Process the input and return the output
   * @param input The input data to process
   * @returns The processed output data
   */
  process(input: InputType): Promise<OutputType>;
  
  /**
   * Get the agent's name
   * @returns The agent's name
   */
  getName(): string;
  
  /**
   * Get the agent's description
   * @returns The agent's description
   */
  getDescription(): string;
  
  /**
   * Get the confidence score for the latest processing
   * @returns A number between 0 and 1 representing confidence
   */
  getConfidence(): number;
}

/**
 * Base agent implementation with common functionality
 */
export abstract class BaseAgent<InputType, OutputType> implements Agent<InputType, OutputType> {
  protected name: string;
  protected description: string;
  protected confidence: number = 0;
  
  constructor(name: string, description: string) {
    this.name = name;
    this.description = description;
  }
  
  abstract process(input: InputType): Promise<OutputType>;
  
  getName(): string {
    return this.name;
  }
  
  getDescription(): string {
    return this.description;
  }
  
  getConfidence(): number {
    return this.confidence;
  }
  
  /**
   * Set the confidence score for the latest processing
   * @param confidence A number between 0 and 1
   */
  protected setConfidence(confidence: number): void {
    this.confidence = Math.max(0, Math.min(1, confidence));
  }
} 