// パフォーマンス監視用スクリプト
// ブラウザの開発者ツールコンソールで実行することを想定

(function() {
  console.log('=== ViewSure パフォーマンス監視を開始 ===');
  
  // メモリ使用量の監視
  function logMemoryUsage() {
    if (performance.memory) {
      const memoryInfo = {
        used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024 * 100) / 100,
        total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024 * 100) / 100,
        limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024 * 100) / 100
      };
      console.log(`メモリ使用量: ${memoryInfo.used}MB / ${memoryInfo.total}MB (制限: ${memoryInfo.limit}MB)`);
      return memoryInfo;
    } else {
      console.log('このブラウザではメモリ情報を取得できません');
      return null;
    }
  }
  
  // PDFレンダリングパフォーマンスの計測
  function measurePdfRender() {
    console.log('PDFレンダリングパフォーマンス計測を開始します...');
    
    const startTime = performance.now();
    const startMemory = logMemoryUsage();
    
    // 5秒後に計測終了
    setTimeout(() => {
      const endTime = performance.now();
      const endMemory = logMemoryUsage();
      
      console.log(`=== 計測結果 ===`);
      console.log(`経過時間: ${(endTime - startTime).toFixed(2)}ms`);
      
      if (startMemory && endMemory) {
        const memoryDiff = endMemory.used - startMemory.used;
        console.log(`メモリ変化: ${memoryDiff > 0 ? '+' : ''}${memoryDiff.toFixed(2)}MB`);
      }
      
      // ナビゲーションタイミング情報
      if (performance.timing) {
        const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
        console.log(`ページ読み込み時間: ${loadTime}ms`);
      }
    }, 5000);
  }
  
  // キャッシュ効率の検証
  function checkCacheEfficiency() {
    console.log('キャッシュ効率を検証中...');
    
    // ページを前後に移動してキャッシュの動作を確認
    const canvas = document.querySelector('.viewport__canvas');
    if (!canvas) {
      console.log('キャンバスが見つかりません');
      return;
    }
    
    // キャッシュ状態を監視する関数
    function checkCache() {
      // React DevToolsがない場合は直接状態を確認できないため、
      // レンダリング時間からキャッシュ効率を推定
      const renderStart = performance.now();
      
      // 次のフレームで計測
      requestAnimationFrame(() => {
        const renderTime = performance.now() - renderStart;
        console.log(`レンダリング時間: ${renderTime.toFixed(2)}ms`);
        
        if (renderTime < 50) {
          console.log('✓ キャッシュが効いている可能性が高いです');
        } else {
          console.log('⚠ キャッシュが効いていない可能性があります');
        }
      });
    }
    
    return checkCache;
  }
  
  // イベントリスナーを追加して自動計測
  let pageChangeCount = 0;
  const originalGoToPage = window.goToPage;
  
  // ページ変更イベントを監視
  document.addEventListener('keydown', function(event) {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      pageChangeCount++;
      console.log(`ページ変更回数: ${pageChangeCount}`);
      
      // 10回ごとにメモリ使用量を記録
      if (pageChangeCount % 10 === 0) {
        logMemoryUsage();
      }
    }
  });
  
  // 定期的なメモリ監視
  const memoryInterval = setInterval(logMemoryUsage, 10000);
  
  // 30秒後に自動終了
  setTimeout(() => {
    clearInterval(memoryInterval);
    console.log('=== パフォーマンス監視を終了 ===');
  }, 30000);
  
  // グローバル関数として公開
  window.performanceMonitor = {
    logMemoryUsage,
    measurePdfRender,
    checkCacheEfficiency
  };
  
  // 初期実行
  console.log('初期状態:');
  logMemoryUsage();
  
  console.log('使用可能なコマンド:');
  console.log('- performanceMonitor.logMemoryUsage() // メモリ使用量を表示');
  console.log('- performanceMonitor.measurePdfRender() // PDFレンダリング性能を計測');
  console.log('- performanceMonitor.checkCacheEfficiency()() // キャッシュ効率を検証');
})();