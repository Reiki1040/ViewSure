# ViewSure Projection Preview

ViewSure は、プレゼン資料を投影する前に、明るさ・コントラスト・WCAG 適合状況を事前にチェックできるプレビューアです。PDF・PowerPoint・画像ファイルを読み込み、WebGL を用いたリアルタイム補正や WCAG 準拠チェック、PDF への書き出しまでをブラウザ上だけで完結させます。

## 主な機能
- **複数フォーマット対応**: PDF / PPTX / PNG / JPEG / WEBP / HEIC をブラウザ上で読み込み可能。
- **WebGL レンダリング**: 明るさ・コントラストをリアルタイム調整。投影機シミュレーション (ガンマ / 黒レベル / ビネット / ホットスポット) の ON/OFF 切り替えが可能。
- **WCAG 解析と提案**: PDF 内テキストの抽出、平均輝度・コントラスト比・フォントサイズを解析し、改善ポイントを可視化。推奨値に基づき自動調整を適用することもできます。
- **プレビュー UX**: メイン表示・WCAG プレビューを上下に常時表示し、ページスライダー・ページ番号入力・矢印キーで直感的にページ移動。
- **PDF 書き出し**: 補正後の全ページを PNG へ描画し、1 本の PDF として保存。
- **Google サインイン (任意)**: `VITE_GOOGLE_CLIENT_ID` を設定すると Google アカウントでのサインインが有効化されます。

## 対応フォーマットと実装メモ
| 種別 | 利用ライブラリ / 実装 | 備考 |
|------|------------------------|------|
| PDF | `pdfjs-dist/legacy` | Web Worker を `?url` でバンドル。テキスト抽出にも利用。 |
| PPTX | `pptx-preview` (jsDelivr CDN) | SVG を Canvas へ描画して WebGL テクスチャとして利用。ネットワーク接続が必須。 |
| 画像 (PNG/JPEG/WEBP) | ブラウザ標準 API | そのまま `TexImageSource` としてロード。 |
| HEIC/HEIF | `heic2any` | PNG に変換後に描画。変換はクライアント側で実行されるため大容量ファイルでは時間がかかります。 |

## 技術スタック
- React 18 / TypeScript 5 / Vite 5
- WebGL + GLSL / `useProjectionRenderer` フックによる描画
- WebAssembly (`src/wasm/tone_mapping.wasm`) で投影機向けトーンマッピングを計算
- `pdfjs-dist`, `pptx-preview`, `heic2any`, `jspdf`

## 動作環境
- Node.js 18 LTS 以上
- 最新の Chromium 系ブラウザ (WebGL が利用できること)
- PPTX を扱う場合はオンライン環境 (jsDelivr の CDN を利用)

## セットアップ
```bash
# 依存関係のインストール
npm install

# 開発サーバの起動
npm run dev

# 型チェック
npm run typecheck

# 本番ビルド
npm run build

# ビルド結果の確認
npm run preview
```

### HTTPS 開発サーバ (任意)
Safari など HTTPS が必須のブラウザ向けに、`certs/localhost-cert.pem` と `certs/localhost-key.pem` を配置すると Vite が自動で HTTPS を有効にします。証明書は `mkcert` などで生成してください。

## 使い方
1. **資料を開く**: 左上の「資料を開く」ボタンまたはアップロードエリアにドラッグ&ドロップ。
2. **プレビュー閲覧**: 上段がメインプレビュー、下段が WCAG プレビュー。読み込み中はスピナーを表示します。
3. **ページ移動**:
   - ページスライダーのドラッグ
   - ページ番号入力欄に数値を入力し Enter または「移動」ボタン
   - メインプレビュー付近の Prev / Next ボタン
   - キーボードの ← / → キー
4. **明るさ・コントラスト調整**: 左ペインのスライダーでリアルタイム調整。リセットボタンで初期値に戻します。
5. **投影シミュレーション**: 「プロジェクタープレビュー」ボタンで ON/OFF を切り替えます。
6. **WCAG 解析**: 「WCAG 解析」ボタンで実行。解析結果は WCAG プレビューおよびサマリで確認。必要に応じて「変更をすべてクリア」で元に戻せます。
7. **PDF 保存**: 上部メニューの「PDF保存」で補正後の全ページを PDF としてダウンロードできます。

## ディレクトリ構成 (抜粋)
```
ViewSure/
├─ src/
│  ├─ App.tsx                # 画面全体の状態管理とレイアウト
│  ├─ components/            # UI コンポーネント
│  ├─ hooks/
│  │  └─ useProjectionRenderer.ts # WebGL 描画ロジック
│  ├─ utils/
│  │  ├─ fileLoader.ts       # 各フォーマットの読み込み処理
│  │  ├─ pdf.ts / ppt.ts      # PDF / PPTX レンダリング補助
│  │  └─ toneMappingWasm.ts  # WASM ローダー
│  ├─ context/AuthContext.tsx # Google サインイン管理
│  └─ wasm/tone_mapping.wasm
├─ public/_redirects          # SPA 向けリダイレクト設定
├─ certs/                     # HTTPS 用ローカル証明書 (任意)
├─ vite.config.ts
└─ package.json
```

## WCAG 解析フロー
1. PDF (または対応フォーマット) からスライド画像を Canvas に描画。
2. PDF の場合はテキストコンテンツを抽出し、フォントサイズや矩形領域を推定。
3. スライドの平均輝度、文字周辺のコントラスト、フォントサイズを算出。
4. 違反度合いに応じて Warning/Error を記録し、推奨の明るさ・コントラスト・フォント倍率を提示。
5. 必要に応じて自動調整を適用し、WCAG プレビューに反映します。

## 制限事項・注意点
- WebGL 非対応ブラウザでは使用できません。`canvas.getContext('webgl')` が取得できる環境を想定しています。
- PPTX 読み込みは CDN 依存のため、オフライン環境では動作しません。
- HEIC 変換はクライアント側で実行するため、大容量ファイルでは処理に時間がかかる場合があります。
- PDF 解析はテキストが埋め込まれていることを前提としています。アウトライン化された PDF では WCAG 解析が十分に行えない場合があります。

## 今後の拡張アイデア
- キーボードショートカットの追加 (明るさ変更・解析実行など)
- 輝度・コントラスト以外の投影補正 (色温度プリセット、スクリーン種類別プロファイル)
- 解析結果のエクスポート (レポート PDF / JSON)
- HEIC 変換や PDF レンダリングの Web Worker 化によるレスポンス改善
- オフライン利用向けに PPTX レンダラをバンドルする構成の検討

---
何か不具合や改善提案があれば issue / PR でお知らせください。ViewSure がより良い投影体験を提供できるよう、引き続き改善していきます。
