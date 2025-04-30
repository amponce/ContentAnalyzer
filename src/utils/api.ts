import { AI_MODELS } from '@/lib/constants/ai-models';

interface SentimentResponse {
  sentiment: string;
  confidence: number;
  error?: string;
}

export async function analyzeSentiment(
  apiKey: string,
  text: string
): Promise<SentimentResponse> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: AI_MODELS.TEXT_PROCESSING,
      messages: [
        {
          role: "system",
          content: "You are a sentiment analyzer. Analyze the sentiment of the given text and respond with a JSON object containing 'sentiment' (positive, negative, or neutral) and 'confidence' (a number between 0 and 1)."
        },
        {
          role: "user",
          content: text
        }
      ],
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
} 