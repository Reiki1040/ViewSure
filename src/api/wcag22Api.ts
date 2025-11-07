import type { 
  Wcag22Analysis, 
  Wcag22AnalysisOptions, 
  Wcag22Issue, 
  Wcag22AdjustmentSettings, 
  Wcag22AdjustmentResult,
  TextSpacingMetrics,
  ColorBlindnessSimulation,
  NonTextElement,
  InteractiveElement,
  FocusableElement
} from '../types/wcag22';
import type { ProjectionAsset, SlideTextContent } from '../utils/fileLoader';
import type { SlideTextNode } from '../utils/wcag/analyzer';
import type { TextNodeAdjustments, TextRenderingModel } from '../types/textModel';
import type { Rectangle } from '../types/projector';
import { calculateContrast } from '../utils/colorUtils';

/**
 * WCAG 2.2 API
 */
export interface Wcag22Api {
  // ドキュメント分析
  analyzeDocument(
    asset: ProjectionAsset,
    options?: Wcag22AnalysisOptions
  ): Promise<Wcag22Analysis>;
  
  // テキストスペーシング分析
  analyzeTextSpacing(
    textNodes: SlideTextNode[]
  ): Promise<TextSpacingMetrics[]>;
  
  // 非テキストコントラスト分析
  analyzeNonTextContrast(
    source: TexImageSource,
    elements: Array<{ bounds: Rectangle; type: string }>
  ): Promise<Wcag22Issue[]>;
  
  // 色覚多様性シミュレーション
  simulateColorBlindness(
    source: TexImageSource,
    simulationType: 'protanopia' | 'deuteranopia' | 'tritanopia'
  ): Promise<ColorBlindnessSimulation>;
  
  // 調整適用
  applyAdjustments(
    analysis: Wcag22Analysis,
    settings: Wcag22AdjustmentSettings
  ): Promise<Wcag22AdjustmentResult>;
}

/**
 * ドキュメント分析の実装
 */
const analyzeDocument = async (
  asset: ProjectionAsset,
  options: Wcag22AnalysisOptions = {
    targetLevel: 'AA',
    includeAAAGuidelines: false,
    enableColorBlindnessSimulation: false
  }
): Promise<Wcag22Analysis> => {
  const issues: Wcag22Issue[] = [];
  const pageCount = asset.pageCount;
  
  // 各ページの分析
  for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
    // テキストコンテンツの取得
    let textContent: SlideTextContent | null = null;
    if (typeof asset.getTextContent === 'function') {
      try {
        textContent = await asset.getTextContent(pageIndex);
      } catch (error) {
        console.warn(`ページ ${pageIndex} のテキストコンテンツの取得に失敗しました`, error);
      }
    }
    
    // 画像の取得
    const source = await asset.getFrame(pageIndex);
    
    // テキストスペーシングの分析
    if (textContent) {
      const textNodes = classifyTextNodes(textContent);
      const spacingIssues = await analyzeTextSpacing(textNodes);
      
      spacingIssues.forEach((metrics, index) => {
        if (!metrics.compliance.lineHeight) {
          issues.push({
            slideIndex: pageIndex,
            severity: metrics.fontSize < 18 ? 'error' : 'warning',
            rule: '1.4.12' as any,
            guideline: '1.4.12',
            level: options.targetLevel,
            message: 'テキストの行間がWCAG基準を満たしていません',
            fontSize: metrics.fontSize,
            nodeText: textNodes[index]?.text,
            element: {
              type: 'text',
              selector: `.text-node-${index}`,
              bounds: textNodes[index]?.bounds || { x: 0, y: 0, width: 0, height: 0 }
            },
            suggestion: '行間をフォントサイズの1.5倍以上にすることを推奨します',
            automatedFix: {
              type: 'adjustment',
              params: { lineHeight: 1.5 }
            }
          });
        }
        
        if (!metrics.compliance.paragraphSpacing) {
          issues.push({
            slideIndex: pageIndex,
            severity: 'warning',
            rule: '1.4.12' as any,
            guideline: '1.4.12',
            level: options.targetLevel,
            message: '段落間のスペースがWCAG基準を満たしていません',
            nodeText: textNodes[index]?.text,
            element: {
              type: 'text',
              selector: `.text-node-${index}`,
              bounds: textNodes[index]?.bounds || { x: 0, y: 0, width: 0, height: 0 }
            },
            suggestion: '段落間をフォントサイズの2倍以上にすることを推奨します',
            automatedFix: {
              type: 'adjustment',
              params: { paragraphSpacing: 2.0 }
            }
          });
        }
      });
    }
    
    // 非テキストコントラストの分析
    const nonTextElements = await detectNonTextElements(source);
    const contrastIssues = await analyzeNonTextContrast(source, nonTextElements);
    issues.push(...contrastIssues);
    
    // 色覚多様性の分析
    if (options.enableColorBlindnessSimulation) {
      const simulationTypes: Array<'protanopia' | 'deuteranopia' | 'tritanopia'> = 
        ['protanopia', 'deuteranopia', 'tritanopia'];
      
      for (const simulationType of simulationTypes) {
        const simulation = await simulateColorBlindness(source, simulationType);
        
        simulation.contrastIssues.forEach(issue => {
          issues.push({
            slideIndex: pageIndex,
            severity: issue.severity,
            rule: '1.4.11' as any,
            guideline: '1.4.11',
            level: options.targetLevel,
            message: `色覚多様性（${simulationType}）でのコントラストが不足しています`,
            contrastRatio: issue.simulatedContrast,
            nodeText: issue.element,
            element: {
              type: 'graphic',
              selector: `.graphic-element-${issue.element}`,
              bounds: { x: 0, y: 0, width: 0, height: 0 }
            },
            suggestion: 'コントラストを高めるか、色の組み合わせを変更することを推奨します',
            automatedFix: {
              type: 'adjustment',
              params: { increaseContrast: true }
            }
          });
        });
      }
    }
  }
  
  // 準拠スコアの計算
  const compliance = calculateComplianceScore(issues, options.targetLevel);
  
  // 推奨事項の生成
  const recommendations = generateRecommendations(issues, options.targetLevel);
  
  return {
    pageCount,
    generatedAt: Date.now(),
    slides: [], // 簡略化のため空
    issues,
    compliance,
    recommendations
  };
};

