import type { DocumentAnalysis, WcagIssue } from '../utils/wcag/analyzer';

type WcagSummaryProps = {
  analysis: DocumentAnalysis | null;
  isAnalyzing: boolean;
  error?: string | null;
  onFocusSlide?: (index: number) => void;
  fontAdjustments?: { headingScale: number; bodyScale: number } | null;
};

const getIssueLabel = (issue: WcagIssue) => {
  switch (issue.rule) {
    case 'font-size':
      return '文字サイズ';
    case 'contrast':
      return 'コントラスト';
    default:
      return 'その他';
  }
};

const getSeverityLabel = (severity: WcagIssue['severity']) =>
  severity === 'error' ? '要改善' : '注意';

const WcagSummary = ({ analysis, isAnalyzing, error, onFocusSlide, fontAdjustments }: WcagSummaryProps) => {
  if (error) {
    return (
      <section className="wcag-summary wcag-summary--error">
        <h3>WCAG 解析</h3>
        <p>{error}</p>
      </section>
    );
  }

  if (isAnalyzing) {
    return (
      <section className="wcag-summary">
        <h3>WCAG 解析</h3>
        <p>解析中です…</p>
      </section>
    );
  }

  if (!analysis) {
    return (
      <section className="wcag-summary">
        <h3>WCAG 解析</h3>
        <p>資料を読み込むと結果を表示します。</p>
      </section>
    );
  }

  const { issues } = analysis;
  if (!issues.length) {
    return (
      <section className="wcag-summary wcag-summary--success">
        <h3>WCAG 解析</h3>
        <p>主要な問題は検出されませんでした。</p>
      </section>
    );
  }

  const topIssues = issues.slice(0, 5);

  return (
    <section className="wcag-summary">
      <h3>WCAG 解析</h3>
      <div className="wcag-summary__overview">
        <p>{issues.length} 件の改善候補が見つかりました。</p>
        {fontAdjustments ? (
          <div className="wcag-summary__adjustments">
            <span>
              見出し ×{fontAdjustments.headingScale.toFixed(2)} / 本文 ×{fontAdjustments.bodyScale.toFixed(2)}
            </span>
          </div>
        ) : null}
        <div className="wcag-summary__stats">
          <span>
            <strong>{issues.filter((issue) => issue.rule === 'contrast').length}</strong> コントラスト
          </span>
          <span>
            <strong>{issues.filter((issue) => issue.rule === 'font-size').length}</strong> 文字サイズ
          </span>
        </div>
      </div>
      <ul>
        {topIssues.map((issue, index) => (
          <li key={`${issue.slideIndex}-${index}`}>
            <span className={`wcag-summary__chip wcag-summary__chip--${issue.severity}`}>
              {getSeverityLabel(issue.severity)}
            </span>
            <span className="wcag-summary__chip">{getIssueLabel(issue)}</span>
            <button
              type="button"
              className="wcag-summary__slide-button"
              onClick={() => onFocusSlide?.(issue.slideIndex + 1)}
            >
              p.{issue.slideIndex + 1} を表示
            </button>
            <span className="wcag-summary__text">{issue.nodeText ?? issue.message}</span>
          </li>
        ))}
      </ul>
      {issues.length > topIssues.length ? <p>残り {issues.length - topIssues.length} 件は近日表示予定です。</p> : null}
    </section>
  );
};

export default WcagSummary;
