export type ProjectFile = {
  id: string;
  name: string;
  category: 'Presentation' | 'Import' | 'Draft';
  updatedAt: string;
  lastOpenedAt?: string;
  notes?: string;
};

export type ProjectFolder = {
  id: string;
  name: string;
  createdAt: string;
  files: ProjectFile[];
};

export type ActiveProjectContext = {
  folderId: string;
  projectId: string;
  folderName: string;
  projectName: string;
};

export type TrashedProject = {
  id: string;
  name: string;
  category: ProjectFile['category'];
  notes?: string;
  updatedAt: string;
  deletedAt: string;
  sourceFolderId: string;
  sourceFolderName: string;
};

export const TRASH_FOLDER_ID = '__trash__';
