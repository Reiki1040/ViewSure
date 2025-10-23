import type { ProjectionAsset, SlideTextContent } from '../fileLoader';

export type SlideMetrics = {
  index: number;
  width: number;
  height: number;
  aspectRatio: number;
  averageLuminance: number;
  textNodes?: SlideTextNode[];
};

export type DocumentAnalysis = {
  pageCount: number;
  generatedAt: number;
  slides: SlideMetrics[];
  issues: WcagIssue[];
};

export type SlideTextNode = {
  text: string;
  role: 'heading' | 'body';
  fontSize: number;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

export type WcagIssue = {
  slideIndex: number;
  severity: 'warning' | 'error';
  rule: 'font-size' | 'contrast';
  message: string;
  fontSize?: number;
  contrastRatio?: number;
  nodeText?: string;
};

const createAnalysisCanvas = () => {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error('キャンバスの初期化に失敗しました');
  }
  return { canvas, context };
};

const drawSourceToContext = (
  source: TexImageSource,
  context: CanvasRenderingContext2D
) => {
  const { canvas } = context;
  const width =
    source instanceof HTMLImageElement
      ? source.naturalWidth || source.width
      : source instanceof ImageBitmap || source instanceof OffscreenCanvas
      ? source.width
      : source instanceof HTMLCanvasElement
      ? source.width
      : source instanceof ImageData
      ? source.width
      : source instanceof HTMLVideoElement
      ? source.videoWidth
      : (source as HTMLCanvasElement).width ?? 0;
  const height =
    source instanceof HTMLImageElement
      ? source.naturalHeight || source.height
      : source instanceof ImageBitmap || source instanceof OffscreenCanvas
      ? source.height
      : source instanceof HTMLCanvasElement
      ? source.height
      : source instanceof ImageData
      ? source.height
      : source instanceof HTMLVideoElement
      ? source.videoHeight
      : (source as HTMLCanvasElement).height ?? 0;

  if (width === 0 || height === 0) {
    throw new Error('スライドの描画領域が取得できませんでした');
  }

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  } else {
    context.clearRect(0, 0, width, height);
  }

  if (source instanceof ImageData) {
    context.putImageData(source, 0, 0);
  } else {
    context.drawImage(source as CanvasImageSource, 0, 0, width, height);
  }

  return { width, height };
};

const calculateAverageLuminance = (context: CanvasRenderingContext2D) => {
  const { canvas } = context;
  const sampleStep = Math.max(1, Math.floor(Math.min(canvas.width, canvas.height) / 100));
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;
  let sum = 0;
  let count = 0;

  for (let y = 0; y < canvas.height; y += sampleStep) {
    for (let x = 0; x < canvas.width; x += sampleStep) {
      const index = (y * canvas.width + x) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      sum += luminance;
      count += 1;
    }
  }

  if (count === 0) {
    return 0;
  }

  return sum / count / 255;
};

const sampleLuminanceInRect = (
  context: CanvasRenderingContext2D,
  rect: { x: number; y: number; width: number; height: number },
  exclude?: { x: number; y: number; width: number; height: number }
) => {
  const { canvas } = context;
  const startX = Math.max(0, Math.floor(rect.x));
  const startY = Math.max(0, Math.floor(rect.y));
  const endX = Math.min(canvas.width, Math.ceil(rect.x + rect.width));
  const endY = Math.min(canvas.height, Math.ceil(rect.y + rect.height));
  if (startX >= endX || startY >= endY) {
    return 0;
  }

  const width = endX - startX;
  const height = endY - startY;
  const step = Math.max(1, Math.floor(Math.min(width, height) / 40));
  const imageData = context.getImageData(startX, startY, width, height);
  const { data } = imageData;
  let sum = 0;
  let count = 0;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const absoluteX = startX + x;
      const absoluteY = startY + y;
      if (
        exclude &&
        absoluteX >= exclude.x &&
        absoluteX <= exclude.x + exclude.width &&
        absoluteY >= exclude.y &&
        absoluteY <= exclude.y + exclude.height
      ) {
        continue;
      }
      const index = (y * width + x) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      sum += luminance;
      count += 1;
    }
  }

  if (count === 0) {
    return 0;
  }

  return sum / count / 255;
};

