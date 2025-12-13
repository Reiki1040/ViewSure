import { useCallback, useEffect, useRef, useState } from 'react';
import FileUploader, { type FileUploaderHandle } from './components/FileUploader';
import ProjectionViewport from './components/ProjectionViewport';
import LandingScreen from './components/LandingScreen';

// Assets
import logoWhite from './assets/ViewSureIconWhite.png';
import firstPageIcon from './assets/first_page.png';
import lastPageIcon from './assets/last_page.png';
import nextIcon from './assets/next.png';
import prevIcon from './assets/pre.png';
import projectorPreviewIcon from './assets/project_preview.png';
import uploadIcon from './assets/import.png';

// Hooks & Utils
import { usePdfRenderer } from './hooks/usePdfRenderer';
import { initWasm, applyToneMapping } from './utils/toneMapping';
import { analyzePageContrast } from './utils/wcag';
import { extractImagesFromPdf, type ImageCrop } from './utils/imageExtractor';

// Constants
const READY_MESSAGE = 'PDF を読み込んでください';

// Types
/** ページごとの解析結果を表す型 */
type PageFinding = { 
  /** ページ番号 (1-based) */
  page: number; 
  /** 検出された問題や特徴のリスト */
  flags: string[] 
};

/**
 * アプリケーションのメインコンポーネント
 * 
 * 状態管理、UIの統合、ビジネスロジックの調整を行う。
 * プレゼンテーション資料のプレビュー、ページ移動、WCAGチェック機能を提供する。
 */
