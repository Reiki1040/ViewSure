# テキスト構造解析機能の設計と実装計画

## 概要

ViewSureアプリケーションにおけるテキスト構造解析機能の設計と実装計画について詳細に説明します。この機能により、PDFやPPTXから抽出されたテキストデータの構造（見出し階層、段落、リストなど）を解析し、より高度なWCAGアクセシビリティチェックを実現します。

## 現状の課題

現在のViewSureでは、テキストデータを単純なテキスト要素の配列として扱っており、以下の課題があります。

1. **構造情報の欠如**: テキストの階層関係（見出しレベル、段落構造など）が解析されていない
2. **PPTXのテキスト抽出未実装**: PPTXからテキストを抽出する機能が実装されていない
3. **限定的なWCAGチェック**: 構造情報に基づくWCAGチェック（見出しの階層順序、リストのマークアップなど）ができない

## テキスト構造解析の設計

### 1. テキスト構造の型定義

```typescript
// src/types/textStructure.ts

export type TextElementRole = 
  | 'title'        // スライドタイトル
  | 'heading-1'    // 見出しレベル1
  | 'heading-2'    // 見出しレベル2
  | 'heading-3'    // 見出しレベル3
  | 'paragraph'    // 段落
  | 'list-item'    // リスト項目
  | 'bullet-list'   // 箇条書きリスト
  | 'numbered-list' // 番号付きリスト
  | 'caption'      // キャプション
  | 'footer'       // フッター
  | 'table-header' // 表のヘッダー
  | 'table-cell'   // 表のセル
  | 'quote';       // 引用

export type TextStructureNode = {
  id: string;
  content: string;
  role: TextElementRole;
  level?: number; // 見出しレベル、リストの階層など
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  fontSize: number;
  fontFamily?: string;
  fontWeight?: number | string;
  children?: TextStructureNode[]; // 子要素（階層構造）
  parent?: string; // 親要素のID
  order: number; // 同一階層内での順序
  metadata?: {
    pageNumber: number;
    contrastRatio?: number;
    wcagViolations?: string[];
  };
};

export type SlideStructure = {
  slideId: number;
  title?: string;
  width: number;
  height: number;
  elements: TextStructureNode[];
  hierarchy: {
    root: string[]; // ルート要素のID配列
    tree: Record<string, string[]>; // 親ID -> 子ID配列のマップ
  };
};

export type DocumentStructure = {
  pageCount: number;
  slides: SlideStructure[];
  globalHierarchy: {
    headings: Array<{
      slideId: number;
      level: number;
      text: string;
      id: string;
    }>;
    outline: Array<{
      slideId: number;
      title: string;
      level: number;
    }>;
  };
};
```

### 2. PDFテキスト構造解析アルゴリズム

```typescript
// src/utils/pdfStructureAnalyzer.ts

export class PdfStructureAnalyzer {
  // テキスト要素のグループ化（位置とスタイルに基づく）
  private groupTextElements(runs: PdfPageTextRun[]): TextGroup[] {
    // 1. 位置に基づくグループ化（近接性）
    // 2. フォントサイズに基づくグループ化（階層）
    // 3. 配置に基づくグループ化（中央揃え、左揃えなど）
  }

  // 見出しの検出
  private detectHeadings(groups: TextGroup[]): HeadingNode[] {
    // 1. フォントサイズの大きい要素を検出
    // 2. 位置関係から階層を判断
    // 3. キーワードパターンマッチング（「第X章」「1.」など）
  }

  // リストの検出
  private detectLists(groups: TextGroup[]): ListNode[] {
    // 1. 箇条書き記号の検出（•、-、*など）
    // 2. 番号付きリストの検出（1.、2.など）
    // 3. インデントによる階層の検出
  }

  // 表の検出
  private detectTables(groups: TextGroup[]): TableNode[] {
    // 1. グリッド状の配置を検出
    // 2. 縦線・横線の検出
    // 3. 整列されたテキストの検出
  }

  // 構造の構築
  public buildStructure(textContent: SlideTextContent): SlideStructure {
    // 1. テキスト要素のグループ化
    // 2. 各種要素の検出（見出し、リスト、表など）
    // 3. 階層関係の構築
    // 4. 構造の検証と修正
  }
}
```

### 3. PPTXテキスト構造解析機能

```typescript
// src/utils/pptxStructureAnalyzer.ts

export class PptxStructureAnalyzer {
  // PPTX XMLからテキスト構造を抽出
  public async extractStructure(buffer: ArrayBuffer): Promise<DocumentStructure> {
    // 1. PPTXファイルを解凍
    // 2. slideX.xmlファイルを解析
    // 3. テキストボックスとプレースホルダーを特定
    // 4. マスタースライドとの比較で要素の役割を判断
    // 5. 階層構造を構築
  }

  // プレースホルダーの種類を判定
  private identifyPlaceholderType(element: any): TextElementRole {
    // title, body, content, ctrTitleなどのプレースホルダータイプを判定
  }

  // スライドのアウトラインを構築
  private buildSlideOutline(slides: SlideData[]): DocumentStructure['globalHierarchy'] {
    // 各スライドのタイトルと階層を抽出
  }
}
```

### 4. テキスト階層関係の検出ロジック

