# ViewSure 技術スタック概要

ViewSure は「投影前に資料を整える」ことを目的とした Web アプリです。React / TypeScript を基盤に、PDF/PPTX 解析、WebGL プレビュー、WCAG 解析、テンプレート補正といった多層機能を提供しています。本ドキュメントはチーム共有および指導教員確認のため、主要スタックと役割をまとめたものです。

## 1. フロントエンド基盤

| 項目 | 採用技術 | 補足 |
| --- | --- | --- |
| UI フレームワーク | React 18 + TypeScript 5 | 関数コンポーネント & Hooks (`useState`, `useMemo`, `useEffect` など) を徹底。ESM モジュール構成。|
| 開発サーバ / ビルド | Vite 5 | `vite` + `@vitejs/plugin-react` により高速 HMR とビルド。環境変数は `import.meta.env` 経由で利用。|
| スタイリング | カスタム CSS | `src/styles.css` を中心に、機能別 CSS を分割インポート（例: `auto-correction-panel.css`）。BEM 風クラスで再利用性を確保。|
| 型管理 | TypeScript | `npm run typecheck` で `tsc --noEmit` を実行。React/DOM の型定義は `@types/react`, `@types/react-dom`。|

## 2. ドキュメント処理 / レンダリング

| 項目 | 採用技術 | 補足 |
| --- | --- | --- |
| PDF レンダリング | `pdfjs-dist` | `fileLoader.ts` で PDF を読み込み、ページ Canvas とテキスト内容を取得。|
| HEIC 画像変換 | `heic2any` | HEIC/HEIF を PNG へ変換してから WebGL へ供給。|
| 画像出力 | `jspdf` | WebGL で整えた各ページを PNG 化し、PDF にまとめてダウンロード。|
| WebGL プレビュー | カスタム `useProjectionRenderer` Hook | GLSL フラグメントシェーダで明るさ/コントラスト/プロジェクタ補正を GPU 描画。WASM ベースのトーンマッピングも併用。|

## 3. アクセシビリティ / 自動補正機能

| 項目 | 採用技術 | 補足 |
| --- | --- | --- |
| WCAG 解析 | カスタム API + `useWcagHelper`, `useWcag22Helper` | PDF/PPTX テキスト抽出結果に対し、対比/階層/構造ルールをチェック。色覚多様性シミュレーションや自動補正を提供。|
| テンプレート適用 / 自動補正 | `useTemplateManager`, `useAutoCorrection` + JSON ルール | `src/data/templates/*.json` や `src/data/correctionRules/*.json` を読み込み、テンプレート選択や自動修正を実行。|
| テキスト構造解析 | `useTextStructureAnalyzer` と関連ユーティリティ | PDF/PPTX からテキストノードを抽出し、階層・構造を `TextStructureSummary` コンポーネントで可視化。|

## 4. 認証 / 永続化

| 項目 | 採用技術 | 補足 |
| --- | --- | --- |
| 認証 | Firebase Authentication (Google) | `firebase` v12 を利用し、`AuthContext` からサインイン/サインアウト/状態管理を提供。|
| ワークスペース永続化 | `localStorage` | `viewsure.workspace.<userId>` キーでフォルダ/ゴミ箱/最後に開いたフォルダを保存。ゲストセッションにも対応。|

## 5. UI 体験

- **プロジェクトダッシュボード**: フォルダ管理、ゴミ箱、最近更新などを一括表示。WebGL プレビュー画面へ遷移する前段階。
- **フォルダ選択 UI**: スクロール可能なリスト + インライン子プロジェクト展開。クリック一回目で選択、二回目の「開く」で資料読み込み。
- **コンパクトな色設計**: ライトグレー背景、白カード、ハイコントラストの黒文字を基本とし、重要操作は赤（削除）/青（選択）で強調。

## 6. ビルド/実行方法

```bash
npm install      # 依存関係セットアップ
npm run dev      # Vite 開発サーバ (http://localhost:5173)
npm run build    # 本番ビルド（dist/）
npm run preview # ビルド確認
npm run typecheck # 型チェック
```

## 7. 依存関係一覧（抜粋）

- 本番依存: `react`, `react-dom`, `firebase`, `pdfjs-dist`, `jspdf`, `heic2any`
- 開発依存: `vite`, `@vitejs/plugin-react`, `typescript`, `@types/react`, `@types/react-dom`

## 8. 今後の確認ポイント

1. **ブラウザ互換性**: WebGL / WASM を利用するため、対応ブラウザの最小要件を明示する。
2. **アクセシビリティテスト**: WCAG 解析機能が単なる表示に留まらず、実データに基づく検証になっているか確認する。
3. **Auth とローカル保存**: Firebase 設定や `.env` の共有フローを整備し、チーム内で同じ設定を使えるよう共有する。

---
本資料は `TECH_STACK_OVERVIEW.md` としてリポジトリに含まれています。更新や追記があればこのファイルを直接編集してください。
