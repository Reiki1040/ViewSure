import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FileUploader, { type FileUploaderHandle } from './components/FileUploader';
import ProjectionControls from './components/ProjectionControls';
import WcagSummary from './components/WcagSummary';
import ProjectionViewport from './components/ProjectionViewport';
import WcagPreviewPanel from './components/WcagPreviewPanel';
import TopMenuBar from './components/TopMenuBar';
import LandingScreen from './components/LandingScreen';
import ProjectDashboard from './components/ProjectDashboard';
import AdvancedProjectorControls from './components/AdvancedProjectorControls';
import Wcag22Summary from './components/Wcag22Summary';
import TemplateSelector from './components/TemplateSelector';
import AutoCorrectionPanel from './components/AutoCorrectionPanel';
import { useProjectionRenderer } from './hooks/useProjectionRenderer';
import { loadProjectionAsset, type ProjectionAsset } from './utils/fileLoader';
import { useAuth } from './context/AuthContext';
import { useWcagHelper } from './hooks/useWcagHelper';
import { useAdvancedProjector } from './hooks/useAdvancedProjector';
import { useWcag22Helper } from './hooks/useWcag22Helper';
import { useTextStructureAnalyzer } from './hooks/useTextStructureAnalyzer';
import { useTemplateManager } from './hooks/useTemplateManager';
import TextStructureSummary from './components/TextStructureSummary';
import './styles/text-structure-summary.css';
import './styles/template-selector.css';
import './styles/auto-correction-panel.css';
import type { ActiveProjectContext, ProjectFile, ProjectFolder, TrashedProject } from './types/projects';
import type { ProjectorPreviewSettings } from './types/projector';
import type { AccessibleTemplate } from './types/templates';

const INITIAL_BRIGHTNESS = 100;
const INITIAL_CONTRAST = 0;
const DEFAULT_WCAG_ASPECT = 9 / 16;
const INITIAL_STATUS_MESSAGE = '�t�@�C�����A�b�v���[�h���Ă�������';

const WORKSPACE_STORAGE_PREFIX = 'viewsure.workspace';

type WorkspaceSnapshot = {
  folders?: ProjectFolder[];
  trashedProjects?: TrashedProject[];
  activeFolderId?: string | null;
};

type ProjectionStudioAppProps = {
  onBackToProjects?: () => void;
  activeProject?: ActiveProjectContext | null;
};

