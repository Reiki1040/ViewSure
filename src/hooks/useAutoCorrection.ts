/**
 * 自動修正フック
 */

import { useState, useEffect, useCallback } from 'react';
import type { Wcag22Issue } from '../types/wcag22';
import type { WcagIssue } from '../utils/wcag/analyzer';

import type {
  CorrectionStrategy,
  CorrectionResult,
  CorrectionPreview,
  AutoCorrectionSettings,
  AutoCorrectionSession,
  CorrectionHistory
} from '../types/autoCorrection';

import {
  generateCorrectionStrategies,
  getAvailableCorrectionTypes
} from '../utils/autoCorrection/strategyEngine';

import {
  applyCorrectionStrategy
} from '../utils/autoCorrection/correctionApplier';

import type { ProjectionAsset } from '../utils/fileLoader';

export const useAutoCorrection = (asset?: ProjectionAsset) => {
  const [issues, setIssues] = useState<(WcagIssue | Wcag22Issue)[]>([]);
  const [strategies, setStrategies] = useState<CorrectionStrategy[]>([]);
  const [selectedStrategies, setSelectedStrategies] = useState<CorrectionStrategy[]>([]);
  const [results, setResults] = useState<CorrectionResult[]>([]);
  const [session, setSession] = useState<AutoCorrectionSession | null>(null);
  const [history, setHistory] = useState<CorrectionHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<AutoCorrectionSettings>({
    autoApplyHighPriority: true,
    autoApplyMediumPriority: false,
    requireConfirmationForDesignChanges: true,
    preserveOriginalDesign: true,
    maxDesignImpact: 7,
    customRules: []
  });
  const [currentPreview, setCurrentPreview] = useState<CorrectionPreview | null>(null);
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);

  // 利用可能な修正タイプを取得
  useEffect(() => {
    const loadAvailableTypes = async () => {
      try {
        const types = await getAvailableCorrectionTypes();
        setAvailableTypes(types);
      } catch (err) {
        console.error('Error loading available correction types:', err);
      }
    };

    loadAvailableTypes();
  }, []);

  // 問題を設定
  const setIssuesForCorrection = useCallback((newIssues: (WcagIssue | Wcag22Issue)[]) => {
    setIssues(newIssues);
  }, []);

  // 修正戦略を生成
  useEffect(() => {
    const generateStrategies = async () => {
      if (issues.length === 0) {
        setStrategies([]);
        return;
      }

      try {
        setLoading(true);
        const correctionStrategies = await generateCorrectionStrategies(issues, settings);
        setStrategies(correctionStrategies);
        setError(null);
      } catch (err) {
        setError('修正戦略の生成に失敗しました');
        console.error('Error generating correction strategies:', err);
      } finally {
        setLoading(false);
      }
    };

    generateStrategies();
  }, [issues, settings]);

  // 戦略を選択/解除
  const toggleStrategy = useCallback((strategy: CorrectionStrategy) => {
    setSelectedStrategies(prev => {
      if (prev.find(s => s.id === strategy.id)) {
        return prev.filter(s => s.id !== strategy.id);
      } else {
        return [...prev, strategy];
      }
    });
  }, []);

  // すべての戦略を選択/解除
  const toggleAllStrategies = useCallback(() => {
    if (selectedStrategies.length === strategies.length) {
      setSelectedStrategies([]);
    } else {
      setSelectedStrategies(strategies);
    }
  }, [strategies, selectedStrategies.length]);

  // 自動適用可能な戦略を選択
  const selectAutoApplicable = useCallback(() => {
    const autoApplicable = strategies.filter(s => s.autoApplicable);
    setSelectedStrategies(autoApplicable);
  }, [strategies]);

  // 修正を適用
  const applyCorrections = useCallback(async () => {
    if (selectedStrategies.length === 0 || !asset) {
      setError('修正戦略を選択してください');
      return;
    }

    try {
      setLoading(true);
      
      // 新しいセッションを作成
      const newSession: AutoCorrectionSession = {
        id: `session-${Date.now()}`,
        projectId: (asset as any)?.id || 'unknown',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'running',
        issues,
        strategies: selectedStrategies,
        results: [],
        summary: {
          totalIssues: issues.length,
          correctedIssues: 0,
          failedCorrections: 0,
          skippedCorrections: 0,
          accessibilityScoreBefore: 0, // 実際の実装ではスコア計算が必要
          accessibilityScoreAfter: 0
        }
      };
      
      setSession(newSession);
      
      const sessionResults: CorrectionResult[] = [];
      
      // 各戦略を適用
      for (const strategy of selectedStrategies) {
        // スライドインデックスを取得（最初の問題から）
        const slideIndex = issues.length > 0 ? issues[0].slideIndex || 0 : 0;
        const result = await applyCorrectionStrategy(strategy, asset, slideIndex);
        sessionResults.push(result);
        
        // 履歴に追加
        const historyItem: CorrectionHistory = {
          id: `history-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          sessionId: newSession.id,
          timestamp: new Date().toISOString(),
          action: strategy.actions[0], // 最初のアクションを記録
          result: result.success ? 'applied' : 'failed',
          reason: result.errors?.join(', ')
        };
        
        setHistory(prev => [...prev, historyItem]);
      }
      
      // セッションを更新
      const successCount = sessionResults.filter(r => r.success).length;
      const failCount = sessionResults.filter(r => !r.success).length;
      
      const updatedSession: AutoCorrectionSession = {
        ...newSession,
        status: 'completed',
        results: sessionResults,
        summary: {
          ...newSession.summary,
          correctedIssues: successCount,
          failedCorrections: failCount
        }
      };
      
      setSession(updatedSession);
      setResults(sessionResults);
      setError(null);
    } catch (err) {
      setError('修正の適用に失敗しました');
      console.error('Error applying corrections:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedStrategies, asset, issues]);

  // プレビューを生成
  const generatePreview = useCallback(async (strategy: CorrectionStrategy) => {
    if (!asset) {
      setError('アセットが指定されていません');
      return;
    }

    try {
      setLoading(true);
      
      // スライドインデックスを取得
      const slideIndex = issues.length > 0 ? issues[0].slideIndex || 0 : 0;
      
      // プレビューを生成（実際の実装では修正前後の画像を生成）
      const preview: CorrectionPreview = {
        id: `preview-${strategy.id}`,
        issueId: strategy.issueType,
        strategy,
        beforePreview: {
          description: `${strategy.issueType}の問題がある現在の状態`
        },
        afterPreview: {
          description: `${strategy.issueType}の問題を修正した後の状態`
        },
        differences: strategy.actions.map(action => action.description)
      };

      setCurrentPreview(preview);
      setError(null);
    } catch (err) {
      setError('プレビューの生成に失敗しました');
      console.error('Error generating preview:', err);
    } finally {
      setLoading(false);
    }
  }, [asset, issues]);

  // 設定を更新
  const updateSettings = useCallback((newSettings: Partial<AutoCorrectionSettings>) => {
    setSettings(prev => ({
      ...prev,
      ...newSettings
    }));
  }, []);

  // セッションをリセット
  const resetSession = useCallback(() => {
    setSession(null);
    setResults([]);
    setSelectedStrategies([]);
    setCurrentPreview(null);
  }, []);

  // 履歴をクリア
  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  // 重大度でフィルタリング
  const filterByPriority = useCallback((priority: 'high' | 'medium' | 'low') => {
    return strategies.filter(s => s.priority === priority);
  }, [strategies]);

  // 重大度ごとの戦略数を取得
  const getPriorityCount = useCallback((priority: 'high' | 'medium' | 'low') => {
    return strategies.filter(s => s.priority === priority).length;
  }, [strategies]);

  // 修正結果のサマリーを取得
  const getResultsSummary = useCallback(() => {
    if (results.length === 0) {
      return {
        total: 0,
        success: 0,
        failed: 0
      };
    }

    const total = results.length;
    const success = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return {
      total,
      success,
      failed
    };
  }, [results]);

  return {
    // 状態
    issues,
    strategies,
    selectedStrategies,
    results,
    session,
    history,
    loading,
    error,
    settings,
    currentPreview,
    availableTypes,
    
    // メソッド
    setIssuesForCorrection,
    toggleStrategy,
    toggleAllStrategies,
    selectAutoApplicable,
    applyCorrections,
    generatePreview,
    updateSettings,
    resetSession,
    clearHistory,
    filterByPriority,
    getPriorityCount,
    getResultsSummary
  };
};