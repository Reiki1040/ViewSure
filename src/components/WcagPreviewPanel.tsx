import { useCallback, useEffect, useMemo, useRef, type CSSProperties } from 'react';
import type { TextOverlayPayload, TextOverlayNode } from '../hooks/useWcagHelper';
import LoadingSpinner from './LoadingSpinner';

type WcagPreviewPanelProps = {
  overlay: TextOverlayPayload | null;
  aspectRatio: number;
  isBusy: boolean;
};

const drawOverlayText = (
  ctx: CanvasRenderingContext2D,
  nodes: TextOverlayNode[],
  scaleX: number,
  scaleY: number
) => {
  ctx.save();
  ctx.scale(scaleX, scaleY);
  ctx.textBaseline = 'top';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
  ctx.shadowBlur = 6;

  nodes.forEach((node) => {
    const fontSize = Math.max(node.fontSize, 6);
    const fontWeight = node.fontWeight ?? (node.role === 'heading' ? 600 : 400);
    const fontFamily = node.fontFamily ?? '"Inter", "Segoe UI", sans-serif';
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    const textColor =
      node.color ?? (node.role === 'heading' ? 'rgba(244, 248, 255, 0.95)' : 'rgba(224, 230, 255, 0.88)');
    if (node.background) {
      ctx.fillStyle = node.background;
      ctx.fillRect(node.bounds.x, node.bounds.y, node.bounds.width, node.bounds.height);
    }
    ctx.fillStyle = textColor;
    ctx.fillText(node.content, node.bounds.x, node.bounds.y);
  });

  ctx.restore();
};

const DEFAULT_ASPECT = 9 / 16;

const WcagPreviewPanel = ({ overlay, aspectRatio, isBusy }: WcagPreviewPanelProps) => {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const hasAdjustments = Boolean(overlay?.hasAdjustments && overlay.nodes.length);

  const redraw = useCallback(() => {
    const frame = frameRef.current;
    const canvas = canvasRef.current;
    if (!frame || !canvas) {
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const dpr = window.devicePixelRatio ?? 1;
    const width = frame.clientWidth;
    const height = frame.clientHeight;
    if (width === 0 || height === 0) {
      return;
    }

    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!overlay || !hasAdjustments) {
      return;
    }

    const scaleX = (canvas.width / dpr) / overlay.baseWidth;
    const scaleY = (canvas.height / dpr) / overlay.baseHeight;

    console.debug('[WcagPreview] redraw', {
      frame: { width, height },
      canvas: { width: canvas.width, height: canvas.height },
      base: { width: overlay.baseWidth, height: overlay.baseHeight },
      scaleX,
      scaleY
    });

    ctx.save();
    ctx.scale(dpr, dpr);
    drawOverlayText(ctx, overlay.nodes, scaleX, scaleY);
    ctx.restore();
  }, [overlay, hasAdjustments]);

  useEffect(() => {
    redraw();
  }, [redraw, aspectRatio]);

  useEffect(() => {
    const handleResize = () => {
      redraw();
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [redraw]);

  const statusMessage = useMemo(() => {
    if (isBusy && !overlay) {
      return 'WCAG プレビューを準備しています…';
    }
    if (!overlay) {
      return 'WCAG 解析後のテキスト調整結果はここに表示されます。';
    }
    if (!hasAdjustments) {
      return '適用された WCAG 調整がありません。';
    }
    return null;
  }, [overlay, hasAdjustments, isBusy]);

  const heightPerWidth =
    Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : DEFAULT_ASPECT;
  const aspectPadding = heightPerWidth * 100;
  const showCanvas = !statusMessage;

  return (
    <section className="wcag-preview">
      <header className="wcag-preview__header">
        <h2>WCAG 適合プレビュー</h2>
        <span>調整済みのテキストのみを確認できます。</span>
      </header>
      <div
        className={`wcag-preview__content${showCanvas ? ' wcag-preview__content--canvas' : ''}`}
        style={showCanvas ? ({ '--wcag-aspect': `${aspectPadding}%` } as CSSProperties) : undefined}
      >
        {showCanvas ? (
          <div className="wcag-preview__frame" ref={frameRef}>
            <canvas ref={canvasRef} className="wcag-preview__canvas" />
          </div>
        ) : (
          <div className="wcag-preview__placeholder">
            {isBusy && !overlay ? <LoadingSpinner size="small" message={statusMessage!} /> : <p>{statusMessage}</p>}
          </div>
        )}
      </div>
    </section>
  );
};

export default WcagPreviewPanel;
