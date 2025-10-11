type PptxPreviewModule = {
  renderAsync: (
    source: ArrayBuffer | Uint8Array | Blob,
    container: HTMLElement,
    options?: {
      slideNumber?: number;
      slideSize?: {
        width: number;
        height: number;
      };
    }
  ) => Promise<void>;
};

const CDN_SOURCES = [
  'https://cdn.jsdelivr.net/npm/pptx-preview@1.0.6/dist/pptx-preview.min.js',
  'https://cdn.jsdelivr.net/npm/pptx-preview@1.0.5/dist/pptx-preview.min.js',
  'https://cdn.jsdelivr.net/npm/pptx-preview@1.0.4/dist/pptx-preview.min.js'
];

let modulePromise: Promise<PptxPreviewModule> | null = null;

const loadScript = (src: string) =>
  new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[data-pptx-preview=\"${src}\"]`)) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    script.src = src;
    script.dataset.pptxPreview = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`pptx-preview の読み込みに失敗しました: ${src}`));
    document.head.appendChild(script);
  });

const loadPptxPreviewModule = async (): Promise<PptxPreviewModule> => {
  if (modulePromise) {
    return modulePromise;
  }

  modulePromise = (async () => {
    for (const src of CDN_SOURCES) {
      try {
        await loadScript(src);
        if (window.PptxPreview && typeof window.PptxPreview.renderAsync === 'function') {
          return window.PptxPreview as PptxPreviewModule;
        }
      } catch (error) {
        console.warn(error);
      }
    }
    throw new Error('pptx-preview の読み込みに失敗しました。ネットワーク接続をご確認ください。');
  })();

  return modulePromise;
};

const SERIALIZER = new XMLSerializer();

const svgToCanvas = async (svg: SVGElement): Promise<HTMLCanvasElement> => {
  const viewBox = svg.getAttribute('viewBox');
  let width = parseFloat(svg.getAttribute('width') ?? '0');
  let height = parseFloat(svg.getAttribute('height') ?? '0');

  if ((!width || !height) && viewBox) {
    const [, , w, h] = viewBox.split(/\s+/).map(Number);
    width = w || width;
    height = h || height;
  }

  const clonedSvg = svg.cloneNode(true) as SVGElement;
  clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  const svgString = SERIALIZER.serializeToString(clonedSvg);
  const encodedSvg = `data:image/svg+xml;base64,${window.btoa(unescape(encodeURIComponent(svgString)))}`;

  const image = new Image();
  image.crossOrigin = 'anonymous';

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('PowerPoint スライドの画像変換に失敗しました'));
    image.src = encodedSvg;
  });

  const canvas = document.createElement('canvas');
  canvas.width = width || image.naturalWidth;
  canvas.height = height || image.naturalHeight;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('PowerPoint スライドの描画用コンテキストを取得できませんでした');
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
};

export const renderPptxSlideToCanvas = async (data: ArrayBuffer, slideNumber = 1): Promise<HTMLCanvasElement> => {
  const pptxPreview = await loadPptxPreviewModule();

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.inset = '0';
  container.style.width = '1024px';
  container.style.height = '576px';
  container.style.pointerEvents = 'none';
  container.style.opacity = '0';
  container.style.zIndex = '-1';
  document.body.appendChild(container);

  try {
    await pptxPreview.renderAsync(data, container, {
      slideNumber,
      slideSize: {
        width: 1024,
        height: 576
      }
    });

    const svg = container.querySelector('svg');
    if (!svg) {
      throw new Error('PowerPoint スライドのレンダリングに失敗しました');
    }

    return await svgToCanvas(svg);
  } finally {
    container.remove();
  }
};
