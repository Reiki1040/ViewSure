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

// ----------------------------------------------------------------------
// K-means Clustering Logic for Robust Color Extraction
// ----------------------------------------------------------------------

type Sample = { r: number; g: number; b: number; lum: number };

/**
 * 指定領域からピクセルデータをサンプリングする
 */
const collectSamples = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  stride: number = 2
): Sample[] => {
  const sx = Math.floor(clamp(x, 0, ctx.canvas.width - 1));
  const sy = Math.floor(clamp(y, 0, ctx.canvas.height - 1));
  const sw = Math.max(1, Math.floor(clamp(width, 1, ctx.canvas.width - sx)));
  const sh = Math.max(1, Math.floor(clamp(height, 1, ctx.canvas.height - sy)));

  // 範囲が極端に小さい、または画面外の場合は空を返す
  if (sw <= 0 || sh <= 0) return [];

  const imageData = ctx.getImageData(sx, sy, sw, sh);
  const data = imageData.data;
  const samples: Sample[] = [];

  // 全ピクセルを見るのは重いので、strideごとにスキップしてサンプリング
  for (let row = 0; row < sh; row += stride) {
    for (let col = 0; col < sw; col += stride) {
      const idx = (row * sw + col) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      // アルファ値が低い（透明に近い）ピクセルは無視する
      if (data[idx + 3] < 128) continue;
      
      samples.push({ r, g, b, lum: computeLuminance({ r, g, b }) });
    }
  }
  return samples;
};

/**
 * K-means法を用いて色サンプルを2つのクラスタ（背景色・前景色候補）に分離し、
 * 最も支配的な「明るい色」と「暗い色」を抽出する。
 */
const extractDominantColors = (samples: Sample[]): { light: Rgb; dark: Rgb } => {
  if (samples.length === 0) {
    return { light: { r: 255, g: 255, b: 255 }, dark: { r: 0, g: 0, b: 0 } };
  }

  // 初期化: 最も明るい点と最も暗い点を初期セントロイドにする
  let minLum = 1.0;
  let maxLum = 0.0;
  let darkCentroid = samples[0];
  let lightCentroid = samples[0];

  for (const s of samples) {
    if (s.lum < minLum) {
      minLum = s.lum;
      darkCentroid = s;
    }
    if (s.lum > maxLum) {
      maxLum = s.lum;
      lightCentroid = s;
    }
  }

  // もし明るさの差がほとんどなければ、単色とみなす
  if (maxLum - minLum < 0.05) {
    return { light: lightCentroid, dark: darkCentroid };
  }

  // K-means (k=2) を数回イテレーション
  const iterations = 3;
  let clusterDark: Sample[] = [];
  let clusterLight: Sample[] = [];

  for (let i = 0; i < iterations; i++) {
    clusterDark = [];
    clusterLight = [];

    // 各サンプルを近い方のセントロイドに割り当て
    for (const s of samples) {
      const distDark = Math.abs(s.lum - darkCentroid.lum); // 簡易的に輝度差で距離判定
      const distLight = Math.abs(s.lum - lightCentroid.lum);
      
      if (distDark < distLight) {
        clusterDark.push(s);
      } else {
        clusterLight.push(s);
      }
    }

    // セントロイドの再計算
    if (clusterDark.length > 0) {
      let r = 0, g = 0, b = 0, lum = 0;
      for (const s of clusterDark) { r += s.r; g += s.g; b += s.b; lum += s.lum; }
      const count = clusterDark.length;
      darkCentroid = { r: r/count, g: g/count, b: b/count, lum: lum/count };
    }
    
    if (clusterLight.length > 0) {
      let r = 0, g = 0, b = 0, lum = 0;
      for (const s of clusterLight) { r += s.r; g += s.g; b += s.b; lum += s.lum; }
      const count = clusterLight.length;
      lightCentroid = { r: r/count, g: g/count, b: b/count, lum: lum/count };
    }
  }

  // 【改善点】セントロイド（平均）をそのまま使うと、アンチエイリアスのグレーに引っ張られて
  // 文字色が薄く判定されてしまうため、クラスタ内の「最も濃い/明るい」色成分を抽出する。

  // 暗いクラスタから、最も暗い上位10%の平均をとる（文字の芯の色）
  let finalDark = darkCentroid;
  if (clusterDark.length > 0) {
    clusterDark.sort((a, b) => a.lum - b.lum); // 暗い順にソート
    const limit = Math.max(1, Math.floor(clusterDark.length * 0.1)); // 上位10%
    let r = 0, g = 0, b = 0, lum = 0;
    for (let i = 0; i < limit; i++) {
      r += clusterDark[i].r;
      g += clusterDark[i].g;
      b += clusterDark[i].b;
      lum += clusterDark[i].lum;
    }
    finalDark = { r: r/limit, g: g/limit, b: b/limit, lum: lum/limit };
  }

  // 明るいクラスタから、最も明るい上位10%の平均をとる（背景の地の色）
  let finalLight = lightCentroid;
  if (clusterLight.length > 0) {
    clusterLight.sort((a, b) => b.lum - a.lum); // 明るい順にソート
    const limit = Math.max(1, Math.floor(clusterLight.length * 0.1)); // 上位10%
    let r = 0, g = 0, b = 0, lum = 0;
    for (let i = 0; i < limit; i++) {
      r += clusterLight[i].r;
      g += clusterLight[i].g;
      b += clusterLight[i].b;
      lum += clusterLight[i].lum;
    }
    finalLight = { r: r/limit, g: g/limit, b: b/limit, lum: lum/limit };
  }

  // 結果として得られた2つの代表色を返す（RGBオブジェクトのみに整形）
  return {
    light: { r: finalLight.r, g: finalLight.g, b: finalLight.b },
    dark: { r: finalDark.r, g: finalDark.g, b: finalDark.b }
  };
};


