import type { 
  ProjectorPreviewSettings, 
  ResolutionSettings, 
  AdvancedBrightnessSettings, 
  AdvancedColorSettings,
  LuminanceAnalysis,
  ColorDistribution
} from '../types/projector';
import { resizeImage, applySharpening, applyNoiseReduction, calculateHistogram } from '../utils/imageUtils';
import { 
  rgbToXyz, 
  xyzToRgb, 
  calculateContrast, 
  simulateColorBlindness, 
  createColorTransformMatrix,
  colorTemperatureToRgb
} from '../utils/colorUtils';

/**
 * プロジェクター機能拡張API
 */
export interface ProjectorApi {
  // 解像度制御
  processResolution(
    source: TexImageSource,
    settings: ResolutionSettings
  ): Promise<HTMLCanvasElement>;
  
  // 明るさ制御
  processBrightness(
    source: TexImageSource,
    settings: AdvancedBrightnessSettings
  ): Promise<HTMLCanvasElement>;
  
  // 色彩制御
  processColor(
    source: TexImageSource,
    settings: AdvancedColorSettings
  ): Promise<HTMLCanvasElement>;
  
  // 環境シミュレーション
  simulateEnvironment(
    source: TexImageSource,
    settings: ProjectorPreviewSettings['environment']
  ): Promise<HTMLCanvasElement>;
  
  // 総合処理
  processForProjector(
    source: TexImageSource,
    settings: ProjectorPreviewSettings
  ): Promise<HTMLCanvasElement>;
  
  // 輝度分析
  analyzeLuminance(
    source: TexImageSource
  ): Promise<LuminanceAnalysis>;
  
  // 色分布分析
  analyzeColorDistribution(
    source: TexImageSource
  ): Promise<ColorDistribution>;
}

/**
 * 解像度処理の実装
 */
const processResolution = async (
  source: TexImageSource,
  settings: ResolutionSettings
): Promise<HTMLCanvasElement> => {
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
  
  // ターゲット解像度を計算
  let targetWidth = settings.targetWidth || sourceWidth;
  let targetHeight = settings.targetHeight || sourceHeight;
  
  // アスペクト比の維持
  if (settings.maintainAspectRatio) {
    const sourceAspect = sourceWidth / sourceHeight;
    const targetAspect = targetWidth / targetHeight;
    
    if (Math.abs(sourceAspect - targetAspect) > 0.01) {
      // アスペクト比が異なる場合、調整
      if (sourceAspect > targetAspect) {
        targetHeight = targetWidth / sourceAspect;
      } else {
        targetWidth = targetHeight * sourceAspect;
      }
    }
  }
  
  // リサイズ処理
  let result = await resizeImage(source, targetWidth, targetHeight, settings.scalingAlgorithm);
  
  // シャープネス適用
  if (settings.sharpening.enabled) {
    result = await applySharpening(result, settings.sharpening.strength, settings.sharpening.radius);
  }
  
  // ノイズリダクション適用
  if (settings.noiseReduction.enabled) {
    result = await applyNoiseReduction(result, settings.noiseReduction.strength);
  }
  
  return result;
};

/**
 * 明るさ処理の実装
 */
const processBrightness = async (
  source: TexImageSource,
  settings: AdvancedBrightnessSettings
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
  ctx.drawImage(source, 0, 0);
  
  // 画像データを取得
  const imageData = ctx.getImageData(0, 0, sourceWidth, sourceHeight);
  const { data } = imageData;
  
  // グローバル明るさ調整
  const globalBrightness = settings.globalBrightness / 100;
  
  // ピクセルごとの処理
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    
    // グローバル明るさ適用
    r = Math.max(0, Math.min(255, r * (1 + globalBrightness)));
    g = Math.max(0, Math.min(255, g * (1 + globalBrightness)));
    b = Math.max(0, Math.min(255, b * (1 + globalBrightness)));
    
    // ガンマ補正
    r = Math.pow(r / 255, 1 / settings.gamma.red) * 255;
    g = Math.pow(g / 255, 1 / settings.gamma.green) * 255;
    b = Math.pow(b / 255, 1 / settings.gamma.blue) * 255;
    
    data[i] = Math.max(0, Math.min(255, r));
    data[i + 1] = Math.max(0, Math.min(255, g));
    data[i + 2] = Math.max(0, Math.min(255, b));
  }
  
  // 処理済み画像データを設定
  ctx.putImageData(imageData, 0, 0);
  
  return canvas;
};

