/**
 * アクセシブルテンプレート関連の型定義
 */

export type TemplateCategory = 'academic' | 'business' | 'education' | 'general';

export type WcagComplianceLevel = 'AA' | 'AAA';

export interface WcagCompliance {
  level: WcagComplianceLevel;
  guidelines: string[]; // 準拠しているWCAGガイドラインのID
}

export interface ElementStyle {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  color?: string;
  backgroundColor?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  lineHeight?: number;
  letterSpacing?: number;
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
  border?: string;
  borderRadius?: number;
}

export interface ElementAccessibility {
  role: string;
  ariaLabel?: string;
  ariaDescription?: string;
  readingOrder: number;
  tabIndex?: number;
}

export interface TemplateElement {
  id: string;
  type: 'title' | 'heading' | 'text' | 'image' | 'list' | 'table' | 'quote' | 'caption' | 'footer';
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  style: ElementStyle;
  content: string;
  accessibility: ElementAccessibility;
  placeholder?: string; // ユーザーが入力するためのプレースホルダーテキスト
  required?: boolean; // 必須要素かどうか
}

export interface SlideLayout {
  id: string;
  name: string;
  width: number;
  height: number;
  backgroundColor: string;
  backgroundImage?: string;
  elements: TemplateElement[];
}

export interface TemplateSlide {
  id: string;
  name: string;
  layout: SlideLayout;
  notes?: string; // スライドに関する説明やガイド
  wcagNotes?: string; // アクセシビリティに関する特記事項
}

export interface AccessibleTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  preview: string; // プレビュー画像URL
  slides: TemplateSlide[];
  wcagCompliance: WcagCompliance;
  tags: string[]; // 検索用のタグ
  author: string;
  version: string;
  createdAt: string;
  updatedAt: string;
}

// テンプレートのメタ情報
export interface TemplateMetadata {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  preview: string;
  tags: string[];
  author: string;
  version: string;
  slideCount: number;
  wcagLevel: WcagComplianceLevel;
  createdAt: string;
  updatedAt: string;
}

// テンプレートの検索フィルター
export interface TemplateFilter {
  category?: TemplateCategory;
  wcagLevel?: WcagComplianceLevel;
  tags?: string[];
  author?: string;
  searchQuery?: string;
}

// テンプレートの適用オプション
export interface TemplateApplicationOptions {
  preserveContent?: boolean; // 既存のコンテンツを保持するか
  applyToAllSlides?: boolean; // すべてのスライドに適用するか
  targetSlideIds?: string[]; // 適用対象のスライドID
  customizations?: TemplateCustomization[];
}

// テンプレートのカスタマイズ
export interface TemplateCustomization {
  elementId: string;
  property: keyof ElementStyle | 'content' | 'position';
  value: any;
}

// テンプレートの適用結果
export interface TemplateApplicationResult {
  success: boolean;
  appliedSlides: string[];
  errors?: string[];
  warnings?: string[];
  customizations?: TemplateCustomization[];
}