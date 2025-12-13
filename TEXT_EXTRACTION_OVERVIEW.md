# ViewSure テキスト抽出の仕組み

本ドキュメントは、アップロードされた PDF からテキストを取得する現在の実装をまとめたものです。実装コードは `src/utils/pdf.ts` にあり、以下の流れで動作します。

## モジュール読み込みと準備
- pdf.js（`pdfjs-dist/legacy/build/pdf.js`）を動的 import し、初回だけ worker を `GlobalWorkerOptions.workerSrc` に設定。
- エントリで `createPdfRenderer(data, scale)` を呼び出すと、このモジュールを経由して PDF を開く。

## テキスト抽出の主処理
ファイル: `src/utils/pdf.ts` の `getPageTextContent` 関数。

1. ページ番号検証  
   - 0-based インデックスを受け取り、`ensurePageNumber` で 1-based に直しつつ範囲外をチェック。
2. ページとビューポート取得  
   - `pdf.getPage(pageNumber)` → `page.getViewport({ scale })` でスケール適用後の座標系を確定。
3. テキストアイテム取得  
   - `page.getTextContent()` を呼び、pdf.js が提供する生のテキストアイテムを取得（座標は左下原点）。
4. 座標とサイズの正規化  
   - `item.transform` からフォントサイズを算出（`Math.hypot(a, b)`）。  
   - X 座標はそのまま、Y はキャンバスの左上原点に合わせるため `viewport.height - y - height` で反転。  
   - 幅・高さが未指定の場合はフォントサイズと文字数から概算。
5. 実行結果  
   - 各アイテムを `{ text, fontSize, x, y, width, height }` として `runs` 配列に格納。  
   - 戻り値は `{ width: viewport.width, height: viewport.height, runs }`。
6. リソース解放  
   - `page.cleanup()` でページリソースを解放。

## 利用箇所の例
- `src/App.tsx` の `renderPage` 内で `rendererInstance.getPageTextContent` を呼び、WCAG コントラスト検査や自動修正処理に渡している。
- 画像抽出補助（`src/utils/imageExtractor.ts` の `getTextBoxes`）でも `getTextContent` を呼び、文字領域を重なり除外に使う。

## 注意点・制限
- pdf.js が返すテキストアイテムはレイアウト情報が限定的で、段組や複雑な構造は推定が難しい。  
- 座標は抽出時のスケールに依存するため、描画スケールと揃えて扱う必要がある。  
- 回転や複雑な CTM が含まれる場合、フォントサイズ推定がずれることがある。
