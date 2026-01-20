# プロジェクター投影プレビュー / 読みやすさチェック 実装サマリー（現行）

## 概要

ViewSure は PDF を読み込み、プロジェクター投影時の見え方を模擬しつつ、読みやすさ（WCAG基準の一部）を簡易チェックできるアプリです。現行実装の要点をまとめます。

## 実装内容

### 1. PDF プレビュー
- `src/utils/pdf.ts`: pdf.js のロード、ページレンダリング、テキスト抽出、キャッシュ管理
- `src/hooks/usePdfRenderer.ts`: レンダラーの生成・保持・破棄、読み込み状態管理
- `src/components/ProjectionViewport.tsx`: Canvas 表示と前後ナビゲーション

### 2. プロジェクタープレビュー
- `src/utils/toneMapping.ts`: WASM + JS フォールバックでトーンマッピングを適用
- `App.tsx` のトグル操作で ON / OFF 切り替え

### 3. 読みやすさチェック
- `src/utils/wcag.ts`: コントラスト比を算出し、WCAG 2.1 AA 基準で判定
- `App.tsx` で全ページを走査し、結果をオーバーレイ表示

### 4. UI / フロー
- `src/components/FileUploader.tsx`: PDF のドラッグ＆ドロップ / 選択
- `src/components/LandingScreen.tsx`: スタート画面
- `src/styles.css`: ランディング + プレビューの統合スタイル

## 補足

- プロジェクタープレビューは WASM が使えない場合でも JS フォールバックで動作します。
- 読みやすさチェックは簡易ロジックであり、詳細なアクセシビリティ監査ではありません。
