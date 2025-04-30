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
function splitContentIntoChunks(text: string, maxLength: number = 4000): string[] {
  const chunks: string[] = [];
  let currentChunk = '';

  // Split by natural breaks first (paragraphs, tweets, responses)
  const sections = text.split(/(?:\n\n|\r\n\r\n|---\n)/);

  for (const section of sections) {
    if (currentChunk.length + section.length > maxLength) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      
      // If a single section is longer than maxLength, split by sentences
      if (section.length > maxLength) {
        const sentences = section.match(/[^.!?]+[.!?]+/g) || [];
        for (const sentence of sentences) {
          if (currentChunk.length + sentence.length > maxLength) {
            chunks.push(currentChunk.trim());
            currentChunk = sentence;
          } else {
            currentChunk += (currentChunk ? ' ' : '') + sentence;
          }
        }
      } else {
        currentChunk = section;
      }
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + section;
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
  const surveyResponses: Array<{ id: number; text: string }> = [];
  
  // Try to find survey response containers
  const responseElements = document.querySelectorAll('.survey-response, .feedback-item, [data-survey-response], .markdown-body');
  
  if (responseElements.length > 0) {
    responseElements.forEach((element, index) => {
      const feedbackText = element.textContent?.trim();
      if (feedbackText) {
        surveyResponses.push({
          id: index + 1,
          text: feedbackText
        });
      }
    });
  }
  
  // If no specific elements found, try to find feedback in tables or lists
  if (surveyResponses.length === 0) {
    const tables = document.querySelectorAll('table');
    tables.forEach(table => {
      const rows = table.querySelectorAll('tr');
      rows.forEach((row, index) => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 2) { // Assuming feedback is in the second column
          const feedbackText = cells[1].textContent?.trim();
          if (feedbackText) {
            surveyResponses.push({
              id: index + 1,
              text: feedbackText
            });
          }
        }
      });
    });
  }
  
  if (surveyResponses.length === 0) return null;
  
  // Format the responses
  const formattedContent = surveyResponses
    .map(response => `Survey Response ID: ${response.id}\nFeedback: ${response.text}`)
    .join('\n\n');

  return formatAsMarkdown(formattedContent, 'github');
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

// Connect to the background page
function connectToBackground() {
  try {
    const port = chrome.runtime.connect({ name: "content-script" });
    
    // Set up reconnection logic if the connection fails
    port.onDisconnect.addListener(() => {
      console.log('Disconnected from background. Attempting to reconnect...');
      setTimeout(connectToBackground, 1000);
    });
    
    console.log('Content script connected to background');
    return port;
  } catch (error) {
    console.error('Failed to connect to background:', error);
    setTimeout(connectToBackground, 1000);
    return null;
  }
}

// Initialize connection
connectToBackground();

// Notify that content script is ready
chrome.runtime.sendMessage({ action: "contentScriptReady" }); 