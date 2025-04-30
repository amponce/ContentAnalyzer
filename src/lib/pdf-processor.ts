import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

export interface PDFPage {
  pageNumber: number;
  imageData: string;
  width: number;
  height: number;
}

export class PDFProcessor {
  /**
   * Convert a PDF page to an image
   */
  private async convertPageToImage(page: pdfjsLib.PDFPageProxy, scale = 2): Promise<PDFPage> {
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
    const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
    const pages: PDFPage[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const pageImage = await this.convertPageToImage(page);
      pages.push(pageImage);
    }

    return pages;
  }

  /**
   * Extract form fields from a PDF
   */
  async extractFormFields(pdfData: ArrayBuffer): Promise<any> {
    const pdfDoc = await PDFDocument.load(pdfData);
    const form = pdfDoc.getForm();
    const fields = form.getFields();
    
    return fields.map(field => ({
      name: field.getName(),
      type: field.constructor.name,
      isRequired: false, // You might want to implement logic to determine if a field is required
    }));
  }
} 