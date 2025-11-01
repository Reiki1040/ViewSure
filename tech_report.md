# ViewSure 技術レポート

## 1. 概要
ViewSure は、プレゼン資料を投影する前に明るさ・コントラスト・WCAG 適合状況を確認し、必要な補正を施したうえで PDF 出力まで行える Web アプリケーションです。React + TypeScript + Vite をベースに、WebGL による高速なプレビュー描画、WebAssembly を用いたトーンマッピング、PDF/PPTX/画像など複数フォーマットの読み込み、WCAG 解析機能を備えています。

- **メイン技術要素**:
  - React 18 / TypeScript 5 / Vite 5
  - WebGL (GLSL シェーダ + Canvas)
  - WebAssembly (`src/wasm/tone_mapping.wasm`)
  - `pdfjs-dist`, `pptx-preview`, `heic2any`, `jspdf`
  - Google Identity Services による任意のサインイン

## 2. アーキテクチャ概観
```
App (React Root)
└─ ProjectionStudioApp (メイン画面)
   ├─ TopMenuBar / FileUploader / ProjectionControls (操作系)
   ├─ ProjectionViewport (WebGL) / WcagPreviewPanel (解析ビュー)
   ├─ WcagSummary (解析サマリ)
   ├─ useProjectionRenderer (WebGL レンダリング)
   └─ useWcagHelper (WCAG 解析)
```

### 2.1 シーケンス概要
@startuml
actor ユーザー
participant "App\n(React ルート)" as App
participant "ProjectionStudioApp" as Studio
participant "FileUploader" as Uploader
participant "fileLoader.ts" as Loader
participant "useProjectionRenderer" as Renderer
participant "useWcagHelper" as Helper
participant "TopMenuBar" as Menu
participant "ProjectionViewport" as Viewport
participant "WcagPreviewPanel" as Preview

== アプリ起動 ==
ユーザー -> App : サイトにアクセス
App -> App : showLanding をチェック
App -> Studio : ProjectionStudioApp を描画
Studio -> Helper : WCAG 解析の初期化
Helper -> Studio : 初期ステータスを返す

== 資料の読み込み ==
ユーザー -> Menu : 資料を開く
Menu -> Uploader : openFileDialog()
ユーザー -> Uploader : ファイルを選択
Uploader -> Loader : loadProjectionAsset(file)
Loader --> Uploader : ProjectionAsset
Uploader -> Studio : onFileSelected(asset)
Studio -> Renderer : resetAspectRatio()
Studio -> Renderer : loadImage(asset.getFrame(0))
Renderer --> Studio : 読み込み完了 (isReady=true)
Studio -> Helper : analyzeProjectionAsset(asset)
Helper --> Studio : DocumentAnalysis + TextModel

== プレビュー操作 ==
ユーザー -> Controls : 明るさ・コントラスト変更
Controls -> Studio : setBrightness / setContrast
Studio -> Renderer : updateAdjustments()
Renderer --> Viewport : WebGL 再描画

== ページ移動 ==
ユーザー -> Controls : スライダー/入力でページ指定
Controls -> Studio : handlePageChange(page)
Studio -> Renderer : asset.getFrame(page)
Renderer --> Viewport : 新しいフレームを表示
Studio -> Helper : getTextOverlayPayload(page)
Helper --> Preview : WCAG オーバーレイを更新

== PDF 保存 ==
ユーザー -> Menu : PDF保存
Menu -> Studio : handleDownloadCurrentView()
Studio -> Renderer : captureFrame() をページ数分呼び出し
Studio -> "jspdf" : PDF を生成・保存

@enduml

## 3. コンポーネント構造
### 3.1 クラス図
@startuml
skinparam classAttributeIconSize 0
skinparam packageStyle rect

