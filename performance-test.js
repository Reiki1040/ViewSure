// パフォーマンスとメモリ使用量の検証用スクリプト
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('=== ViewSure パフォーマンス検証 ===\n');

// 1. ファイルサイズの確認
console.log('1. テスト用PDFファイルの確認:');
const testFiles = ['test-sample.pdf', 'test-large.pdf'];

testFiles.forEach(file => {
  if (fs.existsSync(file)) {
    const stats = fs.statSync(file);
    const sizeKB = Math.round(stats.size / 1024);
    const sizeMB = (sizeKB / 1024).toFixed(2);
    console.log(`  ✓ ${file}: ${sizeKB} KB (${sizeMB} MB)`);
  } else {
    console.log(`  ✗ ${file}: ファイルが存在しません`);
  }
});

// 2. ビルド成果物の確認
console.log('\n2. ビルド成果物の確認:');
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  const distFiles = fs.readdirSync(distPath);
  console.log('  ✓ dist/ディレクトリが存在します');
  
  distFiles.forEach(file => {
    const filePath = path.join(distPath, file);
    const stats = fs.statSync(filePath);
    if (stats.isFile()) {
      const sizeKB = Math.round(stats.size / 1024);
      console.log(`    ${file}: ${sizeKB} KB`);
    }
  });
} else {
  console.log('  ✗ dist/ディレクトリが存在しません');
}

// 3. 依存関係の確認
console.log('\n3. 依存関係の確認:');
const packageJsonPath = path.join(__dirname, 'package.json');
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  console.log('  ✓ package.jsonが存在します');
  console.log('  主要な依存関係:');
  
  const mainDeps = ['react', 'react-dom', 'pdfjs-dist'];
  mainDeps.forEach(dep => {
    if (packageJson.dependencies && packageJson.dependencies[dep]) {
      console.log(`    ✓ ${dep}: ${packageJson.dependencies[dep]}`);
    } else {
      console.log(`    ✗ ${dep}: 依存関係が見つかりません`);
    }
  });
} else {
  console.log('  ✗ package.jsonが存在しません');
}

// 4. ソースコードの構造確認
console.log('\n4. ソースコードの構造確認:');
const srcPath = path.join(__dirname, 'src');
if (fs.existsSync(srcPath)) {
  const srcDirs = ['components', 'hooks', 'types', 'utils'];
  console.log('  ✓ src/ディレクトリが存在します');
  
  srcDirs.forEach(dir => {
    const dirPath = path.join(srcPath, dir);
    if (fs.existsSync(dirPath)) {
      const files = fs.readdirSync(dirPath);
      console.log(`    ✓ ${dir}/: ${files.length} ファイル`);
    } else {
      console.log(`    ✗ ${dir}/: ディレクトリが存在しません`);
    }
  });
} else {
  console.log('  ✗ src/ディレクトリが存在しません');
}

// 5. TypeScript設定の確認
console.log('\n5. TypeScript設定の確認:');
const tsconfigFiles = ['tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json'];
tsconfigFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`  ✓ ${file}が存在します`);
  } else {
    console.log(`  ✗ ${file}が存在しません`);
  }
});

// 6. パフォーマンス関連のコード確認
console.log('\n6. パフォーマンス関連のコード確認:');
const pdfUtilPath = path.join(srcPath, 'utils', 'pdf.ts');
if (fs.existsSync(pdfUtilPath)) {
  const pdfUtilContent = fs.readFileSync(pdfUtilPath, 'utf8');
  
  const performanceFeatures = [
    { name: 'キャッシュ機能', pattern: /cache|Cache/ },
    { name: 'メモ化', pattern: /memo|Memo/ },
    { name: '非同期処理', pattern: /async|await/ },
    { name: 'リソースクリーンアップ', pattern: /cleanup|dispose/ }
  ];
  
  performanceFeatures.forEach(feature => {
    if (feature.pattern.test(pdfUtilContent)) {
      console.log(`  ✓ ${feature.name}が実装されています`);
    } else {
      console.log(`  ✗ ${feature.name}が見つかりません`);
    }
  });
} else {
  console.log('  ✗ src/utils/pdf.tsが存在しません');
}

// 7. 型定義の確認
console.log('\n7. 型定義の確認:');
const typesPath = path.join(srcPath, 'types', 'pdf.ts');
if (fs.existsSync(typesPath)) {
  const typesContent = fs.readFileSync(typesPath, 'utf8');
  
  const typeDefinitions = [
    'PdfPageTextRun',
    'PdfPageTextContent',
    'PdfRenderer',
    'PdfRenderOptions',
    'PdfDocumentInfo',
    'PdfLoadingState',
    'PdfError',
    'PDF_ERROR_CODES'
  ];
  
  typeDefinitions.forEach(type => {
    if (typesContent.includes(type)) {
      console.log(`  ✓ ${type}が定義されています`);
    } else {
      console.log(`  ✗ ${type}が見つかりません`);
    }
  });
} else {
  console.log('  ✗ src/types/pdf.tsが存在しません');
}

console.log('\n=== パフォーマンス検証完了 ===');
console.log('\n注意: このスクリプトは静的解析のみ行っています。');
console.log('実際のパフォーマンス測定にはブラウザでのテストが必要です。');
console.log('performance-monitor.jsをブラウザコンソールで実行してください。');