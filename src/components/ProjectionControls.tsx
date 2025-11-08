import LoadingSpinner from './LoadingSpinner';

type ProjectionControlsProps = {
  brightness: number;
  contrast: number;
  disabled?: boolean;
  onBrightnessChange: (value: number) => void;
  onContrastChange: (value: number) => void;
  onReset: () => void;
  pageCount?: number;
  currentPage?: number;
  onRequestWcagCheck?: () => void;
  wcagDisabled?: boolean;
  onClearWcagAdjustments?: () => void;
  showWcagClearButton?: boolean;
  wcagClearDisabled?: boolean;
  wcagProcessing?: boolean;
  wcagProcessingMessage?: string;
  projectorEnabled?: boolean;
  onToggleProjector?: (enabled: boolean) => void;
};

const quickPresets = [
  {
    id: 'cinema',
    label: 'シネマ',
    description: '暗い会場での上映',
    brightness: 120,
    contrast: 18
  },
  {
    id: 'daylight',
    label: 'デイライト',
    description: '明るい教室を想定',
    brightness: 95,
    contrast: 8
  },
  {
    id: 'neutral',
    label: 'ニュートラル',
    description: '汎用バランス',
    brightness: 100,
    contrast: 0
  }
] as const;

const ProjectionControls = ({
  brightness,
  contrast,
  disabled = false,
  onBrightnessChange,
  onContrastChange,
  onReset,
  pageCount,
  currentPage,
  onRequestWcagCheck,
  wcagDisabled = false,
  onClearWcagAdjustments,
  showWcagClearButton = false,
  wcagClearDisabled = false,
  wcagProcessing = false,
  wcagProcessingMessage,
  projectorEnabled = false,
  onToggleProjector
}: ProjectionControlsProps) => {
  const showPageIndicator = !!pageCount && !!currentPage;

  const handlePresetApply = (preset: (typeof quickPresets)[number]) => {
    if (disabled) {
      return;
    }
    onBrightnessChange(preset.brightness);
    onContrastChange(preset.contrast);
  };

  return (
    <section className="controls" aria-labelledby="controls-title">
      <div className="controls__heading">
        <div>
          <p className="section-eyebrow">Projection Studio</p>
          <h2 id="controls-title" className="section-title">
            プロジェクター設定
          </h2>
          <p className="section-subtitle">会場の明るさやスクリーンにあわせて即座に最適化。</p>
        </div>
        {showPageIndicator && (
          <div className="page-indicator" aria-live="polite">
            <span className="page-indicator__label">ページ</span>
            <span className="page-indicator__value">
              {currentPage} / {pageCount}
            </span>
          </div>
        )}
      </div>

      <div className="controls__presets" role="group" aria-label="クイックプリセット">
        {quickPresets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="controls__preset"
            onClick={() => handlePresetApply(preset)}
            disabled={disabled}
          >
            <span className="controls__preset-label">{preset.label}</span>
            <span className="controls__preset-description">{preset.description}</span>
            <span className="controls__preset-values">
              {preset.brightness}% · {preset.contrast > 0 ? `+${preset.contrast}` : preset.contrast}%
            </span>
          </button>
        ))}
      </div>

      <label className="slider-group slider-group--decorated">
        <span className="slider-label">
          <span className="slider-label__caption">
            <span className="slider-label__icon slider-label__icon--sun" aria-hidden="true" />
            明るさ
          </span>
          <span className="slider-value">{brightness}%</span>
        </span>
        <input
          type="range"
          min={0}
          max={130}
          step={1}
          value={brightness}
          onChange={(event) => onBrightnessChange(Number(event.target.value))}
          disabled={disabled}
        />
        <p className="controls__hint">暗めの会場では 110 以上が推奨されます。</p>
      </label>
      <label className="slider-group slider-group--decorated">
        <span className="slider-label">
          <span className="slider-label__caption">
            <span className="slider-label__icon slider-label__icon--contrast" aria-hidden="true" />
            コントラスト
          </span>
          <span className="slider-value">{contrast > 0 ? `+${contrast}` : contrast}%</span>
        </span>
        <input
          type="range"
          min={-50}
          max={50}
          step={1}
          value={contrast}
          onChange={(event) => onContrastChange(Number(event.target.value))}
          disabled={disabled}
        />
        <p className="controls__hint">テキストの輪郭が甘い場合は +12 以上に調整してください。</p>
      </label>

      <div className="controls__actions">
        <button
          className="wcag-button"
          type="button"
          disabled={disabled || wcagDisabled}
          onClick={onRequestWcagCheck}
        >
          {wcagProcessing ? (
            <LoadingSpinner
              size="small"
              className="wcag-button__loader"
              message={wcagProcessingMessage ?? '解析中...'}
            />
          ) : (
            'WCAG 解析'
          )}
        </button>
        {showWcagClearButton ? (
          <button
            className="wcag-clear-button"
            type="button"
            disabled={disabled || wcagClearDisabled}
            onClick={onClearWcagAdjustments}
          >
            変更をすべてクリア
          </button>
        ) : null}
      </div>

      <div className="controls__actions controls__actions--secondary">
        <button
          className="preview-button"
          type="button"
          disabled={disabled}
          onClick={() => onToggleProjector?.(!projectorEnabled)}
          aria-pressed={projectorEnabled}
        >
          {projectorEnabled ? 'プロジェクタープレビュー: ON' : 'プロジェクタープレビュー: OFF'}
        </button>
        <button className="reset-button" onClick={onReset} disabled={disabled}>
          設定をリセット
        </button>
      </div>
    </section>
  );
};

export default ProjectionControls;
