import { useCallback, useMemo } from 'react';
import type { Wcag22Analysis, Wcag22Issue, Wcag22AdjustmentSettings } from '../types/wcag22';

interface Wcag22SummaryProps {
  analysis: Wcag22Analysis | null;
  isAnalyzing: boolean;
  error?: string | null;
  onFocusSlide?: (index: number) => void;
  onApplyAdjustments?: (settings: Wcag22AdjustmentSettings) => void;
  targetLevel?: 'A' | 'AA' | 'AAA';
  showDetails?: boolean;
  adjustmentSettings?: Wcag22AdjustmentSettings;
  onAdjustmentSettingsChange?: (settings: Wcag22AdjustmentSettings) => void;
}

const Wcag22Summary = ({
  analysis,
  isAnalyzing,
  error,
  onFocusSlide,
  onApplyAdjustments,
  targetLevel = 'AA',
  showDetails = false,
  adjustmentSettings,
  onAdjustmentSettingsChange
}: Wcag22SummaryProps) => {
  // 問題の種類別集計
  const issueSummary = useMemo(() => {
    if (!analysis) {
      return null;
    }
    
    const { issues } = analysis;
    
    // ガイドライン別の問題数
    const guidelineCounts = issues.reduce((counts, issue) => {
      counts[issue.guideline] = (counts[issue.guideline] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);
    
    // 重要度別の問題数
    const severityCounts = issues.reduce((counts, issue) => {
      counts[issue.severity] = (counts[issue.severity] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);
    
    return {
      total: issues.length,
      errors: severityCounts.error || 0,
      warnings: severityCounts.warning || 0,
      guidelineCounts
    };
  }, [analysis]);
  
  // 上位5つの問題
  const topIssues = useMemo(() => {
    if (!analysis) {
      return [];
    }
    
    return analysis.issues
      .slice(0, 5)
      .map((issue, index) => ({
        ...issue,
        key: `${issue.slideIndex}-${issue.guideline}-${index}`
      }));
  }, [analysis]);
  
  // 準拠スコアの表示
  const complianceScore = useMemo(() => {
    if (!analysis) {
      return null;
    }
    
    const { compliance } = analysis;
    const score = compliance.score;
    const level = compliance.level;
    
    // スコアに応じた色の決定
    let scoreColor = '#e74c3c'; // 赤
    if (score >= 90) {
      scoreColor = '#27ae60'; // 緑
    } else if (score >= 70) {
      scoreColor = '#f39c12'; // 黄
    } else if (score >= 50) {
      scoreColor = '#e67e22'; // オレンジ
    }
    
    return {
      score,
      level,
      scoreColor,
      levelText: level === 'non-compliant' ? '非準拠' : `WCAG ${level}`
    };
  }, [analysis]);
  
  // 問題のハンドラ
  const handleIssueClick = useCallback((issue: Wcag22Issue) => {
    if (onFocusSlide) {
      onFocusSlide(issue.slideIndex + 1);
    }
  }, [onFocusSlide]);
  
  // 調整適用のハンドラ
  const handleApplyAdjustments = useCallback(() => {
    if (onApplyAdjustments && adjustmentSettings) {
      onApplyAdjustments(adjustmentSettings);
    }
  }, [onApplyAdjustments, adjustmentSettings]);
  
  // 目標準拠レベルの変更ハンドラ
  const handleTargetLevelChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLevel = e.target.value as 'A' | 'AA' | 'AAA';
    if (onAdjustmentSettingsChange && adjustmentSettings) {
      onAdjustmentSettingsChange({
        ...adjustmentSettings,
        targetLevel: newLevel
      });
    }
  }, [adjustmentSettings, onAdjustmentSettingsChange]);
  
  // デザイン維持度の変更ハンドラ
  const handlePreserveDesignChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const preserveDesign = e.target.checked;
    if (onAdjustmentSettingsChange && adjustmentSettings) {
      onAdjustmentSettingsChange({
        ...adjustmentSettings,
        preserveDesign
      });
    }
  }, [adjustmentSettings, onAdjustmentSettingsChange]);
  
  // 色覚多様性モードの変更ハンドラ
  const handleColorBlindnessModeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const mode = e.target.value as 'none' | 'simulate' | 'compensate';
    if (onAdjustmentSettingsChange && adjustmentSettings) {
      onAdjustmentSettingsChange({
        ...adjustmentSettings,
        colorBlindnessMode: mode
      });
    }
  }, [adjustmentSettings, onAdjustmentSettingsChange]);
  
  // テキストスペーシング設定の変更ハンドラ
  const handleTextSpacingChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const enabled = e.target.checked;
    if (onAdjustmentSettingsChange && adjustmentSettings) {
      onAdjustmentSettingsChange({
        ...adjustmentSettings,
        textSpacing: {
          ...adjustmentSettings.textSpacing,
          enabled
        }
      });
    }
  }, [adjustmentSettings, onAdjustmentSettingsChange]);
  
  const handleTextSpacingStrictModeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const strictMode = e.target.checked;
    if (onAdjustmentSettingsChange && adjustmentSettings) {
      onAdjustmentSettingsChange({
        ...adjustmentSettings,
        textSpacing: {
          ...adjustmentSettings.textSpacing,
          strictMode
        }
      });
    }
  }, [adjustmentSettings, onAdjustmentSettingsChange]);
  
  // リフロー設定の変更ハンドラ
  const handleReflowChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const enabled = e.target.checked;
    if (onAdjustmentSettingsChange && adjustmentSettings) {
      onAdjustmentSettingsChange({
        ...adjustmentSettings,
        reflow: {
          ...adjustmentSettings.reflow,
          enabled
        }
      });
    }
  }, [adjustmentSettings, onAdjustmentSettingsChange]);
  
  // 非テキストコントラスト設定の変更ハンドラ
  const handleNonTextContrastChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const enabled = e.target.checked;
    if (onAdjustmentSettingsChange && adjustmentSettings) {
      onAdjustmentSettingsChange({
        ...adjustmentSettings,
        nonTextContrast: {
          ...adjustmentSettings.nonTextContrast,
          enabled
        }
      });
    }
  }, [adjustmentSettings, onAdjustmentSettingsChange]);
  
  if (error) {
    return (
      <section className="wcag22-summary wcag22-summary--error">
        <h3>WCAG 2.2 解析</h3>
        <p>{error}</p>
      </section>
    );
  }
  
  if (isAnalyzing) {
    return (
      <section className="wcag22-summary wcag22-summary--loading">
        <h3>WCAG 2.2 解析</h3>
        <div className="wcag22-summary__loading-spinner"></div>
        <p>解析中です...</p>
      </section>
    );
  }
  
  if (!analysis) {
    return (
      <section className="wcag22-summary">
        <h3>WCAG 2.2 解析</h3>
        <p>資料を読み込むと結果を表示します。</p>
      </section>
    );
  }
  
  return (
    <section className="wcag22-summary">
      <h3>WCAG 2.2 解析</h3>
      
      {complianceScore && (
        <div className="wcag22-summary__compliance">
          <div className="wcag22-summary__score">
            <div 
              className="wcag22-summary__score-circle"
              style={{ backgroundColor: complianceScore.scoreColor }}
            >
              {complianceScore.score}
            </div>
            <div className="wcag22-summary__score-info">
              <div className="wcag22-summary__score-level">
                {complianceScore.levelText}
              </div>
              <div className="wcag22-summary__score-description">
                {complianceScore.score >= 90 && '優れた準拠'}
                {complianceScore.score >= 70 && complianceScore.score < 90 && '良好な準拠'}
                {complianceScore.score >= 50 && complianceScore.score < 70 && '部分的な準拠'}
                {complianceScore.score < 50 && '不十分な準拠'}
              </div>
            </div>
          </div>
          
          {issueSummary && (
            <div className="wcag22-summary__issue-counts">
              <div className="wcag22-summary__issue-count">
                <span className="wcag22-summary__issue-count-number">{issueSummary.total}</span>
                <span className="wcag22-summary__issue-count-label">件の問題</span>
              </div>
              
              {issueSummary.errors > 0 && (
                <div className="wcag22-summary__issue-count wcag22-summary__issue-count--error">
                  <span className="wcag22-summary__issue-count-number">{issueSummary.errors}</span>
                  <span className="wcag22-summary__issue-count-label">件のエラー</span>
                </div>
              )}
              
              {issueSummary.warnings > 0 && (
                <div className="wcag22-summary__issue-count wcag22-summary__issue-count--warning">
                  <span className="wcag22-summary__issue-count-number">{issueSummary.warnings}</span>
                  <span className="wcag22-summary__issue-count-label">件の警告</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {showDetails && adjustmentSettings && (
        <div className="wcag22-summary__adjustment-settings">
          <h4>調整設定</h4>
          
          <div className="wcag22-summary__setting-group">
            <label htmlFor="target-level">目標準拠レベル</label>
            <select
              id="target-level"
              value={adjustmentSettings.targetLevel}
              onChange={handleTargetLevelChange}
            >
              <option value="A">WCAG A</option>
              <option value="AA">WCAG AA</option>
              <option value="AAA">WCAG AAA</option>
            </select>
          </div>
          
          <div className="wcag22-summary__setting-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={adjustmentSettings.preserveDesign}
                onChange={handlePreserveDesignChange}
              />
              デザインの意図を維持する
            </label>
          </div>
          
          <div className="wcag22-summary__setting-group">
            <label htmlFor="color-blindness-mode">色覚多様性モード</label>
            <select
              id="color-blindness-mode"
              value={adjustmentSettings.colorBlindnessMode}
              onChange={handleColorBlindnessModeChange}
            >
              <option value="none">なし</option>
              <option value="simulate">シミュレーション</option>
              <option value="compensate">補正</option>
            </select>
          </div>
          
          <div className="wcag22-summary__setting-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={adjustmentSettings.textSpacing.enabled}
                onChange={handleTextSpacingChange}
              />
              テキストスペーシングを調整する
            </label>
            
            {adjustmentSettings.textSpacing.enabled && (
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={adjustmentSettings.textSpacing.strictMode}
                  onChange={handleTextSpacingStrictModeChange}
                />
                WCAG厳格モード
              </label>
            )}
          </div>
          
          <div className="wcag22-summary__setting-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={adjustmentSettings.reflow.enabled}
                onChange={handleReflowChange}
              />
              リフローを有効にする
            </label>
          </div>
          
          <div className="wcag22-summary__setting-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={adjustmentSettings.nonTextContrast.enabled}
                onChange={handleNonTextContrastChange}
              />
              非テキストコントラストを調整する
            </label>
          </div>
          
          <div className="wcag22-summary__apply-button">
            <button
              type="button"
              onClick={handleApplyAdjustments}
              className="wcag22-summary__apply-button"
            >
              調整を適用
            </button>
          </div>
        </div>
      )}
      
      {topIssues.length > 0 && (
        <div className="wcag22-summary__issues">
          <h4>主要な問題</h4>
          <ul className="wcag22-summary__issue-list">
            {topIssues.map((issue) => (
              <li 
                key={issue.key} 
                className="wcag22-summary__issue"
                onClick={() => handleIssueClick(issue)}
              >
                <span className={`wcag22-summary__issue-severity wcag22-summary__issue-severity--${issue.severity}`}>
                  {issue.severity === 'error' ? '要改善' : '注意'}
                </span>
                <span className="wcag22-summary__issue-guideline">
                  {issue.guideline}
                </span>
                <button
                  type="button"
                  className="wcag22-summary__issue-slide-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleIssueClick(issue);
                  }}
                >
                  p.{issue.slideIndex + 1} を表示
                </button>
                <span className="wcag22-summary__issue-text">
                  {issue.nodeText || issue.message}
                </span>
              </li>
            ))}
          </ul>
          
          {analysis.issues.length > topIssues.length && (
            <p className="wcag22-summary__more-issues">
              残り {analysis.issues.length - topIssues.length} 件は詳細表示で確認できます
            </p>
          )}
        </div>
      )}
    </section>
  );
};

export default Wcag22Summary;