const ProjectionStudioApp = ({ onBackToProjects, activeProject }: ProjectionStudioAppProps) => {
const { user, signOut } = useAuth();
const [brightness, setBrightnessState] = useState(INITIAL_BRIGHTNESS);
const [contrast, setContrastState] = useState(INITIAL_CONTRAST);
const [statusMessage, setStatusMessage] = useState<string | null>(INITIAL_STATUS_MESSAGE);
const [activeFileName, setActiveFileName] = useState<string | null>(null);
const [isLoading, setIsLoading] = useState(false);
const [showAdvancedControls, setShowAdvancedControls] = useState(false);
const [showWcag22Panel, setShowWcag22Panel] = useState(false);
const [showTextStructurePanel, setShowTextStructurePanel] = useState(false);
const [showTemplateSelector, setShowTemplateSelector] = useState(false);
const [showAutoCorrectionPanel, setShowAutoCorrectionPanel] = useState(false);
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
  const [pageInputValue, setPageInputValue] = useState('1');
  const latestAdjustmentsRef = useRef({ brightness: INITIAL_BRIGHTNESS, contrast: INITIAL_CONTRAST });
  const fileUploaderRef = useRef<FileUploaderHandle | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [wcagAspectRatio, setWcagAspectRatio] = useState(DEFAULT_WCAG_ASPECT);
  const initialViewportAspectRef = useRef<number | null>(null);
  const [lockedViewportAspect, setLockedViewportAspect] = useState<number | null>(null);
  const [projectorEnabled, setProjectorEnabled] = useState(false);
  
  // 高度なプロジェクター設定
  const [projectorSettings, setProjectorSettings] = useState<ProjectorPreviewSettings>({
    resolution: {
      maintainAspectRatio: true,
      scalingAlgorithm: 'bilinear',
      sharpening: {
        enabled: false,
        strength: 0.5,
        radius: 1.0
      },
      noiseReduction: {
        enabled: false,
        strength: 0.3
      }
    },
    brightness: {
      globalBrightness: 0,
      highlights: {
        adjustment: 0,
        threshold: 0.7
      },
      shadows: {
        adjustment: 0,
        threshold: 0.3
      },
      gamma: {
        red: 2.2,
        green: 2.2,
        blue: 2.2
      },
      hdrToSdr: {
        enabled: false,
        nits: 1000,
        method: 'reinhard'
      },
      autoAdjustment: {
        enabled: false,
        targetLuminance: 0.5,
        adaptationSpeed: 0.5
      }
    },
    color: {
      colorTemperature: {
        kelvin: 6500,
        tint: 0
      },
      hsv: {
        hue: 0,
        saturation: 0,
        value: 0
      },
      colorProfile: {
        input: 'sRGB',
        output: 'sRGB',
        renderingIntent: 'relative'
      },
      colorCorrection: {
        enabled: false,
        referencePoints: []
      },
      colorBlindness: {
        simulation: 'none' as any,
        compensation: false
      }
    },
    environment: {
      ambientLight: 0.2,
      screenGain: 1.0,
      throwDistance: 3.0,
      screenType: 'matte'
    }
  });
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
      const currentContrast = latestAdjustmentsRef.current.contrast;
      applyAdjustmentsToRenderer(value, currentContrast);
    },
    [applyAdjustmentsToRenderer]
  );
  const handleContrastChange = useCallback(
    (value: number) => {
      setContrastState(value);
      const currentBrightness = latestAdjustmentsRef.current.brightness;
      applyAdjustmentsToRenderer(currentBrightness, value);
    },
    [applyAdjustmentsToRenderer]
  );
  const {
    analysis,
    analysisError,
    isAnalyzing,
    isApplying,
    fontAdjustments,
    applyAdjustments: applyWcagAdjustments,
    clearAdjustments,
    getTextOverlayPayload
  } = useWcagHelper({
    asset,
    brightness,
    contrast,
    setBrightness: handleBrightnessChange,
    setContrast: handleContrastChange,
    setStatusMessage
  });
  
  // 高度なプロジェクターフック
  const {
    settings: advancedProjectorSettings,
    isProcessing: isProcessingAdvanced,
    luminanceAnalysis,
    colorDistribution,
    processedImage,
    updateSettings,
    updateResolutionSettings,
    updateBrightnessSettings,
    updateColorSettings,
    updateEnvironmentSettings,
    processImage,
    analyzeLuminance,
    analyzeColorDistribution,
    applyPreset,
    resetSettings
  } = useAdvancedProjector();
  
  // WCAG 2.2ヘルパーフック
  const {
    analysis: wcag22Analysis,
    analysisError: wcag22Error,
    isAnalyzing: isAnalyzingWcag22,
    isApplying: isApplyingWcag22,
    adjustmentSettings,
    colorBlindnessSimulation,
    isSimulatingColorBlindness,
    analysisSummary,
    analyzeDocument,
    applyAdjustments: applyWcag22Adjustments,
    simulateColorBlindness,
    updateAdjustmentSettings,
    clearAnalysis
  } = useWcag22Helper({
    asset,
    targetLevel: 'AA',
    onAnalysisComplete: (analysis) => {
      console.log('WCAG 2.2 分析完了', analysis);
    },
    onAdjustmentComplete: (result) => {
      console.log('WCAG 2.2 調整完了', result);
    }
  });

  // テキスト構造解析フック
  const {
    structure,
    isAnalyzing: isAnalyzingStructure,
    analysisError: structureError,
    wcagIssues: structureWcagIssues,
    structureSummary,
    wcagSummary,
    getSlideStructure,
    getElementById,
    getHeadings,
    getOutline
  } = useTextStructureAnalyzer({
    asset,
    onAnalysisComplete: (structure) => {
      console.log('テキスト構造解析完了', structure);
    },
    onAnalysisError: (error) => {
      console.error('テキスト構造解析エラー', error);
    }
  });

  // テンプレート管理フック
  const {
    selectedTemplate,
    loading: templateLoading,
    error: templateError,
    selectTemplate,
    applyTemplate
  } = useTemplateManager(asset || undefined);

  useEffect(() => {
    if (!activeProject) {
      return;
    }
    setStatusMessage((previous) => {
      if (!previous || previous === INITIAL_STATUS_MESSAGE) {
        return `${activeProject.projectName} を開いています。資料を読み込んでください`;
      }
      return previous;
    });
  }, [activeProject]);
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
      setPageInputValue('1');
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
    handleBrightnessChange(INITIAL_BRIGHTNESS);
    handleContrastChange(INITIAL_CONTRAST);
  }, [handleBrightnessChange, handleContrastChange]);

  const handleTemplateSelect = useCallback(
    async (template: AccessibleTemplate) => {
      setStatusMessage('テンプレートを適用しています...');
      try {
        await selectTemplate(template.id);
        const result = await applyTemplate(template);
        if (!result) {
          setStatusMessage('資料を読み込むとテンプレートを適用できます');
          return;
        }
        if (result.success) {
          setStatusMessage('テンプレートを適用しました');
        } else {
          setStatusMessage(result.errors?.[0] ?? 'テンプレートの適用に失敗しました');
        }
      } catch (error) {
        console.error('テンプレート適用に失敗しました', error);
        setStatusMessage('テンプレートの適用に失敗しました');
      } finally {
        setShowTemplateSelector(false);
      }
    },
    [applyTemplate, selectTemplate, setShowTemplateSelector, setStatusMessage]
  );

  const autoIssueCount = analysis?.issues.length ?? 0;

  const templateStatusLabel = useMemo(() => {
    if (templateLoading) {
      return 'テンプレートギャラリーを準備しています...';
    }
    if (templateError) {
      return templateError;
    }
    if (selectedTemplate) {
      return `${selectedTemplate.name} を適用済み`;
    }
    return 'まだテンプレートは適用されていません';
  }, [selectedTemplate, templateError, templateLoading]);

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
  }, [activeFileName, asset, captureFrame, currentFrame, isExporting, isLoading, isReady, loadImage, updateAdjustments]);

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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }
      const target = event.target;
      if (
        target instanceof HTMLElement &&
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

  useEffect(() => {
    setPageInputValue(String(currentFrame));
  }, [currentFrame]);

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
  }, [signOut]);

  useEffect(() => {
    return () => {
      asset?.dispose?.();
    };
  }, [asset]);

  return (
    <div className="app-root">
      <TopMenuBar
        onBackToProjects={onBackToProjects}
        onSignOut={user ? handleSignOut : undefined}
        user={user ? { name: user.name, avatarUrl: (user as any).picture } : undefined}
        activeProject={activeProject ? { folderName: activeProject.folderName, projectName: activeProject.projectName } : undefined}
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
              onBrightnessChange={handleBrightnessChange}
              onContrastChange={handleContrastChange}
              onReset={resetAdjustments}
              pageCount={pageCount || undefined}
              currentPage={asset ? currentFrame : undefined}
              onRequestWcagCheck={applyWcagAdjustments}
              wcagDisabled={!analysis || isApplying || isLoading || isExporting}
              onClearWcagAdjustments={clearAdjustments}
              showWcagClearButton={hasWcagAdjustments}
              wcagClearDisabled={isApplying || isLoading || isExporting}
              wcagProcessing={wcagProcessing}
              wcagProcessingMessage={wcagProcessingMessage}
              projectorEnabled={projectorEnabled}
              onToggleProjector={handleToggleProjector}
            />
          </div>
        </aside>
        <main className="viewport-container">
          <header className="experience-panel">
            <div>
              <p className="experience-panel__eyebrow">Current Session</p>
              <h2 className="experience-panel__title">
                {activeFileName ?? activeProject?.projectName ?? 'ファイルを読み込んでください'}
              </h2>
              <p className="experience-panel__status">{statusMessage ?? '準備完了'}</p>
            </div>
            <div className="experience-panel__badges" aria-live="polite">
              <span className="experience-panel__badge">
                ページ {pageCount ?? 0}
              </span>
              <span className="experience-panel__badge experience-panel__badge--accent">
                WCAG {analysis?.issues.length ?? 0}
              </span>
            </div>
            <div className="experience-panel__actions">
              <button
                type="button"
                className="experience-panel__action"
                onClick={() => {
                  resetAspectRatio();
                  setLockedViewportAspect(null);
                }}
                disabled={!asset || !isReady || isLoading}
              >
                ビューポートを整列
              </button>
              <button
                type="button"
                className="experience-panel__action experience-panel__action--primary"
                onClick={handleDownloadCurrentView}
                disabled={!canDownload || isExporting || isLoading}
              >
                PDFを書き出す
              </button>
            </div>
          </header>
          <div className="viewport-stage">
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
            {pageCount > 1 ? (
            <div className="page-slider" aria-label="ページ選択">
              <label className="page-slider__label" htmlFor="page-slider-main">ページ</label>
              <input
                id="page-slider-main"
                type="range"
                min={1}
                max={pageCount}
                step={1}
                value={currentFrame}
                onChange={(event) => handlePageChange(Number(event.target.value))}
              />
              <div className="page-slider__value">
                {currentFrame} / {pageCount}
              </div>
              <div className="page-slider__jump">
                <input
                  type="number"
                  min={1}
                  max={pageCount}
                  value={pageInputValue}
                  onChange={(event) => setPageInputValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      handlePageInputCommit();
                    }
                  }}
                  aria-label="ページ番号を入力"
                />
                <button type="button" onClick={handlePageInputCommit} className="page-slider__jump-button">
                  移動
                </button>
              </div>
            </div>
          ) : null}
          </div>
          <WcagPreviewPanel
            overlay={textOverlay}
            aspectRatio={effectiveViewportAspect}
            isBusy={!isReady || isLoading || isApplying || isAnalyzing}
          />
        </main>
        <aside className="insights-panel">
          <div className="insights-panel__header">
            <p className="insights-panel__eyebrow">Insights Hub</p>
            <h2>アクセシビリティ &amp; テンプレート</h2>
            <p className="insights-panel__meta">解析結果と補助ツールをひとまとめにしました。</p>
          </div>
          <div className="insights-panel__toolbar" role="group" aria-label="補助パネルの切り替え">
            <button
              type="button"
              aria-pressed={showAdvancedControls}
              className={`insights-panel__toggle${showAdvancedControls ? ' insights-panel__toggle--active' : ''}`}
              onClick={() => setShowAdvancedControls((previous) => !previous)}
              disabled={!isReady || isLoading || isExporting || isApplying}
            >
              プロジェクター拡張
            </button>
            <button
              type="button"
              aria-pressed={showWcag22Panel}
              className={`insights-panel__toggle${showWcag22Panel ? ' insights-panel__toggle--active' : ''}`}
              onClick={() => setShowWcag22Panel((previous) => !previous)}
              disabled={!isReady || isLoading || isExporting || isApplying}
            >
              WCAG 2.2
            </button>
            <button
              type="button"
              aria-pressed={showTextStructurePanel}
              className={`insights-panel__toggle${showTextStructurePanel ? ' insights-panel__toggle--active' : ''}`}
              onClick={() => setShowTextStructurePanel((previous) => !previous)}
              disabled={!isReady || isLoading || isExporting || isApplying}
            >
              テキスト構造
            </button>
            <button
              type="button"
              className="insights-panel__toggle insights-panel__toggle--ghost"
              onClick={() => setShowTemplateSelector(true)}
            >
              テンプレート
            </button>
            <button
              type="button"
              className="insights-panel__toggle insights-panel__toggle--ghost"
              onClick={() => setShowAutoCorrectionPanel(true)}
              disabled={!asset}
            >
              自動修正
            </button>
          </div>
          <div className="insights-panel__stack">
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
            {showWcag22Panel && (
              <Wcag22Summary
                analysis={wcag22Analysis}
                adjustmentSettings={adjustmentSettings}
                isAnalyzing={isAnalyzingWcag22}
                error={wcag22Error}
                onApplyAdjustments={applyWcag22Adjustments}
                onAdjustmentSettingsChange={updateAdjustmentSettings}
                showDetails={true}
                targetLevel="AA"
              />
            )}
            {showAdvancedControls && (
              <AdvancedProjectorControls
                settings={projectorSettings}
                onSettingsChange={setProjectorSettings}
                disabled={!isReady || isLoading || isExporting || isApplying}
                showAdvanced={true}
                sourceDimensions={asset ? { width: 1920, height: 1080 } : undefined}
              />
            )}
            {showTextStructurePanel && (
              <TextStructureSummary
                structure={structure}
                wcagIssues={structureWcagIssues}
                isAnalyzing={isAnalyzingStructure}
                error={structureError}
                onSlideSelect={(slideId) => {
                  if (asset && slideId > 0 && slideId <= asset.pageCount) {
                    setCurrentFrame(slideId);
                    setPageInputValue(String(slideId));
                  }
                }}
                onElementSelect={(slideId, elementId) => {
                  console.log('要素選択:', slideId, elementId);
                }}
              />
            )}
            <section className="insights-panel__card insights-panel__card--template" aria-live="polite">
              <div>
                <p className="insights-panel__card-label">テンプレート</p>
                <h3 className="insights-panel__card-title">
                  {selectedTemplate ? selectedTemplate.name : '未適用'}
                </h3>
                <p className="insights-panel__card-text">{templateStatusLabel}</p>
              </div>
              <button
                type="button"
                className="insights-panel__card-action"
                onClick={() => setShowTemplateSelector(true)}
              >
                ギャラリーを開く
              </button>
            </section>
            <section className="insights-panel__card insights-panel__card--auto" aria-live="polite">
              <div>
                <p className="insights-panel__card-label">自動修正</p>
                <h3 className="insights-panel__card-title">
                  {autoIssueCount > 0 ? `${autoIssueCount} 件の改善余地` : '大きな問題は検出されていません'}
                </h3>
                <p className="insights-panel__card-text">
                  {autoIssueCount > 0 ? 'AI 戦略でまとめて修正できます。' : 'WCAG 解析後に利用できます。'}
                </p>
              </div>
              <button
                type="button"
                className="insights-panel__card-action"
                onClick={() => setShowAutoCorrectionPanel(true)}
                disabled={!asset || autoIssueCount === 0}
              >
                修正パネルを開く
              </button>
            </section>
          </div>
        </aside>
      </div>
      {isExporting || isApplying ? (
        <div className="app-overlay" role="status" aria-live="assertive">
          <div className="transition-overlay__spinner" aria-hidden="true" />
          <p className="app-overlay__message">
            {isApplying ? 'WCAG 調整を適用しています...' : 'PDF を保存しています...'}
          </p>
        </div>
      ) : null}
      {showTemplateSelector ? (
        <TemplateSelector onTemplateSelect={handleTemplateSelect} onClose={() => setShowTemplateSelector(false)} />
      ) : null}
      {showAutoCorrectionPanel ? (
        <AutoCorrectionPanel
          issues={analysis?.issues ?? []}
          asset={asset}
          onCorrectionApply={(result) => {
            setStatusMessage(result.success ? '自動修正を適用しました' : '自動修正で課題が残りました');
          }}
          onClose={() => setShowAutoCorrectionPanel(false)}
        />
      ) : null}
    </div>
  );
};

