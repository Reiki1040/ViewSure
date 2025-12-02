import { useCallback, useEffect, useRef, useState } from 'react';
import FileUploader, { type FileUploaderHandle } from './components/FileUploader';
import ProjectionViewport from './components/ProjectionViewport';
import LandingScreen from './components/LandingScreen';
import logoWhite from './assets/ViewSureIconWhite.png';
import firstPageIcon from './assets/first_page.png';
import lastPageIcon from './assets/last_page.png';
import nextIcon from './assets/next.png';
import prevIcon from './assets/pre.png';
import projectorPreviewIcon from './assets/project_preview.png';
import uploadIcon from './assets/import.png';
import { usePdfRenderer } from './hooks/usePdfRenderer';
import { initWasm, applyToneMapping } from './utils/toneMapping';
import { analyzePageContrast, logContrastIssues } from './utils/wcag';
import { applyAutoFix } from './utils/wcagFix';
import { extractImagesFromPdf, type ImageCrop } from './utils/imageExtractor';

const READY_MESSAGE = 'PDF を読み込んでください';

const App = () => {
  const fileUploaderRef = useRef<FileUploaderHandle | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const {
    getRenderer,
    pageCount,
    isLoading: pdfLoading,
    error: pdfError,
    loadPdf,
    getSourceBuffer,
    dispose
  } = usePdfRenderer();

  const [isLandingVisible, setIsLandingVisible] = useState(true);
  const [isPreviewEnabled, setIsPreviewEnabled] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>(READY_MESSAGE);
  const [isReady, setIsReady] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInputValue, setPageInputValue] = useState('1');
  const [aspectRatio, setAspectRatio] = useState(9 / 16);
  const [isAutoFixEnabled, setIsAutoFixEnabled] = useState(false);
  const [pageImages, setPageImages] = useState<Record<number, ImageCrop[]>>({});

  useEffect(() => {
    initWasm().catch(err => {
      console.error('Failed to initialize WASM in App', err);
      // Optionally, set an error state to inform the user
    });
  }, []);

  useEffect(() => {
    return () => {
      dispose();
    };
  }, [dispose]);

  const renderPage = useCallback(
    async (pageNumber: number) => {
      const rendererInstance = getRenderer();
      const canvas = canvasRef.current;
      console.log('[App] renderPage start', { pageNumber, hasRenderer: Boolean(rendererInstance), hasCanvas: Boolean(canvas) });
      
      if (!rendererInstance || !canvas) {
        console.warn('[App] renderPage skipped (renderer/canvas missing)');
        return;
      }
      
      try {
        const pageCanvas = await rendererInstance.getPageCanvas(pageNumber - 1);
        const context = canvas.getContext('2d');
        if (!context) {
          throw new Error('キャンバスコンテキストの取得に失敗しました');
        }

        canvas.width = pageCanvas.width;
        canvas.height = pageCanvas.height;
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(pageCanvas, 0, 0);

        // Apply tone mapping if preview is enabled
        if (isPreviewEnabled) {
          applyToneMapping(context, canvas.width, canvas.height);
        }

        if (pageCanvas.width > 0 && pageCanvas.height > 0) {
          setAspectRatio(pageCanvas.height / pageCanvas.width);
        }

        // WCAG Step1: コントラスト検査をログ出力（UIにはまだ表示しない）
        try {
          const textContent = await rendererInstance.getPageTextContent(pageNumber - 1);
          const issues = analyzePageContrast(context, textContent);
          logContrastIssues(pageNumber - 1, issues);

          if (isAutoFixEnabled) {
            const images = pageImages[pageNumber] || [];
            applyAutoFix(context, textContent, issues, pageCanvas, images);
          }
        } catch (wcagError) {
          console.warn('[WCAG] コントラスト検査に失敗しました', wcagError);
        }

        setCurrentPage((prev) => (prev === pageNumber ? prev : pageNumber));
        setPageInputValue((prev) => (prev === String(pageNumber) ? prev : String(pageNumber)));
        console.log('[App] renderPage success', { pageNumber, width: pageCanvas.width, height: pageCanvas.height });
      } catch (error) {
        console.error('[App] renderPage error', error);
        setStatusMessage('ページの描画に失敗しました');
        setIsReady(false);
      }
    },
    [getRenderer, isPreviewEnabled, isAutoFixEnabled]
  );

  
  const handleFileSelected = useCallback(
    async (file: File) => {
      console.log('[App] handleFileSelected start', file.name, file.type, file.size);
      
      try {
        await loadPdf(file);
        // PDF読み込み成功後、状態をリセットして最初のページをレンダリング
        setCurrentPage(1);
        setPageInputValue('1');
        setIsReady(true);
        const buffer = getSourceBuffer();
        if (buffer) {
          void extractImagesFromPdf(buffer, 2).then((results) => {
            const map: Record<number, ImageCrop[]> = {};
            results.forEach((entry) => {
              map[entry.page] = entry.images;
            });
            setPageImages(map);
          }).catch((err) => {
            console.warn('[Images] 画像抽出に失敗しました', err);
            setPageImages({});
          });
        } else {
          setPageImages({});
        }
        void renderPage(1);
      } catch (error) {
        console.error('[App] handleFileSelected error', error);
        setStatusMessage('PDF の読み込みに失敗しました');
        setIsReady(false);
        setCurrentPage(1);
        setPageInputValue('1');
      }
    },
    [loadPdf, renderPage]
  );

  const goToPage = useCallback(
    (page: number) => {
      const rendererInstance = getRenderer();
      if (!rendererInstance || pageCount === 0) {
        return;
      }
      const clamped = Math.min(Math.max(page, 1), pageCount);
      if (clamped === currentPage) {
        return;
      }
      void renderPage(clamped);
    },
    [currentPage, getRenderer, pageCount, renderPage]
  );

  const handlePageInputCommit = useCallback(() => {
    const parsed = Number(pageInputValue);
    if (!Number.isFinite(parsed)) {
      return;
    }
    goToPage(parsed);
  }, [goToPage, pageInputValue]);

  const handleOpenFileDialog = useCallback(() => {
    if (pdfLoading) {
      return;
    }
    fileUploaderRef.current?.openFileDialog();
  }, [pdfLoading]);

  const handleNavigateToLanding = useCallback((sectionId: string) => {
    setIsLandingVisible(true);
    // ランディング画面が描画された後にスクロール
    requestAnimationFrame(() => {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }, []);

  const handleTogglePreview = useCallback(() => {
    setIsPreviewEnabled((prev) => !prev);
  }, []);

  const handleToggleAutoFix = useCallback(() => {
    setIsAutoFixEnabled((prev) => !prev);
  }, []);

  useEffect(() => {
    if (pageCount > 0) {
      void renderPage(currentPage);
    }
  }, [currentPage, pageCount, isPreviewEnabled, isAutoFixEnabled, renderPage]);

  const handleStart = useCallback(() => {
    setIsLandingVisible(false);
    setStatusMessage(READY_MESSAGE);
    setCurrentPage(1);
    setPageInputValue('1');
    setIsReady(false);
    dispose();
  }, [dispose]);

  const hasDocument = pageCount > 0;
  const sliderDisabled = !hasDocument || pageCount <= 1 || pdfLoading;
  const sliderMax = Math.max(pageCount, 1);
  const sliderValue = Math.min(currentPage, sliderMax);
  const heroStatus = pdfLoading ? '読み込み中です…' : (pdfError || statusMessage);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!hasDocument || isLandingVisible) {
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

      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        goToPage(currentPage + 1);
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        goToPage(currentPage - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [goToPage, hasDocument, currentPage, isLandingVisible]);

  if (isLandingVisible) {
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
          <a
            href="#features"
            onClick={(e) => {
              e.preventDefault();
              handleNavigateToLanding('features');
            }}
          >
            特徴
          </a>
          <a
            href="#contact"
            onClick={(e) => {
              e.preventDefault();
              handleNavigateToLanding('contact');
            }}
          >
            問い合わせ
          </a>
          <a
            href="#help"
            onClick={(e) => {
              e.preventDefault();
              handleNavigateToLanding('help');
            }}
          >
            使い方
          </a>
        </nav>
      </header>

      <main className="hero-stage">
        <div className={`hero-stage__panel${hasDocument ? ' hero-stage__panel--viewer' : ''}`}>
          {!hasDocument ? (
            <div className="hero-uploader hero-uploader--center">
              <FileUploader
                ref={fileUploaderRef}
                disabled={pdfLoading}
                onFileSelected={handleFileSelected}
                statusMessage={heroStatus}
              />
            </div>
          ) : null}
          <div className={`hero-viewport hero-viewport--full${hasDocument ? '' : ' hero-viewport--hidden'}`}>
            <ProjectionViewport
              canvasRef={canvasRef}
              isLoading={pdfLoading}
              isReady={isReady}
              canGoPrev={currentPage > 1}
              canGoNext={currentPage < sliderMax}
              onGoPrev={() => goToPage(currentPage - 1)}
              onGoNext={() => goToPage(currentPage + 1)}
              aspectRatio={aspectRatio}
            />
          </div>
        </div>
      </main>

      <section className="studio-command-bar studio-command-bar--hero" aria-label="スタジオ操作">
        <button type="button" onClick={handleOpenFileDialog} disabled={pdfLoading} className="studio-command-bar__button" aria-label="PDFをアップロード">
          <img src={uploadIcon} alt="" aria-hidden="true" className="studio-command-bar__icon" />
        </button>
        <div className="studio-command-bar__divider" aria-hidden="true" />
        <button type="button" onClick={() => goToPage(1)} disabled={sliderDisabled} aria-label="最初のページへ" className="studio-command-bar__button">
          <img src={firstPageIcon} alt="" aria-hidden="true" className="studio-command-bar__icon" />
        </button>
        <button type="button" onClick={() => goToPage(currentPage - 1)} disabled={sliderDisabled || currentPage === 1} aria-label="前のページへ" className="studio-command-bar__button">
          <img src={prevIcon} alt="" aria-hidden="true" className="studio-command-bar__icon" />
        </button>
        <div className="studio-command-bar__slider">
          <input
            type="range"
            min={1}
            max={sliderMax}
            step={1}
            value={sliderValue}
            onChange={(event) => goToPage(Number(event.target.value))}
            disabled={sliderDisabled}
          />
          <div className="studio-command-bar__value">{hasDocument ? `${currentPage} / ${sliderMax}` : '0 / 0'}</div>
        </div>
        <button type="button" onClick={() => goToPage(currentPage + 1)} disabled={sliderDisabled || currentPage === sliderMax} aria-label="次のページへ" className="studio-command-bar__button">
          <img src={nextIcon} alt="" aria-hidden="true" className="studio-command-bar__icon" />
        </button>
        <button type="button" onClick={() => goToPage(sliderMax)} disabled={sliderDisabled} aria-label="最後のページへ" className="studio-command-bar__button">
          <img src={lastPageIcon} alt="" aria-hidden="true" className="studio-command-bar__icon" />
        </button>
        <div className="studio-command-bar__divider" aria-hidden="true" />
        <button
          type="button"
          onClick={handleTogglePreview}
          disabled={!hasDocument || pdfLoading}
          className={`studio-command-bar__button ${isPreviewEnabled ? 'studio-command-bar__button--active' : ''}`}
          aria-label="プロジェクタープレビューを切り替え"
        >
          <img src={projectorPreviewIcon} alt="" aria-hidden="true" className="studio-command-bar__icon" />
        </button>
        <button
          type="button"
          onClick={handleToggleAutoFix}
          disabled={!hasDocument || pdfLoading}
          className={`studio-command-bar__button ${isAutoFixEnabled ? 'studio-command-bar__button--active' : ''}`}
          aria-label="資料修正を適用"
        >
          修正
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
      </section>

    </div>
  );
};

export default App;
