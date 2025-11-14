import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProjectionAsset } from '../utils/fileLoader';
import { useProjectionRenderer } from './useProjectionRenderer';

const INITIAL_BRIGHTNESS = 100;
const INITIAL_CONTRAST = 0;

type UseProjectionManagerReturn = {
  // State
  brightness: number;
  contrast: number;
  asset: ProjectionAsset | null;
  currentFrame: number;
  isLoading: boolean;
  isExporting: boolean;
  projectorEnabled: boolean;
  statusMessage: string | null;
  activeFileName: string | null;
  
  // Actions
  handleFileLoaded: (asset: ProjectionAsset, fileName: string) => void;
  handleBrightnessChange: (value: number) => void;
  handleContrastChange: (value: number) => void;
  handlePageChange: (page: number) => void;
  handleToggleProjector: (enabled: boolean) => void;
  resetAdjustments: () => void;
  handleDownloadCurrentView: () => Promise<void>;
  
  // Renderer
  canvasRef: React.RefObject<HTMLCanvasElement>;
  isReady: boolean;
  imageAspectRatio: number | null;
};

export const useProjectionManager = (): UseProjectionManagerReturn => {
  const [brightness, setBrightness] = useState(INITIAL_BRIGHTNESS);
  const [contrast, setContrast] = useState(INITIAL_CONTRAST);
  const [asset, setAsset] = useState<ProjectionAsset | null>(null);
  const [currentFrame, setCurrentFrame] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [projectorEnabled, setProjectorEnabled] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [activeFileName, setActiveFileName] = useState<string | null>(null);

  const latestAdjustmentsRef = useRef({ brightness: INITIAL_BRIGHTNESS, contrast: INITIAL_CONTRAST });

  const {
    canvasRef,
    isReady,
    loadImage,
    updateAdjustments,
    updateProjectorPreview,
    captureFrame,
    imageAspectRatio,
    resetAspectRatio
  } = useProjectionRenderer();

  const handleFileLoaded = useCallback((newAsset: ProjectionAsset, fileName: string) => {
    setAsset(newAsset);
    setCurrentFrame(1);
    setActiveFileName(fileName);
    setStatusMessage(
      newAsset.pageCount > 1
        ? `${fileName} (${newAsset.pageCount} ページ)`
        : `${fileName} を読み込みました`
    );
    resetAspectRatio();
  }, [resetAspectRatio]);

  const handleBrightnessChange = useCallback((value: number) => {
    setBrightness(value);
    latestAdjustmentsRef.current.brightness = value;
    updateAdjustments({ brightness: value, contrast: latestAdjustmentsRef.current.contrast });
  }, [updateAdjustments]);

  const handleContrastChange = useCallback((value: number) => {
    setContrast(value);
    latestAdjustmentsRef.current.contrast = value;
    updateAdjustments({ brightness: latestAdjustmentsRef.current.brightness, contrast: value });
  }, [updateAdjustments]);

  const handlePageChange = useCallback((page: number) => {
    const total = asset?.pageCount ?? 0;
    const nextPage = Math.min(Math.max(page, 1), total || 1);
    if (nextPage === currentFrame) return;
    
    setCurrentFrame(nextPage);
    if (asset && total > 1 && activeFileName) {
      setStatusMessage(`${activeFileName} (${nextPage} / ${total} ページ)`);
    }
  }, [asset, currentFrame, activeFileName]);

  const handleToggleProjector = useCallback((enabled: boolean) => {
    setProjectorEnabled(enabled);
    if (enabled) {
      updateProjectorPreview({
        enabled: true,
        gamma: 2.2,
        blackLift: 0.12,
        colorTempShift: 0,
        vignette: 0.18,
        hotspot: 0.08
      });
    } else {
      updateProjectorPreview({ enabled: false });
    }
  }, [updateProjectorPreview]);

  const resetAdjustments = useCallback(() => {
    setStatusMessage('設定をリセットしました');
    handleBrightnessChange(INITIAL_BRIGHTNESS);
    handleContrastChange(INITIAL_CONTRAST);
  }, [handleBrightnessChange, handleContrastChange]);

  const handleDownloadCurrentView = useCallback(async () => {
    if (isExporting || !asset || !isReady || isLoading) {
      setStatusMessage('プレビューがまだ準備できていません');
      return;
    }

    const blobToDataUrl = (blob: Blob) =>
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

    const totalPages = asset.pageCount || 1;
    const activeIndex = currentFrame - 1;
    const baseName = activeFileName ? activeFileName.replace(/\.[^/.]+$/, '') : 'ViewSure_Preview';
    const adjustments = { ...latestAdjustmentsRef.current };
    const pageImages: Array<{ dataUrl: string; width: number; height: number }> = [];

    try {
      setIsExporting(true);
      setStatusMessage(
        totalPages > 1
          ? `全 ${totalPages} ページの PDF を準備しています...`
          : 'PDF を準備しています...'
      );

      for (let index = 0; index < totalPages; index += 1) {
        if (totalPages > 1) {
          setStatusMessage(`(${index + 1}/${totalPages}) ページをレンダリング中です...`);
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

      setStatusMessage('PDF を書き出しています...');

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

      restImages.forEach(({ dataUrl, width, height }) => {
        const orientation = width >= height ? 'landscape' : 'portrait';
        pdf.addPage([width, height], orientation);
        pdf.addImage(dataUrl, 'PNG', 0, 0, width, height);
      });

      const pdfFileName = `${baseName}_viewsure.pdf`;
      await pdf.save(pdfFileName, { returnPromise: true });
      setStatusMessage(`PDF をダウンロードしました: ${pdfFileName}`);
    } catch (error) {
      console.error(error);
      setStatusMessage(error instanceof Error ? error.message : 'ダウンロードに失敗しました');
    } finally {
      try {
        if (asset && totalPages > 1) {
          const currentSource = await asset.getFrame(activeIndex);
          await loadImage(currentSource);
          updateAdjustments(adjustments);
        }
      } catch (restoreError) {
        console.error('プレビューの復元に失敗しました', restoreError);
      }
      setIsExporting(false);
    }
  }, [asset, captureFrame, currentFrame, isExporting, isLoading, isReady, loadImage, updateAdjustments, activeFileName]);

  // Effect to load frame when asset or currentFrame changes
  useEffect(() => {
    if (!asset) return;

    let cancelled = false;
    const frameIndex = Math.min(currentFrame - 1, asset.pageCount - 1);

    const renderFrame = async () => {
      const shouldShowLoading = !(asset.hasFrame?.(frameIndex) ?? false);
      if (shouldShowLoading) {
        setIsLoading(true);
      }
      try {
        const source = await asset.getFrame(frameIndex);
        if (cancelled) return;
        
        await loadImage(source);
        const { brightness: targetBrightness, contrast: targetContrast } = latestAdjustmentsRef.current;
        updateAdjustments({ brightness: targetBrightness, contrast: targetContrast });
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setStatusMessage(error instanceof Error ? error.message : 'フレームの描画に失敗しました');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void renderFrame();

    return () => {
      cancelled = true;
    };
  }, [asset, currentFrame, loadImage, updateAdjustments]);

  // Effect to clean up asset on unmount
  useEffect(() => {
    return () => {
      asset?.dispose?.();
    };
  }, [asset]);

  return {
    // State
    brightness,
    contrast,
    asset,
    currentFrame,
    isLoading,
    isExporting,
    projectorEnabled,
    statusMessage,
    activeFileName,
    
    // Actions
    handleFileLoaded,
    handleBrightnessChange,
    handleContrastChange,
    handlePageChange,
    handleToggleProjector,
    resetAdjustments,
    handleDownloadCurrentView,
    
    // Renderer
    canvasRef,
    isReady,
    imageAspectRatio
  };
};