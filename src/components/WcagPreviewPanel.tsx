import { useEffect, useMemo, useRef } from 'react';
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
  offsetX: number,
  offsetY: number,
  scaleX: number,
  scaleY: number
) => {
  ctx.save();
  ctx.translate(offsetX, offsetY);
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

const WcagPreviewPanel = ({ overlay, aspectRatio, isBusy }: WcagPreviewPanelProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const hasAdjustments = Boolean(overlay?.hasAdjustments && overlay.nodes.length);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const dpr = window.devicePixelRatio ?? 1;
    const containerWidth = container.clientWidth;
    const targetAspect = Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 9 / 16;
    const containerHeight = Math.max(160, containerWidth * targetAspect);

    canvas.style.width = `${containerWidth}px`;
    canvas.style.height = `${containerHeight}px`;
    canvas.width = Math.max(1, Math.floor(containerWidth * dpr));
    canvas.height = Math.max(1, Math.floor(containerHeight * dpr));
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!overlay || !hasAdjustments) {
      return;
    }

    const overlayRatio = overlay.baseHeight > 0 && overlay.baseWidth > 0 ? overlay.baseHeight / overlay.baseWidth : targetAspect;
    let drawWidth = canvas.width / dpr;
    let drawHeight = drawWidth * overlayRatio;
    let offsetX = 0;
    let offsetY = (canvas.height / dpr - drawHeight) / 2;

    if (drawHeight > canvas.height / dpr) {
      drawHeight = canvas.height / dpr;
      drawWidth = drawHeight / overlayRatio;
      offsetX = (canvas.width / dpr - drawWidth) / 2;
      offsetY = 0;
    }

    const scaleX = drawWidth / overlay.baseWidth;
    const scaleY = drawHeight / overlay.baseHeight;
    ctx.save();
    ctx.scale(dpr, dpr);
    drawOverlayText(ctx, overlay.nodes, offsetX, offsetY, scaleX, scaleY);
    ctx.restore();
  }, [overlay, hasAdjustments, aspectRatio]);

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

  return (
    <section className="wcag-preview">
      <header className="wcag-preview__header">
        <h2>WCAG 適合プレビュー</h2>
        <span>調整済みのテキストのみを確認できます。</span>
      </header>
      <div className="wcag-preview__content" ref={containerRef}>
        {statusMessage ? (
          <div className="wcag-preview__placeholder">
            {isBusy && !overlay ? <LoadingSpinner size="small" message={statusMessage} /> : <p>{statusMessage}</p>}
          </div>
        ) : (
          <canvas ref={canvasRef} className="wcag-preview__canvas" />
        )}
      </div>
    </section>
  );
};

export default WcagPreviewPanel;
