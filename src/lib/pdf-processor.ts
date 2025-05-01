// Use types only in the import
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

// We'll initialize this when needed
let pdfjs: typeof import('pdfjs-dist') | null = null;

export interface PDFPage {
  pageNumber: number;
  imageData: string;
  width: number;
  height: number;
}

export class PDFProcessor {
  /**
   * Initializes PDF.js library
   */
  private async initPDFJS(): Promise<typeof import('pdfjs-dist')> {
    if (!pdfjs) {
      // Dynamically import the library
      pdfjs = await import('pdfjs-dist');
      // Properly set the worker source for Chrome extension environment
      pdfjs.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.js');
    }
    return pdfjs;
  }

  /**
   * Convert a PDF page to an image
   */
  private async convertPageToImage(page: PDFPageProxy, scale = 2): Promise<PDFPage> {
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Could not get canvas context');
    }

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({
      canvasContext: context,
      viewport,
    }).promise;

    return {
      pageNumber: page.pageNumber,
      imageData: canvas.toDataURL('image/png'),
      width: viewport.width,
      height: viewport.height,
    };
  }

  /**
   * Process a PDF file and convert its pages to images
   */
  async processPDF(pdfData: ArrayBuffer): Promise<PDFPage[]> {
    try {
      console.log('Starting PDF processing with PDF.js');
      
      // Initialize PDF.js
      const pdfjsLib = await this.initPDFJS();
      
      // Set a timeout to avoid UI freezing
      const pdf = await Promise.race([
        pdfjsLib.getDocument({ data: pdfData }).promise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('PDF processing timed out')), 30000)
        )
      ]) as PDFDocumentProxy;
      
      console.log(`PDF loaded successfully with ${pdf.numPages} pages`);
      const pages: PDFPage[] = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const pageImage = await this.convertPageToImage(page);
        pages.push(pageImage);
      }

      return pages;
    } catch (error) {
      console.error("PDF processing error:", error);
      // Re-throw the error for the caller to handle
      throw error;
    }
  }

  /**
   * Extract form fields from a PDF
   */
  async extractFormFields(pdfData: ArrayBuffer): Promise<any> {
    try {
      // Dynamically import pdf-lib only when needed
      const { PDFDocument } = await import('pdf-lib');
      
      const pdfDoc = await PDFDocument.load(pdfData);
      const form = pdfDoc.getForm();
      const fields = form.getFields();
      
      return fields.map(field => ({
        name: field.getName(),
        type: field.constructor.name,
        isRequired: false, // You might want to implement logic to determine if a field is required
      }));
    } catch (error) {
      console.error("Form field extraction error:", error);
      // Return empty fields array rather than failing completely
      return [];
    }
  }
} 