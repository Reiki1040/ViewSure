# ViewSure 技術スタック概要（PDF プレビュー + 読みやすさチェック版）

現在の ViewSure は、スタートメニューを経て PDF を読み込み、プレビュー・プロジェクタープレビュー・読みやすさチェックを行う構成です。

## 1. フロントエンド

| 項目 | 技術 | 補足 |
| --- | --- | --- |
| UI / 状態管理 | React 18 + TypeScript 5 | すべて `App.tsx` に集約。 |
| ビルド | Vite 5 | 開発サーバ & 本番ビルド。 |
| スタイリング | `src/styles.css` | 既存のデザインを踏襲。 |

## 2. PDF プレビュー

| 項目 | 技術 | 補足 |
| --- | --- | --- |
| レンダリング | `pdfjs-dist` | `src/utils/pdf.ts` の `createPdfRenderer` でページを Canvas に描画。 |
| ページ移動 | React state | 前後ボタン / スライダー / 入力欄でページを更新。 |
| プロジェクタープレビュー | WASM + JS | `src/utils/toneMapping.ts` で投影トーンを再現。 |
| 読みやすさチェック | 独自解析 | `src/utils/wcag.ts` でコントラスト判定。 |

## 3. 主なコンポーネント

- `LandingScreen`: スタートメニュー。デザインは従来通り。
- `FileUploader`: PDF ドラッグ＆ドロップ / ファイルダイアログ。
- `ProjectionViewport`: Canvas 表示と前後ボタン。
- `LoadingSpinner`: 読み込み中表示。

## 4. 削除した要素

- Firebase 認証、PPTX / 画像 / HEIC など PDF 以外のフォーマット。
- Export / プロジェクト管理 / ゴミ箱などの管理機能。
- WebGL 系フックやサービス、カスタムテンプレートデータ。

## 5. 残タスク / 検討

1. ページキャッシュやズームなどプレビュー体験の向上。
2. 読みやすさチェックの精度向上と改善提案UIの追加。
