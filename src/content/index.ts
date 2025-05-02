interface SurveyResponse {
  id: number;
  text: string;
}

interface TextChunk {
  text: string;
  index: number;
}

interface MessageResponse {
  selectedText?: string;
  chunks?: TextChunk[];
  error?: string;
}

// Function to format text as markdown
function formatAsMarkdown(text: string, source: 'twitter' | 'github' | 'selection' | 'page'): string {
  switch (source) {
    case 'twitter':
      return text.split('\n\n').map(tweet => {
        const match = tweet.match(/\[(.*?)\] (.*)/);
        if (match) {
          const [_, time, content] = match;
          return `## Tweet ${time}\n\n${content}\n\n---\n`;
        }
        return `## Tweet\n\n${tweet}\n\n---\n`;
      }).join('\n');

    case 'github':
      return text.split('\n\n').map(response => {
        const idMatch = response.match(/Survey Response ID: (\d+)/);
        const feedbackMatch = response.match(/Feedback: (.*)/s);
        if (idMatch && feedbackMatch) {
          return `## Response ${idMatch[1]}\n\n${feedbackMatch[1]}\n\n---\n`;
        }
        return response;
      }).join('\n');

    case 'selection':
    case 'page':
    default:
      return `## Selected Content\n\n${text}\n\n---\n`;
  }
}

// Function to split content into manageable chunks
function splitContentIntoChunks(text: string, maxLength: number = 2000): string[] {
  const chunks: string[] = [];
  let currentChunk = '';

  // First try to split by major sections (headers)
  const sections = text.split(/(?=# |\n## |\n### )/);

  for (const section of sections) {
    // If this section would make the current chunk too long
    if (currentChunk.length + section.length > maxLength) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      
      // If the section itself is too long, split it further
      if (section.length > maxLength) {
        // Split by paragraphs first
        const paragraphs = section.split(/\n\n|\r\n\r\n/);
        for (const paragraph of paragraphs) {
          if (paragraph.length > maxLength) {
            // If paragraph is still too long, split by sentences
            const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [];
            for (const sentence of sentences) {
              if (currentChunk.length + sentence.length > maxLength) {
                chunks.push(currentChunk.trim());
                currentChunk = sentence;
              } else {
                currentChunk += (currentChunk ? ' ' : '') + sentence;
              }
            }
          } else if (currentChunk.length + paragraph.length > maxLength) {
            chunks.push(currentChunk.trim());
            currentChunk = paragraph;
          } else {
            currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
          }
        }
      } else {
        currentChunk = section;
      }
    } else {
      currentChunk += (currentChunk ? '\n' : '') + section;
    }

    // If we have a substantial chunk, add it to chunks
    if (currentChunk.length >= maxLength * 0.75) {
      chunks.push(currentChunk.trim());
      currentChunk = '';
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

// Function to get selected text
function getSelectedText(): string {
  const selection = window.getSelection();
  if (!selection) return '';
  
  // Get the full text content of each range
  let text = '';
  for (let i = 0; i < selection.rangeCount; i++) {
    const range = selection.getRangeAt(i);
    const container = document.createElement('div');
    container.appendChild(range.cloneContents());
    text += container.innerText + '\n';
  }
  
  return formatAsMarkdown(text.trim(), 'selection');
}

// Function to get Twitter content
function getTwitterContent(): string | null {
  const tweetText = document.querySelector('[data-testid="tweetText"]');
  const thread = document.querySelectorAll('[data-testid="tweet"]');
  
  if (thread.length > 0) {
    const threadContent = Array.from(thread)
      .map(tweet => {
        const text = tweet.querySelector('[data-testid="tweetText"]')?.textContent || '';
        const time = tweet.querySelector('time')?.textContent || '';
        return `[${time}] ${text}`;
      })
      .join('\n\n');
    
    return formatAsMarkdown(threadContent, 'twitter');
  }
  
  if (tweetText) {
    return formatAsMarkdown(tweetText.textContent || '', 'twitter');
  }
  
  return null;
}

// Function to get Medallia survey data
function getMedalliaSurveyData(): string | null {
  const surveyResponses: Array<{ id: number; text: string; section?: string }> = [];
  let currentSection = '';
  
  // Try to find survey response containers and sections
  const content = document.querySelector('.markdown-body, .content, article');
  if (!content) return null;

  // First pass: collect all headers and their content
  const walker = document.createTreeWalker(
    content,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as Element;
          if (element.tagName.match(/^H[1-6]$/)) {
            return NodeFilter.FILTER_ACCEPT;
          }
        } else if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_SKIP;
      }
    }
  );

  let node = walker.nextNode();
  let responseId = 1;

  while (node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      if (element.tagName.match(/^H[1-6]$/)) {
        currentSection = element.textContent?.trim() || '';
      }
    } else if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text && text.length > 10) { // Ignore very short text nodes
        surveyResponses.push({
          id: responseId++,
          text: text,
          section: currentSection
        });
      }
    }
    node = walker.nextNode();
  }

  // If no responses found through tree walking, try traditional selectors
  if (surveyResponses.length === 0) {
    const responseElements = document.querySelectorAll('.survey-response, .feedback-item, [data-survey-response], blockquote');
    responseElements.forEach((element, index) => {
      const feedbackText = element.textContent?.trim();
      if (feedbackText) {
        surveyResponses.push({
          id: index + 1,
          text: feedbackText
        });
      }
    });

    // Also look for feedback in tables
    const tables = document.querySelectorAll('table');
    tables.forEach(table => {
      const rows = table.querySelectorAll('tr');
      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 2) {
          const feedbackText = cells[1].textContent?.trim();
          if (feedbackText) {
            surveyResponses.push({
              id: responseId++,
              text: feedbackText
            });
          }
        }
      });
    });
  }
  
  if (surveyResponses.length === 0) return null;
  
  // Format the responses, preserving section structure
  let formattedContent = '';
  let currentFormattedSection = '';

  surveyResponses.forEach(response => {
    if (response.section && response.section !== currentFormattedSection) {
      currentFormattedSection = response.section;
      formattedContent += `\n# ${currentFormattedSection}\n\n`;
    }
    formattedContent += `Survey Response ID: ${response.id}\nFeedback: ${response.text}\n\n---\n\n`;
  });

  return formatAsMarkdown(formattedContent.trim(), 'github');
}

