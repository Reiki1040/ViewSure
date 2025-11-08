/**
 * 自動修正戦略エンジン
 */

import type { Wcag22Issue } from '../../types/wcag22';
import type { WcagIssue } from '../../utils/wcag/analyzer';

import type {
  CorrectionStrategy,
  CorrectionAction,
  CorrectionPriority,
  WcagIssueType,
  AutoCorrectionSettings
} from '../../types/autoCorrection';

// 修正ルールのキャッシュ
let correctionRulesCache: Map<string, any> | null = null;

/**
 * WCAG問題に基づいて修正戦略を生成する
 */
export const generateCorrectionStrategies = async (
  issues: (WcagIssue | Wcag22Issue)[],
  settings: AutoCorrectionSettings
): Promise<CorrectionStrategy[]> => {
  const strategies: CorrectionStrategy[] = [];

  for (const issue of issues) {
    const strategy = await generateStrategyForIssue(issue, settings);
    if (strategy) {
      strategies.push(strategy);
    }
  }

  // 優先順位でソート
  strategies.sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });

  return strategies;
};

/**
 * 個別のWCAG問題に対する修正戦略を生成する
 */
const generateStrategyForIssue = async (
  issue: WcagIssue | Wcag22Issue,
  settings: AutoCorrectionSettings
): Promise<CorrectionStrategy | null> => {
  const issueType = mapIssueType(issue);
  const severity = getIssueSeverity(issue);
  
  // 修正ルールを取得
  const rules = await getCorrectionRules(issueType);
  if (!rules || rules.length === 0) {
    return null;
  }

  // 適用可能なルールを検索
  const applicableRule = findApplicableRule(rules, issue, settings);
  if (!applicableRule) {
    return null;
  }

  // 修正戦略を構築
  const strategy: CorrectionStrategy = {
    id: `strategy-${issueType}-${Date.now()}`,
    issueType,
    priority: determinePriority(issue, applicableRule),
    autoApplicable: shouldAutoApply(issue, applicableRule, settings),
    requiresUserConfirmation: requiresConfirmation(issue, applicableRule, settings),
    actions: applicableRule.actions.map((action: any) => ({
      ...action,
      id: `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      target: {
        slideId: issue.slideIndex?.toString() || '0',
        elementId: getElementId(issue),
        property: getTargetProperty(issue)
      }
    })),
    explanation: generateExplanation(issue, applicableRule),
    wcagReference: getWcagReference(issueType),
    estimatedImpact: estimateImpact(issue, applicableRule)
  };

  return strategy;
};

/**
 * WCAG問題の種類をマッピングする
 */
const mapIssueType = (issue: WcagIssue | Wcag22Issue): WcagIssueType => {
  if ('rule' in issue) {
    // 基本的なWCAG問題
    switch (issue.rule) {
      case 'font-size':
        return 'font-size';
      case 'contrast':
        return 'contrast';
      default:
        return 'font-size'; // デフォルト
    }
  } else if ('guideline' in issue) {
    // WCAG 2.2問題
    const guideline = (issue as any).guideline;
    switch (guideline) {
      case '1.4.3':
        return 'contrast';
      case '1.4.12':
        return 'text-spacing';
      case '2.4.6':
        return 'heading-hierarchy';
      default:
        return 'contrast'; // デフォルト
    }
  }
  
  return 'contrast'; // デフォルト
};

/**
 * 問題の重大度を取得する
 */
const getIssueSeverity = (issue: WcagIssue | Wcag22Issue): 'error' | 'warning' => {
  if ('severity' in issue) {
    return issue.severity;
  } else if ('level' in issue) {
    const level = (issue as any).level;
    return level === 'AAA' ? 'warning' : 'error';
  }
  return 'warning'; // デフォルト
};

/**
 * 修正ルールを取得する
 */
const getCorrectionRules = async (issueType: WcagIssueType): Promise<any[]> => {
  if (correctionRulesCache && correctionRulesCache.has(issueType)) {
    return correctionRulesCache.get(issueType);
  }

  try {
    let ruleFile;
    switch (issueType) {
      case 'contrast':
        ruleFile = '/data/correctionRules/colorContrast.json';
        break;
      case 'font-size':
        ruleFile = '/data/correctionRules/fontSize.json';
        break;
      default:
        return [];
    }

    const response = await fetch(ruleFile);
    if (!response.ok) {
      console.warn(`Failed to load correction rules for ${issueType}`);
      return [];
    }

    const rules = await response.json();
    
    if (!correctionRulesCache) {
      correctionRulesCache = new Map();
    }
    correctionRulesCache.set(issueType, rules.rules || []);
    
    return rules.rules || [];
  } catch (error) {
    console.error(`Error loading correction rules for ${issueType}:`, error);
    return [];
  }
};

/**
 * 適用可能なルールを検索する
 */
const findApplicableRule = (
  rules: any[],
  issue: WcagIssue | Wcag22Issue,
  settings: AutoCorrectionSettings
): any => {
  const severity = getIssueSeverity(issue);
  const fontSize = getFontSize(issue);
  const contrastRatio = getContrastRatio(issue);
  const elementType = getElementType(issue);

  for (const rule of rules) {
    // 重大度のチェック
    if (rule.severity && rule.severity !== severity) {
      continue;
    }

    // 条件の評価
    if (rule.condition) {
      const condition = rule.condition;
      
      // フォントサイズの条件
      if (condition.fontSize) {
        if (condition.fontSize.lt && fontSize >= condition.fontSize.lt) continue;
        if (condition.fontSize.lte && fontSize > condition.fontSize.lte) continue;
        if (condition.fontSize.gt && fontSize <= condition.fontSize.gt) continue;
        if (condition.fontSize.gte && fontSize < condition.fontSize.gte) continue;
      }

      // コントラスト比の条件
      if (condition.contrastRatio) {
        if (condition.contrastRatio.lt && contrastRatio >= condition.contrastRatio.lt) continue;
        if (condition.contrastRatio.lte && contrastRatio > condition.contrastRatio.lte) continue;
        if (condition.contrastRatio.gt && contrastRatio <= condition.contrastRatio.gt) continue;
        if (condition.contrastRatio.gte && contrastRatio < condition.contrastRatio.gte) continue;
      }

      // 要素タイプの条件
      if (condition.elementType && condition.elementType !== elementType) {
        continue;
      }
    }

    return rule;
  }

  return null;
};

/**
 * 優先度を決定する
 */
const determinePriority = (
  issue: WcagIssue | Wcag22Issue,
  rule: any
): CorrectionPriority => {
  const severity = getIssueSeverity(issue);
  
  if (severity === 'error') {
    return 'high';
  } else if (rule.priority) {
    return rule.priority;
  } else {
    return 'medium';
  }
};

/**
 * 自動適用すべきか判断する
 */
const shouldAutoApply = (
  issue: WcagIssue | Wcag22Issue,
  rule: any,
  settings: AutoCorrectionSettings
): boolean => {
  const priority = determinePriority(issue, rule);
  
  if (priority === 'high' && settings.autoApplyHighPriority) {
    return true;
  }
  
  if (priority === 'medium' && settings.autoApplyMediumPriority) {
    return true;
  }
  
  return false;
};

/**
 * ユーザー確認が必要か判断する
 */
const requiresConfirmation = (
  issue: WcagIssue | Wcag22Issue,
  rule: any,
  settings: AutoCorrectionSettings
): boolean => {
  // デザインへの影響が大きい場合は確認を要求
  if (settings.requireConfirmationForDesignChanges) {
    const impact = estimateImpact(issue, rule);
    if (impact.design > 5) {
      return true;
    }
  }
  
  return false;
};

/**
 * 修正理由の説明を生成する
 */
const generateExplanation = (
  issue: WcagIssue | Wcag22Issue,
  rule: any
): string => {
  const issueType = mapIssueType(issue);
  const severity = getIssueSeverity(issue);
  
  switch (issueType) {
    case 'contrast':
      return `テキストと背景のコントラスト比がWCAG基準を満たしていません。${severity === 'error' ? '読みやすさに深刻な問題があります' : '読みやすさを改善できます'}。コントラスト比を引き上げることで、より多くの人がコンテンツを利用できるようになります。`;
    
    case 'font-size':
      return `テキストサイズがWCAG基準を満たしていません。${severity === 'error' ? '特に視覚障害のある方にとって読みにくい可能性があります' : '読みやすさを改善できます'}。フォントサイズを引き上げることで、コンテンツの可読性が向上します。`;
    
    default:
      return `アクセシビリティの問題が検出されました。この修正により、コンテンツの利用しやすさが向上します。`;
  }
};

/**
 * WCAG参照を取得する
 */
const getWcagReference = (issueType: WcagIssueType): string => {
  switch (issueType) {
    case 'contrast':
      return 'WCAG 2.1 1.4.3 コントラスト (最低限)';
    case 'font-size':
      return 'WCAG 2.1 1.4.4 テキストのサイズ変更';
    case 'text-spacing':
      return 'WCAG 2.2 1.4.12 テキストの間隔';
    case 'heading-hierarchy':
      return 'WCAG 2.1 2.4.6 見出しとラベル';
    default:
      return 'WCAG 2.1';
  }
};

/**
 * 修正の影響を評価する
 */
const estimateImpact = (
  issue: WcagIssue | Wcag22Issue,
  rule: any
): { accessibility: number; design: number; performance: number } => {
  const severity = getIssueSeverity(issue);
  const baseAccessibility = severity === 'error' ? 8 : 5;
  const baseDesign = severity === 'error' ? 6 : 3;
  const basePerformance = 1;

  // ルールに基づいて影響を調整
  let designImpact = baseDesign;
  if (rule.actions) {
    for (const action of rule.actions) {
      if (action.type === 'color') {
        designImpact += 2;
      } else if (action.type === 'fontSize') {
        designImpact += 1;
      } else if (action.type === 'position') {
        designImpact += 3;
      }
    }
  }

  return {
    accessibility: Math.min(baseAccessibility, 10),
    design: Math.min(designImpact, 10),
    performance: Math.min(basePerformance, 10)
  };
};

/**
 * ヘルパー関数
 */
const getFontSize = (issue: WcagIssue | Wcag22Issue): number => {
  if ('fontSize' in issue) {
    return issue.fontSize || 0;
  }
  return 0;
};

const getContrastRatio = (issue: WcagIssue | Wcag22Issue): number => {
  if ('contrastRatio' in issue) {
    return issue.contrastRatio || 0;
  }
  return 0;
};

const getElementType = (issue: WcagIssue | Wcag22Issue): string => {
  if ('element' in issue && issue.element) {
    return issue.element.type || 'text';
  }
  return 'text';
};

const getElementId = (issue: WcagIssue | Wcag22Issue): string | undefined => {
  if ('element' in issue && issue.element) {
    return issue.element.selector;
  }
  return undefined;
};

const getTargetProperty = (issue: WcagIssue | Wcag22Issue): string | undefined => {
  const issueType = mapIssueType(issue);
  
  switch (issueType) {
    case 'contrast':
      return 'color';
    case 'font-size':
      return 'fontSize';
    default:
      return undefined;
  }
};

/**
 * 修正ルールキャッシュをクリアする
 */
export const clearCorrectionRulesCache = (): void => {
  correctionRulesCache = null;
};

/**
 * 利用可能な修正戦略の種類を取得する
 */
export const getAvailableCorrectionTypes = (): WcagIssueType[] => {
  return [
    'contrast',
    'font-size',
    'text-spacing',
    'heading-hierarchy',
    'list-structure',
    'reading-order',
    'table-structure',
    'alt-text'
  ];
};