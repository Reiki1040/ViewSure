# ViewSure 設計書 (Project Design Document)

## 1. アーキテクチャ概要

ViewSure は **React** をベースとしたシングルページアプリケーション (SPA) です。
最大の特徴は、サーバーサイド処理を一切行わず、**WebAssembly (WASM)** と **Web Worker** を活用して高度なPDF解析と画像処理をブラウザ内で完結させている点です。

### 全体構成図 (概念)
```mermaid
graph TD
    User[User] -->|Drag & Drop| UI[App Component]
    UI -->|Load Request| PDF[PDF Utils]
    PDF -->|Decode| Worker[PDF.js Worker]
    Worker -->|Canvas Data| PDF
    PDF -->|Cache| Memory[Memory Cache]
    UI -->|Render| View[Projection Viewport]
    
    subgraph "Image Processing"
        View -->|Context| TM[Tone Mapping Utils]
        TM -->|Use| WASM[WASM Module (C/C++)]
        WASM -.->|Fallback| JS[JS Implementation]
    end
    
    subgraph "Audit System"
        UI -->|Audit Request| WCAG[WCAG Utils]
        WCAG -->|Get Text/Image| PDF
        WCAG -->|Clustering| KMEANS[K-means Logic]
        WCAG -->|Report| UI
    end
```

## 2. ディレクトリ構成詳細

| パス | 役割 | 詳細 |
| :--- | :--- | :--- |
| `src/App.tsx` | コントローラー | アプリのライフサイクル、状態管理、イベントハンドリングを集約。 |
| `src/components/` | ビュー | プレゼンテーション層。`FileUploader`, `ProjectionViewport` など。 |
| `src/utils/pdf.ts` | PDFコア | `pdfjs-dist` のラッパー。レンダリング、テキスト座標抽出、キャッシュ管理。 |
| `src/utils/toneMapping.ts` | 画像処理 | プロジェクターシミュレーションロジック。WASMのロードと実行、JSフォールバック。 |
| `src/utils/wcag.ts` | 分析ロジック | コントラスト比計算、K-means色抽出、文字サイズ判定。 |
| `src/hooks/usePdfRenderer.ts` | フック | PDFレンダラーの初期化・破棄サイクルを管理するReactフック。 |
| `public/wasm/` | 静的アセット | コンパイル済みの `tone_mapping.wasm` ファイル。 |

## 3. 主要モジュール詳細

### 3.1 PDF レンダリング (`src/utils/pdf.ts`)
- **遅延ロード**: 初期バンドルサイズ削減のため、`pdfjs-dist` は動的インポート (`import()`) されます。
- **座標変換**: PDFの座標系（左下原点）を HTML Canvas の座標系（左上原点）に変換し、スケーリングを適用して正確なテキスト位置を特定します。
- **リソース管理**: `dispose` メソッドにより、メモリリークを防ぐための明示的なクリーンアップ（Canvas破棄、Worker停止）が実装されています。

### 3.2 トーンマッピング (`src/utils/toneMapping.ts`)
プロジェクターの視認性低下を再現するための画像処理モジュールです。

- **WASM (WebAssembly)**:
    - C言語で記述されたピクセル操作ロジック。
    - `SharedMemory` (または線形メモリ) を介してCanvasのピクセルデータを直接操作し、JSのループ処理よりも高速に実行します。
- **シミュレーションパラメータ**:
    - `brightness`: -16 (輝度低下)
    - `contrast`: 0.9 (コントラスト低下)
    - `haze`: 0.20 (白ベール効果)
    - `resolutionFactor`: 0.7 (解像度低下)

### 3.3 アクセシビリティ分析 (`src/utils/wcag.ts`)
PDFを画像として解析する独自のアプローチを採用しています。

- **課題**: PDFのテキスト情報は「色コード」を持っていますが、背景が画像やグラデーションの場合、単純な比較ではコントラストが判別できません。
- **解決策 (K-means法)**:
    1.  テキストのバウンディングボックス周辺からピクセルをサンプリング。
    2.  取得したピクセル群を K-means法で 2つのクラスタ（文字、背景）に分離。
    3.  各クラスタの重心（または代表値）を用いてコントラスト比を算出。
    4.  これにより、複雑な背景上の文字でも高い精度で視認性を判定可能にしています。

## 4. データフロー
1.  **初期化**: `App.tsx` マウント時に WASM を非同期ロード。
2.  **ファイル入力**: ユーザーがPDFを選択 -> `usePdfRenderer` が `createPdfRenderer` を実行。
3.  **描画ループ**:
    - `App` がページ番号を指定して `renderPage` をコール。
    - `pdf.ts` が Canvas を生成・返却。
    - `App` が Canvas を受け取り、プレビューモードなら `toneMapping.ts` で加工して表示。
4.  **監査ループ**:
    - 描画完了後、バックグラウンド（またはユーザー操作）で `handleReadabilityCheck` が発火。
    - `pdf.ts` からテキスト情報を、Canvasから画像情報を取得。
    - `wcag.ts` が判定を行い、レポートオブジェクトを生成してStateを更新。
