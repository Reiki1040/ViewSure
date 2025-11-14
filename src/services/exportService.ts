/**
 * PDFエクスポートサービス
 *
 * このサービスはViewSureアプリケーションのPDF生成とエクスポート機能を担当します。
 * 複数ページのPDF生成、進行状況の追跡、エラー処理、メモリ管理を提供します。
 *
 * 主要機能:
 * - 複数ページのPDF生成と結合
 * - エクスポート進行状況の追跡と表示
 * - エラー処理とリカバリ
 * - メモリ効率の良いページレンダリング
 * - 現在のビューの単一フレームエクスポート
 */
import type { ProjectionAsset } from '../utils/fileLoader';
import type { CaptureFrameResult } from '../hooks/useProjectionRenderer';

export interface ExportOptions {
  asset: ProjectionAsset;
  activeFileName: string | null;
  currentFrame: number;
  brightness: number;
  contrast: number;
  captureFrame: () => Promise<CaptureFrameResult>;
  loadImage: (source: TexImageSource) => Promise<void>;
  updateAdjustments: (adjustments: { brightness: number; contrast: number }) => void;
}

export interface ExportProgress {
  current: number;
  total: number;
  message: string;
}

export interface ExportResult {
  success: boolean;
  fileName?: string;
  error?: string;
}

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('画像データの変換に失敗しました'));
      }
    };
    reader.onerror = () => reject(new Error('画像データの変換に失敗しました'));
    reader.readAsDataURL(blob);
  });

export class ExportService {
  private static instance: ExportService;

  public static getInstance(): ExportService {
    if (!ExportService.instance) {
      ExportService.instance = new ExportService();
    }
    return ExportService.instance;
  }

  async exportToPdf(
    options: ExportOptions,
    onProgress?: (progress: ExportProgress) => void
  ): Promise<ExportResult> {
    const {
      asset,
      activeFileName,
      currentFrame,
      brightness,
      contrast,
      captureFrame,
      loadImage,
      updateAdjustments
    } = options;

    if (!asset) {
      return { success: false, error: 'アセットが読み込まれていません' };
    }

    const totalPages = asset.pageCount || 1;
    const activeIndex = currentFrame - 1;
    const baseName = activeFileName ? activeFileName.replace(/\.[^/.]+$/, '') : 'ViewSure_Preview';
    const adjustments = { brightness, contrast };
    const pageImages: Array<{ dataUrl: string; width: number; height: number }> = [];

    try {
      onProgress?.({
        current: 0,
        total: totalPages,
        message: totalPages > 1
          ? `全 ${totalPages} ページの PDF を準備しています...`
          : 'PDF を準備しています...'
      });

      // Render all pages
      for (let index = 0; index < totalPages; index += 1) {
        if (totalPages > 1) {
          onProgress?.({
            current: index + 1,
            total: totalPages,
            message: `(${index + 1}/${totalPages}) ページをレンダリング中です...`
          });
        }

        const source = await asset.getFrame(index);
        await loadImage(source);
        updateAdjustments(adjustments);
        const { blob, width, height } = await captureFrame();
        const dataUrl = await blobToDataUrl(blob);
        pageImages.push({ dataUrl, width, height });
      }

      if (pageImages.length === 0) {
        throw new Error('PDF 生成対象のページがありません');
      }

      onProgress?.({
        current: totalPages,
        total: totalPages,
        message: 'PDF を書き出しています...'
      });

      // Create PDF document
      const [{ dataUrl: firstImage, width: firstWidth, height: firstHeight }, ...restImages] = pageImages;
      const { jsPDF } = await import('jspdf');
      const firstOrientation = firstWidth >= firstHeight ? 'landscape' : 'portrait';
      const pdf = new jsPDF({
        orientation: firstOrientation,
        unit: 'px',
        format: [firstWidth, firstHeight],
        compress: true
      });

      pdf.addImage(firstImage, 'PNG', 0, 0, firstWidth, firstHeight);

      // Add remaining pages
      restImages.forEach(({ dataUrl, width, height }) => {
        const orientation = width >= height ? 'landscape' : 'portrait';
        pdf.addPage([width, height], orientation);
        pdf.addImage(dataUrl, 'PNG', 0, 0, width, height);
      });

      const pdfFileName = `${baseName}_viewsure.pdf`;
      await pdf.save(pdfFileName, { returnPromise: true });

      // Restore original view
      if (asset && totalPages > 1) {
        try {
          const currentSource = await asset.getFrame(activeIndex);
          await loadImage(currentSource);
          updateAdjustments(adjustments);
        } catch (restoreError) {
          console.error('プレビューの復元に失敗しました', restoreError);
        }
      }

      return { success: true, fileName: pdfFileName };
    } catch (error) {
      console.error('PDF エクスポートエラー:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'ダウンロードに失敗しました'
      };
    }
  }

  async exportCurrentFrame(
    captureFrame: () => Promise<CaptureFrameResult>,
    fileName: string = 'ViewSure_Frame.png'
  ): Promise<ExportResult> {
    try {
      const { blob } = await captureFrame();
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      return { success: true, fileName };
    } catch (error) {
      console.error('フレームエクスポートエラー:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'フレームのエクスポートに失敗しました'
      };
    }
  }
}

export const exportService = ExportService.getInstance();