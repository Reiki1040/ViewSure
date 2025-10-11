import { useCallback, useEffect, useMemo, useState } from 'react';
import FileUploader from './components/FileUploader';
import ProjectionControls from './components/ProjectionControls';
import ProjectionViewport from './components/ProjectionViewport';
import { useProjectionRenderer } from './hooks/useProjectionRenderer';
import { loadProjectionAsset, type ProjectionAsset } from './utils/fileLoader';

const INITIAL_BRIGHTNESS = 100;
const INITIAL_CONTRAST = 0;

const App = () => {
  const [brightness, setBrightness] = useState(INITIAL_BRIGHTNESS);
  const [contrast, setContrast] = useState(INITIAL_CONTRAST);
  const [statusMessage, setStatusMessage] = useState<string | null>('ファイルをアップロードしてください');
  const [activeFileName, setActiveFileName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { canvasRef, isReady, loadImage, updateAdjustments } = useProjectionRenderer();
  const [asset, setAsset] = useState<ProjectionAsset | null>(null);
  const [currentFrame, setCurrentFrame] = useState(1);

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

  useEffect(() => {
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
        updateAdjustments({ brightness, contrast });
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
  }, [asset, brightness, contrast, currentFrame, loadImage, updateAdjustments]);

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

  const helpers = useMemo(
    () => ({
      resetAdjustments
    }),
    [resetAdjustments]
  );

  useEffect(() => {
    return () => {
      asset?.dispose?.();
    };
  }, [asset]);

  return (
    <div className="app-shell">
      <aside className="control-panel">
        <div className="branding">
          <h1 className="branding__title">ViewSure Projection Studio</h1>
          <p className="branding__tagline">投影前に、照度とコントラストをブラウザ上でシミュレートするツール</p>
        </div>
        <div className="control-panel__body">
          <FileUploader
            disabled={isLoading}
            onFileSelected={handleFileSelected}
            statusMessage={statusMessage}
          />
          <ProjectionControls
            brightness={brightness}
            contrast={contrast}
            disabled={!isReady || isLoading}
            onBrightnessChange={setBrightness}
            onContrastChange={setContrast}
            onReset={helpers.resetAdjustments}
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
  );
};

export default App;
