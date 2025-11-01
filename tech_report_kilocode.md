# ViewSure Projection Preview - 技術レポート (KiloCode分析)

## 1. 概要

ViewSureは、プレゼンテーション資料を投影する前に明るさ・コントラスト・WCAG適合状況を事前にチェックし、必要な補正を施したうえでPDF出力まで行えるWebアプリケーションです。React + TypeScript + Viteをベースに、WebGLによる高速なプレビュー描画、WebAssemblyを用いたトーンマッピング、PDF/PPTX/画像など複数フォーマットの読み込み、WCAG解析機能を備えています。

### 1.1 メイン技術要素
- **フロントエンド**: React 18 / TypeScript 5 / Vite 5
- **レンダリング**: WebGL (GLSLシェーダー + Canvas)
- **トーンマッピング**: WebAssembly (`src/wasm/tone_mapping.wasm`)
- **ライブラリ**: `pdfjs-dist`, `pptx-preview`, `heic2any`, `jspdf`
- **認証**: Google Identity Services (任意)

### 1.2 対応フォーマット
| 種別 | 利用ライブラリ / 実装 | 備考 |
|------|------------------------|------|
| PDF | `pdfjs-dist/legacy` | Web Workerを`?url`でバンドル。テキスト抽出にも利用。 |
| PPTX | `pptx-preview` (jsDelivr CDN) | SVGをCanvasへ描画してWebGLテクスチャとして利用。ネットワーク接続必須。 |
| 画像 (PNG/JPEG/WEBP) | ブラウザ標準API | そのまま`TexImageSource`としてロード。 |
| HEIC/HEIF | `heic2any` | PNGに変換後に描画。変換はクライアント側で実行されるため大容量ファイルでは時間がかかります。 |

## 2. アーキテクチャ概観

### 2.1 全体構造
```
App (React Root)
└─ ProjectionStudioApp (メイン画面)
   ├─ TopMenuBar / FileUploader / ProjectionControls (操作系)
   ├─ ProjectionViewport (WebGL) / WcagPreviewPanel (解析ビュー)
   ├─ WcagSummary (解析サマリ)
   ├─ useProjectionRenderer (WebGLレンダリング)
   └─ useWcagHelper (WCAG解析)
```

### 2.2 主要コンポーネント一覧

#### UIコンポーネント
- **App.tsx**: 画面全体の状態管理とレイアウト。`showLanding`状態でランディング画面とメイン画面を切り替え。
- **ProjectionStudioApp**: メイン画面のロジック。現在のフレーム管理、ページ変更、プロジェクタープレビュー切り替え。
- **LandingScreen**: 初期ランディング画面。スタートボタンでメイン画面へ遷移。
- **TopMenuBar**: 上部メニューバー。ファイルオープン、PDF保存、プロジェクト管理。
- **FileUploader**: ファイルアップロードUI。ドラッグ&ドロップとファイルダイアログ対応。
- **ProjectionControls**: 明るさ・コントラスト調整スライダー、WCAG解析ボタン。
- **ProjectionViewport**: WebGLキャンバス表示。ページ移動ボタン付き。
- **WcagPreviewPanel**: WCAG解析結果のオーバーレイ表示。
- **WcagSummary**: 解析結果のサマリ表示とフォント調整情報。
- **LoadingSpinner**: 読み込み中表示。
- **ProjectDashboard**: プロジェクト管理ダッシュボード (Google認証対応)。

#### フック
- **useProjectionRenderer**: WebGLレンダリング管理。画像ロード、調整適用、キャプチャ。
- **useWcagHelper**: WCAG解析管理。解析実行、調整適用、テキストオーバーレイ提供。
- **useStableRef**: 参照の安定化ユーティリティ。
- **AuthContext**: Googleサインイン管理。

#### ユーティリティ
- **fileLoader.ts**: ファイルフォーマット判定と`ProjectionAsset`生成。
- **pdf.ts**: PDFレンダリングとテキスト抽出。
- **ppt.ts**: PPTX SVG→Canvas変換。
- **toneMappingWasm.ts**: WebAssemblyモジュールローダー。
- **webgl.ts**: WebGLシェーダー作成とプログラムリンク。
- **analyzer.ts**: WCAG解析ロジック。

