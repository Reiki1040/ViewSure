import { useCallback, useRef, useState } from 'react';
import { createPdfRenderer } from '../utils/pdf';

type PdfRenderer = Awaited<ReturnType<typeof createPdfRenderer>>;

interface UsePdfRendererReturn {
  renderer: PdfRenderer | null;
  getRenderer: () => PdfRenderer | null;
  pageCount: number;
  isLoading: boolean;
  error: string | null;
  loadPdf: (file: File) => Promise<void>;
  loadPdfFromArrayBuffer: (buffer: ArrayBuffer) => Promise<void>;
  getSourceBuffer: () => ArrayBuffer | null;
  dispose: () => void;
}

/**
 * PDFレンダリングの状態管理と操作を提供するカスタムフック
 * 
 * pdfjs-dist を使用したレンダラーインスタンスの生成、保持、破棄を管理する。
 * メモリリークを防ぐための dispose 機構や、ローディング状態の管理も行う。
 */
export const usePdfRenderer = (): UsePdfRendererReturn => {
  const rendererRef = useRef<PdfRenderer | null>(null);
  const sourceBufferRef = useRef<ArrayBuffer | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * ArrayBuffer から PDF を読み込む
   */
  const loadPdfFromArrayBuffer = useCallback(async (buffer: ArrayBuffer) => {
    setIsLoading(true);
    setError(null);
    try {
      // 既存のリソースがあれば解放
      rendererRef.current?.dispose?.();
      rendererRef.current = null;
      
      sourceBufferRef.current = buffer;
      
      // レンダラーの生成 (スケールは1.5倍で固定)
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

  /**
   * File オブジェクトから PDF を読み込む
   */
  const loadPdf = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        setError('PDF 形式のみ対応しています');
        return;
      }
      const buffer = await file.arrayBuffer();
      await loadPdfFromArrayBuffer(buffer);
    },
    [loadPdfFromArrayBuffer]
  );

  /**
   * リソースを解放し、状態をリセットする
   */
  const dispose = useCallback(() => {
    rendererRef.current?.dispose?.();
    rendererRef.current = null;
    setPageCount(0);
    setError(null);
    sourceBufferRef.current = null;
  }, []);

  const getRenderer = useCallback(() => rendererRef.current, []);
  const getSourceBuffer = useCallback(() => sourceBufferRef.current, []);

  return {
    renderer: rendererRef.current,
    getRenderer,
    pageCount,
    isLoading,
    error,
    loadPdf,
    loadPdfFromArrayBuffer,
    getSourceBuffer,
    dispose,
  };
};