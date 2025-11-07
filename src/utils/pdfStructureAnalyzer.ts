import type { PdfPageTextContent, PdfPageTextRun } from './pdf';
import type {
  TextStructureNode,
  SlideStructure,
  TextGroup,
  HeadingNode,
  ListNode,
  TableNode,
  TextElementRole
} from '../types/textStructure';

// テキスト要素のグループ化（位置とスタイルに基づく）
const groupTextElements = (runs: PdfPageTextRun[]): TextGroup[] => {
  if (!runs || runs.length === 0) {
    return [];
  }

  // 1. Y座標でソート（上から下へ）
  const sortedRuns = [...runs].sort((a, b) => a.y - b.y);

  // 2. 近接性に基づくグループ化
  const groups: TextGroup[] = [];
  const lineThreshold = 5; // 同じ行とみなすY座標の差の閾値
  const paragraphThreshold = 20; // 同じ段落とみなすY座標の差の閾値

  let currentGroup: PdfPageTextRun[] = [];
  let lastY = -1;

  for (const run of sortedRuns) {
    if (currentGroup.length === 0) {
      currentGroup.push(run);
      lastY = run.y;
      continue;
    }

    const yDiff = Math.abs(run.y - lastY);
    
    if (yDiff <= lineThreshold) {
      // 同じ行
      currentGroup.push(run);
    } else if (yDiff <= paragraphThreshold) {
      // 同じ段落だが改行
      if (currentGroup.length > 0) {
        groups.push(createTextGroup(currentGroup));
      }
      currentGroup = [run];
    } else {
      // 新しい段落
      if (currentGroup.length > 0) {
        groups.push(createTextGroup(currentGroup));
      }
      currentGroup = [run];
    }
    
    lastY = run.y;
  }

  // 最後のグループを追加
  if (currentGroup.length > 0) {
    groups.push(createTextGroup(currentGroup));
  }

  return groups;
};

// テキストグループの作成
const createTextGroup = (runs: PdfPageTextRun[]): TextGroup => {
  const id = `group-${Math.random().toString(36).substr(2, 9)}`;
  
  // バウンズの計算
  const minX = Math.min(...runs.map(r => r.x));
  const maxX = Math.max(...runs.map(r => r.x + r.width));
  const minY = Math.min(...runs.map(r => r.y));
  const maxY = Math.max(...runs.map(r => r.y + r.height));
  
  const bounds = {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };

  // 平均フォントサイズの計算
  const totalFontSize = runs.reduce((sum, run) => sum + run.fontSize, 0);
  const averageFontSize = totalFontSize / runs.length;

  // 配置の検出
  const alignment = detectAlignment(runs, bounds.width);

  // 要素の変換
  const elements = runs.map(run => ({
    text: run.text,
    fontSize: run.fontSize,
    x: run.x,
    y: run.y,
    width: run.width,
    height: run.height
  }));

  return {
    id,
    elements,
    bounds,
    averageFontSize,
    alignment,
    type: undefined // 後で設定
  };
};

// 配置の検出
const detectAlignment = (runs: PdfPageTextRun[], groupWidth: number): 'left' | 'center' | 'right' | 'justified' => {
  if (runs.length === 0) return 'left';
  
  const firstRun = runs[0];
  const lastRun = runs[runs.length - 1];
  const leftMargin = firstRun.x;
  const rightMargin = (firstRun.x + firstRun.width) - (lastRun.x + lastRun.width);
  
  // 左揃えの判定
  if (leftMargin < groupWidth * 0.1) {
    return 'left';
  }
  
  // 中央揃えの判定
  const centerOffset = Math.abs(leftMargin - rightMargin);
  if (centerOffset < groupWidth * 0.05) {
    return 'center';
  }
  
  // 右揃えの判定
  if (rightMargin < groupWidth * 0.1) {
    return 'right';
  }
  
  return 'justified';
};