### 2.3 データフロー

#### ファイル読み込みシーケンス
1. ユーザー → FileUploader → fileLoader.loadProjectionAsset()
2. ProjectionAsset生成 (PdfAsset/PptxAsset/ImageAsset)
3. ProjectionStudioApp → useProjectionRenderer.loadImage()
4. WebGLテクスチャ設定と描画

#### WCAG解析シーケンス
1. ProjectionStudioApp → useWcagHelper.analyzeProjectionAsset()
2. analyzer.analyzeProjectionAsset() → DocumentAnalysis生成
3. 各スライドの輝度計算とテキストノード分類
4. フォントサイズ・コントラスト比チェック
5. WcagIssue生成とTextRenderingModel作成

#### 調整適用シーケンス
1. ユーザー → ProjectionControls → WCAG解析実行
2. useWcagHelper.applyAdjustments()
3. 明るさ/コントラスト自動調整 + フォントスケーリング
4. useProjectionRenderer.updateAdjustments() → WebGL再描画

## 3. 主要機能詳細

### 3.1 WebGLレンダリングシステム

#### useProjectionRendererフック
- **初期化**: WebGLコンテキスト取得、シェーダーコンパイル、バッファ作成
- **画像ロード**: `loadImage()`でTexImageSourceをテクスチャに転送
- **調整適用**: `updateAdjustments()`で明るさ/コントラストをuniformに設定
- **プロジェクタープレビュー**: `updateProjectorPreview()`でガンマ/黒レベル/ビネット/ホットスポット適用
- **キャプチャ**: `captureFrame()`で現在のWebGL描画をPNG Blobとして取得

#### GLSLシェーダー
- **頂点シェーダー**: 位置とUV座標の変換、スケーリング適用
- **フラグメントシェーダー**: テクスチャサンプリング、明るさ/コントラスト調整、プロジェクタ効果適用

### 3.2 WCAG解析システム

#### analyzer.tsの解析ロジック
- **輝度計算**: `calculateAverageLuminance()`でスライド全体の平均輝度を算出
- **テキスト分類**: `classifyTextNodes()`でフォントサイズから見出し/本文を分類
- **コントラストチェック**: テキスト領域と背景領域の輝度差からコントラスト比を計算
- **フォントサイズチェック**: スライド高さに基づく最小フォントサイズ検証

#### 自動調整アルゴリズム
- **輝度調整**: 平均輝度0.45未満→明るく、0.75超→暗く調整
- **コントラスト調整**: コントラスト問題検出時、深刻度に応じて12-20%増加
- **フォントスケーリング**: 見出し1.35倍、本文0.9-0.96倍

### 3.3 ファイル処理システム

#### ProjectionAssetインターフェース
```typescript
interface ProjectionAsset {
  pageCount: number;
  getFrame(index: number): Promise<TexImageSource>;
  getTextContent?(index: number): Promise<SlideTextContent>;
}
```

#### 各フォーマットの実装
- **PdfAsset**: pdf.jsでページCanvas生成、テキスト抽出
- **PptxAsset**: pptx-previewでSVG生成、Canvas変換
- **ImageAsset**: 単一フレームの画像アセット

### 3.4 WebAssembly統合

#### tone_mapping.wasm
- **brightnessOffset()**: 明るさ値(0-200%)を内部係数に変換
- **contrastFactor()**: コントラスト値(-100%~+100%)を乗算係数に変換
- **フォールバック**: WASM未対応時はJavaScript実装

## 4. UI/UX設計

### 4.1 レイアウト構造
- **ヘッダー**: TopMenuBar (ファイル操作、プロジェクト管理)
- **コントロールパネル**: FileUploader + ProjectionControls (左サイド)
- **メイン表示**: ProjectionViewport (中央、上段)
- **WCAGプレビュー**: WcagPreviewPanel (中央、下段)
- **サマリ**: WcagSummary (右サイド)

