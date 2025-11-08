/**
 * テンプレート管理ユーティリティ
 */

import type { 
  AccessibleTemplate, 
  TemplateMetadata, 
  TemplateFilter, 
  TemplateCategory 
} from '../../types/templates';

// テンプレートデータのキャッシュ
let templateCache: Map<string, AccessibleTemplate> | null = null;
let metadataCache: Map<string, TemplateMetadata> | null = null;

/**
 * 利用可能なテンプレートのメタデータを取得する
 */
export const getAvailableTemplates = async (): Promise<TemplateMetadata[]> => {
  if (metadataCache) {
    return Array.from(metadataCache.values());
  }

  try {
    const templateFiles = [
      'academic.json',
      'business.json',
      'education.json',
      'general.json'
    ];

    const templates: TemplateMetadata[] = [];

    for (const file of templateFiles) {
      try {
        const response = await fetch(`/data/templates/${file}`);
        if (!response.ok) {
          console.warn(`Failed to load template: ${file}`);
          continue;
        }

        const template: AccessibleTemplate = await response.json();
        
        const metadata: TemplateMetadata = {
          id: template.id,
          name: template.name,
          description: template.description,
          category: template.category,
          preview: template.preview,
          tags: template.tags,
          author: template.author,
          version: template.version,
          slideCount: template.slides.length,
          wcagLevel: template.wcagCompliance.level,
          createdAt: template.createdAt,
          updatedAt: template.updatedAt
        };

        templates.push(metadata);
      } catch (error) {
        console.error(`Error loading template ${file}:`, error);
      }
    }

    metadataCache = new Map(templates.map(t => [t.id, t]));
    return templates;
  } catch (error) {
    console.error('Error loading templates:', error);
    return [];
  }
};

/**
 * テンプレートをIDで取得する
 */
export const getTemplateById = async (id: string): Promise<AccessibleTemplate | null> => {
  if (templateCache && templateCache.has(id)) {
    return templateCache.get(id) || null;
  }

  try {
    const templates = await getAvailableTemplates();
    const template = templates.find(t => t.id === id);
    
    if (!template) {
      return null;
    }

    // 完全なテンプレートデータを取得
    const response = await fetch(`/data/templates/${id}.json`);
    if (!response.ok) {
      throw new Error(`Failed to load template: ${id}`);
    }

    const fullTemplate: AccessibleTemplate = await response.json();
    
    if (!templateCache) {
      templateCache = new Map();
    }
    templateCache.set(id, fullTemplate);
    
    return fullTemplate;
  } catch (error) {
    console.error(`Error loading template ${id}:`, error);
    return null;
  }
};

/**
 * テンプレートをフィルタリングする
 */
export const filterTemplates = async (
  filter: TemplateFilter
): Promise<TemplateMetadata[]> => {
  const templates = await getAvailableTemplates();

  return templates.filter(template => {
    // カテゴリでフィルタリング
    if (filter.category && template.category !== filter.category) {
      return false;
    }

    // WCAGレベルでフィルタリング
    if (filter.wcagLevel && template.wcagLevel !== filter.wcagLevel) {
      return false;
    }

    // タグでフィルタリング
    if (filter.tags && filter.tags.length > 0) {
      const hasAllTags = filter.tags.every(tag => 
        template.tags.some(templateTag => 
          templateTag.toLowerCase().includes(tag.toLowerCase())
        )
      );
      if (!hasAllTags) {
        return false;
      }
    }

    // 作者でフィルタリング
    if (filter.author && !template.author.toLowerCase().includes(filter.author.toLowerCase())) {
      return false;
    }

    // 検索クエリでフィルタリング
    if (filter.searchQuery) {
      const query = filter.searchQuery.toLowerCase();
      const searchableText = [
        template.name,
        template.description,
        template.tags.join(' '),
        template.author
      ].join(' ').toLowerCase();
      
      if (!searchableText.includes(query)) {
        return false;
      }
    }

    return true;
  });
};

/**
 * テンプレートのカテゴリ一覧を取得する
 */
export const getTemplateCategories = async (): Promise<TemplateCategory[]> => {
  const templates = await getAvailableTemplates();
  const categories = new Set<TemplateCategory>();
  
  templates.forEach(template => {
    categories.add(template.category);
  });
  
  return Array.from(categories);
};

/**
 * テンプレートのタグ一覧を取得する
 */
export const getTemplateTags = async (): Promise<string[]> => {
  const templates = await getAvailableTemplates();
  const tags = new Set<string>();
  
  templates.forEach(template => {
    template.tags.forEach(tag => {
      tags.add(tag);
    });
  });
  
  return Array.from(tags).sort();
};

/**
 * テンプレートを検証する
 */
export const validateTemplate = (template: AccessibleTemplate): boolean => {
  // 必須フィールドのチェック
  if (!template.id || !template.name || !template.category) {
    return false;
  }

  // スライドのチェック
  if (!template.slides || template.slides.length === 0) {
    return false;
  }

  // 各スライドの検証
  for (const slide of template.slides) {
    if (!slide.id || !slide.name || !slide.layout) {
      return false;
    }

    // レイアウトの検証
    const layout = slide.layout;
    if (!layout.id || !layout.name || !layout.elements) {
      return false;
    }

    // 各要素の検証
    for (const element of layout.elements) {
      if (!element.id || !element.type || !element.position) {
        return false;
      }

      // 位置情報の検証
      const pos = element.position;
      if (typeof pos.x !== 'number' || typeof pos.y !== 'number' ||
          typeof pos.width !== 'number' || typeof pos.height !== 'number') {
        return false;
      }

      // アクセシビリティ情報の検証
      if (!element.accessibility || !element.accessibility.role) {
        return false;
      }
    }
  }

  // WCAGコンプライアンス情報の検証
  if (!template.wcagCompliance || !template.wcagCompliance.level) {
    return false;
  }

  return true;
};

/**
 * テンプレートのプレビューURLを生成する
 */
export const getTemplatePreviewUrl = (templateId: string): string => {
  return `/templates/previews/${templateId}.png`;
};

/**
 * テンプレートキャッシュをクリアする
 */
export const clearTemplateCache = (): void => {
  templateCache = null;
  metadataCache = null;
};

/**
 * テンプレートの使用統計を記録する（将来の機能拡張用）
 */
export const recordTemplateUsage = async (templateId: string): Promise<void> => {
  try {
    // 将来的には分析データをサーバーに送信
    console.log(`Template usage recorded: ${templateId}`);
  } catch (error) {
    console.error('Error recording template usage:', error);
  }
};

/**
 * テンプレートのおすすめを取得する
 */
export const getRecommendedTemplates = async (
  category?: TemplateCategory,
  limit: number = 3
): Promise<TemplateMetadata[]> => {
  const templates = await getAvailableTemplates();
  
  let filteredTemplates = templates;
  
  if (category) {
    filteredTemplates = templates.filter(t => t.category === category);
  }

  // 更新日時の新しい順にソート
  filteredTemplates.sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return filteredTemplates.slice(0, limit);
};