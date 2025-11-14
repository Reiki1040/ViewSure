/**
 * ファイルローダーユーティリティ
 *
 * ViewSureでサポートされているファイル形式（PDF, PPTX, 画像）の読み込みと変換を担当します。
 * 各ファイル形式に応じた適切なレンダリング方法を提供し、統一されたインターフェースで返します。
 *
 * サポート形式:
 * - PDF (.pdf): PDF.jsを使用したページ単位のレンダリング
 * - PowerPoint (.pptx): pptx-previewライブラリを使用したSVG変換
 * - 画像 (PNG, JPEG, WEBP): 標準のImage要素を使用
 * - HEIC/HEIF: heic2anyライブラリを使用したPNG変換
 */
import { createPdfRenderer, type PdfPageTextContent } from './pdf';
import { renderPptxSlideToCanvas } from './ppt';

const IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp'
]);

const HEIC_MIME_TYPES = new Set([
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence'
]);

const createImageSourceFromBlob = async (blob: Blob): Promise<TexImageSource> => {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('画像の読み込みに失敗しました'));
    };
    image.src = objectUrl;
  });
};

const createImageSource = async (file: File): Promise<TexImageSource> => createImageSourceFromBlob(file);

const createHeicImageSource = async (file: File): Promise<TexImageSource> => {
  const module = await import('heic2any');
  const heic2any = module?.default ?? module;
  const result = await heic2any({
    blob: file,
    toType: 'image/png',
    quality: 0.92
  });

  const converted = Array.isArray(result) ? result[0] : result;
  if (!(converted instanceof Blob)) {
    throw new Error('HEIC 画像の変換に失敗しました');
  }

  return createImageSourceFromBlob(converted);
};

const toReusableSource = (source: TexImageSource): TexImageSource => {
  if (source instanceof ImageBitmap) {
    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;
    const context = canvas.getContext('2d');
    if (!context) {
      source.close();
      throw new Error('画像の変換に失敗しました');
    }
    context.drawImage(source, 0, 0);
    source.close();
    return canvas;
  }
  return source;
};

export type SlideTextContent = PdfPageTextContent;

export type ProjectionAsset = {
  type: 'pdf' | 'pptx' | 'image';
  pageCount: number;
  getFrame: (index: number) => Promise<TexImageSource>;
  dispose?: () => void;
  hasFrame?: (index: number) => boolean;
  getTextContent?: (index: number) => Promise<SlideTextContent | null>;
};

export const loadProjectionAsset = async (file: File): Promise<ProjectionAsset> => {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (isPdf) {
    const buffer = await file.arrayBuffer();
    const renderer = await createPdfRenderer(buffer, 1.5);
    return {
      type: 'pdf',
      pageCount: renderer.pageCount,
      getFrame: async (index: number) => renderer.getPageCanvas(index),
      dispose: () => renderer.dispose(),
      hasFrame: (index: number) => renderer.hasFrame(index),
      getTextContent: async (index: number) => renderer.getPageTextContent(index),
      getStructure: async () => {
        if (isPdf) {
          const { buildSlideStructure } = await import('./pdfStructureAnalyzer');
          const textContent = await renderer.getPageTextContent(0);
          return [buildSlideStructure(textContent, 0)];
        }
        return null;
      }
    };
  }

  const isPptx =
    file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    file.name.toLowerCase().endsWith('.pptx');

  if (isPptx) {
    const buffer = await file.arrayBuffer();
    const canvas = await renderPptxSlideToCanvas(buffer, 1);
    return {
      type: 'pptx',
      pageCount: 1,
      getFrame: async () => canvas,
      hasFrame: () => true,
      getTextContent: async () => null,
      getStructure: async () => {
        if (isPptx) {
          const { extractPptxStructure } = await import('./pptxStructureAnalyzer');
          // PPTXの場合はArrayBufferが必要だが、ここでは簡易実装
          console.warn('PPTX構造解析は完全な実装が必要です');
          return null;
        }
        return null;
      }
    };
  }

  if (IMAGE_MIME_TYPES.has(file.type)) {
    const source = toReusableSource(await createImageSource(file));
    return {
      type: 'image',
      pageCount: 1,
      getFrame: async () => source,
      hasFrame: () => true,
      getTextContent: async () => null,
      getStructure: async () => null
    };
  }

  const isHeic =
    HEIC_MIME_TYPES.has(file.type) || /\.hei[cf]$/i.test(file.name);

  if (isHeic) {
    const source = toReusableSource(await createHeicImageSource(file));
    return {
      type: 'image',
      pageCount: 1,
      getFrame: async () => source,
      hasFrame: () => true,
      getTextContent: async () => null,
      getStructure: async () => null
    };
  }

  throw new Error('対応していないファイル形式です。PDF / PPTX / PNG / JPEG / WEBP / HEIC を使用してください。');
};