```typescript
// src/utils/hierarchyDetector.ts

export class HierarchyDetector {
  // 見出し階層の検出
  public detectHeadingHierarchy(elements: TextStructureNode[]): HeadingHierarchy {
    // 1. フォントサイズの階層を分析
    // 2. 位置関係（Y座標）から順序を判断
    // 3. インデントレベルを考慮
    // 4. 見出しレベルの自動割り当て
  }

  // リスト階層の検出
  public detectListHierarchy(elements: TextStructureNode[]): ListHierarchy {
    // 1. インデントレベルの検出
    // 2. リスト記号のパターンマッチング
    // 3. 階層のネスト関係を構築
  }

  // 全体の階層構造を構築
  public buildDocumentHierarchy(slides: SlideStructure[]): DocumentStructure['globalHierarchy'] {
    // 1. スライド間の見出し階層を連結
    // 2. アウトラインを生成
    // 3. 階層の矛盾を検出と修正
  }
}
```

### 5. 構造化テキストデータのWCAGチェックへの統合

```typescript
// src/utils/structuredWcagAnalyzer.ts

export class StructuredWcagAnalyzer {
  // 構造に基づくWCAGチェック
  public analyzeStructure(structure: DocumentStructure): StructureWcagIssues {
    return {
      headingIssues: this.checkHeadingHierarchy(structure),
      listIssues: this.checkListStructure(structure),
      tableIssues: this.checkTableStructure(structure),
      readingOrderIssues: this.checkReadingOrder(structure),
      contrastIssues: this.checkContrastWithStructure(structure)
    };
  }

  // 見出し階層のチェック
  private checkHeadingHierarchy(structure: DocumentStructure): HeadingIssue[] {
    // 1. 見出しレベルの飛びを検出
    // 2. 見出しの順序をチェック
    // 3. 見出しの重複をチェック
  }

  // リスト構造のチェック
  private checkListStructure(structure: DocumentStructure): ListIssue[] {
    // 1. リスト記号の一貫性をチェック
    // 2. リストの階層をチェック
    // 3. リスト項目の不完全さをチェック
  }

  // 読み上げ順序のチェック
  private checkReadingOrder(structure: DocumentStructure): ReadingOrderIssue[] {
    // 1. 視覚的な順序と構造的な順序の比較
    // 2. 論理的な読み上げ順序の検証
  }
}
```

## 実装計画

### フェーズ1: 基本的なテキスト構造解析

1. **型定義の拡張**
   - `src/types/textStructure.ts`の作成
   - 既存の`textModel.ts`との統合

2. **PDFテキスト構造解析の実装**
   - `src/utils/pdfStructureAnalyzer.ts`の実装
   - 基本的な見出し検出機能
   - 段落とリストの検出機能

3. **階層検出ロジックの実装**
   - `src/utils/hierarchyDetector.ts`の実装
   - 見出し階層の自動検出
   - リスト階層の検出

### フェーズ2: PPTXテキスト構造解析

1. **PPTX解析機能の実装**
   - `src/utils/pptxStructureAnalyzer.ts`の実装
   - PPTX XMLからのテキスト抽出
   - プレースホルダーの種類判定

2. **PPTX構造解析の統合**
   - `src/utils/fileLoader.ts`の拡張
   - PPTX用の`getTextContent()`メソッド実装

### フェーズ3: WCAGチェックへの統合

1. **構造化WCAG分析の実装**
   - `src/utils/structuredWcagAnalyzer.ts`の実装
   - 構造に基づくWCAGチェック機能

2. **既存コンポーネントの拡張**
   - `src/utils/wcag/analyzer.ts`の拡張
   - `src/hooks/useWcagHelper.ts`の更新
   - `src/components/WcagSummary.tsx`の拡張

### フェーズ4: UIコンポーネントの拡張

1. **構造情報の表示**
   - テキスト階層の可視化
   - アウトラインパネルの実装
   - 構造に基づくナビゲーション

2. **高度なWCAGチェック結果の表示**
   - 構造に関する問題の詳細表示
   - 修正提案の実装

## 技術的考慮事項

### パフォーマンスの最適化

1. **大規模ドキュメントの処理**
   - ページ単位の遅延読み込み
   - Web Workerでのバックグラウンド処理
   - 処理結果のキャッシュ

2. **メモリ管理**
   - 大きなテキストデータの効率的な処理
   - 不要なデータの解放
   - メモリリークの防止

### 精度の向上

1. **機械学習の活用**
   - テキスト要素の分類精度向上
   - 構造パターンの学習
   - ドメイン特化のモデル

2. **ヒューリスティクスの改善**
   - 多様なレイアウトへの対応
   - エッジケースの処理
   - ユーザーフィードバックの活用

## 期待される効果

1. **アクセシビリティの向上**
   - より精度の高いWCAGチェック
   - 構造に関する問題の検出
   - スクリーンリーダー対応の改善

2. **ユーザー体験の向上**
   - 直感的なテキスト構造の可視化
   - 効率的なドキュメントナビゲーション
   - より詳細な修正提案

3. **機能の拡張性**
   - 将来的な高度なテキスト分析機能
   - 多言語対応の基盤
   - AIによる自動修正の基盤

## まとめ

テキスト構造解析機能の実装により、ViewSureは単なる画像処理ツールから、知的なドキュメント分析ツールへと進化します。この機能は、WCAGアクセシビリティチェックの精度を大幅に向上させ、より包括的なアクセシビリティ対応を可能にします。