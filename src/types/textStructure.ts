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

// 構造解析に関する問題の型定義
export type StructureIssue = {
  id: string;
  slideId: number;
  elementId?: string;
  type: 'heading-hierarchy' | 'list-structure' | 'reading-order' | 'table-structure';
  severity: 'error' | 'warning';
  message: string;
  suggestion?: string;
};

// 見出し階層の問題
export type HeadingIssue = StructureIssue & {
  type: 'heading-hierarchy';
  currentLevel: number;
  expectedLevel?: number;
  previousLevel?: number;
};

// リスト構造の問題
export type ListIssue = StructureIssue & {
  type: 'list-structure';
  listType: 'bullet' | 'numbered';
  inconsistencyType: 'marker' | 'indentation' | 'nesting';
};

// 読み上げ順序の問題
export type ReadingOrderIssue = StructureIssue & {
  type: 'reading-order';
  visualOrder: string[];
  logicalOrder: string[];
};

// 表構造の問題
export type TableIssue = StructureIssue & {
  type: 'table-structure';
  issueType: 'missing-header' | 'inconsistent-columns' | 'missing-caption';
};

// 構造化WCAG分析結果
export type StructureWcagIssues = {
  headingIssues: HeadingIssue[];
  listIssues: ListIssue[];
  readingOrderIssues: ReadingOrderIssue[];
  tableIssues: TableIssue[];
  allIssues: StructureIssue[];
};

// テキストグループ（解析中間データ）
export type TextGroup = {
  id: string;
  elements: Array<{
    text: string;
    fontSize: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  averageFontSize: number;
  alignment: 'left' | 'center' | 'right' | 'justified';
  type?: 'potential-heading' | 'potential-list' | 'potential-paragraph' | 'potential-table';
};

// 見出しノード（解析中間データ）
export type HeadingNode = {
  id: string;
  text: string;
  level: number;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  fontSize: number;
  confidence: number; // 見出しである確信度
};

// リストノード（解析中間データ）
export type ListNode = {
  id: string;
  type: 'bullet' | 'numbered';
  items: Array<{
    id: string;
    text: string;
    level: number;
    marker?: string;
    bounds: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }>;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

// 表ノード（解析中間データ）
export type TableNode = {
  id: string;
  rows: number;
  columns: number;
  cells: Array<{
    id: string;
    text: string;
    row: number;
    column: number;
    isHeader?: boolean;
    bounds: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }>;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

// 見出し階層
export type HeadingHierarchy = {
  levels: Array<{
    level: number;
    headings: HeadingNode[];
  }>;
  issues: HeadingIssue[];
};

// リスト階層
export type ListHierarchy = {
  lists: ListNode[];
  nestingStructure: Array<{
    parentId: string;
    childIds: string[];
  }>;
  issues: ListIssue[];
};

// スライドデータ（PPTX解析用）
export type SlideData = {
  id: string;
  title?: string;
  elements: Array<{
    id: string;
    type: string;
    text: string;
    placeholderType?: string;
    bounds: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    fontSize?: number;
    fontFamily?: string;
    level?: number;
  }>;
};