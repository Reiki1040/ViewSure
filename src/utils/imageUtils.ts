import type { ResolutionSettings, SharpeningSettings, NoiseReductionSettings } from '../types/projector';

/**
 * CanvasImageSourceに変換するヘルパー関数
 */
const toCanvasImageSource = (source: TexImageSource): CanvasImageSource => {
  if (source instanceof ImageData) {
    // ImageDataをCanvasに変換
    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvasコンテキストの取得に失敗しました');
    }
    ctx.putImageData(source, 0, 0);
    return canvas;
  }
  return source as CanvasImageSource;
};

/**
 * 画像のリサイズ処理
 */
export const resizeImage = async (
  source: TexImageSource,
  width: number,
  height: number,
  algorithm: 'bilinear' | 'bicubic' | 'lanczos' | 'nearest' = 'bilinear'
): Promise<HTMLCanvasElement> => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Canvasコンテキストの取得に失敗しました');
  }
  
  // アルゴリズムに応じた画像補間を設定
  switch (algorithm) {
    case 'nearest':
      ctx.imageSmoothingEnabled = false;
      break;
    case 'bilinear':
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'low';
      break;
    case 'bicubic':
    case 'lanczos':
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      break;
  }
  
  const canvasSource = toCanvasImageSource(source);
  ctx.drawImage(canvasSource, 0, 0, width, height);
  return canvas;
};

/**
 * シャープネスフィルタの適用
 */
export const applySharpening = async (
  source: TexImageSource,
  strength: number,
  radius: number
): Promise<HTMLCanvasElement> => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Canvasコンテキストの取得に失敗しました');
  }
  
  // ソース画像の寸法を取得
  let sourceWidth: number, sourceHeight: number;
  if (source instanceof HTMLImageElement) {
    sourceWidth = source.naturalWidth || source.width;
    sourceHeight = source.naturalHeight || source.height;
  } else if (source instanceof HTMLCanvasElement) {
    sourceWidth = source.width;
    sourceHeight = source.height;
  } else if (source instanceof ImageBitmap) {
    sourceWidth = source.width;
    sourceHeight = source.height;
  } else {
    throw new Error('サポートされていない画像形式です');
  }
  
  canvas.width = sourceWidth;
  canvas.height = sourceHeight;
  
  // 元の画像を描画
  const canvasSource = toCanvasImageSource(source);
  ctx.drawImage(canvasSource, 0, 0);
  
  // シャープネスカーネルの作成
  const kernelSize = Math.ceil(radius) * 2 + 1;
  const kernel = createSharpeningKernel(kernelSize, strength);
  
  // Convolutionフィルタの適用
  const imageData = ctx.getImageData(0, 0, sourceWidth, sourceHeight);
  const filteredData = applyConvolution(imageData, kernel);
  ctx.putImageData(filteredData, 0, 0);
  
  return canvas;
};

/**
 * シャープネスカーネルの作成
 */
const createSharpeningKernel = (size: number, strength: number): number[] => {
  const kernel: number[] = [];
  const center = Math.floor(size / 2);
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (x === center && y === center) {
        // 中心要素は強度に応じて増加
        kernel.push(1 + (size * size - 1) * strength);
      } else {
        // 周囲要素は強度に応じて減少
        kernel.push(-strength);
      }
    }
  }
  
  return kernel;
};

/**
 * 畳み込み演算の適用
 */
const applyConvolution = (imageData: ImageData, kernel: number[]): ImageData => {
  const { data, width, height } = imageData;
  const output = new ImageData(width, height);
  const outputData = output.data;
  
  const kernelSize = Math.sqrt(kernel.length);
  const halfKernel = Math.floor(kernelSize / 2);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      
      for (let ky = 0; ky < kernelSize; ky++) {
        for (let kx = 0; kx < kernelSize; kx++) {
          const px = x + kx - halfKernel;
          const py = y + ky - halfKernel;
          
          // 画像境界のチェック
          if (px >= 0 && px < width && py >= 0 && py < height) {
            const idx = (py * width + px) * 4;
            const kernelIdx = ky * kernelSize + kx;
            
            r += data[idx] * kernel[kernelIdx];
            g += data[idx + 1] * kernel[kernelIdx];
            b += data[idx + 2] * kernel[kernelIdx];
            a += data[idx + 3] * kernel[kernelIdx];
          }
        }
      }
      
      const outputIdx = (y * width + x) * 4;
      outputData[outputIdx] = Math.max(0, Math.min(255, r));
      outputData[outputIdx + 1] = Math.max(0, Math.min(255, g));
      outputData[outputIdx + 2] = Math.max(0, Math.min(255, b));
      outputData[outputIdx + 3] = Math.max(0, Math.min(255, a));
    }
  }
  
  return output;
};

/**
 * ノイズリダクションフィルタの適用
 */
export const applyNoiseReduction = async (
  source: TexImageSource,
  strength: number
): Promise<HTMLCanvasElement> => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Canvasコンテキストの取得に失敗しました');
  }
  
  // ソース画像の寸法を取得
  let sourceWidth: number, sourceHeight: number;
  if (source instanceof HTMLImageElement) {
    sourceWidth = source.naturalWidth || source.width;
    sourceHeight = source.naturalHeight || source.height;
  } else if (source instanceof HTMLCanvasElement) {
    sourceWidth = source.width;
    sourceHeight = source.height;
  } else if (source instanceof ImageBitmap) {
    sourceWidth = source.width;
    sourceHeight = source.height;
  } else {
    throw new Error('サポートされていない画像形式です');
  }
  
  canvas.width = sourceWidth;
  canvas.height = sourceHeight;
  
  // 元の画像を描画
  const canvasSource = toCanvasImageSource(source);
  ctx.drawImage(canvasSource, 0, 0);
  
  // メディアンフィルタの適用
  const imageData = ctx.getImageData(0, 0, sourceWidth, sourceHeight);
  const filteredData = applyMedianFilter(imageData, Math.ceil(strength * 3) || 3);
  ctx.putImageData(filteredData, 0, 0);
  
  return canvas;
};

