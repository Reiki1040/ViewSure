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

export const renderPdfDocumentToCanvases = async (data: ArrayBuffer, scale = 1.5): Promise<HTMLCanvasElement[]> => {
  const pdfjs = await loadPdfModule();
  const loadingTask = pdfjs.getDocument({ data });

  const pdf = await loadingTask.promise;
  try {
    const canvases: HTMLCanvasElement[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('PDF ページの描画用コンテキストを取得できませんでした');
      }

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const renderTask = page.render({
        canvasContext: context,
        viewport
      });

      await renderTask.promise;
      page.cleanup();
      canvases.push(canvas);
    }

    if (canvases.length === 0) {
      throw new Error('PDF 内にプレビュー可能なページが見つかりませんでした');
    }

    return canvases;
  } finally {
    loadingTask.destroy();
    pdf.cleanup();
    pdf.destroy();
  }
};
