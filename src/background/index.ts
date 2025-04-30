import { APIClient } from '@/lib/api-client';
import { AI_MODELS } from '@/lib/constants/ai-models';

let apiClient: APIClient | null = null;

interface SentimentResponse {
  sentiment: string;
  confidence: number;
  error?: string;
  text?: string;
  markdown?: string;
  chunkIndex?: number;
  totalChunks?: number;
}

// Track content script connections
const connections = new Map<number, chrome.runtime.Port>();
// Explicitly mark the popup port as used with underscore prefix to avoid TS linting error
let _popupPort: chrome.runtime.Port | null = null;

// Initialize context menu
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "analyzeSentiment",
    title: "Analyze Sentiment",
    contexts: ["selection"]
  });
});

// Handle content script connections
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "content-script") {
    const tab = port.sender?.tab;
    if (tab?.id) {
      console.log(`Content script connected for tab ${tab.id}`);
      connections.set(tab.id, port);
      
      port.onMessage.addListener(async (msg) => {
        console.log('Received message from content script:', msg);
        if (msg.action === "analyzeSentiment") {
          try {
            const result = await analyzeSentiment(msg.text);
            broadcastMessage({
              type: 'analysisResult',
              data: {
                ...result,
                text: msg.text
              }
            });
          } catch (error) {
            broadcastMessage({
              type: 'analysisError',
              error: error instanceof Error ? error.message : 'Analysis failed'
            });
          }
        }
      });
      
      port.onDisconnect.addListener(() => {
        console.log(`Content script disconnected for tab ${tab.id}`);
        connections.delete(tab.id!);
      });
    }
  } else if (port.name === "popup") {
    console.log('Popup connected');
    _popupPort = port;
    
    port.onMessage.addListener(async (msg) => {
      console.log('Received message from popup:', msg);
      if (msg.action === "analyzeSentiment") {
        try {
          const result = await analyzeSentiment(msg.text);
          broadcastMessage({
            type: 'analysisResult',
            data: {
              ...result,
              text: msg.text
            }
          });
        } catch (error) {
          broadcastMessage({
            type: 'analysisError',
            error: error instanceof Error ? error.message : 'Analysis failed'
          });
        }
      }
    });
    
    port.onDisconnect.addListener(() => {
      console.log('Popup disconnected');
      _popupPort = null;
    });
  }
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "analyzeSentiment" && info.selectionText) {
    // Send message to content script
    chrome.tabs.sendMessage(tab?.id ?? -1, {
      action: "analyzeSentiment",
      text: info.selectionText
    });
  }
});

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle messages here
  if (message.action === "getApiKey") {
    chrome.storage.sync.get(['apiKey'], (result) => {
      sendResponse({ apiKey: result.apiKey });
    });
    return true; // Important for async response
  }
  
  if (message.action === "analyzeSentiment") {
    analyzeSentiment(message.text, message.chunkIndex, message.totalChunks)
      .then(result => {
        // Send response to whoever requested it
        sendResponse(result);
        
        // Also broadcast to popup if request came from content script
        if (sender.tab) {
          chrome.runtime.sendMessage({
            type: 'analysisResult',
            data: {
              ...result,
              text: message.text,
              chunkIndex: message.chunkIndex,
              totalChunks: message.totalChunks
            }
          }).catch(() => {
            // Ignore errors if popup is closed
          });
        }
      })
      .catch(error => {
        console.error('Analysis failed:', error);
        const errorResponse: SentimentResponse = {
          sentiment: 'Unknown',
          confidence: 0,
          error: error instanceof Error ? error.message : 'Analysis failed',
          chunkIndex: message.chunkIndex,
          totalChunks: message.totalChunks
        };
        sendResponse(errorResponse);
        
        // Also broadcast error to popup if request came from content script
        if (sender.tab) {
          chrome.runtime.sendMessage({
            type: 'analysisError',
            error: error instanceof Error ? error.message : 'Analysis failed',
            chunkIndex: message.chunkIndex,
            totalChunks: message.totalChunks
          }).catch(() => {
            // Ignore errors if popup is closed
          });
        }
      });
    return true; // Required for async response
  }

  if (message.action === "initializeAPI") {
    try {
      apiClient = new APIClient(message.apiKey);
      sendResponse({ success: true });
    } catch (error) {
      sendResponse({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to initialize API client' 
      });
    }
    return true;
  }
});

