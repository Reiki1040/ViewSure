import { RefObject, type CSSProperties } from 'react';
import LoadingSpinner from './LoadingSpinner';

type ProjectionViewportProps = {
  canvasRef: RefObject<HTMLCanvasElement>;
  isLoading: boolean;
  isReady: boolean;
  canGoPrev?: boolean;
  canGoNext?: boolean;
  onGoPrev?: () => void;
  onGoNext?: () => void;
  aspectRatio?: number | null;
};

const ProjectionViewport = ({
  canvasRef,
  isLoading,
  isReady,
  canGoPrev = false,
  canGoNext = false,
  onGoPrev,
  onGoNext,
  aspectRatio
}: ProjectionViewportProps) => {
  const showOverlay = isLoading || !isReady;
  const showNavigation = !showOverlay && (canGoPrev || canGoNext);
  const heightPerWidth = aspectRatio && Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 9 / 16;
  const aspectPadding = heightPerWidth * 100;

  return (
    <div
      className="viewport"
      style={{ '--viewport-aspect': `${aspectPadding}%` } as CSSProperties}
    >
      <div className="viewport__content">
        <canvas ref={canvasRef} className="viewport__canvas" />
        {showOverlay && (
          <div className="viewport__overlay">
            {!isReady && !isLoading ? (
              <p>PDF を読み込んでください</p>
            ) : null}
            {isLoading ? (
              <LoadingSpinner className="viewport__overlay-spinner" message="読み込み中です..." />
            ) : null}
          </div>
        )}
        {showNavigation && (
          <>
            <button
              type="button"
              className="viewport__nav viewport__nav--prev"
              onClick={onGoPrev}
              disabled={!canGoPrev}
              aria-label="前のページへ"
            >
              ‹
            </button>
            <button
              type="button"
              className="viewport__nav viewport__nav--next"
              onClick={onGoNext}
              disabled={!canGoNext}
              aria-label="次のページへ"
            >
              ›
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ProjectionViewport;
