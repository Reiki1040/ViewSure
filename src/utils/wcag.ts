import { type PdfPageTextContent, type PdfPageTextRun } from '../types/pdf';

type Rgb = { r: number; g: number; b: number };

export interface ContrastIssue {
  text: string;
  ratio: number;
  required: number;
  isLargeText: boolean;
  fg: Rgb;
  bg: Rgb;
  box: { x: number; y: number; width: number; height: number };
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const computeLuma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/**
 * 指定された矩形領域の平均色を計算する
 * 
 * @param ctx キャンバスコンテキスト
 * @param x X座標
 * @param y Y座標
 * @param width 幅
 * @param height 高さ
 * @returns 平均RGB値
 */
const sampleAverageColor = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): Rgb => {
  const sx = Math.floor(clamp(x, 0, ctx.canvas.width - 1));
  const sy = Math.floor(clamp(y, 0, ctx.canvas.height - 1));
  const sw = Math.max(1, Math.floor(clamp(width, 1, ctx.canvas.width - sx)));
  const sh = Math.max(1, Math.floor(clamp(height, 1, ctx.canvas.height - sy)));
  const data = ctx.getImageData(sx, sy, sw, sh).data;

  let r = 0;
  let g = 0;
  let b = 0;
  const pixels = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
  }
  return {
    r: r / pixels,
    g: g / pixels,
    b: b / pixels
  };
};

type Sample = { r: number; g: number; b: number; lum: number };

const collectSamples = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  options?: { exclude?: { x: number; y: number; width: number; height: number }; stride?: number }
): Sample[] => {
  const sx = Math.floor(clamp(x, 0, ctx.canvas.width - 1));
  const sy = Math.floor(clamp(y, 0, ctx.canvas.height - 1));
  const sw = Math.max(1, Math.floor(clamp(width, 1, ctx.canvas.width - sx)));
  const sh = Math.max(1, Math.floor(clamp(height, 1, ctx.canvas.height - sy)));
  const data = ctx.getImageData(sx, sy, sw, sh).data;
  const stride = options?.stride ?? 2;
  const exclude = options?.exclude;
  const samples: Sample[] = [];

  for (let row = 0; row < sh; row += stride) {
    for (let col = 0; col < sw; col += stride) {
      const absX = sx + col;
      const absY = sy + row;
      if (exclude) {
        const insideX = absX >= exclude.x && absX <= exclude.x + exclude.width;
        const insideY = absY >= exclude.y && absY <= exclude.y + exclude.height;
        if (insideX && insideY) {
          continue;
        }
      }
      const idx = (row * sw + col) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      samples.push({ r, g, b, lum: computeLuma(r, g, b) });
    }
  }

  return samples;
};

const summarizeSamples = (samples: Sample[]) => {
  const sorted = [...samples].sort((a, b) => a.lum - b.lum);
  const pickColor = (percentile: number) => {
    const index = Math.floor((sorted.length - 1) * percentile);
    const window = Math.max(1, Math.floor(sorted.length * 0.05));
    const start = Math.max(0, index - window);
    const end = Math.min(sorted.length - 1, index + window);
    let r = 0;
    let g = 0;
    let b = 0;
    let count = 0;
    for (let i = start; i <= end; i += 1) {
      r += sorted[i].r;
      g += sorted[i].g;
      b += sorted[i].b;
      count += 1;
    }
    const avg = {
      r: r / count,
      g: g / count,
      b: b / count
    };
    return { color: avg, lum: computeLuma(avg.r, avg.g, avg.b) };
  };

  return {
    medianLum: sorted[Math.floor((sorted.length - 1) * 0.5)].lum,
    low: pickColor(0.1),
    high: pickColor(0.9)
  };
};

/**
 * 相対輝度を計算する (WCAG 2.0 定義)
 * https://www.w3.org/TR/WCAG20/#relativeluminancedef
 */
const relativeLuminance = (c: number) => {
  const srgb = c / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
};

const computeLuminance = ({ r, g, b }: Rgb) =>
  0.2126 * relativeLuminance(r) + 0.7152 * relativeLuminance(g) + 0.0722 * relativeLuminance(b);