type AppView = 'landing' | 'projects' | 'studio';

const VIEW_HASH: Record<AppView, string> = {
  landing: '',
  projects: '#projects',
  studio: '#studio'
};

const parseViewFromHash = (hash: string): AppView => {
  switch (hash) {
    case VIEW_HASH.projects:
      return 'projects';
    case VIEW_HASH.studio:
      return 'studio';
    default:
      return 'landing';
  }
};

const INITIAL_PROJECT_FOLDERS: ProjectFolder[] = [
  {
    id: 'folder-live-events',
    name: 'Live Events',
    createdAt: '2025-10-05T09:00:00.000Z',
    files: [
      {
        id: 'project-venue-setup',
        name: 'Venue Setup Walkthrough',
        category: 'Presentation',
        updatedAt: '2025-10-30T06:45:00.000Z',
        notes: 'Includes WCAG overlay notes'
      },
      {
        id: 'project-audit-room',
        name: 'Audit Room Lighting',
        category: 'Presentation',
        updatedAt: '2025-10-24T14:20:00.000Z',
        notes: 'Contrast presets saved'
      }
    ]
  },
  {
    id: 'folder-training',
    name: 'Training',
    createdAt: '2025-09-18T11:30:00.000Z',
    files: [
      {
        id: 'project-onboarding',
        name: 'Onboarding Tutorial',
        category: 'Import',
        updatedAt: '2025-10-18T08:10:00.000Z',
        notes: 'PDF imported from client template'
      }
    ]
  }
];

