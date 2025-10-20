import { useCallback, useEffect, useRef, useState } from 'react';
import FileUploader, { type FileUploaderHandle } from './components/FileUploader';
import ProjectionControls from './components/ProjectionControls';
import ProjectionViewport from './components/ProjectionViewport';
import TopMenuBar from './components/TopMenuBar';
import LandingScreen from './components/LandingScreen';
import { useProjectionRenderer } from './hooks/useProjectionRenderer';
import { loadProjectionAsset, type ProjectionAsset } from './utils/fileLoader';
import { useAuth } from './context/AuthContext';

const INITIAL_BRIGHTNESS = 100;
const INITIAL_CONTRAST = 0;

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
  const { canvasRef, isReady, loadImage, updateAdjustments, captureFrame } = useProjectionRenderer();
  const [asset, setAsset] = useState<ProjectionAsset | null>(null);
  const [currentFrame, setCurrentFrame] = useState(1);
  const latestAdjustmentsRef = useRef({ brightness: INITIAL_BRIGHTNESS, contrast: INITIAL_CONTRAST });
  const fileUploaderRef = useRef<FileUploaderHandle | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleFileSelected = useCallback(async (file: File) => {
    setIsLoading(true);
    setStatusMessage(null);

    try {
      const projectionAsset = await loadProjectionAsset(file);
      setCurrentFrame(1);
      setAsset(projectionAsset);
      setActiveFileName(file.name);
      setStatusMessage(
        projectionAsset.pageCount > 1
          ? `${file.name} (${projectionAsset.pageCount} ページ)`
          : `${file.name} を読み込みました`
      );
    } catch (error) {
      console.error(error);
      setStatusMessage(error instanceof Error ? error.message : '読み込みに失敗しました');
      setIsLoading(false);
      setActiveFileName(null);
    }
  }, []);

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

  useEffect(() => {
    latestAdjustmentsRef.current = { brightness, contrast };
    updateAdjustments({ brightness, contrast });
  }, [brightness, contrast, updateAdjustments]);

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

  const handlePageChange = useCallback(
    (page: number) => {
      const pageCount = asset?.pageCount ?? 0;
      const nextPage = Math.min(Math.max(page, 1), pageCount || 1);

      if (nextPage === currentFrame) {
        if (asset && pageCount > 1 && activeFileName) {
          setStatusMessage(`${activeFileName} (${nextPage} / ${pageCount} ページ)`);
        }
        return;
      }

      setCurrentFrame(nextPage);
      if (asset && pageCount > 1 && activeFileName) {
        setStatusMessage(`${activeFileName} (${nextPage} / ${pageCount} ページ)`);
      }
    },
    [activeFileName, asset, currentFrame]
  );

  const pageCount = asset?.pageCount ?? 0;
  const canGoPrev = pageCount > 1 && currentFrame > 1;
  const canGoNext = pageCount > 1 && currentFrame < pageCount;
  const canDownload = Boolean(asset) && isReady && !isLoading && !isExporting;

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
        isBusy={isLoading || isExporting}
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
              disabled={!isReady || isLoading || isExporting}
              onBrightnessChange={setBrightness}
              onContrastChange={setContrast}
              onReset={resetAdjustments}
              pageCount={pageCount || undefined}
              currentPage={asset ? currentFrame : undefined}
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
          />
        </main>
      </div>
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

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const handleHashChange = () => {
      setShowLanding(window.location.hash !== '#app');
      if (window.location.hash !== '#app') {
        hasLandingHistoryRef.current = false;
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  const handleEnterApp = useCallback(() => {
    if (typeof window !== 'undefined' && window.location.hash !== '#app') {
      window.location.hash = 'app';
      hasLandingHistoryRef.current = true;
    }
    setShowLanding(false);
  }, []);

  const handleBackToLanding = useCallback(() => {
    if (typeof window !== 'undefined') {
      if (window.location.hash === '#app' && hasLandingHistoryRef.current) {
        window.history.back();
      } else {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        hasLandingHistoryRef.current = false;
      }
    }
    setShowLanding(true);
  }, []);

  if (showLanding) {
    return <LandingScreen onStart={handleEnterApp} />;
  }

  return <ProjectionStudioApp onBackToLanding={handleBackToLanding} />;
};

export default App;