/**
 * メディアンフィルタの適用
 */
const applyMedianFilter = (imageData: ImageData, kernelSize: number): ImageData => {
  const { data, width, height } = imageData;
  const output = new ImageData(width, height);
  const outputData = output.data;
  
  const halfKernel = Math.floor(kernelSize / 2);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const values: { r: number; g: number; b: number; a: number }[] = [];
      
      // カーネル領域のピクセル値を収集
      for (let ky = 0; ky < kernelSize; ky++) {
        for (let kx = 0; kx < kernelSize; kx++) {
          const px = x + kx - halfKernel;
          const py = y + ky - halfKernel;
          
          // 画像境界のチェック
          if (px >= 0 && px < width && py >= 0 && py < height) {
            const idx = (py * width + px) * 4;
            values.push({
              r: data[idx],
              g: data[idx + 1],
              b: data[idx + 2],
              a: data[idx + 3]
            });
          }
        }
      }
      
      // メディアン値を計算
      values.sort((a, b) => {
        const sumA = a.r + a.g + a.b;
        const sumB = b.r + b.g + b.b;
        return sumA - sumB;
      });
      
      const median = values[Math.floor(values.length / 2)];
      const outputIdx = (y * width + x) * 4;
      
      outputData[outputIdx] = median.r;
      outputData[outputIdx + 1] = median.g;
      outputData[outputIdx + 2] = median.b;
      outputData[outputIdx + 3] = median.a;
    }
  }
  
  return output;
};

/**
 * 輝度ヒストグラムの計算
 */
export const calculateHistogram = async (source: TexImageSource): Promise<number[]> => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Canvasコンテキストの取得に失敗しました');
  }
  
  // ソース画像の寸法を取得
  let sourceWidth: number, sourceHeight: number;
  if (source instanceof HTMLImageElement) {
    sourceWidth = source.naturalWidth || source.width;
    sourceHeight = source.naturalHeight || source.height;
  } else if (source instanceof HTMLCanvasElement) {
    sourceWidth = source.width;
    sourceHeight = source.height;
  } else if (source instanceof ImageBitmap) {
    sourceWidth = source.width;
    sourceHeight = source.height;
  } else {
    throw new Error('サポートされていない画像形式です');
  }
  
  canvas.width = sourceWidth;
  canvas.height = sourceHeight;
  
  // 画像を描画
  const canvasSource = toCanvasImageSource(source);
  ctx.drawImage(canvasSource, 0, 0);
  
  // ヒストグラムの初期化
  const histogram = new Array(256).fill(0);
  
  // 画像データの取得
  const imageData = ctx.getImageData(0, 0, sourceWidth, sourceHeight);
  const { data } = imageData;
  
  // 輝度値の計算とヒストグラムの更新
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    // 輝度の計算（Rec. 709）
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const index = Math.floor(luminance);
    
    histogram[index]++;
  }
  
  return histogram;
};

/**
 * エッジ検出
 */
export const detectEdges = async (source: TexImageSource): Promise<HTMLCanvasElement> => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Canvasコンテキストの取得に失敗しました');
  }
  
  // ソース画像の寸法を取得
  let sourceWidth: number, sourceHeight: number;
  if (source instanceof HTMLImageElement) {
    sourceWidth = source.naturalWidth || source.width;
    sourceHeight = source.naturalHeight || source.height;
  } else if (source instanceof HTMLCanvasElement) {
    sourceWidth = source.width;
    sourceHeight = source.height;
  } else if (source instanceof ImageBitmap) {
    sourceWidth = source.width;
    sourceHeight = source.height;
  } else {
    throw new Error('サポートされていない画像形式です');
  }
  
  canvas.width = sourceWidth;
  canvas.height = sourceHeight;
  
  // 元の画像を描画
  const canvasSource = toCanvasImageSource(source);
  ctx.drawImage(canvasSource, 0, 0);
  
  // Sobelフィルタの適用
  const imageData = ctx.getImageData(0, 0, sourceWidth, sourceHeight);
  const edgeData = applySobelFilter(imageData);
  ctx.putImageData(edgeData, 0, 0);
  
  return canvas;
};

/**
 * Sobelフィルタの適用
 */
const applySobelFilter = (imageData: ImageData): ImageData => {
  const { data, width, height } = imageData;
  const output = new ImageData(width, height);
  const outputData = output.data;
  
  // Sobelカーネル
  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let pixelX = 0;
      let pixelY = 0;
      
      // 畳み込み演算
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = ((y + ky) * width + (x + kx)) * 4;
          const kernelIdx = (ky + 1) * 3 + (kx + 1);
          
          const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
          pixelX += gray * sobelX[kernelIdx];
          pixelY += gray * sobelY[kernelIdx];
        }
      }
      
      // 勾配の大きさを計算
      const magnitude = Math.sqrt(pixelX * pixelX + pixelY * pixelY);
      const outputIdx = (y * width + x) * 4;
      
      const value = Math.min(255, magnitude);
      outputData[outputIdx] = value;
      outputData[outputIdx + 1] = value;
      outputData[outputIdx + 2] = value;
      outputData[outputIdx + 3] = 255;
    }
  }
  
  return output;
};