/**
 * コントラスト比を計算する (WCAG 2.0 定義)
 * https://www.w3.org/TR/WCAG20/#contrast-ratiodef
 */
const contrastRatio = (fg: Rgb, bg: Rgb) => {
  const L1 = computeLuminance(fg);
  const L2 = computeLuminance(bg);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
};

const isLargeText = (run: PdfPageTextRun) => run.fontSize >= 18;

/**
 * ページ内のテキスト要素のコントラストを解析する
 * 
 * 各テキストの描画領域から前景色を取得し、その周囲から背景色をサンプリングして
 * コントラスト比がWCAG基準（AAレベル）を満たしているかチェックする。
 * 
 * @param ctx 描画済みキャンバスコンテキスト
 * @param textContent PDFのテキスト解析結果
 * @returns コントラスト問題のリスト
 */
export const analyzePageContrast = (ctx: CanvasRenderingContext2D, textContent: PdfPageTextContent): ContrastIssue[] => {
  const issues: ContrastIssue[] = [];

  textContent.runs.forEach((run) => {
    const margin = 4;
    const textSamples = collectSamples(ctx, run.x, run.y, run.width, run.height, { stride: 2 });
    const bgSamples = collectSamples(
      ctx,
      run.x - margin,
      run.y - margin,
      run.width + margin * 2,
      run.height + margin * 2,
      { exclude: { x: run.x, y: run.y, width: run.width, height: run.height }, stride: 2 }
    );

    let fg: Rgb;
    let bg: Rgb;

    if (textSamples.length >= 6 && bgSamples.length >= 6) {
      const textStats = summarizeSamples(textSamples);
      const bgStats = summarizeSamples(bgSamples);
      const assumeDarkText = textStats.medianLum < bgStats.medianLum;
      fg = assumeDarkText ? textStats.low.color : textStats.high.color;
      bg = assumeDarkText ? bgStats.high.color : bgStats.low.color;
    } else {
      // Fallback for very small glyphs
      const fgSampleSize = Math.max(2, Math.min(run.width, run.height) * 0.2);
      fg = sampleAverageColor(
        ctx,
        run.x + run.width / 2 - fgSampleSize / 2,
        run.y + run.height / 2 - fgSampleSize / 2,
        fgSampleSize,
        fgSampleSize
      );
      bg = sampleAverageColor(
        ctx,
        run.x - margin,
        run.y - margin,
        Math.max(4, run.width + margin * 2),
        Math.max(4, run.height + margin * 2)
      );
    }

    const ratio = contrastRatio(fg, bg);
    const large = isLargeText(run);
    
    // WCAG 2.1 AA基準: 通常文字 4.5:1, 大きな文字 3:1
    const required = large ? 3 : 4.5;
    if (ratio < required) {
      issues.push({
        text: run.text.slice(0, 30),
        ratio: Number(ratio.toFixed(2)),
        required,
        isLargeText: large,
        fg,
        bg,
        box: { x: run.x, y: run.y, width: run.width, height: run.height }
      });
    }
  });

  return issues;
};

export const logContrastIssues = (pageIndex: number, issues: ContrastIssue[]) => {
  if (!issues.length) {
    console.info(`[WCAG] Page ${pageIndex + 1}: 全てのテキストが基準を満たしています (AAのコントラスト基準で評価)`);
    return;
  }
  console.group(`[WCAG] Page ${pageIndex + 1}: コントラスト未達 ${issues.length}件`);
  issues.forEach((issue) => {
    console.info(
      `「${issue.text}」 ratio=${issue.ratio} (< ${issue.required}) ${issue.isLargeText ? '[大きい文字扱い]' : ''} fg=${issue.fg.r.toFixed(0)},${issue.fg.g.toFixed(0)},${issue.fg.b.toFixed(0)} bg=${issue.bg.r.toFixed(0)},${issue.bg.g.toFixed(0)},${issue.bg.b.toFixed(0)}`
    );
  });
  console.groupEnd();
};
