export interface AnalysisResult {
  timestamp: string;
  text: string;
  sentiment: 'Positive' | 'Neutral' | 'Negative';
  confidence: number;
  fullAnalysis: string;
  sourceType: string;
}

export interface AnalysisHistory {
  entries: AnalysisResult[];
  totalAnalyses: number;
  avgConfidence: number;
}

export interface ApiStatus {
  status: 'connected' | 'error' | 'checking';
  message?: string;
}

export interface Settings {
  apiKey: string;
  prompt: string;
  batchSize: number;
} 