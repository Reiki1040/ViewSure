import { RefObject, useEffect, useRef } from 'react';
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
  textOverlay
}: ProjectionViewportProps) => {
  const showOverlay = isLoading || !isReady;
  const showNavigation = !showOverlay && (canGoPrev || canGoNext);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);

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

  useEffect(() => {
    const overlayCanvas = overlayCanvasRef.current;
    const baseCanvas = canvasRef.current;
    if (!overlayCanvas || !baseCanvas) {
      return;
    }

    const ctx = overlayCanvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const hasOverlayData = Boolean(textOverlay?.nodes?.length && textOverlay.hasAdjustments);

    const displayWidth = baseCanvas.clientWidth || baseCanvas.width;
    const displayHeight = baseCanvas.clientHeight || baseCanvas.height;

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

  return (
    <div className="viewport">
      <canvas ref={canvasRef} className="viewport__canvas" />
      <canvas ref={overlayCanvasRef} className="viewport__font-overlay" />
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
          {!isReady && !isLoading ? (
            <p>プレビュー画像を読み込んでください</p>
          ) : null}
          {isLoading ? (
            <LoadingSpinner className="viewport__overlay-spinner" message="読み込み中です..." />
          ) : null}
        </div>
      )}
    </div>
  );
};

export default ProjectionViewport;
