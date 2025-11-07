import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ProjectionAsset } from '../utils/fileLoader';
import type { DocumentStructure, StructureWcagIssues } from '../types/textStructure';
import { buildSlideStructure } from '../utils/pdfStructureAnalyzer';
import { extractPptxStructure } from '../utils/pptxStructureAnalyzer';
import { analyzeStructure } from '../utils/structuredWcagAnalyzer';
import { buildDocumentHierarchy } from '../utils/hierarchyDetector';

type UseTextStructureAnalyzerParams = {
  asset: ProjectionAsset | null;
  onAnalysisComplete?: (structure: DocumentStructure) => void;
  onAnalysisError?: (error: string) => void;
};

export const useTextStructureAnalyzer = ({
  asset,
  onAnalysisComplete,
  onAnalysisError
}: UseTextStructureAnalyzerParams) => {
  const [structure, setStructure] = useState<DocumentStructure | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [wcagIssues, setWcagIssues] = useState<StructureWcagIssues | null>(null);

  // ドキュメント構造の解析
  const analyzeDocumentStructure = useCallback(async () => {
    if (!asset) {
      setStructure(null);
      setAnalysisError(null);
      setWcagIssues(null);
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const slides: DocumentStructure['slides'] = [];
      
      // 各ページの構造を解析
      for (let pageIndex = 0; pageIndex < asset.pageCount; pageIndex++) {
        let slideStructure;
        
        if (asset.type === 'pdf' && asset.getTextContent) {
          // PDFの場合
          const textContent = await asset.getTextContent(pageIndex);
          if (textContent) {
            slideStructure = buildSlideStructure(textContent, pageIndex);
          }
        } else if (asset.type === 'pptx') {
          // PPTXの場合（簡易実装）
          slideStructure = {
            slideId: pageIndex,
            width: 960,
            height: 540,
            elements: [],
            hierarchy: { root: [], tree: {} }
          };
        } else {
          // 画像の場合（テキスト構造なし）
          slideStructure = {
            slideId: pageIndex,
            width: 1920,
            height: 1080,
            elements: [],
            hierarchy: { root: [], tree: {} }
          };
        }

        if (slideStructure) {
          slides.push(slideStructure);
        }
      }

      // グローバル階層を構築
      const globalHierarchy = buildDocumentHierarchy(slides);
      
      const documentStructure: DocumentStructure = {
        pageCount: asset.pageCount,
        slides,
        globalHierarchy
      };

      setStructure(documentStructure);
      
      // WCAG構造問題の解析
      const structureIssues = analyzeStructure(documentStructure);
      setWcagIssues(structureIssues);
      
      onAnalysisComplete?.(documentStructure);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '構造解析に失敗しました';
      setAnalysisError(errorMessage);
      onAnalysisError?.(errorMessage);
    } finally {
      setIsAnalyzing(false);
    }
  }, [asset, onAnalysisComplete, onAnalysisError]);

  // PPTXの完全な構造解析（別途実装）
  const analyzePptxStructure = useCallback(async () => {
    if (!asset || asset.type !== 'pptx') {
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      // PPTXファイルのArrayBufferを取得
      // この実装では、assetから直接ArrayBufferを取得する方法がないため
      // 実際にはfileLoader.tsでArrayBufferを保持する必要がある
      console.warn('PPTX構造解析は完全な実装が必要です');
      
      // ダミーの構造を返す
      const dummyStructure: DocumentStructure = {
        pageCount: asset.pageCount,
        slides: Array.from({ length: asset.pageCount }, (_, index) => ({
          slideId: index,
          width: 960,
          height: 540,
          elements: [],
          hierarchy: { root: [], tree: {} }
        })),
        globalHierarchy: {
          headings: [],
          outline: Array.from({ length: asset.pageCount }, (_, index) => ({
            slideId: index,
            title: `スライド ${index + 1}`,
            level: 1
          }))
        }
      };

      setStructure(dummyStructure);
      onAnalysisComplete?.(dummyStructure);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'PPTX構造解析に失敗しました';
      setAnalysisError(errorMessage);
      onAnalysisError?.(errorMessage);
    } finally {
      setIsAnalyzing(false);
    }
  }, [asset, onAnalysisComplete]);

  // アセットが変更されたら解析を再実行
  useEffect(() => {
    if (asset) {
      if (asset.type === 'pptx') {
        analyzePptxStructure();
      } else {
        analyzeDocumentStructure();
      }
    } else {
      setStructure(null);
      setAnalysisError(null);
      setWcagIssues(null);
    }
  }, [asset, analyzeDocumentStructure, analyzePptxStructure]);

  // 構造の概要を計算
  const structureSummary = useMemo(() => {
    if (!structure) return null;

    const totalElements = structure.slides.reduce((sum, slide) => sum + slide.elements.length, 0);
    const totalHeadings = structure.globalHierarchy.headings.length;
    const totalLists = structure.slides.reduce((sum, slide) => 
      sum + slide.elements.filter(e => e.role === 'bullet-list' || e.role === 'numbered-list').length, 0
    );
    const totalTables = structure.slides.reduce((sum, slide) => 
      sum + slide.elements.filter(e => e.role === 'table-cell').length, 0
    );

    return {
      totalElements,
      totalHeadings,
      totalLists,
      totalTables,
      hasStructure: totalElements > 0
    };
  }, [structure]);

  // WCAG問題の概要を計算
  const wcagSummary = useMemo(() => {
    if (!wcagIssues) return null;

    const totalIssues = wcagIssues.allIssues.length;
    const errorCount = wcagIssues.allIssues.filter(issue => issue.severity === 'error').length;
    const warningCount = wcagIssues.allIssues.filter(issue => issue.severity === 'warning').length;

    return {
      totalIssues,
      errorCount,
      warningCount,
      hasIssues: totalIssues > 0
    };
  }, [wcagIssues]);

  // 特定のスライドの構造を取得
  const getSlideStructure = useCallback((slideId: number) => {
    if (!structure) return null;
    return structure.slides.find(slide => slide.slideId === slideId) || null;
  }, [structure]);

  // 特定の要素を取得
  const getElementById = useCallback((elementId: string) => {
    if (!structure) return null;
    
    for (const slide of structure.slides) {
      const element = slide.elements.find(e => e.id === elementId);
      if (element) return element;
    }
    
    return null;
  }, [structure]);

  // 見出しの一覧を取得
  const getHeadings = useCallback(() => {
    if (!structure) return [];
    return structure.globalHierarchy.headings;
  }, [structure]);

  // アウトラインを取得
  const getOutline = useCallback(() => {
    if (!structure) return [];
    return structure.globalHierarchy.outline;
  }, [structure]);

  return {
    structure,
    isAnalyzing,
    analysisError,
    wcagIssues,
    structureSummary,
    wcagSummary,
    getSlideStructure,
    getElementById,
    getHeadings,
    getOutline,
    analyzeDocumentStructure,
    analyzePptxStructure
  };
};