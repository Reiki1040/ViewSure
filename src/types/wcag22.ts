import type { DocumentAnalysis, WcagIssue } from '../utils/wcag/analyzer';
import type { TextNodeAdjustments, TextRenderingModel, Rectangle } from './textModel';
import type { ProjectionAsset } from '../utils/fileLoader';

export type WCAG22Guideline = 
  | '1.4.10' // Reflow
  | '1.4.11' // Non-text Contrast
  | '1.4.12' // Text Spacing
  | '1.4.13' // Content on Hover or Focus
  | '2.2.11' // Focus Visible (AAA)
  | '2.3.7' // Animation from Interactions (AAA)
  | '2.4.11' // Focus Appearance (AAA)
  | '2.5.7' // Dragging Movements (AAA)
  | '3.2.6' // Consistent Help (AAA)
  | '3.3.7' // Error Identification (AAA)
  | '3.3.8' // Error Prevention (AAA)
  | '4.1.3'; // Status Messages

export type ComplianceLevel = 'A' | 'AA' | 'AAA' | 'non-compliant';

export interface ElementInfo {
  type: 'text' | 'image' | 'graphic' | 'link' | 'heading' | 'list' | 'table' | 'form';
  selector: string;
  bounds: Rectangle;
}

export interface AutomatedFix {
  type: 'adjustment' | 'replacement' | 'restructure';
  params: Record<string, any>;
}

export interface Wcag22Issue extends WcagIssue {
  guideline: WCAG22Guideline;
  level: 'A' | 'AA' | 'AAA';
  element?: ElementInfo;
  suggestion?: string;
  automatedFix?: AutomatedFix;
}

export interface ComplianceInfo {
  level: ComplianceLevel;
  score: number; // 0-100
  passedGuidelines: string[];
  failedGuidelines: string[];
}

export interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  description: string;
  impact: string;
  effort: 'minimal' | 'moderate' | 'significant';
}

export interface Wcag22Analysis extends DocumentAnalysis {
  issues: Wcag22Issue[];
  compliance: ComplianceInfo;
  recommendations: Recommendation[];
}

export interface Wcag22AnalysisOptions {
  targetLevel: 'A' | 'AA' | 'AAA';
  includeAAAGuidelines: boolean;
  enableColorBlindnessSimulation: boolean;
}

export interface TextSpacingMetrics {
  lineHeight: number;
  paragraphSpacing: number;
  letterSpacing: number;
  wordSpacing: number;
  fontSize: number;
  compliance: {
    lineHeight: boolean; // 1.5 times font size
    paragraphSpacing: boolean; // 2 times font size
    letterSpacing: boolean; // 0.12 times font size
    wordSpacing: boolean; // 0.16 times font size
  };
}

export interface ColorBlindnessSimulation {
  type: 'protanopia' | 'deuteranopia' | 'tritanopia';
  simulatedImage: HTMLCanvasElement;
  contrastIssues: Array<{
    element: string;
    originalContrast: number;
    simulatedContrast: number;
    severity: 'error' | 'warning';
  }>;
}

export interface ColorBlindnessPalette {
  original: { r: number; g: number; b: number };
  accessible: { r: number; g: number; b: number };
  simulationType: string;
}

export interface Wcag22AdjustmentSettings {
  targetLevel: 'A' | 'AA' | 'AAA';
  preserveDesign: boolean; // デザインの意図を維持する度合い
  colorBlindnessMode: 'none' | 'simulate' | 'compensate';
  textSpacing: {
    enabled: boolean;
    strictMode: boolean; // WCAG厳格モード
  };
  reflow: {
    enabled: boolean;
    minWidth: number; // 最小幅（デフォルト320px）
  };
  nonTextContrast: {
    enabled: boolean;
    minContrast: number; // 最小コントラスト比
  };
}

export interface Wcag22AdjustmentResult {
  adjustedAsset: ProjectionAsset;
  appliedAdjustments: Array<{
    type: string;
    element: string;
    before: any;
    after: any;
  }>;
  remainingIssues: Wcag22Issue[];
}

export interface NonTextElement {
  bounds: Rectangle;
  type: string;
  color?: string;
  backgroundColor?: string;
}

export interface InteractiveElement {
  bounds: Rectangle;
  content: string;
  type: string;
}

export interface FocusableElement {
  bounds: Rectangle;
  type: string;
  focusColor?: string;
}