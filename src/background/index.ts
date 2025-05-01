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
  themes?: string[];
  aspects?: Record<string, { sentiment: string; confidence: number }>;
  emotions?: Record<string, number>;
  suggestions?: string[];
  summary?: string;
  keyPoints?: string[];
  contentType?: string;
}

interface AnalysisOptions {
  detectionMode: 'standard' | 'detailed' | 'emotional';
  includeTopics: boolean;
  includeSuggestions: boolean;
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
            const options = msg.options || { 
              detectionMode: 'standard', 
              includeTopics: true,
              includeSuggestions: false
            };
            
            const result = await analyzeSentiment(msg.text, undefined, undefined, options);
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
          const options = msg.options || { 
            detectionMode: 'standard', 
            includeTopics: true,
            includeSuggestions: false
          };
          
          const result = await analyzeSentiment(msg.text, undefined, undefined, options);
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
    analyzeSentiment(
      message.text, 
      message.chunkIndex, 
      message.totalChunks, 
      message.options
    )
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

  if (message.action === "analyzePage") {
    // Use the new summary function for page analysis
    if (message.generateSummary) {
      generatePageSummary(message.text)
        .then(result => {
          sendResponse(result);
          
          // Also broadcast to popup if request came from content script
          if (sender.tab) {
            chrome.runtime.sendMessage({
              type: 'analysisResult',
              data: {
                ...result,
                text: message.text
              }
            }).catch(() => {
              // Ignore errors if popup is closed
            });
          }
        })
        .catch(error => {
          console.error('Page summary failed:', error);
          const errorResponse: SentimentResponse = {
            sentiment: 'Unknown',
            confidence: 0,
            error: error instanceof Error ? error.message : 'Page summary failed'
          };
          sendResponse(errorResponse);
          
          if (sender.tab) {
            chrome.runtime.sendMessage({
              type: 'analysisError',
              error: error instanceof Error ? error.message : 'Page summary failed'
            }).catch(() => {
              // Ignore errors if popup is closed
            });
          }
        });
      return true;
    }
    
    // If no summary requested, continue with standard sentiment analysis
    return true;
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
  
  if (message.action === "openFormViewer") {
    try {
      // Encode the form data to pass it as a URL parameter
      const encodedFormData = encodeURIComponent(JSON.stringify(message.formData));
      
      // Use fixed dimensions instead of relying on window.screen
      // Chrome extension service workers don't have access to the window object
      
      // Create a larger window with the form viewer
      chrome.windows.create({
        url: chrome.runtime.getURL(`form-viewer.html?formData=${encodedFormData}`),
        type: 'popup',
        width: 1200,
        height: 900,
        left: 100,  // Fixed left position
        top: 50     // Fixed top position
      }, (window) => {
        if (chrome.runtime.lastError) {
          console.error('Error opening form viewer window:', chrome.runtime.lastError);
          sendResponse({ 
            success: false, 
            error: chrome.runtime.lastError.message 
          });
        } else {
          sendResponse({ success: true, windowId: window?.id });
        }
      });
      
      return true; // Required for async response
    } catch (error) {
      console.error('Error opening form viewer:', error);
      sendResponse({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to open form viewer' 
      });
      return true;
    }
  }
});

