import { RefObject, useEffect } from 'react';
import ProjectionViewport from './ProjectionViewport';

type ProjectorPreviewScreenProps = {
  canvasRef: RefObject<HTMLCanvasElement>;
  isLoading: boolean;
  isReady: boolean;
  canGoPrev: boolean;
  canGoNext: boolean;
  onGoPrev?: () => void;
  onGoNext?: () => void;
  aspectRatio?: number | null;
  onClose: () => void;
};

const ProjectorPreviewScreen = ({
  canvasRef,
  isLoading,
  isReady,
  canGoPrev,
  canGoNext,
  onGoPrev,
  onGoNext,
  aspectRatio,
  onClose
}: ProjectorPreviewScreenProps) => {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="projector-screen" role="dialog" aria-modal="true" aria-label="プロジェクタープレビュー">
      <button className="projector-screen__close" type="button" onClick={onClose} aria-label="閉じる">
        ×
      </button>
      <div className="projector-screen__viewport">
        <ProjectionViewport
          canvasRef={canvasRef}
          isLoading={isLoading}
          isReady={isReady}
          canGoPrev={canGoPrev}
          canGoNext={canGoNext}
          onGoPrev={onGoPrev}
          onGoNext={onGoNext}
          aspectRatio={aspectRatio}
          textOverlay={null}
        />
      </div>
    </div>
  );
};

export default ProjectorPreviewScreen;

