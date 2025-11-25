# プロジェクター投影プレビュー 実装メモ

## 目的と概要
- PC上でのPDF表示を、プロジェクター投影時の色調・コントラスト変化を模擬して確認できるようにする。
- 元のPDFは変更せず、描画済みキャンバスにトーンマッピングを適用して見た目のみを変える。

## 採用アプローチ
- `pdfjs-dist`で描画したページキャンバスをベースに、**WebAssembly (`public/wasm/tone_mapping.wasm`)** を用いたトーンマッピングを適用する。
- UIはコマンドバーにトグルボタンを置き、`isPreviewEnabled`ステートでON/OFFを管理。切り替え時は表示中ページを再描画。

## 主な処理フロー
1. **PDF描画**: `usePdfRenderer`の`getPageCanvas`でページをCanvasに描画（`App.tsx/renderPage`）。
2. **トーンマッピング初期化**: アプリ起動時に `initWasm()` を一度実行し、`tone_mapping.wasm`をロード・インスタンス化。
3. **プレビューON時の処理**: `renderPage`内で`isPreviewEnabled`が`true`なら`applyToneMapping(ctx, width, height)`を呼び、描画済みCanvasの`ImageData`に対してWASMで色調変換を実行。
4. **プレビューOFF時**: 従来どおり`drawImage`のみで表示。
5. **再描画トリガー**: `isPreviewEnabled`が変わるたびに`renderPage(currentPage)`を呼び直し、表示を即時更新。

## WASM呼び出し仕様（現状）
- `src/utils/toneMapping.ts`で`fetch`→`WebAssembly.instantiate`し、`allocate/deallocate/transform/brightnessOffset/contrastFactor`を利用。
- 現設定: `brightnessOffset(-15)`, `contrastFactor(1.25)` を適用（後でUI連動に拡張余地あり）。
- 失敗時はワーニングを出し、JSによる簡易トーンカーブ（暗め＋コントラスト減＋白ベールのみ）でフォールバック。
- プレビュー適用前に解像度低下を模擬（78%にダウンスケール→アップスケール）して、文字や線をわずかにソフトにしてからトーンマッピングを適用。

## UI/状態
- コマンドバー右側の✨ボタンでトグル。`studio-command-bar__button--active`スタイルで有効状態を視覚化。
- ステート: `isPreviewEnabled`（ON/OFF）、`aspectRatio`, `currentPage`など既存の表示管理と連動。

## 想定する今後の拡張ポイント
- 明るさ/コントラスト/色温度などをスライダーで調整し、WASMのパラメータに連動。
- プロジェクター環境ごとのプリセット保存・切替。
- フィルタ処理のON/OFFだけでなく、プレビュー別キャンバスで比較表示（Before/After）。
- WASM未ロード時のUI通知やリトライ導線の追加。
