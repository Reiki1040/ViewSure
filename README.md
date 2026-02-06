# ViewSure – PDF プレビュー + 読みやすさチェック

ViewSure は「スタートメニュー → プレビュー画面」という構成で、**PDF のプレビュー**と**プロジェクター環境を想定した表示確認**、**読みやすさチェック（WCAGベース）**を行える軽量アプリです。

---

## 1. 画面構成

| 画面 | 役割 | 主な操作 |
| --- | --- | --- |
| **Landing Screen** | アプリ紹介＋開始ボタン | 「ViewSure を始める」でプレビュー画面へ遷移 |
| **Preview Screen** | PDF 読み込みとページ表示 | PDF アップロード、スライダー / 入力 / ボタンでページ移動、プロジェクタープレビュー、読みやすさチェック |

---

## 2. 現在の機能

- **PDF のドラッグ＆ドロップ / ファイル選択**（PDF 以外は拒否）
- **Canvas によるプレビュー表示**（`pdfjs-dist` を使用）
- **前後ボタン / スライダー / ページ番号入力**でのページ遷移
- **プロジェクタープレビューモード**（トーンマッピング＋解像感の低下を模擬）
- **読みやすさチェック**（文字サイズ、行間、情報量、コントラストの簡易判定）
- **ステータスメッセージ**で読み込み状況やエラーを通知

---

## 3. 技術スタック

| 分野 | 技術 | 補足 |
| --- | --- | --- |
| フロントエンド | React 18 + TypeScript 5 | 状態管理は `App.tsx` に集約 |
| ビルド | Vite 5 | HMR と高速ビルド |
| PDF 描画 | `pdfjs-dist` | `src/utils/pdf.ts` の `createPdfRenderer` を利用 |
| 画像処理 | WASM + JS | `src/utils/toneMapping.ts` で投影トーンを再現 |
| 読みやすさ解析 | 独自ロジック | `src/utils/wcag.ts` でコントラスト判定 |

依存パッケージは `react`, `react-dom`, `pdfjs-dist` のみです。

---

## 4. ディレクトリ構成（抜粋）

```
src/
├── App.tsx
├── assets/               # ロゴ等
├── components/
│   ├── LandingScreen.tsx
│   ├── FileUploader.tsx
│   ├── ProjectionViewport.tsx
│   └── LoadingSpinner.tsx
├── utils/pdf.ts
├── utils/toneMapping.ts
├── utils/wcag.ts
├── styles.css
└── main.tsx
```

### 4-1. ファイル構造（詳細）

```
src/
├── App.tsx                      # 画面遷移・状態管理・読みやすさチェック統合
├── main.tsx                     # React 入口
├── styles.css                   # メインスタイル
├── assets/                      # 画像・アイコン
├── components/                  # UI コンポーネント
│   ├── LandingScreen.tsx
│   ├── FileUploader.tsx
│   ├── ProjectionViewport.tsx
│   └── LoadingSpinner.tsx
├── hooks/                       # カスタムフック
│   └── usePdfRenderer.ts         # PDF 読み込みと renderer ライフサイクル
├── types/                       # 型定義
│   └── pdf.ts                    # テキスト抽出・座標系の共有型
└── utils/                        # ドメインロジック
    ├── pdf.ts                    # pdf.js ラッパー、描画・テキスト抽出
    ├── toneMapping.ts            # プロジェクター投影シミュレーション
    ├── wcag.ts                   # コントラスト・配色バランス解析
    ├── wcagFix.ts                # 自動修正テンプレート生成
    ├── imageExtractor.ts         # PDF 内画像の抽出
    ├── rawImageExtractor.ts      # 低レベル抽出（検証用途）
    └── clusterExtractor.ts       # クラスタ抽出（検証用途）

public/
└── wasm/                         # WASM バイナリ
    └── tone_mapping.wasm

dist/                             # Vite ビルド出力（デプロイ用）

docs/ (root .md ファイル群)       # 仕様・設計メモ・実装記録
```

---

## 5. セットアップ

```bash
npm install
npm run dev       # http://localhost:5173
npm run build
npm run preview
npm run typecheck
```

---

## 6. 今後の拡張メモ

1. ページキャッシュやズーム機能など、プレビュー体験の改善。
2. 読みやすさチェックの精度向上と、改善提案のUI強化。

---

## 7. 操作の流れ（例）
1. **Landing Screen** で「ViewSure を始める」をクリック。  
2. **Preview Screen** でPDFをドラッグ＆ドロップ、またはアップロードボタンから選択。  
3. ページ送り・スライダーでプレビュー。必要に応じてプロジェクタープレビューモードをオン。  
4. 「読みやすさチェック」で問題箇所の概要を確認。

---

## 8. よくある質問 (FAQ)

| 症状 | 対応策 |
| --- | --- |
| PDF が読み込めない | PDF形式か確認し、ファイルサイズが大きい場合は分割を検討してください。 |
| プロジェクタープレビューが効かない | `public/wasm/tone_mapping.wasm` が読み込めるか確認してください。WASMが使えない場合はJSフォールバックで動作します。 |

---

## 9. 貢献方法
- バグ報告や機能要望は Issue で共有してください。
- 改善案をコードとして提案する際は、ブランチを切り Pull Request を送ってください。  
- README の改善や翻訳、UI/UX の提案も歓迎します。
