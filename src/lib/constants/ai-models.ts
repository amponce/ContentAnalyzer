export const AI_MODELS = {
  // Vision and OCR
  VISION: 'o4-vision-2025-04-16',
  VISION_FALLBACK: 'gpt-4.1',

  // Text Processing
  TEXT_PROCESSING: 'o4-mini-2025-04-16',
  TEXT_PROCESSING_HIGH_ACCURACY: 'o3',  // When highest accuracy needed

  // Form Processing
  FORM_PROCESSING: 'gpt-4o',
  FORM_PROCESSING_FALLBACK: 'gpt-4.1',

  // Web Search
  WEB_SEARCH: 'o4-web-2025-04-16',
  WEB_SEARCH_FAST: 'gpt-4o-mini-search-preview',  // Faster, cheaper web search

  // Realtime Features
  REALTIME: 'gpt-4o-realtime-preview',
  REALTIME_COST_EFFECTIVE: 'gpt-4o-mini-realtime-preview'
} as const;

export type AIModelKey = keyof typeof AI_MODELS;
export type AIModelValue = typeof AI_MODELS[AIModelKey]; 