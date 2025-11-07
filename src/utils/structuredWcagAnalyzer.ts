import type {
  DocumentStructure,
  SlideStructure,
  TextStructureNode,
  StructureWcagIssues,
  HeadingIssue,
  ListIssue,
  ReadingOrderIssue,
  TableIssue
} from '../types/textStructure';

// 構造に基づくWCAGチェック
export const analyzeStructure = (structure: DocumentStructure): StructureWcagIssues => {
  const headingIssues = checkHeadingHierarchy(structure);
  const listIssues = checkListStructure(structure);
  const readingOrderIssues = checkReadingOrder(structure);
  const tableIssues = checkTableStructure(structure);

  const allIssues: StructureWcagIssues['allIssues'] = [
    ...headingIssues,
    ...listIssues,
    ...readingOrderIssues,
    ...tableIssues
  ];

  return {
    headingIssues,
    listIssues,
    readingOrderIssues,
    tableIssues,
    allIssues
  };
};

// 見出し階層のチェック
const checkHeadingHierarchy = (structure: DocumentStructure): HeadingIssue[] => {
  const issues: HeadingIssue[] = [];
  const { headings } = structure.globalHierarchy;

  // 見出しレベルの飛びをチェック
  for (let i = 1; i < headings.length; i++) {
    const current = headings[i];
    const previous = headings[i - 1];

    // 同じスライド内の見出しのみをチェック
    if (current.slideId === previous.slideId) {
      if (current.level > previous.level + 1) {
        issues.push({
          id: `heading-level-skip-${i}`,
          slideId: current.slideId,
          elementId: current.id,
          type: 'heading-hierarchy',
          severity: 'warning',
          message: `見出しレベルが飛んでいます（レベル${previous.level}からレベル${current.level}）`,
          suggestion: `レベル${previous.level + 1}の見出しを追加するか、レベルを${previous.level + 1}に修正してください`,
          currentLevel: current.level,
          expectedLevel: previous.level + 1,
          previousLevel: previous.level
        });
      }

      // 逆順の見出しをチェック
      if (current.level < previous.level) {
        // 同じレベルの見出しが前にあるかチェック
        const hasSameLevelBefore = headings
          .slice(0, i)
          .some(h => h.level === current.level && h.slideId === current.slideId);
        
        if (!hasSameLevelBefore) {
          issues.push({
            id: `heading-reverse-order-${i}`,
            slideId: current.slideId,
            elementId: current.id,
            type: 'heading-hierarchy',
            severity: 'warning',
            message: `見出しレベルが逆順になっています（レベル${previous.level}からレベル${current.level}）`,
            suggestion: '見出しの順序を見直してください',
            currentLevel: current.level,
            previousLevel: previous.level
          });
        }
      }
    }
  }

  // 見出しの重複をチェック
  const headingTexts = new Map<string, number[]>();
  headings.forEach((heading, index) => {
    const text = heading.text.toLowerCase().trim();
    if (!headingTexts.has(text)) {
      headingTexts.set(text, []);
    }
    headingTexts.get(text)!.push(index);
  });

  headingTexts.forEach((indices, text) => {
    if (indices.length > 1) {
      indices.forEach(index => {
        const heading = headings[index];
        issues.push({
          id: `heading-duplicate-${index}`,
          slideId: heading.slideId,
          elementId: heading.id,
          type: 'heading-hierarchy',
          severity: 'warning',
          message: `見出しが重複しています：「${heading.text}」`,
          suggestion: '重複しないように見出しを修正してください',
          currentLevel: heading.level
        });
      });
    }
  });

  return issues;
};

// リスト構造のチェック
const checkListStructure = (structure: DocumentStructure): ListIssue[] => {
  const issues: ListIssue[] = [];

  structure.slides.forEach(slide => {
    const listElements = slide.elements.filter(e => 
      e.role === 'bullet-list' || e.role === 'numbered-list'
    );

    const listItemElements = slide.elements.filter(e => e.role === 'list-item');

    // リスト項目のマーカーの一貫性をチェック
    const bulletLists = listElements.filter(e => e.role === 'bullet-list');
    bulletLists.forEach(list => {
      const listItems = listItemElements.filter(item => item.parent === list.id);
      const markers = new Set<string>();

      listItems.forEach(item => {
        const text = item.content.trim();
        const markerMatch = text.match(/^([•·\-*])\s*/);
        if (markerMatch) {
          markers.add(markerMatch[1]);
        }
      });

      if (markers.size > 1) {
        issues.push({
          id: `list-marker-inconsistency-${list.id}`,
          slideId: slide.slideId,
          elementId: list.id,
          type: 'list-structure',
          severity: 'warning',
          message: '箇条書き記号が一貫していません',
          suggestion: '同じ種類の箇条書き記号を使用してください',
          listType: 'bullet',
          inconsistencyType: 'marker'
        });
      }
    });

    // 番号付きリストの連続性をチェック
    const numberedLists = listElements.filter(e => e.role === 'numbered-list');
    numberedLists.forEach(list => {
      const listItems = listItemElements.filter(item => item.parent === list.id);
      const numbers: number[] = [];

      listItems.forEach(item => {
        const text = item.content.trim();
        const numberMatch = text.match(/^(\d+)\s*/);
        if (numberMatch) {
          numbers.push(parseInt(numberMatch[1], 10));
        }
      });

      for (let i = 1; i < numbers.length; i++) {
        if (numbers[i] !== numbers[i-1] + 1) {
          issues.push({
            id: `list-number-sequence-${list.id}-${i}`,
            slideId: slide.slideId,
            elementId: listItems[i].id,
            type: 'list-structure',
            severity: 'error',
            message: `番号が連続していません（${numbers[i-1]}の次は${numbers[i]}になっています）`,
            suggestion: '番号を連続させてください',
            listType: 'numbered',
            inconsistencyType: 'marker'
          });
        }
      }
    });

    // リストのネスト構造をチェック
    listItemElements.forEach(item => {
      if (item.level && item.level > 3) {
        issues.push({
          id: `list-deep-nesting-${item.id}`,
          slideId: slide.slideId,
          elementId: item.id,
          type: 'list-structure',
          severity: 'warning',
          message: `リストのネストが深すぎます（レベル${item.level}）`,
          suggestion: 'リストのネストは3レベル以内にしてください',
          listType: 'bullet', // デフォルト値
          inconsistencyType: 'nesting'
        });
      }
    });
  });

  return issues;
};