// 見出しの検出
const detectHeadings = (groups: TextGroup[], slideWidth: number, slideHeight: number): HeadingNode[] => {
  const headings: HeadingNode[] = [];
  
  // フォントサイズの分布を分析
  const fontSizes = groups.map(g => g.averageFontSize).sort((a, b) => b - a);
  const largeFontThreshold = fontSizes[Math.floor(fontSizes.length * 0.2)] || fontSizes[0];
  
  for (const group of groups) {
    // 大きいフォントサイズのグループを見出し候補とする
    if (group.averageFontSize >= largeFontThreshold) {
      // 中央揃えまたは左揃えのものを優先
      if (group.alignment === 'center' || group.alignment === 'left') {
        const confidence = calculateHeadingConfidence(group, slideWidth, slideHeight);
        
        if (confidence > 0.6) {
          headings.push({
            id: `heading-${group.id}`,
            text: group.elements.map(e => e.text).join(' '),
            level: 1, // 後で階層を調整
            bounds: group.bounds,
            fontSize: group.averageFontSize,
            confidence
          });
        }
      }
    }
  }
  
  // 見出しレベルの調整
  return adjustHeadingLevels(headings);
};

// 見出しの確信度計算
const calculateHeadingConfidence = (group: TextGroup, slideWidth: number, slideHeight: number): number => {
  let confidence = 0;
  
  // フォントサイズによるスコア
  const fontSizeScore = Math.min(group.averageFontSize / 24, 1.0);
  confidence += fontSizeScore * 0.4;
  
  // 配置によるスコア
  if (group.alignment === 'center') {
    confidence += 0.3;
  } else if (group.alignment === 'left') {
    confidence += 0.2;
  }
  
  // 位置によるスコア（上部にあるほど見出しの可能性が高い）
  const positionScore = 1.0 - (group.bounds.y / slideHeight);
  confidence += positionScore * 0.2;
  
  // テキスト長によるスコア（短いほど見出しの可能性が高い）
  const textLength = group.elements.reduce((sum, e) => sum + e.text.length, 0);
  const lengthScore = textLength < 50 ? 1.0 : Math.max(0, 1.0 - (textLength - 50) / 100);
  confidence += lengthScore * 0.1;
  
  return Math.min(confidence, 1.0);
};

// 見出しレベルの調整
const adjustHeadingLevels = (headings: HeadingNode[]): HeadingNode[] => {
  if (headings.length === 0) return headings;
  
  // Y座標でソート
  const sortedHeadings = [...headings].sort((a, b) => a.bounds.y - b.bounds.y);
  
  // フォントサイズに基づいてレベルを割り当て
  const fontSizes = sortedHeadings.map(h => h.fontSize);
  const uniqueSizes = [...new Set(fontSizes)].sort((a, b) => b - a);
  
  const sizeToLevel = new Map<number, number>();
  uniqueSizes.forEach((size, index) => {
    sizeToLevel.set(size, index + 1);
  });
  
  return sortedHeadings.map(heading => ({
    ...heading,
    level: sizeToLevel.get(heading.fontSize) || 1
  }));
};

// リストの検出
const detectLists = (groups: TextGroup[]): ListNode[] => {
  const lists: ListNode[] = [];
  
  for (const group of groups) {
    const listType = detectListType(group);
    if (listType) {
      const items = extractListItems(group, listType);
      if (items.length > 1) {
        lists.push({
          id: `list-${group.id}`,
          type: listType,
          items,
          bounds: group.bounds
        });
      }
    }
  }
  
  return lists;
};

// リストタイプの検出
const detectListType = (group: TextGroup): 'bullet' | 'numbered' | null => {
  const firstElement = group.elements[0];
  if (!firstElement) return null;
  
  const text = firstElement.text.trim();
  
  // 箇条書きのパターン
  const bulletPatterns = [
    /^[\u2022\u2023\u25E6\u2043\u2219]/, // • ‣ ∆ ‣ ∙
    /^[•·]/,
    /^[-*]/,
    /^\s*[-*]\s+/
  ];
  
  // 番号付きリストのパターン
  const numberedPatterns = [
    /^\d+\./,
    /^\d+\)/,
    /^[a-zA-Z]\./,
    /^[a-zA-Z]\)/,
    /^[ivxlcdm]+\./,
    /^[IVXLCDM]+\./
  ];
  
  for (const pattern of bulletPatterns) {
    if (pattern.test(text)) {
      return 'bullet';
    }
  }
  
  for (const pattern of numberedPatterns) {
    if (pattern.test(text)) {
      return 'numbered';
    }
  }
  
  return null;
};

