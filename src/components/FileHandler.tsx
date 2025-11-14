import { useCallback, useRef, useState } from 'react';
import type { ProjectionAsset } from '../utils/fileLoader';
import { loadProjectionAsset } from '../utils/fileLoader';

type FileHandlerProps = {
  disabled?: boolean;
  onFileLoaded: (asset: ProjectionAsset, fileName: string) => void;
  onError: (error: string) => void;
};

export const FileHandler = ({ disabled = false, onFileLoaded, onError }: FileHandlerProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelected = useCallback(async (file: File) => {
    if (disabled || isLoading) return;

    setIsLoading(true);
    try {
      const asset = await loadProjectionAsset(file);
      onFileLoaded(asset, file.name);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'ファイルの読み込みに失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, [disabled, isLoading, onFileLoaded, onError]);

  const handleOpenFileDialog = useCallback(() => {
    if (!disabled && !isLoading) {
      fileInputRef.current?.click();
    }
  }, [disabled, isLoading]);

  const handleFileInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelected(file);
      // Reset input to allow selecting the same file again
      event.target.value = '';
    }
  }, [handleFileSelected]);

  return (
    <div className="file-handler">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.pptx,.ppt,.png,.jpg,.jpeg,.webp,.heic,.heif"
        onChange={handleFileInputChange}
        disabled={disabled || isLoading}
        style={{ display: 'none' }}
      />
      <button
        type="button"
        className="file-handler__button"
        onClick={handleOpenFileDialog}
        disabled={disabled || isLoading}
        aria-label="ファイルを選択"
      >
        {isLoading ? '読み込み中...' : 'ファイルを選択'}
      </button>
    </div>
  );
};