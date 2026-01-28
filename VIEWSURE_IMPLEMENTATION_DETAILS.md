# ViewSure：実装詳細とコア・ロジック解説

ViewSureの主要な機能（アクセシビリティ解析、プロジェクター・シミュレーション）を実現している具体的なコードとその仕組みを解説します。

---

## 1. コントラスト解析ロジック (`src/utils/wcag.ts`)

ViewSureは、PDF内の各テキストがWCAG 2.1基準を満たしているかを判定するために、ピクセルレベルの輝度計算を行っています。

### 相対輝度の計算
人間が色をどう感じるかを数学的に表現した「相対輝度（Relative Luminance）」を以下のコードで計算しています。

```typescript
// WCAG 2.0 定義に基づく相対輝度の計算
const relativeLuminance = (c: number) => {
  const srgb = c / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
};

const computeLuminance = ({ r, g, b }: Rgb) =>
  0.2126 * relativeLuminance(r) + 0.7152 * relativeLuminance(g) + 0.0722 * relativeLuminance(b);
```
- **0.2126, 0.7152, 0.0722**: 人の目が「緑」に最も敏感で「青」に鈍感であることを示す係数です。

### コントラスト比の判定
算出した輝度を用いて、コントラスト比 `(L1 + 0.05) / (L2 + 0.05)` を求めます。

```typescript
const contrastRatio = (fg: Rgb, bg: Rgb) => {
  const L1 = computeLuminance(fg);
  const L2 = computeLuminance(bg);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
};
```
- **判定基準**: 通常のテキストは **4.5 : 1**、18pt以上の大きなテキストは **3.0 : 1** 以上あれば合格（AAレベル）とみなされます。

---

## 2. 配色バランス解析 (`src/utils/wcag.ts`)

デザインの「黄金比（70:25:5）」を判定するため、キャンバス全体をスキャンして色の出現率を計算します。

```typescript
// ピクセル走査による色の集計
for (let i = 0; i < imageData.length; i += stride) {
  const r = imageData[i];
  const g = imageData[i + 1];
  const b = imageData[i + 2];
  const hex = rgbToHex(r, g, b); // 色を量子化してグループ化
  colorCounts[hex] = (colorCounts[hex] || 0) + 1;
  totalSamples++;
}
```
- **量子化 (`rgbToHex`)**: 似たような色（例：わずかに違う白）を一つの色としてまとめることで、ノイズを除去し、正確な色の分布を把握します。

---

## 3. プロジェクター・シミュレーション (`src/utils/toneMapping.ts`)

実際のプロジェクター投影時に発生する「色の劣化」を再現します。計算負荷が高いため、WebAssembly (WASM) を活用しています。

### 黒浮きとコントラスト低下の再現
プロジェクター特有の「黒色がグレーに見える現象」などを以下のカーブで計算しています。

```typescript
const applyProjectorCurve = (data: Uint8ClampedArray) => {
  const brightness = -16; // 輝度を下げる
  const contrast = 0.9;   // コントラストを弱める
  const haze = 0.20;       // 白ベール（霧がかった見た目）

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    // ... (RGB計算)
    // 白かぶり（haze）の適用
    r = r * (1 - haze) + 255 * haze;
    data[i] = clamp255(r);
  }
};
```
- **haze (0.20)**: 画面全体に20%の白いベールをかけることで、会場が明るい場合の視認性低下をシミュレートしています。

### WebAssembly (WASM) との連携
大量のピクセルデータを高速に処理するため、JavaScriptからWASMのメモリへ直接アクセスしています。

```typescript
// WASMメモリへのデータ転送
const wasmMemory = new Uint8Array(wasmInstance.exports.memory.buffer, wasmPtr, byteLength);
wasmMemory.set(data);

// WASM側での高速変換実行
wasmInstance.exports.transform(wasmPtr, width, height);
```

---

## 4. PDF描画とUI同期 (`App.tsx`)

PDFのデータを画面（キャンバス）に描き出すメインのパイプラインです。

```typescript
const renderPage = useCallback(async (pageNumber: number) => {
  const rendererInstance = getRenderer();
  // ...
  // 1. PDFページをキャンバスにレンダリング
  const pageCanvas = await rendererInstance.getPageCanvas(pageNumber - 1);
  const context = canvas.getContext('2d');
  
  // 2. プロジェクタープレビューが有効ならWASM処理を適用
  if (isPreviewEnabled) {
    applyToneMapping(context, canvas.width, canvas.height);
  }
  // ...
}, [/* 依存配列 */]);
```
- **非同期処理**: PDFのレンダリングを `await` することで、UIのスムーズな動きを保ちながら重い処理を完了させています。
