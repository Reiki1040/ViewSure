# ViewSure Projection Preview

ブラウザ上でプレゼン資料をプロジェクター出力風に確認できる React / TypeScript 製プレビューアです。PDF・PowerPoint・主要画像フォーマット（PNG / JPEG / WEBP / HEIC）を読み込み、カスタム WebGL シェーダーによる明るさ・コントラスト調整をリアルタイムに適用します。  
プロトタイプ用途を想定した Vite ベースの開発用構成になっています。

## 特徴

- **React + TypeScript + Vite** … UI と状態管理は React 18、厳格な型付けと DX を TypeScript 5、開発サーバーとビルドは Vite 5 が担当します。
- **WebGL レンダラー** … 生 WebGL とカスタムシェーダーで輝度／コントラストを適用。描画ロジックは `useProjectionRenderer` フックで再利用可能に抽象化。
- **WASM アシスト** … `src/wasm/tone_mapping.wasm` を WebAssembly として読み込み、スライダー値からシェーダー向け係数を計算。軽量なトーンマッピングを高速に実行。
- **PDF マルチページ** … `pdfjs-dist` の legacy ビルドを使用し、必要になったページだけオンデマンドで Canvas に描画。ページ移動のたびにテクスチャを差し替えます。
- **PowerPoint (`.pptx`)** … `pptx-preview` を CDN から動的ロードし、SVG → Canvas に変換して WebGL テクスチャ化。追加のバックエンドを持たない構成です。
- **HEIC / HEIF** … `heic2any` でブラウザ内変換し、ImageBitmap もしくは Canvas として読み込んで投影。
- **ドラッグ＆ドロップ** … PDF / PPTX / 画像ファイルを直接アップロード可能。
- **暗所風 UI** … プロジェクタープレビューに合うダークトーンの UI。

## 技術スタック（詳細）

| 分類 | 採用技術 | 説明 |
|------|----------|------|
| フロントエンド | React 18 / TypeScript 5 | 関数コンポーネントとカスタムフックで UI と状態を構成。 |
| 開発基盤 | Vite 5, @vitejs/plugin-react | 高速な HMR と ESBuild ベースのビルド。 |
| PDF レンダリング | pdfjs-dist (legacy) | WebWorker 付きの pdf.js を Vite 互換の `?url` 形式で読込み。ページごとに Canvas を生成。 |
| PPTX レンダリング | pptx-preview (CDN) | jsDelivr から動的 import。SVG 化したスライドを Canvas へ変換。 |
| 画像変換 | heic2any | HEIC/HEIF → PNG 変換をブラウザ側で実行。 |
| WebGL | 生 WebGL + カスタム GLSL | 頂点・フラグメントシェーダーで画像表示と補正。アスペクト比調整、UV 反転を実装。 |
| WASM | `tone_mapping.wasm` | 明るさ／コントラスト係数の演算を Wasm で実行し、高頻度のスライダー操作に対応。 |
| スタイル | CSS (ダークテーマ) | `src/styles.css` にてグラスモーフィズム寄りの UI を定義。 |

## 開発環境の前提

- Node.js 16 以上（推奨は 18 LTS）
- npm または互換パッケージマネージャー（pnpm / yarn を使う場合はコマンドを読み替えてください）
- 画像変換を伴うためブラウザは最新の Chrome / Edge / Safari を想定
  - PPTX レンダリング用の `pptx-preview` は CDN から読み込むため、オフラインでは動作しません

## セットアップ

```bash
# 依存関係のインストール
npm install

# 開発サーバー起動
npm run dev
```

デフォルトでは `http://localhost:5173/` が開きます。Safari の “HTTP-Only” モードを使用している場合は、

1. `certs/localhost-cert.pem` と `certs/localhost-key.pem` を用意（例: `mkcert`）  
2. `npm run dev` を再起動 → Vite が自動的に HTTPS で起動  

ブラウザに自己署名証明書を信頼させてアクセスしてください。

## 使い方

1. 左側のアップローダーにファイルをドロップ、またはクリックして選択  
   - 対応形式: PDF / PPTX / PNG / JPEG / WEBP / HEIC
2. 読み込み完了後、右側キャンバスにプレビューが表示されます
3. 画面左右の “Prev / Next” ボタンでページを切り替え（複数ページの場合）
4. 「明るさ」「コントラスト」のスライダーで投影環境を調整
5. 「設定をリセット」で初期値（明るさ 100%、コントラスト 0%）に戻します

## ファイル構成（主要箇所）

```
├── src/
│   ├── App.tsx                # UI 構成と状態管理
│   ├── components/
│   │   ├── FileUploader.tsx
│   │   ├── ProjectionControls.tsx
│   │   └── ProjectionViewport.tsx
│   ├── hooks/
│   │   └── useProjectionRenderer.ts # WebGL 初期化・描画
│   ├── utils/
│   │   ├── fileLoader.ts      # PDF/PPTX/画像の読み込みと変換
│   │   ├── pdf.ts             # pdf.js を使ったページ描画
│   │   ├── ppt.ts             # pptx-preview をCDN経由で読み込み
│   │   └── toneMappingWasm.ts # WebAssembly モジュールのラッパー
│   └── wasm/
│       └── tone_mapping.wasm  # 輝度・コントラスト調整用 WASM
├── vite.config.ts
├── package.json
└── README.md
```

## 技術メモ

- WebGL のテクスチャは `UNPACK_FLIP_Y_WEBGL` を使わず頂点シェーダー側で UV を反転。PDF/画像を期待通りに表示します。
- PDF は `pdfjs-dist/legacy` を採用しワーカーを動的読み込み（Vite 対応のため `?url` を使用）。
- PPTX は npm パッケージではなく jsDelivr から静的ファイルをロードします。将来的に自前でホストする場合は `src/utils/ppt.ts` の `CDN_SOURCES` を書き換えてください。
- HEIC 変換はブラウザ側で行うため大きな画像は時間がかかります。必要であれば Web Worker へのオフロードを検討してください。
- WASM (`src/wasm/tone_mapping.wasm`) は brightness/contrast 操作の補助計算を実装。`ToneMappingExports` がフェッチ後に再利用されます。

## よくあるトラブル

| 症状 | 対応策 |
|------|--------|
| `Failed to resolve import "heic2any"` | `npm install` を再実行。初回はパッケージが未取得です。 |
| PPTX が表示されない | ネットワーク接続を確認。CDN ブロック環境では自前ホスティングが必要です。 |
| Safari で `HTTPS-Only` エラー | 前述の通り mkcert 等でローカル証明書を発行して HTTPS でアクセスする。 |

## 今後の拡張アイデア

- PDF/PPTX のページサムネイル表示、任意ページジャンプ
- 投影スクリーンのアスペクト比・解像度プリセット
- プロジェクター固有 LUT / カラープロファイルの適用
- Web Worker を利用したファイル変換処理の分離
- 永続ストレージ（IndexedDB 等）へのキャッシュ保存

---

このリポジトリは試作段階のため、仕様は予告なく変更される場合があります。フィードバックや改善案があれば issue / PR でお知らせください。
