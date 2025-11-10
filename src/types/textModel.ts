export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type TextNodeRole = 'heading' | 'body' | 'caption';

export type TextNodeBaselineStyle = {
  fontSize: number;
  fontFamily?: string;
  fontWeight?: number | string;
  color?: string;
  background?: string;
};

export type TextNodeAdjustments = {
  scale?: number;
  absoluteFontSize?: number;
  fontFamily?: string;
  fontWeight?: number | string;
  color?: string;
  background?: string;
  letterSpacing?: number;
};

export type TextNodeComputedStyle = {
  fontSize: number;
  fontFamily?: string;
  fontWeight?: number | string;
  color?: string;
  background?: string;
  letterSpacing?: number;
};

export type TextNodeLayout = {
  bounds: Rectangle;
  baseline?: number;
  lineHeight?: number;
};

export type TextNodeMeta = {
  contrastRatio?: number;
  wcagViolations?: Array<'contrast' | 'font-size'>;
};

export type TextNodeModel = {
  slideId: number;
  nodeId: string;
  content: string;
  role: TextNodeRole;
  layout: TextNodeLayout;
  baselineStyle: TextNodeBaselineStyle;
  adjustments: TextNodeAdjustments;
  computedStyle: TextNodeComputedStyle;
  meta?: TextNodeMeta;
};

export type SlideTextModel = {
  slideId: number;
  baseWidth: number;
  baseHeight: number;
  nodes: TextNodeModel[];
};

export type TextRenderingModel = {
  slides: SlideTextModel[];
};

export type ProjectionAsset = {
  type: 'pdf' | 'pptx' | 'image';
  pageCount: number;
  getFrame: (index: number) => Promise<TexImageSource>;
  dispose?: () => void;
  hasFrame?: (index: number) => boolean;
  getTextContent?: (index: number) => Promise<any | null>;
  getStructure?: () => Promise<any[] | null>;
};

