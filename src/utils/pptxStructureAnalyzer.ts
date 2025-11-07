import type { SlideData, DocumentStructure, SlideStructure, TextStructureNode, TextElementRole } from '../types/textStructure';

// PPTX XMLからテキスト構造を抽出
export const extractPptxStructure = async (buffer: ArrayBuffer): Promise<DocumentStructure> => {
  try {
    // PPTXファイルを解凍
    const zip = await extractZip(buffer);
    
    // スライドファイルを取得
    const slideFiles = Object.keys(zip.files)
      .filter(name => name.startsWith('ppt/slides/slide') && name.endsWith('.xml'))
      .sort((a, b) => {
        const aNum = parseInt(a.match(/slide(\d+)\.xml/)?.[1] || '0', 10);
        const bNum = parseInt(b.match(/slide(\d+)\.xml/)?.[1] || '0', 10);
        return aNum - bNum;
      });

    // マスタースライドを取得
    const masterFiles = Object.keys(zip.files)
      .filter(name => name.startsWith('ppt/slideMasters/slideMaster') && name.endsWith('.xml'));

    // テーマを取得
    const themeFiles = Object.keys(zip.files)
      .filter(name => name.startsWith('ppt/theme/theme') && name.endsWith('.xml'));

    // スライドデータを解析
    const slides: SlideStructure[] = [];
    
    for (let i = 0; i < slideFiles.length; i++) {
      const slideFile = slideFiles[i];
      const slideXml = await zip.files[slideFile].async('string');
      
      const slideData = parseSlideXml(slideXml, i + 1);
      const slideStructure = buildSlideStructureFromData(slideData, i + 1);
      
      slides.push(slideStructure);
    }

    // グローバル階層を構築
    const globalHierarchy = buildGlobalHierarchy(slides);

    return {
      pageCount: slides.length,
      slides,
      globalHierarchy
    };
  } catch (error) {
    console.error('PPTX構造解析エラー:', error);
    throw new Error('PPTXファイルの解析に失敗しました');
  }
};

// ZIPファイルの解凍（簡易実装）
const extractZip = async (buffer: ArrayBuffer): Promise<any> => {
  // 実際にはJSZipなどのライブラリを使用
  // ここでは簡易的な実装
  return new Promise((resolve) => {
    // ダミーのZIPオブジェクト
    resolve({
      files: {}
    });
  });
};

// スライドXMLの解析
const parseSlideXml = (xmlString: string, slideId: number): SlideData => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');
  
  const elements: SlideData['elements'] = [];
  let title: string | undefined;

  // テキストボックスを解析
  const textBoxes = doc.querySelectorAll('a:t');
  textBoxes.forEach(textBox => {
    const text = textBox.textContent || '';
    if (text.trim()) {
      const parent = textBox.closest('p:sp') as Element;
      const placeholder = parent?.querySelector('p:nvSpPr>p:nvPr')?.getAttribute('type');
      
      // バウンズ情報を取得
      const xfrm = parent?.querySelector('a:xfrm');
      const off = xfrm?.querySelector('a:off');
      const ext = xfrm?.querySelector('a:ext');
      
      const bounds = {
        x: parseInt(off?.getAttribute('x') || '0', 10),
        y: parseInt(off?.getAttribute('y') || '0', 10),
        width: parseInt(ext?.getAttribute('cx') || '0', 10),
        height: parseInt(ext?.getAttribute('cy') || '0', 10)
      };

      // フォント情報を取得
      const runProps = textBox.closest('a:r')?.querySelector('a:rPr');
      const fontSize = runProps?.querySelector('a:sz')?.getAttribute('val');
      const fontFamily = runProps?.querySelector('a:latin')?.getAttribute('typeface') ||
                       runProps?.querySelector('a:cs')?.getAttribute('typeface');

      // プレースホルダーの種類を判定
      const role = determineElementRole(placeholder, text, bounds);

      elements.push({
        id: `element-${elements.length}`,
        type: role,
        text,
        placeholderType: placeholder || undefined,
        bounds,
        fontSize: fontSize ? parseInt(fontSize, 10) / 100 : undefined, // PPTXは100倍の値
        fontFamily: fontFamily || undefined,
        level: determineElementLevel(placeholder, role)
      });

      // タイトルを検出
      if (placeholder === 'title' && !title) {
        title = text;
      }
    }
  });

  return {
    id: `slide-${slideId}`,
    title,
    elements
  };
};

