import { useCallback } from 'react';

type ControlToolbarProps = {
  onOpenFile: () => void;
  onDownload: () => void;
  onWcagAnalyze: () => void;
  onToggleProjector: (enabled: boolean) => void;
  onReset: () => void;
  disabled?: boolean;
  canDownload?: boolean;
  wcagProcessing?: boolean;
  projectorEnabled?: boolean;
  hasAsset?: boolean;
  hasWcagAdjustments?: boolean;
  className?: string;
};

export const ControlToolbar = ({
  onOpenFile,
  onDownload,
  onWcagAnalyze,
  onToggleProjector,
  onReset,
  disabled = false,
  canDownload = false,
  wcagProcessing = false,
  projectorEnabled = false,
  hasAsset = false,
  hasWcagAdjustments = false,
  className = ''
}: ControlToolbarProps) => {
  const handleToggleProjector = useCallback(() => {
    onToggleProjector(!projectorEnabled);
  }, [onToggleProjector, projectorEnabled]);

  return (
    <section 
      className={`control-toolbar ${className}`} 
      aria-label="スタジオ操作"
    >
      <div className="control-toolbar__section">
        <button 
          type="button" 
          onClick={onOpenFile} 
          disabled={disabled}
          className="control-toolbar__button"
          aria-label="ファイルを開く"
        >
          <span aria-hidden="true">📤</span>
        </button>
        
        <button 
          type="button" 
          onClick={onDownload} 
          disabled={!canDownload}
          className="control-toolbar__button"
          aria-label="ダウンロード"
        >
          <span aria-hidden="true">📥</span>
        </button>
        
        <div className="control-toolbar__divider" aria-hidden="true" />
      </div>

      <div className="control-toolbar__section">
        <button
          type="button"
          className={`control-toolbar__chip ${wcagProcessing ? 'is-processing' : ''}`}
          onClick={onWcagAnalyze}
          disabled={!hasAsset || wcagProcessing}
          aria-label="WCAG解析を実行"
        >
          {wcagProcessing ? (
            <>
              <span className="control-toolbar__spinner" aria-hidden="true" />
              解析中...
            </>
          ) : (
            <>
              👁&nbsp;WCAG解析
            </>
          )}
        </button>

        <button
          type="button"
          className={`control-toolbar__chip ${projectorEnabled ? 'is-active' : ''}`}
          onClick={handleToggleProjector}
          disabled={!hasAsset}
          aria-label="プロジェクタープレビューを切り替え"
        >
          👓&nbsp;プレビュー
        </button>

        <button
          type="button"
          className="control-toolbar__chip control-toolbar__chip--danger"
          onClick={onReset}
          disabled={(!hasAsset && !hasWcagAdjustments) || disabled}
          aria-label="設定をリセット"
        >
          ⟳&nbsp;リセット
        </button>
      </div>
    </section>
  );
};