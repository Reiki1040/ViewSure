import { useCallback } from 'react';
import type { EnvironmentSettings } from '../types/projector';

interface EnvironmentControlsProps {
  settings: EnvironmentSettings;
  onSettingsChange: (settings: EnvironmentSettings) => void;
  disabled?: boolean;
}

const EnvironmentControls = ({
  settings,
  onSettingsChange,
  disabled = false
}: EnvironmentControlsProps) => {
  // 環境光の変更ハンドラ
  const handleAmbientLightChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const ambientLight = parseFloat(e.target.value);
    if (!isNaN(ambientLight)) {
      onSettingsChange({
        ...settings,
        ambientLight
      });
    }
  }, [settings, onSettingsChange]);
  
  // スクリーンゲインの変更ハンドラ
  const handleScreenGainChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const screenGain = parseFloat(e.target.value);
    if (!isNaN(screenGain)) {
      onSettingsChange({
        ...settings,
        screenGain
      });
    }
  }, [settings, onSettingsChange]);
  
  // 投影距離の変更ハンドラ
  const handleThrowDistanceChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const throwDistance = parseFloat(e.target.value);
    if (!isNaN(throwDistance)) {
      onSettingsChange({
        ...settings,
        throwDistance
      });
    }
  }, [settings, onSettingsChange]);
  
  // スクリーンタイプの変更ハンドラ
  const handleScreenTypeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const screenType = e.target.value as 'matte' | 'glass_beaded' | 'high_gain';
    onSettingsChange({
      ...settings,
      screenType
    });
  }, [settings, onSettingsChange]);
  
  // プリセットの実行
  const handleReset = useCallback(() => {
    const defaultSettings: EnvironmentSettings = {
      ambientLight: 0.2,
      screenGain: 1.0,
      throwDistance: 3.0,
      screenType: 'matte'
    };
    
    onSettingsChange(defaultSettings);
  }, [onSettingsChange]);
  
  return (
    <div className="environment-controls">
      <h3 className="environment-controls__title">環境設定</h3>
      
      <div className="environment-controls__section">
        <h4 className="environment-controls__section-title">環境光</h4>
        <div className="environment-controls__setting">
          <label htmlFor="ambient-light">環境光レベル</label>
          <input
            id="ambient-light"
            type="range"
            min="0.0"
            max="1.0"
            step="0.05"
            value={settings.ambientLight}
            onChange={handleAmbientLightChange}
            disabled={disabled}
          />
          <span className="environment-controls__setting-value">
            {settings.ambientLight.toFixed(2)}
          </span>
        </div>
        
        <div className="environment-controls__setting-description">
          <p>環境光のレベルを調整します。0は完全な暗室、1.0は明るい屋外環境を表します。</p>
        </div>
      </div>
      
      <div className="environment-controls__section">
        <h4 className="environment-controls__section-title">スクリーン設定</h4>
        <div className="environment-controls__setting">
          <label htmlFor="screen-gain">スクリーンゲイン</label>
          <input
            id="screen-gain"
            type="range"
            min="0.8"
            max="2.5"
            step="0.1"
            value={settings.screenGain}
            onChange={handleScreenGainChange}
            disabled={disabled}
          />
          <span className="environment-controls__setting-value">
            {settings.screenGain.toFixed(1)}
          </span>
        </div>
        
        <div className="environment-controls__setting">
          <label htmlFor="throw-distance">投影距離（m）</label>
          <input
            id="throw-distance"
            type="range"
            min="1.0"
            max="10.0"
            step="0.1"
            value={settings.throwDistance}
            onChange={handleThrowDistanceChange}
            disabled={disabled}
          />
          <span className="environment-controls__setting-value">
            {settings.throwDistance.toFixed(1)}m
          </span>
        </div>
        
        <div className="environment-controls__setting">
          <label htmlFor="screen-type">スクリーンタイプ</label>
          <select
            id="screen-type"
            value={settings.screenType}
            onChange={handleScreenTypeChange}
            disabled={disabled}
          >
            <option value="matte">マット（拡散）</option>
            <option value="glass_beaded">グラスビーズ（反射）</option>
            <option value="high_gain">ハイゲイン（高反射）</option>
          </select>
        </div>
        
        <div className="environment-controls__setting-description">
          <p>スクリーンの特性を調整します。投影環境に合わせて選択してください。</p>
        </div>
      </div>
      
      <div className="environment-controls__actions">
        <button
          type="button"
          onClick={handleReset}
          disabled={disabled}
          className="environment-controls__reset-button"
        >
          リセット
        </button>
      </div>
    </div>
  );
};

export default EnvironmentControls;