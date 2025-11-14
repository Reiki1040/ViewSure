/**
 * ViewSure メインアプリケーションコンポーネント
 *
 * このコンポーネントはアプリケーション全体のUIと状態管理を担当します。
 * ランディング画面とプロジェクションスタジオ画面の切り替え、ファイル操作、
 * 画像調整、WCAG解析、PDFエクスポートなどの主要機能を統合します。
 *
 * アーキテクチャ:
 * - カスタムフックによる状態管理の分離
 * - サービス層によるビジネスロジックの分離
 * - 安定したコールバックによるパフォーマンス最適化
 */
import { useCallback, useEffect, useRef } from 'react';
import FileUploader, { type FileUploaderHandle } from './components/FileUploader';
import ProjectionViewport from './components/ProjectionViewport';
import LandingScreen from './components/LandingScreen';
import logoWhite from './assets/ViewSureIconWhite.png';

// カスタムフック - 状態管理と副作用を分離
import { useAppState } from './hooks/useAppState';
import { useProjectionRenderer } from './hooks/useProjectionRenderer';
import { useWcagHelper } from './hooks/useWcagHelper';
import { useErrorHandler, ErrorUtils } from './hooks/useErrorHandler';
import { useLoadingState, getLoadingMessage } from './hooks/useLoadingState';
import { useStableCallback } from './hooks/useStableCallback';

// サービス層 - ビジネスロジックを分離
import { exportService } from './services/exportService';

// 型定義 - 型安全性の確保
import type { AppEventHandlers } from './types/app';

// 定数 - 設定値の一元管理
import { APP_CONSTANTS, ERROR_MESSAGES } from './utils/constants';