// Core sentiment analysis function
async function analyzeSentiment(text: string, chunkIndex?: number, totalChunks?: number): Promise<SentimentResponse> {
  try {
    const data = await chrome.storage.sync.get(["apiKey", "instructions"]);
    
    if (!data.apiKey) {
      throw new Error("API key not found. Please configure your settings.");
    }

    // Initialize API client if needed
    if (!apiClient) {
      apiClient = new APIClient(data.apiKey);
      // Add a small delay after initialization to ensure proper setup
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('Analyzing text:', text.substring(0, 100) + (text.length > 100 ? '...' : ''));
    if (chunkIndex !== undefined && totalChunks !== undefined) {
      console.log(`Processing chunk ${chunkIndex + 1} of ${totalChunks}`);
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${data.apiKey}`
      },
      body: JSON.stringify({
        model: AI_MODELS.TEXT_PROCESSING,
        messages: [
          {
            role: "system",
            content: `You are a sentiment analyzer specializing in social media content and user feedback. Analyze the sentiment of the given text and provide a clear, concise analysis.

Your response should be a simple JSON object containing:
{
  "sentiment": "positive" | "negative" | "neutral",
  "confidence": number between 0 and 1,
  "themes": ["main topic/theme"],
  "summary": "brief summary of the content"
}`
          },
          {
            role: "user",
            content: `${data.instructions || "Please analyze the sentiment of this text."}\n\n${text}`
          }
        ],
        response_format: { type: "json_object" }
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

    // Parse the response and add the original text to ensure it's preserved
    let sentimentData;
    try {
      sentimentData = JSON.parse(content);
      
      // Validate required fields
      if (!sentimentData.sentiment || typeof sentimentData.confidence !== 'number') {
        throw new Error('Invalid response format from API');
      }
    } catch (error) {
      console.error('Error parsing API response:', error);
      // Provide default values if parsing fails
      sentimentData = {
        sentiment: 'neutral',
        confidence: 0.5,
        themes: ['General Discussion'],
        summary: 'Social media post'
      };
    }
    
    // Create a markdown summary of the analysis
    let markdown = `# Sentiment Analysis Report\n\n`;
    
    // Overall sentiment with icon
    const sentimentIcon = sentimentData.sentiment === 'positive' ? '✅' :
                         sentimentData.sentiment === 'negative' ? '❌' : '📊';
    markdown += `${sentimentIcon} **Overall: ${sentimentData.sentiment}** (${Math.round(sentimentData.confidence * 100)}% confidence)\n\n`;
    
    if (chunkIndex !== undefined && totalChunks !== undefined) {
      markdown += `> Analyzing chunk ${chunkIndex + 1} of ${totalChunks}\n\n`;
    }

    // Main themes
    if (sentimentData.themes && sentimentData.themes.length > 0) {
      markdown += `## Key Themes\n\n`;
      sentimentData.themes.forEach((theme: string) => {
        markdown += `• ${theme}\n`;
      });
      markdown += '\n';
    }

    // Summary
    if (sentimentData.summary) {
      markdown += `## Summary\n\n${sentimentData.summary}\n\n`;
    }

    // Original text
    markdown += `## Original Text\n\n> ${text}\n`;

    return {
      sentiment: sentimentData.sentiment,
      confidence: sentimentData.confidence,
      text: text,
      markdown: markdown,
      chunkIndex,
      totalChunks
    };

  } catch (error) {
    console.error('Sentiment analysis failed:', error);
    throw error;
  }
}

// Helper function to broadcast messages
function broadcastMessage(message: any) {
  // Send to popup if connected
  if (_popupPort) {
    try {
      _popupPort.postMessage(message);
    } catch (e) {
      console.error('Failed to send to popup:', e);
      _popupPort = null;
    }
  }
  
  // Send to all connected content scripts
  connections.forEach((port, tabId) => {
    try {
      port.postMessage(message);
    } catch (e) {
      console.error(`Failed to send to content script ${tabId}:`, e);
      connections.delete(tabId);
    }
  });
} 