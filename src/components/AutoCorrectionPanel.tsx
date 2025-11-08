/**
 * 自動修正パネルコンポーネント
 */

import React, { useState, useEffect } from 'react';
import type { Wcag22Issue } from '../types/wcag22';
import type { WcagIssue } from '../utils/wcag/analyzer';

import type {
  CorrectionStrategy,
  CorrectionResult,
  CorrectionPreview,
  AutoCorrectionSettings,
  AutoCorrectionSession
} from '../types/autoCorrection';

import {
  generateCorrectionStrategies,
  getAvailableCorrectionTypes
} from '../utils/autoCorrection/strategyEngine';

import {
  applyCorrectionStrategy
} from '../utils/autoCorrection/correctionApplier';

interface AutoCorrectionPanelProps {
  issues: (WcagIssue | Wcag22Issue)[];
  asset: any; // ProjectionAsset
  onCorrectionApply: (result: CorrectionResult) => void;
  onClose: () => void;
  initialSettings?: AutoCorrectionSettings;
}

export const AutoCorrectionPanel: React.FC<AutoCorrectionPanelProps> = ({
  issues,
  asset,
  onCorrectionApply,
  onClose,
  initialSettings = {
    autoApplyHighPriority: true,
    autoApplyMediumPriority: false,
    requireConfirmationForDesignChanges: true,
    preserveOriginalDesign: true,
    maxDesignImpact: 7,
    customRules: []
  }
}) => {
  const [strategies, setStrategies] = useState<CorrectionStrategy[]>([]);
  const [selectedStrategies, setSelectedStrategies] = useState<CorrectionStrategy[]>([]);
  const [correctionResults, setCorrectionResults] = useState<CorrectionResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<AutoCorrectionSettings>(initialSettings);
  const [currentPreview, setCurrentPreview] = useState<CorrectionPreview | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // 修正戦略を生成
  useEffect(() => {
    const generateStrategies = async () => {
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
  const handleStrategyToggle = (strategy: CorrectionStrategy) => {
    setSelectedStrategies(prev => {
      if (prev.find(s => s.id === strategy.id)) {
        return prev.filter(s => s.id !== strategy.id);
      } else {
        return [...prev, strategy];
      }
    });
  };

  // すべての戦略を選択/解除
  const handleSelectAll = () => {
    if (selectedStrategies.length === strategies.length) {
      setSelectedStrategies([]);
    } else {
      setSelectedStrategies(strategies);
    }
  };

  // 自動適用可能な戦略を選択
  const handleSelectAutoApplicable = () => {
    const autoApplicable = strategies.filter(s => s.autoApplicable);
    setSelectedStrategies(autoApplicable);
  };

  // 修正を適用
  const handleApplyCorrections = async () => {
    if (selectedStrategies.length === 0) {
      setError('修正戦略を選択してください');
      return;
    }

    try {
      setLoading(true);
      const results: CorrectionResult[] = [];

      // 各戦略を適用
      for (const strategy of selectedStrategies) {
        // スライドインデックスを取得（最初の問題から）
        const slideIndex = issues.length > 0 ? issues[0].slideIndex || 0 : 0;
        const result = await applyCorrectionStrategy(strategy, asset, slideIndex);
        results.push(result);
        
        // 結果を通知
        onCorrectionApply(result);
      }

      setCorrectionResults(results);
      setError(null);
    } catch (err) {
      setError('修正の適用に失敗しました');
      console.error('Error applying corrections:', err);
    } finally {
      setLoading(false);
    }
  };

  // プレビューを生成
  const handlePreviewCorrection = async (strategy: CorrectionStrategy) => {
    try {
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
    } catch (err) {
      setError('プレビューの生成に失敗しました');
      console.error('Error generating preview:', err);
    }
  };

  // 設定を更新
  const handleSettingChange = (key: keyof AutoCorrectionSettings, value: any) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // 重大度でフィルタリング
  const filterByPriority = (priority: 'high' | 'medium' | 'low') => {
    return strategies.filter(s => s.priority === priority);
  };

  // 重大度ごとの戦略数を取得
  const getPriorityCount = (priority: 'high' | 'medium' | 'low') => {
    return strategies.filter(s => s.priority === priority).length;
  };

  if (loading) {
    return (
      <div className="auto-correction-panel loading">
        <div className="loading-spinner"></div>
        <p>修正戦略を生成中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="auto-correction-panel error">
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
    <div className="auto-correction-panel">
      <div className="panel-header">
        <h2>アクセシビリティ自動修正</h2>
        <button className="close-button" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="panel-content">
        {/* 問題の概要 */}
        <div className="issues-summary">
          <h3>検出された問題 ({issues.length})</h3>
          <div className="issue-counts">
            <div className="priority-count high">
              <span className="count">{getPriorityCount('high')}</span>
              <span className="label">高優先度</span>
            </div>
            <div className="priority-count medium">
              <span className="count">{getPriorityCount('medium')}</span>
              <span className="label">中優先度</span>
            </div>
            <div className="priority-count low">
              <span className="count">{getPriorityCount('low')}</span>
              <span className="label">低優先度</span>
            </div>
          </div>
        </div>

        {/* 設定 */}
        <div className="correction-settings">
          <h3>修正設定</h3>
          <div className="setting-group">
            <label className="setting-label">
              <input
                type="checkbox"
                checked={settings.autoApplyHighPriority}
                onChange={(e) => handleSettingChange('autoApplyHighPriority', e.target.checked)}
                className="setting-checkbox"
              />
              高優先度の修正を自動適用
            </label>
            <label className="setting-label">
              <input
                type="checkbox"
                checked={settings.autoApplyMediumPriority}
                onChange={(e) => handleSettingChange('autoApplyMediumPriority', e.target.checked)}
                className="setting-checkbox"
              />
              中優先度の修正を自動適用
            </label>
            <label className="setting-label">
              <input
                type="checkbox"
                checked={settings.requireConfirmationForDesignChanges}
                onChange={(e) => handleSettingChange('requireConfirmationForDesignChanges', e.target.checked)}
                className="setting-checkbox"
              />
              デザイン変更に確認を要求
            </label>
            <label className="setting-label">
              <input
                type="checkbox"
                checked={settings.preserveOriginalDesign}
                onChange={(e) => handleSettingChange('preserveOriginalDesign', e.target.checked)}
                className="setting-checkbox"
              />
              元のデザインを可能な限り保持
            </label>
          </div>
          
          <div className="setting-group">
            <label className="setting-label">
              デザインへの影響度の上限:
              <input
                type="range"
                min="1"
                max="10"
                value={settings.maxDesignImpact}
                onChange={(e) => handleSettingChange('maxDesignImpact', parseInt(e.target.value, 10))}
                className="setting-range"
              />
              <span className="range-value">{settings.maxDesignImpact}</span>
            </label>
          </div>
        </div>

        {/* 修正戦略の一覧 */}
        <div className="correction-strategies">
          <div className="strategies-header">
            <h3>修正戦略 ({strategies.length})</h3>
            <div className="strategy-actions">
              <button
                className="strategy-button"
                onClick={handleSelectAutoApplicable}
                disabled={strategies.filter(s => s.autoApplicable).length === 0}
              >
                自動適用可能を選択
              </button>
              <button
                className="strategy-button"
                onClick={handleSelectAll}
              >
                {selectedStrategies.length === strategies.length ? 'すべて解除' : 'すべて選択'}
              </button>
            </div>
          </div>

          <div className="strategies-list">
            {strategies.length === 0 ? (
              <div className="no-strategies">
                <p>適用可能な修正戦略がありません</p>
              </div>
            ) : (
              strategies.map(strategy => (
                <div
                  key={strategy.id}
                  className={`strategy-item ${selectedStrategies.find(s => s.id === strategy.id) ? 'selected' : ''} ${strategy.priority}`}
                >
                  <div className="strategy-header">
                    <div className="strategy-info">
                      <h4 className="strategy-title">{strategy.issueType}</h4>
                      <p className="strategy-description">{strategy.explanation}</p>
                    </div>
                    <div className="strategy-controls">
                      <button
                        className={`preview-button ${strategy.priority}`}
                        onClick={() => handlePreviewCorrection(strategy)}
                      >
                        プレビュー
                      </button>
                      <label className="strategy-checkbox">
                        <input
                          type="checkbox"
                          checked={selectedStrategies.find(s => s.id === strategy.id) !== undefined}
                          onChange={() => handleStrategyToggle(strategy)}
                        />
                      </label>
                    </div>
                  </div>
                  
                  <div className="strategy-details">
                    <div className="strategy-priority">
                      <span className={`priority-indicator ${strategy.priority}`}>
                        {strategy.priority === 'high' ? '高' : 
                         strategy.priority === 'medium' ? '中' : '低'}
                      </span>
                    </div>
                    
                    <div className="strategy-impact">
                      <div className="impact-item">
                        <span className="impact-label">アクセシビリティ:</span>
                        <div className="impact-bar">
                          <div
                            className="impact-fill accessibility"
                            style={{ width: `${strategy.estimatedImpact.accessibility * 10}%` }}
                          ></div>
                        </div>
                        <span className="impact-value">{strategy.estimatedImpact.accessibility}/10</span>
                      </div>
                      
                      <div className="impact-item">
                        <span className="impact-label">デザイン:</span>
                        <div className="impact-bar">
                          <div
                            className="impact-fill design"
                            style={{ width: `${strategy.estimatedImpact.design * 10}%` }}
                          ></div>
                        </div>
                        <span className="impact-value">{strategy.estimatedImpact.design}/10</span>
                      </div>
                      
                      <div className="impact-item">
                        <span className="impact-label">パフォーマンス:</span>
                        <div className="impact-bar">
                          <div
                            className="impact-fill performance"
                            style={{ width: `${strategy.estimatedImpact.performance * 10}%` }}
                          ></div>
                        </div>
                        <span className="impact-value">{strategy.estimatedImpact.performance}/10</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="strategy-actions-list">
                    <h5>修正アクション:</h5>
                    <ul>
                      {strategy.actions.map((action, index) => (
                        <li key={index}>
                          <span className="action-type">{action.type}</span>
                          <span className="action-description">{action.description}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="strategy-wcag">
                    <span className="wcag-reference">{strategy.wcagReference}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* プレビュー */}
        {currentPreview && (
          <div className="correction-preview">
            <div className="preview-header">
              <h3>修正プレビュー</h3>
              <button
                className="close-preview"
                onClick={() => setCurrentPreview(null)}
              >
                ×
              </button>
            </div>
            
            <div className="preview-content">
              <div className="preview-comparison">
                <div className="preview-state before">
                  <h4>修正前</h4>
                  <p>{currentPreview.beforePreview.description}</p>
                </div>
                
                <div className="preview-arrow">→</div>
                
                <div className="preview-state after">
                  <h4>修正後</h4>
                  <p>{currentPreview.afterPreview.description}</p>
                </div>
              </div>
              
              <div className="preview-differences">
                <h5>変更点:</h5>
                <ul>
                  {currentPreview.differences.map((difference, index) => (
                    <li key={index}>{difference}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* 修正結果 */}
        {correctionResults.length > 0 && (
          <div className="correction-results">
            <h3>修正結果</h3>
            <div className="results-summary">
              <div className="result-count success">
                <span className="count">
                  {correctionResults.filter(r => r.success).length}
                </span>
                <span className="label">成功</span>
              </div>
              <div className="result-count failed">
                <span className="count">
                  {correctionResults.filter(r => !r.success).length}
                </span>
                <span className="label">失敗</span>
              </div>
            </div>
            
            <div className="results-list">
              {correctionResults.map((result, index) => (
                <div
                  key={result.id}
                  className={`result-item ${result.success ? 'success' : 'failed'}`}
                >
                  <div className="result-status">
                    {result.success ? '✓' : '✗'}
                  </div>
                  
                  <div className="result-details">
                    <h5>戦略: {result.strategyId}</h5>
                    
                    {result.success ? (
                      <div>
                        <p>適用されたアクション: {result.appliedActions.length}</p>
                        {result.skippedActions.length > 0 && (
                          <p>スキップされたアクション: {result.skippedActions.length}</p>
                        )}
                      </div>
                    ) : (
                      <div>
                        <p>エラーが発生しました</p>
                        {result.errors && (
                          <ul>
                            {result.errors.map((error, errorIndex) => (
                              <li key={errorIndex}>{error}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* フッター */}
      <div className="panel-footer">
        <div className="selected-info">
          {selectedStrategies.length > 0 ? (
            <div>
              <strong>選択中の戦略:</strong> {selectedStrategies.length}
            </div>
          ) : (
            <div>修正戦略を選択してください</div>
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
            onClick={handleApplyCorrections}
            disabled={selectedStrategies.length === 0 || loading}
          >
            修正を適用
          </button>
        </div>
      </div>
    </div>
  );
};