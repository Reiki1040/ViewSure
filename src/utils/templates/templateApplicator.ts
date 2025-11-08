/**
 * テンプレート適用ロジック
 */

import type { 
  AccessibleTemplate, 
  TemplateSlide, 
  TemplateElement, 
  TemplateApplicationOptions,
  TemplateApplicationResult,
  TemplateCustomization
} from '../../types/templates';

import type { ProjectionAsset } from '../fileLoader';

/**
 * テンプレートをプロジェクトに適用する
 */
export const applyTemplateToProject = async (
  template: AccessibleTemplate,
  asset: ProjectionAsset,
  options: TemplateApplicationOptions = {}
): Promise<TemplateApplicationResult> => {
  const appliedSlides: string[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const customizations: TemplateCustomization[] = [];

  try {
    // テンプレートの検証
    if (!template || !template.slides || template.slides.length === 0) {
      errors.push('無効なテンプレートです');
      return {
        success: false,
        appliedSlides: [],
        errors,
        warnings,
        customizations
      };
    }

    // 適用対象のスライドを決定
    const targetSlideIds = options.targetSlideIds || 
      (options.applyToAllSlides ? 
        Array.from({ length: asset.pageCount }, (_, i) => i.toString()) : 
        ['0']); // デフォルトは最初のスライドのみ

    // 各スライドにテンプレートを適用
    for (const slideId of targetSlideIds) {
      const slideIndex = parseInt(slideId, 10);
      
      if (slideIndex >= asset.pageCount) {
        warnings.push(`スライド ${slideId} は存在しません`);
        continue;
      }

      // 適用するテンプレートスライドを選択
      const templateSlide = selectTemplateSlide(template, slideIndex);
      if (!templateSlide) {
        warnings.push(`スライド ${slideIndex} に適用するテンプレートがありません`);
        continue;
      }

      try {
        // スライドにテンプレートを適用
        await applyTemplateToSlide(templateSlide, asset, slideIndex, options);
        appliedSlides.push(slideId);

        // カスタマイズを記録
        if (options.customizations) {
          customizations.push(...options.customizations);
        }
      } catch (error) {
        errors.push(`スライド ${slideId} への適用に失敗しました: ${error}`);
      }
    }

    return {
      success: appliedSlides.length > 0,
      appliedSlides,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      customizations: customizations.length > 0 ? customizations : undefined
    };

  } catch (error) {
    errors.push(`テンプレート適用中にエラーが発生しました: ${error}`);
    return {
      success: false,
      appliedSlides,
      errors,
      warnings,
      customizations
    };
  }
};

/**
 * スライドインデックスに基づいて適用するテンプレートスライドを選択する
 */
const selectTemplateSlide = (
  template: AccessibleTemplate, 
  slideIndex: number
): TemplateSlide | null => {
  // スライドインデックスに基づいてテンプレートスライドを選択
  // タイトルスライド、コンテンツスライド、結論スライドなどを循環
  const slideTypes = ['title-slide', 'content-slide', 'conclusion-slide'];
  const slideTypeIndex = slideIndex === 0 ? 0 : 
    slideIndex === template.slides.length - 1 ? 2 : 1;
  
  const slideType = slideTypes[slideTypeIndex];
  return template.slides.find(slide => slide.id === slideType) || template.slides[0];
};

/**
 * 個別のスライドにテンプレートを適用する
 */
const applyTemplateToSlide = async (
  templateSlide: TemplateSlide,
  asset: ProjectionAsset,
  slideIndex: number,
  options: TemplateApplicationOptions
): Promise<void> => {
  const layout = templateSlide.layout;
  
  // 既存のコンテンツを保持する場合
  if (options.preserveContent) {
    await preserveExistingContent(layout, asset, slideIndex);
  }

  // テンプレートの要素を適用
  for (const element of layout.elements) {
    await applyTemplateElement(element, asset, slideIndex, options);
  }

  // カスタマイズを適用
  if (options.customizations) {
    await applyCustomizations(options.customizations, asset, slideIndex);
  }
};

/**
 * 既存のコンテンツを保持する
 */
const preserveExistingContent = async (
  layout: any,
  asset: ProjectionAsset,
  slideIndex: number
): Promise<void> => {
  try {
    // 既存のテキストコンテンツを取得
    if (typeof asset.getTextContent === 'function') {
      const existingContent = await asset.getTextContent(slideIndex);
      if (existingContent && existingContent.runs) {
        // テンプレートのテキスト要素に既存コンテンツをマージ
        layout.elements.forEach((element: TemplateElement) => {
          if (element.type === 'text' || element.type === 'title' || element.type === 'heading') {
            if (element.placeholder && existingContent.runs.length > 0) {
              // 最初のテキストランをコンテンツとして使用
              element.content = existingContent.runs[0].text;
            }
          }
        });
      }
    }
  } catch (error) {
    console.warn('Failed to preserve existing content:', error);
  }
};

/**
 * テンプレート要素を適用する
 */
const applyTemplateElement = async (
  element: TemplateElement,
  asset: ProjectionAsset,
  slideIndex: number,
  options: TemplateApplicationOptions
): Promise<void> => {
  try {
    // 要素の種類に基づいて適用処理を分岐
    switch (element.type) {
      case 'title':
      case 'heading':
      case 'text':
        await applyTextElement(element, asset, slideIndex);
        break;
      case 'image':
        await applyImageElement(element, asset, slideIndex);
        break;
      case 'list':
        await applyListElement(element, asset, slideIndex);
        break;
      case 'table':
        await applyTableElement(element, asset, slideIndex);
        break;
      case 'caption':
      case 'footer':
        await applyTextElement(element, asset, slideIndex);
        break;
      default:
        console.warn(`Unsupported element type: ${element.type}`);
    }
  } catch (error) {
    console.error(`Failed to apply element ${element.id}:`, error);
    throw error;
  }
};

/**
 * テキスト要素を適用する
 */
const applyTextElement = async (
  element: TemplateElement,
  asset: ProjectionAsset,
  slideIndex: number
): Promise<void> => {
  // テキスト要素のスタイルとコンテンツを適用
  // 実際の実装はアセットの種類（PDF、PPTXなど）に依存
  
  const textData = {
    text: element.content,
    position: element.position,
    style: {
      fontFamily: element.style.fontFamily || 'Arial, sans-serif',
      fontSize: element.style.fontSize || 24,
      fontWeight: element.style.fontWeight || 'normal',
      color: element.style.color || '#000000',
      textAlign: element.style.textAlign || 'left',
      lineHeight: element.style.lineHeight || 1.4
    },
    accessibility: {
      role: element.accessibility.role,
      ariaLabel: element.accessibility.ariaLabel,
      readingOrder: element.accessibility.readingOrder
    }
  };

  // アセットにテキストデータを適用する処理
  // これはアセットの種類に応じた実装が必要
  console.log(`Applying text element to slide ${slideIndex}:`, textData);
};

/**
 * 画像要素を適用する
 */
const applyImageElement = async (
  element: TemplateElement,
  asset: ProjectionAsset,
  slideIndex: number
): Promise<void> => {
  const imageData = {
    position: element.position,
    style: {
      border: element.style.border,
      borderRadius: element.style.borderRadius
    },
    accessibility: {
      role: element.accessibility.role,
      ariaLabel: element.accessibility.ariaLabel,
      readingOrder: element.accessibility.readingOrder
    }
  };

  console.log(`Applying image element to slide ${slideIndex}:`, imageData);
};

/**
 * リスト要素を適用する
 */
const applyListElement = async (
  element: TemplateElement,
  asset: ProjectionAsset,
  slideIndex: number
): Promise<void> => {
  const listData = {
    content: element.content,
    position: element.position,
    style: {
      fontFamily: element.style.fontFamily || 'Arial, sans-serif',
      fontSize: element.style.fontSize || 24,
      color: element.style.color || '#000000',
      lineHeight: element.style.lineHeight || 1.5
    },
    accessibility: {
      role: element.accessibility.role,
      ariaLabel: element.accessibility.ariaLabel,
      readingOrder: element.accessibility.readingOrder
    }
  };

  console.log(`Applying list element to slide ${slideIndex}:`, listData);
};

/**
 * 表要素を適用する
 */
const applyTableElement = async (
  element: TemplateElement,
  asset: ProjectionAsset,
  slideIndex: number
): Promise<void> => {
  const tableData = {
    position: element.position,
    style: {
      border: element.style.border
    },
    accessibility: {
      role: element.accessibility.role,
      ariaLabel: element.accessibility.ariaLabel,
      readingOrder: element.accessibility.readingOrder
    }
  };

  console.log(`Applying table element to slide ${slideIndex}:`, tableData);
};

/**
 * カスタマイズを適用する
 */
const applyCustomizations = async (
  customizations: TemplateCustomization[],
  asset: ProjectionAsset,
  slideIndex: number
): Promise<void> => {
  for (const customization of customizations) {
    try {
      await applyCustomization(customization, asset, slideIndex);
    } catch (error) {
      console.error(`Failed to apply customization ${customization.elementId}:`, error);
    }
  }
};

/**
 * 個別のカスタマイズを適用する
 */
const applyCustomization = async (
  customization: TemplateCustomization,
  asset: ProjectionAsset,
  slideIndex: number
): Promise<void> => {
  const { elementId, property, value } = customization;
  
  // 要素を特定してプロパティを更新
  console.log(`Applying customization to ${elementId}: ${property} = ${value}`);
  
  // 実際の実装はアセットの種類に依存
  switch (property) {
    case 'content':
      // コンテンツを更新
      break;
    case 'position':
      // 位置を更新
      break;
    default:
      // スタイルプロパティを更新
      break;
  }
};

/**
 * テンプレート適用のプレビューを生成する
 */
export const generateTemplatePreview = async (
  template: AccessibleTemplate,
  slideIndex: number = 0
): Promise<string> => {
  const templateSlide = selectTemplateSlide(template, slideIndex);
  if (!templateSlide) {
    throw new Error(`Template slide not found for index ${slideIndex}`);
  }

  // プレビュー画像を生成
  // 実際の実装ではCanvasを使用してプレビューを生成
  const canvas = document.createElement('canvas');
  canvas.width = templateSlide.layout.width;
  canvas.height = templateSlide.layout.height;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // 背景を描画
  ctx.fillStyle = templateSlide.layout.backgroundColor || '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 要素を描画
  for (const element of templateSlide.layout.elements) {
    await drawElementPreview(ctx, element);
  }

  return canvas.toDataURL('image/png');
};

/**
 * 要素のプレビューを描画する
 */
const drawElementPreview = async (
  ctx: CanvasRenderingContext2D,
  element: TemplateElement
): Promise<void> => {
  const { position, style, content } = element;

  ctx.save();
  
  // テキスト要素の場合
  if (element.type === 'title' || element.type === 'heading' || element.type === 'text') {
    ctx.fillStyle = style.color || '#000000';
    ctx.font = `${style.fontWeight || 'normal'} ${style.fontSize || 24}px ${style.fontFamily || 'Arial, sans-serif'}`;
    ctx.textAlign = style.textAlign as CanvasTextAlign || 'left';
    
    const lines = content.split('\n');
    const lineHeight = (style.lineHeight || 1.4) * (style.fontSize || 24);
    
    lines.forEach((line, index) => {
      const y = position.y + (index + 1) * lineHeight;
      ctx.fillText(line, position.x, y);
    });
  }
  
  // 画像要素の場合
  else if (element.type === 'image') {
    ctx.strokeStyle = '#CCCCCC';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(position.x, position.y, position.width, position.height);
    
    ctx.fillStyle = '#F0F0F0';
    ctx.fillRect(position.x, position.y, position.width, position.height);
    
    ctx.fillStyle = '#666666';
    ctx.font = '16px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('画像', position.x + position.width / 2, position.y + position.height / 2);
  }
  
  ctx.restore();
};