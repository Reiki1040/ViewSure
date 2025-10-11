import { ChangeEvent, DragEvent, useCallback, useRef, useState } from 'react';

type FileUploaderProps = {
  disabled?: boolean;
  statusMessage?: string | null;
  onFileSelected: (file: File) => void | Promise<void>;
};

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/heic',
  'image/heif',
  '.heic',
  '.heif'
];

const FileUploader = ({ disabled = false, statusMessage, onFileSelected }: FileUploaderProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) {
        return;
      }
      const [file] = files;
      onFileSelected(file);
    },
    [onFileSelected]
  );

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      handleFiles(event.target.files);
    },
    [handleFiles]
  );

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (disabled) {
      return;
    }
    event.dataTransfer.dropEffect = 'copy';
    setIsDragActive(true);
  }, [disabled]);

  const handleDragLeave = useCallback(() => {
    setIsDragActive(false);
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragActive(false);
      if (disabled) {
        return;
      }
      handleFiles(event.dataTransfer.files);
    },
    [disabled, handleFiles]
  );

  const openFilePicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  return (
    <section className="uploader">
      <header className="uploader__header">
        <h2 className="uploader__title">資料アップロード</h2>
        <p className="uploader__subtitle">PDF / PPTX / 画像ファイル（PNG・JPEG・WEBP・HEIC）に対応</p>
      </header>
      <div
        className={`drop-zone ${disabled ? 'is-disabled' : ''} ${isDragActive ? 'is-active' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        onClick={openFilePicker}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openFilePicker();
          }
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          className="file-input"
          onChange={handleChange}
          disabled={disabled}
        />
        <span className="drop-zone__icon" aria-hidden="true">⬆︎</span>
        <p className="drop-zone__title">PDF または画像ファイルをドラッグ &amp; ドロップ</p>
        <p className="drop-zone__subtitle">クリックでファイルを選択 / 複数ページの資料は自動で読み込みます</p>
      </div>
      <div className="upload-status" role="status" aria-live="polite">
        {statusMessage ? <span>{statusMessage}</span> : <span>準備完了。ファイルを読み込んでください。</span>}
      </div>
    </section>
  );
};

export default FileUploader;
