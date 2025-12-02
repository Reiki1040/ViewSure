import type { PdfPageTextContent, PdfPageTextRun } from '../types/pdf';
import type { ImageCrop } from './imageExtractor';
import type { ContrastIssue } from './wcag';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const sanitize = (text: string) => text.replace(/\s+/g, ' ').trim();
const bulletRegex = /^[\u2022\u2023\u25CF\u25CB\u25A0\u25B6\u25AA\u25AB\u30fb・\-]+\s*/;

const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
  const words = text.split(/(\s+)/);
  const lines: string[] = [];
  let current = '';
  words.forEach((part) => {
    const next = current + part;
    if (ctx.measureText(next).width > maxWidth && current.trim().length > 0 && !/^\s+$/.test(part)) {
      lines.push(current.trim());
      current = part.trim();
    } else {
      current = next;
    }
  });
  if (current.trim()) {
    lines.push(current.trim());
  }
  return lines;
};

type LineInfo = {
  text: string;
  fontSize: number;
  isBullet: boolean;
  runs: PdfPageTextRun[];
};

const buildLineInfos = (textContent: PdfPageTextContent): LineInfo[] => {
  const sorted = [...textContent.runs].sort((a, b) => a.y - b.y || a.x - b.x);
  const lineThreshold = Math.max(6, textContent.height * 0.02);
  const lines: Array<{ y: number; runs: PdfPageTextRun[] }> = [];

  sorted.forEach((run) => {
    const segments = run.text.split(/[\r\n]+/).map(sanitize).filter(Boolean);
    if (!segments.length) {
      return;
    }
    let line = lines.find((entry) => Math.abs(entry.y - run.y) < lineThreshold);
    if (!line) {
      line = { y: run.y, runs: [] };
      lines.push(line);
    }
    const merged: PdfPageTextRun = { ...run, text: segments.join(' ') };
    line.runs.push(merged);
  });

  return lines
    .sort((a, b) => a.y - b.y)
    .map((line) => {
      const text = sanitize(line.runs.map((r) => r.text).join(' '));
      const avgFont = line.runs.reduce((sum, r) => sum + r.fontSize, 0) / line.runs.length;
      return {
        text,
        fontSize: avgFont,
        isBullet: bulletRegex.test(text),
        runs: line.runs
      };
    })
    .filter((line) => line.text.length > 0);
};

const extractHeadingAndBody = (lineInfos: LineInfo[]) => {
  if (!lineInfos.length) {
    return {
      heading: '資料タイトル',
      bodyLines: [] as LineInfo[]
    };
  }
  const maxFont = Math.max(...lineInfos.map((line) => line.fontSize));
  const headingLines = lineInfos.filter((line, index) => line.fontSize >= maxFont * 0.9 && index <= 3);
  if (headingLines.length === 0) {
    headingLines.push(lineInfos[0]);
  }
  const headingText = headingLines.map((line) => line.text.replace(bulletRegex, '').trim()).join(' / ').trim();
  const bodyLines = lineInfos.filter((line) => !headingLines.includes(line));
  return {
    heading: headingText || '資料タイトル',
    bodyLines
  };
};

const selectBodyLines = (bodyLines: LineInfo[], issues: ContrastIssue[]) => {
  if (!bodyLines.length) {
    return [];
  }
  const highlighted = new Set(
    issues
      .map((issue) => sanitize(issue.text))
      .filter(Boolean)
  );

  return bodyLines
    .map((line) => {
      const normalized = line.text.replace(bulletRegex, '').trim();
      return {
        text: normalized,
        isBullet: line.isBullet || bulletRegex.test(line.text) || highlighted.has(line.text) || highlighted.has(normalized)
      };
    })
    .slice(0, 8);
};

const overlapArea = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) => {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  const w = x2 - x1;
  const h = y2 - y1;
  if (w <= 0 || h <= 0) return 0;
  return w * h;
};

