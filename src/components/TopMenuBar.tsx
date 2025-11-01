import type { ActiveProjectContext } from '../types/projects';

type TopMenuBarProps = {
  onBackToProjects?: () => void;
  onSignOut?: () => void;
  user?: {
    name: string;
    avatarUrl?: string;
  };
  activeProject?: Pick<ActiveProjectContext, 'folderName' | 'projectName'>;
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
  onBackToProjects,
  onSignOut,
  user,
  activeProject,
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
      <nav className="top-menu__actions" aria-label="操作メニュー">
        {onBackToProjects ? (
          <button type="button" className="top-menu__button top-menu__button--ghost" onClick={onBackToProjects}>
            プロジェクト一覧に戻る
          </button>
        ) : null}
        <button type="button" className="top-menu__button top-menu__button--primary" onClick={onOpenFile} disabled={isBusy}>
          ファイルを開く
        </button>
        <button
          type="button"
          className="top-menu__button top-menu__button--accent"
          onClick={onDownload}
          disabled={!canDownload}
        >
          PDFを保存
        </button>
        <button type="button" className="top-menu__button" onClick={onGoPrev} disabled={!canGoPrev}>
          前のページ
        </button>
        <button type="button" className="top-menu__button" onClick={onGoNext} disabled={!canGoNext}>
          次のページ
        </button>
        <button type="button" className="top-menu__button" onClick={onReset} disabled={isBusy}>
          設定をリセット
        </button>
        {onSignOut ? (
          <button type="button" className="top-menu__button top-menu__button--ghost" onClick={onSignOut}>
            サインアウト
          </button>
        ) : null}
      </nav>
      <div className="top-menu__status" role="status" aria-live="polite">
        {user ? (
          <div className="top-menu__user">
            {user.avatarUrl ? (
              <img className="top-menu__user-avatar" src={user.avatarUrl} alt={`${user.name} のアバター`} />
            ) : (
              <span className="top-menu__user-avatar top-menu__user-avatar--fallback" aria-hidden="true">
                {user.name.slice(0, 1)}
              </span>
            )}
            <span className="top-menu__user-name">{user.name}</span>
          </div>
        ) : null}
        {activeProject ? (
          <div className="top-menu__project">
            <span className="top-menu__project-folder" aria-label="フォルダ名">
              {activeProject.folderName}
            </span>
            <span className="top-menu__project-name" aria-label="プロジェクト名">
              {activeProject.projectName}
            </span>
          </div>
        ) : null}
        <span className="top-menu__status-text">
          {statusMessage ?? 'プロジェクトファイルを読み込んでください'}
        </span>
      </div>
    </header>
  );
};

export default TopMenuBar;
