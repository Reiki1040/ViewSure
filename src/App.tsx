import { useCallback, useEffect, useRef, useState } from 'react';
import FileUploader, { type FileUploaderHandle } from './components/FileUploader';
import ProjectionViewport from './components/ProjectionViewport';
import LandingScreen from './components/LandingScreen';
import { useProjectionRenderer } from './hooks/useProjectionRenderer';
import { useWcagHelper } from './hooks/useWcagHelper';
import { loadProjectionAsset, type ProjectionAsset } from './utils/fileLoader';

const INITIAL_BRIGHTNESS = 100;
const INITIAL_CONTRAST = 0;
const DEFAULT_WCAG_ASPECT = 9 / 16;
const INITIAL_STATUS_MESSAGE = 'PDF または画像ファイルを読み込んでください';

const App = () => {
  const [brightness, setBrightnessState] = useState(INITIAL_BRIGHTNESS);
  const [contrast, setContrastState] = useState(INITIAL_CONTRAST);
  const [statusMessage, setStatusMessage] = useState<string | null>(INITIAL_STATUS_MESSAGE);
  const [activeFileName, setActiveFileName] = useState<string | null>(null);
  const [asset, setAsset] = useState<ProjectionAsset | null>(null);
  const [currentFrame, setCurrentFrame] = useState(1);
  const [pageInputValue, setPageInputValue] = useState('1');
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [projectorEnabled, setProjectorEnabled] = useState(false);
  const [isLandingVisible, setIsLandingVisible] = useState(true);
  const [wcagAspectRatio, setWcagAspectRatio] = useState(DEFAULT_WCAG_ASPECT);
  const [lockedViewportAspect, setLockedViewportAspect] = useState<number | null>(null);
  const initialViewportAspectRef = useRef<number | null>(null);
  const latestAdjustmentsRef = useRef({ brightness: INITIAL_BRIGHTNESS, contrast: INITIAL_CONTRAST });
  const fileUploaderRef = useRef<FileUploaderHandle | null>(null);

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

  const applyAdjustmentsToRenderer = useCallback(
    (nextBrightness: number, nextContrast: number) => {
      latestAdjustmentsRef.current = { brightness: nextBrightness, contrast: nextContrast };
      updateAdjustments({ brightness: nextBrightness, contrast: nextContrast });
    },
    [updateAdjustments]
  );

  const handleBrightnessChange = useCallback(
    (value: number) => {
      setBrightnessState(value);
      applyAdjustmentsToRenderer(value, latestAdjustmentsRef.current.contrast);
    },
    [applyAdjustmentsToRenderer]
  );

  const handleContrastChange = useCallback(
    (value: number) => {
      setContrastState(value);
      applyAdjustmentsToRenderer(latestAdjustmentsRef.current.brightness, value);
    },
    [applyAdjustmentsToRenderer]
  );

  const {
    analysis,
    isAnalyzing,
    isApplying,
    applyAdjustments: applyWcagAdjustments,
    clearAdjustments,
    fontAdjustments
  } = useWcagHelper({
    asset,
    brightness,
    contrast,
    setBrightness: handleBrightnessChange,
    setContrast: handleContrastChange,
    setStatusMessage
  });

  const handleFileSelected = useCallback(
    async (file: File) => {
      setIsLoading(true);
      setStatusMessage(null);

      try {
        initialViewportAspectRef.current = null;
        setLockedViewportAspect(null);
        resetAspectRatio();
        const projectionAsset = await loadProjectionAsset(file);
        setAsset(projectionAsset);
        setCurrentFrame(1);
        setPageInputValue('1');
        setActiveFileName(file.name);
        setStatusMessage(
          projectionAsset.pageCount > 1
            ? `${file.name} (${projectionAsset.pageCount} ページ)`
            : `${file.name} を読み込みました`
        );
      } catch (error) {
        console.error(error);
        setAsset(null);
        setActiveFileName(null);
        setStatusMessage(error instanceof Error ? error.message : '読み込みに失敗しました');
      } finally {
        setIsLoading(false);
      }
    },
    [resetAspectRatio]
  );

  const resetAdjustments = useCallback(() => {
    setStatusMessage('設定をリセットしました');
    handleBrightnessChange(INITIAL_BRIGHTNESS);
    handleContrastChange(INITIAL_CONTRAST);
    clearAdjustments();
  }, [clearAdjustments, handleBrightnessChange, handleContrastChange]);

  const handleOpenFileDialog = useCallback(() => {
    if (isLoading || isExporting) {
      return;
    }
    fileUploaderRef.current?.openFileDialog();
  }, [isExporting, isLoading]);

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
  }, [activeFileName, asset, captureFrame, currentFrame, isExporting, isLoading, isReady, loadImage, updateAdjustments]);

  const handlePageChange = useCallback(
    (page: number) => {
      const total = asset?.pageCount ?? 0;
      const nextPage = Math.min(Math.max(page, 1), total || 1);
      if (nextPage === currentFrame) {
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
    if (asset && currentFrame > 1) {
      handlePageChange(currentFrame - 1);
    }
  }, [asset, currentFrame, handlePageChange]);

  const goToNext = useCallback(() => {
    if (asset && currentFrame < (asset.pageCount || 1)) {
      handlePageChange(currentFrame + 1);
    }
  }, [asset, currentFrame, handlePageChange]);

  const handlePageInputCommit = useCallback(() => {
    const total = asset?.pageCount ?? 0;
    if (total < 1) {
      return;
    }
    const parsed = Number(pageInputValue);
    if (!Number.isFinite(parsed)) {
      return;
    }
    handlePageChange(parsed);
  }, [asset, pageInputValue, handlePageChange]);

  const handleToggleProjector = useCallback(
    (enabled: boolean) => {
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
    },
    [updateProjectorPreview]
  );

  useEffect(() => {
    if (!asset) {
      return;
    }

    let cancelled = false;
    const frameIndex = Math.min(currentFrame - 1, asset.pageCount - 1);

    const renderFrame = async () => {
      const shouldShowLoading = !(asset.hasFrame?.(frameIndex) ?? false);
      if (shouldShowLoading) {
        setIsLoading(true);
      }
      try {
        const source = await asset.getFrame(frameIndex);
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

  useEffect(() => {
    return () => {
      asset?.dispose?.();
    };
  }, [asset]);

  useEffect(() => {
    setPageInputValue(String(currentFrame));
  }, [currentFrame]);

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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return;
      }

      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        goToPrevious();
        return;
      }
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        goToNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [goToNext, goToPrevious]);

  const pageCount = asset?.pageCount ?? 0;
  const sliderMax = Math.max(pageCount, 1);
  const sliderValue = Math.min(currentFrame, sliderMax);
  const sliderDisabled = !asset || pageCount <= 1;
  const canDownload = Boolean(asset) && isReady && !isLoading && !isExporting;
  const wcagProcessing = isApplying || isAnalyzing;
  const hasWcagAdjustments = Boolean(fontAdjustments);
  const effectiveViewportAspect = lockedViewportAspect ?? imageAspectRatio ?? wcagAspectRatio;
  const hasAsset = Boolean(asset);
  const heroStatus = statusMessage ?? '準備完了。PDF / PPTX / 画像ファイルをドラッグ＆ドロップしてください。';

  if (isLandingVisible) {
    return <LandingScreen onStart={() => setIsLandingVisible(false)} />;
  }

  return (
    <div className="hero-app">
      <header className="hero-header" aria-labelledby="hero-title">
        <div>
          <h1 id="hero-title">View Sureでプロジェクタ映えする資料へ</h1>
          <p>
            スライドをWCAGに基づき最適化。プロジェクター環境でのシミュレーションを実行し、仕上がりをワンランク上へ。
          </p>
        </div>
      </header>
      <main className="hero-stage">
        <div className={`hero-stage__panel${hasAsset ? ' hero-stage__panel--viewer' : ''}`}>
          <div className={`hero-uploader${hasAsset ? ' hero-uploader--hidden' : ''}`}>
            <FileUploader
              ref={fileUploaderRef}
              disabled={isLoading || isExporting}
              onFileSelected={handleFileSelected}
              statusMessage={statusMessage}
            />
          </div>
          {hasAsset ? (
            <div className="hero-viewport">
              <ProjectionViewport
                canvasRef={canvasRef}
                isLoading={isLoading}
                isReady={isReady}
                canGoPrev={!sliderDisabled && currentFrame > 1}
                canGoNext={!sliderDisabled && currentFrame < sliderMax}
                onGoPrev={goToPrevious}
                onGoNext={goToNext}
                aspectRatio={effectiveViewportAspect}
                textOverlay={null}
              />
            </div>
          ) : null}
        </div>
        <p className="hero-stage__status" role="status" aria-live="polite">
          {heroStatus}
        </p>
      </main>
      <section className="studio-command-bar studio-command-bar--hero" aria-label="スタジオ操作">
        <button type="button" onClick={handleOpenFileDialog} disabled={isLoading || isExporting}>
          <span aria-hidden="true">📤</span>
        </button>
        <button type="button" onClick={handleDownloadCurrentView} disabled={!canDownload}>
          <span aria-hidden="true">📥</span>
        </button>
        <div className="studio-command-bar__divider" aria-hidden="true" />
        <button type="button" onClick={() => handlePageChange(1)} disabled={sliderDisabled} aria-label="最初のページへ">
          ⏮
        </button>
        <button type="button" onClick={goToPrevious} disabled={sliderDisabled || currentFrame === 1} aria-label="前のページへ">
          ⏪
        </button>
        <div className="studio-command-bar__slider">
          <input
            type="range"
            min={1}
            max={sliderMax}
            step={1}
            value={sliderValue}
            onChange={(event) => handlePageChange(Number(event.target.value))}
            disabled={sliderDisabled}
          />
          <div className="studio-command-bar__value">{asset ? `${currentFrame} / ${sliderMax}` : '0 / 0'}</div>
        </div>
        <button type="button" onClick={goToNext} disabled={sliderDisabled || currentFrame === sliderMax} aria-label="次のページへ">
          ⏩
        </button>
        <button type="button" onClick={() => handlePageChange(sliderMax)} disabled={sliderDisabled} aria-label="最後のページへ">
          ⏭
        </button>
        <div className="studio-command-bar__jump">
          <input
            type="number"
            min={1}
            max={sliderMax}
            value={pageInputValue}
            onChange={(event) => setPageInputValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handlePageInputCommit();
              }
            }}
            disabled={sliderDisabled}
            aria-label="移動先のページ番号"
          />
          <button type="button" onClick={handlePageInputCommit} disabled={sliderDisabled}>
            移動
          </button>
        </div>
        <div className="studio-command-bar__divider" aria-hidden="true" />
        <button
          type="button"
          className="studio-command-bar__chip"
          onClick={applyWcagAdjustments}
          disabled={!hasAsset || wcagProcessing}
        >
          👁&nbsp;WCAG解析
        </button>
        <button
          type="button"
          className={`studio-command-bar__chip${projectorEnabled ? ' is-active' : ''}`}
          onClick={() => handleToggleProjector(!projectorEnabled)}
          disabled={!hasAsset}
        >
          👓&nbsp;プレビュー
        </button>
        <button
          type="button"
          className="studio-command-bar__chip studio-command-bar__chip--danger"
          onClick={resetAdjustments}
          disabled={(!hasAsset && !hasWcagAdjustments) || isLoading}
        >
          ⟳&nbsp;リセット
        </button>
      </section>
    </div>
  );
};

export default App;