// Core sentiment analysis function
async function analyzeSentiment(
  text: string, 
  chunkIndex?: number, 
  totalChunks?: number,
  options?: AnalysisOptions
): Promise<SentimentResponse> {
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

    // Default to standard mode if not specified
    const analysisOptions = options || {
      detectionMode: 'standard',
      includeTopics: true,
      includeSuggestions: false
    };
    
    // Configure system prompt based on analysis options
    let systemPrompt = '';
    let jsonStructure = '';
    
    switch (analysisOptions.detectionMode) {
      case 'detailed':
        systemPrompt = `You are a sentiment analyzer specializing in detailed content analysis. Break down the sentiment across different aspects of the text and provide a nuanced analysis.`;
        jsonStructure = `{
          "sentiment": "positive" | "negative" | "neutral" | "mixed",
          "confidence": number between 0 and 1,
          "aspects": {
            "aspect1": { "sentiment": "positive" | "negative" | "neutral", "confidence": number },
            "aspect2": { "sentiment": "positive" | "negative" | "neutral", "confidence": number }
          }${analysisOptions.includeTopics ? ',\n  "themes": ["main topics/themes"]' : ''}${analysisOptions.includeSuggestions ? ',\n  "suggestions": ["response suggestions"]' : ''}
        }`;
        break;
        
      case 'emotional':
        systemPrompt = `You are an emotional intelligence analyzer specializing in detecting emotions in text. Identify the emotional states expressed and their relative intensity.`;
        jsonStructure = `{
          "sentiment": "positive" | "negative" | "neutral" | "mixed",
          "confidence": number between 0 and 1,
          "emotions": {
            "joy": number between 0 and 1,
            "anger": number between 0 and 1,
            "sadness": number between 0 and 1,
            "fear": number between 0 and 1,
            "surprise": number between 0 and 1,
            "disgust": number between 0 and 1
          }${analysisOptions.includeTopics ? ',\n  "themes": ["main topics/themes"]' : ''}${analysisOptions.includeSuggestions ? ',\n  "suggestions": ["response suggestions"]' : ''}
        }`;
        break;
        
      default: // standard
        systemPrompt = `You are a sentiment analyzer specializing in social media content and user feedback. Analyze the sentiment of the given text and provide a clear, concise analysis.`;
        jsonStructure = `{
          "sentiment": "positive" | "negative" | "neutral",
          "confidence": number between 0 and 1${analysisOptions.includeTopics ? ',\n  "themes": ["main topics/themes"]' : ''}${analysisOptions.includeSuggestions ? ',\n  "suggestions": ["response suggestions"]' : ''}
        }`;
        break;
    }
    
    systemPrompt += `\nYour response should be a JSON object containing:\n${jsonStructure}`;

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
            content: systemPrompt
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
                          sentimentData.sentiment === 'negative' ? '❌' :
                          sentimentData.sentiment === 'mixed' ? '🔄' : '📊';
    markdown += `${sentimentIcon} **Overall: ${sentimentData.sentiment}** (${Math.round(sentimentData.confidence * 100)}% confidence)\n\n`;
    
    if (chunkIndex !== undefined && totalChunks !== undefined) {
      markdown += `> Analyzing chunk ${chunkIndex + 1} of ${totalChunks}\n\n`;
    }

    // Detailed aspects if available
    if (sentimentData.aspects) {
      markdown += `## Aspect Breakdown\n\n`;
      for (const [aspect, data] of Object.entries(sentimentData.aspects)) {
        const aspectData = data as { sentiment: string; confidence: number };
        const aspectIcon = aspectData.sentiment === 'positive' ? '✅' :
                           aspectData.sentiment === 'negative' ? '❌' : '📊';
        markdown += `${aspectIcon} **${aspect}**: ${aspectData.sentiment} (${Math.round(aspectData.confidence * 100)}%)\n`;
      }
      markdown += '\n';
    }
    
    // Emotions if available
    if (sentimentData.emotions) {
      markdown += `## Emotional Analysis\n\n`;
      markdown += `| Emotion | Intensity |\n|---------|----------|\n`;
      for (const [emotion, intensity] of Object.entries(sentimentData.emotions)) {
        const bars = '█'.repeat(Math.ceil((intensity as number) * 10));
        markdown += `| **${emotion}** | ${bars} ${Math.round((intensity as number) * 100)}% |\n`;
      }
      markdown += '\n';
    }

    // Main themes
    if (sentimentData.themes && sentimentData.themes.length > 0) {
      markdown += `## Key Themes\n\n`;
      sentimentData.themes.forEach((theme: string) => {
        markdown += `• ${theme}\n`;
      });
      markdown += '\n';
    }

    // Response suggestions if available
    if (sentimentData.suggestions && sentimentData.suggestions.length > 0) {
      markdown += `## Suggested Responses\n\n`;
      sentimentData.suggestions.forEach((suggestion: string, index: number) => {
        markdown += `${index + 1}. ${suggestion}\n`;
      });
      markdown += '\n';
    }

    // Original text
    markdown += `## Original Text\n\n> ${text.substring(0, 300)}${text.length > 300 ? '...' : ''}\n`;

    return {
      sentiment: sentimentData.sentiment,
      confidence: sentimentData.confidence,
      text: text,
      markdown: markdown,
      chunkIndex,
      totalChunks,
      themes: sentimentData.themes,
      aspects: sentimentData.aspects,
      emotions: sentimentData.emotions,
      suggestions: sentimentData.suggestions
    };

  } catch (error) {
    console.error('Sentiment analysis failed:', error);
    throw error;
  }
}