// Function to get page content
function getPageContent(): string {
  // Check if we're on GitHub and looking at Medallia survey data
  if (window.location.hostname.includes('github.com')) {
    const medalliaData = getMedalliaSurveyData();
    if (medalliaData) {
      return medalliaData;
    }
  }

  // Check if we're on Twitter
  if (window.location.hostname.includes('twitter.com')) {
    const tweetData = getTwitterContent();
    if (tweetData) {
      return tweetData;
    }
  }
  
  // Get main content areas
  const mainContent = document.querySelector('main, article, .content, #content, .main-content');
  if (mainContent) {
    return formatAsMarkdown(mainContent.textContent?.trim() || '', 'page');
  }
  
  // Fallback to body content
  return formatAsMarkdown(document.body.textContent?.trim() || '', 'page');
}

// Set up message listeners immediately
chrome.runtime.onMessage.addListener((request, _sender: chrome.runtime.MessageSender, sendResponse) => {
  try {
    if (request.action === "ping") {
      sendResponse({ status: "ok" });
      return true;
    }
    
    if (request.action === "getSelectedText") {
      const text = getSelectedText();
      sendResponse({ selectedText: text });
      return true;
    }

    if (request.action === "getPageContent") {
      const content = getPageContent();
      sendResponse({ content });
      return true;
    }

    if (request.action === "analyzePage") {
      const text = getPageContent();
      const chunks = splitContentIntoChunks(text);
      sendResponse({ chunks: chunks.map((text, index) => ({ text, index })) });
      return true;
    }
  } catch (err) {
    const error = err as Error;
    sendResponse({ error: error.message });
    return true;
  }
});

// Track connection state
let isConnecting = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 32000;

// Connect to the background page
function connectToBackground() {
  // Don't try to connect if already connecting or max attempts reached
  if (isConnecting || reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    return null;
  }

  try {
    isConnecting = true;
    const port = chrome.runtime.connect({ name: "content-script" });
    
    // Reset reconnection state on successful connection
    isConnecting = false;
    reconnectAttempts = 0;
    
    // Set up reconnection logic if the connection fails
    port.onDisconnect.addListener(() => {
      const error = chrome.runtime.lastError;
      isConnecting = false;
      
      // Only attempt reconnection if:
      // 1. We haven't exceeded max attempts
      // 2. The extension is still active (no lastError indicating otherwise)
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS && !error?.message?.includes('Extension context invalidated')) {
        console.log(`Disconnected from background. Attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS}`);
        
        // Calculate delay with exponential backoff
        const delay = Math.min(INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
        reconnectAttempts++;
        
        setTimeout(connectToBackground, delay);
      } else {
        console.log('Maximum reconnection attempts reached or extension inactive. Stopping reconnection attempts.');
      }
    });
    
    console.log('Content script connected to background');
    return port;
  } catch (error) {
    console.error('Failed to connect to background:', error);
    isConnecting = false;
    
    // Only retry if we haven't exceeded max attempts
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      const delay = Math.min(INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
      reconnectAttempts++;
      setTimeout(connectToBackground, delay);
    }
    return null;
  }
}

// Initialize connection
connectToBackground();

// Notify that content script is ready
chrome.runtime.sendMessage({ action: "contentScriptReady" }); 