const cloneProjectFile = (file: ProjectFile): ProjectFile => ({ ...file });

const cloneProjectFolder = (folder: ProjectFolder): ProjectFolder => ({
  ...folder,
  files: folder.files.map(cloneProjectFile)
});

const createDefaultFolders = (): ProjectFolder[] => INITIAL_PROJECT_FOLDERS.map(cloneProjectFolder);

const createDefaultWorkspace = (): Required<WorkspaceSnapshot> => {
  const folders = createDefaultFolders();
  return {
    folders,
    trashedProjects: [],
    activeFolderId: folders[0]?.id ?? null
  };
};

const createId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
};

const App = () => {
  const { user } = useAuth();
  const [view, setView] = useState<AppView>(() => {
    if (typeof window === 'undefined') {
      return 'landing';
    }
    return parseViewFromHash(window.location.hash);
  });
  const transitionTimeoutRef = useRef<number | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [folders, setFolders] = useState<ProjectFolder[]>(createDefaultFolders);
  const [trashedProjects, setTrashedProjects] = useState<TrashedProject[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(() => createDefaultWorkspace().activeFolderId);
  const [activeProject, setActiveProject] = useState<ActiveProjectContext | null>(null);
  const [isGuestSession, setIsGuestSession] = useState(false);
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false);
  const workspaceOwner = useMemo(() => {
    if (user) {
      return user.uid;
    }
    if (isGuestSession) {
      return 'guest';
    }
    return null;
  }, [isGuestSession, user]);
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (!workspaceOwner) {
      const defaults = createDefaultWorkspace();
      setFolders(defaults.folders);
      setTrashedProjects(defaults.trashedProjects);
      setActiveFolderId(defaults.activeFolderId);
      setWorkspaceLoaded(false);
      return;
    }

    const storageKey = `${WORKSPACE_STORAGE_PREFIX}.${workspaceOwner}`;
    setWorkspaceLoaded(false);

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const snapshot = JSON.parse(raw) as WorkspaceSnapshot;
        const restoredFolders = Array.isArray(snapshot.folders)
          ? snapshot.folders.map(cloneProjectFolder)
          : createDefaultFolders();
        const restoredTrash = Array.isArray(snapshot.trashedProjects)
          ? snapshot.trashedProjects.map((item) => ({ ...item }))
          : [];
        const fallbackActive = restoredFolders[0]?.id ?? null;
        const restoredActive =
          snapshot.activeFolderId && restoredFolders.some((folder) => folder.id === snapshot.activeFolderId)
            ? snapshot.activeFolderId
            : fallbackActive;
        setFolders(restoredFolders);
        setTrashedProjects(restoredTrash);
        setActiveFolderId(restoredActive);
      } else {
        const defaults = createDefaultWorkspace();
        setFolders(defaults.folders);
        setTrashedProjects(defaults.trashedProjects);
        setActiveFolderId(defaults.activeFolderId);
      }
    } catch (error) {
      console.error('Failed to restore workspace', error);
      const defaults = createDefaultWorkspace();
      setFolders(defaults.folders);
      setTrashedProjects(defaults.trashedProjects);
      setActiveFolderId(defaults.activeFolderId);
    } finally {
      setWorkspaceLoaded(true);
    }
  }, [workspaceOwner]);
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    if (!workspaceOwner || !workspaceLoaded) {
      return;
    }
    const storageKey = `${WORKSPACE_STORAGE_PREFIX}.${workspaceOwner}`;
    const snapshot: Required<WorkspaceSnapshot> = {
      folders,
      trashedProjects,
      activeFolderId
    };
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
    } catch (error) {
      console.error('Failed to persist workspace', error);
    }
  }, [workspaceOwner, workspaceLoaded, folders, trashedProjects, activeFolderId]);


  const updateLocationForView = useCallback((next: AppView) => {
    if (typeof window === 'undefined') {
      return;
    }
    const targetHash = VIEW_HASH[next];
    if (!targetHash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      return;
    }
    if (window.location.hash !== targetHash) {
      window.location.hash = targetHash;
    }
  }, []);

  const applyView = useCallback(
    (next: AppView) => {
      setView(next);
      if (next === 'landing') {
        setIsGuestSession(false);
      }
      if (next !== 'studio') {
        setActiveProject(null);
      }
      updateLocationForView(next);
    },
    [setIsGuestSession, updateLocationForView]
  );

  const navigateTo = useCallback(
    (next: AppView) => {
      if (next === view) {
        return;
      }
      if (transitionTimeoutRef.current !== null) {
        window.clearTimeout(transitionTimeoutRef.current);
      }
      setIsTransitioning(true);
      transitionTimeoutRef.current = window.setTimeout(() => {
        transitionTimeoutRef.current = null;
        setIsTransitioning(false);
        applyView(next);
      }, 250);
    },
    [applyView, view]
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const handleHashChange = () => {
      const nextView = parseViewFromHash(window.location.hash);
      setView(nextView);
      if (nextView !== 'studio') {
        setActiveProject(null);
      }
      setIsTransitioning(false);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  useEffect(() => {
    if (!user && !isGuestSession && view !== 'landing') {
      if (transitionTimeoutRef.current !== null) {
        window.clearTimeout(transitionTimeoutRef.current);
        transitionTimeoutRef.current = null;
      }
      setIsTransitioning(false);
      applyView('landing');
    }
  }, [applyView, isGuestSession, user, view]);

  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current !== null) {
        window.clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, []);

  const handleEnterWorkspace = useCallback(() => {
    setIsGuestSession(!user);
    navigateTo('projects');
  }, [navigateTo, user]);

  const handleBackToProjects = useCallback(() => {
    navigateTo('projects');
  }, [navigateTo]);

  const handleSelectFolder = useCallback((folderId: string | null) => {
    setActiveFolderId(folderId);
  }, []);

  const handleCreateFolder = useCallback((folderName: string) => {
    const trimmed = folderName.trim();
    if (!trimmed) {
      return;
    }
    const newFolder: ProjectFolder = {
      id: createId('folder'),
      name: trimmed,
      createdAt: new Date().toISOString(),
      files: []
    };
    setFolders((previous) => [...previous, newFolder]);
    setActiveFolderId(newFolder.id);
  }, []);

  const handleDeleteFolder = useCallback((folderId: string) => {
    type TrashCandidate = { project: ProjectFile; folder: ProjectFolder };
    let projectsToTrash: TrashCandidate[] = [];

    setFolders((previous) => {
      const targetFolder = previous.find((folder) => folder.id === folderId);
      if (!targetFolder) {
        return previous;
      }
      if (targetFolder.files.length > 0) {
        projectsToTrash = targetFolder.files.map((project) => ({
          project,
          folder: targetFolder
        }));
      }
      return previous.filter((folder) => folder.id !== folderId);
    });

    if (projectsToTrash.length > 0) {
      const deletionTimestamp = new Date().toISOString();
      setTrashedProjects((previousTrash) => [
        ...projectsToTrash.map(({ project, folder }) => ({
          id: project.id,
          name: project.name,
          category: project.category,
          notes: project.notes,
          updatedAt: project.updatedAt,
          deletedAt: deletionTimestamp,
          sourceFolderId: folder.id,
          sourceFolderName: folder.name
        })),
        ...previousTrash
      ]);
    }

    setActiveProject((current) => {
      if (current && current.folderId === folderId) {
        return null;
      }
      return current;
    });

    setActiveFolderId((current) => {
      if (current === folderId) {
        return null;
      }
      return current;
    });
  }, []);

  const handleCreateProject = useCallback((folderId: string, projectName: string) => {
    const trimmed = projectName.trim();
    if (!trimmed) {
      return;
    }
    const newProject: ProjectFile = {
      id: createId('project'),
      name: trimmed,
      category: 'Draft',
      updatedAt: new Date().toISOString(),
      notes: ''
    };
    setFolders((previous) =>
      previous.map((folder) =>
        folder.id === folderId ? { ...folder, files: [...folder.files, newProject] } : folder
      )
    );
  }, []);

  const handleDeleteProject = useCallback(
    (folderId: string, projectId: string) => {
      const sourceFolder = folders.find((folder) => folder.id === folderId);
      const sourceProject = sourceFolder?.files.find((file) => file.id === projectId);

      setFolders((previous) =>
        previous.map((folder) =>
          folder.id === folderId ? { ...folder, files: folder.files.filter((file) => file.id !== projectId) } : folder
        )
      );

      if (sourceFolder && sourceProject) {
        const trashed: TrashedProject = {
          id: sourceProject.id,
          name: sourceProject.name,
          category: sourceProject.category,
          notes: sourceProject.notes,
          updatedAt: sourceProject.updatedAt,
          deletedAt: new Date().toISOString(),
          sourceFolderId: sourceFolder.id,
          sourceFolderName: sourceFolder.name
        };
        setTrashedProjects((previous) => [trashed, ...previous]);
      }

      setActiveProject((current) => {
        if (current && current.projectId === projectId) {
          return null;
        }
        return current;
      });
    },
    [folders]
  );

  const handlePurgeProject = useCallback((projectId: string) => {
    setTrashedProjects((previous) => previous.filter((item) => item.id !== projectId));
  }, []);

  const handleEmptyTrash = useCallback(() => {
    setTrashedProjects([]);
  }, []);

  const handleOpenProject = useCallback(
    (context: ActiveProjectContext) => {
      setActiveProject(context);
      setActiveFolderId(context.folderId);
      navigateTo('studio');
    },
    [navigateTo]
  );

  return (
    <>
      {view === 'landing' ? (
        <LandingScreen onStart={handleEnterWorkspace} />
      ) : view === 'projects' ? (
        <ProjectDashboard
          folders={folders}
          trashedProjects={trashedProjects}
          activeFolderId={activeFolderId}
          onSelectFolder={handleSelectFolder}
          onCreateFolder={handleCreateFolder}
          onDeleteFolder={handleDeleteFolder}
          onCreateProject={handleCreateProject}
          onOpenProject={handleOpenProject}
          onDeleteProject={handleDeleteProject}
          onPurgeProject={handlePurgeProject}
          onEmptyTrash={handleEmptyTrash}
        />
      ) : (
        <ProjectionStudioApp onBackToProjects={handleBackToProjects} activeProject={activeProject} />
      )}
      {isTransitioning ? (
        <div className="transition-overlay" role="status" aria-live="polite">
          <div className="transition-overlay__spinner" aria-hidden="true" />
          <p className="transition-overlay__message">ViewSure を読み込み中です...</p>
        </div>
      ) : null}
    </>
  );
};

export default App;
