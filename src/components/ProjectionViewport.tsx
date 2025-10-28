import { RefObject, useCallback, useEffect, useRef, type CSSProperties } from 'react';
import type { TextOverlayPayload } from '../hooks/useWcagHelper';
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
  textOverlay?: TextOverlayPayload | null;
};

const ProjectionViewport = ({
  canvasRef,
  isLoading,
  isReady,
  canGoPrev = false,
  canGoNext = false,
  onGoPrev,
  onGoNext,
  aspectRatio,
  textOverlay
}: ProjectionViewportProps) => {
  const showOverlay = isLoading || !isReady;
  const showNavigation = !showOverlay && (canGoPrev || canGoNext);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);

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

  const drawOverlay = useCallback(() => {
    const overlayCanvas = overlayCanvasRef.current;
    const baseCanvas = canvasRef.current;
    const frame = frameRef.current;
    if (!overlayCanvas || !baseCanvas || !frame) {
      return;
    }

    const ctx = overlayCanvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const hasOverlayData = Boolean(textOverlay?.nodes?.length && textOverlay.hasAdjustments);

    const displayWidth = frame.clientWidth || baseCanvas.clientWidth || baseCanvas.width;
    const displayHeight = frame.clientHeight || baseCanvas.clientHeight || baseCanvas.height;

    overlayCanvas.width = displayWidth;
    overlayCanvas.height = displayHeight;
    ctx.clearRect(0, 0, displayWidth, displayHeight);

    if (!hasOverlayData) {
      return;
    }

    const scaleX = displayWidth / textOverlay.baseWidth;
    const scaleY = displayHeight / textOverlay.baseHeight;
    ctx.save();
    ctx.scale(scaleX, scaleY);
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 6;

    console.debug('[ProjectionViewport] overlay redraw', {
      displayWidth,
      displayHeight,
      baseWidth: textOverlay.baseWidth,
      baseHeight: textOverlay.baseHeight,
      scaleX,
      scaleY
    });

    textOverlay.nodes.forEach((node) => {
      const fontSize = Math.max(node.fontSize, 6);
      const fontWeight = node.fontWeight ?? (node.role === 'heading' ? 600 : 400);
      const fontFamily = node.fontFamily ?? '"Inter", "Segoe UI", sans-serif';
      ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
      ctx.fillStyle =
        node.color ?? (node.role === 'heading' ? 'rgba(244, 248, 255, 0.95)' : 'rgba(224, 230, 255, 0.85)');
      ctx.fillText(node.content, node.bounds.x, node.bounds.y);
    });

    ctx.restore();
  }, [canvasRef, textOverlay]);

  useEffect(() => {
    drawOverlay();
  }, [drawOverlay, aspectRatio]);

  useEffect(() => {
    window.addEventListener('resize', drawOverlay);
    return () => {
      window.removeEventListener('resize', drawOverlay);
    };
  }, [drawOverlay]);

  const heightPerWidth =
    aspectRatio && Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 9 / 16;
  const aspectPadding = heightPerWidth * 100;

  return (
    <div
      className="viewport"
      style={{ '--viewport-aspect': `${aspectPadding}%` } as CSSProperties}
    >
      <div className="viewport__content" ref={frameRef}>
        <canvas ref={canvasRef} className="viewport__canvas" />
        <canvas ref={overlayCanvasRef} className="viewport__font-overlay" />
        {showOverlay && (
          <div className="viewport__overlay">
            {!isReady && !isLoading ? (
              <p>プレビュー画像を読み込んでください</p>
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
      </div>
    </div>
  );
};

export default ProjectionViewport;
