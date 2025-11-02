import { type MouseEvent, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import type {
  ActiveProjectContext,
  ProjectFile,
  ProjectFolder,
  TrashedProject
} from '../types/projects';
import { TRASH_FOLDER_ID } from '../types/projects';

type ProjectDashboardProps = {
  folders: ProjectFolder[];
  trashedProjects: TrashedProject[];
  activeFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onCreateFolder: (folderName: string) => void;
  onCreateProject: (folderId: string, projectName: string) => void;
  onOpenProject: (context: ActiveProjectContext) => void;
  onDeleteProject: (folderId: string, projectId: string) => void;
  onPurgeProject: (projectId: string) => void;
  onEmptyTrash: () => void;
};

const formatDateTime = (iso: string) => {
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) {
    return '-';
  }
  return value.toLocaleString();
};

const RECENT_LABEL = '\u6700\u8fd1\u4f7f\u7528\u3057\u305f\u30d7\u30ed\u30b8\u30a7\u30af\u30c8';
const TRASH_LABEL = '\u30b4\u30df\u7bb1';
const DEFAULT_SUBTITLE =
  '\u30d7\u30ed\u30b8\u30a7\u30af\u30c8\u4e00\u89a7\u3092\u6574\u7406\u3057\u3066\u3001\u7ba1\u7406\u3057\u305f\u3044\u30d5\u30a9\u30eb\u30c0\u3092\u30c0\u30d6\u30eb\u30af\u30ea\u30c3\u30af\u3067\u958b\u3044\u3066\u304f\u3060\u3055\u3044\u3002';
const TRASH_SUBTITLE =
  '\u524a\u9664\u3057\u305f\u30d7\u30ed\u30b8\u30a7\u30af\u30c8\u306f\u3053\u3053\u306b\u79fb\u52d5\u3057\u307e\u3059\u3002\u30b4\u30df\u7bb1\u3092\u7a7a\u306b\u3059\u308b\u3068\u5b8c\u5168\u306b\u524a\u9664\u3055\u308c\u307e\u3059\u3002';
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

