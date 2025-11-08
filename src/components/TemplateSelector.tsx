/**
 * テンプレート選択コンポーネント
 */

import React, { useState, useEffect } from 'react';
import type { 
  AccessibleTemplate, 
  TemplateMetadata, 
  TemplateFilter, 
  TemplateCategory 
} from '../types/templates';

import {
  getAvailableTemplates,
  filterTemplates,
  getTemplateCategories,
  getTemplateTags,
  getTemplateById,
  recordTemplateUsage
} from '../utils/templates/templateManager';

interface TemplateSelectorProps {
  onTemplateSelect: (template: AccessibleTemplate) => void;
  onClose: () => void;
  initialFilter?: TemplateFilter;
}

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  onTemplateSelect,
  onClose,
  initialFilter = {}
}) => {
  const [templates, setTemplates] = useState<TemplateMetadata[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<TemplateMetadata[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<AccessibleTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TemplateFilter>(initialFilter);
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState(initialFilter.searchQuery || '');
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | undefined>(initialFilter.category);
  const [selectedTags, setSelectedTags] = useState<string[]>(initialFilter.tags || []);

  // テンプレートデータを読み込む
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        setLoading(true);
        const templateData = await getAvailableTemplates();
        setTemplates(templateData);
        setFilteredTemplates(templateData);
        
        const categoryData = await getTemplateCategories();
        setCategories(categoryData);
        
        const tagData = await getTemplateTags();
        setTags(tagData);
        
        setError(null);
      } catch (err) {
        setError('テンプレートの読み込みに失敗しました');
        console.error('Error loading templates:', err);
      } finally {
        setLoading(false);
      }
    };

    loadTemplates();
  }, []);

  // フィルターが変更されたらテンプレートを再フィルタリング
  useEffect(() => {
    const applyFilter = async () => {
      const updatedFilter = {
        ...filter,
        searchQuery: searchQuery || undefined,
        category: selectedCategory,
        tags: selectedTags.length > 0 ? selectedTags : undefined
      };
      
      const filtered = await filterTemplates(updatedFilter);
      setFilteredTemplates(filtered);
    };

    applyFilter();
  }, [searchQuery, selectedCategory, selectedTags, templates]);

  // テンプレートを選択
  const handleTemplateSelect = async (templateMetadata: TemplateMetadata) => {
    try {
      const fullTemplate = await getTemplateById(templateMetadata.id);
      if (fullTemplate) {
        setSelectedTemplate(fullTemplate);
        await recordTemplateUsage(templateMetadata.id);
      }
    } catch (err) {
      setError('テンプレートの読み込みに失敗しました');
      console.error('Error loading template:', err);
    }
  };

  // テンプレートを適用
  const handleApplyTemplate = () => {
    if (selectedTemplate) {
      onTemplateSelect(selectedTemplate);
      onClose();
    }
  };

  // カテゴリでフィルタリング
  const handleCategoryChange = (category: TemplateCategory | undefined) => {
    setSelectedCategory(category);
  };

  // タグでフィルタリング
  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev => {
      if (prev.includes(tag)) {
        return prev.filter(t => t !== tag);
      } else {
        return [...prev, tag];
      }
    });
  };

  // 検索クエリを更新
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
  };

  // フィルターをリセット
  const resetFilters = () => {
    setSearchQuery('');
    setSelectedCategory(undefined);
    setSelectedTags([]);
  };

  if (loading) {
    return (
      <div className="template-selector loading">
        <div className="loading-spinner"></div>
        <p>テンプレートを読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="template-selector error">
        <div className="error-message">
          <h3>エラーが発生しました</h3>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>
            再読み込み
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="template-selector">
      <div className="template-selector-header">
        <h2>アクセシブルテンプレートを選択</h2>
        <button className="close-button" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="template-selector-content">
        {/* 検索とフィルター */}
        <div className="template-filters">
          <div className="search-box">
            <input
              type="text"
              placeholder="テンプレートを検索..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="filter-categories">
            <label>カテゴリ:</label>
            <select
              value={selectedCategory || ''}
              onChange={(e) => handleCategoryChange(e.target.value as TemplateCategory | undefined)}
              className="category-select"
            >
              <option value="">すべて</option>
              {categories.map(category => (
                <option key={category} value={category}>
                  {getCategoryDisplayName(category)}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-tags">
            <label>タグ:</label>
            <div className="tag-list">
              {tags.map(tag => (
                <button
                  key={tag}
                  className={`tag-button ${selectedTags.includes(tag) ? 'selected' : ''}`}
                  onClick={() => handleTagToggle(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <button className="reset-filters" onClick={resetFilters}>
            フィルターをリセット
          </button>
        </div>

        {/* テンプレート一覧 */}
        <div className="template-list">
          {filteredTemplates.length === 0 ? (
            <div className="no-results">
              <p>条件に一致するテンプレートがありません</p>
            </div>
          ) : (
            filteredTemplates.map(template => (
              <div
                key={template.id}
                className={`template-item ${selectedTemplate?.id === template.id ? 'selected' : ''}`}
                onClick={() => handleTemplateSelect(template)}
              >
                <div className="template-preview">
                  <img
                    src={template.preview}
                    alt={`${template.name}のプレビュー`}
                    className="template-image"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <div className="template-placeholder">
                    {template.name.charAt(0)}
                  </div>
                </div>
                
                <div className="template-info">
                  <h3 className="template-name">{template.name}</h3>
                  <p className="template-description">{template.description}</p>
                  
                  <div className="template-meta">
                    <span className="template-category">
                      {getCategoryDisplayName(template.category)}
                    </span>
                    <span className="template-slides">
                      {template.slideCount}スライド
                    </span>
                    <span className={`template-wcag wcag-${template.wcagLevel.toLowerCase()}`}>
                      WCAG {template.wcagLevel}
                    </span>
                  </div>
                  
                  <div className="template-tags">
                    {template.tags.map(tag => (
                      <span key={tag} className="template-tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* フッター */}
      <div className="template-selector-footer">
        <div className="selected-info">
          {selectedTemplate ? (
            <div>
              <strong>選択中:</strong> {selectedTemplate.name}
            </div>
          ) : (
            <div>テンプレートを選択してください</div>
          )}
        </div>
        
        <div className="action-buttons">
          <button
            className="cancel-button"
            onClick={onClose}
          >
            キャンセル
          </button>
          <button
            className="apply-button"
            onClick={handleApplyTemplate}
            disabled={!selectedTemplate}
          >
            適用
          </button>
        </div>
      </div>
    </div>
  );
};

// ヘルパー関数
const getCategoryDisplayName = (category: TemplateCategory): string => {
  switch (category) {
    case 'academic':
      return '学術';
    case 'business':
      return 'ビジネス';
    case 'education':
      return '教育';
    case 'general':
      return '汎用';
    default:
      return category;
  }
};