// リスト項目の抽出
const extractListItems = (group: TextGroup, listType: 'bullet' | 'numbered'): ListNode['items'] => {
  const items: ListNode['items'] = [];
  
  for (const element of group.elements) {
    const text = element.text.trim();
    let marker: string | undefined;
    let itemText = text;
    
    if (listType === 'bullet') {
      const bulletMatch = text.match(/^([\u2022\u2023\u25E6\u2043\u2219•·\-*])\s*(.+)$/);
      if (bulletMatch) {
        marker = bulletMatch[1];
        itemText = bulletMatch[2];
      }
    } else {
      const numberedMatch = text.match(/^(\d+[a-zA-Z]?[.)])\s*(.+)$/);
      if (numberedMatch) {
        marker = numberedMatch[1];
        itemText = numberedMatch[2];
      }
    }
    
    items.push({
      id: `item-${Math.random().toString(36).substr(2, 9)}`,
      text: itemText,
      level: 1, // 後で調整
      marker,
      bounds: {
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height
      }
    });
  }
  
  return items;
};

// 表の検出
const detectTables = (groups: TextGroup[]): TableNode[] => {
  const tables: TableNode[] = [];
  
  // グリッド状に配置されたテキストグループを検出
  const gridGroups = findGridGroups(groups);
  
  for (const gridGroup of gridGroups) {
    const table = analyzeTableStructure(gridGroup);
    if (table) {
      tables.push(table);
    }
  }
  
  return tables;
};

// グリッド状のグループを検出
const findGridGroups = (groups: TextGroup[]): TextGroup[] => {
  const gridGroups: TextGroup[] = [];
  
  // 簡単な実装：整列されたグループを検出
  // 実際にはより複雑なアルゴリズムが必要
  const alignedGroups = groups.filter(group => {
    // ある程度の数の要素が含まれているか
    return group.elements.length >= 4;
  });
  
  // 位置関係からグループ化
  // ここでは簡略化した実装
  for (let i = 0; i < alignedGroups.length; i++) {
    const group = alignedGroups[i];
    const nearbyGroups = alignedGroups.filter((other, index) => {
      if (index === i) return false;
      const distance = calculateDistance(group.bounds, other.bounds);
      return distance < 100; // 近接性の閾値
    });
    
    if (nearbyGroups.length >= 2) {
      gridGroups.push(group);
    }
  }
  
  return gridGroups;
};

// 距離の計算
const calculateDistance = (rect1: any, rect2: any): number => {
  const dx = rect1.x - rect2.x;
  const dy = rect1.y - rect2.y;
  return Math.sqrt(dx * dx + dy * dy);
};

// 表構造の分析
const analyzeTableStructure = (group: TextGroup): TableNode | null => {
  // 簡単な実装：2x2の表を想定
  const elements = group.elements;
  if (elements.length < 4) return null;
  
  // 実際にはより複雑なアルゴリズムが必要
  const rows = 2;
  const columns = 2;
  
  const cells = elements.slice(0, rows * columns).map((element, index) => ({
    id: `cell-${Math.random().toString(36).substr(2, 9)}`,
    text: element.text,
    row: Math.floor(index / columns),
    column: index % columns,
    isHeader: Math.floor(index / columns) === 0, // 最初の行をヘッダーとする
    bounds: {
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height
    }
  }));
  
  return {
    id: `table-${group.id}`,
    rows,
    columns,
    cells,
    bounds: group.bounds
  };
};