### 4.2 ページ移動機能
- **スライダー**: ドラッグでページ変更
- **数値入力**: Enterキーまたは「移動」ボタン
- **ボタン**: Prev/Nextボタン
- **キーボード**: ←/→キー
- **マウスホイール**: スクロールでページ変更

### 4.3 調整コントロール
- **明るさ**: 0-200% (デフォルト100%)
- **コントラスト**: -100%~+100% (デフォルト0%)
- **プロジェクタープレビュー**: ON/OFF切り替え
- **リセット**: 初期値に戻すボタン

## 5. 技術的特徴

### 5.1 パフォーマンス最適化
- **WebGLレンダリング**: GPUアクセラレーションによる高速描画
- **RequestAnimationFrame**: 描画更新のスロットリング
- **Canvas再利用**: 解析用Canvasの効率的利用
- **メモリ管理**: ImageBitmapのclose()による解放

### 5.2 クロスブラウザ対応
- **WebGL検出**: `canvas.getContext('webgl')`で対応確認
- **WASMフォールバック**: 非対応時はJavaScript実装
- **HTTPS対応**: Safari向けにlocalhost証明書配置

### 5.3 エラーハンドリング
- **ファイル読み込みエラー**: 適切なエラーメッセージ表示
- **WebGL初期化失敗**: フォールバックUI表示
- **WCAG解析失敗**: 部分的な結果表示

## 6. 制約と制限事項

### 6.1 技術的制約
- **WebGL必須**: 非対応ブラウザでは動作不可
- **オフライン制限**: PPTX読み込みはCDN依存
- **クライアント負荷**: HEIC変換は大容量ファイルで遅延
- **テキスト解析限界**: アウトライン化PDFではWCAG解析不十分

### 6.2 ブラウザ互換性
- **推奨**: Chromium系ブラウザ (Chrome/Edge)
- **対応**: Firefox/Safari (WebGL対応必須)
- **非対応**: 古いブラウザやモバイルブラウザ

## 7. 拡張可能性

### 7.1 機能拡張案
- **複数プロジェクタープリセット**: スクリーン種別/環境光別プロファイル
- **解析レポートエクスポート**: PDF/JSON形式のレポート出力
- **Web Worker化**: HEIC変換/PDFレンダリングのバックグラウンド実行
- **オフライン対応**: PPTXレンダラのバンドル化

### 7.2 技術的改善案
- **キーボードショートカット**: 明るさ変更・解析実行のショートカット
- **アクセシビリティ**: スクリーンリーダー対応、キーボードナビゲーション強化
- **パフォーマンス**: 複数スライドの並列処理、メモリ使用量最適化

## 8. 開発・運用情報

### 8.1 セットアップ
```bash
npm install
npm run dev      # 開発サーバ
npm run build    # 本番ビルド
npm run preview  # ビルド確認
npm run typecheck # 型チェック
```

### 8.2 環境変数
- **VITE_GOOGLE_CLIENT_ID**: Googleサインイン有効化
- **HTTPS**: Safari対応のためlocalhost証明書配置

### 8.3 ビルド構成
- **Vite**: ESModuleバンドル、Tree Shaking
- **TypeScript**: 厳格モード、型チェック
- **CSS**: モジュール化、レスポンシブデザイン

## 9. まとめ

ViewSureは、投影プレゼンテーションの品質を事前に確保するための包括的なWebツールです。WebGLとWebAssemblyを活用した高性能なレンダリングシステム、WCAG準拠のアクセシビリティ解析、複数フォーマットのサポートにより、実用的かつ技術的に先進的なソリューションを提供しています。

主要な強み:
- **リアルタイム調整**: WebGLによる即時フィードバック
- **包括的解析**: 輝度・コントラスト・フォントサイズの自動評価
- **柔軟な出力**: 補正済みPDFのワンクリック生成
- **クロスプラットフォーム**: ブラウザベースのポータブル設計

このアプリケーションは、プレゼンテーションの視認性とアクセシビリティを向上させるための強力なツールとして、技術的にもユーザビリティ的にも優れた実装となっています。