const App = () => {
  // -- Refs --
  const fileUploaderRef = useRef<FileUploaderHandle | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // -- Custom Hooks --
  const {
    getRenderer,
    pageCount,
    isLoading: pdfLoading,
    error: pdfError,
    loadPdf,
    getSourceBuffer,
    dispose
  } = usePdfRenderer();

  // -- State: UI Visibility --
  const [isLandingVisible, setIsLandingVisible] = useState(true);
  const [isPreviewEnabled, setIsPreviewEnabled] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>(READY_MESSAGE);
  const [isReady, setIsReady] = useState(false);

  // -- State: Page Navigation --
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInputValue, setPageInputValue] = useState('1');
  
  // -- State: Document Properties --
  const [aspectRatio, setAspectRatio] = useState(9 / 16);
  
  // -- State: Feature Flags & Data --
  const [isAutoFixEnabled, setIsAutoFixEnabled] = useState(false); // 将来的な機能拡張用
  const [pageImages, setPageImages] = useState<Record<number, ImageCrop[]>>({}); // 画像抽出結果
  const [galleryImages, setGalleryImages] = useState<string[]>([]); // ギャラリー用画像URL

  // -- State: Readability Analysis --
  const [readabilityReport, setReadabilityReport] = useState<string | null>(null);
  const [readabilityDetails, setReadabilityDetails] = useState<PageFinding[]>([]);
  const [readabilityFilter, setReadabilityFilter] = useState<string | null>(null);


  // -- Handlers & Logic --

  /**
   * 指定されたページをキャンバスに描画する
   * 
   * @param pageNumber 描画するページ番号 (1-based)
   */
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
        // 1. PDFページをキャンバスにレンダリング
        const pageCanvas = await rendererInstance.getPageCanvas(pageNumber - 1);
        const context = canvas.getContext('2d');
        if (!context) {
          throw new Error('キャンバスコンテキストの取得に失敗しました');
        }

        // 2. 表示用キャンバスのサイズを合わせる
        canvas.width = pageCanvas.width;
        canvas.height = pageCanvas.height;
        context.clearRect(0, 0, canvas.width, canvas.height);
        
        // 3. レンダリング結果をコピー
        context.drawImage(pageCanvas, 0, 0);

        // 4. プロジェクタープレビューモードならトーンマッピングを適用
        if (isPreviewEnabled) {
          applyToneMapping(context, canvas.width, canvas.height);
        }

        // 5. アスペクト比を更新（ビューポート調整用）
        if (pageCanvas.width > 0 && pageCanvas.height > 0) {
          setAspectRatio(pageCanvas.height / pageCanvas.width);
        }

        // 6. UI状態の更新
        setCurrentPage((prev) => (prev === pageNumber ? prev : pageNumber));
        setPageInputValue((prev) => (prev === String(pageNumber) ? prev : String(pageNumber)));
        console.log('[App] renderPage success', { pageNumber, width: pageCanvas.width, height: pageCanvas.height });
      } catch (error) {
        console.error('[App] renderPage error', error);
        setStatusMessage('ページの描画に失敗しました');
        setIsReady(false);
      }
    },
    [getRenderer, isPreviewEnabled, isAutoFixEnabled, pageImages] // pageImagesは使われていないが依存に含まれていたため維持
  );

  
  /**
   * ファイルが選択されたときの処理
   * PDFをロードし、初期画像の抽出などを行う
   */
  const handleFileSelected = useCallback(
    async (file: File) => {
      console.log('[App] handleFileSelected start', file.name, file.type, file.size);
      
      try {
        await loadPdf(file);
        
        // 状態のリセット
        setCurrentPage(1);
        setPageInputValue('1');
        setIsReady(true);
        setGalleryImages([]);
        
        // 画像抽出処理（非同期で実行）
        const bufferExisting = getSourceBuffer();
        if (bufferExisting) {
          void extractImagesFromPdf(bufferExisting, 2).then((results) => {
            const map: Record<number, ImageCrop[]> = {};
            const gallery: string[] = [];
            results.forEach((entry) => {
              map[entry.page] = entry.images;
              entry.images.forEach((img) => {
                gallery.push(img.canvas.toDataURL('image/png'));
              });
            });
            setPageImages(map);
            setGalleryImages(gallery);
          }).catch((err) => {
            console.warn('[Images] 画像抽出に失敗しました', err);
            setPageImages({});
            setGalleryImages([]);
          });
        } else {
          setGalleryImages([]);
          setPageImages({});
        }
        
        // 最初のページを描画
        void renderPage(1);
      } catch (error) {
        console.error('[App] handleFileSelected error', error);
        setStatusMessage('PDF の読み込みに失敗しました');
        setIsReady(false);
        setCurrentPage(1);
        setPageInputValue('1');
      }
    },
    [loadPdf, renderPage, getSourceBuffer]
  );

  /**
   * 指定ページへ移動する
   */
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

  /**
   * ページ番号入力が確定したときの処理
   */
  const handlePageInputCommit = useCallback(() => {
    const parsed = Number(pageInputValue);
    if (!Number.isFinite(parsed)) {
      return;
    }
    goToPage(parsed);
  }, [goToPage, pageInputValue]);

  /**
   * ファイル選択ダイアログを開く
   */
  const handleOpenFileDialog = useCallback(() => {
    if (pdfLoading) {
      return;
    }
    fileUploaderRef.current?.openFileDialog();
  }, [pdfLoading]);

  /**
   * ランディングページ内のセクションへスクロールする
   */
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

  /**
   * PDF全体の読みやすさをチェックする（WCAG基準など）
   * 全ページを走査し、問題点をリストアップする
   */
  const handleReadabilityCheck = useCallback(async () => {
    const rendererInstance = getRenderer();
    if (!rendererInstance || pageCount === 0) {
      setStatusMessage('PDF を読み込んでください');
      return;
    }
    
    setStatusMessage('読みやすさをチェックしています...');
    const perPageFindings: PageFinding[] = [];
    
    // 全ページをループ処理
    for (let index = 0; index < pageCount; index += 1) {
      try {
        // テキストコンテンツとキャンバスを取得
        const textContent = await rendererInstance.getPageTextContent(index);
        const pageCanvas = await rendererInstance.getPageCanvas(index);
        const ctx = pageCanvas.getContext('2d');
        
        // 基本的な統計情報を計算
        const totalChars = textContent.runs.reduce((sum, run) => sum + run.text.trim().length, 0);
        const minFont = textContent.runs.reduce((min, run) => Math.min(min, run.fontSize), Infinity);
        const maxFont = textContent.runs.reduce((max, run) => Math.max(max, run.fontSize), 0);

        // 簡易的な行解析（Y座標が近いものを同じ行とみなす）
        const lines = [...textContent.runs]
          .sort((a, b) => a.y - b.y)
          .reduce<Array<{ y: number; width: number; font: number }>>((acc, run) => {
            const threshold = Math.max(6, run.height * 0.6);
            const line = acc.find((l) => Math.abs(l.y - run.y) < threshold);
            if (line) {
              line.width = Math.max(line.width, run.width + run.x);
            } else {
              acc.push({ y: run.y, width: run.width + run.x, font: run.fontSize });
            }
            return acc;
          }, []);
          
        const pageWidth = textContent.width || pageCanvas.width;
        const hasLongLine = lines.some((line) => line.width > pageWidth * 0.8);
        
        // 行間（Gap）の解析
        const sortedLines = [...lines].sort((a, b) => a.y - b.y);
        const gaps: number[] = [];
        for (let i = 1; i < sortedLines.length; i += 1) {
          gaps.push(sortedLines[i].y - sortedLines[i - 1].y);
        }
        const minGap = gaps.length ? Math.min(...gaps) : Infinity;

        // フラグ判定
        const flags: string[] = [];
        if (totalChars > 1200) flags.push('情報量が多い');
        if (minFont < 12) flags.push('小さい文字が含まれる');
        if (maxFont > 72) flags.push('極端に大きい文字が含まれる');
        if (hasLongLine) flags.push('横幅いっぱいの長い行がある');
        if (minGap < 12) flags.push('行間が詰まり気味');
        
        // コントラスト解析
        if (ctx) {
          const contrastIssues = analyzePageContrast(ctx, textContent);
          if (contrastIssues.length > 0) {
            const samples = contrastIssues.map((issue) => `「${issue.text}」(比 ${issue.ratio} < ${issue.required})`);
            flags.push(`コントラストが低い要素: ${samples.join(' / ')}`);
          }
        }

        if (flags.length) {
          perPageFindings.push({ page: index + 1, flags });
        }
      } catch (err) {
        console.error(`Page ${index + 1} analysis failed`, err);
        perPageFindings.push({ page: index + 1, flags: ['解析に失敗'] });
      }
    }
    
    // レポート作成
    const report = perPageFindings.length
      ? '読みやすさチェック: 問題があります'
      : '読みやすさチェック: 大きな問題は見つかりませんでした';
      
    setReadabilityReport(report);
    setReadabilityDetails(perPageFindings);
    setReadabilityFilter(null);
    setStatusMessage(report);
  }, [getRenderer, pageCount, setStatusMessage]);

  /**
   * スタート画面からアプリ画面へ遷移する
   */
  const handleStart = useCallback(() => {
    setIsLandingVisible(false);
    setStatusMessage(READY_MESSAGE);
    setCurrentPage(1);
    setPageInputValue('1');
    setIsReady(false);
    setGalleryImages([]);
    dispose();
  }, [dispose]);


  // -- Effects --

  /**
   * 初期化時にWASMモジュールをロードする
   */
  useEffect(() => {
    initWasm().catch(err => {
      console.error('Failed to initialize WASM in App', err);
      // 将来的にはここでエラー通知を行うなどを検討
    });
  }, []);

  /**
   * コンポーネントのアンマウント時にPDFリソースを解放する
   */
  useEffect(() => {
    return () => {
      dispose();
    };
  }, [dispose]);

  /**
   * ページが変更されたときなどに再描画を行うEffect
   */
  useEffect(() => {
    if (pageCount > 0) {
      void renderPage(currentPage);
    }
  }, [currentPage, pageCount, isPreviewEnabled, isAutoFixEnabled, renderPage]);

  // キーボードショートカットの登録
  useEffect(() => {
    const hasDocument = pageCount > 0;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!hasDocument || isLandingVisible) {
        return;
      }
      // 入力フォーム等での操作時は無視
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
  }, [goToPage, pageCount, currentPage, isLandingVisible]); // pageCountを依存配列に追加

  // -- Render Helpers --
  
  const hasDocument = pageCount > 0;
  const sliderDisabled = !hasDocument || pageCount <= 1 || pdfLoading;
  const sliderMax = Math.max(pageCount, 1);
  const sliderValue = Math.min(currentPage, sliderMax);
  const heroStatus = pdfLoading ? '読み込み中です…' : (pdfError || statusMessage);
  
  // 読みやすさレポートのフィルタリングロジック
  const currentReadability = readabilityDetails.find((entry) => entry.page === currentPage);
  const filteredFlags = currentReadability
    ? currentReadability.flags.filter((f) => !readabilityFilter || f.includes(readabilityFilter))
    : [];
  const countByKeyword = (keyword: string) =>
    currentReadability ? currentReadability.flags.filter((f) => f.includes(keyword)).length : 0;


  if (isLandingVisible) {
    return <LandingScreen onStart={handleStart} />;
  }

  return (
    <div className="hero-app">
      {/* Header */}
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

      {/* Main Stage */}
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

      {/* Control Bar */}
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
          onClick={handleReadabilityCheck}
          disabled={!hasDocument || pdfLoading}
          className="studio-command-bar__button"
          aria-label="読みやすさをチェック"
        >
          チェック
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

      {/* Readability Report Overlay */}
      {readabilityReport ? (
        <section className="readability-report" aria-live="polite" aria-label="読みやすさチェック結果">
          <div className="readability-report__icon" aria-hidden="true">!</div>
          <div className="readability-report__body">
            <h3>読みやすさチェック結果</h3>
            <p>{readabilityReport}</p>
            {readabilityDetails.length ? (
              <>
                <div className="readability-report__summary">
                  <span className="readability-chip readability-chip--pages">
                    現在のページ: {currentPage}
                  </span>
                  <button
                    type="button"
                    className={`readability-chip ${readabilityFilter === '情報量が多い' ? 'is-active' : ''}`}
                    onClick={() => setReadabilityFilter(readabilityFilter === '情報量が多い' ? null : '情報量が多い')}
                  >
                    情報量多い: {countByKeyword('情報量が多い')}
                  </button>
                  <button
                    type="button"
                    className={`readability-chip ${readabilityFilter === '小さい文字' ? 'is-active' : ''}`}
                    onClick={() => setReadabilityFilter(readabilityFilter === '小さい文字' ? null : '小さい文字')}
                  >
                    小さい文字: {countByKeyword('小さい文字')}
                  </button>
                  <button
                    type="button"
                    className={`readability-chip ${readabilityFilter === '長い行' ? 'is-active' : ''}`}
                    onClick={() => setReadabilityFilter(readabilityFilter === '長い行' ? null : '長い行')}
                  >
                    長い行: {countByKeyword('長い行')}
                  </button>
                  <button
                    type="button"
                    className={`readability-chip ${readabilityFilter === '行間' ? 'is-active' : ''}`}
                    onClick={() => setReadabilityFilter(readabilityFilter === '行間' ? null : '行間')}
                  >
                    行間: {countByKeyword('行間')}
                  </button>
                  <button
                    type="button"
                    className={`readability-chip readability-chip--alert ${readabilityFilter === 'コントラスト' ? 'is-active' : ''}`}
                    onClick={() => setReadabilityFilter(readabilityFilter === 'コントラスト' ? null : 'コントラスト')}
                  >
                    コントラスト: {countByKeyword('コントラスト')}
                  </button>
                </div>
                <div className="readability-report__list">
                  {currentReadability ? (
                    filteredFlags.length ? (
                      <div className="readability-report__item">
                        <div className="readability-report__item-page">ページ {currentReadability.page}</div>
                        <div className="readability-report__item-flags">
                          {filteredFlags.map((flag, idx) => (
                            <span className="readability-tag" key={`${currentReadability.page}-${idx}`}>{flag}</span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="readability-report__item">
                        <div className="readability-report__item-page">ページ {currentPage}</div>
                        <div className="readability-report__item-flags">
                          <span className="readability-tag">このページは表示する問題がありません</span>
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="readability-report__item">
                      <div className="readability-report__item-page">ページ {currentPage}</div>
                      <div className="readability-report__item-flags">
                        <span className="readability-tag">このページは問題なし</span>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </section>
      ) : null}

    </div>
  );
};

export default App;
