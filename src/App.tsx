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
import hintIcon from './assets/hint.png';

// Hooks & Utils
import { usePdfRenderer } from './hooks/usePdfRenderer';
import { initWasm, applyToneMapping } from './utils/toneMapping';
import { analyzePageContrast, detectPrimaryColors, analyzeColorBalance, type ColorBalanceResult } from './utils/wcag';
import { extractImagesFromPdf, type ImageCrop } from './utils/imageExtractor';

// Constants
const READY_MESSAGE = 'PDF を読み込んでください';

// Types
/** ページごとの解析結果を表す型 */
type PageFinding = { 
  /** ページ番号 (1-based) */
  page: number; 
  /** 検出された問題や特徴のリスト */
  flags: string[];
  /** コントラストの詳細（テキスト抜粋と比率） */
  contrastDetails?: string[];
  /** 原色の詳細（検出された色） */
  primaryColorDetails?: string[];
  /** 配色バランスの結果 */
  colorBalance?: ColorBalanceResult;
  /** 小さい文字の詳細（テキスト抜粋とサイズ） */
  fontSizeDetails?: string[];
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
  const [readabilityExpanded, setReadabilityExpanded] = useState(false);
  const [autoCheckPending, setAutoCheckPending] = useState(false);
  const [isGuideVisible, setIsGuideVisible] = useState(false);
  const [isHowToUseVisible, setIsHowToUseVisible] = useState(false);
  const [isTopVisible, setIsTopVisible] = useState(true);


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
        setReadabilityReport(null);
        setReadabilityDetails([]);
        setReadabilityFilter(null);
        setReadabilityExpanded(false);
        setAutoCheckPending(true);
        
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
        setAutoCheckPending(false);
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

  const hiddenInputRef = useRef<HTMLInputElement>(null);

  /**
   * ファイルが選択されたときの処理（隠しインプット用）
   */
  const handleHiddenInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      void handleFileSelected(files[0]);
    }
    // 同じファイルを再度選択できるように値をリセット
    event.target.value = '';
  }, [handleFileSelected]);

  /**
   * ファイル選択ダイアログを開く
   */
  const handleOpenFileDialog = useCallback(() => {
    if (pdfLoading) {
      return;
    }
    // FileUploaderが表示されていればそれを使う、なければ隠しインプットを使う
    if (fileUploaderRef.current) {
      fileUploaderRef.current.openFileDialog();
    } else {
      hiddenInputRef.current?.click();
    }
  }, [pdfLoading]);

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
        // フォントサイズ判定は、スケールの影響を受けない originalFontSize を使用する
        const smallFontRuns = textContent.runs.filter(r => r.originalFontSize < 18 && r.text.trim().length > 0);
        const maxFont = textContent.runs.reduce((max, run) => Math.max(max, run.originalFontSize), 0);

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
          
        // 行間（Gap）の解析
        const sortedLines = [...lines].sort((a, b) => a.y - b.y);
        const gaps: number[] = [];
        for (let i = 1; i < sortedLines.length; i += 1) {
          gaps.push(sortedLines[i].y - sortedLines[i - 1].y);
        }
        const minGap = gaps.length ? Math.min(...gaps) : Infinity;

        const flags: string[] = [];
        let fontSizeDetails: string[] = [];
        
        if (totalChars > 400) flags.push(`情報量が多い (${totalChars}文字)`);
        
        if (smallFontRuns.length > 0) {
          flags.push(`小さい文字が含まれる: ${smallFontRuns.length}箇所`);
          // 詳細リストを作成（上位20件程度に絞る）
          fontSizeDetails = smallFontRuns
            .slice(0, 20)
            .map(r => `「${r.text.trim().slice(0, 20)}${r.text.length > 20 ? '...' : ''}」 (${Math.round(r.originalFontSize * 10) / 10}pt)`);
        }
        
        if (maxFont > 72) flags.push('極端に大きい文字が含まれる');
        if (minGap < 12) flags.push('行間が詰まり気味');

        // 原色チェック
        let primaryColorDetails: string[] = [];
        if (ctx) {
          const detected = detectPrimaryColors(ctx);
          if (detected.length > 0) {
            flags.push(`原色が含まれる: ${detected.length}色`);
            primaryColorDetails = detected.map(c => {
               switch(c) {
                 case 'Red': return '赤 (Red: #FF0000)';
                 case 'Green': return '緑 (Green: #00FF00)';
                 case 'Blue': return '青 (Blue: #0000FF)';
                 case 'Yellow': return '黄 (Yellow: #FFFF00)';
                 case 'Cyan': return '水色 (Cyan: #00FFFF)';
                 case 'Magenta': return 'ピンク (Pink: #FF00FF)';
                 default: return c;
               }
            });
          }
        }

        // 配色バランス解析
        let colorBalance: ColorBalanceResult | undefined;
        if (ctx) {
          colorBalance = analyzeColorBalance(ctx);
          if (!colorBalance.isBalanced) {
            flags.push('配色バランスが崩れています');
          }
        }
        
        // コントラスト解析
        if (ctx) {
          const contrastIssues = analyzePageContrast(ctx, textContent);
          if (contrastIssues.length > 0) {
            const samples = contrastIssues.map((issue) => `「${issue.text}」(比 ${issue.ratio} < ${issue.required})`);
            flags.push(`コントラスト: ${contrastIssues.length}件`);
            // コントラスト詳細は別に保持して、UIで展開表示する
            perPageFindings.push({ page: index + 1, flags, contrastDetails: samples, fontSizeDetails, primaryColorDetails, colorBalance });
            continue; // このページは既に perPageFindings に追加したのでスキップ
          }
        }

        if (flags.length) {
          perPageFindings.push({ page: index + 1, flags, fontSizeDetails, primaryColorDetails, colorBalance });
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
    setReadabilityExpanded(false);
    setStatusMessage(report);
  }, [getRenderer, pageCount, setStatusMessage]);


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

  useEffect(() => {
    if (!autoCheckPending) {
      return;
    }
    if (pageCount > 0 && !pdfLoading) {
      setAutoCheckPending(false);
      void handleReadabilityCheck();
    }
  }, [autoCheckPending, handleReadabilityCheck, pageCount, pdfLoading]);

  // キーボードショートカットの登録
  useEffect(() => {
    const hasDocument = pageCount > 0;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!hasDocument) {
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
  }, [goToPage, pageCount, currentPage]); // pageCountを依存配列に追加

  /**
   * スタート画面からアプリ画面へ遷移する
   */
  const handleStart = useCallback(() => {
    // 履歴に追加（戻るボタンで戻れるようにする）
    window.history.pushState({ app: true }, '', '#app');
    setIsTopVisible(false);
  }, []);

  // ブラウザバックの検知
  useEffect(() => {
    const handlePopState = () => {
      // 履歴が戻った（ハッシュが消えた）場合、トップ画面を表示
      if (window.location.hash !== '#app') {
        setIsTopVisible(true);
      } else {
        setIsTopVisible(false);
      }
    };

    window.addEventListener('popstate', handlePopState);
    
    // 初期ロード時にハッシュがあればアプリ画面を表示
    if (window.location.hash === '#app') {
      setIsTopVisible(false);
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

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
  const visibleFlags = readabilityExpanded ? filteredFlags : filteredFlags.slice(0, 5);
  const countByKeyword = (keyword: string) =>
    currentReadability ? currentReadability.flags.filter((f) => f.includes(keyword)).length : 0;

  // 10% または 2ページ移動の計算 (切り上げで最低10%を確保)
  const jumpAmount = pageCount <= 10 ? 2 : Math.ceil(pageCount * 0.1);

  if (isTopVisible) {
    return <LandingScreen onStart={handleStart} />;
  }

  return (
    <div className="hero-app">
      {/* Hidden Input for Re-upload */}
      <input
        type="file"
        accept=".pdf,application/pdf"
        ref={hiddenInputRef}
        style={{ display: 'none' }}
        onChange={handleHiddenInputChange}
        aria-hidden="true"
      />

      {/* Header */}
      <header className="landing__header landing__header--app" aria-label="ViewSure">
        <div className="landing__brand">
          <img src={logoWhite} alt="ViewSure" className="landing__logo" />
          <span className="landing__brand-text">ViewSure</span>
          <button
            type="button"
            className="studio-command-bar__button"
            style={{ 
              marginLeft: '12px', 
              background: 'transparent', 
              border: '1px solid rgba(255,255,255,0.3)',
              width: '52px',
              height: '52px',
            }}
            onClick={() => setIsHowToUseVisible(true)}
            aria-label="使い方を表示"
          >
            <img src={hintIcon} alt="" aria-hidden="true" className="studio-command-bar__icon" />
          </button>
        </div>
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
          <aside className="readability-side-panel">
              <div className="readability-report__body">
                <h3>読みやすさチェック結果</h3>
                {hasDocument && readabilityReport ? (
                  <>
                  <p>{readabilityReport}</p>
                {readabilityDetails.length ? (
                  <>
                    <div className="readability-report__summary">
                      {countByKeyword('情報量が多い') > 0 && (
                        <button
                          type="button"
                          className={`readability-chip ${readabilityFilter === '情報量が多い' ? 'is-active' : ''}`}
                          onClick={() => setReadabilityFilter(readabilityFilter === '情報量が多い' ? null : '情報量が多い')}
                        >
                          情報量多い: {countByKeyword('情報量が多い')}
                        </button>
                      )}
                      {countByKeyword('小さい文字') > 0 && (
                        <button
                          type="button"
                          className={`readability-chip ${readabilityFilter === '小さい文字' ? 'is-active' : ''}`}
                          onClick={() => setReadabilityFilter(readabilityFilter === '小さい文字' ? null : '小さい文字')}
                        >
                          小さい文字: {countByKeyword('小さい文字')}
                        </button>
                      )}
                      {countByKeyword('行間') > 0 && (
                        <button
                          type="button"
                          className={`readability-chip ${readabilityFilter === '行間' ? 'is-active' : ''}`}
                          onClick={() => setReadabilityFilter(readabilityFilter === '行間' ? null : '行間')}
                        >
                          行間: {countByKeyword('行間')}
                        </button>
                      )}
                      {countByKeyword('コントラスト') > 0 && (
                        <button
                          type="button"
                          className={`readability-chip ${readabilityFilter === 'コントラスト' ? 'is-active' : ''}`}
                          onClick={() => setReadabilityFilter(readabilityFilter === 'コントラスト' ? null : 'コントラスト')}
                        >
                          コントラスト: {countByKeyword('コントラスト')}
                        </button>
                      )}
                      {countByKeyword('原色') > 0 && (
                        <button
                          type="button"
                          className={`readability-chip ${readabilityFilter === '原色' ? 'is-active' : ''}`}
                          onClick={() => setReadabilityFilter(readabilityFilter === '原色' ? null : '原色')}
                        >
                          原色: {countByKeyword('原色')}
                        </button>
                      )}
                      {countByKeyword('配色') > 0 && (
                        <button
                          type="button"
                          className={`readability-chip ${readabilityFilter === '配色' ? 'is-active' : ''}`}
                          onClick={() => setReadabilityFilter(readabilityFilter === '配色' ? null : '配色')}
                        >
                          配色: {countByKeyword('配色')}
                        </button>
                      )}
                    </div>
                    <div className="readability-report__list">
                      {currentReadability ? (
                        filteredFlags.length ? (
                          <div className="readability-report__item">
                            <div className="readability-report__item-header">
                              <div className="readability-report__item-page">ページ {currentReadability.page}</div>
                              <div className="readability-report__item-flags">
                                {visibleFlags.map((flag, idx) => (
                                  <span className="readability-tag" key={`${currentReadability.page}-${idx}`}>{flag}</span>
                                ))}
                                {!readabilityExpanded && filteredFlags.length > visibleFlags.length ? (
                                  <button
                                    type="button"
                                    className="readability-toggle"
                                    onClick={() => setReadabilityExpanded(true)}
                                  >
                                    残り {filteredFlags.length - visibleFlags.length} 件を表示
                                  </button>
                                ) : null}
                                {readabilityExpanded && filteredFlags.length > 5 ? (
                                  <button
                                    type="button"
                                    className="readability-toggle"
                                    onClick={() => setReadabilityExpanded(false)}
                                  >
                                    折りたたむ
                                  </button>
                                ) : null}
                              </div>
                            </div>
                            {currentReadability.contrastDetails && (!readabilityFilter || readabilityFilter === 'コントラスト') ? (
                              <details className="readability-contrast-details">
                                <summary>コントラストの詳細 ({currentReadability.contrastDetails.length} 件)</summary>
                                <ul>
                                  {currentReadability.contrastDetails.map((detail, idx) => (
                                    <li key={`${currentReadability.page}-contrast-${idx}`}>{detail}</li>
                                  ))}
                                </ul>
                              </details>
                            ) : null}
                            {currentReadability.primaryColorDetails && currentReadability.primaryColorDetails.length > 0 && (!readabilityFilter || readabilityFilter === '原色') ? (
                              <details className="readability-contrast-details">
                                <summary>原色の使用 ({currentReadability.primaryColorDetails.length} 色)</summary>
                                <ul>
                                  {currentReadability.primaryColorDetails.map((detail, idx) => (
                                    <li key={`${currentReadability.page}-primary-${idx}`}>{detail}</li>
                                  ))}
                                </ul>
                              </details>
                            ) : null}
                            {currentReadability.colorBalance && (!readabilityFilter || readabilityFilter === '配色') ? (
                              <details className="readability-contrast-details" open={!currentReadability.colorBalance.isBalanced}>
                                <summary>配色バランス</summary>
                                <ul>
                                  <li>ベース: {currentReadability.colorBalance.base.ratio}% ({currentReadability.colorBalance.base.color}) {currentReadability.colorBalance.base.ratio < 50 || currentReadability.colorBalance.base.ratio > 90 ? '70%推奨' : 'OK'}</li>
                                  <li>メイン: {currentReadability.colorBalance.main.ratio}% ({currentReadability.colorBalance.main.color}) {currentReadability.colorBalance.main.ratio < 10 || currentReadability.colorBalance.main.ratio > 40 ? '25%推奨' : 'OK'}</li>
                                  <li>アクセント: {currentReadability.colorBalance.accent.ratio}% ({currentReadability.colorBalance.accent.color}) {currentReadability.colorBalance.accent.ratio > 20 ? '5%推奨' : 'OK'}</li>
                                </ul>
                              </details>
                            ) : null}
                            {currentReadability.fontSizeDetails && currentReadability.fontSizeDetails.length > 0 && (!readabilityFilter || readabilityFilter === '小さい文字') ? (
                              <details className="readability-contrast-details">
                                <summary>小さい文字の詳細 ({currentReadability.fontSizeDetails.length} 件)</summary>
                                <ul>
                                  {currentReadability.fontSizeDetails.map((detail, idx) => (
                                    <li key={`${currentReadability.page}-font-${idx}`}>{detail}</li>
                                  ))}
                                </ul>
                              </details>
                            ) : null}
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
                  </>
                ) : (
                  <p className="readability-report__placeholder" style={{color: 'rgba(0,0,0,0.5)', marginTop: '10px'}}>
                    PDFを読み込むとここに結果が表示されます。
                  </p>
                )}
              </div>
              <div className="readability-side-panel__footer">
                <button
                  type="button"
                  onClick={() => setIsGuideVisible(true)}
                  className="readability-guide-trigger"
                >
                  判定基準を表示
                </button>
              </div>
            </aside>
        </div>
      </main>

      {/* Control Bar */}
      <section className="studio-command-bar studio-command-bar--hero" aria-label="スタジオ操作">
        <button type="button" onClick={handleOpenFileDialog} disabled={pdfLoading} className="studio-command-bar__button" aria-label="PDFをアップロード">
          <img src={uploadIcon} alt="" aria-hidden="true" className="studio-command-bar__icon" />
        </button>
        <div className="studio-command-bar__divider" aria-hidden="true" />
        <button type="button" onClick={() => goToPage(currentPage - jumpAmount)} disabled={sliderDisabled || currentPage === 1} aria-label={`${jumpAmount}ページ戻る`} className="studio-command-bar__button">
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
        <button type="button" onClick={() => goToPage(currentPage + jumpAmount)} disabled={sliderDisabled || currentPage === sliderMax} aria-label={`${jumpAmount}ページ進む`} className="studio-command-bar__button">
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
          <img src={projectorPreviewIcon} alt="" aria-hidden="true" className="studio-command-bar__icon studio-command-bar__icon--large" />
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

      {isGuideVisible && (
        <div className="guide-modal-overlay">
          <section className="readability-guide guide-modal" aria-label="読みやすさ判定の基準">
            <button
              type="button"
              className="guide-close-button"
              onClick={() => setIsGuideVisible(false)}
              aria-label="閉じる"
            >
              ×
            </button>
            <h3>読みづらさ判定の基準</h3>
            <ul>
              <li><strong>文字が小さすぎる:</strong> 18pt未満はデスクトップでも読みにくく、プロジェクター投影時にはさらに視認性が低下するため、注意喚起します。</li>
              <li><strong>文字が大きすぎる:</strong> 72pt超の特大文字はバランスを崩しがちで、画面を圧迫するため指摘します。</li>
              <li><strong>行間が狭い:</strong> 行と行の間隔がほとんどないページでは詰まって見えるため、行間不足を指摘します。</li>
              <li><strong>情報量が多すぎる:</strong> 1ページ内に文章が詰め込み過ぎている場合（文字数が多い）、読みやすさ低下のサインとしてお知らせします。</li>
              <li><strong>コントラスト不足:</strong> 文字と背景の明るさの差が小さい箇所を見つけて報告します。</li>
              <li><strong>原色の使用:</strong> 赤・緑・青・黄・水色・ピンクなどの原色は、プロジェクターで投影した際に目がチカチカしたり、視認性が悪くなる可能性があるため、注意喚起します。</li>
              <li><strong>配色バランスの崩れ:</strong> ベースカラー（70%）、メインカラー（25%）、アクセントカラー（5%）の黄金比から大きく外れている場合、バランスの乱れとして指摘します。</li>
            </ul>
            <p>目安となる適切な文字サイズ: 本文は 14〜18px 程度、見出しは 20〜32px 程度にすると、一般的なディスプレイやプロジェクターでも読みやすくなります。</p>
            <p>※ 実際の修正は行いません。指摘を参考に元の資料を編集してください。</p>
          </section>
        </div>
      )}

      {isHowToUseVisible && (
        <div className="guide-modal-overlay">
          <section className="readability-guide guide-modal" aria-label="ViewSureの使い方">
            <button
              type="button"
              className="guide-close-button"
              onClick={() => setIsHowToUseVisible(false)}
              aria-label="閉じる"
            >
              ×
            </button>
            <h3>ViewSureの使い方</h3>
            <p>ViewSureは、プレゼンテーション資料の視認性をチェックし、プロジェクター投影時の見え方をシミュレートするツールです。</p>
            
            <h4>基本的な流れ</h4>
            <ul>
              <li><strong>PDFを読み込む:</strong> 中央のアップロードエリアまたは左下の「＋」ボタンからPDFを選択します。</li>
              <li><strong>自動チェック:</strong> 読み込み後、各ページのコントラストや文字サイズ、配色バランスが自動で解析されます。結果は右側のパネルに表示されます。</li>
            </ul>

            <h4>フッターの操作</h4>
            <ul>
              <li><strong>ページ移動:</strong> 
                <ul>
                  <li>単一矢印（‹ ›）: 前後のページへ1枚ずつ移動します。</li>
                  <li>二重矢印（« »）: ページ全体の10%（10枚以下の場合は2ページ）分大きく移動します。</li>
                  <li>スライダー: ドラッグして素早く目的のページへ移動できます。</li>
                </ul>
              </li>
              <li><strong>ページジャンプ:</strong> 右下の入力欄にページ番号を入れて「移動」を押すと、指定ページへ直接ジャンプします。</li>
            </ul>

            <h4>プロジェクター投影機能</h4>
            <ul>
              <li><strong>プレビュー切り替え:</strong> 右下のプロジェクターアイコンをクリックすると、トーンマッピングが適用されます。</li>
              <li><strong>シミュレーション:</strong> プロジェクター特有の「黒浮き」やコントラストの低下を再現し、実際の会場でどのように見えるかを確認できます。</li>
            </ul>
          </section>
        </div>
      )}

    </div>
  );
};

export default App;
