import { useCallback } from 'react';
import type { AdvancedColorSettings } from '../types/projector';

interface AdvancedColorControlsProps {
  settings: AdvancedColorSettings;
  onSettingsChange: (settings: AdvancedColorSettings) => void;
  disabled?: boolean;
}

const AdvancedColorControls = ({
  settings,
  onSettingsChange,
  disabled = false
}: AdvancedColorControlsProps) => {
  // 色温度調整の変更ハンドラ
  const handleColorTemperatureChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const kelvin = parseFloat(e.target.value);
    if (!isNaN(kelvin)) {
      onSettingsChange({
        ...settings,
        colorTemperature: {
          ...settings.colorTemperature,
          kelvin
        }
      });
    }
  }, [settings, onSettingsChange]);
  
  const handleColorTemperatureTintChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const tint = parseFloat(e.target.value);
    if (!isNaN(tint)) {
      onSettingsChange({
        ...settings,
        colorTemperature: {
          ...settings.colorTemperature,
          tint
        }
      });
    }
  }, [settings, onSettingsChange]);
  
  // HSV調整の変更ハンドラ
  const handleHueChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const hue = parseFloat(e.target.value);
    if (!isNaN(hue)) {
      onSettingsChange({
        ...settings,
        hsv: {
          ...settings.hsv,
          hue
        }
      });
    }
  }, [settings, onSettingsChange]);
  
  const handleSaturationChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const saturation = parseFloat(e.target.value);
    if (!isNaN(saturation)) {
      onSettingsChange({
        ...settings,
        hsv: {
          ...settings.hsv,
          saturation
        }
      });
    }
  }, [settings, onSettingsChange]);
  
  const handleValueChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value)) {
      onSettingsChange({
        ...settings,
        hsv: {
          ...settings.hsv,
          value
        }
      });
    }
  }, [settings, onSettingsChange]);
  
  // カラープロファイル設定の変更ハンドラ
  const handleInputProfileChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const input = e.target.value as 'sRGB' | 'AdobeRGB' | 'DCI-P3' | 'Rec2020';
    onSettingsChange({
      ...settings,
      colorProfile: {
        ...settings.colorProfile,
        input
      }
    });
  }, [settings, onSettingsChange]);
  
  const handleOutputProfileChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const output = e.target.value as 'sRGB' | 'AdobeRGB' | 'DCI-P3' | 'Rec2020';
    onSettingsChange({
      ...settings,
      colorProfile: {
        ...settings.colorProfile,
        output
      }
    });
  }, [settings, onSettingsChange]);
  
  const handleRenderingIntentChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const renderingIntent = e.target.value as 'perceptual' | 'relative' | 'saturation' | 'absolute';
    onSettingsChange({
      ...settings,
      colorProfile: {
        ...settings.colorProfile,
        renderingIntent
      }
    });
  }, [settings, onSettingsChange]);
  
  // 色補正設定の変更ハンドラ
  const handleColorCorrectionToggle = useCallback(() => {
    onSettingsChange({
      ...settings,
      colorCorrection: {
        ...settings.colorCorrection,
        enabled: !settings.colorCorrection.enabled
      }
    });
  }, [settings, onSettingsChange]);
  
  // 色覚多様性設定の変更ハンドラ
  const handleColorBlindnessSimulationChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const simulation = e.target.value as 'protanopia' | 'deuteranopia' | 'tritanopia';
    onSettingsChange({
      ...settings,
      colorBlindness: {
        ...settings.colorBlindness,
        simulation
      }
    });
  }, [settings, onSettingsChange]);
  
  const handleColorBlindnessCompensationToggle = useCallback(() => {
    onSettingsChange({
      ...settings,
      colorBlindness: {
        ...settings.colorBlindness,
        compensation: !settings.colorBlindness.compensation
      }
    });
  }, [settings, onSettingsChange]);
  
  // プリセットの実行
  const handleReset = useCallback(() => {
    const defaultSettings: AdvancedColorSettings = {
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
        simulation: 'protanopia',
        compensation: false
      }
    };
    
    onSettingsChange(defaultSettings);
  }, [onSettingsChange]);
  
  return (
    <div className="advanced-color-controls">
      <h3 className="advanced-color-controls__title">色彩設定</h3>
      
      <div className="advanced-color-controls__section">
        <h4 className="advanced-color-controls__section-title">色温度</h4>
        <div className="advanced-color-controls__setting">
          <label htmlFor="color-temperature-kelvin">色温度（K）</label>
          <input
            id="color-temperature-kelvin"
            type="range"
            min="2000"
            max="10000"
            step="100"
            value={settings.colorTemperature.kelvin}
            onChange={handleColorTemperatureChange}
            disabled={disabled}
          />
          <span className="advanced-color-controls__setting-value">
            {settings.colorTemperature.kelvin}K
          </span>
        </div>
        
        <div className="advanced-color-controls__setting">
          <label htmlFor="color-temperature-tint">色合い</label>
          <input
            id="color-temperature-tint"
            type="range"
            min="-100"
            max="100"
            step="1"
            value={settings.colorTemperature.tint}
            onChange={handleColorTemperatureTintChange}
            disabled={disabled}
          />
          <span className="advanced-color-controls__setting-value">
            {settings.colorTemperature.tint > 0 ? '+' : ''}{settings.colorTemperature.tint}
          </span>
        </div>
      </div>
      
      <div className="advanced-color-controls__section">
        <h4 className="advanced-color-controls__section-title">HSV調整</h4>
        <div className="advanced-color-controls__setting">
          <label htmlFor="hsv-hue">色相</label>
          <input
            id="hsv-hue"
            type="range"
            min="-180"
            max="180"
            step="1"
            value={settings.hsv.hue}
            onChange={handleHueChange}
            disabled={disabled}
          />
          <span className="advanced-color-controls__setting-value">
            {settings.hsv.hue}°
          </span>
        </div>
        
        <div className="advanced-color-controls__setting">
          <label htmlFor="hsv-saturation">彩度</label>
          <input
            id="hsv-saturation"
            type="range"
            min="-100"
            max="100"
            step="1"
            value={settings.hsv.saturation}
            onChange={handleSaturationChange}
            disabled={disabled}
          />
          <span className="advanced-color-controls__setting-value">
            {settings.hsv.saturation > 0 ? '+' : ''}{settings.hsv.saturation}
          </span>
        </div>
        
        <div className="advanced-color-controls__setting">
          <label htmlFor="hsv-value">明度</label>
          <input
            id="hsv-value"
            type="range"
            min="-100"
            max="100"
            step="1"
            value={settings.hsv.value}
            onChange={handleValueChange}
            disabled={disabled}
          />
          <span className="advanced-color-controls__setting-value">
            {settings.hsv.value > 0 ? '+' : ''}{settings.hsv.value}
          </span>
        </div>
      </div>
      
      <div className="advanced-color-controls__section">
        <h4 className="advanced-color-controls__section-title">カラープロファイル</h4>
        <div className="advanced-color-controls__setting">
          <label htmlFor="input-profile">入力プロファイル</label>
          <select
            id="input-profile"
            value={settings.colorProfile.input}
            onChange={handleInputProfileChange}
            disabled={disabled}
          >
            <option value="sRGB">sRGB</option>
            <option value="AdobeRGB">Adobe RGB</option>
            <option value="DCI-P3">DCI-P3</option>
            <option value="Rec2020">Rec.2020</option>
          </select>
        </div>
        
        <div className="advanced-color-controls__setting">
          <label htmlFor="output-profile">出力プロファイル</label>
          <select
            id="output-profile"
            value={settings.colorProfile.output}
            onChange={handleOutputProfileChange}
            disabled={disabled}
          >
            <option value="sRGB">sRGB</option>
            <option value="AdobeRGB">Adobe RGB</option>
            <option value="DCI-P3">DCI-P3</option>
            <option value="Rec2020">Rec.2020</option>
          </select>
        </div>
        
        <div className="advanced-color-controls__setting">
          <label htmlFor="rendering-intent">レンダリングインテント</label>
          <select
            id="rendering-intent"
            value={settings.colorProfile.renderingIntent}
            onChange={handleRenderingIntentChange}
            disabled={disabled}
          >
            <option value="perceptual">知覚的</option>
            <option value="relative">相対的</option>
            <option value="saturation">彩度維持</option>
            <option value="absolute">絶対的</option>
          </select>
        </div>
      </div>
      
      <div className="advanced-color-controls__section">
        <h4 className="advanced-color-controls__section-title">色補正</h4>
        <div className="advanced-color-controls__setting">
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={settings.colorCorrection.enabled}
              onChange={handleColorCorrectionToggle}
              disabled={disabled}
            />
            <span className="toggle-slider"></span>
            色補正を有効にする
          </label>
        </div>
      </div>
      
      <div className="advanced-color-controls__section">
        <h4 className="advanced-color-controls__section-title">色覚多様性</h4>
        <div className="advanced-color-controls__setting">
          <label htmlFor="color-blindness-simulation">シミュレーション</label>
          <select
            id="color-blindness-simulation"
            value={settings.colorBlindness.simulation}
            onChange={handleColorBlindnessSimulationChange}
            disabled={disabled}
          >
            <option value="protanopia">赤緑色盲（赤覚異常）</option>
            <option value="deuteranopia">赤緑色盲（緑覚異常）</option>
            <option value="tritanopia">青黄色盲（青覚異常）</option>
          </select>
        </div>
        
        <div className="advanced-color-controls__setting">
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={settings.colorBlindness.compensation}
              onChange={handleColorBlindnessCompensationToggle}
              disabled={disabled}
            />
            <span className="toggle-slider"></span>
            色覚多様性補正を有効にする
          </label>
        </div>
      </div>
      
      <div className="advanced-color-controls__actions">
        <button
          type="button"
          onClick={handleReset}
          disabled={disabled}
          className="advanced-color-controls__reset-button"
        >
          リセット
        </button>
      </div>
    </div>
  );
};

export default AdvancedColorControls;