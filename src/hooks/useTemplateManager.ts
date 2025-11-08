/**
 * テンプレート管理フック
 */

import { useState, useEffect, useCallback } from 'react';
import type { 
  AccessibleTemplate, 
  TemplateMetadata, 
  TemplateFilter, 
  TemplateApplicationOptions,
  TemplateApplicationResult
} from '../types/templates';

import {
  getAvailableTemplates,
  getTemplateById,
  filterTemplates,
  getTemplateCategories,
  getTemplateTags,
  getRecommendedTemplates,
  recordTemplateUsage
} from '../utils/templates/templateManager';

import {
  applyTemplateToProject,
  generateTemplatePreview
} from '../utils/templates/templateApplicator';

import type { ProjectionAsset } from '../utils/fileLoader';

export const useTemplateManager = (asset?: ProjectionAsset) => {
  const [templates, setTemplates] = useState<TemplateMetadata[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<TemplateMetadata[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<AccessibleTemplate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [recommendedTemplates, setRecommendedTemplates] = useState<TemplateMetadata[]>([]);
  const [applying, setApplying] = useState(false);
  const [applicationResult, setApplicationResult] = useState<TemplateApplicationResult | null>(null);

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
        
        // おすすめテンプレートを取得
        const recommended = await getRecommendedTemplates();
        setRecommendedTemplates(recommended);
        
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

  // テンプレートをフィルタリング
  const filterTemplatesCallback = useCallback(async (filter: TemplateFilter) => {
    try {
      setLoading(true);
      const filtered = await filterTemplates(filter);
      setFilteredTemplates(filtered);
      setError(null);
    } catch (err) {
      setError('テンプレートのフィルタリングに失敗しました');
      console.error('Error filtering templates:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // テンプレートを選択
  const selectTemplate = useCallback(async (templateId: string) => {
    try {
      setLoading(true);
      const template = await getTemplateById(templateId);
      if (template) {
        setSelectedTemplate(template);
        await recordTemplateUsage(templateId);
        setError(null);
      } else {
        setError('テンプレートが見つかりませんでした');
      }
    } catch (err) {
      setError('テンプレートの読み込みに失敗しました');
      console.error('Error loading template:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // テンプレートを適用
  const applyTemplate = useCallback(async (
    template: AccessibleTemplate,
    options: TemplateApplicationOptions = {}
  ) => {
    if (!asset) {
      setError('アセットが指定されていません');
      return null;
    }

    try {
      setApplying(true);
      const result = await applyTemplateToProject(template, asset, options);
      setApplicationResult(result);
      
      if (result.success) {
        setError(null);
      } else {
        setError(result.errors?.join(', ') || 'テンプレートの適用に失敗しました');
      }
      
      return result;
    } catch (err) {
      const errorMessage = 'テンプレートの適用に失敗しました';
      setError(errorMessage);
      console.error('Error applying template:', err);
      
      const errorResult: TemplateApplicationResult = {
        success: false,
        appliedSlides: [],
        errors: [errorMessage]
      };
      
      setApplicationResult(errorResult);
      return errorResult;
    } finally {
      setApplying(false);
    }
  }, [asset]);

  // テンプレートプレビューを生成
  const generatePreview = useCallback(async (
    template: AccessibleTemplate,
    slideIndex: number = 0
  ) => {
    try {
      setLoading(true);
      const previewUrl = await generateTemplatePreview(template, slideIndex);
      setError(null);
      return previewUrl;
    } catch (err) {
      setError('プレビューの生成に失敗しました');
      console.error('Error generating preview:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // 選択をクリア
  const clearSelection = useCallback(() => {
    setSelectedTemplate(null);
    setApplicationResult(null);
    setError(null);
  }, []);

  // エラーをクリア
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // 状態
    templates,
    filteredTemplates,
    selectedTemplate,
    loading,
    error,
    categories,
    tags,
    recommendedTemplates,
    applying,
    applicationResult,
    
    // メソッド
    filterTemplates,
    selectTemplate,
    applyTemplate,
    generatePreview,
    clearSelection,
    clearError
  };
};