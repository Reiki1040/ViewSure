import { RefObject, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { calculateScale } from '../utils/webgl';
import type { WcagSlideAdjustments } from '../utils/wcag/adjustments';

type ProjectionViewportProps = {
  canvasRef: RefObject<HTMLCanvasElement>;
  isLoading: boolean;
  isReady: boolean;
  canGoPrev?: boolean;
  canGoNext?: boolean;
  onGoPrev?: () => void;
  onGoNext?: () => void;
  wcagAdjustments?: WcagSlideAdjustments | null;
};

const ProjectionViewport = ({
  canvasRef,
  isLoading,
  isReady,
  canGoPrev = false,
  canGoNext = false,
  onGoPrev,
  onGoNext,
  wcagAdjustments = null
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
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const updateSize = () => {
      setCanvasSize({
        width: canvas.clientWidth,
        height: canvas.clientHeight
      });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(canvas);
    return () => {
      observer.disconnect();
    };
  }, [canvasRef]);

  const overlayNodes = useMemo(() => {
    if (!wcagAdjustments || !canvasSize.width || !canvasSize.height) {
      return [];
    }
    const { slideWidth, slideHeight, nodes } = wcagAdjustments;
    if (slideWidth === 0 || slideHeight === 0 || nodes.length === 0) {
      return [];
    }

    const scale = calculateScale(canvasSize, { width: slideWidth, height: slideHeight });
    const drawnWidth = canvasSize.width * scale.x;
    const drawnHeight = canvasSize.height * scale.y;
    const offsetX = (canvasSize.width - drawnWidth) / 2;
    const offsetY = (canvasSize.height - drawnHeight) / 2;
    const toJustify = (align: 'left' | 'center' | 'right') => {
      if (align === 'center') {
        return 'center';
      }
      return align === 'right' ? 'flex-end' : 'flex-start';
    };

    return nodes.map((node) => {
      const widthRatio = node.bounds.width / slideWidth;
      const heightRatio = node.bounds.height / slideHeight;
      const baseWidth = drawnWidth * widthRatio;
      const baseHeight = drawnHeight * heightRatio;
      const minWidth = Math.max(baseWidth, node.fontSize * 4.2);
      const minHeight = Math.max(baseHeight, node.fontSize * (node.role === 'heading' ? 1.6 : 1.9));
      const absoluteLeft = offsetX + (node.bounds.x / slideWidth) * drawnWidth;
      const absoluteTop = offsetY + (node.bounds.y / slideHeight) * drawnHeight;
      const clampedLeft = Math.min(Math.max(absoluteLeft, offsetX), offsetX + drawnWidth - minWidth);
      const clampedTop = Math.min(Math.max(absoluteTop, offsetY), offsetY + drawnHeight - minHeight);
      const verticalPadding = Math.max(10, Math.min(minHeight * 0.2, node.fontSize * 0.8));
      const horizontalPadding = Math.max(14, Math.min(minWidth * 0.12, node.fontSize * 1.1));
      const style: CSSProperties = {
        position: 'absolute',
        left: `${clampedLeft}px`,
        top: `${clampedTop}px`,
        width: `${minWidth}px`,
        minHeight: `${minHeight}px`,
        padding: `${verticalPadding}px ${horizontalPadding}px`,
        fontSize: `${node.fontSize}px`,
        fontFamily: node.fontFamily,
        fontWeight: node.fontWeight,
        color: node.color,
        backgroundColor: node.backgroundColor,
        lineHeight: node.lineHeight,
        letterSpacing: `${node.letterSpacing}em`,
        textAlign: node.textAlign,
        display: 'flex',
        alignItems: 'center',
        justifyContent: toJustify(node.textAlign),
        borderRadius: '18px',
        boxShadow: '0 18px 42px rgba(8, 12, 24, 0.32)',
        backdropFilter: 'blur(4px)',
        pointerEvents: 'none',
        whiteSpace: 'pre-wrap',
        zIndex: 2
      };

      return {
        id: node.id,
        text: node.text,
        style
      };
    });
  }, [canvasSize, wcagAdjustments]);

  return (
    <div className="viewport">
      <canvas ref={canvasRef} className="viewport__canvas" />
      {overlayNodes.length > 0 && (
        <div className="viewport__wcag-overlay" aria-hidden="true">
          {overlayNodes.map((node) => (
            <div key={node.id} className="viewport__wcag-text" style={node.style}>
              {node.text}
            </div>
          ))}
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