const detectImageRegions = (
  pageCanvas: HTMLCanvasElement | null,
  textContent: PdfPageTextContent,
  maxRegions = 3
) => {
  if (!pageCanvas) {
    return [] as Array<{ x: number; y: number; width: number; height: number; canvas: HTMLCanvasElement }>;
  }

  const cols = 20;
  const rows = 14;
  const tileW = pageCanvas.width / cols;
  const tileH = pageCanvas.height / rows;
  const ctx = pageCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return [];
  }

  // 前処理: テキストマスク（各タイルに対するテキストカバレッジを計算）
  const textMask = Array.from({ length: rows }, () => new Array(cols).fill(0));
  textContent.runs.forEach((run) => {
    const startCol = Math.max(0, Math.floor((run.x / textContent.width) * cols));
    const endCol = Math.min(cols - 1, Math.floor(((run.x + run.width) / textContent.width) * cols));
    const startRow = Math.max(0, Math.floor(((textContent.height - (run.y + run.height)) / textContent.height) * rows));
    const endRow = Math.min(rows - 1, Math.floor(((textContent.height - run.y) / textContent.height) * rows));
    for (let r = startRow; r <= endRow; r += 1) {
      for (let c = startCol; c <= endCol; c += 1) {
        textMask[r][c] = 1;
      }
    }
  });

  const imageTiles: Array<{ r: number; c: number }> = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (textMask[r][c] === 1) {
        continue;
      }
      const sx = Math.floor(c * tileW);
      const sy = Math.floor(r * tileH);
      const sw = Math.ceil(tileW);
      const sh = Math.ceil(tileH);
      const data = ctx.getImageData(sx, sy, sw, sh).data;

      // 色分散とエッジの簡易判定
      let sum = 0;
      let sumSq = 0;
      let edges = 0;
      for (let i = 0; i < data.length; i += 4) {
        const rC = data[i];
        const gC = data[i + 1];
        const bC = data[i + 2];
        const lum = 0.2126 * rC + 0.7152 * gC + 0.0722 * bC;
        sum += lum;
        sumSq += lum * lum;
      }
      const pixels = data.length / 4;
      const mean = sum / pixels;
      const variance = sumSq / pixels - mean * mean;

      // 近傍との差分でエッジ量をざっくり計測（縦横に1ピクセルずつ）
      for (let y = 0; y < sh - 1; y += 4) {
        for (let x = 0; x < sw - 1; x += 4) {
          const idx = (y * sw + x) * 4;
          const idxRight = idx + 4;
          const idxBottom = idx + sw * 4;
          const lum = 0.2126 * data[idx] + 0.7152 * data[idx + 1] + 0.0722 * data[idx + 2];
          const lumR = 0.2126 * data[idxRight] + 0.7152 * data[idxRight + 1] + 0.0722 * data[idxRight + 2];
          const lumB = 0.2126 * data[idxBottom] + 0.7152 * data[idxBottom + 1] + 0.0722 * data[idxBottom + 2];
          if (Math.abs(lum - lumR) > 18 || Math.abs(lum - lumB) > 18) {
            edges += 1;
          }
        }
      }

      if (variance > 1200 && edges > (sw * sh) / 200) {
        imageTiles.push({ r, c });
      }
    }
  }

  // 連結成分で画像領域を生成
  const visited = new Set<string>();
  const regions: Array<{ x: number; y: number; width: number; height: number; canvas: HTMLCanvasElement }> = [];

  const neighbors = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];

  const tileKey = (r: number, c: number) => `${r}-${c}`;
  const tileSet = new Set(imageTiles.map((t) => tileKey(t.r, t.c)));

  const floodFill = (startR: number, startC: number) => {
    const queue: Array<{ r: number; c: number }> = [{ r: startR, c: startC }];
    const cells: Array<{ r: number; c: number }> = [];
    visited.add(tileKey(startR, startC));
    while (queue.length) {
      const { r, c } = queue.pop()!;
      cells.push({ r, c });
      neighbors.forEach(([dr, dc]) => {
        const nr = r + dr;
        const nc = c + dc;
        const key = tileKey(nr, nc);
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !visited.has(key) && tileSet.has(key)) {
          visited.add(key);
          queue.push({ r: nr, c: nc });
        }
      });
    }
    return cells;
  };

  imageTiles.forEach(({ r, c }) => {
    const key = tileKey(r, c);
    if (visited.has(key)) {
      return;
    }
    const cells = floodFill(r, c);
    const minR = Math.min(...cells.map((p) => p.r));
    const maxR = Math.max(...cells.map((p) => p.r));
    const minC = Math.min(...cells.map((p) => p.c));
    const maxC = Math.max(...cells.map((p) => p.c));

    const region = {
      x: Math.round(minC * tileW),
      y: Math.round(minR * tileH),
      width: Math.round((maxC - minC + 1) * tileW),
      height: Math.round((maxR - minR + 1) * tileH)
    };
    const area = region.width * region.height;
    if (area < (pageCanvas.width * pageCanvas.height) * 0.03) {
      return;
    }

    // テキストとの重なり率が高い領域は除外（文字を画像と誤認するケースを減らす）
    const regionBox = { x: region.x, y: region.y, width: region.width, height: region.height };
    const textOverlap = textContent.runs.reduce((acc, run) => {
      const box = { x: run.x, y: textContent.height - run.y - run.height, width: run.width, height: run.height };
      return acc + overlapArea(regionBox, box);
    }, 0);
    const overlapRatio = textOverlap / Math.max(area, 1);
    if (overlapRatio > 0.12) {
      return;
    }

    const offscreen = document.createElement('canvas');
    offscreen.width = region.width;
    offscreen.height = region.height;
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) {
      return;
    }
    offCtx.drawImage(pageCanvas, region.x, region.y, region.width, region.height, 0, 0, region.width, region.height);
    regions.push({ ...region, canvas: offscreen });
  });

  return regions.slice(0, maxRegions);
};

