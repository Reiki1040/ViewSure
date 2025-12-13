import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

export type ImageCrop = {
  id: string;
  canvas: HTMLCanvasElement;
  x: number;
  y: number;
  width: number;
  height: number;
};

type LoadResult = {
  pdf: PDFDocumentProxy;
  release: () => void;
};

// pdf.js を動的に読み込み、worker を設定した上で PDF ドキュメントを開く
const loadPdf = async (buffer: ArrayBuffer): Promise<LoadResult> => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.js');
  const workerSrcModule = await import('pdfjs-dist/legacy/build/pdf.worker.min.js?url');
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrcModule.default;
  const loadingTask = pdfjs.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;
  return {
    pdf,
    release: () => loadingTask.destroy()
  };
};

const applyMatrix = (m: number[], x: number, y: number) => ({
  x: m[0] * x + m[2] * y + m[4],
  y: m[1] * x + m[3] * y + m[5]
});

const rectFromCTM = (matrix: number[], width: number, height: number) => {
  const points = [
    applyMatrix(matrix, 0, 0),
    applyMatrix(matrix, width, 0),
    applyMatrix(matrix, 0, height),
    applyMatrix(matrix, width, height)
  ];
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
};

const overlapArea = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) => {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  const w = x2 - x1;
  const h = y2 - y1;
  if (w <= 0 || h <= 0) return 0;
  return w * h;
};

const getTextBoxes = async (page: PDFPageProxy, viewport: any) => {
  const content = await page.getTextContent();
  return content.items
    .map((item) => {
      if (!('str' in item)) return null;
      const t = item.transform;
      const fontSize = Math.hypot(t[0], t[1]);
      const x = t[4];
      const y = t[5];
      const width = item.width ?? fontSize * Math.max(item.str.length / 2, 1);
      const height = item.height ?? fontSize;
      return {
        x,
        y: viewport.height - y - height,
        width,
        height
      };
    })
    .filter((b): b is { x: number; y: number; width: number; height: number } => Boolean(b));
};

const isLargeBackground = (rect: { width: number; height: number }, pageWidth: number, pageHeight: number) => {
  const area = rect.width * rect.height;
  const total = pageWidth * pageHeight;
  return area > total * 0.6;
};

const isTooSmall = (rect: { width: number; height: number }, pageWidth: number, pageHeight: number) => {
  const area = rect.width * rect.height;
  const total = pageWidth * pageHeight;
  return area < total * 0.02 || rect.width < 24 || rect.height < 24;
};

const extractByOperators = async (page: PDFPageProxy, scale: number, textBoxes: { x: number; y: number; width: number; height: number }[]) => {
  const { OPS, Util } = await import('pdfjs-dist/legacy/build/pdf.js');
  const viewport = page.getViewport({ scale });
  const opList = await page.getOperatorList();
  const stack: number[][] = [viewport.transform];
  const regions: Array<{ id: string; rect: { x: number; y: number; width: number; height: number } }> = [];

  for (let i = 0; i < opList.fnArray.length; i += 1) {
    const fn = opList.fnArray[i];
    const args = opList.argsArray[i];

    if (fn === OPS.save) {
      stack.push([...stack[stack.length - 1]]);
      continue;
    }
    if (fn === OPS.restore) {
      stack.pop();
      continue;
    }
    if (fn === OPS.transform) {
      const current = stack.pop() ?? viewport.transform;
      stack.push(Util.transform(current, args as number[]));
      continue;
    }
    const isImagePaint =
      fn === OPS.paintImageXObject ||
      fn === OPS.paintInlineImageXObject ||
      fn === OPS.paintImageXObjectRepeat ||
      fn === OPS.paintJpegXObject;
    if (isImagePaint) {
      const imageId = (args as Array<string | number>)[0];
      const image = page.objs.get(imageId as string) as { width: number; height: number } | undefined;
      if (!image) continue;
      const ctm = stack[stack.length - 1] ?? viewport.transform;
      const rect = rectFromCTM(ctm, image.width, image.height);
      const overlap = textBoxes.reduce((acc, box) => acc + overlapArea(rect, box), 0);
      const ratio = overlap / Math.max(rect.width * rect.height, 1);
      if (ratio > 0.05) continue;
      regions.push({ id: String(imageId), rect });
    }
  }

  return { regions, viewport };
};

const extractImagesFromPage = async (page: PDFPageProxy, scale = 2): Promise<ImageCrop[]> => {
  const viewport = page.getViewport({ scale });
  const textBoxes = await getTextBoxes(page, viewport);
  const op = await extractByOperators(page, scale, textBoxes);

  if (op.regions.length === 0) {
    return [];
  }

  const pageCanvas = document.createElement('canvas');
  pageCanvas.width = viewport.width;
  pageCanvas.height = viewport.height;
  const ctx = pageCanvas.getContext('2d');
  if (!ctx) return [];
  await page.render({ canvasContext: ctx, viewport }).promise;

  const crops: ImageCrop[] = [];
  op.regions.forEach((region) => {
    if (isLargeBackground(region.rect, viewport.width, viewport.height) || isTooSmall(region.rect, viewport.width, viewport.height)) {
      return;
    }
    const overlap = textBoxes.reduce((acc, box) => acc + overlapArea(region.rect, box), 0);
    const ratio = overlap / Math.max(region.rect.width * region.rect.height, 1);
    if (ratio > 0.05) {
      return;
    }
    const offscreen = document.createElement('canvas');
    offscreen.width = Math.max(1, Math.round(region.rect.width));
    offscreen.height = Math.max(1, Math.round(region.rect.height));
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) return;
    offCtx.drawImage(
      pageCanvas,
      region.rect.x,
      region.rect.y,
      region.rect.width,
      region.rect.height,
      0,
      0,
      offscreen.width,
      offscreen.height
    );
    crops.push({
      id: region.id,
      canvas: offscreen,
      x: region.rect.x,
      y: region.rect.y,
      width: region.rect.width,
      height: region.rect.height
    });
  });
  return crops;
};

export const extractImagesFromPdf = async (buffer: ArrayBuffer, scale = 2) => {
  const { pdf, release } = await loadPdf(buffer);
  const all: Array<{ page: number; images: ImageCrop[] }> = [];
  try {
    for (let i = 1; i <= pdf.numPages; i += 1) {
      const page = await pdf.getPage(i);
      const images = await extractImagesFromPage(page, scale);
      if (images.length > 0) {
        all.push({ page: i, images });
      }
      page.cleanup();
    }
  } finally {
    release();
  }
  return all;
};

export const extractSlideImages = async (buffer: ArrayBuffer, scale = 2): Promise<string[]> => {
  const pages = await extractImagesFromPdf(buffer, scale);
  const urls: string[] = [];
  pages.forEach((page) => {
    page.images.forEach((img) => {
      urls.push(img.canvas.toDataURL('image/png'));
    });
  });
  return urls;
};