/**
 * テキストスペーシング分析の実装
 */
const analyzeTextSpacing = async (
  textNodes: SlideTextNode[]
): Promise<TextSpacingMetrics[]> => {
  return textNodes.map(node => {
    const fontSize = node.fontSize;
    
    // WCAG基準値の計算
    const minLineHeight = fontSize * 1.5;
    const minParagraphSpacing = fontSize * 2.0;
    const minLetterSpacing = fontSize * 0.12;
    const minWordSpacing = fontSize * 0.16;
    
    // 実際のスペースを計算（簡略化）
    const lineHeight = node.bounds.height;
    const paragraphSpacing = 0; // 実際の実装では段落間を計算
    const letterSpacing = 0; // 実際の実装では文字間を計算
    const wordSpacing = 0; // 実際の実装では単語間を計算
    
    return {
      lineHeight,
      paragraphSpacing,
      letterSpacing,
      wordSpacing,
      fontSize,
      compliance: {
        lineHeight: lineHeight >= minLineHeight,
        paragraphSpacing: paragraphSpacing >= minParagraphSpacing,
        letterSpacing: letterSpacing >= minLetterSpacing,
        wordSpacing: wordSpacing >= minWordSpacing
      }
    };
  });
};

/**
 * 非テキストコントラスト分析の実装
 */
