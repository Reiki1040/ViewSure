import { RefObject } from 'react';

type ProjectionViewportProps = {
  canvasRef: RefObject<HTMLCanvasElement>;
  isLoading: boolean;
  isReady: boolean;
  canGoPrev?: boolean;
  canGoNext?: boolean;
  onGoPrev?: () => void;
  onGoNext?: () => void;
};

const ProjectionViewport = ({
  canvasRef,
  isLoading,
  isReady,
  canGoPrev = false,
  canGoNext = false,
  onGoPrev,
  onGoNext
}: ProjectionViewportProps) => {
  const showOverlay = isLoading || !isReady;
  const showNavigation = !showOverlay && (canGoPrev || canGoNext);
  const handlePrev = () => {
    if (onGoPrev) {
      onGoPrev();
    }
  };
  const handleNext = () => {
    if (onGoNext) {
      onGoNext();
    }
  };

  return (
    <div className="viewport">
      <canvas ref={canvasRef} className="viewport__canvas" />
      {showNavigation && (
        <>
          <button
            type="button"
            className="viewport__nav viewport__nav--prev"
            onClick={handlePrev}
            disabled={!canGoPrev}
            aria-label="前のページへ"
          >
            ‹
          </button>
          <button
            type="button"
            className="viewport__nav viewport__nav--next"
            onClick={handleNext}
            disabled={!canGoNext}
            aria-label="次のページへ"
          >
            ›
          </button>
        </>
      )}
      {showOverlay && (
        <div className="viewport__overlay">
          {!isReady && <p>プレビュー画像を読み込んでください</p>}
          {isLoading && <p>読み込み中...</p>}
        </div>
      )}
    </div>
  );
};

export default ProjectionViewport;
