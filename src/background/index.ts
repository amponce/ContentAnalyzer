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
    analyzeSentiment(request.text, request.chunkIndex, request.totalChunks)
      .then(result => {
        // Send response to whoever requested it
        sendResponse(result);
        
        // Also broadcast to popup if request came from content script
        if (sender.tab) {
          chrome.runtime.sendMessage({
            type: 'analysisResult',
            data: {
              ...result,
              text: request.text,
              chunkIndex: request.chunkIndex,
              totalChunks: request.totalChunks
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
          chunkIndex: request.chunkIndex,
          totalChunks: request.totalChunks
        };
        sendResponse(errorResponse);
        
        // Also broadcast error to popup if request came from content script
        if (sender.tab) {
          chrome.runtime.sendMessage({
            type: 'analysisError',
            error: error instanceof Error ? error.message : 'Analysis failed',
            chunkIndex: request.chunkIndex,
            totalChunks: request.totalChunks
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
async function analyzeSentiment(text: string, chunkIndex?: number, totalChunks?: number): Promise<SentimentResponse> {
  try {
    const data = await chrome.storage.sync.get(["apiKey", "instructions"]);
    
    if (!data.apiKey) {
      throw new Error("API key not found. Please configure your settings.");
    }

    // Initialize API client if needed
    if (!apiClient) {
      apiClient = new APIClient(data.apiKey);
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
            content: `You are a sophisticated sentiment analyzer for user feedback and reports. Your task is to analyze structured content, including surveys, reports, and user feedback.

For each section and comment you identify, extract:
1. The sentiment (positive, negative, or neutral)
2. A confidence score (0-1)
3. The key themes or topics mentioned
4. Short summary of the main point
5. Any specific issues or suggestions mentioned

When analyzing structured documents:
- Preserve the document's structure in your analysis
- Analyze both individual comments and section-level sentiment
- Consider the context of each section when analyzing comments within it
- Look for patterns and trends across similar comments
- Identify actionable feedback and recurring issues
- Pay attention to quantitative data (ratings, scores) when present

Your response should be a JSON object containing:
{
  "overallSentiment": "positive|negative|neutral",
  "overallConfidence": 0.XX,
  "mainThemes": ["theme1", "theme2", "..."],
  "sections": [
    {
      "title": "section name",
      "sentiment": "positive|negative|neutral",
      "confidence": 0.XX,
      "themes": ["theme1", "theme2"],
      "summary": "section summary"
    }
  ],
  "commentAnalysis": [
    {
      "text": "extracted comment text",
      "section": "parent section name",
      "sentiment": "positive|negative|neutral",
      "confidence": 0.XX,
      "themes": ["theme1", "theme2"],
      "summary": "brief summary of point",
      "issues": ["specific issue1", "specific issue2"],
      "suggestions": ["suggestion1", "suggestion2"]
    }
  ]
}`
          },
          {
            role: "user",
            content: `${data.instructions || "Please analyze the sentiment of this report, identifying individual comments and their sentiment."}\n\n${text}`
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
    const sentimentData = JSON.parse(content);
    
    // Create a markdown summary of the analysis
    let markdown = `# Sentiment Analysis Report\n\n`;
    
    // Overall sentiment with icon
    const sentimentIcon = sentimentData.overallSentiment === 'positive' ? '✅' :
                         sentimentData.overallSentiment === 'negative' ? '❌' : '📊';
    markdown += `${sentimentIcon} **Overall: ${sentimentData.overallSentiment}** (${Math.round(sentimentData.overallConfidence * 100)}% confidence)\n\n`;
    
    if (chunkIndex !== undefined && totalChunks !== undefined) {
      markdown += `> Analyzing chunk ${chunkIndex + 1} of ${totalChunks}\n\n`;
    }

    // Main themes in a bulleted list
    if (sentimentData.mainThemes && sentimentData.mainThemes.length > 0) {
      markdown += `## Key Themes\n\n`;
      sentimentData.mainThemes.forEach((theme: string) => {
        markdown += `• ${theme}\n`;
      });
      markdown += '\n';
    }
    
    // Section analysis in cards
    if (sentimentData.sections && sentimentData.sections.length > 0) {
      markdown += `## Section Analysis\n\n`;
      sentimentData.sections.forEach((section: any) => {
        const sectionIcon = section.sentiment === 'positive' ? '✅' :
                          section.sentiment === 'negative' ? '❌' : '📊';
        markdown += `### ${section.title}\n\n`;
        markdown += `${sectionIcon} **Sentiment**: ${section.sentiment} (${Math.round(section.confidence * 100)}% confidence)\n\n`;
        if (section.summary) {
          markdown += `**Summary**: ${section.summary}\n\n`;
        }
        if (section.themes && section.themes.length > 0) {
          markdown += `**Themes**: ${section.themes.join(', ')}\n\n`;
        }
        markdown += '---\n\n';
      });
    }
    
    // Individual comment analysis
    if (sentimentData.commentAnalysis && sentimentData.commentAnalysis.length > 0) {
      markdown += `## Comment Analysis\n\n`;
      sentimentData.commentAnalysis.forEach((comment: any, index: number) => {
        const commentIcon = comment.sentiment === 'positive' ? '✅' :
                          comment.sentiment === 'negative' ? '❌' : '📊';
        markdown += `### Comment ${index + 1}\n\n`;
        markdown += `${commentIcon} **Sentiment**: ${comment.sentiment} (${Math.round(comment.confidence * 100)}% confidence)\n\n`;
        
        if (comment.section) {
          markdown += `**Section**: ${comment.section}\n\n`;
        }
        
        if (comment.themes && comment.themes.length > 0) {
          markdown += `**Themes**: ${comment.themes.join(', ')}\n\n`;
        }
        
        if (comment.summary) {
          markdown += `**Summary**: ${comment.summary}\n\n`;
        }
        
        if (comment.issues && comment.issues.length > 0) {
          markdown += `**Issues Identified**:\n`;
          comment.issues.forEach((issue: string) => {
            markdown += `• ${issue}\n`;
          });
          markdown += '\n';
        }
        
        if (comment.suggestions && comment.suggestions.length > 0) {
          markdown += `**Suggestions**:\n`;
          comment.suggestions.forEach((suggestion: string) => {
            markdown += `• ${suggestion}\n`;
          });
          markdown += '\n';
        }
        
        markdown += `**Text**:\n> ${comment.text}\n\n---\n\n`;
      });
    }

    return {
      sentiment: sentimentData.overallSentiment,
      confidence: sentimentData.overallConfidence,
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