const analyzeNonTextContrast = async (
  source: TexImageSource,
  elements: Array<{ bounds: Rectangle; type: string }>
): Promise<Wcag22Issue[]> => {
  const issues: Wcag22Issue[] = [];
  
  // Canvasを作成して画像データを取得
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Canvasコンテキストの取得に失敗しました');
  }
  
  // ソース画像の寸法を取得
  let sourceWidth: number, sourceHeight: number;
  if (source instanceof HTMLImageElement) {
    sourceWidth = source.naturalWidth || source.width;
    sourceHeight = source.naturalHeight || source.height;
  } else if (source instanceof HTMLCanvasElement) {
    sourceWidth = source.width;
    sourceHeight = source.height;
  } else if (source instanceof ImageBitmap) {
    sourceWidth = source.width;
    sourceHeight = source.height;
  } else {
    return issues;
  }
  
  canvas.width = sourceWidth;
  canvas.height = sourceHeight;
  ctx.drawImage(source, 0, 0);
  
  // 各要素のコントラストを分析
  for (const element of elements) {
    const { bounds, type } = element;
    
    // 要素の中心ピクセルを取得
    const centerX = Math.floor(bounds.x + bounds.width / 2);
    const centerY = Math.floor(bounds.y + bounds.height / 2);
    
    // 要素の色を取得
    const elementData = ctx.getImageData(
      centerX, 
      centerY, 
      1, 
      1
    ).data;
    
    const elementColor = `rgb(${elementData[0]}, ${elementData[1]}, ${elementData[2]})`;
    
    // 背景色を取得（簡略化：要素の周囲の平均色）
    const backgroundData = ctx.getImageData(
      Math.max(0, centerX - 5),
      Math.max(0, centerY - 5),
      11,
      11
    ).data;
    
    let bgR = 0, bgG = 0, bgB = 0, bgCount = 0;
    for (let i = 0; i < backgroundData.length; i += 4) {
      // 要素の中心ピクセルは除外
      if (Math.abs((i / 4) % 11 - 5) <= 2 && Math.abs(Math.floor((i / 4) / 11) - 5) <= 2) {
        continue;
      }
      bgR += backgroundData[i];
      bgG += backgroundData[i + 1];
      bgB += backgroundData[i + 2];
      bgCount++;
    }
    
    if (bgCount > 0) {
      bgR = Math.floor(bgR / bgCount);
      bgG = Math.floor(bgG / bgCount);
      bgB = Math.floor(bgB / bgCount);
    }
    
    const backgroundColor = `rgb(${bgR}, ${bgG}, ${bgB})`;
    
    // コントラスト比を計算
    const contrastRatio = calculateContrast(elementColor, backgroundColor);
    
    // WCAG基準（非テキスト要素：3:1）
    const minContrast = 3.0;
    
    if (contrastRatio < minContrast) {
      issues.push({
        slideIndex: 0, // 呼び出し元で設定
        severity: contrastRatio < minContrast * 0.75 ? 'error' : 'warning',
        rule: '1.4.11' as any,
        guideline: '1.4.11',
        level: 'AA',
        message: `${type}要素のコントラストがWCAG基準を満たしていません`,
        contrastRatio,
        nodeText: type,
        element: {
          type: type as any,
          selector: `.${type}-element`,
          bounds
        },
        suggestion: 'コントラストを高めるか、色の組み合わせを変更することを推奨します',
        automatedFix: {
          type: 'adjustment',
          params: { increaseContrast: true }
        }
      });
    }
  }
  
  return issues;
};

/**
 * 色覚多様性シミュレーションの実装
 */