/**
 * 色彩処理の実装
 */
const processColor = async (
  source: TexImageSource,
  settings: AdvancedColorSettings
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
  ctx.drawImage(source, 0, 0);
  
  // 画像データを取得
  const imageData = ctx.getImageData(0, 0, sourceWidth, sourceHeight);
  const { data } = imageData;
  
  // 色温度変換用のRGB値を取得
  const [tempR, tempG, tempB] = colorTemperatureToRgb(settings.colorTemperature.kelvin);
  const tempFactor = 1 + (settings.colorTemperature.tint / 100);
  
  // 色域変換行列を取得
  const colorTransform = createColorTransformMatrix(
    settings.colorProfile.input,
    settings.colorProfile.output
  );
  
  // ピクセルごとの処理
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    
    // 色温度調整
    r = r * (tempR / 255);
    g = g * (tempG / 255) * tempFactor;
    b = b * (tempB / 255);
    
    // HSV調整
    const [h, s, v] = rgbToHsl(r, g, b);
    const adjustedH = (h + settings.hsv.hue + 360) % 360;
    const adjustedS = Math.max(0, Math.min(100, s * (1 + settings.hsv.saturation / 100)));
    const adjustedV = Math.max(0, Math.min(100, v * (1 + settings.hsv.value / 100)));
    
    [r, g, b] = hslToRgb(adjustedH, adjustedS, adjustedV);
    
    // 色覚多様性シミュレーション
    if (settings.colorBlindness.simulation !== 'none' as any) {
      const rgbString = `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
      const simulatedColor = simulateColorBlindness(rgbString, settings.colorBlindness.simulation);
      const simulatedRgb = simulatedColor.match(/\d+/g);
      if (simulatedRgb && simulatedRgb.length >= 3) {
        r = Number(simulatedRgb[0]);
        g = Number(simulatedRgb[1]);
        b = Number(simulatedRgb[2]);
      }
    }
    
    data[i] = Math.max(0, Math.min(255, r));
    data[i + 1] = Math.max(0, Math.min(255, g));
    data[i + 2] = Math.max(0, Math.min(255, b));
  }
  
  // 処理済み画像データを設定
  ctx.putImageData(imageData, 0, 0);
  
  return canvas;
};

/**
 * 環境シミュレーションの実装
 */
const simulateEnvironment = async (
  source: TexImageSource,
  settings: ProjectorPreviewSettings['environment']
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
  ctx.drawImage(source, 0, 0);
  
  // 画像データを取得
  const imageData = ctx.getImageData(0, 0, sourceWidth, sourceHeight);
  const { data } = imageData;
  
  // 環境光の影響を計算
  const ambientLight = settings.ambientLight;
  const screenGain = settings.screenGain;
  
  // ピクセルごとの処理
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    
    // スクリーンゲインを適用
    r = Math.max(0, Math.min(255, r * screenGain));
    g = Math.max(0, Math.min(255, g * screenGain));
    b = Math.max(0, Math.min(255, b * screenGain));
    
    // 環境光の影響を適用（ホワイトアウト効果）
    const washoutFactor = ambientLight * 0.5;
    r = r + (255 - r) * washoutFactor;
    g = g + (255 - g) * washoutFactor;
    b = b + (255 - b) * washoutFactor;
    
    data[i] = Math.max(0, Math.min(255, r));
    data[i + 1] = Math.max(0, Math.min(255, g));
    data[i + 2] = Math.max(0, Math.min(255, b));
  }
  
  // 処理済み画像データを設定
  ctx.putImageData(imageData, 0, 0);
  
  return canvas;
};

/**
 * 総合処理の実装
 */
const processForProjector = async (
  source: TexImageSource,
  settings: ProjectorPreviewSettings
): Promise<HTMLCanvasElement> => {
  // 解像度処理
  let result = await processResolution(source, settings.resolution);
  
  // 明るさ処理
  result = await processBrightness(result, settings.brightness);
  
  // 色彩処理
  result = await processColor(result, settings.color);
  
  // 環境シミュレーション
  result = await simulateEnvironment(result, settings.environment);
  
  return result;
};

/**
 * 輝度分析の実装
 */
const analyzeLuminance = async (
  source: TexImageSource
): Promise<LuminanceAnalysis> => {
  // ヒストグラムを計算
  const histogram = await calculateHistogram(source);
  
  // 平均輝度を計算
  let sum = 0;
  let count = 0;
  for (let i = 0; i < histogram.length; i++) {
    sum += i * histogram[i];
    count += histogram[i];
  }
  const average = count > 0 ? sum / count / 255 : 0;
  
  // ダイナミックレンジを計算
  let minLuminance = 255;
  let maxLuminance = 0;
  for (let i = 0; i < histogram.length; i++) {
    if (histogram[i] > 0) {
      minLuminance = Math.min(minLuminance, i);
      maxLuminance = Math.max(maxLuminance, i);
    }
  }
  const dynamicRange = (maxLuminance - minLuminance) / 255;
  
  return {
    average,
    histogram,
    dynamicRange
  };
};

/**
 * 色分布分析の実装
 */
const analyzeColorDistribution = async (
  source: TexImageSource
): Promise<ColorDistribution> => {
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
  ctx.drawImage(source, 0, 0);
  
  // 画像データを取得
  const imageData = ctx.getImageData(0, 0, sourceWidth, sourceHeight);
  const { data } = imageData;
  
  // 色のサンプリング（パフォーマンスのため、全ピクセルは処理しない）
  const sampleRate = Math.max(1, Math.floor((sourceWidth * sourceHeight) / 10000));
  const colorMap = new Map<string, number>();
  
  for (let i = 0; i < data.length; i += 4 * sampleRate) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    // 色を量子化
    const quantizedR = Math.floor(r / 32) * 32;
    const quantizedG = Math.floor(g / 32) * 32;
    const quantizedB = Math.floor(b / 32) * 32;
    
    const colorKey = `${quantizedR},${quantizedG},${quantizedB}`;
    colorMap.set(colorKey, (colorMap.get(colorKey) || 0) + 1);
  }
  
  // 主要な色を抽出
  const dominantColors = Array.from(colorMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([colorStr, count]) => {
      const [r, g, b] = colorStr.split(',').map(Number);
      return {
        rgb: [r, g, b] as [number, number, number],
        percentage: count / (data.length / 4 / sampleRate)
      };
    });
  
  // 色域とホワイトバランスを推定（簡略化）
  const gamut = 'sRGB'; // 実際の実装ではより複雑な分析が必要
  const whiteBalance = { temperature: 6500, tint: 0 }; // 実際の実装では計算が必要
  
  return {
    dominantColors,
    gamut,
    whiteBalance
  };
};

// RGBをHSLに変換するヘルパー関数
const rgbToHsl = (r: number, g: number, b: number): [number, number, number] => {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return [h * 360, s * 100, l * 100];
};

// HSLをRGBに変換するヘルパー関数
const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
  h /= 360;
  s /= 100;
  l /= 100;

  let r, g, b;

  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
};

// APIの実装
export const projectorApi: ProjectorApi = {
  processResolution,
  processBrightness,
  processColor,
  simulateEnvironment,
  processForProjector,
  analyzeLuminance,
  analyzeColorDistribution
};