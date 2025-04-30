import { APIClient } from '@/lib/api-client';
import { AI_MODELS } from '@/lib/constants/ai-models';

let apiClient: APIClient | null = null;

interface SentimentResponse {
  sentiment: string;
  confidence: number;
  error?: string;
  text?: string;
}

// Track content script connections
const connections = new Map<number, chrome.runtime.Port>();
let popupPort: chrome.runtime.Port | null = null;

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
            port.postMessage({
              type: 'analysisResult',
              data: {
                ...result,
                text: msg.text
              }
            });
          } catch (error) {
            port.postMessage({
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
    popupPort = port;
    
    port.onMessage.addListener(async (msg) => {
      console.log('Received message from popup:', msg);
      if (msg.action === "analyzeSentiment") {
        try {
          const result = await analyzeSentiment(msg.text);
          port.postMessage({
            type: 'analysisResult',
            data: {
              ...result,
              text: msg.text
            }
          });
        } catch (error) {
          port.postMessage({
            type: 'analysisError',
            error: error instanceof Error ? error.message : 'Analysis failed'
          });
        }
      }
    });
    
    port.onDisconnect.addListener(() => {
      console.log('Popup disconnected');
      popupPort = null;
    });
  }
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;
  
  if (info.menuItemId === "analyzeSentiment" && info.selectionText) {
    try {
      const result = await analyzeSentiment(info.selectionText);
      broadcastMessage({
        type: 'analysisResult',
        data: {
          ...result,
          text: info.selectionText
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

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request, 'from:', sender);
  
  if (request.action === "analyzeSentiment") {
    analyzeSentiment(request.text)
      .then(result => {
        // Send response to whoever requested it
        sendResponse(result);
        
        // Also broadcast to popup if request came from content script
        if (sender.tab) {
          chrome.runtime.sendMessage({
            type: 'analysisResult',
            data: {
              ...result,
              text: request.text
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
          error: error instanceof Error ? error.message : 'Analysis failed'
        };
        sendResponse(errorResponse);
        
        // Also broadcast error to popup if request came from content script
        if (sender.tab) {
          chrome.runtime.sendMessage({
            type: 'analysisError',
            error: error instanceof Error ? error.message : 'Analysis failed'
          }).catch(() => {
            // Ignore errors if popup is closed
          });
        }
      });
    return true; // Required for async response
  }

  if (request.action === "initializeAPI") {
    try {
      apiClient = new APIClient(request.apiKey);
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
async function analyzeSentiment(text: string): Promise<SentimentResponse> {
  try {
    const data = await chrome.storage.sync.get(["apiKey", "instructions"]);
    
    if (!data.apiKey) {
      throw new Error("API key not found. Please configure your settings.");
    }

    // Initialize API client if needed
    if (!apiClient) {
      apiClient = new APIClient(data.apiKey);
    }

    // Format the text as a survey response if it's not already formatted
    const formattedText = text.includes('Survey Response ID:') 
      ? text 
      : `Survey Response ID: 1\nFeedback: ${text}`;

    console.log('Analyzing text:', formattedText.substring(0, 100) + (formattedText.length > 100 ? '...' : ''));

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
            content: "You are a sentiment analyzer. Analyze the sentiment of the given text and respond with a JSON object containing 'sentiment' (positive, negative, or neutral) and 'confidence' (a number between 0 and 1)."
          },
          {
            role: "user",
            content: `${data.instructions || "Please analyze the sentiment of this text."}\n\n${formattedText}`
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
    const sentimentData = JSON.parse(content) as SentimentResponse;
    return {
      ...sentimentData,
      text: text // Ensure the original full text is included
    };

  } catch (error) {
    console.error('Sentiment analysis failed:', error);
    throw error;
  }
}

// Helper function to broadcast messages
function broadcastMessage(message: any) {
  // Send to popup if connected
  if (popupPort) {
    try {
      popupPort.postMessage(message);
    } catch (e) {
      console.error('Failed to send to popup:', e);
      popupPort = null;
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