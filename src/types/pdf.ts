/**
 * PDF-related type definitions for ViewSure
 */

export interface PdfPageTextRun {
  text: string;
  fontSize: number;
  originalFontSize: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PdfPageTextContent {
  width: number;
  height: number;
  runs: PdfPageTextRun[];
}

export interface PdfRenderer {
  pageCount: number;
  getPageCanvas: (index: number) => Promise<HTMLCanvasElement>;
  getPageTextContent: (index: number) => Promise<PdfPageTextContent>;
  dispose: () => void;
  hasFrame: (index: number) => boolean;
}

export interface PdfRenderOptions {
  scale?: number;
  quality?: number;
}

export interface PdfDocumentInfo {
  pageCount: number;
  title?: string;
  author?: string;
  subject?: string;
}

export type PdfLoadingState = 'idle' | 'loading' | 'loaded' | 'error';

export interface PdfError extends Error {
  code?: string;
  pageNumber?: number;
  isPdfError: true;
}

export const createPdfError = (message: string, code?: string, pageNumber?: number): PdfError => ({
  name: 'PdfError',
  message,
  code,
  pageNumber,
  isPdfError: true,
});

export const PDF_ERROR_CODES = {
  INVALID_FILE: 'INVALID_FILE',
  LOAD_FAILED: 'LOAD_FAILED',
  RENDER_FAILED: 'RENDER_FAILED',
  PAGE_OUT_OF_RANGE: 'PAGE_OUT_OF_RANGE',
  DISPOSED: 'DISPOSED',
  INVALID_CONTEXT: 'INVALID_CONTEXT',
} as const;