package "UI コンポーネント" {
  class App {
    +showLanding: boolean
    +setShowLanding(...)
  }

  class ProjectionStudioApp {
    +currentFrame: number
    +handlePageChange(page)
    +handleToggleProjector(enabled)
  }

  class LandingScreen {
    +onStart(): void
  }

  class TopMenuBar {
    +onOpenFile()
    +onDownload()
    +onGoPrev()
    +onGoNext()
  }

  class FileUploader {
    +onFileSelected(file)
    +openFileDialog()
  }

  class ProjectionControls {
    +onBrightnessChange(value)
    +onContrastChange(value)
    +onToggleProjector(enabled)
  }

  class ProjectionViewport {
    +canvasRef: Ref<HTMLCanvasElement>
    +onGoPrev()
    +onGoNext()
  }

  class WcagPreviewPanel {
    +overlay?: TextOverlayPayload
  }

  class WcagSummary {
    +analysis?: DocumentAnalysis
  }
}

package "フック / 状態管理" {
  class useProjectionRenderer {
    +canvasRef: Ref<HTMLCanvasElement>
    +loadImage(source)
    +captureFrame(): CaptureFrameResult
    +updateProjectorPreview(params)
  }

  class useWcagHelper {
    +analysis?: DocumentAnalysis
    +applyAdjustments()
    +clearAdjustments()
    +getTextOverlayPayload(index)
  }

  class AuthContext {
    +user?: GoogleUserProfile
    +signInWithGoogle()
    +signOut()
  }
}

package "アセット" {
  interface ProjectionAsset {
    +pageCount: number
    +getFrame(index): TexImageSource
    +hasFrame?(index): boolean
    +dispose?()
  }

  class PdfAsset
  class PptxAsset
  class ImageAsset
}

package "ユーティリティ" {
  class fileLoader
  class pdf
  class ppt
  class toneMappingWasm
  class analyzer
}

package "WCAG モデル" {
  class DocumentAnalysis {
    +pageCount: number
    +slides: SlideMetrics[]
    +issues: WcagIssue[]
  }

  class TextRenderingModel {
    +slides: TextSlide[]
  }
}

App --> ProjectionStudioApp : 描画
App --> LandingScreen
ProjectionStudioApp --> TopMenuBar
ProjectionStudioApp --> FileUploader
ProjectionStudioApp --> ProjectionControls
ProjectionStudioApp --> ProjectionViewport
ProjectionStudioApp --> WcagPreviewPanel
ProjectionStudioApp --> WcagSummary

ProjectionStudioApp ..> useProjectionRenderer : 利用
ProjectionStudioApp ..> useWcagHelper : 利用
App ..> AuthContext : 利用

FileUploader ..> fileLoader : loadProjectionAsset()
useProjectionRenderer ..> toneMappingWasm
useProjectionRenderer ..> ProjectionAsset
useWcagHelper ..> analyzer
useWcagHelper ..> DocumentAnalysis
useWcagHelper ..> TextRenderingModel

ProjectionAsset <|.. PdfAsset
ProjectionAsset <|.. PptxAsset
ProjectionAsset <|.. ImageAsset

pdf ..> PdfAsset : createPdfRenderer()
ppt ..> PptxAsset : renderPptxSlideToCanvas()

@enduml

### 3.2 オブジェクト図
@startuml
skinparam packageStyle rect
skinparam object {
  BackgroundColor Snow
  BorderColor DimGray
}

object "App\n(React ルート)" as AppObj {
  state showLanding : boolean
}
object "ProjectionStudioApp\n(メイン画面)" as StudioObj {
  state currentFrame : number
  state statusMessage : string
  state projectorEnabled : boolean
}
object "LandingScreen" as LandingObj

AppObj *-- StudioObj : 描画
AppObj *-- LandingObj : 描画

object "TopMenuBar" as MenuObj
object "FileUploader" as UploaderObj {
  state statusMessage : string
}
object "ProjectionControls" as ControlsObj {
  state brightness : number
  state contrast : number
}
object "ProjectionViewport" as ViewportObj {
  state canvasRef : HTMLCanvasElement
}
object "WcagPreviewPanel" as PreviewObj
object "WcagSummary" as SummaryObj

StudioObj *-- MenuObj
StudioObj *-- UploaderObj
StudioObj *-- ControlsObj
StudioObj *-- ViewportObj
StudioObj *-- PreviewObj
StudioObj *-- SummaryObj

