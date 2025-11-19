import { PdfPageTextRun, PdfPageTextContent } from '../types/pdf';

let pdfModulePromise: Promise<typeof import('pdfjs-dist/legacy/build/pdf.js')> | null = null;
let workerConfigured = false;

const loadPdfModule = async () => {
  if (!pdfModulePromise) {
    pdfModulePromise = import('pdfjs-dist/legacy/build/pdf.js');
  }

  const pdfModule = await pdfModulePromise;
  if (!workerConfigured) {
    const workerSrcModule = await import('pdfjs-dist/legacy/build/pdf.worker.min.js?url');
    pdfModule.GlobalWorkerOptions.workerSrc = workerSrcModule.default;
    workerConfigured = true;
  }

  return pdfModule;
};

export const createPdfRenderer = async (data: ArrayBuffer, scale = 1.5) => {
  const pdfjs = await loadPdfModule();
  const loadingTask = pdfjs.getDocument({ data });
  const pdf = await loadingTask.promise;
  const cache = new Map<number, HTMLCanvasElement>();
  const pending = new Map<number, Promise<HTMLCanvasElement>>();
  let disposed = false;

  const ensurePageNumber = (index: number) => {
    if (disposed) {
      throw new Error('PDF ドキュメントは破棄されています');
    }
    const pageNumber = index + 1;
    if (pageNumber < 1 || pageNumber > pdf.numPages) {
      throw new Error('範囲外の PDF ページを要求しました');
    }
    return pageNumber;
  };

  const renderPage = async (index: number): Promise<HTMLCanvasElement> => {
    // メモ化: キャッシュチェック
    if (cache.has(index)) {
      return cache.get(index)!;
    }

    // メモ化: 進行中のリクエストチェック
    if (pending.has(index)) {
      return pending.get(index)!;
    }

    const pageNumber = ensurePageNumber(index);

    // 非同期レンダリングプロセス
    const renderPromise = (async () => {
      try {
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale });
        
        // キャンバス作成の最適化
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d', {
          alpha: false, // パフォーマンス向上のためアルファチャンネルを無効化
          willReadFrequently: false // 読み取り頻度が低いことを明示
        });

        if (!context) {
          throw new Error('PDF ページの描画用コンテキストを取得できませんでした');
        }

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        // レンダリング前にdisposed状態をチェック
        if (disposed) {
          throw new Error('PDF ドキュメントは破棄されています');
        }

        const renderTask = page.render({
          canvasContext: context,
          viewport
        });

        await renderTask.promise;
        
        // メモリ管理: ページリソースのクリーンアップ
        page.cleanup();

        // レンダリング完了後にdisposed状態を再チェック
        if (disposed) {
          throw new Error('PDF ドキュメントは破棄されています');
        }

        // キャッシュに保存
        cache.set(index, canvas);
        return canvas;
      } catch (error) {
        // エラー発生時は確実にpendingから削除
        throw error;
      } finally {
        // 確実にpendingから削除（成功・失敗問わず）
        pending.delete(index);
      }
    })();

    pending.set(index, renderPromise);
    return renderPromise;
  };

  const getPageTextContent = async (index: number): Promise<PdfPageTextContent> => {
    const pageNumber = ensurePageNumber(index);
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const textContent = await page.getTextContent();
    const runs: PdfPageTextRun[] = [];

    textContent.items.forEach((item) => {
      if (!('str' in item) || !item.str.trim()) {
        return;
      }
      const transform = item.transform;
      const fontSize = Math.hypot(transform[0], transform[1]);
      const x = transform[4];
      const y = transform[5];
      const width = item.width ?? fontSize * (item.str.length / 2);
      const height = item.height ?? fontSize;

      runs.push({
        text: item.str,
        fontSize,
        x,
        y: viewport.height - y - height,
        width,
        height
      });
    });

    page.cleanup();

    return {
      width: viewport.width,
      height: viewport.height,
      runs
    };
  };

  const dispose = () => {
    if (disposed) {
      return;
    }
    disposed = true;
    cache.clear();
    pending.clear();
    loadingTask.destroy();
    pdf.cleanup();
    pdf.destroy();
  };

  return {
    pageCount: pdf.numPages,
    getPageCanvas: renderPage,
    getPageTextContent,
    dispose,
    hasFrame: (index: number) => cache.has(index)
  };
};
