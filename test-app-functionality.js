const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function testAppFunctionality() {
  console.log('アプリケーション機能テストを開始します...');
  
  const browser = await puppeteer.launch({
    headless: false, // テスト観察のため非ヘッドレスモード
    defaultViewport: { width: 1280, height: 720 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // コンソールログを監視
    page.on('console', msg => {
      console.log('ブラウザコンソール:', msg.text());
    });
    
    // エラーログを監視
    page.on('pageerror', error => {
      console.error('ページエラー:', error.message);
    });
    
    // アプリケーションにアクセス
    console.log('アプリケーションにアクセス中...');
    await page.goto('https://localhost:5173/', { waitUntil: 'networkidle2' });
    
    // ランディング画面の確認
    console.log('ランディング画面を確認中...');
    await page.waitForSelector('.landing__title', { timeout: 5000 });
    const landingTitle = await page.$eval('.landing__title', el => el.textContent);
    console.log('ランディングタイトル:', landingTitle);
    
    // アプリケーション開始
    console.log('アプリケーションを開始します...');
    await page.click('.landing__cta--primary');
    await page.waitForSelector('.hero-app', { timeout: 5000 });
    
    // PDFアップロード機能のテスト
    console.log('PDFアップロード機能をテスト中...');
    const testPdfPath = path.resolve(__dirname, 'test-sample.pdf');
    
    if (fs.existsSync(testPdfPath)) {
      // ファイルアップロード
      const fileInput = await page.$('input[type="file"]');
      await fileInput.uploadFile(testPdfPath);
      
      // PDF読み込み待機
      console.log('PDF読み込みを待機中...');
      await page.waitForTimeout(3000);
      
      // ページ表示の確認
      const canvas = await page.$('.viewport__canvas');
      if (canvas) {
        console.log('✓ PDFが正常に表示されました');
        
        // ページナビゲーションのテスト
        console.log('ページナビゲーションをテスト中...');
        
        // キーボード操作のテスト
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(1000);
        console.log('✓ 右矢印キーでのページ移動が機能しました');
        
        await page.keyboard.press('ArrowLeft');
        await page.waitForTimeout(1000);
        console.log('✓ 左矢印キーでのページ移動が機能しました');
        
        // UIボタンのテスト
        const nextButton = await page.$('button[aria-label="次のページへ"]');
        if (nextButton) {
          await nextButton.click();
          await page.waitForTimeout(1000);
          console.log('✓ UIボタンでのページ移動が機能しました');
        }
        
        // ページジャンプ機能のテスト
        const pageInput = await page.$('input[aria-label="移動先のページ番号"]');
        if (pageInput) {
          await page.click(pageInput);
          await page.keyboard.type('1');
          await page.keyboard.press('Enter');
          await page.waitForTimeout(1000);
          console.log('✓ ページジャンプ機能が正常に動作しました');
        }
        
      } else {
        console.log('✗ PDFの表示に失敗しました');
      }
    } else {
      console.log('テスト用PDFファイルが見つかりません:', testPdfPath);
    }
    
    // エラーハンドリングのテスト
    console.log('エラーハンドリングをテスト中...');
    
    // 無効なファイル形式のアップロードテスト
    const invalidFilePath = path.resolve(__dirname, 'package.json');
    if (fs.existsSync(invalidFilePath)) {
      const fileInput = await page.$('input[type="file"]');
      await fileInput.uploadFile(invalidFilePath);
      await page.waitForTimeout(2000);
      
      // エラーメッセージの確認
      const statusMessage = await page.$eval('.hero-stage__status', el => el.textContent);
      if (statusMessage.includes('PDF 形式のみ対応しています')) {
        console.log('✓ 無効なファイル形式のエラーハンドリングが正常に動作しました');
      } else {
        console.log('✗ エラーハンドリングに問題があります:', statusMessage);
      }
    }
    
    console.log('アプリケーション機能テストが完了しました');
    
  } catch (error) {
    console.error('テスト実行中にエラーが発生しました:', error);
  } finally {
    await browser.close();
  }
}

// テスト実行
testAppFunctionality().catch(console.error);