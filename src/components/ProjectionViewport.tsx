import { RefObject, useEffect, useRef } from 'react';
import type { SlideTextNode } from '../utils/wcag/analyzer';

type TextOverlayPayload = {
  nodes: SlideTextNode[];
  baseWidth: number;
  baseHeight: number;
  headingScale: number;
  bodyScale: number;
};

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

    const hasOverlayData =
      textOverlay &&
      textOverlay.nodes &&
      textOverlay.nodes.length > 0 &&
      (textOverlay.headingScale !== 1 || textOverlay.bodyScale !== 1);

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
      const scale = node.role === 'heading' ? textOverlay.headingScale : textOverlay.bodyScale;
      if (!Number.isFinite(scale) || scale <= 0) {
        return;
      }
      const fontSize = Math.max(node.fontSize * scale, 6);
      ctx.font = `${fontSize}px "Inter", "Segoe UI", sans-serif`;
      ctx.fillStyle = node.role === 'heading' ? 'rgba(244, 248, 255, 0.95)' : 'rgba(224, 230, 255, 0.85)';
      ctx.fillText(node.text, node.bounds.x, node.bounds.y);
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
          {!isReady && <p>プレビュー画像を読み込んでください</p>}
          {isLoading && <p>読み込み中...</p>}
        </div>
      )}
    </div>
  );
};

export default ProjectionViewport;
