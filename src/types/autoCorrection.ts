/**
 * 自動修正機能に関する型定義
 */

import { Wcag22Issue } from './wcag22';
import { WcagIssue } from '../utils/wcag/analyzer';

// WCAG問題の種類を定義
export type WcagIssueType =
  | 'font-size'
  | 'contrast'
  | 'text-spacing'
  | 'reflow'
  | 'non-text-contrast'
  | 'focus-visible'
  | 'heading-hierarchy'
  | 'list-structure'
  | 'reading-order'
  | 'table-structure'
  | 'alt-text'
  | 'link-purpose'
  | 'color-only';

// 修正アクションの種類
export type CorrectionActionType = 
  | 'color'           // 色の修正（コントラスト比など）
  | 'fontSize'        // フォントサイズの修正
  | 'fontFamily'      // フォントファミリーの修正
  | 'position'        // 位置の修正
  | 'size'            // サイズの修正
  | 'structure'       // 構造の修正（見出し階層など）
  | 'content'         // コンテンツの修正（代替テキストなど）
  | 'readingOrder'    // 読み上げ順序の修正
  | 'focus'           // フォーカス順序の修正
  | 'table'           // 表構造の修正
  | 'list'            // リスト構造の修正;

// 修正の優先度
export type CorrectionPriority = 'high' | 'medium' | 'low';

// 修正アクションのパラメータ
export interface CorrectionParameters {
  // 色関連
  foregroundColor?: string;
  backgroundColor?: string;
  contrastRatio?: number;
  
  // フォント関連
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  lineHeight?: number;
  
  // 位置・サイズ関連
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  margin?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
  padding?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
  
  // 構造関連
  headingLevel?: number;
  readingOrder?: number;
  tabIndex?: number;
  
  // コンテンツ関連
  text?: string;
  altText?: string;
  ariaLabel?: string;
  ariaDescription?: string;
  
  // 表関連
  tableHeaders?: boolean;
  tableCaption?: string;
  
  // リスト関連
  listType?: 'ordered' | 'unordered';
  listMarker?: string;
}

// 修正アクション
export interface CorrectionAction {
  id: string;
  type: CorrectionActionType;
  target: {
    slideId: string;
    elementId?: string;
    property?: string; // CSSプロパティなど
  };
  parameters: CorrectionParameters;
  description: string; // 修正内容の説明
}

// 修正戦略
export interface CorrectionStrategy {
  id: string;
  issueType: WcagIssueType;
  priority: CorrectionPriority;
  autoApplicable: boolean; // 自動適用可能かどうか
  requiresUserConfirmation: boolean; // ユーザー確認が必要かどうか
  actions: CorrectionAction[];
  explanation: string; // 修正理由の説明
  wcagReference: string; // 関連するWCAGガイドライン
  estimatedImpact: {
    accessibility: number; // アクセシビリティへの影響度（1-10）
    design: number;        // デザインへの影響度（1-10）
    performance: number;   // パフォーマンスへの影響度（1-10）
  };
}

// 修正結果
export interface CorrectionResult {
  id: string;
  strategyId: string;
  success: boolean;
  appliedActions: CorrectionAction[];
  skippedActions: CorrectionAction[];
  errors?: string[];
  warnings?: string[];
  beforeState?: any; // 修正前の状態
  afterState?: any;  // 修正後の状態
}

// 修正プレビュー
export interface CorrectionPreview {
  id: string;
  issueId: string;
  strategy: CorrectionStrategy;
  beforePreview: {
    imageUrl?: string;
    description: string;
  };
  afterPreview: {
    imageUrl?: string;
    description: string;
  };
  differences: string[]; // 変更点のリスト
}

// 自動修正セッション
export interface AutoCorrectionSession {
  id: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  issues: (WcagIssue | Wcag22Issue)[];
  strategies: CorrectionStrategy[];
  results: CorrectionResult[];
  summary: {
    totalIssues: number;
    correctedIssues: number;
    failedCorrections: number;
    skippedCorrections: number;
    accessibilityScoreBefore: number;
    accessibilityScoreAfter: number;
  };
}

// 修正設定
export interface AutoCorrectionSettings {
  autoApplyHighPriority: boolean; // 高優先度の修正を自動適用するか
  autoApplyMediumPriority: boolean; // 中優先度の修正を自動適用するか
  requireConfirmationForDesignChanges: boolean; // デザイン変更に確認を要求するか
  preserveOriginalDesign: boolean; // 元のデザインを可能な限り保持するか
  maxDesignImpact: number; // 許容するデザインへの影響度（1-10）
  customRules: CustomCorrectionRule[]; // カスタム修正ルール
}

// カスタム修正ルール
export interface CustomCorrectionRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  condition: {
    issueType?: WcagIssueType;
    elementTypes?: string[];
    properties?: Record<string, any>;
  };
  actions: CorrectionAction[];
  priority: CorrectionPriority;
}

// 修正履歴
export interface CorrectionHistory {
  id: string;
  sessionId: string;
  timestamp: string;
  action: CorrectionAction;
  result: 'applied' | 'skipped' | 'failed';
  reason?: string;
  user?: string; // 修正を実行したユーザー
}

// 修正のバッチ処理
export interface CorrectionBatch {
  id: string;
  name: string;
  description: string;
  strategies: CorrectionStrategy[];
  targets: {
    slideIds: string[];
    elementIds?: string[];
  };
  settings: AutoCorrectionSettings;
  createdAt: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  results: CorrectionResult[];
}