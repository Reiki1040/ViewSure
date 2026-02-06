// 画像領域をクラスタリングで推定する抽出器
// 現在のアプリ本体では未使用。画像検出の代替案として保持。
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

export type ImageCrop = {
  id: string;
  canvas: HTMLCanvasElement;
  x: number;
  y: number;
  width: number;
  height: number;
};

type Rect = { x: number; y: number; width: number; height: number };

const MERGE_MARGIN = 20;
const TEXT_MARGIN = 20;
const MIN_IMAGE_SIZE = 50;
const MAX_BG_RATIO = 0.9;

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

const loadPdf = async (buffer: ArrayBuffer) => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.js');
  const workerSrcModule = await import('pdfjs-dist/legacy/build/pdf.worker.min.js?url');
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = workerSrcModule.default;
  }
  const loadingTask = pdfjs.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;
  return {
    pdf,
    release: () => loadingTask.destroy()
  };
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
      fn === OPS.paintImageXObjectRepeat ||
      fn === OPS.paintJpegXObject
    ) {
      const imageId = (args as Array<string | number>)[0];
      let width = 0;
      let height = 0;

      // Inline image の場合は引数自体が画像データを持つ場合がある
      if (fn === OPS.paintInlineImageXObject) {
         // Inline image の扱いは複雑だが、ここでは引数オブジェクトから寸法取得を試みる
         const imgDict = args[0] as any;
         if (imgDict && imgDict.width && imgDict.height) {
            width = imgDict.width;
            height = imgDict.height;
         } else {
            // 寸法が取れない場合はスキップ（CTMだけで十分な場合もあるが、安全策）
            continue;
         }
      } else {
         const image = page.objs.get(imageId as string) as { width: number; height: number } | undefined;
         if (!image) continue;
         width = image.width;
         height = image.height;
      }

      const ctm = stack[stack.length - 1] ?? viewport.transform;
      const rect = rectFromCTM(ctm, width, height);
      const pageArea = viewport.width * viewport.height;
      
      // あまりに小さい、あるいはページ全体を覆うような画像は除外
      if (rect.width < MIN_IMAGE_SIZE || rect.height < MIN_IMAGE_SIZE) continue;
      if (rectArea(rect) > pageArea * MAX_BG_RATIO) continue;

      // テキストと完全に重なっている（背景画像のような）ものは、ここではじく
      // クラスタリング時に「テキストを吸収」するが、それは「近くにある」場合。
      // 「完全に下にある」場合は除外したい。
      const overlap = textBoxes.reduce((acc, box) => acc + rectOverlap(rect, box), 0);
      const ratio = overlap / Math.max(rectArea(rect), 1);
      
      // 重なり許容値を緩和（0.05 -> 0.3）: 画像の中に文字があっても抽出したいニーズに対応
      if (ratio > 0.3) continue;

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
      // 画像に重なっている、あるいは非常に近いテキストは「画像の一部（キャプション等）」とみなして領域を広げる
      if (overlap > 0 || distance <= TEXT_MARGIN) {
        box = rectUnion(box, t);
      }
    });
    return box;
  });
};

const cropClusters = (clusters: Rect[], pageCanvas: HTMLCanvasElement): ImageCrop[] => {
  const crops: ImageCrop[] = [];
  clusters.forEach((c, index) => {
    // 画面外にはみ出している部分をクリップ
    const safeX = Math.max(0, c.x);
    const safeY = Math.max(0, c.y);
    const safeW = Math.min(c.width, pageCanvas.width - safeX);
    const safeH = Math.min(c.height, pageCanvas.height - safeY);

    if (safeW <= 0 || safeH <= 0) return;

    const offscreen = document.createElement('canvas');
    offscreen.width = Math.max(1, Math.round(safeW));
    offscreen.height = Math.max(1, Math.round(safeH));
    const ctx = offscreen.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(
      pageCanvas,
      safeX, safeY, safeW, safeH,
      0, 0, offscreen.width, offscreen.height
    );

    crops.push({
      id: `cluster-${index}`,
      canvas: offscreen,
      x: safeX,
      y: safeY,
      width: safeW,
      height: safeH
    });
  });
  return crops;
};

const extractCropsFromPage = async (page: PDFPageProxy, scale: number): Promise<ImageCrop[]> => {
  const viewport = page.getViewport({ scale });
  const textBoxes = await collectTextBoxes(page, viewport);
  const { anchors } = await collectAnchors(page, scale, textBoxes);
  
  if (anchors.length === 0) {
    return [];
  }

  // 1. 画像同士をマージ
  const clusters = clusterAnchors(anchors);
  // 2. 近くのテキストを領域に取り込む
  const grown = absorbText(clusters, textBoxes);

  // 3. ページ全体を描画
  const pageCanvas = document.createElement('canvas');
  pageCanvas.width = viewport.width;
  pageCanvas.height = viewport.height;
  const ctx = pageCanvas.getContext('2d');
  if (!ctx) return [];
  
  // テキストなども含めて完全に描画
  await page.render({ canvasContext: ctx, viewport }).promise;

  // 4. 計算した領域で切り抜き
  return cropClusters(grown, pageCanvas);
};

export const extractImagesFromPdf = async (buffer: ArrayBuffer, scale = 2) => {
  const { pdf, release } = await loadPdf(buffer);
  const all: Array<{ page: number; images: ImageCrop[] }> = [];
  try {
    for (let i = 1; i <= pdf.numPages; i += 1) {
      const page = await pdf.getPage(i);
      const crops = await extractCropsFromPage(page, scale);
      if (crops.length > 0) {
        all.push({ page: i, images: crops });
      }
      page.cleanup();
    }
  } finally {
    release();
  }
  return all;
};
