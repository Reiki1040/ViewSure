type ProjectionControlsProps = {
  brightness: number;
  contrast: number;
  disabled?: boolean;
  onBrightnessChange: (value: number) => void;
  onContrastChange: (value: number) => void;
  onReset: () => void;
  pageCount?: number;
  currentPage?: number;
};

const ProjectionControls = ({
  brightness,
  contrast,
  disabled = false,
  onBrightnessChange,
  onContrastChange,
  onReset,
  pageCount,
  currentPage
}: ProjectionControlsProps) => {
  const showPageIndicator = !!pageCount && !!currentPage;

  return (
    <section className="controls">
      <h2 className="section-title">プロジェクター設定</h2>
      {showPageIndicator && (
        <div className="page-indicator">
          <span className="page-indicator__label">ページ</span>
          <span className="page-indicator__value">
            {currentPage} / {pageCount}
          </span>
        </div>
      )}
      <label className="slider-group">
        <span className="slider-label">
          明るさ <span className="slider-value">{brightness}%</span>
        </span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={brightness}
          onChange={(event) => onBrightnessChange(Number(event.target.value))}
          disabled={disabled}
        />
      </label>
      <label className="slider-group">
        <span className="slider-label">
          コントラスト <span className="slider-value">{contrast > 0 ? `+${contrast}` : contrast}%</span>
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
      </label>
      <button className="wcag-button" type="button" disabled={disabled}>
        WCAG 適合
      </button>
      <button className="preview-button" type="button" disabled={disabled}>
        プロジェクタープレビュー
      </button>
      <button className="reset-button" onClick={onReset} disabled={disabled}>
        設定をリセット
      </button>
    </section>
  );
};

export default ProjectionControls;
