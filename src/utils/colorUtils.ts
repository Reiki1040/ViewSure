import type { ColorGamut, ColorBlindnessType } from '../types/projector';

/**
 * RGBをHSLに変換
 */
export const rgbToHsl = (r: number, g: number, b: number): [number, number, number] => {
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

/**
 * HSLをRGBに変換
 */
export const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
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

/**
 * RGBをXYZに変換
 */
export const rgbToXyz = (r: number, g: number, b: number): [number, number, number] => {
  // sRGB to linear RGB
  const linearize = (c: number) => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };

  const rLinear = linearize(r);
  const gLinear = linearize(g);
  const bLinear = linearize(b);

  // Linear RGB to XYZ
  const x = rLinear * 0.4124564 + gLinear * 0.3575761 + bLinear * 0.1804375;
  const y = rLinear * 0.2126729 + gLinear * 0.7151522 + bLinear * 0.0721750;
  const z = rLinear * 0.0193339 + gLinear * 0.1191920 + bLinear * 0.9503041;

  return [x, y, z];
};

/**
 * XYZをRGBに変換
 */
export const xyzToRgb = (x: number, y: number, z: number): [number, number, number] => {
  // XYZ to linear RGB
  const rLinear = x * 3.2404542 - y * 1.5371385 - z * 0.4985314;
  const gLinear = -x * 0.9692660 + y * 1.8760108 + z * 0.0415560;
  const bLinear = x * 0.0556434 - y * 0.2040259 + z * 1.0572252;

  // Linear RGB to sRGB
  const delinearize = (c: number) => {
    return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  };

  const r = Math.round(Math.max(0, Math.min(255, delinearize(rLinear) * 255)));
  const g = Math.round(Math.max(0, Math.min(255, delinearize(gLinear) * 255)));
  const b = Math.round(Math.max(0, Math.min(255, delinearize(bLinear) * 255)));

  return [r, g, b];
};

/**
 * 2色間のコントラスト比を計算
 */
export const calculateContrast = (color1: string, color2: string): number => {
  const getLuminance = (color: string): number => {
    const rgb = color.match(/\d+/g);
    if (!rgb || rgb.length < 3) return 0;
    
    const [r, g, b] = rgb.map(Number);
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  };

  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  
  return (lighter + 0.05) / (darker + 0.05);
};

/**
 * 色覚多様性シミュレーション
 */
export const simulateColorBlindness = (
  color: string,
  type: ColorBlindnessType
): string => {
  const rgb = color.match(/\d+/g);
  if (!rgb || rgb.length < 3) return color;
  
  const [r, g, b] = rgb.map(Number);
  
  let transformedR = r;
  let transformedG = g;
  let transformedB = b;
  
  // 色覚多様性変換行列
  switch (type) {
    case 'protanopia': // 赤緑色盲（赤覚異常）
      transformedR = 0.567 * r + 0.433 * g;
      transformedG = 0.558 * r + 0.442 * g;
      transformedB = 0.242 * g + 0.758 * b;
      break;
    case 'deuteranopia': // 赤緑色盲（緑覚異常）
      transformedR = 0.625 * r + 0.375 * g;
      transformedG = 0.7 * r + 0.3 * g;
      transformedB = 0.3 * g + 0.7 * b;
      break;
    case 'tritanopia': // 青黄色盲
      transformedR = 0.95 * r + 0.05 * g;
      transformedG = 0.433 * g + 0.567 * b;
      transformedB = 0.475 * g + 0.525 * b;
      break;
  }
  
  // 値を0-255の範囲にクランプ
  transformedR = Math.max(0, Math.min(255, Math.round(transformedR)));
  transformedG = Math.max(0, Math.min(255, Math.round(transformedG)));
  transformedB = Math.max(0, Math.min(255, Math.round(transformedB)));
  
  return `rgb(${transformedR}, ${transformedG}, ${transformedB})`;
};

/**
 * 色域変換行列を作成
 */
export const createColorTransformMatrix = (
  fromGamut: string,
  toGamut: string
): Float32Array => {
  // 色域定義
  const gamuts: Record<string, ColorGamut> = {
    'sRGB': {
      primaries: {
        red: { x: 0.64, y: 0.33 },
        green: { x: 0.30, y: 0.60 },
        blue: { x: 0.15, y: 0.06 },
        white: { x: 0.3127, y: 0.3290 }
      },
      gamma: 2.2
    },
    'DCI-P3': {
      primaries: {
        red: { x: 0.68, y: 0.32 },
        green: { x: 0.265, y: 0.69 },
        blue: { x: 0.15, y: 0.06 },
        white: { x: 0.3127, y: 0.3290 }
      },
      gamma: 2.6
    },
    'AdobeRGB': {
      primaries: {
        red: { x: 0.64, y: 0.33 },
        green: { x: 0.21, y: 0.71 },
        blue: { x: 0.15, y: 0.06 },
        white: { x: 0.3127, y: 0.3290 }
      },
      gamma: 2.2
    },
    'Rec2020': {
      primaries: {
        red: { x: 0.708, y: 0.292 },
        green: { x: 0.170, y: 0.797 },
        blue: { x: 0.131, y: 0.046 },
        white: { x: 0.3127, y: 0.3290 }
      },
      gamma: 2.4
    }
  };
  
  const sourceGamut = gamuts[fromGamut];
  const targetGamut = gamuts[toGamut];
  
  if (!sourceGamut || !targetGamut) {
    // デフォルトは単位行列
    return new Float32Array([
      1, 0, 0,
      0, 1, 0,
      0, 0, 1
    ]);
  }
  
  // 簡略化した変換行列（実際の実装ではより複雑な計算が必要）
  // ここでは基本的な変換のみを示す
  return new Float32Array([
    1, 0, 0,
    0, 1, 0,
    0, 0, 1
  ]);
};

/**
 * 色温度をRGBに変換
 */
export const colorTemperatureToRgb = (kelvin: number): [number, number, number] => {
  let temp = kelvin / 100;
  let red, green, blue;
  
  // 赤成分の計算
  if (temp <= 66) {
    red = 255;
  } else {
    red = temp - 60;
    red = 329.698727446 * Math.pow(red, -0.1332047592);
    red = Math.max(0, Math.min(255, red));
  }
  
  // 緑成分の計算
  if (temp <= 66) {
    green = temp;
    green = 99.4708025861 * Math.log(green) - 161.1195681661;
  } else {
    green = temp - 60;
    green = 288.1221695283 * Math.pow(green, -0.0755148492);
  }
  green = Math.max(0, Math.min(255, green));
  
  // 青成分の計算
  if (temp >= 66) {
    blue = 255;
  } else if (temp >= 19) {
    blue = temp - 10;
    blue = 138.5177312231 * Math.log(blue) - 305.0447927307;
    blue = Math.max(0, Math.min(255, blue));
  } else {
    blue = 0;
  }
  
  return [Math.round(red), Math.round(green), Math.round(blue)];
};