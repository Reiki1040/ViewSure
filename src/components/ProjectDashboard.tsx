import { type MouseEvent, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import type {
  ActiveProjectContext,
  ProjectFile,
  ProjectFolder,
  TrashedProject
} from '../types/projects';
import { TRASH_FOLDER_ID } from '../types/projects';

const CATEGORY_LABELS: Record<ProjectFile['category'], string> = {
  Presentation: 'Presentation',
  Import: 'Import',
  Draft: 'Draft'
};

const CATEGORY_ACCENTS: Record<ProjectFile['category'], string> = {
  Presentation: '#4f7dff',
  Import: '#64d2ff',
  Draft: '#f6b15a'
};

type RecentProject = {
  id: string;
  name: string;
  updatedAt: string;
  folderId: string;
  folderName: string;
  category: ProjectFile['category'];
};

const formatDateTime = (iso: string) => {
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) {
    return '-';
  }
  return value.toLocaleString();
};

const getTimestampValue = (value: string) => {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
};

type ProjectDashboardProps = {
  folders: ProjectFolder[];
  trashedProjects: TrashedProject[];
  activeFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onCreateFolder: (folderName: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onCreateProject: (folderId: string, projectName: string) => void;
  onOpenProject: (context: ActiveProjectContext) => void;
  onDeleteProject: (folderId: string, projectId: string) => void;
  onPurgeProject: (projectId: string) => void;
  onEmptyTrash: () => void;
};

const TRASH_LABEL = '\u30b4\u30df\u7bb1';
const DASHBOARD_LABEL = 'Dashboard Overview';
const DASHBOARD_SUBTITLE = '\u30ef\u30fc\u30af\u30b9\u30da\u30fc\u30b9\u5168\u4f53\u3092\u30af\u30a4\u30c3\u30af\u306b\u30b5\u30de\u30ea\u30fc\u3002';
const DEFAULT_SUBTITLE = '';
const TRASH_SUBTITLE =
  '\u524a\u9664\u3057\u305f\u30d7\u30ed\u30b8\u30a7\u30af\u30c8\u306f\u3053\u3053\u306b\u79fb\u52d5\u3055\u308c\u307e\u3059\u3002\u30b4\u30df\u7bb1\u3092\u7a7a\u306b\u3059\u308b\u3068\u5143\u306b\u623b\u305b\u307e\u305b\u3093\u3002';
const SEARCH_PROJECTS = '\u30d7\u30ed\u30b8\u30a7\u30af\u30c8\u3092\u691c\u7d22';
const SEARCH_TRASH = '\u30b4\u30df\u7bb1\u3092\u691c\u7d22';
const EMPTY_FOLDER_MESSAGE = '\u3053\u306e\u30d5\u30a9\u30eb\u30c0\u306b\u306f\u307e\u3060\u30d7\u30ed\u30b8\u30a7\u30af\u30c8\u304c\u3042\u308a\u307e\u305b\u3093\u3002';
const SELECT_FOLDER_MESSAGE = '\u5de6\u306e\u300cMyProjects\u300d\u304b\u3089\u30d5\u30a9\u30eb\u30c0\u3092\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044\u3002';
const TRASH_EMPTY_MESSAGE = '\u30b4\u30df\u7bb1\u306f\u7a7a\u3067\u3059\u3002';
const ADD_PROJECT_LABEL = '\u30d7\u30ed\u30b8\u30a7\u30af\u30c8\u3092\u8ffd\u52a0';
const NEW_FOLDER_LABEL = '\u65b0\u898f\u30d5\u30a9\u30eb\u30c0';
const NEW_PROJECT_LABEL = '\u65b0\u898f\u30d7\u30ed\u30b8\u30a7\u30af\u30c8';
const EMPTY_TRASH_LABEL = '\u30b4\u30df\u7bb1\u3092\u7a7a\u306b\u3059\u308b';
const PROMPT_NEW_FOLDER = '\u65b0\u3057\u3044\u30d7\u30ed\u30b8\u30a7\u30af\u30c8\u30d5\u30a9\u30eb\u30c0\u540d\u3092\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044';
const PROMPT_NEW_PROJECT =
  '\u300c{folder}\u300d\u306b\u8ffd\u52a0\u3059\u308b\u30d7\u30ed\u30b8\u30a7\u30af\u30c8\u540d\u3092\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044';
const ALERT_SELECT_FOLDER = '\u307e\u305a\u306f\u30d7\u30ed\u30b8\u30a7\u30af\u30c8\u30d5\u30a9\u30eb\u30c0\u3092\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044';
const CONFIRM_DELETE =
  '\u300c{project}\u300d\u3092\u524a\u9664\u3057\u307e\u3059\u304b\uff1f';
const CONFIRM_PURGE =
  '\u3054\u307f\u7bb1\u304b\u3089\u5b8c\u5168\u306b\u524a\u9664\u3057\u307e\u3059\u304b\uff1f\u3053\u306e\u64cd\u4f5c\u306f\u5143\u306b\u623b\u305b\u307e\u305b\u3093\u3002';
const CONFIRM_EMPTY_TRASH =
  '\u3054\u307f\u7bb1\u3092\u7a7a\u306b\u3059\u308b\u3068\u5168\u3066\u306e\u30a2\u30a4\u30c6\u30e0\u304c\u5b8c\u5168\u306b\u524a\u9664\u3055\u308c\u307e\u3059\u3002\u3088\u308d\u3057\u3044\u3067\u3059\u304b\uff1f';
const CONFIRM_DELETE_FOLDER =
  '\u300c{folder}\u300d\u30d5\u30a9\u30eb\u30c0\u3092\u524a\u9664\u3057\u307e\u3059\u304b\uff1f';
const CONFIRM_DELETE_FOLDER_WITH_PROJECTS =
  '\u300c{folder}\u300d\u30d5\u30a9\u30eb\u30c0\u306b\u306f {count} \u4ef6\u306e\u30d7\u30ed\u30b8\u30a7\u30af\u30c8\u304c\u542b\u307e\u308c\u3066\u3044\u307e\u3059\u3002\u524a\u9664\u3059\u308b\u3068\u3059\u3079\u3066\u30b4\u30df\u7bb1\u306b\u79fb\u52d5\u3057\u307e\u3059\u3002\u524a\u9664\u3057\u3066\u3082\u3088\u308d\u3057\u3044\u3067\u3059\u304b\uff1f';

const ProjectDashboard = ({
  folders,
  trashedProjects,
  activeFolderId,
  onSelectFolder,
  onCreateFolder,
  onDeleteFolder,
  onCreateProject,
  onOpenProject,
  onDeleteProject,
  onPurgeProject,
  onEmptyTrash
}: ProjectDashboardProps) => {
  const { user, signOut } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  const isTrashView = activeFolderId === TRASH_FOLDER_ID;

  useEffect(() => {
    setSelectedProjectId(null);
  }, [activeFolderId, isTrashView]);

  const activeFolder = useMemo(
    () => (isTrashView ? null : folders.find((folder) => folder.id === activeFolderId) ?? null),
    [folders, activeFolderId, isTrashView]
  );

  const filteredProjects = useMemo<ProjectFile[] | TrashedProject[]>(() => {
    if (isTrashView) {
      if (!searchTerm.trim()) {
        return trashedProjects;
      }
      const lower = searchTerm.trim().toLowerCase();
      return trashedProjects.filter(
        (item) =>
          item.name.toLowerCase().includes(lower) ||
          item.sourceFolderName.toLowerCase().includes(lower) ||
          (item.notes ?? '').toLowerCase().includes(lower)
      );
    }
    const files = activeFolder?.files ?? [];
    if (!searchTerm.trim()) {
      return files;
    }
    const lower = searchTerm.trim().toLowerCase();
    return files.filter((file) => file.name.toLowerCase().includes(lower) || (file.notes ?? '').toLowerCase().includes(lower));
  }, [activeFolder, isTrashView, searchTerm, trashedProjects]);

  const projectCount = filteredProjects.length;
  const isDashboardView = !isTrashView && !activeFolder;
  const headerTitle = isTrashView ? TRASH_LABEL : activeFolder ? activeFolder.name : DASHBOARD_LABEL;
  const headerSubtitle = isTrashView ? TRASH_SUBTITLE : activeFolder ? DEFAULT_SUBTITLE : DASHBOARD_SUBTITLE;
  const searchPlaceholder = isTrashView ? SEARCH_TRASH : SEARCH_PROJECTS;

  const totalProjects = useMemo(() => folders.reduce((sum, folder) => sum + folder.files.length, 0), [folders]);
  const totalFolders = folders.length;

  const categoryBreakdown = useMemo<Record<ProjectFile['category'], number>>(() => {
    return folders.reduce(
      (acc, folder) => {
        folder.files.forEach((file) => {
          acc[file.category] = (acc[file.category] ?? 0) + 1;
        });
        return acc;
      },
      { Presentation: 0, Import: 0, Draft: 0 } as Record<ProjectFile['category'], number>
    );
  }, [folders]);

  const recentProjects = useMemo<RecentProject[]>(() => {
    const allProjects: RecentProject[] = [];
    folders.forEach((folder) => {
      folder.files.forEach((file) => {
        allProjects.push({
          id: file.id,
          name: file.name,
          updatedAt: file.updatedAt,
          folderId: folder.id,
          folderName: folder.name,
          category: file.category
        });
      });
    });
    return allProjects.sort((a, b) => getTimestampValue(b.updatedAt) - getTimestampValue(a.updatedAt)).slice(0, 5);
  }, [folders]);

  const sortedTrash = useMemo(
    () => [...trashedProjects].sort((a, b) => getTimestampValue(b.deletedAt) - getTimestampValue(a.deletedAt)),
    [trashedProjects]
  );

  useEffect(() => {
    setExpandedFolders((previous) => {
      let changed = false;
      const next: Record<string, boolean> = {};
      folders.forEach((folder) => {
        if (previous[folder.id]) {
          next[folder.id] = true;
        }
      });
      if (JSON.stringify(previous) !== JSON.stringify(next)) {
        changed = true;
      }
      return changed ? next : previous;
    });
  }, [folders]);

  useEffect(() => {
    if (!activeFolderId) {
      return;
    }
    setExpandedFolders((previous) => {
      if (previous[activeFolderId]) {
        return previous;
      }
      return { ...previous, [activeFolderId]: true };
    });
  }, [activeFolderId]);

  const heroTitle = isTrashView ? 'Trash Center' : activeFolder ? activeFolder.name : DASHBOARD_LABEL;
  const heroDescription = isTrashView ? TRASH_SUBTITLE : headerSubtitle;
  const heroPrimaryValue = isTrashView
    ? trashedProjects.length
    : activeFolder
      ? activeFolder.files.length
      : totalProjects;
  const heroPrimaryLabel = isTrashView ? '保管中のアイテム' : activeFolder ? 'フォルダ内のプロジェクト' : '全プロジェクト';
  const heroSecondaryTimestamp = isTrashView ? sortedTrash[0]?.deletedAt : recentProjects[0]?.updatedAt;
  const heroSecondaryValue = heroSecondaryTimestamp ? formatDateTime(heroSecondaryTimestamp) : '履歴なし';
  const heroSecondaryLabel = isTrashView ? '最終削除日時' : '最終更新日時';

  const handleCreateFolder = () => {
    const name = window.prompt(PROMPT_NEW_FOLDER);
    if (!name) {
      return;
    }
    onCreateFolder(name.trim());
  };

  const handleToggleFolderExpansion = (folderId: string) => {
    setExpandedFolders((previous) => ({
      ...previous,
      [folderId]: !previous[folderId]
    }));
  };

  const handleCreateProject = () => {
    if (!activeFolder || isTrashView) {
      window.alert(ALERT_SELECT_FOLDER);
      return;
    }
    const name = window.prompt(PROMPT_NEW_PROJECT.replace('{folder}', activeFolder.name));
    if (!name) {
      return;
    }
    onCreateProject(activeFolder.id, name.trim());
  };

  const handleDeleteFolder = (
    event: MouseEvent<HTMLButtonElement>,
    folder: ProjectFolder
  ) => {
    event.stopPropagation();
    const count = folder.files.length;
    const message =
      count > 0
        ? CONFIRM_DELETE_FOLDER_WITH_PROJECTS.replace('{folder}', folder.name).replace('{count}', String(count))
        : CONFIRM_DELETE_FOLDER.replace('{folder}', folder.name);
    if (!window.confirm(message)) {
      return;
    }
    onDeleteFolder(folder.id);
  };

  const handleProjectOpen = (file: ProjectFile, folder: ProjectFolder) => {
    if (isTrashView) {
      return;
    }
    setSelectedProjectId(file.id);
    onOpenProject({
      folderId: folder.id,
      folderName: folder.name,
      projectId: file.id,
      projectName: file.name
    });
  };

  const handleDeleteProject = (
    event: MouseEvent<HTMLButtonElement>,
    file: ProjectFile,
    folder: ProjectFolder
  ) => {
    event.stopPropagation();
    const confirmed = window.confirm(CONFIRM_DELETE.replace('{project}', file.name));
    if (!confirmed) {
      return;
    }
    onDeleteProject(folder.id, file.id);
    if (selectedProjectId === file.id) {
      setSelectedProjectId(null);
    }
  };

  const handlePurgeProject = (event: MouseEvent<HTMLButtonElement>, item: TrashedProject) => {
    event.stopPropagation();
    const confirmed = window.confirm(CONFIRM_PURGE);
    if (!confirmed) {
      return;
    }
    onPurgeProject(item.id);
    if (selectedProjectId === item.id) {
      setSelectedProjectId(null);
    }
  };

  const handleEmptyTrashClick = () => {
    if (trashedProjects.length === 0) {
      return;
    }
    if (!window.confirm(CONFIRM_EMPTY_TRASH)) {
      return;
    }
    onEmptyTrash();
    setSelectedProjectId(null);
  };

  const categoryEntries = Object.entries(categoryBreakdown) as Array<[
    ProjectFile['category'],
    number
  ]>;
  const categoryTotal = categoryEntries.reduce((sum, [, count]) => sum + count, 0);

  return (
    <div className="project-dashboard">
      <aside className="project-dashboard__sidebar" aria-label="プロジェクトメニュー">
        <div className="project-dashboard__sidebar-controls">
          <button type="button" className="project-dashboard__icon-button project-dashboard__icon-button--ghost" aria-label="メニュー">
            <span className="project-dashboard__icon-bars" aria-hidden="true" />
          </button>
          <button type="button" className="project-dashboard__icon-button project-dashboard__icon-button--ghost" aria-label="検索">
            <svg viewBox="0 0 20 20" focusable="false">
              <path
                d="M9 3a6 6 0 1 1 0 12 6 6 0 0 1 0-12Zm0 2a4 4 0 1 0 2.83 6.83l3.2 3.21 1.42-1.42-3.2-3.2A4 4 0 0 0 9 5Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>
        <div className="project-dashboard__sidebar-header project-dashboard__sidebar-header--stacked">
          <div className="project-dashboard__branding project-dashboard__branding--stacked">
            <span className="project-dashboard__branding-title">Title</span>
            <span className="project-dashboard__branding-subtitle">Project Library</span>
          </div>
          <button type="button" className="project-dashboard__signout" onClick={() => signOut()}>
            サインアウト
          </button>
        </div>
        <nav className="project-dashboard__menu" aria-label="メインメニュー">
          <div className="project-dashboard__quick-list">
            <button
              type="button"
              className={`project-dashboard__quick-button${isDashboardView ? ' is-active' : ''}`}
              onClick={() => onSelectFolder(null)}
            >
              <svg viewBox="0 0 20 20" focusable="false" aria-hidden="true">
                <path
                  d="M3 8.5 10 3l7 5.5V17a1 1 0 0 1-1 1h-4v-4H8v4H4a1 1 0 0 1-1-1V8.5Z"
                  fill="currentColor"
                />
              </svg>
              <span>Dashboard</span>
            </button>
            <button
              type="button"
              className={`project-dashboard__quick-button${isTrashView ? ' is-active' : ''}`}
              onClick={() => onSelectFolder(TRASH_FOLDER_ID)}
            >
              <svg viewBox="0 0 20 20" focusable="false" aria-hidden="true">
                <path
                  d="M7.5 3a1 1 0 0 0-.98.804L6.3 5H3v2h1l.9 10.06A2 2 0 0 0 6.39 19h7.22a2 2 0 0 0 1.99-1.94L16 7h1V5h-3.3l-.22-1.196A1 1 0 0 0 12.5 3h-5Zm1.3 2 .1-.5h2.2l.1.5H8.8Z"
                  fill="currentColor"
                />
              </svg>
              <span>Trash</span>
            </button>
          </div>
          <div className="project-dashboard__section">
            <div className="project-dashboard__section-header">
              <span>Folders</span>
              <span className="project-dashboard__section-indicator" aria-hidden="true">
                <svg viewBox="0 0 16 16" focusable="false">
                  <path d="M4 6 8 10 12 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </span>
            </div>
            <ul className="project-dashboard__folder-list">
              {folders.map((folder) => {
                const isActive = folder.id === activeFolderId;
                const hasItems = folder.files.length > 0;
                const isExpanded = expandedFolders[folder.id] ?? false;
                return (
                  <li key={folder.id} className={`project-dashboard__folder-item${isActive ? ' is-active' : ''}`}>
                    <div className="project-dashboard__folder-row">
                      <button
                        type="button"
                        className="project-dashboard__folder-button"
                        onClick={() => onSelectFolder(folder.id)}
                      >
                        <span
                          className={`project-dashboard__folder-icon${hasItems ? '' : ' project-dashboard__folder-icon--doc'}`}
                          aria-hidden="true"
                        >
                          {hasItems ? (
                            <svg viewBox="0 0 24 24" focusable="false">
                              <path
                                d="M4 6a2 2 0 0 1 2-2h4l1.5 1.5H20a2 2 0 0 1 2 2V19a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Z"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.6"
                              />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24" focusable="false">
                              <path
                                d="M6 3h8l5 5v13H6V3Zm8 0v5h5"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </span>
                        <span className="project-dashboard__folder-name">{folder.name}</span>
                      </button>
                      <div className="project-dashboard__folder-controls">
                        <button
                          type="button"
                          className={`project-dashboard__folder-toggle${isExpanded ? ' is-open' : ''}`}
                          onClick={() => handleToggleFolderExpansion(folder.id)}
                          aria-label={`${folder.name} のプロジェクトを${isExpanded ? '閉じる' : '表示'}`}
                        >
                          <svg viewBox="0 0 16 16" focusable="false">
                            <path d="M6 4 10 8 6 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="project-dashboard__folder-delete"
                          onClick={(event) => handleDeleteFolder(event, folder)}
                          aria-label={`「${folder.name}」フォルダを削除`}
                        >
                          <svg viewBox="0 0 18 18" focusable="false" aria-hidden="true">
                            <path
                              d="M6 3h6l1 1h3v2h-1l-.8 9.06A2 2 0 0 1 12.2 17H5.8a2 2 0 0 1-1.99-1.94L3 6H2V4h3l1-1Zm2 3v8m2-8v8"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.4"
                              strokeLinecap="round"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                    {folder.files.length > 0 ? (
                      <ul
                        className={`project-dashboard__project-list${
                          isExpanded ? ' project-dashboard__project-list--open' : ''
                        }`}
                        style={{ maxHeight: isExpanded ? folder.files.length * 48 : undefined }}
                      >
                        {folder.files.map((file) => (
                          <li key={file.id} className="project-dashboard__project-item">
                            <span className="project-dashboard__project-icon" aria-hidden="true">
                              <svg viewBox="0 0 20 20" focusable="false">
                                <path
                                  d="M5 3h6.5L15 6.5V17a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.4"
                                />
                              </svg>
                            </span>
                            <div className="project-dashboard__project-details">
                              <button
                                type="button"
                                className="project-dashboard__project-button"
                                onClick={() => handleProjectOpen(file, folder)}
                              >
                                <span className="project-dashboard__project-name">{file.name}</span>
                                <span className="project-dashboard__project-meta">{file.category}</span>
                              </button>
                            </div>
                          </li>
                        ))}
                        <li className="project-dashboard__project-item project-dashboard__project-item--action">
                          <button
                            type="button"
                            className="project-dashboard__project-add"
                            onClick={() => {
                              const name = window.prompt(PROMPT_NEW_PROJECT.replace('{folder}', folder.name));
                              if (!name) {
                                return;
                              }
                              onCreateProject(folder.id, name.trim());
                              setExpandedFolders((previous) => ({ ...previous, [folder.id]: true }));
                            }}
                          >
                            + プロジェクトを追加
                          </button>
                        </li>
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="project-dashboard__section project-dashboard__section--muted">
          </div>
        </nav>
      </aside>
      <div className="project-dashboard__workspace">
        <header className="project-dashboard__topbar">
          <div className="project-dashboard__search">
            <span className="project-dashboard__search-icon" aria-hidden="true">
              <svg viewBox="0 0 20 20" focusable="false">
                <path
                  d="M9 3a6 6 0 1 1 0 12 6 6 0 0 1 0-12Zm0 2a4 4 0 1 0 2.83 6.83l3.2 3.21 1.42-1.42-3.2-3.2A4 4 0 0 0 9 5Z"
                  fill="currentColor"
                />
              </svg>
            </span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
            />
          </div>
          <div className="project-dashboard__top-actions">
            {!isTrashView ? (
              <button type="button" className="project-dashboard__button project-dashboard__button--primary" onClick={handleCreateProject}>
                + {NEW_PROJECT_LABEL}
              </button>
            ) : (
              <button
                type="button"
                className="project-dashboard__button project-dashboard__button--danger"
                onClick={handleEmptyTrashClick}
                disabled={trashedProjects.length === 0}
              >
                {EMPTY_TRASH_LABEL}
              </button>
            )}
            <button type="button" className="project-dashboard__button" onClick={handleCreateFolder}>
              + {NEW_FOLDER_LABEL}
            </button>
            {user ? (
              <div className="project-dashboard__user-chip">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={`${user.name} のアバター`} />
                ) : (
                  <span aria-hidden="true">{user.name.slice(0, 1)}</span>
                )}
                <div>
                  <strong>{user.name}</strong>
                  <small>{user.email}</small>
                </div>
                <button type="button" onClick={() => signOut()} aria-label="サインアウト">
                  ↗
                </button>
              </div>
            ) : null}
          </div>
        </header>

        {isDashboardView && (
        <section className="project-dashboard__cards" aria-label="ダッシュボードのサマリー">
          <article className="project-dashboard__card project-dashboard__card--hero">
            <div>
              <p className="project-dashboard__card-label">Workspace</p>
              <h2 className="project-dashboard__card-title">{heroTitle}</h2>
              <p className="project-dashboard__card-text">{heroDescription}</p>
            </div>
            <div className="project-dashboard__card-meta">
              <div>
                <span className="project-dashboard__card-value">{heroPrimaryValue}</span>
                <span className="project-dashboard__card-sub">{heroPrimaryLabel}</span>
              </div>
              <div>
                <span className="project-dashboard__card-value">{heroSecondaryValue}</span>
                <span className="project-dashboard__card-sub">{heroSecondaryLabel}</span>
              </div>
            </div>
            <div className="project-dashboard__hero-actions">
              <button type="button" className="project-dashboard__button project-dashboard__button--primary" onClick={handleCreateProject}>
                + {NEW_PROJECT_LABEL}
              </button>
              {isTrashView ? (
                <button
                  type="button"
                  className="project-dashboard__button project-dashboard__button--danger"
                  onClick={handleEmptyTrashClick}
                  disabled={trashedProjects.length === 0}
                >
                  {EMPTY_TRASH_LABEL}
                </button>
              ) : (
                <button type="button" className="project-dashboard__button project-dashboard__button--ghost" onClick={handleCreateFolder}>
                  + {NEW_FOLDER_LABEL}
                </button>
              )}
            </div>
          </article>
          <article className="project-dashboard__card">
            <p className="project-dashboard__card-label">スナップショット</p>
            <h3 className="project-dashboard__card-title">進捗状況</h3>
            <ul className="project-dashboard__stat-list">
              <li>
                <span>フォルダ</span>
                <strong>{totalFolders}</strong>
              </li>
              <li>
                <span>プロジェクト</span>
                <strong>{totalProjects}</strong>
              </li>
              <li>
                <span>ドラフト</span>
                <strong>{categoryBreakdown.Draft}</strong>
              </li>
              <li>
                <span>ゴミ箱</span>
                <strong>{trashedProjects.length}</strong>
              </li>
            </ul>
          </article>
          <article className="project-dashboard__card">
            <p className="project-dashboard__card-label">カテゴリ内訳</p>
            <h3 className="project-dashboard__card-title">リソースバランス</h3>
            <div className="project-dashboard__stat-items">
              {categoryEntries.map(([category, count]) => (
                <div key={category} className="project-dashboard__stat-item">
                  <div className="project-dashboard__stat-row">
                    <span>{CATEGORY_LABELS[category]}</span>
                    <span>{count}</span>
                  </div>
                  <div className="project-dashboard__stat-bar">
                    <span
                      style={{
                        width: `${categoryTotal === 0 ? 0 : Math.round((count / categoryTotal) * 100)}%`,
                        background: CATEGORY_ACCENTS[category]
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
        )}

        <section className={`project-dashboard__grid${isDashboardView ? '' : ' project-dashboard__grid--single'}`}>
          <div className="project-dashboard__panel project-dashboard__panel--flat" aria-live="polite">
            <div className="project-dashboard__panel-header">
              <div>
                <h2 className="project-dashboard__panel-title">{headerTitle}</h2>
                <p className="project-dashboard__panel-subtitle">{headerSubtitle}</p>
              </div>
              <span className="project-dashboard__count-chip">{projectCount} 件</span>
            </div>
            <div className="project-dashboard__table">
              <table>
                <thead>
                  {isTrashView ? (
                    <tr>
                      <th scope="col">Name</th>
                      <th scope="col">Folder</th>
                      <th scope="col">Deleted</th>
                      <th scope="col">Notes</th>
                      <th scope="col" className="project-dashboard__actions-header" aria-label="Actions">
                        &nbsp;
                      </th>
                    </tr>
                  ) : (
                    <tr>
                      <th scope="col">Name</th>
                      <th scope="col">Category</th>
                      <th scope="col">Last Modified</th>
                      <th scope="col">Notes</th>
                      <th scope="col" className="project-dashboard__actions-header" aria-label="Actions">
                        &nbsp;
                      </th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {isTrashView ? (
                    projectCount > 0 ? (
                      (filteredProjects as TrashedProject[]).map((item) => (
                        <tr
                          key={item.id}
                          className={selectedProjectId === item.id ? 'is-selected' : ''}
                          onClick={() => setSelectedProjectId(item.id)}
                        >
                          <td data-title="Name">{item.name}</td>
                          <td data-title="Folder">{item.sourceFolderName}</td>
                          <td data-title="Deleted">{formatDateTime(item.deletedAt)}</td>
                          <td data-title="Notes">{item.notes ?? '-'}</td>
                          <td data-title="Actions" className="project-dashboard__actions-cell">
                            <button
                              type="button"
                              className="project-dashboard__delete-button project-dashboard__delete-button--danger"
                              aria-label={`${item.name} を完全に削除`}
                              onClick={(event) => handlePurgeProject(event, item)}
                            >
                              <svg viewBox="0 0 20 20" focusable="false" aria-hidden="true">
                                <path
                                  d="M7.5 2a1 1 0 0 0-.98.804L6.3 4H3a1 1 0 1 0 0 2h.5l.9 11.06A2 2 0 0 0 6.39 19h7.22a2 2 0 0 0 1.99-1.94L16.5 6H17a1 1 0 1 0 0-2h-3.3l-.22-1.196A1 1 0 0 0 12.5 2h-5Zm1.3 2 .1-.5h2.2l.1.5H8.8Zm5.2 2-1 10.94a.5.5 0 0 1-.5.46H6.39a.5.5 0 0 1-.5-.46L4.9 6H15Z"
                                  fill="currentColor"
                                />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr className="project-dashboard__empty-state">
                        <td colSpan={5}>{TRASH_EMPTY_MESSAGE}</td>
                      </tr>
                    )
                  ) : activeFolder ? (
                    projectCount > 0 ? (
                      (filteredProjects as ProjectFile[]).map((file) => (
                        <tr
                          key={file.id}
                          className={selectedProjectId === file.id ? 'is-selected' : ''}
                          onClick={() => handleProjectOpen(file, activeFolder)}
                        >
                          <td data-title="Name">{file.name}</td>
                          <td data-title="Category">{file.category}</td>
                          <td data-title="Last Modified">{formatDateTime(file.updatedAt)}</td>
                          <td data-title="Notes">{file.notes ?? '-'}</td>
                          <td data-title="Actions" className="project-dashboard__actions-cell">
                            <button
                              type="button"
                              className="project-dashboard__delete-button"
                              aria-label={`${file.name} を削除`}
                              onClick={(event) => handleDeleteProject(event, file, activeFolder)}
                            >
                              <svg viewBox="0 0 20 20" focusable="false" aria-hidden="true">
                                <path
                                  d="M7.5 2a1 1 0 0 0-.98.804L6.3 4H3a1 1 0 1 0 0 2h.5l.9 11.06A2 2 0 0 0 6.39 19h7.22a2 2 0 0 0 1.99-1.94L16.5 6H17a1 1 0 1 0 0-2h-3.3l-.22-1.196A1 1 0 0 0 12.5 2h-5Zm1.3 2 .1-.5h2.2l.1.5H8.8Zm5.2 2-1 10.94a.5.5 0 0 1-.5.46H6.39a.5.5 0 0 1-.5-.46L4.9 6H15Z"
                                  fill="currentColor"
                                />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr className="project-dashboard__empty-state">
                        <td colSpan={5}>
                          <p>{EMPTY_FOLDER_MESSAGE}</p>
                          <button type="button" onClick={handleCreateProject}>
                            {ADD_PROJECT_LABEL}
                          </button>
                        </td>
                      </tr>
                    )
                  ) : (
                    <tr className="project-dashboard__empty-state">
                      <td colSpan={5}>{SELECT_FOLDER_MESSAGE}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {activeFolder && !isTrashView ? (
              <button
                type="button"
                className="project-dashboard__table-add"
                onClick={() => {
                  const name = window.prompt(PROMPT_NEW_PROJECT.replace('{folder}', activeFolder.name));
                  if (!name) {
                    return;
                  }
                  onCreateProject(activeFolder.id, name.trim());
                }}
              >
                + プロジェクトを追加
              </button>
            ) : null}
          </div>
          {isDashboardView && (
          <aside className="project-dashboard__panel project-dashboard__panel--flat project-dashboard__panel--side">
            <div className="project-dashboard__panel-header">
              <h3 className="project-dashboard__panel-title">最近の更新</h3>
              <span className="project-dashboard__chip">最新</span>
            </div>
            <ul className="project-dashboard__activity-list">
              {recentProjects.length === 0 ? (
                <li className="project-dashboard__activity-empty">まだプロジェクトがありません</li>
              ) : (
                recentProjects.map((project) => (
                  <li key={project.id} className="project-dashboard__activity-item">
                    <span
                      className="project-dashboard__activity-avatar"
                      style={{ background: CATEGORY_ACCENTS[project.category] }}
                      aria-hidden="true"
                    >
                      {project.name.slice(0, 1)}
                    </span>
                    <div>
                      <p className="project-dashboard__activity-name">{project.name}</p>
                      <p className="project-dashboard__activity-meta">
                        {project.folderName} ・ {formatDateTime(project.updatedAt)}
                      </p>
                    </div>
                  </li>
                ))
              )}
            </ul>
            <div className="project-dashboard__panel-divider" />
            <div className="project-dashboard__panel-header">
              <h3 className="project-dashboard__panel-title">ゴミ箱の状態</h3>
            </div>
            <p className="project-dashboard__panel-subtitle">
              現在 {trashedProjects.length} 件が保管されています。クリーンアップすると元に戻せません。
            </p>
            <button
              type="button"
              className="project-dashboard__button project-dashboard__button--danger"
              onClick={handleEmptyTrashClick}
              disabled={trashedProjects.length === 0}
            >
              {EMPTY_TRASH_LABEL}
            </button>
          </aside>
          )}
        </section>
      </div>
    </div>
  );
};

export default ProjectDashboard;
