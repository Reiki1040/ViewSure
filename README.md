# ViewSure – プロジェクション準備支援アプリ

ViewSure は、プレゼン資料を「投影する前に整える」ことを目的とした Web アプリケーションです。  
大学での発表や学会の口頭発表、企業説明会などでプロジェクターを使う際に、資料の見やすさ・アクセシビリティを素早くチェックし、必要な調整を行えます。React（TypeScript）と Vite を用いたシングルページアプリケーションとして開発しています。

---

## 1. 画面構成と役割

| 画面 | 役割 | 主な操作 |
| --- | --- | --- |
| **Landing Screen** | アプリの紹介とログイン／ゲスト利用の選択 | Google アカウントでのサインイン、または「試してみる」 |
| **Project Dashboard** | プロジェクトの整理と選択 | フォルダ／プロジェクトの新規作成、検索、削除、Trash 管理 |
| **Projection Studio** | 資料の読み込み・調整・書き出し | PDF/PPTX/画像の表示、明るさ・コントラスト調整、WCAG 解析、PDF 出力 |

Landing でログイン後、Dashboard でプロジェクトを選び、Studio で資料を編集・確認する流れです。削除したプロジェクトは Trash タブに保管され、必要に応じて完全削除（復元は未実装）できます。

---

## 2. 主な機能

- **幅広いファイル形式の読み込み**  
  PDF・PowerPoint（`.pptx`）・PNG/JPEG/WEBP/HEIC に対応。ドラッグ＆ドロップでも読み込めます。
- **WebGL による投影プレビュー**  
  明るさ・コントラストの調整を GPU で高速処理。画面全体のバランスを確認しながら設定できます。
- **WCAG アクセシビリティ支援**  
  PDF から抽出したテキストと背景色を解析し、コントラスト改善の提案やオーバーレイ表示を行います。
- **ページナビゲーションとスクリーンショット**  
  前後ページ移動、ページ番号ジャンプ、現在の画面を PDF として保存する機能があります。
- **フォルダ／Trash によるプロジェクト管理**  
  プロジェクトを自由に整理でき、削除したプロジェクトは Trash に移動します。Trash では個別削除または一括削除が可能です。
- **ゲスト利用対応**  
  Google アカウントがなくても試せます（セッション終了で状態はリセットされます）。

---

## 3. 技術スタック

| 分野 | 使用技術 | 補足 |
| --- | --- | --- |
| フロントエンド | React 18 / TypeScript 5 | Hooks ベースで状態管理。`useProjectionRenderer`、`useWcagHelper` などのカスタムフックあり。 |
| ビルドツール | Vite 5 | 軽量ビルドと高速 HMR を利用。 |
| レンダリング | WebGL + GLSL | 明るさ・コントラスト調整やオーバーレイ描画を GPU で実行。 |
| WASM | `src/wasm/tone_mapping.wasm` | 複雑なトーンマッピング計算を高速化。 |
| ドキュメント処理 | `pdfjs-dist`, `pptx-preview` | PDF は Canvas 描画、PPTX は SVG 変換後に描画。 |
| 画像変換 | `heic2any` | HEIC/HEIF を PNG に変換してレンダリング。 |
| 認証 | Google Identity Services | `AuthContext` でサインイン／サインアウトとセッション復元を管理。 |
| その他 | `jspdf`, `pdfjs-dist/legacy` など | PDF 出力、テキスト抽出、エラーハンドリング等で利用。 |

---

## 4. ディレクトリ構成（抜粋）

```
ViewSure/
├── public/                     # 静的ファイル
├── src/
│   ├── App.tsx                 # 画面遷移とグローバル状態
│   ├── components/             # UI コンポーネント群
│   │   ├── LandingScreen.tsx
│   │   ├── ProjectDashboard.tsx
│   │   ├── ProjectionViewport.tsx など
│   ├── context/AuthContext.tsx # Google 認証
│   ├── hooks/useProjectionRenderer.ts
│   ├── types/projects.ts       # プロジェクト・Trash の型定義
│   ├── utils/                  # ファイル読込・WASM 呼び出し等
│   ├── wasm/tone_mapping.wasm
│   └── styles.css              # グローバルスタイル
├── package.json
├── vite.config.ts
└── netlify.toml (任意)
```

