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

const relativeLuminance = (c: number) => {
  const srgb = c / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
};

const computeLuminance = ({ r, g, b }: Rgb) => 0.2126 * relativeLuminance(r) + 0.7152 * relativeLuminance(g) + 0.0722 * relativeLuminance(b);

const contrastRatio = (fg: Rgb, bg: Rgb) => {
  const L1 = computeLuminance(fg);
  const L2 = computeLuminance(bg);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
};

const isLargeText = (run: PdfPageTextRun) => run.fontSize >= 18;

export const analyzePageContrast = (ctx: CanvasRenderingContext2D, textContent: PdfPageTextContent): ContrastIssue[] => {
  const issues: ContrastIssue[] = [];

  textContent.runs.forEach((run) => {
    const fgSampleSize = Math.max(2, Math.min(run.width, run.height) * 0.2);
    const fg = sampleAverageColor(
      ctx,
      run.x + run.width / 2 - fgSampleSize / 2,
      run.y + run.height / 2 - fgSampleSize / 2,
      fgSampleSize,
      fgSampleSize
    );

    const margin = 3;
    const bg = sampleAverageColor(ctx, run.x - margin, run.y - margin, Math.max(4, run.width + margin * 2), Math.max(4, run.height + margin * 2));

    const ratio = contrastRatio(fg, bg);
    const large = isLargeText(run);
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
