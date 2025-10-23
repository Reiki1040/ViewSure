import type { DocumentAnalysis, SlideMetrics, SlideTextNode } from './analyzer';

export type TextAlignment = 'left' | 'center' | 'right';

export type WcagTextAdjustment = {
  id: string;
  text: string;
  role: SlideTextNode['role'];
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  textAlign: TextAlignment;
  color: string;
  backgroundColor: string;
  lineHeight: number;
  letterSpacing: number;
  bounds: SlideTextNode['bounds'];
};

export type WcagSlideAdjustments = {
  slideWidth: number;
  slideHeight: number;
  nodes: WcagTextAdjustment[];
};

export type WcagAdjustmentsMap = Record<number, WcagSlideAdjustments>;

const clamp01 = (value: number) => Math.min(Math.max(Number.isFinite(value) ? value : 0, 0), 1);

const requiredFontSize = (node: SlideTextNode, slide: SlideMetrics) => {
  const headingMin = Math.max(28, slide.height * 0.045);
  const bodyMin = Math.max(18, slide.height * 0.03);
  const base = node.role === 'heading' ? headingMin : bodyMin;
  return Math.round(Math.max(node.fontSize, base));
};

const deriveAlignment = (node: SlideTextNode, slideWidth: number): TextAlignment => {
  const nodeCenter = node.bounds.x + node.bounds.width / 2;
  const slideCenter = slideWidth / 2;
  const alignmentThreshold = Math.max(slideWidth * 0.04, node.bounds.width * 0.1);
  if (Math.abs(nodeCenter - slideCenter) <= alignmentThreshold) {
    return 'center';
  }
  const spaceOnRight = slideWidth - (node.bounds.x + node.bounds.width);
  const spaceOnLeft = node.bounds.x;
  if (spaceOnRight <= slideWidth * 0.08 && spaceOnLeft > spaceOnRight) {
    return 'right';
  }
  return 'left';
};

const deriveColorPair = (node: SlideTextNode) => {
  const background = clamp01(node.backgroundLuminance ?? 0.45);
  if (background >= 0.6) {
    return {
      color: '#F8FBFF',
      backgroundColor: 'rgba(14, 18, 32, 0.86)'
    };
  }
  if (background <= 0.3) {
    return {
      color: '#10141F',
      backgroundColor: 'rgba(248, 250, 255, 0.9)'
    };
  }
  return {
    color: '#11151E',
    backgroundColor: 'rgba(248, 250, 255, 0.92)'
  };
};

const selectFontFamily = (node: SlideTextNode) => {
  if (node.role === 'heading') {
    return "'Noto Sans JP','Inter','Helvetica Neue','Segoe UI',sans-serif";
  }
  return "'Noto Sans JP','Hiragino Sans','Yu Gothic','Inter',sans-serif";
};

export const deriveAutoAdjustments = (analysis: DocumentAnalysis): WcagAdjustmentsMap => {
  const results: WcagAdjustmentsMap = {};

  analysis.slides.forEach((slide) => {
    if (!slide.textNodes || slide.textNodes.length === 0) {
      return;
    }
    const nodes: WcagTextAdjustment[] = slide.textNodes.map((node, nodeIndex) => {
      const fontSize = requiredFontSize(node, slide);
      const fontFamily = selectFontFamily(node);
      const textAlign = deriveAlignment(node, slide.width);
      const { color, backgroundColor } = deriveColorPair(node);
      const letterSpacing = node.role === 'heading' ? 0.02 : 0.012;
      const lineHeight = node.role === 'heading' ? 1.25 : 1.45;

      return {
        id: `${slide.index}-${nodeIndex}`,
        text: node.text.trim().replace(/\s+/g, ' ') || '(テキスト)',
        role: node.role,
        fontSize,
        fontFamily,
        fontWeight: node.role === 'heading' ? 700 : 500,
        textAlign,
        color,
        backgroundColor,
        lineHeight,
        letterSpacing,
        bounds: node.bounds
      };
    });

    if (nodes.length > 0) {
      results[slide.index] = {
        slideWidth: slide.width,
        slideHeight: slide.height,
        nodes
      };
    }
  });

  return results;
};