---

## 5. 環境構築と開発手順

### 5.1 必要なソフトウェア
- Node.js 18 LTS 以上
- npm（同梱）、または pnpm / yarn などのパッケージマネージャー
- 最新の Chromium 系ブラウザ（WebGL が有効なもの）

### 5.2 初期セットアップ
```bash
npm install           # 依存パッケージのインストール
npm run dev           # 開発サーバー起動（http://localhost:5173）
```

### 5.3 ビルド・テスト
```bash
npm run typecheck     # TypeScript の型チェック
npm run build         # 本番ビルド
npm run preview       # 本番ビルドの動作確認（http://localhost:4173）
```

### 5.4 Google サインインを利用する場合
1. `.env.local` を作成し、以下を設定します。  
   `VITE_GOOGLE_CLIENT_ID=xxxxxxxxxxxxxxxx.apps.googleusercontent.com`
2. Google Cloud Console で OAuth クライアント ID を発行し、承認済みリダイレクト URI に `http://localhost:5173` を追加します。
3. `npm run dev` で起動し、サインインボタンから動作を確認します。

---

## 6. Netlify を使ったデプロイ

```bash
netlify login                     # 初回のみ：ブラウザで認証
netlify init  または  netlify link  # サイトの作成／既存サイトとの紐づけ
netlify deploy --build             # プレビュー用のデプロイ
netlify deploy --build --prod      # 本番デプロイ
```

推奨設定として `netlify.toml` を置いておくと便利です。
```toml
[build]
  command = "npm run build"
  publish = "dist"
```

---

## 7. 操作の流れ（例）
1. **Landing Screen** で Google アカウントでログイン、またはゲストモードを選択。  
2. **Project Dashboard** のサイドバーでフォルダを作成し、プロジェクトを追加。検索窓で絞り込みも可能。  
3. プロジェクトの行をダブルクリックすると **Projection Studio** が開き、資料の読み込み・調整・ページ移動・WCAG 確認などを行う。  
4. `PDF を保存` ボタンで現在の画面を PDF として書き出し。不要なプロジェクトは削除すると Trash に移動。  
5. Trash タブから個別削除、あるいは「ゴミ箱を空にする」で完全削除。

---

## 8. よくある質問 (FAQ)

| 症状 | 対応策 |
| --- | --- |
| Google サインインが表示されない | `.env.local` のクライアント ID を確認し、ブラウザのポップアップを許可する。 |
| PPTX が読み込めない | jsDelivr など CDN へのアクセスがブロックされていないか確認。学内ネットワークの場合はプロキシ設定が必要なことがあります。 |
| HEIC 変換に時間がかかる | HEIC はブラウザ上で PNG に変換するため大きな画像ほど時間がかかります。事前にサイズを落とすか PNG に変換しておくとスムーズです。 |
| Trash の内容が更新されない | ハッシュが `#projects` になっているか確認し、再読み込みしてください。それでも改善しない場合はブラウザキャッシュを削除します。 |

---

## 9. 今後の拡張アイデア
- Trash からの復元機能や削除ログの追加
- プロジェクトの共同編集・共有リンク
- LUT（カラープリセット）の適用やプロジェクター別プロファイル
- ワーカースレッドを用いたファイル変換の高速化
- IndexedDB を使ったローカルキャッシュ・オフライン利用

---

## 10. 貢献方法
- バグ報告や機能要望は Issue で共有してください。
- 改善案をコードとして提案する際は、ブランチを切り Pull Request を送ってください。  
- README の改善や翻訳、UI/UX の提案も大歓迎です。

ViewSure がプレゼン準備を少しでも楽にし、聴衆にとってもわかりやすい資料づくりを支援できれば幸いです。質問や提案があれば気軽にお知らせください。
