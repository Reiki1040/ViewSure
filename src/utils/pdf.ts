import { PdfPageTextRun, PdfPageTextContent } from '../types/pdf';

let pdfModulePromise: Promise<typeof import('pdfjs-dist/legacy/build/pdf.js')> | null = null;
let workerConfigured = false;

const loadPdfModule = async () => {
  // pdf.js 本体を読み込みし、workerSrc初回だけ設定する。
  if (!pdfModulePromise) {
    pdfModulePromise = import('pdfjs-dist/legacy/build/pdf.js');
  }

  const pdfModule = await pdfModulePromise;
  if (!workerConfigured) {
    const workerSrcModule = await import('pdfjs-dist/legacy/build/pdf.worker.min.js?url');
    pdfModule.GlobalWorkerOptions.workerSrc = workerSrcModule.default;
    workerConfigured = true;
  }

  return pdfModule;
};

/**
 * PDF バイナリから描画・テキスト抽出を行うユーティリティを生成する。
 * - pdf.js をロードしてドキュメントを開く
 * - ページ描画はキャッシュ/重複リクエストを統制
 * - dispose で pdf.js のリソースを確実に破棄
 */
export const createPdfRenderer = async (data: ArrayBuffer, scale = 1.5) => {
  const pdfjs = await loadPdfModule();
  const loadingTask = pdfjs.getDocument({ data });
  const pdf = await loadingTask.promise;
  // ページ描画のメモ化（完了済みと進行中の2種類）で重複レンダリングを防ぐ。
  const cache = new Map<number, HTMLCanvasElement>();
  const pending = new Map<number, Promise<HTMLCanvasElement>>();
  let disposed = false;

  const ensurePageNumber = (index: number) => {
    // 呼び出し前に disposed か範囲外かをチェックするゲートキーパー
    if (disposed) {
      throw new Error('PDF ドキュメントは破棄されています');
    }
    const pageNumber = index + 1;
    if (pageNumber < 1 || pageNumber > pdf.numPages) {
      throw new Error('範囲外の PDF ページを要求しました');
    }
    return pageNumber;
  };

  const renderPage = async (index: number): Promise<HTMLCanvasElement> => {
    // メモ化: キャッシュチェック
    if (cache.has(index)) {
      return cache.get(index)!;
    }

    // メモ化: 進行中のリクエストチェック
    if (pending.has(index)) {
      return pending.get(index)!;
    }

    const pageNumber = ensurePageNumber(index);

    // 非同期レンダリングプロセス
    const renderPromise = (async () => {
      try {
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale });
        
        // キャンバス作成の最適化
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d', {
          alpha: false, // パフォーマンス向上のためアルファチャンネルを無効化
          willReadFrequently: false // 読み取り頻度が低いことを明示
        });

        if (!context) {
          throw new Error('PDF ページの描画用コンテキストを取得できませんでした');
        }

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        // レンダリング前にdisposed状態をチェック
        if (disposed) {
          throw new Error('PDF ドキュメントは破棄されています');
        }

        const renderTask = page.render({
          canvasContext: context,
          viewport
        });

        await renderTask.promise;
        
        // メモリ管理: ページリソースのクリーンアップ
        page.cleanup();

        // レンダリング完了後にdisposed状態を再チェック
        if (disposed) {
          throw new Error('PDF ドキュメントは破棄されています');
        }

        // キャッシュに保存
        cache.set(index, canvas);
        return canvas;
      } catch (error) {
        // エラー発生時は確実にpendingから削除
        throw error;
      } finally {
        // 確実にpendingから削除（成功・失敗問わず）
        pending.delete(index);
      }
    })();

    pending.set(index, renderPromise);
    return renderPromise;
  };

  const getPageTextContent = async (index: number): Promise<PdfPageTextContent> => {
    // ページを取得し、テキストアイテムを viewport 座標系（左上原点）に正規化する。
    const pageNumber = ensurePageNumber(index); // 0-based index を pdf.js の 1-based に変換し、範囲外をチェック
    const page = await pdf.getPage(pageNumber); // 対象ページのオブジェクトを取得
    const viewport = page.getViewport({ scale }); // 画面スケールに合わせた viewport を作成
    const textContent = await page.getTextContent(); // 生のテキストアイテムを取得（座標は左下原点）
    const runs: PdfPageTextRun[] = []; // 正規化済みのテキスト run をここに詰める
    
    // PDF座標変換用のユーティリティ
    const pdfUtil = (await loadPdfModule()).Util;

    textContent.items.forEach((item) => {
      if (!('str' in item) || !item.str.trim()) {
        return; // 文字列を持たないアイテムや空文字はスキップ
      }
      
      // 元のフォントサイズを計算（スケール前）
      const transform = item.transform; // [a, b, c, d, e, f]
      const originalFontSize = Math.hypot(transform[0], transform[1]); 

      // ビューポート変換行列を適用して、Canvas座標系での変換行列を取得
      const scaledTransform = pdfUtil.transform(viewport.transform, transform);
      
      // スケール後のフォントサイズと位置を計算
      const scaledFontSize = Math.hypot(scaledTransform[0], scaledTransform[1]);
      const x = scaledTransform[4];
      const y = scaledTransform[5];

      // 幅と高さもスケールに合わせて計算
      // item.width はPDF座標系なので、水平スケール率を掛ける必要がある
      // 水平スケール率 = scaledTransform[0] / transform[0] ≒ scale
      const scaleX = Math.hypot(scaledTransform[0], scaledTransform[1]) / originalFontSize;
      
      const rawWidth = item.width ?? originalFontSize * (item.str.length / 2);
      const rawHeight = item.height ?? originalFontSize;

      const width = rawWidth * scaleX;
      const height = rawHeight * scaleX;

      runs.push({
        text: item.str, 
        fontSize: scaledFontSize,      // Canvas表示用（スケール済み）
        originalFontSize: originalFontSize, // 判定用（スケールなし）
        x,                             // Canvas座標 X
        y: y - height,                 // Canvas座標 Y (PDFの原点はベースラインにあるため、左上原点系では高さ分引く必要がある)
        width,                         // Canvas上の幅
        height                         // Canvas上の高さ
      });
    });

    page.cleanup(); // ページリソースを解放

    return {
      width: viewport.width, // ページ幅（スケール後）
      height: viewport.height, // ページ高さ（スケール後）
      runs // 位置・サイズを正規化したテキスト run 一覧
    };
  };

  const dispose = () => {
    // レンダラーと pdf.js のリソースを破棄し、再利用できない状態にする
    if (disposed) {
      return;
    }
    disposed = true;
    cache.clear();
    pending.clear();
    loadingTask.destroy();
    pdf.cleanup();
    pdf.destroy();
  };

  return {
    pageCount: pdf.numPages,
    getPageCanvas: renderPage,
    getPageTextContent,
    dispose,
    hasFrame: (index: number) => cache.has(index)
  };
};
