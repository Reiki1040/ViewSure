import { useCallback, useRef, useState } from 'react';
import { createPdfRenderer } from '../utils/pdf';

type PdfRenderer = Awaited<ReturnType<typeof createPdfRenderer>>;

interface UsePdfRendererReturn {
  renderer: PdfRenderer | null;
  pageCount: number;
  isLoading: boolean;
  error: string | null;
  loadPdf: (file: File) => Promise<void>;
  dispose: () => void;
}

/**
 * PDFレンダリングの状態管理と操作を提供するカスタムフック
 */
export const usePdfRenderer = (): UsePdfRendererReturn => {
  const rendererRef = useRef<PdfRenderer | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPdf = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('PDF 形式のみ対応しています');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 既存のレンダラーを破棄
      rendererRef.current?.dispose?.();
      rendererRef.current = null;

      const buffer = await file.arrayBuffer();
      const renderer = await createPdfRenderer(buffer, 1.5);
      rendererRef.current = renderer;

      setPageCount(renderer.pageCount);
    } catch (err) {
      console.error('PDF読み込みエラー:', err);
      setError('PDF の読み込みに失敗しました');
      setPageCount(0);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const dispose = useCallback(() => {
    rendererRef.current?.dispose?.();
    rendererRef.current = null;
    setPageCount(0);
    setError(null);
  }, []);

  return {
    renderer: rendererRef.current,
    pageCount,
    isLoading,
    error,
    loadPdf,
    dispose,
  };
};