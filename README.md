# ViewSure

ViewSure は、プレゼンテーション資料（PDF）の視認性とアクセシビリティを検証するためのWebアプリケーションです。
実際の投影環境（プロジェクター）での見え方をブラウザ上でシミュレーションし、同時に WCAG 基準に基づいた「読みやすさ」の監査を行うことで、より多くの人に伝わる資料作成を支援します。

## 主な機能 (Key Features)

- **PDF プレビュー**: 高速かつ高精細なPDF表示（`pdfjs-dist` 使用）。
- **プロジェクターシミュレーション**:
  - 輝度・コントラストの低下や解像感の劣化を再現。
  - 環境光による白ベール（ヘイズ）効果の付加。
  - WebAssembly (WASM) による高速な画像処理（JSフォールバックあり）。
- **アクセシビリティ監査 (WCAG Check)**:
  - **コントラスト判定**: レンダリング結果から K-means 法で文字色と背景色を抽出し、正確なコントラスト比を計算。
  - **文字サイズ警告**: 18pt未満の小さい文字や極端に大きい文字を検出。
  - **情報量・レイアウト**: 文字数過多や行間の詰まりをチェック。
- **プライバシーファースト**:
  - ファイルアップロードは行わず、すべての処理をブラウザ（クライアントサイド）で完結。

## セットアップ (Setup)

### 前提条件
- Node.js (v18 以上推奨)
- npm

### インストールと起動

```bash
# 依存パッケージのインストール
npm install

# 開発サーバーの起動 (localhost:5173)
npm run dev

# ビルド
npm run build

# プレビュー (ビルド後の動作確認)
npm run preview
```

## 技術スタック (Tech Stack)

- **Frontend**: React 18, TypeScript 5, Vite 5
- **PDF Core**: PDF.js (`pdfjs-dist`)
- **Image Processing**: WebAssembly (C/Emscripten), Canvas API
- **Analysis**: Custom K-means clustering & WCAG algorithms

## ディレクトリ構造

```
src/
├── App.tsx                 # メインアプリケーションロジック
├── components/             # UIコンポーネント (FileUploader, ProjectionViewport 等)
├── hooks/                  # カスタムフック (usePdfRenderer)
├── utils/
│   ├── pdf.ts              # PDFレンダリング・テキスト抽出
│   ├── toneMapping.ts      # プロジェクターシミュレーション (WASM/JS)
│   └── wcag.ts             # アクセシビリティ分析・コントラスト計算
└── public/
    └── wasm/               # コンパイル済み WebAssembly モジュール
```
