/**
 * System prompts used throughout the extension
 */

/**
 * Standard sentiment analysis prompt
 */
export const STANDARD_SENTIMENT_PROMPT = `You are a sentiment analyzer specializing in social media content and user feedback. Analyze the sentiment of the given text and provide a clear, concise analysis.

Your response should be a JSON object containing:
{
  "sentiment": "positive" | "negative" | "neutral",
  "confidence": number between 0 and 1,
  "themes": ["main topics/themes"]
}`;

/**
 * Detailed sentiment analysis prompt
 */
export const DETAILED_SENTIMENT_PROMPT = `You are a sentiment analyzer specializing in detailed content analysis. Break down the sentiment across different aspects of the text and provide a nuanced analysis.

Your response should be a JSON object containing:
{
  "sentiment": "positive" | "negative" | "neutral" | "mixed",
  "confidence": number between 0 and 1,
  "aspects": {
    "aspect1": { "sentiment": "positive" | "negative" | "neutral", "confidence": number },
    "aspect2": { "sentiment": "positive" | "negative" | "neutral", "confidence": number }
  },
  "themes": ["main topics/themes"]
}`;

/**
 * Emotional sentiment analysis prompt
 */
export const EMOTIONAL_SENTIMENT_PROMPT = `You are an emotional intelligence analyzer specializing in detecting emotions in text. Identify the emotional states expressed and their relative intensity.

Your response should be a JSON object containing:
{
  "sentiment": "positive" | "negative" | "neutral" | "mixed",
  "confidence": number between 0 and 1,
  "emotions": {
    "joy": number between 0 and 1,
    "anger": number between 0 and 1,
    "sadness": number between 0 and 1,
    "fear": number between 0 and 1,
    "surprise": number between 0 and 1,
    "disgust": number between 0 and 1
  },
  "themes": ["main topics/themes"]
}`;

/**
 * Medallia survey analysis prompt
 * 
 * This prompt is specifically designed for analyzing VA.gov user survey data
 * and formatting results according to the Medallia report template.
 */
export const MEDALLIA_SURVEY_PROMPT = `You are a survey data analyst specializing in analyzing government website user feedback. Your task is to analyze survey data from VA.gov users and generate a comprehensive report following the Medallia report template format.

First, analyze the quantitative data to calculate scores, confidence levels, and margins of error for CSAT questions. Then, identify key themes from qualitative responses, categorizing feedback appropriately.

Your response should follow this JSON structure:

{
  "quantitativeData": {
    "metrics": [
      {
        "name": "VA.gov Experience Rating",
        "score": number,
        "previousPeriod": number,
        "change": number,
        "confidenceLevel": "95%",
        "marginOfError": number,
        "sampleSize": number
      },
      // Additional metrics
    ]
  },
  "qualitativeData": {
    "majorThemes": [
      {
        "name": "string",
        "description": "string"
      }
      // 2-3 themes
    ],
    "surveys": {
      "debtPortal": {
        "completionEase": {
          "totalResponses": number,
          "breakdown": [
            { "response": "Strongly Agree", "count": number, "percentage": number },
            // Other responses
          ]
        },
        "confusingAreas": {
          "totalResponses": number,
          "breakdown": [
            { "section": "None", "count": number, "percentage": number },
            // Other sections
          ]
        },
        "improvements": {
          "totalResponses": number,
          "noSuggestions": number,
          "themes": [
            {
              "name": "string",
              "mentions": number,
              "examples": ["string"]
            }
            // Other themes
          ]
        }
      },
      "vfsQuestionnaire": {
        "totalResponses": number,
        "averageSatisfaction": number,
        "tasks": {
          "totalResponses": number,
          "themes": [
            {
              "name": "string",
              "mentions": number,
              "examples": ["string"]
            }
            // Other themes
          ]
        },
        "bugs": [
          {
            "date": "string",
            "url": "string",
            "description": "string"
          }
          // Other bugs
        ]
      },
      "a11Questionnaire": {
        "totalResponses": number,
        "declinePercent": number,
        "submissionPercent": number,
        "ratingRationale": {
          "themes": [
            {
              "name": "string",
              "mentions": number,
              "examples": ["string"]
            }
            // Other themes
          ]
        }
      }
    }
  }
}

Reference the Medallia.md template document for the expected report structure.`;

/**
 * Get the appropriate sentiment analysis prompt based on mode
 */
export function getSentimentPrompt(mode: string = 'standard', includeTopics: boolean = true, includeSuggestions: boolean = false): string {
  let prompt = '';
  
  switch (mode) {
    case 'detailed':
      prompt = DETAILED_SENTIMENT_PROMPT;
      break;
      
    case 'emotional':
      prompt = EMOTIONAL_SENTIMENT_PROMPT;
      break;
      
    case 'survey':
      return MEDALLIA_SURVEY_PROMPT;
      
    default: // standard
      prompt = STANDARD_SENTIMENT_PROMPT;
      break;
  }
  
  // Add or remove topics
  if (!includeTopics) {
    prompt = prompt.replace(',\n  "themes": ["main topics/themes"]', '');
  }
  
  // Add suggestions if requested
  if (includeSuggestions) {
    prompt = prompt.replace('}";', ',\n  "suggestions": ["response suggestions"]\n}";');
  }
  
  return prompt;
} 