const ProjectDashboard = ({
  folders,
  trashedProjects,
  activeFolderId,
  onSelectFolder,
  onCreateFolder,
  onCreateProject,
  onOpenProject,
  onDeleteProject,
  onPurgeProject,
  onEmptyTrash
}: ProjectDashboardProps) => {
  const { user, signOut } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

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
  const headerTitle = isTrashView ? TRASH_LABEL : activeFolder ? activeFolder.name : RECENT_LABEL;
  const headerSubtitle = isTrashView ? TRASH_SUBTITLE : DEFAULT_SUBTITLE;
  const searchPlaceholder = isTrashView ? SEARCH_TRASH : SEARCH_PROJECTS;

  const handleCreateFolder = () => {
    const name = window.prompt(PROMPT_NEW_FOLDER);
    if (!name) {
      return;
    }
    onCreateFolder(name.trim());
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

  return (
    <div className="project-dashboard">
      <aside className="project-dashboard__sidebar" aria-label="プロジェクトメニュー">
        <div className="project-dashboard__sidebar-header">
          <div className="project-dashboard__branding">
            <span className="project-dashboard__branding-logo" aria-hidden="true">
              VS
            </span>
            <span className="project-dashboard__branding-name">ViewSure</span>
          </div>
          <button type="button" className="project-dashboard__signout" onClick={() => signOut()}>
            サインアウト
          </button>
        </div>
        <nav className="project-dashboard__nav">
          <h2 className="project-dashboard__nav-heading">FOLDERS</h2>
          <button
            type="button"
            className={`project-dashboard__nav-item${activeFolderId === null ? ' project-dashboard__nav-item--active' : ''}`}
            onClick={() => onSelectFolder(null)}
          >
            {RECENT_LABEL}
          </button>
          <div className="project-dashboard__nav-group">
            <div className="project-dashboard__nav-group-header">
              <span className="project-dashboard__nav-group-icon" aria-hidden="true">
                <svg viewBox="0 0 20 20" focusable="false">
                  <path
                    d="M3 5a2 2 0 0 1 2-2h2.5l1-1h3l1 1H14a2 2 0 0 1 2 2v1H3V5Zm0 3h13v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z"
                    fill="currentColor"
                  />
                </svg>
              </span>
              <span>MyProjects</span>
            </div>
            <ul className="project-dashboard__folder-list">
              {folders.map((folder) => (
                <li key={folder.id}>
                  <button
                    type="button"
                    className={`project-dashboard__folder-button${
                      folder.id === activeFolderId ? ' project-dashboard__folder-button--active' : ''
                    }`}
                    onClick={() => onSelectFolder(folder.id)}
                  >
                    {folder.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <button
            type="button"
            className={`project-dashboard__nav-item project-dashboard__nav-item--trash${
              isTrashView ? ' project-dashboard__nav-item--active' : ''
            }`}
            onClick={() => onSelectFolder(TRASH_FOLDER_ID)}
          >
            <span className="project-dashboard__nav-group-icon" aria-hidden="true">
              <svg viewBox="0 0 20 20" focusable="false">
                <path
                  d="M7.5 2a1 1 0 0 0-.98.804L6.3 4H3a1 1 0 1 0 0 2h.5l.9 11.06A2 2 0 0 0 6.39 19h7.22a2 2 0 0 0 1.99-1.94L16.5 6H17a1 1 0 1 0 0-2h-3.3l-.22-1.196A1 1 0 0 0 12.5 2h-5Zm1.3 2 .1-.5h2.2l.1.5H8.8Zm5.2 2-1 10.94a.5.5 0 0 1-.5.46H6.39a.5.5 0 0 1-.5-.46L4.9 6H15Z"
                  fill="currentColor"
                />
              </svg>
            </span>
            {TRASH_LABEL}
            {trashedProjects.length > 0 ? <span className="project-dashboard__badge">{trashedProjects.length}</span> : null}
          </button>
          <button type="button" className="project-dashboard__nav-item project-dashboard__nav-item--ghost" onClick={handleCreateFolder}>
            {NEW_FOLDER_LABEL}
          </button>
        </nav>
        <div className="project-dashboard__sidebar-footer">
          {user ? (
            <div className="project-dashboard__user">
              {user.picture ? (
                <img className="project-dashboard__user-avatar" src={user.picture} alt={`${user.name} のアバター`} />
              ) : (
                <span className="project-dashboard__user-avatar project-dashboard__user-avatar--fallback" aria-hidden="true">
                  {user.name.slice(0, 1)}
                </span>
              )}
              <div className="project-dashboard__user-info">
                <span className="project-dashboard__user-name">{user.name}</span>
                <span className="project-dashboard__user-email">{user.email}</span>
              </div>
            </div>
          ) : null}
        </div>
      </aside>
      <main className="project-dashboard__main">
        <header className="project-dashboard__header">
          <div>
            <h1 className="project-dashboard__title">{headerTitle}</h1>
            <p className="project-dashboard__subtitle">{headerSubtitle}</p>
          </div>
          <div className="project-dashboard__header-actions">
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
              <>
                <button type="button" className="project-dashboard__button" onClick={handleCreateFolder}>
                  {NEW_FOLDER_LABEL}
                </button>
                <button type="button" className="project-dashboard__button project-dashboard__button--primary" onClick={handleCreateProject}>
                  {NEW_PROJECT_LABEL}
                </button>
              </>
            )}
          </div>
        </header>
        <div className="project-dashboard__toolbar">
          <div className="project-dashboard__toolbar-search">
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
            />
            <span className="project-dashboard__toolbar-search-icon" aria-hidden="true">
              🔍
            </span>
          </div>
          {isTrashView || activeFolder ? <span className="project-dashboard__count">{`${projectCount} 件`}</span> : null}
        </div>
        <section className="project-dashboard__table" aria-live="polite">
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
        </section>
      </main>
    </div>
  );
};

export default ProjectDashboard;
