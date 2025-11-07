import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ProjectionAsset } from '../utils/fileLoader';
import { wcag22Api } from '../api/wcag22Api';
import type { 
  Wcag22Analysis, 
  Wcag22AdjustmentSettings, 
  Wcag22AdjustmentResult,
  ColorBlindnessSimulation
} from '../types/wcag22';

export const useWcag22Helper = ({
  asset,
  targetLevel = 'AA',
  onAnalysisComplete,
  onAdjustmentComplete
}: {
  asset: ProjectionAsset | null;
  targetLevel?: 'A' | 'AA' | 'AAA';
  onAnalysisComplete?: (analysis: Wcag22Analysis) => void;
  onAdjustmentComplete?: (result: Wcag22AdjustmentResult) => void;
}) => {
  const [analysis, setAnalysis] = useState<Wcag22Analysis | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [adjustmentSettings, setAdjustmentSettings] = useState<Wcag22AdjustmentSettings>({
    targetLevel,
    preserveDesign: true,
    colorBlindnessMode: 'none',
    textSpacing: {
      enabled: true,
      strictMode: false
    },
    reflow: {
      enabled: true,
      minWidth: 320
    },
    nonTextContrast: {
      enabled: true,
      minContrast: 3
    }
  });
  const [colorBlindnessSimulation, setColorBlindnessSimulation] = useState<ColorBlindnessSimulation | null>(null);
  const [isSimulatingColorBlindness, setIsSimulatingColorBlindness] = useState(false);
  
  // 分析オプションのメモ化
  const analysisOptions = useMemo(() => ({
    targetLevel,
    includeAAAGuidelines: targetLevel === 'AAA',
    enableColorBlindnessSimulation: adjustmentSettings.colorBlindnessMode !== 'none'
  }), [targetLevel, adjustmentSettings.colorBlindnessMode]);
  
  // ドキュメント分析の実行
  const analyzeDocument = useCallback(async () => {
    if (!asset) {
      setAnalysisError('まず資料を読み込んでください');
      return;
    }
    
    if (isAnalyzing) {
      return;
    }
    
    setIsAnalyzing(true);
    setAnalysisError(null);
    
    try {
      const result = await wcag22Api.analyzeDocument(asset, analysisOptions);
      setAnalysis(result);
      onAnalysisComplete?.(result);
    } catch (error) {
      console.error('WCAG 2.2 分析に失敗しました', error);
      setAnalysisError(error instanceof Error ? error.message : 'WCAG 2.2 分析に失敗しました');
    } finally {
      setIsAnalyzing(false);
    }
  }, [asset, analysisOptions, isAnalyzing, onAnalysisComplete]);
  
  // 調整の適用
  const applyAdjustments = useCallback(async () => {
    if (!analysis) {
      setAnalysisError('WCAG 2.2 分析結果を準備中です…');
      return;
    }
    
    if (isApplying) {
      return;
    }
    
    setIsApplying(true);
    setAnalysisError(null);
    
    try {
      const result = await wcag22Api.applyAdjustments(analysis, adjustmentSettings);
      onAdjustmentComplete?.(result);
      
      // 適用後の分析結果を更新
      if (result.adjustedAsset) {
        const updatedAnalysis = await wcag22Api.analyzeDocument(result.adjustedAsset, analysisOptions);
        setAnalysis(updatedAnalysis);
        onAnalysisComplete?.(updatedAnalysis);
      }
    } catch (error) {
      console.error('WCAG 2.2 調整の適用に失敗しました', error);
      setAnalysisError(error instanceof Error ? error.message : 'WCAG 2.2 調整の適用に失敗しました');
    } finally {
      setIsApplying(false);
    }
  }, [analysis, adjustmentSettings, analysisOptions, isApplying, onAdjustmentComplete]);
  
  // 色覚多様性シミュレーションの実行
  const simulateColorBlindness = useCallback(async (
    simulationType: 'protanopia' | 'deuteranopia' | 'tritanopia'
  ) => {
    if (!asset) {
      setAnalysisError('まず資料を読み込んでください');
      return;
    }
    
    if (isSimulatingColorBlindness) {
      return;
    }
    
    setIsSimulatingColorBlindness(true);
    setAnalysisError(null);
    
    try {
      // 最初のページを取得してシミュレーション
      const source = await asset.getFrame(0);
      const result = await wcag22Api.simulateColorBlindness(source, simulationType);
      setColorBlindnessSimulation(result);
    } catch (error) {
      console.error('色覚多様性シミュレーションに失敗しました', error);
      setAnalysisError(error instanceof Error ? error.message : '色覚多様性シミュレーションに失敗しました');
    } finally {
      setIsSimulatingColorBlindness(false);
    }
  }, [asset, isSimulatingColorBlindness]);
  
  // 調整設定の更新
  const updateAdjustmentSettings = useCallback((newSettings: Partial<Wcag22AdjustmentSettings>) => {
    setAdjustmentSettings(prevSettings => ({
      ...prevSettings,
      ...newSettings
    }));
  }, []);
  
  // 分析結果のクリア
  const clearAnalysis = useCallback(() => {
    setAnalysis(null);
    setAnalysisError(null);
    setColorBlindnessSimulation(null);
  }, []);
  
  // 資料変更時の分析リセット
  useEffect(() => {
    if (!asset) {
      clearAnalysis();
    }
  }, [asset, clearAnalysis]);
  
  // 調整設定の変更時の再分析
  useEffect(() => {
    if (analysis && adjustmentSettings.colorBlindnessMode !== 'none') {
      // 色覚多様性モードが変更された場合、再シミュレーション
      const simulationType = adjustmentSettings.colorBlindnessMode === 'simulate' 
        ? 'protanopia' 
        : adjustmentSettings.colorBlindnessMode === 'compensate' 
          ? 'protanopia' 
          : 'none';
      
      if (simulationType !== 'none') {
        simulateColorBlindness(simulationType as 'protanopia' | 'deuteranopia' | 'tritanopia');
      } else {
        setColorBlindnessSimulation(null);
      }
    }
  }, [adjustmentSettings.colorBlindnessMode, analysis, simulateColorBlindness]);
  
  // 分析結果のサマリー
  const analysisSummary = useMemo(() => {
    if (!analysis) {
      return null;
    }
    
    const { issues, compliance, recommendations } = analysis;
    
    // 問題の種類別集計
    const issueCounts = issues.reduce((counts, issue) => {
      counts[issue.rule] = (counts[issue.rule] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);
    
    // 優先度別集計
    const priorityCounts = recommendations.reduce((counts, rec) => {
      counts[rec.priority] = (counts[rec.priority] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);
    
    return {
      totalIssues: issues.length,
      errorCount: issues.filter(issue => issue.severity === 'error').length,
      warningCount: issues.filter(issue => issue.severity === 'warning').length,
      complianceScore: compliance.score,
      complianceLevel: compliance.level,
      issueCounts,
      priorityCounts,
      topIssues: issues.slice(0, 5),
      hasFixableIssues: issues.some(issue => issue.automatedFix)
    };
  }, [analysis]);
  
  return {
    analysis,
    analysisError,
    isAnalyzing,
    isApplying,
    adjustmentSettings,
    colorBlindnessSimulation,
    isSimulatingColorBlindness,
    analysisSummary,
    analyzeDocument,
    applyAdjustments,
    simulateColorBlindness,
    updateAdjustmentSettings,
    clearAnalysis
  };
};