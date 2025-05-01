# ContentAnalyzer Chrome Extension

A Chrome extension for processing and analyzing government forms of any type. The extension extracts form data from PDFs, converts it to a structured digital format, and displays it in a user-friendly interface with modern UI components.

## Features

- Extract form data from any PDF forms without hardcoded templates
- Process multi-page PDF documents with consistent results
- Display form data in a large, responsive viewer window
- Support for complex nested objects and field types
- Save, edit, print, and export form data
- AI-powered field recognition and categorization

## Architecture

The ContentAnalyzer implements a sophisticated multi-agent architecture for form processing, consisting of specialized agents that work together in a pipeline:

### Multi-Agent Form Processing Architecture

1. **Parsing Agent**
   - Specialized in OCR and text extraction from forms
   - Understands document structure and layout
   - Identifies form fields, labels, and values with high accuracy
   - Processes multi-page documents and complex layouts

2. **Builder Agent**
   - Transforms raw extracted data into structured form objects
   - Validates field values against expected formats
   - Resolves ambiguities in field identification
   - Groups related fields into logical sections

3. **Designer Agent**
   - Creates user-friendly form layouts from structured data
   - Implements multi-step navigation for complex forms
   - Optimizes field arrangement for better usability
   - Applies appropriate UI components for different field types

4. **QA Agent**
   - Verifies extraction accuracy and completeness
   - Identifies potentially missing required fields
   - Checks for inconsistencies in the extracted data
   - Provides confidence scores for the overall form processing

This modular approach provides several benefits:
- Each agent can be improved independently
- Specialized AI models can be used for specific tasks
- New form types can be supported without modifying the entire system
- QA validation ensures accuracy and completeness

## Usage

### Processing Forms

1. Click the ContentAnalyzer extension icon in Chrome
2. Upload a PDF form document
3. The extension will automatically:
   - Process all pages in the document
   - Extract form fields and their values
   - Categorize fields into logical sections
   - Present the form in a user-friendly layout

### Form Viewer Features

- **Search**: Find specific fields quickly with the search function
- **Zoom Controls**: Adjust text size for better readability
- **Edit Mode**: Make changes to extracted form data
- **Print/Export**: Print or export the processed form
- **Field Navigation**: Easily navigate between form sections

### Working with Complex Fields

The system handles various field types with specialized UI components:

- **Text Fields**: Standard input fields for text
- **Date Fields**: Calendar-based date pickers
- **Checkboxes/Radios**: Toggle fields for boolean values
- **Select Fields**: Dropdown menus for option selection
- **Complex Objects**: Expandable objects with multiple properties
- **Arrays**: List-based fields with add/remove functionality

## Installation

1. Clone the repository
2. Install dependencies with `npm install`
3. Build the extension with `npm run build`
4. Load the extension in Chrome from the `dist` directory

## Development

### Setup

```bash
npm install
npm run dev
```

### Build

```bash
npm run build
```

### Using the Multi-Agent System in Code

To process forms programmatically:

```typescript
import { createFormProcessingPipeline } from './src/lib/agents';

// Create the pipeline
const pipeline = createFormProcessingPipeline();

// Process a form with PDF pages
const processForm = async (pdfPages) => {
  const result = await pipeline.processForm(pdfPages, {
    formNumber: 'FORM-1234', // Optional
    formTitle: 'Sample Form', // Optional
  });
  
  // Access the processed form data
  console.log(result.formData);
  
  // Check processing confidence
  console.log(`Confidence: ${result.confidence}`);
  
  // View any issues found during processing
  console.log(result.issues);
};

// Or run a specific stage of the pipeline
const runParserOnly = async (pdfPages) => {
  const parserResult = await pipeline.runStage('parser', {
    pages: pdfPages,
    mode: 'detailed'
  });
  
  console.log(parserResult);
};
```

### Technologies

- React
- TypeScript
- Vite
- PDF.js
- OpenAI API
- Tailwind CSS
- shadcn/ui components

## License

[MIT License](LICENSE) 