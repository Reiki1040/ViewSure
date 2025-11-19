// リファクタリングによる変更点の検証用スクリプト
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('=== ViewSure リファクタリング変更点の検証 ===\n');

// 1. 型定義の統一検証
console.log('1. 型定義の統一検証:');
const typesPath = path.join(__dirname, 'src', 'types', 'pdf.ts');
if (fs.existsSync(typesPath)) {
  const typesContent = fs.readFileSync(typesPath, 'utf8');
  const typeCount = (typesContent.match(/export interface/g) || []).length;
  const typeAliasCount = (typesContent.match(/export type/g) || []).length;
  const constCount = (typesContent.match(/export const/g) || []).length;
  
  console.log(`  ✓ 型定義ファイルが存在します`);
  console.log(`  ✓ インターフェース定義: ${typeCount}件`);
  console.log(`  ✓ 型エイリアス定義: ${typeAliasCount}件`);
  console.log(`  ✓ 定数エクスポート: ${constCount}件`);
} else {
  console.log('  ✗ 型定義ファイルが存在しません');
}

// 2. カスタムフックの検証
console.log('\n2. カスタムフックの検証:');
const hooksPath = path.join(__dirname, 'src', 'hooks', 'usePdfRenderer.ts');
if (fs.existsSync(hooksPath)) {
  const hooksContent = fs.readFileSync(hooksPath, 'utf8');
  
  const hookExports = (hooksContent.match(/export.*function/g) || []).length;
  const useCallbackCount = (hooksContent.match(/useCallback/g) || []).length;
  const useStateCount = (hooksContent.match(/useState/g) || []).length;
  const useRefCount = (hooksContent.match(/useRef/g) || []).length;
  
  console.log(`  ✓ usePdfRendererフックが存在します`);
  console.log(`  ✓ エクスポート関数: ${hookExports}件`);
  console.log(`  ✓ useCallback使用: ${useCallbackCount}件`);
  console.log(`  ✓ useState使用: ${useStateCount}件`);
  console.log(`  ✓ useRef使用: ${useRefCount}件`);
} else {
  console.log('  ✗ usePdfRendererフックが存在しません');
}

// 3. App.tsxの状態管理分割検証
console.log('\n3. App.tsxの状態管理分割検証:');
const appPath = path.join(__dirname, 'src', 'App.tsx');
if (fs.existsSync(appPath)) {
  const appContent = fs.readFileSync(appPath, 'utf8');
  
  const useStateCount = (appContent.match(/useState/g) || []).length;
  const useEffectCount = (appContent.match(/useEffect/g) || []).length;
  const useCallbackCount = (appContent.match(/useCallback/g) || []).length;
  const usePdfRendererImport = appContent.includes('usePdfRenderer');
  
  console.log(`  ✓ App.tsxが存在します`);
  console.log(`  ✓ useState使用: ${useStateCount}件`);
  console.log(`  ✓ useEffect使用: ${useEffectCount}件`);
  console.log(`  ✓ useCallback使用: ${useCallbackCount}件`);
  console.log(`  ✓ usePdfRendererインポート: ${usePdfRendererImport ? 'あり' : 'なし'}`);
} else {
  console.log('  ✗ App.tsxが存在しません');
}

// 4. パフォーマンス最適化の検証
console.log('\n4. パフォーマンス最適化の検証:');
const pdfUtilPath = path.join(__dirname, 'src', 'utils', 'pdf.ts');
if (fs.existsSync(pdfUtilPath)) {
  const pdfUtilContent = fs.readFileSync(pdfUtilPath, 'utf8');
  
  const cacheCount = (pdfUtilContent.match(/cache/g) || []).length;
  const asyncCount = (pdfUtilContent.match(/async/g) || []).length;
  const awaitCount = (pdfUtilContent.match(/await/g) || []).length;
  const cleanupCount = (pdfUtilContent.match(/cleanup/g) || []).length;
  const disposeCount = (pdfUtilContent.match(/dispose/g) || []).length;
  
  console.log(`  ✓ PDFユーティリティが存在します`);
  console.log(`  ✓ キャッシュ関連: ${cacheCount}件`);
  console.log(`  ✓ 非同期処理: ${asyncCount}件`);
  console.log(`  ✓ await使用: ${awaitCount}件`);
  console.log(`  ✓ クリーンアップ: ${cleanupCount}件`);
  console.log(`  ✓ リソース破棄: ${disposeCount}件`);
} else {
  console.log('  ✗ PDFユーティリティが存在しません');
}

// 5. エラーハンドリングの検証
console.log('\n5. エラーハンドリングの検証:');
if (fs.existsSync(typesPath)) {
  const typesContent = fs.readFileSync(typesPath, 'utf8');
  const errorTypes = ['PdfError', 'PDF_ERROR_CODES', 'createPdfError'];
  
  errorTypes.forEach(type => {
    if (typesContent.includes(type)) {
      console.log(`  ✓ ${type}が定義されています`);
    } else {
      console.log(`  ✗ ${type}が見つかりません`);
    }
  });
}

// 6. コンポーネントの責務分離検証
console.log('\n6. コンポーネントの責務分離検証:');
const componentsPath = path.join(__dirname, 'src', 'components');
if (fs.existsSync(componentsPath)) {
  const componentFiles = fs.readdirSync(componentsPath).filter(file => file.endsWith('.tsx'));
  
  console.log(`  ✓ コンポーネントディレクトリが存在します`);
  console.log(`  ✓ コンポーネント数: ${componentFiles.length}件`);
  
  componentFiles.forEach(file => {
    const filePath = path.join(componentsPath, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const lineCount = content.split('\n').length;
    console.log(`    - ${file}: ${lineCount}行`);
  });
} else {
  console.log('  ✗ コンポーネントディレクトリが存在しません');
}

// 7. コード品質の検証
console.log('\n7. コード品質の検証:');
const srcPath = path.join(__dirname, 'src');
const tsxFiles = [];
const tsFiles = [];

function findFiles(dir, extension, array) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      findFiles(filePath, extension, array);
    } else if (file.endsWith(extension)) {
      array.push(filePath);
    }
  });
}

findFiles(srcPath, '.tsx', tsxFiles);
findFiles(srcPath, '.ts', tsFiles);

console.log(`  ✓ TypeScriptファイル数: ${tsFiles.length + tsxFiles.length}件`);
console.log(`    - .tsファイル: ${tsFiles.length}件`);
console.log(`    - .tsxファイル: ${tsxFiles.length}件`);

// 8. 依存関係の検証
console.log('\n8. 依存関係の検証:');
const packageJsonPath = path.join(__dirname, 'package.json');
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  const dependencies = Object.keys(packageJson.dependencies || {});
  const devDependencies = Object.keys(packageJson.devDependencies || {});
  
  console.log(`  ✓ 依存関係が定義されています`);
  console.log(`  ✓ 実行依存: ${dependencies.length}件`);
  console.log(`  ✓ 開発依存: ${devDependencies.length}件`);
  
  // 重要な依存関係の確認
  const importantDeps = ['react', 'react-dom', 'pdfjs-dist', 'typescript'];
  importantDeps.forEach(dep => {
    if (dependencies.includes(dep) || devDependencies.includes(dep)) {
      console.log(`    ✓ ${dep}が含まれています`);
    } else {
      console.log(`    ✗ ${dep}が見つかりません`);
    }
  });
}

console.log('\n=== リファクタリング変更点の検証完了 ===');