object "useProjectionRenderer" as RendererObj {
  state canvasRef : ref<HTMLCanvasElement>
  state isReady : boolean
  state imageAspectRatio : number
}
object "useWcagHelper" as HelperObj {
  state analysis : DocumentAnalysis
  state fontAdjustments : FontAdjustments
}
object "AuthContext" as AuthObj {
  state user : GoogleUserProfile
  state status : AuthStatus
}

StudioObj o-- RendererObj : 利用
StudioObj o-- HelperObj : 利用
AppObj o-- AuthObj : 利用

object "ProjectionAsset" as AssetObj {
  state pageCount : number
  getFrame(index)
}
object "PdfAsset" as PdfAssetObj
object "PptxAsset" as PptxAssetObj
object "ImageAsset" as ImageAssetObj

RendererObj o-- AssetObj : フレーム取得
AssetObj <|- PdfAssetObj
AssetObj <|- PptxAssetObj
AssetObj <|- ImageAssetObj

HelperObj *-- "DocumentAnalysis" : 解析結果
HelperObj *-- "TextRenderingModel" : テキスト描画モデル
PreviewObj ..> "TextRenderingModel" : オーバーレイ表示
SummaryObj ..> "DocumentAnalysis" : サマリ表示

@enduml

## 4. モジュール詳細
### 4.1 useProjectionRenderer (WebGL レンダリング)
- `canvasRef`: WebGL 用キャンバス
- WebGL コンテキスト初期化、シェーダのコンパイル・リンク
- 画像をテクスチャに転送 (`loadImage`)
- 明るさ/コントラストを uniform に設定 (`updateAdjustments`)
- プロジェクタープレビュー用のパラメータを反映 (`updateProjectorPreview`)
- 現在のフレームを PNG として取得 (`captureFrame`)

### 4.2 useWcagHelper (WCAG 解析)
- `analyzeProjectionAsset` で PDF/PPTX/画像を Canvas に描画し、テキスト抽出と輝度評価を実行
- 解析結果 (`DocumentAnalysis`) とテキスト描画モデル (`TextRenderingModel`) を生成
- 自動調整（明るさ・コントラスト・フォント倍率）を適用/解除
- WCAG プレビュー用のオーバーレイデータを提供

### 4.3 fileLoader.ts
- 入力ファイルの MIME タイプや拡張子からフォーマット判定
- PDF: `createPdfRenderer()` (pdf.js) を用いてページ Canvas とテキスト抽出
- PPTX: `pptx-preview` を CDN から読み込み、SVG を Canvas に変換
- HEIC: `heic2any` で PNG に変換
- 共通の `ProjectionAsset` インターフェイスを返却

### 4.4 PDF/PPTX 補助
- `pdf.ts`: pdf.js のロード、Canvas レンダリング、テキスト抽出、キャッシュ管理
- `ppt.ts`: `pptx-preview` のロード、SVG→Canvas 変換

### 4.5 toneMappingWasm.ts
- `tone_mapping.wasm` をフェッチして `brightnessOffset` / `contrastFactor` を提供
- ブラウザが `instantiateStreaming` に対応しない場合はフォールバック

## 5. 主要な UI 挙動
- **ページ移動**: スライダー、数値入力、Prev/Next ボタン、←→キー
- **投影シミュレーション**: 投影機を想定したガンマ/黒レベル/ビネット補正を ON/OFF
- **WCAG 解析**: 明るさやコントラスト違反、フォントサイズ不足を検出し、改善提案をステータスに表示
- **PDF 書き出し**: 各ページを WebGL Canvas に描画 → PNG 変換 → `jspdf` で PDF 化

## 6. 制約・注意点
- WebGL 非対応ブラウザでは動作不可
- PPTX は CDN 依存 (オフライン不可)
- HEIC 変換はクライアント負荷が高い可能性
- PDF のテキストがアウトライン化されていると WCAG 解析が限定的

## 7. 拡張案
- 複数プロジェクタープリセット (スクリーン種別/環境光別)
- 解析レポートのエクスポート (PDF/JSON)
- HEIC 変換や PDF レンダリングの Web Worker 化
- オフライン対応の PPTX レンダラ同梱
- ショートカットやアクセシビリティ操作の拡充

---
本レポートはチーム内の技術共有を目的としており、実装の詳細や依存関係、挙動を網羅的にまとめています。ご不明点があればコメントなどで共有してください。
