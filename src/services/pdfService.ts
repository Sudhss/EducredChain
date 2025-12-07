// src/services/pdfService.ts
import * as pdfjsLib from 'pdfjs-dist';
import { TextItem } from 'pdfjs-dist/types/src/display/api';

// Set worker path for pdf.js
const pdfjsWorker = await import('pdfjs-dist/build/pdf.worker.entry');
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * Parse a PDF file and extract its text content
 * 
 * @param file PDF file to parse
 * @returns Extracted text content
 */
export const parsePDF = async (file: File): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument(arrayBuffer);
    const pdf = await loadingTask.promise;
    
    let fullText = '';
    
    // Extract text from each page
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .filter(item => 'str' in item)
        .map(item => (item as TextItem).str)
        .join(' ');
      
      fullText += pageText + '\n\n';
    }
    
    return fullText.trim();
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw new Error('Failed to parse PDF. Please ensure the file is valid and not password protected.');
  }
};

/**
 * Generate a preview image of the first page of a PDF
 * 
 * @param file PDF file
 * @returns Data URL of the preview image
 */
export const generatePDFPreview = async (file: File): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument(arrayBuffer);
    const pdf = await loadingTask.promise;
    
    // Get the first page
    const page = await pdf.getPage(1);
    
    // Set scale for better quality
    const viewport = page.getViewport({ scale: 1.5 });
    
    // Create canvas for rendering
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) {
      throw new Error('Could not create canvas context');
    }
    
    // Set canvas dimensions
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    // Render PDF page to canvas
    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;
    
    // Return data URL
    return canvas.toDataURL('image/jpeg', 0.8);
  } catch (error) {
    console.error('Error generating PDF preview:', error);
    throw new Error('Failed to generate PDF preview');
  }
};