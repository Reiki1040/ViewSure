import { useCallback, useEffect, useState } from 'react';
import type { ResolutionSettings } from '../types/projector';
// TexImageSourceはグローバル型

interface ResolutionControlsProps {
  settings: ResolutionSettings;
  onSettingsChange: (settings: ResolutionSettings) => void;
  disabled?: boolean;
  sourceDimensions?: { width: number; height: number };
}

const ResolutionControls = ({
  settings,
  onSettingsChange,
  disabled = false,
  sourceDimensions
}: ResolutionControlsProps) => {
  const [customWidth, setCustomWidth] = useState(settings.targetWidth?.toString() || '');
  const [customHeight, setCustomHeight] = useState(settings.targetHeight?.toString() || '');
  const [aspectRatioLocked, setAspectRatioLocked] = useState(settings.maintainAspectRatio);
  
  // アスペクト比の計算
  const sourceAspectRatio = sourceDimensions 
    ? sourceDimensions.width / sourceDimensions.height 
    : 16 / 9; // デフォルト16:9
  
  // カスタム寸法の変更ハンドラ
  const handleCustomWidthChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCustomWidth(value);
    
    const width = parseInt(value, 10);
    if (!isNaN(width) && width > 0) {
      const newSettings = { ...settings };
      
      if (aspectRatioLocked && sourceDimensions) {
        // アスペクト比を維持して高さを計算
        const height = Math.round(width / sourceAspectRatio);
        newSettings.targetWidth = width;
        newSettings.targetHeight = height;
        setCustomHeight(height.toString());
      } else {
        newSettings.targetWidth = width;
      }
      
      onSettingsChange(newSettings);
    }
  }, [settings, aspectRatioLocked, sourceDimensions, sourceAspectRatio, onSettingsChange]);
  
  const handleCustomHeightChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCustomHeight(value);
    
    const height = parseInt(value, 10);
    if (!isNaN(height) && height > 0) {
      const newSettings = { ...settings };
      
      if (aspectRatioLocked && sourceDimensions) {
        // アスペクト比を維持して幅を計算
        const width = Math.round(height * sourceAspectRatio);
        newSettings.targetHeight = height;
        newSettings.targetWidth = width;
        setCustomWidth(width.toString());
      } else {
        newSettings.targetHeight = height;
      }
      
      onSettingsChange(newSettings);
    }
  }, [settings, aspectRatioLocked, sourceDimensions, sourceAspectRatio, onSettingsChange]);
  
  // アスペクト比ロックの切り替え
  const handleAspectRatioLockToggle = useCallback(() => {
    const newLocked = !aspectRatioLocked;
    setAspectRatioLocked(newLocked);
    
    const newSettings = { ...settings, maintainAspectRatio: newLocked };
    onSettingsChange(newSettings);
  }, [settings, onSettingsChange]);
  
  // スケーリングアルゴリズムの変更
  const handleScalingAlgorithmChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const algorithm = e.target.value as ResolutionSettings['scalingAlgorithm'];
    const newSettings = { ...settings, scalingAlgorithm: algorithm };
    onSettingsChange(newSettings);
  }, [settings, onSettingsChange]);
  
  // シャープネス設定の変更
  const handleSharpeningToggle = useCallback(() => {
    const newSettings = { 
      ...settings, 
      sharpening: { 
        ...settings.sharpening, 
        enabled: !settings.sharpening.enabled 
      } 
    };
    onSettingsChange(newSettings);
  }, [settings, onSettingsChange]);
  
  const handleSharpeningStrengthChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const strength = parseFloat(e.target.value);
    if (!isNaN(strength)) {
      const newSettings = { 
        ...settings, 
        sharpening: { 
          ...settings.sharpening, 
          strength 
        } 
      };
      onSettingsChange(newSettings);
    }
  }, [settings, onSettingsChange]);
  
  const handleSharpeningRadiusChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const radius = parseFloat(e.target.value);
    if (!isNaN(radius)) {
      const newSettings = { 
        ...settings, 
        sharpening: { 
          ...settings.sharpening, 
          radius 
        } 
      };
      onSettingsChange(newSettings);
    }
  }, [settings, onSettingsChange]);
  
  // ノイズリダクション設定の変更
  const handleNoiseReductionToggle = useCallback(() => {
    const newSettings = { 
      ...settings, 
      noiseReduction: { 
        ...settings.noiseReduction, 
        enabled: !settings.noiseReduction.enabled 
      } 
    };
    onSettingsChange(newSettings);
  }, [settings, onSettingsChange]);
  
  const handleNoiseReductionStrengthChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const strength = parseFloat(e.target.value);
    if (!isNaN(strength)) {
      const newSettings = { 
        ...settings, 
        noiseReduction: { 
          ...settings.noiseReduction, 
          strength 
        } 
      };
      onSettingsChange(newSettings);
    }
  }, [settings, onSettingsChange]);
  
  // プリセットボタンの処理
  const handleReset = useCallback(() => {
    const newSettings: ResolutionSettings = {
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
    };
    
    onSettingsChange(newSettings);
    setCustomWidth('');
    setCustomHeight('');
  }, [onSettingsChange]);
  
  // ソース寸法が変更された場合の同期
  useEffect(() => {
    if (sourceDimensions) {
      if (!settings.targetWidth) {
        setCustomWidth(sourceDimensions.width.toString());
      }
      if (!settings.targetHeight) {
        setCustomHeight(sourceDimensions.height.toString());
      }
    }
  }, [sourceDimensions, settings.targetWidth, settings.targetHeight]);
  
  return (
    <div className="resolution-controls">
      <h3 className="resolution-controls__title">解像度設定</h3>
      
      {sourceDimensions && (
        <div className="resolution-controls__source-info">
          <span>元の解像度: {sourceDimensions.width} × {sourceDimensions.height}</span>
          <span>アスペクト比: {sourceAspectRatio.toFixed(2)}:1</span>
        </div>
      )}
      
      <div className="resolution-controls__dimensions">
        <div className="resolution-controls__dimension">
          <label htmlFor="resolution-width">幅</label>
          <input
            id="resolution-width"
            type="number"
            value={customWidth}
            onChange={handleCustomWidthChange}
            disabled={disabled}
            min="1"
            max="4096"
            placeholder="自動"
          />
        </div>
        
        <div className="resolution-controls__aspect-lock">
          <button
            type="button"
            onClick={handleAspectRatioLockToggle}
            disabled={disabled}
            className={`resolution-controls__lock-button ${aspectRatioLocked ? 'locked' : 'unlocked'}`}
            aria-label={aspectRatioLocked ? 'アスペクト比を固定' : 'アスペクト比を解放'}
          >
            {aspectRatioLocked ? '🔒' : '🔓'}
          </button>
        </div>
        
        <div className="resolution-controls__dimension">
          <label htmlFor="resolution-height">高さ</label>
          <input
            id="resolution-height"
            type="number"
            value={customHeight}
            onChange={handleCustomHeightChange}
            disabled={disabled || aspectRatioLocked}
            min="1"
            max="4096"
            placeholder="自動"
          />
        </div>
      </div>
      
      <div className="resolution-controls__algorithm">
        <label htmlFor="scaling-algorithm">スケーリングアルゴリズム</label>
        <select
          id="scaling-algorithm"
          value={settings.scalingAlgorithm}
          onChange={handleScalingAlgorithmChange}
          disabled={disabled}
        >
          <option value="nearest">最近傍補間</option>
          <option value="bilinear">バイリニア補間</option>
          <option value="bicubic">バイキュービック補間</option>
          <option value="lanczos">ランチョス補間</option>
        </select>
      </div>
      
      <div className="resolution-controls__sharpening">
        <div className="resolution-controls__section-header">
          <h4>シャープネス</h4>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={settings.sharpening.enabled}
              onChange={handleSharpeningToggle}
              disabled={disabled}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
        
        {settings.sharpening.enabled && (
          <div className="resolution-controls__sharpening-settings">
            <div className="resolution-controls__setting">
              <label htmlFor="sharpening-strength">強度</label>
              <input
                id="sharpening-strength"
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={settings.sharpening.strength}
                onChange={handleSharpeningStrengthChange}
                disabled={disabled}
              />
              <span className="resolution-controls__setting-value">
                {settings.sharpening.strength.toFixed(1)}
              </span>
            </div>
            
            <div className="resolution-controls__setting">
              <label htmlFor="sharpening-radius">半径</label>
              <input
                id="sharpening-radius"
                type="range"
                min="0.5"
                max="5"
                step="0.1"
                value={settings.sharpening.radius}
                onChange={handleSharpeningRadiusChange}
                disabled={disabled}
              />
              <span className="resolution-controls__setting-value">
                {settings.sharpening.radius.toFixed(1)}
              </span>
            </div>
          </div>
        )}
      </div>
      
      <div className="resolution-controls__noise-reduction">
        <div className="resolution-controls__section-header">
          <h4>ノイズリダクション</h4>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={settings.noiseReduction.enabled}
              onChange={handleNoiseReductionToggle}
              disabled={disabled}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
        
        {settings.noiseReduction.enabled && (
          <div className="resolution-controls__noise-reduction-settings">
            <div className="resolution-controls__setting">
              <label htmlFor="noise-reduction-strength">強度</label>
              <input
                id="noise-reduction-strength"
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={settings.noiseReduction.strength}
                onChange={handleNoiseReductionStrengthChange}
                disabled={disabled}
              />
              <span className="resolution-controls__setting-value">
                {settings.noiseReduction.strength.toFixed(1)}
              </span>
            </div>
          </div>
        )}
      </div>
      
      <div className="resolution-controls__actions">
        <button
          type="button"
          onClick={handleReset}
          disabled={disabled}
          className="resolution-controls__reset-button"
        >
          リセット
        </button>
      </div>
    </div>
  );
};

export default ResolutionControls;