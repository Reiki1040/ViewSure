import {
  ChangeEvent,
  DragEvent,
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState
} from 'react';

type FileUploaderProps = {
  disabled?: boolean;
  statusMessage?: string | null;
  onFileSelected: (file: File) => void | Promise<void>;
};

export type FileUploaderHandle = {
  openFileDialog: () => void;
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

const FileUploader = forwardRef<FileUploaderHandle, FileUploaderProps>(({ disabled = false, statusMessage, onFileSelected }, ref) => {
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

  useImperativeHandle(
    ref,
    () => ({
      openFileDialog: openFilePicker
    }),
    [openFilePicker]
  );

  return (
    <section className="uploader uploader--hero" aria-label="資料アップロード">
      <div
        className={`drop-zone drop-zone--hero ${disabled ? 'is-disabled' : ''} ${isDragActive ? 'is-active' : ''}`}
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
        <span className="drop-zone__icon" aria-hidden="true">📁</span>
        <p className="drop-zone__title">PDF または画像ファイルをドラッグ &amp; ドロップ</p>
        <p className="drop-zone__subtitle">PDF / PPTX / PNG / JPEG / WEBP / HEIC に対応</p>
      </div>
      <div className="upload-status" role="status" aria-live="polite">
        {statusMessage ? <span>{statusMessage}</span> : <span>準備完了。ファイルを読み込んでください。</span>}
      </div>
    </section>
  );
});

FileUploader.displayName = 'FileUploader';

export default FileUploader;
