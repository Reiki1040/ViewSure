# ViewSure コードベース概要（ファイル別の役割と処理ポイント）

## アプリ全体の流れ
- エントリ `src/main.tsx` → `App.tsx` を描画。初期はランディング画面、開始後にプレビュー画面を表示。
- PDFを `FileUploader` で受け取り、`usePdfRenderer` + `pdf.ts` でページCanvasを生成。
- `App.tsx` の `renderPage` がCanvas描画とプロジェクタープレビュー（トーンマッピング + 疑似低解像度化）を実行し、`ProjectionViewport`で表示。
- 下部のコマンドバーでページ移動／ジャンプ／プロジェクターモード切替（トグル）を提供。

## コアファイル
### `src/App.tsx`
- 役割: 画面切替、PDF読み込み、ページ描画、プロジェクタープレビューON/OFF、ナビゲーション操作を集約。
- 主なstate: `isLandingVisible`, `isPreviewEnabled`, `statusMessage`, `currentPage`, `pageCount`, `aspectRatio` など。
- `renderPage(pageNumber)`: `usePdfRenderer.getRenderer()`で最新レンダラー取得→Canvasに描画→`applyToneMapping`でプロジェクター風に加工（ON時）→ページ番号同期。
- キーボード矢印でページ送り、ファイル選択はImperative handle経由で開く。
- コマンドバー: アップロード、最初/前/次/最後、スライダー、ジャンプ、プロジェクタープレビュートグル（`project_preview.png`アイコン）。

### `src/hooks/usePdfRenderer.ts`
- 役割: PDFレンダラーの生成/保持/破棄と状態管理。
- `loadPdf(file)`: 拡張子チェック→既存レンダラーをdispose→`createPdfRenderer`で新規作成→`pageCount`更新。
- `getRenderer()`: 最新インスタンスを返す（クロージャでのstale回避）。
- `dispose()`: レンダラー破棄と状態リセット。

### `src/utils/pdf.ts`
- 役割: `pdfjs-dist`の動的読み込みとworker設定、ページCanvas生成・テキスト抽出・dispose。
- `createPdfRenderer(data, scale=1.5)`: `getPageCanvas`でページをCanvasに描画（キャッシュ＋pending管理）、`getPageTextContent`でテキスト runs 抽出、`dispose`でリソース開放。
- workerは`pdfjs-dist/legacy/build/pdf.worker.min.js?url`を指定し、初回ロード時に設定。

### `src/utils/toneMapping.ts`
- 役割: プロジェクタープレビュー用のトーンマッピングと解像感低下の模擬。
- `initWasm()`: `public/wasm/tone_mapping.wasm`をfetchしてinstantiate。
- `applyToneMapping(ctx, w, h)`: 
  - Step0: `resolutionFactor=0.7`でダウンスケール→アップスケールし、輪郭を甘くする。
  - WASMがあれば `brightnessOffset(-15)` + `contrastFactor(1.25)` を適用後、JSのプロジェクターカーブを重ねる。
  - WASMなしでもJSカーブ（輝度低下・コントラスト低下・白ベール）を適用。
- パラメータコメントで色変化の意味を明示。

## UIコンポーネント
### `src/components/FileUploader.tsx`
- PDFのみ受け付けるD&D/クリック選択。`FileUploaderHandle`で外部からダイアログを開ける。
- ステータスメッセージ表示、アクセシビリティ対応（キーボード操作、`aria-live`）。

### `src/components/ProjectionViewport.tsx`
- Canvasを表示し、ローディング/未準備時はオーバーレイ。前後ナビボタン付き。
- `aspectRatio`をCSSカスタムプロパティに渡して比率パディングを調整。

### `src/components/LandingScreen.tsx`
- 開始ボタンのみのシンプルなランディング。`onStart`でプレビュー画面へ遷移。

### `src/components/LoadingSpinner.tsx`
- ローディング表示用の汎用スピナー。

## エントリ/設定
### `src/main.tsx`
- React 18のroot作成と`App`マウント、グローバルスタイルの読み込み。

### `vite.config.ts`, `tsconfig*.json`
- Vite/TypeScriptのビルド・型設定。特殊なalias等はなし。

## アセット・スタイル
### `src/styles.css`
- 全体テーマ、ヒーローレイアウト、アップローダー、コマンドバー、ビューポートなどのスタイル。
- 操作バーは大きめパディングと丸み、アイコンボタンに各種PNG（first/prev/next/last/import/project_preview）を使用。
- ビューポートは背景ダーク＋アスペクト比パディング。プロジェクター/プレビュー用の補助スタイルも残存。

## 補足ドキュメント
- `README.md`: 現行機能（PDFプレビュー基盤）の概要とセットアップ。
- `PROJECTION_PREVIEW_IMPLEMENTATION.md`: プロジェクタープレビュー実装メモ（WASM、フォールバック、解像度低下ステップを記載）。
- その他: `PROJECTION_PREVIEW_PLAN.md`, `WCAG_ANALYSIS.md` など将来機能の計画・分析資料。

## 既知の挙動・トグル
- プロジェクターモード: コマンドバー右のプレビューボタンでON/OFF。ON時に解像感低下＋白みトーンを付加。
- ページ移動: 最初/前/次/最後ボタン、スライダー、数値入力、キーボード矢印に対応。

## 今後着手しやすい拡張の例
- プロジェクターモードのパラメータ（輝度/コントラスト/ベール強度）のUIスライダー化。
- プロジェクター環境プリセット保存・切替。
- 読みやすさチェックの精度向上や改善提案UIの追加。