// 要素の役割を判定
const determineElementRole = (
  placeholder?: string | null,
  text?: string,
  bounds?: any
): TextElementRole => {
  // プレースホルダーに基づく判定
  if (placeholder) {
    switch (placeholder) {
      case 'title':
        return 'title';
      case 'ctrTitle':
        return 'heading-1';
      case 'subtitle':
        return 'heading-2';
      case 'body':
        return 'paragraph';
      case 'ctrBody':
        return 'paragraph';
      case 'content':
        return 'paragraph';
      case 'dt':
        return 'list-item';
      case 'footer':
        return 'footer';
      default:
        break;
    }
  }

  // テキスト内容に基づく判定
  if (text) {
    // 見出しパターン
    if (text.length < 50 && (
      /^\d+\./.test(text) ||
      /^[第一二三四五六七八九十]+[章節]/.test(text) ||
      /^[A-Z][A-Z\s]*$/.test(text)
    )) {
      return 'heading-1';
    }

    // リストパターン
    if (/^[\u2022\u2023\u25E6\u2043\u2219•·\-*]\s*/.test(text) ||
        /^\d+\./.test(text)) {
      return 'list-item';
    }
  }

  // 位置とサイズに基づく判定
  if (bounds) {
    // 中央に配置された大きなテキストは見出しの可能性が高い
    if (bounds.y < 100 && bounds.width > 300) {
      return 'title';
    }
  }

  return 'paragraph';
};

// 要素のレベルを判定
const determineElementLevel = (
  placeholder?: string | null,
  role?: TextElementRole
): number => {
  if (placeholder) {
    switch (placeholder) {
      case 'title':
        return 1;
      case 'ctrTitle':
        return 1;
      case 'subtitle':
        return 2;
      case 'body':
      case 'ctrBody':
        return 3;
      default:
        return 1;
    }
  }

  if (role) {
    switch (role) {
      case 'title':
        return 1;
      case 'heading-1':
        return 1;
      case 'heading-2':
        return 2;
      case 'heading-3':
        return 3;
      default:
        return 1;
    }
  }

  return 1;
};

// スライドデータからスライド構造を構築
const buildSlideStructureFromData = (slideData: SlideData, slideId: number): SlideStructure => {
  const elements: TextStructureNode[] = [];
  const hierarchy: SlideStructure['hierarchy'] = {
    root: [],
    tree: {}
  };

  // 要素を変換
  slideData.elements.forEach((element, index) => {
    const textNode: TextStructureNode = {
      id: element.id,
      content: element.text,
      role: element.type as TextElementRole,
      level: element.level,
      bounds: element.bounds,
      fontSize: element.fontSize || 12,
      fontFamily: element.fontFamily,
      order: index,
      metadata: {
        pageNumber: slideId
      }
    };

    elements.push(textNode);

    // 階層構造を構築
    if (!element.placeholderType || element.placeholderType === 'title') {
      hierarchy.root.push(element.id);
    } else {
      // 親要素を検索（簡易的な実装）
      const parentElement = slideData.elements.find(e => 
        e.placeholderType === 'body' && e.id !== element.id
      );
      
      if (parentElement) {
        if (!hierarchy.tree[parentElement.id]) {
          hierarchy.tree[parentElement.id] = [];
        }
        hierarchy.tree[parentElement.id].push(element.id);
        textNode.parent = parentElement.id;
      } else {
        hierarchy.root.push(element.id);
      }
    }
  });

  return {
    slideId,
    title: slideData.title,
    width: 960, // PPTXの標準サイズ
    height: 540,
    elements,
    hierarchy
  };
};

// グローバル階層を構築
const buildGlobalHierarchy = (slides: SlideStructure[]): DocumentStructure['globalHierarchy'] => {
  const headings: DocumentStructure['globalHierarchy']['headings'] = [];
  const outline: DocumentStructure['globalHierarchy']['outline'] = [];

  slides.forEach((slide, slideIndex) => {
    // スライドの見出しを収集
    const slideHeadings = slide.elements.filter(e => 
      e.role === 'title' || e.role.startsWith('heading-')
    );

    slideHeadings.forEach(heading => {
      const level = heading.role === 'title' ? 1 : 
                   parseInt(heading.role.split('-')[1]) || 1;

      headings.push({
        slideId: slide.slideId,
        level,
        text: heading.content,
        id: heading.id
      });
    });

    // アウトラインを構築
    outline.push({
      slideId: slide.slideId,
      title: slide.title || `スライド ${slideIndex + 1}`,
      level: slideHeadings.length > 0 ? 
             Math.min(...slideHeadings.map(h => 
               h.role === 'title' ? 1 : parseInt(h.role.split('-')[1]) || 1
             )) : 1
    });
  });

  return {
    headings,
    outline
  };
};