// Add a new function to generate page summaries
async function generatePageSummary(text: string): Promise<SentimentResponse> {
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

    console.log('Generating summary for page content');
    
    const systemPrompt = `You are a content analyzer that specializes in providing in-depth summaries of web pages. 
Your task is to analyze the provided content and create a comprehensive summary that includes:

1. Main topics and themes
2. Key points and arguments
3. Overall sentiment and tone
4. Important facts or data
5. Contextual information (if detectable)

Your response should be a JSON object containing:
{
  "sentiment": "positive" | "negative" | "neutral" | "mixed",
  "confidence": number between 0 and 1,
  "summary": "A concise summary of 2-3 paragraphs",
  "keyPoints": ["List of key points/takeaways"],
  "themes": ["Main themes or topics"],
  "audiences": ["Intended audience groups"],
  "contentType": "Type of content (article, blog post, news, forum, etc.)"
}`;

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
            content: systemPrompt
          },
          {
            role: "user",
            content: `${data.instructions || "Please analyze and summarize this content:"}\n\n${text}`
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

    // Parse the response
    let summaryData;
    try {
      summaryData = JSON.parse(content);
      
      // Validate required fields
      if (!summaryData.sentiment || !summaryData.summary) {
        throw new Error('Invalid response format from API');
      }
    } catch (error) {
      console.error('Error parsing API response:', error);
      // Provide default values if parsing fails
      summaryData = {
        sentiment: 'neutral',
        confidence: 0.5,
        summary: 'The system was unable to generate a proper summary for this content.',
        keyPoints: ['Summary generation failed'],
        themes: ['Unknown'],
        audiences: ['General'],
        contentType: 'Web content'
      };
    }
    
    // Create a markdown version of the summary
    let markdown = `# Page Content Summary\n\n`;
    
    // Overall sentiment with icon
    const sentimentIcon = summaryData.sentiment === 'positive' ? '✅' :
                          summaryData.sentiment === 'negative' ? '❌' :
                          summaryData.sentiment === 'mixed' ? '🔄' : '📊';
    
    markdown += `${sentimentIcon} **Overall Sentiment: ${summaryData.sentiment}**`;
    
    if (summaryData.confidence) {
      markdown += ` (${Math.round(summaryData.confidence * 100)}% confidence)\n\n`;
    } else {
      markdown += `\n\n`;
    }
    
    // Add content type if available
    if (summaryData.contentType) {
      markdown += `**Content Type:** ${summaryData.contentType}\n\n`;
    }
    
    // Main summary
    markdown += `## Summary\n\n${summaryData.summary}\n\n`;
    
    // Key points
    if (summaryData.keyPoints && summaryData.keyPoints.length > 0) {
      markdown += `## Key Points\n\n`;
      summaryData.keyPoints.forEach((point: string) => {
        markdown += `• ${point}\n`;
      });
      markdown += '\n';
    }
    
    // Main themes
    if (summaryData.themes && summaryData.themes.length > 0) {
      markdown += `## Main Themes\n\n`;
      summaryData.themes.forEach((theme: string) => {
        markdown += `• ${theme}\n`;
      });
      markdown += '\n';
    }
    
    // Intended audience
    if (summaryData.audiences && summaryData.audiences.length > 0) {
      markdown += `## Intended Audience\n\n`;
      summaryData.audiences.forEach((audience: string) => {
        markdown += `• ${audience}\n`;
      });
      markdown += '\n';
    }

    return {
      sentiment: summaryData.sentiment,
      confidence: summaryData.confidence || 0.7,
      text: text,
      markdown: markdown,
      themes: summaryData.themes,
      summary: summaryData.summary,
      keyPoints: summaryData.keyPoints,
      contentType: summaryData.contentType
    };

  } catch (error) {
    console.error('Page summary generation failed:', error);
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