const simulateColorBlindness = async (
  source: TexImageSource,
  simulationType: 'protanopia' | 'deuteranopia' | 'tritanopia'
): Promise<ColorBlindnessSimulation> => {
  // Canvasを作成して画像データを取得
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Canvasコンテキストの取得に失敗しました');
  }
  
  // ソース画像の寸法を取得
  let sourceWidth: number, sourceHeight: number;
  if (source instanceof HTMLImageElement) {
    sourceWidth = source.naturalWidth || source.width;
    sourceHeight = source.naturalHeight || source.height;
  } else if (source instanceof HTMLCanvasElement) {
    sourceWidth = source.width;
    sourceHeight = source.height;
  } else if (source instanceof ImageBitmap) {
    sourceWidth = source.width;
    sourceHeight = source.height;
  } else {
    throw new Error('サポートされていない画像形式です');
  }
  
  canvas.width = sourceWidth;
  canvas.height = sourceHeight;
  ctx.drawImage(source, 0, 0);
  
  // 画像データを取得
  const imageData = ctx.getImageData(0, 0, sourceWidth, sourceHeight);
  const { data } = imageData;
  
  // 色覚多様性シミュレーションを適用
  const simulatedData = new Uint8ClampedArray(data.length);
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    // 色文字列に変換
    const colorString = `rgb(${r}, ${g}, ${b})`;
    
    // 色覚多様性シミュレーションを適用
    // 色覚多様性シミュレーションを適用
    const simulatedColor = colorString; // 簡略化
    const simulatedRgb = colorString.match(/\d+/g);
    
    if (simulatedRgb && simulatedRgb.length >= 3) {
      simulatedData[i] = Number(simulatedRgb[0]);
      simulatedData[i + 1] = Number(simulatedRgb[1]);
      simulatedData[i + 2] = Number(simulatedRgb[2]);
      simulatedData[i + 3] = data[i + 3]; // アルファ値は維持
    } else {
      simulatedData[i] = r;
      simulatedData[i + 1] = g;
      simulatedData[i + 2] = b;
      simulatedData[i + 3] = data[i + 3];
    }
  }
  
  // シミュレーション結果をCanvasに描画
  const simulatedCanvas = document.createElement('canvas');
  simulatedCanvas.width = sourceWidth;
  simulatedCanvas.height = sourceHeight;
  const simulatedCtx = simulatedCanvas.getContext('2d');
  
  if (!simulatedCtx) {
    throw new Error('Canvasコンテキストの取得に失敗しました');
  }
  
  const simulatedImageData = new ImageData(simulatedData, sourceWidth, sourceHeight);
  simulatedCtx.putImageData(simulatedImageData, 0, 0);
  
  // コントラスト問題の検出（簡略化）
  const contrastIssues: Array<{
    element: string;
    originalContrast: number;
    simulatedContrast: number;
    severity: 'error' | 'warning';
  }> = [];
  // 実際の実装では、より複雑なコントラスト分析が必要
  
  return {
    type: simulationType,
    simulatedImage: simulatedCanvas,
    contrastIssues
  };
};

/**
 * 調整適用の実装
 */
const applyAdjustments = async (
  analysis: Wcag22Analysis,
  settings: Wcag22AdjustmentSettings
): Promise<Wcag22AdjustmentResult> => {
  // 簡略化された実装
  // 実際の実装では、より複雑な調整ロジックが必要
  
  const appliedAdjustments: Array<{
    type: string;
    element: string;
    before: any;
    after: any;
  }> = [];
  
  const remainingIssues: Wcag22Issue[] = [];
  
  // 問題の種類に応じた調整を適用
  for (const issue of analysis.issues) {
    switch (issue.rule) {
      case '1.4.12' as any: // テキストスペーシング
        if (settings.textSpacing.enabled) {
          appliedAdjustments.push({
            type: 'text_spacing_adjustment',
            element: issue.element?.selector || '',
            before: { spacing: 'insufficient' },
            after: { spacing: 'wcag_compliant' }
          });
        } else {
          remainingIssues.push(issue);
        }
        break;
        
      case '1.4.11' as any: // 非テキストコントラスト
        if (settings.nonTextContrast.enabled) {
          appliedAdjustments.push({
            type: 'contrast_adjustment',
            element: issue.element?.selector || '',
            before: { contrast: issue.contrastRatio },
            after: { contrast: Math.max(settings.nonTextContrast.minContrast, (issue.contrastRatio || 0) * 1.5) }
          });
        } else {
          remainingIssues.push(issue);
        }
        break;
        
      default:
        remainingIssues.push(issue);
        break;
    }
  }
  
  // 簡略化された結果を返す
  // 実際の実装では、調整済みのアセットを生成する必要がある
  return {
    adjustedAsset: null as any, // 簡略化
    appliedAdjustments,
    remainingIssues
  };
};

/**
 * テキストノードの分類（既存の関数を再利用）
 */
const classifyTextNodes = (content: SlideTextContent): SlideTextNode[] => {
  if (!content || !content.runs.length) {
    return [];
  }
  const fontSizes = content.runs
    .map((run) => run.fontSize)
    .filter((size) => Number.isFinite(size) && size > 0)
    .sort((a, b) => a - b);

  if (fontSizes.length === 0) {
    return [];
  }

  const median = fontSizes[Math.floor(fontSizes.length / 2)];
  const max = fontSizes[fontSizes.length - 1];
  const threshold = Math.max(median * 1.35, max * 0.75);

  return content.runs
    .map((run) => {
      const text = run.text.trim();
      if (!text) {
        return null;
      }
      const role: SlideTextNode['role'] = run.fontSize >= threshold ? 'heading' : 'body';
      return {
        text,
        role,
        fontSize: run.fontSize,
        bounds: {
          x: run.x,
          y: run.y,
          width: run.width,
          height: run.height
        }
      };
    })
    .filter((node): node is SlideTextNode => node !== null);
};

