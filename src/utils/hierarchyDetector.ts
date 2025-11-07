import type {
  TextStructureNode,
  SlideStructure,
  DocumentStructure,
  HeadingHierarchy,
  ListHierarchy,
  HeadingIssue,
  ListIssue,
  ReadingOrderIssue
} from '../types/textStructure';

// 見出し階層の検出
export const detectHeadingHierarchy = (slides: SlideStructure[]): HeadingHierarchy => {
  const allHeadings: Array<{
    slideId: number;
    node: TextStructureNode;
  }> = [];

  // すべての見出しを収集
  slides.forEach(slide => {
    slide.elements.forEach(element => {
      if (element.role.startsWith('heading-')) {
        allHeadings.push({
          slideId: slide.slideId,
          node: element
        });
      }
    });
  });

  // スライドIDとY座標でソート
  allHeadings.sort((a, b) => {
    if (a.slideId !== b.slideId) {
      return a.slideId - b.slideId;
    }
    return a.node.bounds.y - b.node.bounds.y;
  });

  // 見出しレベルの分析
  const levels = new Map<number, typeof allHeadings>();
  const issues: HeadingIssue[] = [];

  allHeadings.forEach((heading, index) => {
    const level = parseInt(heading.node.role.split('-')[1]) || 1;
    
    if (!levels.has(level)) {
      levels.set(level, []);
    }
    levels.get(level)!.push(heading);

    // 見出し階層の問題を検出
    if (index > 0) {
      const prevHeading = allHeadings[index - 1];
      const prevLevel = parseInt(prevHeading.node.role.split('-')[1]) || 1;
      
      // レベルの飛びを検出
      if (level > prevLevel + 1) {
        issues.push({
          id: `heading-issue-${index}`,
          slideId: heading.slideId,
          elementId: heading.node.id,
          type: 'heading-hierarchy',
          severity: 'warning',
          message: `見出しレベルが飛んでいます（レベル${prevLevel}からレベル${level}）`,
          suggestion: `レベル${prevLevel + 1}の見出しを追加するか、レベルを${prevLevel + 1}に修正してください`,
          currentLevel: level,
          expectedLevel: prevLevel + 1,
          previousLevel: prevLevel
        });
      }
      
      // 逆順の見出しを検出
      if (level < prevLevel) {
        // 同じレベルの見出しが前にあるかチェック
        const hasSameLevelBefore = allHeadings
          .slice(0, index)
          .some(h => parseInt(h.node.role.split('-')[1]) === level);
        
        if (!hasSameLevelBefore) {
          issues.push({
            id: `heading-issue-${index}-reverse`,
            slideId: heading.slideId,
            elementId: heading.node.id,
            type: 'heading-hierarchy',
            severity: 'warning',
            message: `見出しレベルが逆順になっています（レベル${prevLevel}からレベル${level}）`,
            suggestion: `見出しの順序を見直してください`,
            currentLevel: level,
            previousLevel: prevLevel
          });
        }
      }
    }
  });

  // レベルごとの見出しを整理
  const sortedLevels = Array.from(levels.keys()).sort((a, b) => a - b);
  const headingLevels = sortedLevels.map(level => ({
    level,
    headings: levels.get(level)!.map(h => ({
      id: h.node.id,
      text: h.node.content,
      level: parseInt(h.node.role.split('-')[1]) || 1,
      bounds: h.node.bounds,
      fontSize: h.node.fontSize,
      confidence: 0.8 // デフォルト値
    }))
  }));

  return {
    levels: headingLevels,
    issues
  };
};

