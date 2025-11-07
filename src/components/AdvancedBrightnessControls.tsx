import { useCallback } from 'react';
import type { AdvancedBrightnessSettings } from '../types/projector';

interface AdvancedBrightnessControlsProps {
  settings: AdvancedBrightnessSettings;
  onSettingsChange: (settings: AdvancedBrightnessSettings) => void;
  disabled?: boolean;
}

const AdvancedBrightnessControls = ({
  settings,
  onSettingsChange,
  disabled = false
}: AdvancedBrightnessControlsProps) => {
  // グローバル明るさの変更ハンドラ
  const handleGlobalBrightnessChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const globalBrightness = parseFloat(e.target.value);
    if (!isNaN(globalBrightness)) {
      onSettingsChange({
        ...settings,
        globalBrightness
      });
    }
  }, [settings, onSettingsChange]);
  
  // ハイライト調整の変更ハンドラ
  const handleHighlightsAdjustmentChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const adjustment = parseFloat(e.target.value);
    if (!isNaN(adjustment)) {
      onSettingsChange({
        ...settings,
        highlights: {
          ...settings.highlights,
          adjustment
        }
      });
    }
  }, [settings, onSettingsChange]);
  
  const handleHighlightsThresholdChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const threshold = parseFloat(e.target.value);
    if (!isNaN(threshold)) {
      onSettingsChange({
        ...settings,
        highlights: {
          ...settings.highlights,
          threshold
        }
      });
    }
  }, [settings, onSettingsChange]);
  
  // シャドウ調整の変更ハンドラ
  const handleShadowsAdjustmentChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const adjustment = parseFloat(e.target.value);
    if (!isNaN(adjustment)) {
      onSettingsChange({
        ...settings,
        shadows: {
          ...settings.shadows,
          adjustment
        }
      });
    }
  }, [settings, onSettingsChange]);
  
  const handleShadowsThresholdChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const threshold = parseFloat(e.target.value);
    if (!isNaN(threshold)) {
      onSettingsChange({
        ...settings,
        shadows: {
          ...settings.shadows,
          threshold
        }
      });
    }
  }, [settings, onSettingsChange]);
  
  // ガンマ調整の変更ハンドラ
  const handleGammaRedChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const red = parseFloat(e.target.value);
    if (!isNaN(red)) {
      onSettingsChange({
        ...settings,
        gamma: {
          ...settings.gamma,
          red
        }
      });
    }
  }, [settings, onSettingsChange]);
  
  const handleGammaGreenChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const green = parseFloat(e.target.value);
    if (!isNaN(green)) {
      onSettingsChange({
        ...settings,
        gamma: {
          ...settings.gamma,
          green
        }
      });
    }
  }, [settings, onSettingsChange]);
  
  const handleGammaBlueChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const blue = parseFloat(e.target.value);
    if (!isNaN(blue)) {
      onSettingsChange({
        ...settings,
        gamma: {
          ...settings.gamma,
          blue
        }
      });
    }
  }, [settings, onSettingsChange]);
  
  // HDRからSDR変換の変更ハンドラ
  const handleHdrToSdrToggle = useCallback(() => {
    onSettingsChange({
      ...settings,
      hdrToSdr: {
        ...settings.hdrToSdr,
        enabled: !settings.hdrToSdr.enabled
      }
    });
  }, [settings, onSettingsChange]);
  
  const handleHdrToSdrNitsChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const nits = parseFloat(e.target.value);
    if (!isNaN(nits)) {
      onSettingsChange({
        ...settings,
        hdrToSdr: {
          ...settings.hdrToSdr,
          nits
        }
      });
    }
  }, [settings, onSettingsChange]);
  
  const handleHdrToSdrMethodChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const method = e.target.value as 'reinhard' | 'aces' | 'hable';
    onSettingsChange({
      ...settings,
      hdrToSdr: {
        ...settings.hdrToSdr,
        method
      }
    });
  }, [settings, onSettingsChange]);
  
  // 自動調整の変更ハンドラ
  const handleAutoAdjustmentToggle = useCallback(() => {
    onSettingsChange({
      ...settings,
      autoAdjustment: {
        ...settings.autoAdjustment,
        enabled: !settings.autoAdjustment.enabled
      }
    });
  }, [settings, onSettingsChange]);
  
  const handleAutoAdjustmentTargetLuminanceChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const targetLuminance = parseFloat(e.target.value);
    if (!isNaN(targetLuminance)) {
      onSettingsChange({
        ...settings,
        autoAdjustment: {
          ...settings.autoAdjustment,
          targetLuminance
        }
      });
    }
  }, [settings, onSettingsChange]);
  
  const handleAutoAdjustmentAdaptationSpeedChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const adaptationSpeed = parseFloat(e.target.value);
    if (!isNaN(adaptationSpeed)) {
      onSettingsChange({
        ...settings,
        autoAdjustment: {
          ...settings.autoAdjustment,
          adaptationSpeed
        }
      });
    }
  }, [settings, onSettingsChange]);
  
  return (
    <div className="advanced-brightness-controls">
      <h3 className="advanced-brightness-controls__title">明るさ設定</h3>
      
      <div className="advanced-brightness-controls__section">
        <h4 className="advanced-brightness-controls__section-title">グローバル明るさ</h4>
        <div className="advanced-brightness-controls__setting">
          <label htmlFor="global-brightness">明るさ</label>
          <input
            id="global-brightness"
            type="range"
            min="-100"
            max="100"
            step="1"
            value={settings.globalBrightness}
            onChange={handleGlobalBrightnessChange}
            disabled={disabled}
          />
          <span className="advanced-brightness-controls__setting-value">
            {settings.globalBrightness}
          </span>
        </div>
      </div>
      
      <div className="advanced-brightness-controls__section">
        <h4 className="advanced-brightness-controls__section-title">ハイライト調整</h4>
        <div className="advanced-brightness-controls__setting">
          <label htmlFor="highlights-adjustment">調整量</label>
          <input
            id="highlights-adjustment"
            type="range"
            min="-100"
            max="100"
            step="1"
            value={settings.highlights.adjustment}
            onChange={handleHighlightsAdjustmentChange}
            disabled={disabled}
          />
          <span className="advanced-brightness-controls__setting-value">
            {settings.highlights.adjustment}
          </span>
        </div>
        
        <div className="advanced-brightness-controls__setting">
          <label htmlFor="highlights-threshold">しきい値</label>
          <input
            id="highlights-threshold"
            type="range"
            min="0.5"
            max="1.0"
            step="0.05"
            value={settings.highlights.threshold}
            onChange={handleHighlightsThresholdChange}
            disabled={disabled}
          />
          <span className="advanced-brightness-controls__setting-value">
            {settings.highlights.threshold.toFixed(2)}
          </span>
        </div>
      </div>
      
      <div className="advanced-brightness-controls__section">
        <h4 className="advanced-brightness-controls__section-title">シャドウ調整</h4>
        <div className="advanced-brightness-controls__setting">
          <label htmlFor="shadows-adjustment">調整量</label>
          <input
            id="shadows-adjustment"
            type="range"
            min="-100"
            max="100"
            step="1"
            value={settings.shadows.adjustment}
            onChange={handleShadowsAdjustmentChange}
            disabled={disabled}
          />
          <span className="advanced-brightness-controls__setting-value">
            {settings.shadows.adjustment}
          </span>
        </div>
        
        <div className="advanced-brightness-controls__setting">
          <label htmlFor="shadows-threshold">しきい値</label>
          <input
            id="shadows-threshold"
            type="range"
            min="0.0"
            max="0.5"
            step="0.05"
            value={settings.shadows.threshold}
            onChange={handleShadowsThresholdChange}
            disabled={disabled}
          />
          <span className="advanced-brightness-controls__setting-value">
            {settings.shadows.threshold.toFixed(2)}
          </span>
        </div>
      </div>
      
      <div className="advanced-brightness-controls__section">
        <h4 className="advanced-brightness-controls__section-title">ガンマ補正</h4>
        <div className="advanced-brightness-controls__setting">
          <label htmlFor="gamma-red">赤</label>
          <input
            id="gamma-red"
            type="range"
            min="0.1"
            max="3.0"
            step="0.1"
            value={settings.gamma.red}
            onChange={handleGammaRedChange}
            disabled={disabled}
          />
          <span className="advanced-brightness-controls__setting-value">
            {settings.gamma.red.toFixed(1)}
          </span>
        </div>
        
        <div className="advanced-brightness-controls__setting">
          <label htmlFor="gamma-green">緑</label>
          <input
            id="gamma-green"
            type="range"
            min="0.1"
            max="3.0"
            step="0.1"
            value={settings.gamma.green}
            onChange={handleGammaGreenChange}
            disabled={disabled}
          />
          <span className="advanced-brightness-controls__setting-value">
            {settings.gamma.green.toFixed(1)}
          </span>
        </div>
        
        <div className="advanced-brightness-controls__setting">
          <label htmlFor="gamma-blue">青</label>
          <input
            id="gamma-blue"
            type="range"
            min="0.1"
            max="3.0"
            step="0.1"
            value={settings.gamma.blue}
            onChange={handleGammaBlueChange}
            disabled={disabled}
          />
          <span className="advanced-brightness-controls__setting-value">
            {settings.gamma.blue.toFixed(1)}
          </span>
        </div>
      </div>
      
      <div className="advanced-brightness-controls__section">
        <h4 className="advanced-brightness-controls__section-title">HDRからSDR変換</h4>
        <div className="advanced-brightness-controls__setting">
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={settings.hdrToSdr.enabled}
              onChange={handleHdrToSdrToggle}
              disabled={disabled}
            />
            <span className="toggle-slider"></span>
            HDRからSDR変換を有効にする
          </label>
        </div>
        
        {settings.hdrToSdr.enabled && (
          <>
            <div className="advanced-brightness-controls__setting">
              <label htmlFor="hdr-to-sdr-nits">輝度（nits）</label>
              <input
                id="hdr-to-sdr-nits"
                type="range"
                min="100"
                max="10000"
                step="100"
                value={settings.hdrToSdr.nits}
                onChange={handleHdrToSdrNitsChange}
                disabled={disabled}
              />
              <span className="advanced-brightness-controls__setting-value">
                {settings.hdrToSdr.nits}
              </span>
            </div>
            
            <div className="advanced-brightness-controls__setting">
              <label htmlFor="hdr-to-sdr-method">変換方式</label>
              <select
                id="hdr-to-sdr-method"
                value={settings.hdrToSdr.method}
                onChange={handleHdrToSdrMethodChange}
                disabled={disabled}
              >
                <option value="reinhard">Reinhard</option>
                <option value="aces">ACES</option>
                <option value="hable">Hable</option>
              </select>
            </div>
          </>
        )}
      </div>
      
      <div className="advanced-brightness-controls__section">
        <h4 className="advanced-brightness-controls__section-title">自動調整</h4>
        <div className="advanced-brightness-controls__setting">
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={settings.autoAdjustment.enabled}
              onChange={handleAutoAdjustmentToggle}
              disabled={disabled}
            />
            <span className="toggle-slider"></span>
            自動調整を有効にする
          </label>
        </div>
        
        {settings.autoAdjustment.enabled && (
          <>
            <div className="advanced-brightness-controls__setting">
              <label htmlFor="auto-adjustment-target-luminance">目標輝度</label>
              <input
                id="auto-adjustment-target-luminance"
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={settings.autoAdjustment.targetLuminance}
                onChange={handleAutoAdjustmentTargetLuminanceChange}
                disabled={disabled}
              />
              <span className="advanced-brightness-controls__setting-value">
                {settings.autoAdjustment.targetLuminance.toFixed(2)}
              </span>
            </div>
            
            <div className="advanced-brightness-controls__setting">
              <label htmlFor="auto-adjustment-adaptation-speed">適応速度</label>
              <input
                id="auto-adjustment-adaptation-speed"
                type="range"
                min="0.1"
                max="1.0"
                step="0.1"
                value={settings.autoAdjustment.adaptationSpeed}
                onChange={handleAutoAdjustmentAdaptationSpeedChange}
                disabled={disabled}
              />
              <span className="advanced-brightness-controls__setting-value">
                {settings.autoAdjustment.adaptationSpeed.toFixed(1)}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdvancedBrightnessControls;