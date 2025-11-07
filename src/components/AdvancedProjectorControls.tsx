import { useCallback, useState } from 'react';
import type { ProjectorPreviewSettings } from '../types/projector';

interface AdvancedProjectorControlsProps {
  settings: ProjectorPreviewSettings;
  onSettingsChange: (settings: ProjectorPreviewSettings) => void;
  disabled?: boolean;
  showAdvanced?: boolean;
  sourceDimensions?: { width: number; height: number };
}

const AdvancedProjectorControls = ({
  settings,
  onSettingsChange,
  disabled = false,
  showAdvanced = false,
  sourceDimensions
}: AdvancedProjectorControlsProps) => {
  const [activeTab, setActiveTab] = useState<'resolution' | 'brightness' | 'color' | 'environment'>('resolution');
  
  // 設定の更新ハンドラ
  const updateSettings = useCallback((newSettings: Partial<ProjectorPreviewSettings>) => {
    onSettingsChange({
      ...settings,
      ...newSettings
    });
  }, [settings, onSettingsChange]);
  
  // 解像度設定の更新
  const updateResolutionSettings = useCallback((resolutionSettings: Partial<ProjectorPreviewSettings['resolution']>) => {
    updateSettings({ 
      resolution: {
        ...settings.resolution,
        ...resolutionSettings
      }
    });
  }, [settings, updateSettings]);
  
  // 明るさ設定の更新
  const updateBrightnessSettings = useCallback((brightnessSettings: Partial<ProjectorPreviewSettings['brightness']>) => {
    updateSettings({ 
      brightness: {
        ...settings.brightness,
        ...brightnessSettings
      }
    });
  }, [settings, updateSettings]);
  
  // 色彩設定の更新
  const updateColorSettings = useCallback((colorSettings: Partial<ProjectorPreviewSettings['color']>) => {
    updateSettings({ 
      color: {
        ...settings.color,
        ...colorSettings
      }
    });
  }, [settings, updateSettings]);
  
  // 環境設定の更新
  const updateEnvironmentSettings = useCallback((environmentSettings: Partial<ProjectorPreviewSettings['environment']>) => {
    updateSettings({ 
      environment: {
        ...settings.environment,
        ...environmentSettings
      }
    });
  }, [settings, updateSettings]);
  
  // プリセットの実行
  const handleReset = useCallback(() => {
    // デフォルト設定
    const defaultSettings: ProjectorPreviewSettings = {
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
    };
    
    onSettingsChange(defaultSettings);
  }, [onSettingsChange]);
  
  // プリセットの実行
  const handlePreset = useCallback((presetType: 'indoor' | 'outdoor' | 'large_venue') => {
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
    
    if (presetSettings) {
      updateSettings(presetSettings);
    }
  }, [settings, updateSettings]);
  
  return (
    <div className="advanced-projector-controls">
      <div className="advanced-projector-controls__tabs">
        <button
          type="button"
          className={`advanced-projector-controls__tab ${activeTab === 'resolution' ? 'active' : ''}`}
          onClick={() => setActiveTab('resolution')}
          disabled={disabled}
        >
          解像度
        </button>
        
        <button
          type="button"
          className={`advanced-projector-controls__tab ${activeTab === 'brightness' ? 'active' : ''}`}
          onClick={() => setActiveTab('brightness')}
          disabled={disabled}
        >
          明るさ
        </button>
        
        <button
          type="button"
          className={`advanced-projector-controls__tab ${activeTab === 'color' ? 'active' : ''}`}
          onClick={() => setActiveTab('color')}
          disabled={disabled}
        >
          色彩
        </button>
        
        <button
          type="button"
          className={`advanced-projector-controls__tab ${activeTab === 'environment' ? 'active' : ''}`}
          onClick={() => setActiveTab('environment')}
          disabled={disabled}
        >
          環境
        </button>
      </div>
      
      <div className="advanced-projector-controls__content">
        {activeTab === 'resolution' && (
          <div className="advanced-projector-controls__resolution">
            <h4 className="advanced-projector-controls__section-title">解像度設定</h4>
            <div className="advanced-projector-controls__setting">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.resolution.maintainAspectRatio}
                  onChange={(e) => updateResolutionSettings({ maintainAspectRatio: e.target.checked })}
                  disabled={disabled}
                />
                アスペクト比を維持する
              </label>
            </div>
            
            <div className="advanced-projector-controls__setting">
              <label htmlFor="scaling-algorithm">スケーリングアルゴリズム</label>
              <select
                id="scaling-algorithm"
                value={settings.resolution.scalingAlgorithm}
                onChange={(e) => updateResolutionSettings({ scalingAlgorithm: e.target.value as any })}
                disabled={disabled}
              >
                <option value="nearest">最近傍補間</option>
                <option value="bilinear">バイリニア補間</option>
                <option value="bicubic">バイキュービック補間</option>
                <option value="lanczos">ランチョス補間</option>
              </select>
            </div>
            
            <div className="advanced-projector-controls__setting">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.resolution.sharpening.enabled}
                  onChange={(e) => updateResolutionSettings({ 
                    sharpening: { ...settings.resolution.sharpening, enabled: e.target.checked }
                  })}
                  disabled={disabled}
                />
                シャープネスを有効にする
              </label>
            </div>
            
            {settings.resolution.sharpening.enabled && (
              <div className="advanced-projector-controls__sub-settings">
                <div className="advanced-projector-controls__setting">
                  <label htmlFor="sharpening-strength">強度</label>
                  <input
                    id="sharpening-strength"
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={settings.resolution.sharpening.strength}
                    onChange={(e) => updateResolutionSettings({ 
                      sharpening: { ...settings.resolution.sharpening, strength: parseFloat(e.target.value) }
                    })}
                    disabled={disabled}
                  />
                  <span className="advanced-projector-controls__setting-value">
                    {settings.resolution.sharpening.strength.toFixed(1)}
                  </span>
                </div>
                
                <div className="advanced-projector-controls__setting">
                  <label htmlFor="sharpening-radius">半径</label>
                  <input
                    id="sharpening-radius"
                    type="range"
                    min="0.5"
                    max="5.0"
                    step="0.1"
                    value={settings.resolution.sharpening.radius}
                    onChange={(e) => updateResolutionSettings({ 
                      sharpening: { ...settings.resolution.sharpening, radius: parseFloat(e.target.value) }
                    })}
                    disabled={disabled}
                  />
                  <span className="advanced-projector-controls__setting-value">
                    {settings.resolution.sharpening.radius.toFixed(1)}
                  </span>
                </div>
              </div>
            )}
            
            <div className="advanced-projector-controls__setting">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.resolution.noiseReduction.enabled}
                  onChange={(e) => updateResolutionSettings({ 
                    noiseReduction: { ...settings.resolution.noiseReduction, enabled: e.target.checked }
                  })}
                  disabled={disabled}
                />
                ノイズリダクションを有効にする
              </label>
            </div>
            
            {settings.resolution.noiseReduction.enabled && (
              <div className="advanced-projector-controls__sub-settings">
                <div className="advanced-projector-controls__setting">
                  <label htmlFor="noise-reduction-strength">強度</label>
                  <input
                    id="noise-reduction-strength"
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={settings.resolution.noiseReduction.strength}
                    onChange={(e) => updateResolutionSettings({ 
                      noiseReduction: { ...settings.resolution.noiseReduction, strength: parseFloat(e.target.value) }
                    })}
                    disabled={disabled}
                  />
                  <span className="advanced-projector-controls__setting-value">
                    {settings.resolution.noiseReduction.strength.toFixed(1)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'brightness' && (
          <div className="advanced-projector-controls__brightness">
            <h4 className="advanced-projector-controls__section-title">明るさ設定</h4>
            <div className="advanced-projector-controls__setting">
              <label htmlFor="global-brightness">グローバル明るさ</label>
              <input
                id="global-brightness"
                type="range"
                min="-100"
                max="100"
                step="1"
                value={settings.brightness.globalBrightness}
                onChange={(e) => updateBrightnessSettings({ globalBrightness: parseFloat(e.target.value) })}
                disabled={disabled}
              />
              <span className="advanced-projector-controls__setting-value">
                {settings.brightness.globalBrightness}
              </span>
            </div>
            
            <div className="advanced-projector-controls__section">
              <h5 className="advanced-projector-controls__subsection-title">ハイライト調整</h5>
              <div className="advanced-projector-controls__setting">
                <label htmlFor="highlights-adjustment">調整量</label>
                <input
                  id="highlights-adjustment"
                  type="range"
                  min="-100"
                  max="100"
                  step="1"
                  value={settings.brightness.highlights.adjustment}
                  onChange={(e) => updateBrightnessSettings({ 
                    highlights: { ...settings.brightness.highlights, adjustment: parseFloat(e.target.value) }
                  })}
                  disabled={disabled}
                />
                <span className="advanced-projector-controls__setting-value">
                  {settings.brightness.highlights.adjustment}
                </span>
              </div>
              
              <div className="advanced-projector-controls__setting">
                <label htmlFor="highlights-threshold">しきい値</label>
                <input
                  id="highlights-threshold"
                  type="range"
                  min="0.5"
                  max="1.0"
                  step="0.05"
                  value={settings.brightness.highlights.threshold}
                  onChange={(e) => updateBrightnessSettings({ 
                    highlights: { ...settings.brightness.highlights, threshold: parseFloat(e.target.value) }
                  })}
                  disabled={disabled}
                />
                <span className="advanced-projector-controls__setting-value">
                  {settings.brightness.highlights.threshold.toFixed(2)}
                </span>
              </div>
            </div>
            
            <div className="advanced-projector-controls__section">
              <h5 className="advanced-projector-controls__subsection-title">シャドウ調整</h5>
              <div className="advanced-projector-controls__setting">
                <label htmlFor="shadows-adjustment">調整量</label>
                <input
                  id="shadows-adjustment"
                  type="range"
                  min="-100"
                  max="100"
                  step="1"
                  value={settings.brightness.shadows.adjustment}
                  onChange={(e) => updateBrightnessSettings({ 
                    shadows: { ...settings.brightness.shadows, adjustment: parseFloat(e.target.value) }
                  })}
                  disabled={disabled}
                />
                <span className="advanced-projector-controls__setting-value">
                  {settings.brightness.shadows.adjustment}
                </span>
              </div>
              
              <div className="advanced-projector-controls__setting">
                <label htmlFor="shadows-threshold">しきい値</label>
                <input
                  id="shadows-threshold"
                  type="range"
                  min="0.0"
                  max="0.5"
                  step="0.05"
                  value={settings.brightness.shadows.threshold}
                  onChange={(e) => updateBrightnessSettings({ 
                    shadows: { ...settings.brightness.shadows, threshold: parseFloat(e.target.value) }
                  })}
                  disabled={disabled}
                />
                <span className="advanced-projector-controls__setting-value">
                  {settings.brightness.shadows.threshold.toFixed(2)}
                </span>
              </div>
            </div>
            
            <div className="advanced-projector-controls__section">
              <h5 className="advanced-projector-controls__subsection-title">ガンマ補正</h5>
              <div className="advanced-projector-controls__setting">
                <label htmlFor="gamma-red">赤</label>
                <input
                  id="gamma-red"
                  type="range"
                  min="0.1"
                  max="3.0"
                  step="0.1"
                  value={settings.brightness.gamma.red}
                  onChange={(e) => updateBrightnessSettings({ 
                    gamma: { ...settings.brightness.gamma, red: parseFloat(e.target.value) }
                  })}
                  disabled={disabled}
                />
                <span className="advanced-projector-controls__setting-value">
                  {settings.brightness.gamma.red.toFixed(1)}
                </span>
              </div>
              
              <div className="advanced-projector-controls__setting">
                <label htmlFor="gamma-green">緑</label>
                <input
                  id="gamma-green"
                  type="range"
                  min="0.1"
                  max="3.0"
                  step="0.1"
                  value={settings.brightness.gamma.green}
                  onChange={(e) => updateBrightnessSettings({ 
                    gamma: { ...settings.brightness.gamma, green: parseFloat(e.target.value) }
                  })}
                  disabled={disabled}
                />
                <span className="advanced-projector-controls__setting-value">
                  {settings.brightness.gamma.green.toFixed(1)}
                </span>
              </div>
              
              <div className="advanced-projector-controls__setting">
                <label htmlFor="gamma-blue">青</label>
                <input
                  id="gamma-blue"
                  type="range"
                  min="0.1"
                  max="3.0"
                  step="0.1"
                  value={settings.brightness.gamma.blue}
                  onChange={(e) => updateBrightnessSettings({ 
                    gamma: { ...settings.brightness.gamma, blue: parseFloat(e.target.value) }
                  })}
                  disabled={disabled}
                />
                <span className="advanced-projector-controls__setting-value">
                  {settings.brightness.gamma.blue.toFixed(1)}
                </span>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'color' && (
          <div className="advanced-projector-controls__color">
            <h4 className="advanced-projector-controls__section-title">色彩設定</h4>
            <div className="advanced-projector-controls__section">
              <h5 className="advanced-projector-controls__subsection-title">色温度</h5>
              <div className="advanced-projector-controls__setting">
                <label htmlFor="color-temperature-kelvin">色温度（K）</label>
                <input
                  id="color-temperature-kelvin"
                  type="range"
                  min="2000"
                  max="10000"
                  step="100"
                  value={settings.color.colorTemperature.kelvin}
                  onChange={(e) => updateColorSettings({ 
                    colorTemperature: { ...settings.color.colorTemperature, kelvin: parseFloat(e.target.value) }
                  })}
                  disabled={disabled}
                />
                <span className="advanced-projector-controls__setting-value">
                  {settings.color.colorTemperature.kelvin}K
                </span>
              </div>
              
              <div className="advanced-projector-controls__setting">
                <label htmlFor="color-temperature-tint">色合い</label>
                <input
                  id="color-temperature-tint"
                  type="range"
                  min="-100"
                  max="100"
                  step="1"
                  value={settings.color.colorTemperature.tint}
                  onChange={(e) => updateColorSettings({ 
                    colorTemperature: { ...settings.color.colorTemperature, tint: parseFloat(e.target.value) }
                  })}
                  disabled={disabled}
                />
                <span className="advanced-projector-controls__setting-value">
                  {settings.color.colorTemperature.tint > 0 ? '+' : ''}{settings.color.colorTemperature.tint}
                </span>
              </div>
            </div>
            
            <div className="advanced-projector-controls__section">
              <h5 className="advanced-projector-controls__subsection-title">HSV調整</h5>
              <div className="advanced-projector-controls__setting">
                <label htmlFor="hsv-hue">色相</label>
                <input
                  id="hsv-hue"
                  type="range"
                  min="-180"
                  max="180"
                  step="1"
                  value={settings.color.hsv.hue}
                  onChange={(e) => updateColorSettings({ 
                    hsv: { ...settings.color.hsv, hue: parseFloat(e.target.value) }
                  })}
                  disabled={disabled}
                />
                <span className="advanced-projector-controls__setting-value">
                  {settings.color.hsv.hue}°
                </span>
              </div>
              
              <div className="advanced-projector-controls__setting">
                <label htmlFor="hsv-saturation">彩度</label>
                <input
                  id="hsv-saturation"
                  type="range"
                  min="-100"
                  max="100"
                  step="1"
                  value={settings.color.hsv.saturation}
                  onChange={(e) => updateColorSettings({ 
                    hsv: { ...settings.color.hsv, saturation: parseFloat(e.target.value) }
                  })}
                  disabled={disabled}
                />
                <span className="advanced-projector-controls__setting-value">
                  {settings.color.hsv.saturation > 0 ? '+' : ''}{settings.color.hsv.saturation}
                </span>
              </div>
              
              <div className="advanced-projector-controls__setting">
                <label htmlFor="hsv-value">明度</label>
                <input
                  id="hsv-value"
                  type="range"
                  min="-100"
                  max="100"
                  step="1"
                  value={settings.color.hsv.value}
                  onChange={(e) => updateColorSettings({ 
                    hsv: { ...settings.color.hsv, value: parseFloat(e.target.value) }
                  })}
                  disabled={disabled}
                />
                <span className="advanced-projector-controls__setting-value">
                  {settings.color.hsv.value > 0 ? '+' : ''}{settings.color.hsv.value}
                </span>
              </div>
            </div>
            
            <div className="advanced-projector-controls__section">
              <h5 className="advanced-projector-controls__subsection-title">カラープロファイル</h5>
              <div className="advanced-projector-controls__setting">
                <label htmlFor="input-profile">入力プロファイル</label>
                <select
                  id="input-profile"
                  value={settings.color.colorProfile.input}
                  onChange={(e) => updateColorSettings({ 
                    colorProfile: { ...settings.color.colorProfile, input: e.target.value as any }
                  })}
                  disabled={disabled}
                >
                  <option value="sRGB">sRGB</option>
                  <option value="AdobeRGB">Adobe RGB</option>
                  <option value="DCI-P3">DCI-P3</option>
                  <option value="Rec2020">Rec.2020</option>
                </select>
              </div>
              
              <div className="advanced-projector-controls__setting">
                <label htmlFor="output-profile">出力プロファイル</label>
                <select
                  id="output-profile"
                  value={settings.color.colorProfile.output}
                  onChange={(e) => updateColorSettings({ 
                    colorProfile: { ...settings.color.colorProfile, output: e.target.value as any }
                  })}
                  disabled={disabled}
                >
                  <option value="sRGB">sRGB</option>
                  <option value="AdobeRGB">Adobe RGB</option>
                  <option value="DCI-P3">DCI-P3</option>
                  <option value="Rec2020">Rec.2020</option>
                </select>
              </div>
              
              <div className="advanced-projector-controls__setting">
                <label htmlFor="rendering-intent">レンダリングインテント</label>
                <select
                  id="rendering-intent"
                  value={settings.color.colorProfile.renderingIntent}
                  onChange={(e) => updateColorSettings({ 
                    colorProfile: { ...settings.color.colorProfile, renderingIntent: e.target.value as any }
                  })}
                  disabled={disabled}
                >
                  <option value="perceptual">知覚的</option>
                  <option value="relative">相対的</option>
                  <option value="saturation">彩度維持</option>
                  <option value="absolute">絶対的</option>
                </select>
              </div>
            </div>
            
            <div className="advanced-projector-controls__section">
              <h5 className="advanced-projector-controls__subsection-title">色覚多様性</h5>
              <div className="advanced-projector-controls__setting">
                <label htmlFor="color-blindness-simulation">シミュレーション</label>
                <select
                  id="color-blindness-simulation"
                  value={settings.color.colorBlindness.simulation}
                  onChange={(e) => updateColorSettings({ 
                    colorBlindness: { ...settings.color.colorBlindness, simulation: e.target.value as any }
                  })}
                  disabled={disabled}
                >
                  <option value="none">なし</option>
                  <option value="protanopia">赤緑色盲（赤覚異常）</option>
                  <option value="deuteranopia">赤緑色盲（緑覚異常）</option>
                  <option value="tritanopia">青黄色盲（青覚異常）</option>
                </select>
              </div>
              
              <div className="advanced-projector-controls__setting">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={settings.color.colorBlindness.compensation}
                    onChange={(e) => updateColorSettings({ 
                      colorBlindness: { ...settings.color.colorBlindness, compensation: e.target.checked }
                    })}
                    disabled={disabled}
                  />
                  <span className="toggle-slider"></span>
                  色覚多様性補正を有効にする
                </label>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'environment' && (
          <div className="advanced-projector-controls__environment">
            <h4 className="advanced-projector-controls__section-title">環境設定</h4>
            <div className="advanced-projector-controls__section">
              <h5 className="advanced-projector-controls__subsection-title">環境光</h5>
              <div className="advanced-projector-controls__setting">
                <label htmlFor="ambient-light">環境光レベル</label>
                <input
                  id="ambient-light"
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={settings.environment.ambientLight}
                  onChange={(e) => updateEnvironmentSettings({ 
                    ambientLight: parseFloat(e.target.value)
                  })}
                  disabled={disabled}
                />
                <span className="advanced-projector-controls__setting-value">
                  {settings.environment.ambientLight.toFixed(2)}
                </span>
              </div>
              
              <div className="advanced-projector-controls__setting-description">
                <p>環境光のレベルを調整します。0は完全な暗室、1.0は明るい屋外環境を表します。</p>
              </div>
            </div>
            
            <div className="advanced-projector-controls__section">
              <h5 className="advanced-projector-controls__subsection-title">スクリーン設定</h5>
              <div className="advanced-projector-controls__setting">
                <label htmlFor="screen-gain">スクリーンゲイン</label>
                <input
                  id="screen-gain"
                  type="range"
                  min="0.8"
                  max="2.5"
                  step="0.1"
                  value={settings.environment.screenGain}
                  onChange={(e) => updateEnvironmentSettings({ 
                    screenGain: parseFloat(e.target.value)
                  })}
                  disabled={disabled}
                />
                <span className="advanced-projector-controls__setting-value">
                  {settings.environment.screenGain.toFixed(1)}
                </span>
              </div>
              
              <div className="advanced-projector-controls__setting">
                <label htmlFor="throw-distance">投影距離（m）</label>
                <input
                  id="throw-distance"
                  type="range"
                  min="1.0"
                  max="10.0"
                  step="0.1"
                  value={settings.environment.throwDistance}
                  onChange={(e) => updateEnvironmentSettings({ 
                    throwDistance: parseFloat(e.target.value)
                  })}
                  disabled={disabled}
                />
                <span className="advanced-projector-controls__setting-value">
                  {settings.environment.throwDistance.toFixed(1)}m
                </span>
              </div>
              
              <div className="advanced-projector-controls__setting">
                <label htmlFor="screen-type">スクリーンタイプ</label>
                <select
                  id="screen-type"
                  value={settings.environment.screenType}
                  onChange={(e) => updateEnvironmentSettings({ 
                    screenType: e.target.value as any }
                  )}
                  disabled={disabled}
                >
                  <option value="matte">マット（拡散）</option>
                  <option value="glass_beaded">グラスビーズ（反射）</option>
                  <option value="high_gain">ハイゲイン（高反射）</option>
                </select>
              </div>
              
              <div className="advanced-projector-controls__setting-description">
                <p>スクリーンの特性を調整します。投影環境に合わせて選択してください。</p>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {showAdvanced && (
        <div className="advanced-projector-controls__actions">
          <div className="advanced-projector-controls__presets">
            <h4>プリセット</h4>
            <div className="advanced-projector-controls__preset-buttons">
              <button
                type="button"
                onClick={() => handlePreset('indoor')}
                disabled={disabled}
                className="advanced-projector-controls__preset-button"
              >
                屋内用
              </button>
              
              <button
                type="button"
                onClick={() => handlePreset('outdoor')}
                disabled={disabled}
                className="advanced-projector-controls__preset-button"
              >
                屋外用
              </button>
              
              <button
                type="button"
                onClick={() => handlePreset('large_venue')}
                disabled={disabled}
                className="advanced-projector-controls__preset-button"
              >
                大会場用
              </button>
            </div>
          </div>
          
          <div className="advanced-projector-controls__reset">
            <button
              type="button"
              onClick={handleReset}
              disabled={disabled}
              className="advanced-projector-controls__reset-button"
            >
              リセット
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedProjectorControls;