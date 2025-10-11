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

  const renderPage = async (index: number): Promise<HTMLCanvasElement> => {
    if (disposed) {
      throw new Error('PDF ドキュメントは破棄されています');
    }
    if (cache.has(index)) {
      return cache.get(index)!;
    }

    if (pending.has(index)) {
      return pending.get(index)!;
    }

    const pageNumber = index + 1;
    if (pageNumber < 1 || pageNumber > pdf.numPages) {
      throw new Error('範囲外の PDF ページを要求しました');
    }

    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('PDF ページの描画用コンテキストを取得できませんでした');
    }

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const renderPromise = (async () => {
      const renderTask = page.render({
        canvasContext: context,
        viewport
      });

      await renderTask.promise;
      page.cleanup();
      if (disposed) {
        pending.delete(index);
        throw new Error('PDF ドキュメントは破棄されています');
      }
      cache.set(index, canvas);
      pending.delete(index);
      return canvas;
    })().catch((error) => {
      pending.delete(index);
      throw error;
    });

    pending.set(index, renderPromise);
    return renderPromise;
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
    dispose,
    hasFrame: (index: number) => cache.has(index)
  };
};