const App = () => {
  // 状態管理フックの初期化
  // useAppState: アプリケーションのコア状態（ファイル、調整値、ナビゲーションなど）
  // useErrorHandler: エラー状態の管理と報告
  // useLoadingState: ローディング状態の一元管理
  const [state, actions] = useAppState();
  const [errors, errorActions] = useErrorHandler();
  const [loadingState, loadingActions] = useLoadingState();

  // 参照(Refs) - 再レンダリング間で安定した値を保持
  const fileUploaderRef = useRef<FileUploaderHandle | null>(null); // ファイルアップローダーへの参照
  const latestAdjustmentsRef = useRef({
    brightness: APP_CONSTANTS.INITIAL_BRIGHTNESS,
    contrast: APP_CONSTANTS.INITIAL_CONTRAST
  }); // 最新の調整値を保持（コールバック内で使用）

  // Renderer and WCAG hooks
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

  const {
    analysis,
    isAnalyzing,
    isApplying,
    applyAdjustments: applyWcagAdjustments,
    clearAdjustments,
    fontAdjustments
  } = useWcagHelper({
    asset: state.asset,
    brightness: state.brightness,
    contrast: state.contrast,
    setBrightness: actions.setBrightness,
    setContrast: actions.setContrast,
    setStatusMessage: actions.setStatusMessage
  });

  // Stable callbacks
  const handleFileSelected = useStableCallback(async (file: File) => {
    try {
      await loadingActions.withLoading('isLoading', async () => {
        await actions.handleFileSelected(file);
      }, (error) => {
        errorActions.reportError('file', ERROR_MESSAGES.FILE.LOAD_FAILED, error, true);
      });
    } catch (error) {
      // Error is already handled in withLoading
    }
  });

  const handleDownloadCurrentView = useStableCallback(async () => {
    if (!state.asset || !isReady) {
      actions.setStatusMessage('プレビューがまだ準備できていません');
      return;
    }

    try {
      await loadingActions.withLoading('isExporting', async () => {
        const result = await exportService.exportToPdf({
          asset: state.asset!,
          activeFileName: state.activeFileName,
          currentFrame: state.currentFrame,
          brightness: state.brightness,
          contrast: state.contrast,
          captureFrame,
          loadImage,
          updateAdjustments
        }, (progress) => {
          actions.setStatusMessage(progress.message);
        });

        if (result.success) {
          actions.setStatusMessage(`PDF をダウンロードしました: ${result.fileName}`);
        } else {
          throw new Error(result.error);
        }
      }, (error) => {
        errorActions.reportError('export', ERROR_MESSAGES.EXPORT.PDF_GENERATION_FAILED, error, true);
      });
    } catch (error) {
      // Error is already handled in withLoading
    }
  });

  const handleApplyWcagAdjustments = useStableCallback(() => {
    if (!state.asset) {
      actions.setStatusMessage('まず資料を読み込んでください');
      return;
    }
    applyWcagAdjustments();
  });

  const handleResetAdjustments = useStableCallback(() => {
    actions.resetAdjustments();
    clearAdjustments();
  });

  const handleOpenFileDialog = useStableCallback(() => {
    if (loadingState.isLoading || loadingState.isExporting) {
      return;
    }
    fileUploaderRef.current?.openFileDialog();
  });

  const handleToggleProjector = useStableCallback((enabled: boolean) => {
    actions.setProjectorEnabled(enabled);
    if (enabled) {
      updateProjectorPreview({
        enabled: true,
        gamma: APP_CONSTANTS.PROJECTOR_DEFAULTS.gamma,
        blackLift: APP_CONSTANTS.PROJECTOR_DEFAULTS.blackLift,
        colorTempShift: APP_CONSTANTS.PROJECTOR_DEFAULTS.colorTempShift,
        vignette: APP_CONSTANTS.PROJECTOR_DEFAULTS.vignette,
        hotspot: APP_CONSTANTS.PROJECTOR_DEFAULTS.hotspot
      });
    } else {
      updateProjectorPreview({ enabled: false });
    }
  });

  // Effect for handling frame changes
  useEffect(() => {
    if (!state.asset) {
      return;
    }

    let cancelled = false;
    const frameIndex = Math.min(state.currentFrame - 1, state.asset.pageCount - 1);

    const renderFrame = async () => {
      const shouldShowLoading = !(state.asset?.hasFrame?.(frameIndex) ?? false);
      if (shouldShowLoading) {
        loadingActions.setLoading('isLoading', true);
      }
      try {
        const source = await state.asset.getFrame(frameIndex);
        if (cancelled) {
          return;
        }
        await loadImage(source);
        const { brightness: targetBrightness, contrast: targetContrast } = latestAdjustmentsRef.current;
        updateAdjustments({ brightness: targetBrightness, contrast: targetContrast });
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          errorActions.reportError('render', 'フレームの描画に失敗しました', error, true);
        }
      } finally {
        if (!cancelled) {
          loadingActions.setLoading('isLoading', false);
        }
      }
    };

    void renderFrame();

    return () => {
      cancelled = true;
    };
  }, [state.asset, state.currentFrame, loadImage, updateAdjustments, loadingActions, errorActions]);

  // Effect for aspect ratio updates
  useEffect(() => {
    if (!analysis || !analysis.slides.length) {
      actions.setWcagAspectRatio(APP_CONSTANTS.DEFAULT_WCAG_ASPECT);
      return;
    }
    const baseSlide = analysis.slides[0];
    if (baseSlide.width > 0 && baseSlide.height > 0) {
      actions.setWcagAspectRatio(baseSlide.height / baseSlide.width);
    } else {
      actions.setWcagAspectRatio(APP_CONSTANTS.DEFAULT_WCAG_ASPECT);
    }
  }, [analysis, actions]);

  // Effect for keyboard navigation
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
        actions.goToPrevious();
        return;
      }
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        actions.goToNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [actions]);

  // Derived state
  const pageCount = state.asset?.pageCount ?? 0;
  const sliderMax = Math.max(pageCount, 1);
  const sliderValue = Math.min(state.currentFrame, sliderMax);
  const sliderDisabled = !state.asset || pageCount <= 1;
  const canDownload = Boolean(state.asset) && isReady && !loadingState.isLoading && !loadingState.isExporting;
  const wcagProcessing = isApplying || isAnalyzing;
  const hasWcagAdjustments = Boolean(fontAdjustments);
  const effectiveViewportAspect = state.lockedViewportAspect ?? imageAspectRatio ?? state.wcagAspectRatio;
  const hasAsset = Boolean(state.asset);
  
  const heroStatus = state.statusMessage ?? getLoadingMessage(loadingState) ?? APP_CONSTANTS.READY_STATUS_MESSAGE;

  const { setIsLandingVisible } = actions;

  // Landing screen logic
  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }
    setIsLandingVisible(true);
    window.history.replaceState({ viewsurePage: 'landing' }, '', window.location.href);
    const handlePopstate = () => {
      const historyState = window.history.state;
      setIsLandingVisible(historyState?.viewsurePage !== 'studio');
    };
    window.addEventListener('popstate', handlePopstate);
    return () => {
      window.removeEventListener('popstate', handlePopstate);
    };
  }, [setIsLandingVisible]);

  const handleStart = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.history.pushState({ viewsurePage: 'studio' }, '', window.location.href);
    }
    setIsLandingVisible(false);
  }, [setIsLandingVisible]);

  if (state.isLandingVisible) {
    return <LandingScreen onStart={handleStart} />;
  }

  return (
    <div className="hero-app">
      <header className="landing__header landing__header--app" aria-label="ViewSure">
        <div className="landing__brand">
          <img src={logoWhite} alt="ViewSure" className="landing__logo" />
          <span className="landing__brand-text">ViewSure</span>
        </div>
        <nav className="landing__nav" aria-label="サイトメニュー">
          <a href="#features">特徴</a>
          <a href="#contact">問い合わせ</a>
          <a href="#help">ヘルプ</a>
        </nav>
      </header>
      <main className="hero-stage">
        <div className={`hero-stage__panel${hasAsset ? ' hero-stage__panel--viewer' : ''}`}>
          <div className={`hero-uploader${hasAsset ? ' hero-uploader--hidden' : ''}`}>
            <FileUploader
              ref={fileUploaderRef}
              disabled={loadingState.isLoading || loadingState.isExporting}
              onFileSelected={handleFileSelected}
              statusMessage={state.statusMessage}
            />
          </div>
          {hasAsset ? (
            <div className="hero-viewport">
              <ProjectionViewport
                canvasRef={canvasRef}
                isLoading={loadingState.isLoading}
                isReady={isReady}
                canGoPrev={!sliderDisabled && state.currentFrame > 1}
                canGoNext={!sliderDisabled && state.currentFrame < sliderMax}
                onGoPrev={actions.goToPrevious}
                onGoNext={actions.goToNext}
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
        <button type="button" onClick={handleOpenFileDialog} disabled={loadingState.isLoading || loadingState.isExporting}>
          <span aria-hidden="true">📤</span>
        </button>
        <button type="button" onClick={handleDownloadCurrentView} disabled={!canDownload}>
          <span aria-hidden="true">📥</span>
        </button>
        <div className="studio-command-bar__divider" aria-hidden="true" />
        <button type="button" onClick={() => actions.setCurrentFrame(1)} disabled={sliderDisabled} aria-label="最初のページへ">
          ⏮
        </button>
        <button type="button" onClick={actions.goToPrevious} disabled={sliderDisabled || state.currentFrame === 1} aria-label="前のページへ">
          ⏪
        </button>
        <div className="studio-command-bar__slider">
          <input
            type="range"
            min={1}
            max={sliderMax}
            step={1}
            value={sliderValue}
            onChange={(event) => actions.setCurrentFrame(Number(event.target.value))}
            disabled={sliderDisabled}
          />
          <div className="studio-command-bar__value">{state.asset ? `${state.currentFrame} / ${sliderMax}` : '0 / 0'}</div>
        </div>
        <button type="button" onClick={actions.goToNext} disabled={sliderDisabled || state.currentFrame === sliderMax} aria-label="次のページへ">
          ⏩
        </button>
        <button type="button" onClick={() => actions.setCurrentFrame(sliderMax)} disabled={sliderDisabled} aria-label="最後のページへ">
          ⏭
        </button>
        <div className="studio-command-bar__jump">
          <input
            type="number"
            min={1}
            max={sliderMax}
            value={state.pageInputValue}
            onChange={(event) => actions.setPageInputValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                actions.handlePageInputCommit();
              }
            }}
            disabled={sliderDisabled}
            aria-label="移動先のページ番号"
          />
          <button type="button" onClick={actions.handlePageInputCommit} disabled={sliderDisabled}>
            移動
          </button>
        </div>
        <div className="studio-command-bar__divider" aria-hidden="true" />
        <button
          type="button"
          className="studio-command-bar__chip"
          onClick={handleApplyWcagAdjustments}
          disabled={!hasAsset || wcagProcessing}
        >
          👁&nbsp;WCAG解析
        </button>
        <button
          type="button"
          className={`studio-command-bar__chip${state.projectorEnabled ? ' is-active' : ''}`}
          onClick={() => handleToggleProjector(!state.projectorEnabled)}
          disabled={!hasAsset}
        >
          👓&nbsp;プレビュー
        </button>
        <button
          type="button"
          className="studio-command-bar__chip studio-command-bar__chip--danger"
          onClick={handleResetAdjustments}
          disabled={(!hasAsset && !hasWcagAdjustments) || loadingState.isLoading}
        >
          ⟳&nbsp;リセット
        </button>
      </section>
    </div>
  );
};

export default App;
