import React from 'react';
import type { DocumentStructure, StructureWcagIssues } from '../types/textStructure';
import LoadingSpinner from './LoadingSpinner';

type TextStructureSummaryProps = {
  structure: DocumentStructure | null;
  wcagIssues: StructureWcagIssues | null;
  isAnalyzing: boolean;
  error?: string | null;
  onSlideSelect?: (slideId: number) => void;
  onElementSelect?: (slideId: number, elementId: string) => void;
};

const TextStructureSummary = ({
  structure,
  wcagIssues,
  isAnalyzing,
  error,
  onSlideSelect,
  onElementSelect
}: TextStructureSummaryProps) => {
  if (error) {
    return (
      <section className="text-structure-summary text-structure-summary--error">
        <h3>テキスト構造解析</h3>
        <p>{error}</p>
      </section>
    );
  }

  if (isAnalyzing) {
    return (
      <section className="text-structure-summary text-structure-summary--loading">
        <h3>テキスト構造解析</h3>
        <LoadingSpinner size="small" message="構造を解析中です..." />
      </section>
    );
  }

  if (!structure) {
    return (
      <section className="text-structure-summary">
        <h3>テキスト構造解析</h3>
        <p>資料を読み込むと構造を表示します。</p>
      </section>
    );
  }

  const totalElements = structure.slides.reduce((sum, slide) => sum + slide.elements.length, 0);
  const totalHeadings = structure.globalHierarchy.headings.length;
  const totalLists = structure.slides.reduce((sum, slide) => 
    sum + slide.elements.filter(e => e.role === 'bullet-list' || e.role === 'numbered-list').length, 0
  );
  const totalTables = structure.slides.reduce((sum, slide) => 
    sum + slide.elements.filter(e => e.role === 'table-cell').length, 0
  );

  const issueCount = wcagIssues?.allIssues.length || 0;
  const errorCount = wcagIssues?.allIssues.filter(issue => issue.severity === 'error').length || 0;
  const warningCount = wcagIssues?.allIssues.filter(issue => issue.severity === 'warning').length || 0;

  return (
    <section className="text-structure-summary">
      <h3>テキスト構造解析</h3>
      
      <div className="text-structure-summary__overview">
        <div className="text-structure-summary__stats">
          <div className="text-structure-summary__stat">
            <span className="text-structure-summary__stat-value">{structure.pageCount}</span>
            <span className="text-structure-summary__stat-label">ページ</span>
          </div>
          <div className="text-structure-summary__stat">
            <span className="text-structure-summary__stat-value">{totalElements}</span>
            <span className="text-structure-summary__stat-label">要素</span>
          </div>
          <div className="text-structure-summary__stat">
            <span className="text-structure-summary__stat-value">{totalHeadings}</span>
            <span className="text-structure-summary__stat-label">見出し</span>
          </div>
          <div className="text-structure-summary__stat">
            <span className="text-structure-summary__stat-value">{totalLists}</span>
            <span className="text-structure-summary__stat-label">リスト</span>
          </div>
          <div className="text-structure-summary__stat">
            <span className="text-structure-summary__stat-value">{totalTables}</span>
            <span className="text-structure-summary__stat-label">表</span>
          </div>
        </div>
      </div>

      {issueCount > 0 && (
        <div className="text-structure-summary__issues">
          <h4>構造に関する問題</h4>
          <div className="text-structure-summary__issue-stats">
            <span className="text-structure-summary__issue-count text-structure-summary__issue-count--error">
              {errorCount} エラー
            </span>
            <span className="text-structure-summary__issue-count text-structure-summary__issue-count--warning">
              {warningCount} 警告
            </span>
          </div>
        </div>
      )}

      <div className="text-structure-summary__outline">
        <h4>ドキュメントアウトライン</h4>
        <ul className="text-structure-summary__outline-list">
          {structure.globalHierarchy.outline.map((item, index) => (
            <li 
              key={item.slideId} 
              className="text-structure-summary__outline-item"
              style={{ paddingLeft: `${(item.level - 1) * 20}px` }}
            >
              <button
                type="button"
                className="text-structure-summary__outline-button"
                onClick={() => onSlideSelect?.(item.slideId)}
              >
                <span className="text-structure-summary__outline-slide">p.{item.slideId}</span>
                <span className="text-structure-summary__outline-title">{item.title}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="text-structure-summary__headings">
        <h4>見出し階層</h4>
        <ul className="text-structure-summary__heading-list">
          {structure.globalHierarchy.headings.map((heading, index) => (
            <li 
              key={heading.id} 
              className="text-structure-summary__heading-item"
              style={{ paddingLeft: `${(heading.level - 1) * 15}px` }}
            >
              <button
                type="button"
                className="text-structure-summary__heading-button"
                onClick={() => onSlideSelect?.(heading.slideId)}
              >
                <span className="text-structure-summary__heading-level">H{heading.level}</span>
                <span className="text-structure-summary__heading-text">{heading.text}</span>
                <span className="text-structure-summary__heading-slide">p.{heading.slideId}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {wcagIssues && wcagIssues.allIssues.length > 0 && (
        <div className="text-structure-summary__wcag-issues">
          <h4>WCAG構造問題</h4>
          <ul className="text-structure-summary__issue-list">
            {wcagIssues.allIssues.slice(0, 5).map((issue, index) => (
              <li key={issue.id} className="text-structure-summary__issue-item">
                <span className={`text-structure-summary__issue-severity text-structure-summary__issue-severity--${issue.severity}`}>
                  {issue.severity === 'error' ? 'エラー' : '警告'}
                </span>
                <span className="text-structure-summary__issue-type">
                  {getIssueTypeLabel(issue.type)}
                </span>
                <button
                  type="button"
                  className="text-structure-summary__issue-slide-button"
                  onClick={() => onSlideSelect?.(issue.slideId)}
                >
                  p.{issue.slideId}
                </button>
                <span className="text-structure-summary__issue-message">{issue.message}</span>
              </li>
            ))}
          </ul>
          {wcagIssues.allIssues.length > 5 && (
            <p className="text-structure-summary__more-issues">
              残り {wcagIssues.allIssues.length - 5} 件の問題があります
            </p>
          )}
        </div>
      )}
    </section>
  );
};

const getIssueTypeLabel = (type: string): string => {
  switch (type) {
    case 'heading-hierarchy':
      return '見出し階層';
    case 'list-structure':
      return 'リスト構造';
    case 'reading-order':
      return '読み上げ順序';
    case 'table-structure':
      return '表構造';
    default:
      return 'その他';
  }
};

export default TextStructureSummary;