// 構造の構築
export const buildSlideStructure = (
  textContent: PdfPageTextContent,
  slideId: number
): SlideStructure => {
  const groups = groupTextElements(textContent.runs);
  const headings = detectHeadings(groups, textContent.width, textContent.height);
  const lists = detectLists(groups);
  const tables = detectTables(groups);
  
  // テキスト構造ノードの構築
  const elements: TextStructureNode[] = [];
  
  // 見出しの追加
  headings.forEach((heading, index) => {
    elements.push({
      id: heading.id,
      content: heading.text,
      role: `heading-${Math.min(heading.level, 3)}` as TextElementRole,
      level: heading.level,
      bounds: heading.bounds,
      fontSize: heading.fontSize,
      order: index
    });
  });
  
  // リストの追加
  lists.forEach((list, listIndex) => {
    const listNodeId = `list-node-${list.id}`;
    elements.push({
      id: listNodeId,
      content: '',
      role: list.type === 'bullet' ? 'bullet-list' : 'numbered-list',
      bounds: list.bounds,
      fontSize: 12, // デフォルト値
      order: headings.length + listIndex
    });
    
    // リスト項目の追加
    list.items.forEach((item, itemIndex) => {
      elements.push({
        id: item.id,
        content: item.text,
        role: 'list-item',
        level: item.level,
        bounds: item.bounds,
        fontSize: 12, // デフォルト値
        parent: listNodeId,
        order: itemIndex
      });
    });
  });
  
  // 表の追加
  tables.forEach((table, tableIndex) => {
    const tableNodeId = `table-node-${table.id}`;
    elements.push({
      id: tableNodeId,
      content: '',
      role: 'table-cell',
      bounds: table.bounds,
      fontSize: 12, // デフォルト値
      order: headings.length + lists.length + tableIndex
    });
    
    // 表セルの追加
    table.cells.forEach((cell, cellIndex) => {
      elements.push({
        id: cell.id,
        content: cell.text,
        role: cell.isHeader ? 'table-header' : 'table-cell',
        bounds: cell.bounds,
        fontSize: 12, // デフォルト値
        parent: tableNodeId,
        order: cellIndex
      });
    });
  });
  
  // 段落の追加（見出し、リスト、表に含まれない要素）
  const processedElementIds = new Set([
    ...headings.map(h => h.id),
    ...lists.map(l => l.id),
    ...tables.map(t => t.id)
  ]);
  
  let paragraphIndex = 0;
  groups.forEach((group, groupIndex) => {
    if (!processedElementIds.has(group.id)) {
      elements.push({
        id: `paragraph-${group.id}`,
        content: group.elements.map(e => e.text).join(' '),
        role: 'paragraph',
        bounds: group.bounds,
        fontSize: group.averageFontSize,
        order: headings.length + lists.length + tables.length + paragraphIndex
      });
      paragraphIndex++;
    }
  });
  
  // 階層構造の構築
  const hierarchy = buildHierarchy(elements);
  
  // スライドタイトルの検出
  const title = detectSlideTitle(headings, elements);
  
  return {
    slideId,
    title,
    width: textContent.width,
    height: textContent.height,
    elements,
    hierarchy
  };
};

// 階層構造の構築
const buildHierarchy = (elements: TextStructureNode[]): SlideStructure['hierarchy'] => {
  const root: string[] = [];
  const tree: Record<string, string[]> = {};
  
  // 親子関係の構築
  elements.forEach(element => {
    if (element.parent) {
      if (!tree[element.parent]) {
        tree[element.parent] = [];
      }
      tree[element.parent].push(element.id);
    } else {
      root.push(element.id);
    }
  });
  
  return { root, tree };
};

// スライドタイトルの検出
const detectSlideTitle = (headings: HeadingNode[], elements: TextStructureNode[]): string | undefined => {
  if (headings.length === 0) return undefined;
  
  // 最初の見出しをタイトルとする
  const firstHeading = headings.reduce((prev, current) => 
    prev.bounds.y < current.bounds.y ? prev : current
  );
  
  return firstHeading.text;
};