const classifyTextNodes = (content: SlideTextContent): SlideTextNode[] => {
  if (!content || !content.runs.length) {
    return [];
  }
  const fontSizes = content.runs
    .map((run) => run.fontSize)
    .filter((size) => Number.isFinite(size) && size > 0)
    .sort((a, b) => a - b);

  if (fontSizes.length === 0) {
    return [];
  }

  const median = fontSizes[Math.floor(fontSizes.length / 2)];
  const max = fontSizes[fontSizes.length - 1];
  const threshold = Math.max(median * 1.35, max * 0.75);

  return content.runs
    .map((run) => {
      const text = run.text.trim();
      if (!text) {
        return null;
      }
      const role: SlideTextNode['role'] = run.fontSize >= threshold ? 'heading' : 'body';
      return {
        text,
        role,
        fontSize: run.fontSize,
        bounds: {
          x: run.x,
          y: run.y,
          width: run.width,
          height: run.height
        }
      };
    })
    .filter((node): node is SlideTextNode => node !== null);
};

export const analyzeProjectionAsset = async (asset: ProjectionAsset): Promise<DocumentAnalysis> => {
  const { canvas, context } = createAnalysisCanvas();
  const slides: SlideMetrics[] = [];
  const hasTextContent = typeof asset.getTextContent === 'function';
  const issues: WcagIssue[] = [];

  for (let index = 0; index < asset.pageCount; index += 1) {
    const source = await asset.getFrame(index);
    const { width, height } = drawSourceToContext(source, context);
    const averageLuminance = calculateAverageLuminance(context);
    let textNodes: SlideTextNode[] | undefined;

    if (hasTextContent) {
      try {
        const textContent = await asset.getTextContent!(index);
        if (textContent) {
          textNodes = classifyTextNodes(textContent);
        }
      } catch (error) {
        console.warn('スライドテキストの解析に失敗しました', error);
      }
    }

    slides.push({
      index,
      width,
      height,
      aspectRatio: width / height,
      averageLuminance,
      textNodes
    });

    if (textNodes && textNodes.length > 0) {
      textNodes.forEach((node) => {
        const headingMin = Math.max(28, height * 0.04);
        const bodyMin = Math.max(18, height * 0.028);
        const requiredFont = node.role === 'heading' ? headingMin : bodyMin;
        if (node.fontSize < requiredFont) {
          issues.push({
            slideIndex: index,
            severity: node.fontSize < requiredFont * 0.75 ? 'error' : 'warning',
            rule: 'font-size',
            message:
              node.role === 'heading'
                ? '見出しテキストのサイズが推奨値を満たしていません'
                : '本文テキストのサイズが推奨値を満たしていません',
            fontSize: node.fontSize,
            nodeText: node.text
          });
        }

        const margin = Math.min(Math.max(node.bounds.width, node.bounds.height) * 0.2 + 12, Math.min(width, height) * 0.25);
        const backgroundRect = {
          x: Math.max(0, node.bounds.x - margin),
          y: Math.max(0, node.bounds.y - margin),
          width: Math.min(width, node.bounds.x + node.bounds.width + margin) - Math.max(0, node.bounds.x - margin),
          height: Math.min(height, node.bounds.y + node.bounds.height + margin) - Math.max(0, node.bounds.y - margin)
        };
        const textLum = sampleLuminanceInRect(context, node.bounds);
        const backgroundLum = sampleLuminanceInRect(context, backgroundRect, node.bounds);
        if (textLum > 0 && backgroundLum > 0) {
          const lighter = Math.max(textLum, backgroundLum);
          const darker = Math.min(textLum, backgroundLum);
          const contrastRatio = (lighter + 0.05) / (darker + 0.05);
          const required = node.role === 'heading' ? 3 : 4.5;
          if (contrastRatio < required) {
            issues.push({
              slideIndex: index,
              severity: contrastRatio < required * 0.75 ? 'error' : 'warning',
              rule: 'contrast',
              message: 'テキストと背景のコントラストが WCAG 推奨値未満です',
              contrastRatio,
              nodeText: node.text
            });
          }
        }
      });
    }

    if (source instanceof ImageBitmap) {
      try {
        source.close();
      } catch {
        // ignore
      }
    }
  }

  // 解放
  canvas.width = 0;
  canvas.height = 0;

  return {
    pageCount: asset.pageCount,
    generatedAt: Date.now(),
    slides,
    issues
  };
};
