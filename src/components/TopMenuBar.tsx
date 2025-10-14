type TopMenuBarProps = {
  onOpenFile: () => void;
  onReset: () => void;
  onGoPrev: () => void;
  onGoNext: () => void;
  onDownload: () => void;
  statusMessage?: string | null;
  canGoPrev: boolean;
  canGoNext: boolean;
  canDownload: boolean;
  isBusy: boolean;
};

const TopMenuBar = ({
  onOpenFile,
  onReset,
  onGoPrev,
  onGoNext,
  onDownload,
  statusMessage,
  canGoPrev,
  canGoNext,
  canDownload,
  isBusy
}: TopMenuBarProps) => {
  return (
    <header className="top-menu" role="banner">
      <div className="top-menu__branding" aria-label="ViewSure">
        <span className="top-menu__logo">ViewSure</span>
        <span className="top-menu__product">Projection Studio</span>
      </div>
      <nav className="top-menu__actions" aria-label="主要操作">
        <button
          type="button"
          className="top-menu__button top-menu__button--primary"
          onClick={onOpenFile}
          disabled={isBusy}
        >
          資料を開く
        </button>
        <button
          type="button"
          className="top-menu__button top-menu__button--accent"
          onClick={onDownload}
          disabled={!canDownload}
        >
          PDF保存
        </button>
        <button
          type="button"
          className="top-menu__button"
          onClick={onGoPrev}
          disabled={!canGoPrev}
        >
          前のページ
        </button>
        <button
          type="button"
          className="top-menu__button"
          onClick={onGoNext}
          disabled={!canGoNext}
        >
          次のページ
        </button>
        <button
          type="button"
          className="top-menu__button"
          onClick={onReset}
          disabled={isBusy}
        >
          設定をリセット
        </button>
      </nav>
      <div className="top-menu__status" role="status" aria-live="polite">
        {statusMessage ?? '準備完了 — ファイルを読み込んでください'}
      </div>
    </header>
  );
};

export default TopMenuBar;