// リスト階層の検出
export const detectListHierarchy = (slides: SlideStructure[]): ListHierarchy => {
  const allLists: Array<{
    slideId: number;
    node: TextStructureNode;
  }> = [];

  // すべてのリストを収集
  slides.forEach(slide => {
    slide.elements.forEach(element => {
      if (element.role === 'bullet-list' || element.role === 'numbered-list') {
        allLists.push({
          slideId: slide.slideId,
          node: element
        });
      }
    });
  });

  // リスト項目を収集
  const allListItems: Array<{
    slideId: number;
    node: TextStructureNode;
    parentNode?: TextStructureNode;
  }> = [];

  slides.forEach(slide => {
    slide.elements.forEach(element => {
      if (element.role === 'list-item') {
        const parentNode = slide.elements.find(e => e.id === element.parent);
        allListItems.push({
          slideId: slide.slideId,
          node: element,
          parentNode
        });
      }
    });
  });

  // リストの階層構造を分析
  const lists = allLists.map(list => ({
    id: list.node.id,
    type: list.node.role === 'bullet-list' ? 'bullet' as const : 'numbered' as const,
    items: allListItems
      .filter(item => item.parentNode?.id === list.node.id)
      .map(item => ({
        id: item.node.id,
        text: item.node.content,
        level: item.node.level || 1,
        bounds: item.node.bounds
      })),
    bounds: list.node.bounds
  }));

  // ネスト構造の分析
  const nestingStructure: Array<{
    parentId: string;
    childIds: string[];
  }> = [];

  allListItems.forEach(item => {
    if (item.node.level && item.node.level > 1) {
      // 親リスト項目を検索
      const potentialParents = allListItems.filter(parentItem =>
        parentItem.node.level === item.node.level! - 1 &&
        parentItem.slideId === item.slideId &&
        parentItem.node.bounds.y < item.node.bounds.y
      );
      
      if (potentialParents.length > 0) {
        // 最も近い親を選択
        const parent = potentialParents.reduce((nearest, current) => {
          const nearestDist = item.node.bounds.y - nearest.node.bounds.y;
          const currentDist = item.node.bounds.y - current.node.bounds.y;
          return currentDist < nearestDist ? current : nearest;
        });
        
        nestingStructure.push({
          parentId: parent.node.id,
          childIds: [item.node.id]
        });
      }
    }
  });

  // リスト構造の問題を検出
  const issues: ListIssue[] = [];

  // リスト記号の一貫性チェック
  const listTypeGroups = new Map<string, typeof allListItems>();
  allListItems.forEach(item => {
    const listType = item.parentNode?.role || 'unknown';
    if (!listTypeGroups.has(listType)) {
      listTypeGroups.set(listType, []);
    }
    listTypeGroups.get(listType)!.push(item);
  });

  listTypeGroups.forEach((items, listType) => {
    if (listType === 'bullet-list') {
      // 箇条書き記号の一貫性チェック
      const markers = new Set<string>();
      items.forEach(item => {
        const text = item.node.content;
        const marker = text.match(/^([•·\-*])\s*/)?.[1];
        if (marker) {
          markers.add(marker);
        }
      });
      
      if (markers.size > 1) {
        issues.push({
          id: `list-marker-consistency-${listType}`,
          slideId: items[0].slideId,
          type: 'list-structure',
          severity: 'warning',
          message: '箇条書き記号が一貫していません',
          suggestion: '同じ種類の箇条書き記号を使用してください',
          listType: 'bullet',
          inconsistencyType: 'marker'
        });
      }
    } else if (listType === 'numbered-list') {
      // 番号付きリストの連続性チェック
      const numbers = items.map(item => {
        const match = item.node.content.match(/^(\d+)\s*/);
        return match ? parseInt(match[1]) : 0;
      }).filter(n => n > 0);
      
      for (let i = 1; i < numbers.length; i++) {
        if (numbers[i] !== numbers[i-1] + 1) {
          issues.push({
            id: `list-number-sequence-${listType}-${i}`,
            slideId: items[i].slideId,
            elementId: items[i].node.id,
            type: 'list-structure',
            severity: 'error',
            message: `番号が連続していません（${numbers[i-1]}の次は${numbers[i]}になっています）`,
            suggestion: '番号を連続させてください',
            listType: 'numbered',
            inconsistencyType: 'marker'
          });
        }
      }
    }
  });

  // インデントの一貫性チェック
  allListItems.forEach(item => {
    if (item.node.level && item.node.level > 1) {
      const sameLevelItems = allListItems.filter(otherItem =>
        otherItem.node.level === item.node.level &&
        otherItem.slideId === item.slideId
      );
      
      if (sameLevelItems.length > 1) {
        const xPositions = sameLevelItems.map(i => i.node.bounds.x);
        const avgX = xPositions.reduce((sum, x) => sum + x, 0) / xPositions.length;
        const variance = xPositions.reduce((sum, x) => sum + Math.pow(x - avgX, 2), 0) / xPositions.length;
        
        // 位置のばらつきが大きい場合
        if (variance > 100) {
          issues.push({
            id: `list-indent-inconsistency-${item.node.id}`,
            slideId: item.slideId,
            elementId: item.node.id,
            type: 'list-structure',
            severity: 'warning',
            message: 'リスト項目のインデントが一貫していません',
            suggestion: '同じレベルのリスト項目は同じ位置に揃えてください',
            listType: item.parentNode?.role === 'bullet-list' ? 'bullet' : 'numbered',
            inconsistencyType: 'indentation'
          });
        }
      }
    }
  });

  return {
    lists,
    nestingStructure,
    issues
  };
};

// 全体の階層構造を構築
export const buildDocumentHierarchy = (slides: SlideStructure[]): DocumentStructure['globalHierarchy'] => {
  const headingHierarchy = detectHeadingHierarchy(slides);
  const listHierarchy = detectListHierarchy(slides);
  
  // 見出しの階層を構築
  const headings = headingHierarchy.levels.flatMap(level =>
    level.headings.map(heading => ({
      slideId: slides.findIndex(s => s.elements.some(e => e.id === heading.id)) + 1,
      level: heading.level,
      text: heading.text,
      id: heading.id
    }))
  );

  // アウトラインを構築
  const outline = slides.map((slide, index) => ({
    slideId: index + 1,
    title: slide.title || `スライド ${index + 1}`,
    level: 1 // デフォルトレベル
  }));

  // スライドの見出しに基づいてアウトラインのレベルを調整
  slides.forEach((slide, slideIndex) => {
    const slideHeadings = slide.elements.filter(e => e.role.startsWith('heading-'));
    if (slideHeadings.length > 0) {
      const firstHeading = slideHeadings.reduce((prev, current) =>
        prev.bounds.y < current.bounds.y ? prev : current
      );
      const level = parseInt(firstHeading.role.split('-')[1]) || 1;
      outline[slideIndex].level = Math.min(level, 3);
    }
  });

  return {
    headings,
    outline
  };
};

// 読み上げ順序のチェック
export const checkReadingOrder = (slides: SlideStructure[]): ReadingOrderIssue[] => {
  const issues: ReadingOrderIssue[] = [];

  slides.forEach((slide, slideIndex) => {
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
    const logicalOrder = getLogicalOrder(slide.elements);

    // 順序の比較
    const orderMatches = visualOrder.every((id, index) => id === logicalOrder[index]);
    
    if (!orderMatches) {
      issues.push({
        id: `reading-order-${slideIndex}`,
        slideId: slideIndex + 1,
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

// 論理的な順序の取得
const getLogicalOrder = (elements: TextStructureNode[]): string[] => {
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