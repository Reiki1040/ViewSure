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

export type PdfPageTextRun = {
  text: string;
  fontSize: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PdfPageTextContent = {
  width: number;
  height: number;
  runs: PdfPageTextRun[];
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
    if (cache.has(index)) {
      return cache.get(index)!;
    }

    if (pending.has(index)) {
      return pending.get(index)!;
    }

    const pageNumber = ensurePageNumber(index);

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
