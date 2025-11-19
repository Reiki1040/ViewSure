import { useCallback, useEffect, useRef, useState } from 'react';
import FileUploader, { type FileUploaderHandle } from './components/FileUploader';
import ProjectionViewport from './components/ProjectionViewport';
import LandingScreen from './components/LandingScreen';
import logoWhite from './assets/ViewSureIconWhite.png';
import { createPdfRenderer } from './utils/pdf';

type PdfRenderer = Awaited<ReturnType<typeof createPdfRenderer>>;

const READY_MESSAGE = 'PDF を読み込んでください';

const App = () => {
  const fileUploaderRef = useRef<FileUploaderHandle | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<PdfRenderer | null>(null);

  const [isLandingVisible, setIsLandingVisible] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string>(READY_MESSAGE);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInputValue, setPageInputValue] = useState('1');
  const [aspectRatio, setAspectRatio] = useState(9 / 16);

  useEffect(() => {
    return () => {
      rendererRef.current?.dispose?.();
      rendererRef.current = null;
    };
  }, []);

  const renderPage = useCallback(
    async (pageNumber: number) => {
      const renderer = rendererRef.current;
      const canvas = canvasRef.current;
      console.log('[App] renderPage start', { pageNumber, hasRenderer: Boolean(renderer), hasCanvas: Boolean(canvas) });
      if (!renderer || !canvas) {
        console.warn('[App] renderPage skipped (renderer/canvas missing)');
        return;
      }

      setIsLoading(true);
      try {
        const pageCanvas = await renderer.getPageCanvas(pageNumber - 1);
        const context = canvas.getContext('2d');
        if (!context) {
          throw new Error('キャンバスコンテキストの取得に失敗しました');
        }

        canvas.width = pageCanvas.width;
        canvas.height = pageCanvas.height;
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(pageCanvas, 0, 0);

        if (pageCanvas.width > 0 && pageCanvas.height > 0) {
          setAspectRatio(pageCanvas.height / pageCanvas.width);
        }

        setCurrentPage(pageNumber);
        setPageInputValue(String(pageNumber));
        setIsReady(true);
        console.log('[App] renderPage success', { pageNumber, width: pageCanvas.width, height: pageCanvas.height });
      } catch (error) {
        console.error('[App] renderPage error', error);
        setStatusMessage('ページの描画に失敗しました');
        setIsReady(false);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const handleFileSelected = useCallback(
    async (file: File) => {
      console.log('[App] handleFileSelected start', file.name, file.type, file.size);
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        setStatusMessage('PDF 形式のみ対応しています');
        console.warn('[App] handleFileSelected rejected (not PDF)');
        return;
      }

      setIsLoading(true);
      try {
        rendererRef.current?.dispose?.();
        rendererRef.current = null;
        const buffer = await file.arrayBuffer();
        const renderer = await createPdfRenderer(buffer, 1.5);
        rendererRef.current = renderer;
        console.log('[App] PDF renderer ready', { pageCount: renderer.pageCount });

        setPageCount(renderer.pageCount);
        setStatusMessage(`${file.name} (${renderer.pageCount} ページ)`);
        window.requestAnimationFrame(() => {
          console.log('[App] requestAnimationFrame -> render first page');
          void renderPage(1);
        });
      } catch (error) {
        console.error('[App] handleFileSelected error', error);
        setStatusMessage('PDF の読み込みに失敗しました');
        setIsReady(false);
        setPageCount(0);
        setCurrentPage(1);
        setPageInputValue('1');
      } finally {
        setIsLoading(false);
      }
    },
    [renderPage]
  );

  const goToPage = useCallback(
    (page: number) => {
      if (!rendererRef.current || pageCount === 0) {
        return;
      }
      const clamped = Math.min(Math.max(page, 1), pageCount);
      if (clamped === currentPage) {
        return;
      }
      void renderPage(clamped);
    },
    [currentPage, pageCount, renderPage]
  );

  const handlePageInputCommit = useCallback(() => {
    const parsed = Number(pageInputValue);
    if (!Number.isFinite(parsed)) {
      return;
    }
    goToPage(parsed);
  }, [goToPage, pageInputValue]);

  const handleOpenFileDialog = useCallback(() => {
    if (isLoading) {
      return;
    }
    fileUploaderRef.current?.openFileDialog();
  }, [isLoading]);

  const handleStart = useCallback(() => {
    setIsLandingVisible(false);
    setStatusMessage(READY_MESSAGE);
    setPageCount(0);
    setCurrentPage(1);
    setPageInputValue('1');
    setIsReady(false);
  }, []);

  const hasDocument = pageCount > 0;
  const sliderDisabled = !hasDocument || pageCount <= 1 || isLoading;
  const sliderMax = Math.max(pageCount, 1);
  const sliderValue = Math.min(currentPage, sliderMax);
  const heroStatus = isLoading ? '読み込み中です…' : statusMessage;

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
          <a href="#features">特徴</a>
          <a href="#contact">問い合わせ</a>
          <a href="#help">ヘルプ</a>
        </nav>
      </header>

      <main className="hero-stage">
        <div className={`hero-stage__panel${hasDocument ? ' hero-stage__panel--viewer' : ''}`}>
          {!hasDocument ? (
            <div className="hero-uploader hero-uploader--center">
              <FileUploader
                ref={fileUploaderRef}
                disabled={isLoading}
                onFileSelected={handleFileSelected}
                statusMessage={heroStatus}
              />
            </div>
          ) : null}
          <div className={`hero-viewport hero-viewport--full${hasDocument ? '' : ' hero-viewport--hidden'}`}>
            <ProjectionViewport
              canvasRef={canvasRef}
              isLoading={isLoading}
              isReady={isReady}
              canGoPrev={currentPage > 1}
              canGoNext={currentPage < sliderMax}
              onGoPrev={() => goToPage(currentPage - 1)}
              onGoNext={() => goToPage(currentPage + 1)}
              aspectRatio={aspectRatio}
            />
          </div>
        </div>
        <p className="hero-stage__status" role="status" aria-live="polite">
          {heroStatus}
        </p>
      </main>

      <section className="studio-command-bar studio-command-bar--hero" aria-label="スタジオ操作">
        <button type="button" onClick={handleOpenFileDialog} disabled={isLoading}>
          <span aria-hidden="true">📤</span>
        </button>
        <div className="studio-command-bar__divider" aria-hidden="true" />
        <button type="button" onClick={() => goToPage(1)} disabled={sliderDisabled} aria-label="最初のページへ">
          ⏮
        </button>
        <button type="button" onClick={() => goToPage(currentPage - 1)} disabled={sliderDisabled || currentPage === 1} aria-label="前のページへ">
          ⏪
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
        <button type="button" onClick={() => goToPage(currentPage + 1)} disabled={sliderDisabled || currentPage === sliderMax} aria-label="次のページへ">
          ⏩
        </button>
        <button type="button" onClick={() => goToPage(sliderMax)} disabled={sliderDisabled} aria-label="最後のページへ">
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
      </section>
    </div>
  );
};

export default App;
