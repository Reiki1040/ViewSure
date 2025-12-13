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

const loadPdf = async (buffer: ArrayBuffer): Promise<LoadResult> => {
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

const extractImagesFromPage = async (page: PDFPageProxy): Promise<ImageCrop[]> => {
  const { OPS } = await import('pdfjs-dist/legacy/build/pdf.js');
  
  // オペレータリストを取得して、画像描画命令を探す
  const opList = await page.getOperatorList();
  
  const images: ImageCrop[] = [];
  const processedIds = new Set<string>();

  for (let i = 0; i < opList.fnArray.length; i += 1) {
    const fn = opList.fnArray[i];
    const args = opList.argsArray[i];

    // 参考リポジトリ (ExtractPdfImages.vue) のロジックに合わせ、paintJpegXObject (JPEG画像) のみを対象とする
    // 元コード: if (ops.fnArray[i] !== pdfjsLib.OPS.paintJpegXObject) { return; }
    if (fn === OPS.paintJpegXObject) {
      const imgId = args[0] as string;
      if (processedIds.has(imgId)) continue;
      
      let img: any = null;
      try {
        // page.objs から画像オブジェクトの取得を試みる
        // @ts-ignore: pdf.js の内部型定義のため
        if (page.objs.has(imgId)) {
            // @ts-ignore
            img = page.objs.get(imgId);
        } else {
             // commonObjs (共有リソース) も確認
             // @ts-ignore
             const common = page.commonObjs;
             if (common && common.has(imgId)) {
                 img = common.get(imgId);
             }
        }
      } catch (e) {
          console.warn('[RawExtractor] Error retrieving image object:', imgId, e);
          continue;
      }

      if (img && typeof img === 'object') {
        // img は HTMLImageElement, HTMLCanvasElement, ImageBitmap などの描画可能オブジェクト
        const width = img.width;
        const height = img.height;
        
        // 有効なサイズを持つ場合のみ抽出
        if (width && height && width > 0 && height > 0) {
             const canvas = document.createElement('canvas');
             canvas.width = width;
             canvas.height = height;
             const ctx = canvas.getContext('2d');
             if (ctx) {
                 try {
                    // Canvasに描画してデータ化する
                    ctx.drawImage(img, 0, 0);
                    processedIds.add(imgId);
                    
                    images.push({
                        id: imgId,
                        canvas,
                        x: 0,
                        y: 0, 
                        width,
                        height
                    });
                 } catch (drawErr) {
                    console.warn('[RawExtractor] Failed to draw image:', imgId, drawErr);
                 }
             }
        }
      }
    }
  }

  return images;
};

export const extractImagesFromPdf = async (buffer: ArrayBuffer) => {
  const { pdf, release } = await loadPdf(buffer);
  const all: Array<{ page: number; images: ImageCrop[] }> = [];
  try {
    for (let i = 1; i <= pdf.numPages; i += 1) {
      const page = await pdf.getPage(i);
      const images = await extractImagesFromPage(page);
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