/**
 * WCAGに沿ったプレゼンテンプレートでページを再構成する。
 * - 明るい背景＋濃色文字
 * - 見出しと箇条書きの二段構成
 * - 最低フォントサイズを保証
 */
export const applyAutoFix = (
  ctx: CanvasRenderingContext2D,
  textContent: PdfPageTextContent,
  issues: ContrastIssue[],
  pageCanvas: HTMLCanvasElement | null,
  providedImages?: ImageCrop[]
) => {
  const lineInfos = buildLineInfos(textContent);
  const { heading, bodyLines } = extractHeadingAndBody(lineInfos);
  const bullets = selectBodyLines(bodyLines, issues);
  const imageRegions =
    providedImages && providedImages.length > 0
      ? providedImages.map((img) => ({
          x: img.x,
          y: img.y,
          width: img.width,
          height: img.height,
          canvas: img.canvas
        }))
      : detectImageRegions(pageCanvas, textContent);

  const { width, height } = ctx.canvas;
  ctx.save();
  ctx.clearRect(0, 0, width, height);

  ctx.fillStyle = '#eef2ff';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(60, 80, 140, 0.25)';
  const cardPadding = width * 0.06;
  ctx.fillRect(cardPadding, cardPadding * 0.8, width - cardPadding * 2, height - cardPadding * 1.6);
  ctx.lineWidth = 2;
  ctx.strokeRect(cardPadding, cardPadding * 0.8, width - cardPadding * 2, height - cardPadding * 1.6);

  const headingFontSize = Math.max(32, Math.round(height * 0.065));
  ctx.font = `700 ${headingFontSize}px "Inter", "Hiragino Sans", system-ui`;
  ctx.fillStyle = '#121531';
  ctx.textBaseline = 'top';

  const headingMaxWidth = width - cardPadding * 2 - 40;
  const headingLines = wrapText(ctx, heading, headingMaxWidth);
  let cursorY = cardPadding * 0.8 + 32;

  headingLines.forEach((line) => {
    ctx.fillText(line, cardPadding + 24, cursorY);
    cursorY += headingFontSize + 8;
  });

  cursorY += 16;
  const bulletFont = Math.max(22, Math.round(height * 0.038));
  ctx.font = `600 ${bulletFont}px "Inter", "Hiragino Sans", system-ui`;

  const galleryWidth = imageRegions.length > 0 ? Math.min(width * 0.28, 360) : 0;
  const galleryOffset = imageRegions.length > 0 ? galleryWidth + 40 : 0;
  const bulletMaxWidth = width - cardPadding * 2 - 80 - galleryOffset;

  bullets.forEach(({ text, isBullet }) => {
    const lines = wrapText(ctx, text, bulletMaxWidth);
    if (cursorY + lines.length * (bulletFont + 8) > height - cardPadding) {
      return;
    }
    lines.forEach((line, lineIndex) => {
      const renderPrefix = isBullet ? (lineIndex === 0 ? '• ' : '  ') : '';
      ctx.fillText(renderPrefix + line, cardPadding + 40, cursorY);
      cursorY += bulletFont + 8;
    });
    cursorY += 10;
  });

  if (imageRegions.length > 0) {
    const galleryX = width - cardPadding - galleryWidth - 20;
    const galleryY = cardPadding * 0.85;
    const galleryHeight = height - galleryY - cardPadding * 0.9;
    ctx.fillStyle = '#f7f9ff';
    ctx.strokeStyle = 'rgba(60, 80, 140, 0.28)';
    ctx.lineWidth = 1.5;
    ctx.fillRect(galleryX, galleryY, galleryWidth, galleryHeight);
    ctx.strokeRect(galleryX, galleryY, galleryWidth, galleryHeight);

    const padding = 16;
    const slotHeight = (galleryHeight - padding * (imageRegions.length + 1)) / imageRegions.length;
    const slotWidth = galleryWidth - padding * 2;

    imageRegions.forEach((region, index) => {
      const ratio = region.canvas.height / Math.max(region.canvas.width, 1);
      const targetHeight = Math.min(slotHeight, slotWidth * ratio);
      const dx = galleryX + padding;
      const dy = galleryY + padding + index * (slotHeight + padding);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(dx, dy, slotWidth, targetHeight);
      ctx.drawImage(region.canvas, dx, dy, slotWidth, targetHeight);
    });
  }

  ctx.restore();
};
