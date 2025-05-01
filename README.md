# Content Analyzer Chrome Extension

A powerful Chrome extension for analyzing content, processing government forms, and performing web searches.

## Features

### Document Processing

The Content Analyzer can process various government forms from agencies like VA, IRS, SSA, DMV, and more:

- Upload PDF or image files of government forms
- Automatically extract form fields, texts, and checkboxes
- Process multi-page documents with merged results
- View processed forms in a dedicated window with enhanced UI
- Edit, save, print, and download processed form data

### Form Viewer

The enhanced Form Viewer provides a larger, more functional interface for working with processed forms:

- Responsive design that adapts to different window sizes
- Search functionality to find specific fields
- Zoom controls to adjust text size for better readability
- Field categorization by section
- Copy individual field values with one click
- Print-optimized view with multi-column layout
- Save and download functionality for processed forms

### Additional Tools

- Sentiment analysis for text selection
- Web search capabilities

## Development

### Prerequisites

- Node.js 18 or higher
- npm or yarn

### Setup

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Build the extension:
   ```
   npm run build
   ```
4. Load the unpacked extension from the `dist` folder in Chrome

### Development Commands

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build production version

## Technology Stack

- React
- TypeScript
- Tailwind CSS
- Vite
- OpenAI API for AI processing

## Configuration

The extension requires an OpenAI API key for form processing and sentiment analysis. Configure this in the extension settings after installation.

## License

MIT License 