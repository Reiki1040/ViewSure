import type { PDFPageProxy } from 'pdfjs-dist';

type Rect = { x: number; y: number; width: number; height: number };

const MERGE_MARGIN = 20;
const TEXT_MARGIN = 20;
const MIN_IMAGE_SIZE = 50;
const MAX_BG_RATIO = 0.9;
const SCALE = 2;

const rectArea = (r: Rect) => r.width * r.height;

const rectUnion = (a: Rect, b: Rect): Rect => {
  const x1 = Math.min(a.x, b.x);
  const y1 = Math.min(a.y, b.y);
  const x2 = Math.max(a.x + a.width, b.x + b.width);
  const y2 = Math.max(a.y + a.height, b.y + b.height);
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
};

const rectOverlap = (a: Rect, b: Rect) => {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  const w = x2 - x1;
  const h = y2 - y1;
  if (w <= 0 || h <= 0) return 0;
  return w * h;
};

const rectDistance = (a: Rect, b: Rect) => {
  const dx = Math.max(0, Math.max(b.x - (a.x + a.width), a.x - (b.x + b.width)));
  const dy = Math.max(0, Math.max(b.y - (a.y + a.height), a.y - (b.y + b.height)));
  return Math.hypot(dx, dy);
};

const applyMatrix = (m: number[], x: number, y: number) => ({
  x: m[0] * x + m[2] * y + m[4],
  y: m[1] * x + m[3] * y + m[5]
});

const rectFromCTM = (matrix: number[], width: number, height: number): Rect => {
  const p = [
    applyMatrix(matrix, 0, 0),
    applyMatrix(matrix, width, 0),
    applyMatrix(matrix, 0, height),
    applyMatrix(matrix, width, height)
  ];
  const xs = p.map((v) => v.x);
  const ys = p.map((v) => v.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
};

const collectTextBoxes = async (page: PDFPageProxy, viewport: any): Promise<Rect[]> => {
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
    .filter((b): b is Rect => Boolean(b));
};

const collectAnchors = async (page: PDFPageProxy, scale: number, textBoxes: Rect[]): Promise<{ anchors: Rect[]; viewport: any }> => {
  const { OPS, Util } = await import('pdfjs-dist/legacy/build/pdf.js');
  const viewport = page.getViewport({ scale });
  const opList = await page.getOperatorList();
  const stack: number[][] = [viewport.transform];
  const anchors: Rect[] = [];

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
    if (
      fn === OPS.paintImageXObject ||
      fn === OPS.paintImageMaskXObject ||
      fn === OPS.paintInlineImageXObject ||
      fn === OPS.paintImageXObjectRepeat
    ) {
      const imageId = (args as Array<string | number>)[0];
      const image = page.objs.get(imageId as string) as { width: number; height: number } | undefined;
      if (!image) continue;
      const ctm = stack[stack.length - 1] ?? viewport.transform;
      const rect = rectFromCTM(ctm, image.width, image.height);
      const pageArea = viewport.width * viewport.height;
      if (rect.width < MIN_IMAGE_SIZE || rect.height < MIN_IMAGE_SIZE) continue;
      if (rectArea(rect) > pageArea * MAX_BG_RATIO) continue;
      const overlap = textBoxes.reduce((acc, box) => acc + rectOverlap(rect, box), 0);
      const ratio = overlap / Math.max(rectArea(rect), 1);
      if (ratio > 0.05) continue;
      anchors.push(rect);
    }
  }

  return { anchors, viewport };
};

const clusterAnchors = (anchors: Rect[]): Rect[] => {
  const clusters = [...anchors];
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < clusters.length; i += 1) {
      for (let j = i + 1; j < clusters.length; j += 1) {
        const a = clusters[i];
        const b = clusters[j];
        const distance = rectDistance(a, b);
        const overlap = rectOverlap(a, b);
        if (overlap > 0 || distance <= MERGE_MARGIN) {
          const united = rectUnion(a, b);
          clusters.splice(j, 1);
          clusters.splice(i, 1, united);
          merged = true;
          break;
        }
      }
      if (merged) break;
    }
  }
  return clusters;
};

const absorbText = (clusters: Rect[], textBoxes: Rect[]): Rect[] => {
  return clusters.map((c) => {
    let box = { ...c };
    textBoxes.forEach((t) => {
      const distance = rectDistance(box, t);
      const overlap = rectOverlap(box, t);
      if (overlap > 0 || distance <= TEXT_MARGIN) {
        box = rectUnion(box, t);
      }
    });
    return box;
  });
};

const cropClusters = (clusters: Rect[], pageCanvas: HTMLCanvasElement) => {
  const crops: ImageCrop[] = [];
  clusters.forEach((c, index) => {
    const offscreen = document.createElement('canvas');
    offscreen.width = Math.max(1, Math.round(c.width));
    offscreen.height = Math.max(1, Math.round(c.height));
    const ctx = offscreen.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(pageCanvas, c.x, c.y, c.width, c.height, 0, 0, offscreen.width, offscreen.height);
    crops.push({
      id: `cluster-${index}`,
      canvas: offscreen,
      x: c.x,
      y: c.y,
      width: c.width,
      height: c.height
    });
  });
  return crops;
};

export const extractSlideImages = async (page: PDFPageProxy): Promise<string[]> => {
  const viewport = page.getViewport({ scale: SCALE });
  const textBoxes = await collectTextBoxes(page, viewport);
  const { anchors } = await collectAnchors(page, SCALE, textBoxes);
  if (anchors.length === 0) {
    return [];
  }
  const clusters = clusterAnchors(anchors);
  const grown = absorbText(clusters, textBoxes);

  const pageCanvas = document.createElement('canvas');
  pageCanvas.width = viewport.width;
  pageCanvas.height = viewport.height;
  const ctx = pageCanvas.getContext('2d');
  if (!ctx) return [];
  await page.render({ canvasContext: ctx, viewport }).promise;

  const crops = cropClusters(grown, pageCanvas);
  return crops.map((c) => c.canvas.toDataURL('image/png'));
};