// 読み上げ順序のチェック
const checkReadingOrder = (structure: DocumentStructure): ReadingOrderIssue[] => {
  const issues: ReadingOrderIssue[] = [];

  structure.slides.forEach((slide, slideIndex) => {
    // 視覚的な順序（Y座標、X座標）
    const visualOrder = [...slide.elements]
      .sort((a, b) => {
        const yDiff = a.bounds.y - b.bounds.y;
        if (Math.abs(yDiff) < 20) { // 同じ行とみなす閾値
          return a.bounds.x - b.bounds.x;
        }
        return yDiff;
      })
      .map(e => e.id);

    // 論理的な順序（構造に基づく）
    const logicalOrder = getLogicalReadingOrder(slide.elements);

    // 順序の比較
    const orderMatches = visualOrder.every((id, index) => id === logicalOrder[index]);
    
    if (!orderMatches && visualOrder.length > 1) {
      issues.push({
        id: `reading-order-${slideIndex}`,
        slideId: slide.slideId,
        type: 'reading-order',
        severity: 'warning',
        message: 'テキストの読み上げ順序が視覚的な順序と一致していません',
        suggestion: 'テキスト要素の順序を見直してください',
        visualOrder,
        logicalOrder
      });
    }
  });

  return issues;
};

// 表構造のチェック
const checkTableStructure = (structure: DocumentStructure): TableIssue[] => {
  const issues: TableIssue[] = [];

  structure.slides.forEach(slide => {
    const tableElements = slide.elements.filter(e => e.role === 'table-cell');
    
    if (tableElements.length > 0) {
      // 表のヘッダーの有無をチェック
      const hasHeader = tableElements.some(e => e.role === 'table-header');
      if (!hasHeader) {
        issues.push({
          id: `table-missing-header-${slide.slideId}`,
          slideId: slide.slideId,
          type: 'table-structure',
          severity: 'warning',
          message: '表にヘッダーがありません',
          suggestion: '表の最初の行をヘッダーとしてマークしてください',
          issueType: 'missing-header'
        });
      }

      // 表のキャプションの有無をチェック
      const hasCaption = slide.elements.some(e => e.role === 'caption');
      if (!hasCaption) {
        issues.push({
          id: `table-missing-caption-${slide.slideId}`,
          slideId: slide.slideId,
          type: 'table-structure',
          severity: 'warning',
          message: '表にキャプションがありません',
          suggestion: '表の目的を説明するキャプションを追加してください',
          issueType: 'missing-caption'
        });
      }

      // 表の構造の複雑さをチェック
      const tableCells = tableElements.filter(e => e.role === 'table-cell');
      if (tableCells.length > 20) {
        issues.push({
          id: `table-complex-${slide.slideId}`,
          slideId: slide.slideId,
          type: 'table-structure',
          severity: 'warning',
          message: '表が複雑すぎます（セル数: ${tableCells.length}）',
          suggestion: '表を単純化するか、複数の表に分割してください',
          issueType: 'missing-caption'
        });
      }
    }
  });

  return issues;
};

// 論理的な読み上げ順序の取得
const getLogicalReadingOrder = (elements: TextStructureNode[]): string[] => {
  const visited = new Set<string>();
  const result: string[] = [];
  
  // 階層構造に基づいて順序を決定
  const rootElements = elements.filter(e => !e.parent);
  
  const traverse = (element: TextStructureNode) => {
    if (visited.has(element.id)) return;
    
    visited.add(element.id);
    result.push(element.id);
    
    // 子要素を順序通りに処理
    const children = elements
      .filter(e => e.parent === element.id)
      .sort((a, b) => a.order - b.order);
    
    children.forEach(child => traverse(child));
  };
  
  rootElements
    .sort((a, b) => a.order - b.order)
    .forEach(element => traverse(element));
  
  return result;
};