/**
 * 非テキスト要素の検出（簡略化）
 */
const detectNonTextElements = async (
  source: TexImageSource
): Promise<Array<{ bounds: Rectangle; type: string }>> => {
  // 簡略化された実装
  // 実際の実装では、画像解析による要素検出が必要
  return [
    {
      bounds: { x: 100, y: 100, width: 200, height: 100 },
      type: 'graphic'
    },
    {
      bounds: { x: 300, y: 200, width: 150, height: 150 },
      type: 'icon'
    }
  ];
};

/**
 * 準拠スコアの計算
 */
const calculateComplianceScore = (
  issues: Wcag22Issue[],
  targetLevel: 'A' | 'AA' | 'AAA'
): { level: ComplianceLevel; score: number; passedGuidelines: string[]; failedGuidelines: string[] } => {
  // 簡略化された実装
  const totalGuidelines = 12; // WCAG 2.2の主要なガイドライン数
  const failedGuidelines = new Set<string>();
  const passedGuidelines = new Set<string>();
  
  issues.forEach(issue => {
    if (issue.level === targetLevel || (targetLevel === 'AA' && issue.level === 'A')) {
      failedGuidelines.add(issue.guideline);
    }
  });
  
  // 全てのガイドラインを初期化
  for (let i = 1; i <= totalGuidelines; i++) {
    const guideline = `1.4.${i}`;
    if (!failedGuidelines.has(guideline)) {
      passedGuidelines.add(guideline);
    }
  }
  
  const score = Math.round((passedGuidelines.size / totalGuidelines) * 100);
  
  let level: ComplianceLevel = 'non-compliant';
  if (score >= 90) {
    level = targetLevel;
  } else if (score >= 70) {
    level = targetLevel === 'AAA' ? 'AA' : 'A';
  } else if (score >= 50) {
    level = 'A';
  }
  
  return {
    level,
    score,
    passedGuidelines: Array.from(passedGuidelines),
    failedGuidelines: Array.from(failedGuidelines)
  };
};

/**
 * 推奨事項の生成
 */
const generateRecommendations = (
  issues: Wcag22Issue[],
  targetLevel: 'A' | 'AA' | 'AAA'
): Array<{ priority: 'high' | 'medium' | 'low'; description: string; impact: string; effort: 'minimal' | 'moderate' | 'significant' }> => {
  // 簡略化された実装
  const recommendations: Array<{
    priority: 'high' | 'medium' | 'low';
    description: string;
    impact: string;
    effort: 'minimal' | 'moderate' | 'significant';
  }> = [];
  
  // エラーの種類に応じた推奨事項を生成
  const errorTypes = new Set(issues.map(issue => issue.rule));
  
  if (errorTypes.has('1.4.12' as any)) {
    recommendations.push({
      priority: 'high',
      description: 'テキストの行間、段落間、文字間、単語間をWCAG基準に合わせて調整してください',
      impact: '読みやすさの向上',
      effort: 'moderate'
    });
  }
  
  if (errorTypes.has('1.4.11' as any)) {
    recommendations.push({
      priority: 'high',
      description: '非テキスト要素のコントラスト比を3:1以上にしてください',
      impact: '視認性の向上',
      effort: 'minimal'
    });
  }
  
  if (errorTypes.has('font-size')) {
    recommendations.push({
      priority: 'medium',
      description: 'テキストサイズをWCAG基準に合わせて調整してください',
      impact: '読みやすさの向上',
      effort: 'minimal'
    });
  }
  
  if (errorTypes.has('contrast')) {
    recommendations.push({
      priority: 'high',
      description: 'テキストと背景のコントラスト比をWCAG基準に合わせて調整してください',
      impact: '読みやすさの向上',
      effort: 'minimal'
    });
  }
  
  return recommendations;
};

// 型定義の追加
type ComplianceLevel = 'A' | 'AA' | 'AAA' | 'non-compliant';

// APIの実装
export const wcag22Api: Wcag22Api = {
  analyzeDocument,
  analyzeTextSpacing,
  analyzeNonTextContrast,
  simulateColorBlindness,
  applyAdjustments
};