// ----------------------------------------------------------------------
// Main Analysis Logic
// ----------------------------------------------------------------------

const isLargeText = (run: PdfPageTextRun) => run.originalFontSize >= 18;

/**
 * ページ内のテキスト要素のコントラストを解析する
 * 
 * 改善版アルゴリズム:
 * テキスト領域と、その周囲（マージン付き）領域からピクセルをサンプリングし、
 * K-means法で「支配的な明るい色」と「支配的な暗い色」を抽出する。
 * それらの組み合わせでコントラスト比を計算し、最も妥当な（高い）コントラストを採用する。
 * これにより、アンチエイリアスや隣接文字ノイズによる誤検知を防ぐ。
 */
export const analyzePageContrast = (ctx: CanvasRenderingContext2D, textContent: PdfPageTextContent): ContrastIssue[] => {
  const issues: ContrastIssue[] = [];
  const canvasWidth = ctx.canvas.width;
  const canvasHeight = ctx.canvas.height;

  textContent.runs.forEach((run) => {
    // 画面外や極端に小さい要素はスキップ
    if (run.width <= 0 || run.height <= 0 || run.x >= canvasWidth || run.y >= canvasHeight) {
      return;
    }

    // 1. テキスト領域そのものから色を採取（文字色成分が多いはず）
    // 文字の線は細いので、strideは小さく(1)して詳細に拾う
    const textSamples = collectSamples(ctx, run.x, run.y, run.width, run.height, 1);
    
    // 2. 背景領域（少し広め）から色を採取（背景色成分が多いはず）
    // 周囲にノイズ（他の文字）があることを前提に、少し広めに取る
    const margin = 2; 
    const bgSamples = collectSamples(
      ctx,
      run.x - margin,
      run.y - margin,
      run.width + margin * 2,
      run.height + margin * 2,
      2 // 背景は広めなので少し荒くても良い
    );

    // サンプルが少なすぎる（完全に白い紙に小さい点など）場合はスキップ
    if (textSamples.length < 5 && bgSamples.length < 5) return;

    // 3. 全サンプルを混ぜて、クラスタリングにかける
    // これにより「領域内に存在する主要な2色」を抽出する
    // （文字領域だけだとアンチエイリアスのグレーしか拾えないことがあるため、背景の白と混ぜることでコントラストを明確にする）
    const allSamples = [...textSamples, ...bgSamples];
    const { light, dark } = extractDominantColors(allSamples);

    // 4. コントラスト比の計算
    // 人間の目は「文字の最も濃い部分」と「背景の最も明るい部分」で認識するため、
    // クラスタリングで分離された2色のコントラスト比を、その箇所のコントラストとして採用する。
    const ratio = contrastRatio(dark, light);
    
    // 基準判定
    const large = isLargeText(run);
    const required = large ? 3 : 4.5;
    
    // コントラスト比が基準未満の場合のみ記録
    if (ratio < required) {
      issues.push({
        text: run.text.slice(0, 30),
        ratio: Number(ratio.toFixed(2)),
        required,
        isLargeText: large,
        fg: dark,   // 報告用に暗い方を前景色とする（白文字黒背景の場合逆になるが、数値上の問題はない）
        bg: light,  // 報告用に明るい方を背景色とする
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