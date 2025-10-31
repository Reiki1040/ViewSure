import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FileUploader, { type FileUploaderHandle } from './components/FileUploader';
import ProjectionControls from './components/ProjectionControls';
import WcagSummary from './components/WcagSummary';
import ProjectionViewport from './components/ProjectionViewport';
import WcagPreviewPanel from './components/WcagPreviewPanel';
import TopMenuBar from './components/TopMenuBar';
import LandingScreen from './components/LandingScreen';
import { useProjectionRenderer } from './hooks/useProjectionRenderer';
import { loadProjectionAsset, type ProjectionAsset } from './utils/fileLoader';
import { useAuth } from './context/AuthContext';
import { useWcagHelper } from './hooks/useWcagHelper';

const INITIAL_BRIGHTNESS = 100;
const INITIAL_CONTRAST = 0;
const DEFAULT_WCAG_ASPECT = 9 / 16;

type ProjectionStudioAppProps = {
  onBackToLanding?: () => void;
};

const ProjectionStudioApp = ({ onBackToLanding }: ProjectionStudioAppProps) => {
  const { user, signOut } = useAuth();
  const [brightness, setBrightness] = useState(INITIAL_BRIGHTNESS);
  const [contrast, setContrast] = useState(INITIAL_CONTRAST);
  const [statusMessage, setStatusMessage] = useState<string | null>('ファイルをアップロードしてください');
  const [activeFileName, setActiveFileName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const {
    canvasRef,
    isReady,
    loadImage,
    updateAdjustments,
    updateProjectorPreview,
    captureFrame,
    imageAspectRatio,
    resetAspectRatio,
    updateAspectRatio
  } = useProjectionRenderer();
  const [asset, setAsset] = useState<ProjectionAsset | null>(null);
  const [currentFrame, setCurrentFrame] = useState(1);
  const latestAdjustmentsRef = useRef({ brightness: INITIAL_BRIGHTNESS, contrast: INITIAL_CONTRAST });
  const fileUploaderRef = useRef<FileUploaderHandle | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [wcagAspectRatio, setWcagAspectRatio] = useState(DEFAULT_WCAG_ASPECT);
  const initialViewportAspectRef = useRef<number | null>(null);
  const [lockedViewportAspect, setLockedViewportAspect] = useState<number | null>(null);
  const [projectorEnabled, setProjectorEnabled] = useState(false);
    const {
    analysis,
    analysisError,
    isAnalyzing,
    isApplying,
    fontAdjustments,
    applyAdjustments,
    clearAdjustments,
    getTextOverlayPayload
  } = useWcagHelper({
    asset,
    brightness,
    contrast,
    setBrightness,
    setContrast,
    setStatusMessage
  });

  const handleFileSelected = useCallback(async (file: File) => {
    setIsLoading(true);
    setStatusMessage(null);

    try {
      initialViewportAspectRef.current = null;
      setLockedViewportAspect(null);
      resetAspectRatio();
      console.debug('[App] New file selected, clearing aspect ratio state');
      const projectionAsset = await loadProjectionAsset(file);
      setCurrentFrame(1);
      setAsset(projectionAsset);
      setActiveFileName(file.name);
      setStatusMessage(
        projectionAsset.pageCount > 1
          ? `${file.name} (${projectionAsset.pageCount} ページ)`
          : `${file.name} を読み込みました`
      ); //testcomment
    } catch (error) {
      console.error(error);
      setStatusMessage(error instanceof Error ? error.message : '読み込みに失敗しました');
      setIsLoading(false);
      setActiveFileName(null);
    }
  }, [resetAspectRatio]);

  const resetAdjustments = useCallback(() => {
    setBrightness(INITIAL_BRIGHTNESS);
    setContrast(INITIAL_CONTRAST);
  }, []);

  const handleOpenFileDialog = useCallback(() => {
    if (isLoading || isExporting) {
      return;
    }
    fileUploaderRef.current?.openFileDialog();
  }, [isExporting, isLoading]);

  const handleDownloadCurrentView = useCallback(async () => {
    if (isExporting) {
      return;
    }
    if (!asset || !isReady || isLoading) {
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
    const adjustments = { brightness, contrast };
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
      try {
        await pdf.save(pdfFileName, { returnPromise: true });
        if (totalPages > 1) {
          setStatusMessage(`全 ${totalPages} ページを含む PDF をダウンロードしました: ${pdfFileName}`);
        } else {
          setStatusMessage(`PDF をダウンロードしました: ${pdfFileName}`);
        }
      } catch (saveError) {
        console.error('PDF の保存に失敗しました', saveError);
        setStatusMessage('PDF の保存に失敗しました');
      }
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
  }, [
    activeFileName,
    asset,
    brightness,
    captureFrame,
    contrast,
    currentFrame,
    isExporting,
    isLoading,
    isReady,
    loadImage,
    updateAdjustments
  ]);

  // WCAG プレビュー用のテキストオーバーレイとアスペクト
  const textOverlay = useMemo(
    () => getTextOverlayPayload(currentFrame - 1),
    [currentFrame, getTextOverlayPayload]
  );
  const effectiveViewportAspect = lockedViewportAspect ?? imageAspectRatio ?? wcagAspectRatio;

  useEffect(() => {
    if (!analysis || !analysis.slides.length) {
      setWcagAspectRatio(DEFAULT_WCAG_ASPECT);
      return;
    }
    const baseSlide = analysis.slides[0];
    if (baseSlide.width > 0 && baseSlide.height > 0) {
      setWcagAspectRatio(baseSlide.height / baseSlide.width);
    } else {
      setWcagAspectRatio(DEFAULT_WCAG_ASPECT);
    }
  }, [analysis]);

  // ページングとダウンロード可否
  const pageCount = asset?.pageCount ?? 0;
  const canGoPrev = pageCount > 1 && currentFrame > 1;
  const canGoNext = pageCount > 1 && currentFrame < pageCount;
  const canDownload = Boolean(asset) && isReady && !isLoading && !isExporting;
  const hasWcagAdjustments = Boolean(fontAdjustments);
  const wcagProcessing = isApplying || isAnalyzing;
  const wcagProcessingMessage = isApplying ? '適用中...' : isAnalyzing ? '解析中...' : undefined;

  const handlePageChange = useCallback(
    (page: number) => {
      const total = asset?.pageCount ?? 0;
      const nextPage = Math.min(Math.max(page, 1), total || 1);
      if (nextPage === currentFrame) {
        if (asset && total > 1 && activeFileName) {
          setStatusMessage(`${activeFileName} (${nextPage} / ${total} ページ)`);
        }
        return;
      }
      setCurrentFrame(nextPage);
      if (asset && total > 1 && activeFileName) {
        setStatusMessage(`${activeFileName} (${nextPage} / ${total} ページ)`);
      }
    },
    [activeFileName, asset, currentFrame]
  );

  const goToPrevious = useCallback(() => {
    if (canGoPrev) {
      handlePageChange(currentFrame - 1);
    }
  }, [canGoPrev, currentFrame, handlePageChange]);

  const goToNext = useCallback(() => {
    if (canGoNext) {
      handlePageChange(currentFrame + 1);
    }
  }, [canGoNext, currentFrame, handlePageChange]);

  // プロジェクタープレビュー（投影シミュレーション）トグル
  const handleToggleProjector = useCallback(
    (enabled: boolean) => {
      setProjectorEnabled(enabled);
      if (enabled) {
        updateProjectorPreview({
          enabled: true,
          gamma: 2.2,
          blackLift: 0.12,
          colorTempShift: 0.0,
          vignette: 0.18,
          hotspot: 0.08
        });
      } else {
        updateProjectorPreview({ enabled: false });
      }
    },
    [updateProjectorPreview]
  );

  // 現在ページのフレームを描画
  useEffect(() => {
    let cancelled = false;
    const currentAsset = asset;
    if (!currentAsset || currentAsset.pageCount === 0) {
      return () => {
        cancelled = true;
      };
    }

    const frameIndex = Math.min(currentFrame - 1, currentAsset.pageCount - 1);

    const renderFrame = async () => {
      const shouldShowLoading = !(currentAsset.hasFrame?.(frameIndex) ?? false);
      if (shouldShowLoading) {
        setIsLoading(true);
      }
      try {
        const source = await currentAsset.getFrame(frameIndex);
        if (cancelled) {
          return;
        }
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

  const handleSignOut = useCallback(() => {
    signOut();
    onBackToLanding?.();
  }, [onBackToLanding, signOut]);

  useEffect(() => {
    return () => {
      asset?.dispose?.();
    };
  }, [asset]);

  return (
    <div className="app-root">
      <TopMenuBar
        onBackToLanding={onBackToLanding}
        onSignOut={user ? handleSignOut : undefined}
        user={user ? { name: user.name, avatarUrl: user.picture } : undefined}
        onOpenFile={handleOpenFileDialog}
        onReset={resetAdjustments}
        onGoPrev={goToPrevious}
        onGoNext={goToNext}
        onDownload={handleDownloadCurrentView}
        statusMessage={statusMessage}
        canGoPrev={canGoPrev}
        canGoNext={canGoNext}
        canDownload={canDownload}
        isBusy={isLoading || isExporting || isApplying}
      />
      <div className="app-shell">
        <aside className="control-panel">
          <div className="branding" />
          <div className="control-panel__body">
            <FileUploader
              ref={fileUploaderRef}
              disabled={isLoading || isExporting}
              onFileSelected={handleFileSelected}
              statusMessage={statusMessage}
            />
            <ProjectionControls
              brightness={brightness}
              contrast={contrast}
              disabled={!isReady || isLoading || isExporting || isApplying}
              onBrightnessChange={setBrightness}
              onContrastChange={setContrast}
              onReset={resetAdjustments}
              pageCount={pageCount || undefined}
              currentPage={asset ? currentFrame : undefined}
              onRequestWcagCheck={applyAdjustments}
              wcagDisabled={!analysis || isApplying || isLoading || isExporting}
              onClearWcagAdjustments={clearAdjustments}
              showWcagClearButton={hasWcagAdjustments}
              wcagClearDisabled={isApplying || isLoading || isExporting}
              wcagProcessing={wcagProcessing}
              wcagProcessingMessage={wcagProcessingMessage}
              projectorEnabled={projectorEnabled}
              onToggleProjector={handleToggleProjector}
            />
            <WcagSummary
              analysis={analysis}
              isAnalyzing={isAnalyzing}
              error={analysisError}
              fontAdjustments={fontAdjustments}
              onFocusSlide={(page) => {
                if (!asset) {
                  return;
                }
                setCurrentFrame(page);
              }}
            />
          </div>
        </aside>
        <main className="viewport-container">
          <ProjectionViewport
            canvasRef={canvasRef}
            isLoading={isLoading}
            isReady={isReady}
            canGoPrev={canGoPrev}
            canGoNext={canGoNext}
            onGoPrev={goToPrevious}
            onGoNext={goToNext}
            aspectRatio={effectiveViewportAspect}
            textOverlay={null}
          />
          <WcagPreviewPanel
            overlay={textOverlay}
            aspectRatio={effectiveViewportAspect}
            isBusy={!isReady || isLoading || isApplying || isAnalyzing}
          />
        </main>
      </div>
      {isExporting || isApplying ? (
        <div className="app-overlay" role="status" aria-live="assertive">
          <div className="transition-overlay__spinner" aria-hidden="true" />
          <p className="app-overlay__message">
            {isApplying ? 'WCAG 調整を適用しています...' : 'PDF を保存しています...'}
          </p>
        </div>
      ) : null}
    </div>
  );
};

const App = () => {
  const [showLanding, setShowLanding] = useState(() => {
    if (typeof window === 'undefined') {
      return true;
    }
    return window.location.hash !== '#app';
  });
  const hasLandingHistoryRef = useRef(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const handleHashChange = () => {
      setShowLanding(window.location.hash !== '#app');
      if (window.location.hash !== '#app') {
        hasLandingHistoryRef.current = false;
        setIsTransitioning(false);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  useEffect(() => {
    if (!showLanding) {
      const timer = window.setTimeout(() => {
        setIsTransitioning(false);
      }, 500);
      return () => {
        window.clearTimeout(timer);
      };
    }
    setIsTransitioning(false);
    return undefined;
  }, [showLanding]);

  const handleEnterApp = useCallback(() => {
    if (isTransitioning) {
      return;
    }
    setIsTransitioning(true);
    if (typeof window !== 'undefined' && window.location.hash !== '#app') {
      window.location.hash = 'app';
      hasLandingHistoryRef.current = true;
    }
    if (transitionTimeoutRef.current !== null) {
      window.clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }
    transitionTimeoutRef.current = window.setTimeout(() => {
      setShowLanding(false);
      transitionTimeoutRef.current = null;
    }, 250);
  }, [isTransitioning]);

  const handleBackToLanding = useCallback(() => {
    if (typeof window !== 'undefined') {
      if (window.location.hash === '#app' && hasLandingHistoryRef.current) {
        window.history.back();
      } else {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        hasLandingHistoryRef.current = false;
      }
    }
    setIsTransitioning(false);
    setShowLanding(true);
  }, []);

  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current !== null) {
        window.clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      {showLanding ? (
        <LandingScreen onStart={handleEnterApp} />
      ) : (
        <ProjectionStudioApp onBackToLanding={handleBackToLanding} />
      )}
      {isTransitioning ? (
        <div className="transition-overlay" role="status" aria-live="polite">
          <div className="transition-overlay__spinner" aria-hidden="true" />
          <p className="transition-overlay__message">ViewSure を起動しています...</p>
        </div>
      ) : null}
    </>
  );
};

export default App;

