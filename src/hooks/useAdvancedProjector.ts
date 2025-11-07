import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ProjectorPreviewSettings, LuminanceAnalysis, ColorDistribution } from '../types/projector';
import { projectorApi } from '../api/projectorApi';
// TexImageSourceはグローバル型

export const useAdvancedProjector = () => {
  const [settings, setSettings] = useState<ProjectorPreviewSettings>({
    resolution: {
      maintainAspectRatio: true,
      scalingAlgorithm: 'bilinear',
      sharpening: {
        enabled: false,
        strength: 0.5,
        radius: 1.0
      },
      noiseReduction: {
        enabled: false,
        strength: 0.3
      }
    },
    brightness: {
      globalBrightness: 0,
      highlights: {
        adjustment: 0,
        threshold: 0.7
      },
      shadows: {
        adjustment: 0,
        threshold: 0.3
      },
      gamma: {
        red: 2.2,
        green: 2.2,
        blue: 2.2
      },
      hdrToSdr: {
        enabled: false,
        nits: 1000,
        method: 'reinhard'
      },
      autoAdjustment: {
        enabled: false,
        targetLuminance: 0.5,
        adaptationSpeed: 0.5
      }
    },
    color: {
      colorTemperature: {
        kelvin: 6500,
        tint: 0
      },
      hsv: {
        hue: 0,
        saturation: 0,
        value: 0
      },
      colorProfile: {
        input: 'sRGB',
        output: 'sRGB',
        renderingIntent: 'relative'
      },
      colorCorrection: {
        enabled: false,
        referencePoints: []
      },
      colorBlindness: {
        simulation: 'none' as any,
        compensation: false
      }
    },
    environment: {
      ambientLight: 0.2,
      screenGain: 1.0,
      throwDistance: 3.0,
      screenType: 'matte'
    }
  });
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [luminanceAnalysis, setLuminanceAnalysis] = useState<LuminanceAnalysis | null>(null);
  const [colorDistribution, setColorDistribution] = useState<ColorDistribution | null>(null);
  const [processedImage, setProcessedImage] = useState<HTMLCanvasElement | null>(null);
  const processingTimeoutRef = useRef<number | null>(null);
  
  // 設定の更新
  const updateSettings = useCallback((newSettings: Partial<ProjectorPreviewSettings>) => {
    setSettings(prevSettings => ({
      ...prevSettings,
      ...newSettings
    }));
  }, []);
  
  // 解像度設定の更新
  const updateResolutionSettings = useCallback((resolutionSettings: Partial<ProjectorPreviewSettings['resolution']>) => {
    updateSettings({
      resolution: {
        ...settings.resolution,
        ...resolutionSettings
      }
    });
  }, [settings.resolution, updateSettings]);
  
  // 明るさ設定の更新
  const updateBrightnessSettings = useCallback((brightnessSettings: Partial<ProjectorPreviewSettings['brightness']>) => {
    updateSettings({
      brightness: {
        ...settings.brightness,
        ...brightnessSettings
      }
    });
  }, [settings.brightness, updateSettings]);
  
  // 色彩設定の更新
  const updateColorSettings = useCallback((colorSettings: Partial<ProjectorPreviewSettings['color']>) => {
    updateSettings({
      color: {
        ...settings.color,
        ...colorSettings
      }
    });
  }, [settings.color, updateSettings]);
  
  // 環境設定の更新
  const updateEnvironmentSettings = useCallback((environmentSettings: Partial<ProjectorPreviewSettings['environment']>) => {
    updateSettings({
      environment: {
        ...settings.environment,
        ...environmentSettings
      }
    });
  }, [settings.environment, updateSettings]);
  
  // 画像処理の実行
  const processImage = useCallback(async (source: TexImageSource): Promise<HTMLCanvasElement> => {
    if (processingTimeoutRef.current !== null) {
      clearTimeout(processingTimeoutRef.current);
    }
    
    setIsProcessing(true);
    
    try {
      // プロジェクター設定を適用して画像を処理
      const result = await projectorApi.processForProjector(source, settings);
      setProcessedImage(result);
      return result;
    } catch (error) {
      console.error('画像処理に失敗しました', error);
      throw error;
    } finally {
      // 処理完了を遅延して通知（UIの更新のため）
      processingTimeoutRef.current = window.setTimeout(() => {
        setIsProcessing(false);
      }, 100);
    }
  }, [settings]);
  
  // 輝度分析の実行
  const analyzeLuminance = useCallback(async (source: TexImageSource): Promise<LuminanceAnalysis> => {
    try {
      const analysis = await projectorApi.analyzeLuminance(source);
      setLuminanceAnalysis(analysis);
      return analysis;
    } catch (error) {
      console.error('輝度分析に失敗しました', error);
      throw error;
    }
  }, []);
  
  // 色分布分析の実行
  const analyzeColorDistribution = useCallback(async (source: TexImageSource): Promise<ColorDistribution> => {
    try {
      const distribution = await projectorApi.analyzeColorDistribution(source);
      setColorDistribution(distribution);
      return distribution;
    } catch (error) {
      console.error('色分布分析に失敗しました', error);
      throw error;
    }
  }, []);
  
  // プリセットの適用
  const applyPreset = useCallback((presetType: 'indoor' | 'outdoor' | 'large_venue') => {
    let presetSettings: Partial<ProjectorPreviewSettings>;
    
    switch (presetType) {
      case 'indoor':
        presetSettings = {
          brightness: {
            ...settings.brightness,
            globalBrightness: 0,
            highlights: { adjustment: 10, threshold: 0.7 },
            shadows: { adjustment: -5, threshold: 0.3 }
          },
          color: {
            ...settings.color,
            colorTemperature: { kelvin: 6500, tint: 0 }
          },
          environment: {
            ...settings.environment,
            ambientLight: 0.2,
            screenGain: 1.0,
            screenType: 'matte'
          }
        };
        break;
        
      case 'outdoor':
        presetSettings = {
          brightness: {
            ...settings.brightness,
            globalBrightness: 20,
            highlights: { adjustment: 20, threshold: 0.8 },
            shadows: { adjustment: -10, threshold: 0.2 }
          },
          color: {
            ...settings.color,
            colorTemperature: { kelvin: 5500, tint: -10 }
          },
          environment: {
            ...settings.environment,
            ambientLight: 0.8,
            screenGain: 1.5,
            screenType: 'high_gain'
          }
        };
        break;
        
      case 'large_venue':
        presetSettings = {
          brightness: {
            ...settings.brightness,
            globalBrightness: 15,
            highlights: { adjustment: 15, threshold: 0.75 },
            shadows: { adjustment: -8, threshold: 0.25 }
          },
          color: {
            ...settings.color,
            colorTemperature: { kelvin: 6000, tint: 0 }
          },
          environment: {
            ...settings.environment,
            ambientLight: 0.1,
            screenGain: 2.0,
            screenType: 'glass_beaded'
          }
        };
        break;
        
      default:
        return;
    }
    
    updateSettings(presetSettings);
  }, [settings, updateSettings]);
  
  // 設定のリセット
  const resetSettings = useCallback(() => {
    setSettings({
      resolution: {
        maintainAspectRatio: true,
        scalingAlgorithm: 'bilinear',
        sharpening: {
          enabled: false,
          strength: 0.5,
          radius: 1.0
        },
        noiseReduction: {
          enabled: false,
          strength: 0.3
        }
      },
      brightness: {
        globalBrightness: 0,
        highlights: {
          adjustment: 0,
          threshold: 0.7
        },
        shadows: {
          adjustment: 0,
          threshold: 0.3
        },
        gamma: {
          red: 2.2,
          green: 2.2,
          blue: 2.2
        },
        hdrToSdr: {
          enabled: false,
          nits: 1000,
          method: 'reinhard'
        },
        autoAdjustment: {
          enabled: false,
          targetLuminance: 0.5,
          adaptationSpeed: 0.5
        }
      },
      color: {
        colorTemperature: {
          kelvin: 6500,
          tint: 0
        },
        hsv: {
          hue: 0,
          saturation: 0,
          value: 0
        },
        colorProfile: {
          input: 'sRGB',
          output: 'sRGB',
          renderingIntent: 'relative'
        },
        colorCorrection: {
          enabled: false,
          referencePoints: []
        },
        colorBlindness: {
          simulation: 'none' as any,
          compensation: false
        }
      },
      environment: {
        ambientLight: 0.2,
        screenGain: 1.0,
        throwDistance: 3.0,
        screenType: 'matte'
      }
    });
    
    setLuminanceAnalysis(null);
    setColorDistribution(null);
    setProcessedImage(null);
  }, []);
  
  // クリーンアップ
  useEffect(() => {
    return () => {
      if (processingTimeoutRef.current !== null) {
        clearTimeout(processingTimeoutRef.current);
      }
    };
  }, []);
  
  // 設定オブジェクトのメモ化
  const settingsMemo = useMemo(() => settings, [settings]);
  
  return {
    settings: settingsMemo,
    isProcessing,
    luminanceAnalysis,
    colorDistribution,
    processedImage,
    updateSettings,
    updateResolutionSettings,
    updateBrightnessSettings,
    updateColorSettings,
    updateEnvironmentSettings,
    processImage,
    analyzeLuminance,
    analyzeColorDistribution,
    applyPreset,
    resetSettings
  };
};