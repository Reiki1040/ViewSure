# ViewSure 機能拡張仕様書

## 概要

本ドキュメントは、ViewSureアプリケーションの機能拡張に関する具体的な仕様と実装アプローチを定義する。P0（最重要：直近3ヶ月）とP1（高優先度：3〜6ヶ月）に分類された機能について、技術的な詳細を記述する。

---

## P0機能（最重要：直近3ヶ月）

### 1. パフォーマンス最適化（大容量ファイル対応）

#### 現行の問題点
- 大きなPDFや高解像度画像の処理に時間がかかる
- メモリ使用量が多く、ブラウザがフリーズすることがある
- ページングの際に毎回再レンダリングが発生し、応答性が低い

#### 期待される改善
- 読み込み時間の短縮（50%以上の改善）
- メモリ使用量の最適化（30%以上の削減）
- スムーズなページ間移動

#### 具体的な機能仕様

##### 1.1 仮想化レンダリング
- **目的**: 大容量PDFの全ページを一度にメモリに読み込まず、表示に必要なページのみをオンデマンドでレンダリングする
- **実装内容**:
  - 現在表示ページ±1ページのプリフェッチ機能
  - 表示範囲外のページのメモリ解放
  - プリレンダリングによるページ移動の高速化

##### 1.2 WebAssemblyによる画像処理の高速化
- **目的**: 画像処理パイプラインをWebAssemblyに移行し、CPU負荷を軽減する
- **実装内容**:
  - 現行のWASMモジュール機能拡張
  - 画像リサイズ・フォーマット変換のWASM実装
  - マルチスレッド処理による並列化

##### 1.3 プログレッシブローディング
- **目的**: 大容量ファイルの読み込み体験を改善する
- **実装内容**:
  - 低解像度プレビューの先行表示
  - 段階的な解像度向上
  - 読み込み進捗の詳細表示

#### 技術的な実装アプローチ

##### 1.1 仮想化レンダリングの実装
```typescript
// 新規作成: src/utils/virtualizedRenderer.ts
export interface VirtualizedRenderer {
  preloadPages: (centerIndex: number, count: number) => Promise<void>;
  releasePages: (indexes: number[]) => void;
  getPage: (index: number) => Promise<TexImageSource>;
  clearCache: () => void;
}

export const createVirtualizedRenderer = (
  asset: ProjectionAsset,
  maxCacheSize: number = 5
): VirtualizedRenderer => {
  // 実装詳細
};
```

##### 1.2 WebAssemblyモジュール拡張
```c
// src/wasm/image_processing.c
// 新規WASM関数の追加
EMSCRIPTEN_KEEPALIVE
uint8_t* resize_image(uint8_t* input_data, int width, int height, int new_width, int new_height);

EMSCRIPTEN_KEEPALIVE
void convert_format(uint8_t* input_data, int width, int height, int input_format, int output_format);
```

##### 1.3 プログレッシブローディング実装
```typescript
// src/hooks/useProgressiveLoader.ts
export const useProgressiveLoader = (asset: ProjectionAsset) => {
  const [loadingState, setLoadingState] = useState<{
    progress: number;
    lowResPreview: TexImageSource | null;
    highResPages: Map<number, TexImageSource>;
  }>({
    progress: 0,
    lowResPreview: null,
    highResPages: new Map()
  });
  
  // 実装詳細
};
```

#### 必要なコンポーネントやAPI
- `VirtualizedRenderer`クラス（新規）
- `ProgressiveLoader`フック（新規）
- 拡張WASMモジュール（既存の拡張）
- `LoadingProgress`コンポーネント（新規）

#### UI/UXの考慮点
- 読み込み進捗の視覚的フィードバック
- 低解像度プレビューから高解像度への滑らかな移行
- ページ移動時のローディングインジケーター
- メモリ使用量の警告表示

#### 既存コードへの統合方法
- `src/utils/fileLoader.ts`の`loadProjectionAsset`関数を拡張
- `src/hooks/useProjectionRenderer.ts`に仮想化機能を統合
- `src/components/ProjectionViewport.tsx`にプログレッシブローディングUIを追加

---

### 2. モバイル対応の改善

#### 現行の問題点
- モバイルデバイスでの操作性が制限されている
- タッチ操作が最適化されていない
- 画面サイズが小さいデバイスでのUI表示が不適切

#### 期待される改善
- タッチ操作の最適化
- モバイルUIの改善
- レスポンシブデザインの完全対応

#### 具体的な機能仕様

##### 2.1 タッチジェスチャー対応
- **目的**: モバイルデバイスでの直感的な操作を実現する
- **実装内容**:
  - ピンチイン/アウトによるズーム機能
  - スワイプによるページ移動
  - ダブルタップによるリセット
  - ドラッグによるパン操作

##### 2.2 モバイル専用UI
- **目的**: 画面サイズの小さいデバイスでの操作性を向上させる
- **実装内容**:
  - 折りたたみ可能なコントロールパネル
  - タッチフレンドリーなスライダーとボタン
  - モバイル専用のツールバー
  - フローティングアクションボタン（FAB）

##### 2.3 レスポンシブレイアウト
- **目的**: あらゆる画面サイズでの最適な表示を実現する
- **実装内容**:
  - ブレークポイントに基づくレイアウト変更
  - コンポーネントの再配置とサイズ調整
  - モバイルファーストのCSS設計

#### 技術的な実装アプローチ

##### 2.1 タッチジェスチャー実装
```typescript
// src/hooks/useTouchGestures.ts
export interface TouchGestureConfig {
  onZoom?: (scale: number) => void;
  onPan?: (deltaX: number, deltaY: number) => void;
  onSwipe?: (direction: 'left' | 'right') => void;
  onDoubleTap?: () => void;
}

export const useTouchGestures = (
  elementRef: RefObject<HTMLElement>,
  config: TouchGestureConfig
) => {
  // 実装詳細
};
```

##### 2.2 モバイル専用UIコンポーネント
```typescript
// src/components/MobileControls.tsx
interface MobileControlsProps {
  brightness: number;
  contrast: number;
  onBrightnessChange: (value: number) => void;
  onContrastChange: (value: number) => void;
  onReset: () => void;
  isExpanded: boolean;
  onToggleExpanded: () => void;
}

export const MobileControls: React.FC<MobileControlsProps> = ({
  brightness,
  contrast,
  onBrightnessChange,
  onContrastChange,
  onReset,
  isExpanded,
  onToggleExpanded
}) => {
  // 実装詳細
};
```

##### 2.3 レスポンシブCSS設計
```css
/* src/styles/responsive.css */
@media (max-width: 768px) {
  .app-shell {
    flex-direction: column;
  }
  
  .control-panel {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    transform: translateY(calc(100% - 60px));
    transition: transform 0.3s ease;
  }
  
  .control-panel--expanded {
    transform: translateY(0);
  }
  
  .viewport-container {
    padding-bottom: 60px;
  }
}
```

#### 必要なコンポーネントやAPI
- `useTouchGestures`フック（新規）
- `MobileControls`コンポーネント（新規）
- `FloatingActionButton`コンポーネント（新規）
- レスポンシブCSSモジュール（新規）

#### UI/UXの考慮点
- タッチターゲットの最小サイズ（44px以上）
- ジェスチャー操作の視覚的フィードバック
- モバイルデバイスでのパフォーマンス最適化
- オリエンテーション変更への対応

#### 既存コードへの統合方法
- `src/components/ProjectionControls.tsx`にモバイル対応を追加
- `src/components/ProjectionViewport.tsx`にタッチジェスチャーを統合
- `src/styles.css`にレスポンシブデザインを導入

---

### 3. 調整プリセット機能

#### 現行の問題点
- 毎回手動で調整が必要
- 環境別の最適設定を保存できない
- 調整パラメータの再利用ができない

#### 期待される改善
- 環境別プリセット（明るい部屋、暗い部屋など）
- ワンクリックでの適用
- カスタムプリセットの作成と保存

#### 具体的な機能仕様

##### 3.1 環境別プリセット
- **目的**: 一般的な投影環境に最適化されたプリセットを提供する
- **実装内容**:
  - 明るい部屋用プリセット（高コントラスト、高輝度）
  - 暗い部屋用プリセット（低コントラスト、標準輝度）
  - 映写専用プリセット（プロジェクター特性考慮）
  - WCAG準拠プリセット（アクセシビリティ重視）

##### 3.2 カスタムプリセット管理
- **目的**: ユーザー独自のプリセットを作成・管理する機能を提供する
- **実装内容**:
  - プリセットの作成・名前付け・保存
  - プリセットの編集・削除
  - プリセットのエクスポート/インポート
  - デフォルトプリセットの上書き防止

##### 3.3 プリセット適用インターフェース
- **目的**: 直感的なプリセット選択と適用を実現する
- **実装内容**:
  - プリセット選択ドロップダウン
  - プリセット適用前のプレビュー
  - 適用後の調整可能性
  - プリセット比較機能

#### 技術的な実装アプローチ

##### 3.1 プリセットデータ構造
```typescript
// src/types/presets.ts
export interface AdjustmentPreset {
  id: string;
  name: string;
  description?: string;
  brightness: number;
  contrast: number;
  category: 'builtin' | 'custom' | 'wcag';
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface PresetCategory {
  id: string;
  name: string;
  description?: string;
  presets: AdjustmentPreset[];
}
```

##### 3.2 プリセット管理フック
```typescript
// src/hooks/usePresets.ts
export const usePresets = () => {
  const [presets, setPresets] = useState<AdjustmentPreset[]>([]);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  
  const savePreset = useCallback((preset: Omit<AdjustmentPreset, 'id' | 'createdAt' | 'updatedAt'>) => {
    // 実装詳細
  }, []);
  
  const applyPreset = useCallback((presetId: string) => {
    // 実装詳細
  }, []);
  
  const deletePreset = useCallback((presetId: string) => {
    // 実装詳細
  }, []);
  
  return {
    presets,
    activePreset,
    savePreset,
    applyPreset,
    deletePreset,
    setActivePreset
  };
};
```

##### 3.3 プリセットUIコンポーネント
```typescript
// src/components/PresetSelector.tsx
interface PresetSelectorProps {
  presets: AdjustmentPreset[];
  activePreset: string | null;
  onPresetSelect: (presetId: string) => void;
  onSavePreset: (preset: Omit<AdjustmentPreset, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onDeletePreset: (presetId: string) => void;
  currentBrightness: number;
  currentContrast: number;
}

export const PresetSelector: React.FC<PresetSelectorProps> = ({
  presets,
  activePreset,
  onPresetSelect,
  onSavePreset,
  onDeletePreset,
  currentBrightness,
  currentContrast
}) => {
  // 実装詳細
};
```

#### 必要なコンポーネントやAPI
- `usePresets`フック（新規）
- `PresetSelector`コンポーネント（新規）
- `PresetPreview`コンポーネント（新規）
- プリセットデータ型定義（新規）

#### UI/UXの考慮点
- プリセット適用前のプレビュー機能
- プリセットの視覚的な区別（アイコン、色分け）
- プリセット適用の取り消し機能
- プリセットの検索・フィルタリング機能

#### 既存コードへの統合方法
- `src/components/ProjectionControls.tsx`にプリセット選択UIを追加
- `src/App.tsx`の調整ロジックにプリセット適用機能を統合
- `src/types/projects.ts`にプリセット関連の型を追加

---

### 4. バッチ処理機能

#### 現行の問題点
- 複数ファイルの連続処理ができない
- 各ファイルで同じ調整を手動で適用する必要がある
- 処理結果の一括出力ができない

#### 期待される改善
- 複数ファイルの一括調整と出力
- 処理キューの管理
- 進捗状況のリアルタイム表示

#### 具体的な機能仕様

##### 4.1 ファイル一括読み込み
- **目的**: 複数のファイルを一度に読み込み、処理キューに追加する
- **実装内容**:
  - ドラッグ＆ドロップによる複数ファイル選択
  - ファイル選択ダイアログでの複数選択
  - サポート形式のフィルタリング
  - ファイルリストの表示と管理

##### 4.2 バッチ調整適用
- **目的**: 複数ファイルに同じ調整パラメータを一括適用する
- **実装内容**:
  - 共通調整パラメータの設定
  - プリセットの一括適用
  - 個別ファイルの調整パラメータ上書き
  - 調整結果のプレビュー機能

##### 4.3 処理キュー管理
- **目的**: 処理順序の管理と進捗状況の追跡
- **実装内容**:
  - 処理キューの視覚的表示
  - 処理の優先順位付け
  - 処理の一時停止・再開・キャンセル
  - エラーハンドリングと再試行

##### 4.4 一括出力
- **目的**: 処理済みファイルを一括で出力する
- **実装内容**:
  - 個別ファイルでのPDF出力
  - マージされた単一PDFでの出力
  - ZIPアーカイブでの一括ダウンロード
  - 出力設定のカスタマイズ

#### 技術的な実装アプローチ

##### 4.1 バッチ処理データ構造
```typescript
// src/types/batch.ts
export interface BatchJob {
  id: string;
  name: string;
  files: BatchFile[];
  settings: BatchSettings;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  progress: number;
  errors?: BatchError[];
}

export interface BatchFile {
  id: string;
  file: File;
  asset?: ProjectionAsset;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  result?: {
    blob: Blob;
    width: number;
    height: number;
  };
  error?: string;
}

export interface BatchSettings {
  brightness: number;
  contrast: number;
  preset?: string;
  outputFormat: 'individual' | 'merged' | 'zip';
  outputName?: string;
}
```

##### 4.2 バッチ処理フック
```typescript
// src/hooks/useBatchProcessor.ts
export const useBatchProcessor = () => {
  const [jobs, setJobs] = useState<BatchJob[]>([]);
  const [activeJob, setActiveJob] = useState<string | null>(null);
  
  const createJob = useCallback((files: File[], settings: BatchSettings) => {
    // 実装詳細
  }, []);
  
  const startJob = useCallback((jobId: string) => {
    // 実装詳細
  }, []);
  
  const pauseJob = useCallback((jobId: string) => {
    // 実装詳細
  }, []);
  
  const cancelJob = useCallback((jobId: string) => {
    // 実装詳細
  }, []);
  
  return {
    jobs,
    activeJob,
    createJob,
    startJob,
    pauseJob,
    cancelJob
  };
};
```

##### 4.3 バッチ処理UIコンポーネント
```typescript
// src/components/BatchProcessor.tsx
interface BatchProcessorProps {
  onFilesSelected: (files: File[]) => void;
  onJobCreate: (files: File[], settings: BatchSettings) => void;
}

export const BatchProcessor: React.FC<BatchProcessorProps> = ({
  onFilesSelected,
  onJobCreate
}) => {
  // 実装詳細
};

// src/components/BatchJobList.tsx
interface BatchJobListProps {
  jobs: BatchJob[];
  activeJob: string | null;
  onStartJob: (jobId: string) => void;
  onPauseJob: (jobId: string) => void;
  onCancelJob: (jobId: string) => void;
  onDownloadResults: (jobId: string) => void;
}

export const BatchJobList: React.FC<BatchJobListProps> = ({
  jobs,
  activeJob,
  onStartJob,
  onPauseJob,
  onCancelJob,
  onDownloadResults
}) => {
  // 実装詳細
};
```

##### 4.4 Web Workersによるバックグラウンド処理
```typescript
// src/workers/batchProcessor.worker.ts
export interface BatchProcessorMessage {
  type: 'process_file' | 'cancel_job' | 'pause_job';
  payload: any;
}

export interface BatchProcessorResponse {
  type: 'file_progress' | 'file_completed' | 'job_completed' | 'error';
  payload: any;
}

// Web Worker内でのバッチ処理実装
self.onmessage = (event: MessageEvent<BatchProcessorMessage>) => {
  const { type, payload } = event.data;
  
  switch (type) {
    case 'process_file':
      // ファイル処理ロジック
      break;
    case 'cancel_job':
      // ジョブキャンセルロジック
      break;
    case 'pause_job':
      // ジョブ一時停止ロジック
      break;
  }
};
```

#### 必要なコンポーネントやAPI
- `useBatchProcessor`フック（新規）
- `BatchProcessor`コンポーネント（新規）
- `BatchJobList`コンポーネント（新規）
- `BatchProgress`コンポーネント（新規）
- Web Worker（新規）
- バッチ処理関連の型定義（新規）

#### UI/UXの考慮点
- ドラッグ＆ドロップエリアの視覚的なフィードバック
- 処理進捗のリアルタイム表示
- エラー発生時の詳細なエラーメッセージ
- 大量ファイル処理時のパフォーマンス考慮

#### 既存コードへの統合方法
- `src/App.tsx`にバッチ処理画面を追加
- `src/components/TopMenuBar.tsx`にバッチ処理へのナビゲーションを追加
- `src/utils/fileLoader.ts`の機能をバッチ処理対応に拡張

---

## P1機能（高優先度：3〜6ヶ月）

### 1. オフライン機能の拡充

#### 現行の問題点
- ネットワーク接続が必要
- オフラインでの利用が制限されている
- キャッシュ機能が不十分

#### 期待される改善
- Service Workerによるキャッシュ
- PWA化
- オフラインでの基本的な機能利用

#### 具体的な機能仕様

##### 1.1 Service Worker実装
- **目的**: アプリケーションのリソースをキャッシュし、オフラインでの利用を可能にする
- **実装内容**:
  - アプリケーションシェルのキャッシュ
  - 静的リソースのキャッシュ戦略
  - 動的コンテンツのキャッシュ管理
  - バックグラウンド同期

##### 1.2 PWA化
- **目的**: ネイティブアプリに近い体験を提供する
- **実装内容**:
  - Web App Manifestの実装
  - ホーム画面へのインストール機能
  - スプラッシュスクリーンの表示
  - オフラインインジケーター

##### 1.3 オフラインデータ管理
- **目的**: オフラインでのデータ作成と同期を実現する
- **実装内容**:
  - IndexedDBによるローカルデータストア
  - オフラインでのプロジェクト作成・編集
  - オンライン復帰時のデータ同期
  - 競合解決メカニズム

#### 技術的な実装アプローチ

##### 1.1 Service Worker実装
```typescript
// public/sw.js
const CACHE_NAME = 'viewsure-v1';
const STATIC_CACHE_URLS = [
  '/',
  '/index.html',
  '/assets/main.css',
  '/assets/main.js',
  // その他の静的リソース
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_CACHE_URLS))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // キャッシュがあれば返す、なければネットワークへ
        return response || fetch(event.request);
      })
  );
});
```

##### 1.2 Web App Manifest
```json
// public/manifest.json
{
  "name": "ViewSure",
  "short_name": "ViewSure",
  "description": "プロジェクション準備支援アプリ",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#1976d2",
  "icons": [
    {
      "src": "icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

##### 1.3 オフラインデータ管理
```typescript
// src/utils/offlineStorage.ts
export class OfflineStorage {
  private db: IDBDatabase | null = null;
  
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('ViewSureDB', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // プロジェクトストア
        if (!db.objectStoreNames.contains('projects')) {
          const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
          projectStore.createIndex('folderId', 'folderId', { unique: false });
        }
        
        // フォルダストア
        if (!db.objectStoreNames.contains('folders')) {
          db.createObjectStore('folders', { keyPath: 'id' });
        }
        
        // 同期キューストア
        if (!db.objectStoreNames.contains('syncQueue')) {
          db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
        }
      };
    });
  }
  
  async saveProject(project: ProjectFile): Promise<void> {
    // 実装詳細
  }
  
  async getProjects(folderId?: string): Promise<ProjectFile[]> {
    // 実装詳細
  }
  
  async addToSyncQueue(operation: any): Promise<void> {
    // 実装詳細
  }
  
  async processSyncQueue(): Promise<void> {
    // 実装詳細
  }
}
```

##### 1.4 オフライン同期フック
```typescript
// src/hooks/useOfflineSync.ts
export const useOfflineSync = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');
  const [pendingOperations, setPendingOperations] = useState(0);
  
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // オンライン復帰時に同期を開始
      syncOfflineChanges();
    };
    
    const handleOffline = () => {
      setIsOnline(false);
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  const syncOfflineChanges = useCallback(async () => {
    // 実装詳細
  }, []);
  
  return {
    isOnline,
    syncStatus,
    pendingOperations,
    syncOfflineChanges
  };
};
```

#### 必要なコンポーネントやAPI
- Service Worker（新規）
- Web App Manifest（新規）
- `OfflineStorage`クラス（新規）
- `useOfflineSync`フック（新規）
- `OfflineIndicator`コンポーネント（新規）

#### UI/UXの考慮点
- オフライン状態の明確な表示
- 同期状態の視覚的フィードバック
- オフラインでの機能制限の明示
- データ競合時の解決プロンプト

#### 既存コードへの統合方法
- `src/App.tsx`にオフライン検出と同期ロジックを統合
- `src/context/AuthContext.tsx`にオフライン認証状態を追加
- `src/lib/firebase.ts`にオフライン対応を追加

---

### 2. プロジェクト共有機能

#### 現行の問題点
- 他ユーザーとの協業ができない
- プロジェクトの共有方法がない
- 閲覧権限管理がない

#### 期待される改善
- 共有リンク
- 閲覧権限管理
- リアルタイム協業

#### 具体的な機能仕様

##### 2.1 共有リンク生成
- **目的**: プロジェクトを他ユーザーと共有するためのリンクを生成する
- **実装内容**:
  - 一意の共有リンク生成
  - リンクの有効期限設定
  - パスワード保護オプション
  - ダウンロード権限の制御

##### 2.2 権限管理
- **目的**: 共有プロジェクトへのアクセス権限を管理する
- **実装内容**:
  - 閲覧のみ/編集可能権限
  - ユーザー単位の権限設定
  - 権限の期限設定
  - 権限の取り消し機能

##### 2.3 共有プロジェクト管理
- **目的**: 共有中のプロジェクトを管理する
- **実装内容**:
  - 共有中プロジェクト一覧
  - アクセス履歴の表示
  - 共有設定の変更
  - 共有の停止機能

##### 2.4 リアルタイム協業（オプション）
- **目的**: 複数ユーザーでの同時編集を可能にする
- **実装内容**:
  - リアルタイムの調整パラメータ同期
  - ユーザーごとのカーソル表示
  - 変更履歴の記録
  - 競合解決メカニズム

#### 技術的な実装アプローチ

##### 2.1 共有データ構造
```typescript
// src/types/sharing.ts
export interface SharedProject {
  id: string;
  projectId: string;
  ownerId: string;
  shareToken: string;
  permissions: {
    canView: boolean;
    canEdit: boolean;
    canDownload: boolean;
  };
  settings: {
    password?: string;
    expiresAt?: string;
    allowComments: boolean;
  };
  createdAt: string;
  lastAccessedAt?: string;
  accessCount: number;
}

export interface SharedProjectAccess {
  id: string;
  sharedProjectId: string;
  userId?: string;
  userAgent: string;
  ipAddress: string;
  accessedAt: string;
}
```

##### 2.2 共有管理フック
```typescript
// src/hooks/useSharing.ts
export const useSharing = () => {
  const [sharedProjects, setSharedProjects] = useState<SharedProject[]>([]);
  
  const createShareLink = useCallback(async (
    projectId: string,
    permissions: SharedProject['permissions'],
    settings?: SharedProject['settings']
  ) => {
    // 実装詳細
  }, []);
  
  const updateShareSettings = useCallback(async (
    shareId: string,
    settings: Partial<SharedProject['settings']>
  ) => {
    // 実装詳細
  }, []);
  
  const revokeShare = useCallback(async (shareId: string) => {
    // 実装詳細
  }, []);
  
  const getSharedProject = useCallback(async (shareToken: string) => {
    // 実装詳細
  }, []);
  
  return {
    sharedProjects,
    createShareLink,
    updateShareSettings,
    revokeShare,
    getSharedProject
  };
};
```

##### 2.3 共有UIコンポーネント
```typescript
// src/components/ShareDialog.tsx
interface ShareDialogProps {
  projectId: string;
  projectName: string;
  isOpen: boolean;
  onClose: () => void;
}

export const ShareDialog: React.FC<ShareDialogProps> = ({
  projectId,
  projectName,
  isOpen,
  onClose
}) => {
  // 実装詳細
};

// src/components/SharedProjectView.tsx
interface SharedProjectViewProps {
  shareToken: string;
}

export const SharedProjectView: React.FC<SharedProjectViewProps> = ({
  shareToken
}) => {
  // 実装詳細
};
```

##### 2.4 Firebaseセキュリティルール
```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 共有プロジェクトドキュメント
    match /sharedProjects/{shareId} {
      allow read: if request.auth != null && 
        request.auth.uid in resource.data.accessList ||
        resource.data.isPublic;
      
      allow write: if request.auth != null && 
        request.auth.uid == resource.data.ownerId;
    }
    
    // 共有プロジェクトアクセスログ
    match /sharedProjectAccess/{accessId} {
      allow create: if true; // 誰でもアクセスログを作成可能
      allow read: if request.auth != null && 
        request.auth.uid in get(/databases/$(database)/documents/sharedProjects/$(resource.data.sharedProjectId)).data.accessList;
    }
  }
}
```

#### 必要なコンポーネントやAPI
- `useSharing`フック（新規）
- `ShareDialog`コンポーネント（新規）
- `SharedProjectView`コンポーネント（新規）
- `SharedProjectList`コンポーネント（新規）
- 共有関連の型定義（新規）
- Firebaseセキュリティルール（更新）

#### UI/UXの考慮点
- 共有リンクの簡単なコピー機能
- QRコードによるモバイルでの共有
- 権限設定の直感的なUI
- アクセス履歴の視覚的な表示

#### 既存コードへの統合方法
- `src/components/ProjectDashboard.tsx`に共有機能を追加
- `src/App.tsx`に共有プロジェクト表示ロジックを追加
- `src/lib/firebase.ts`に共有関連の関数を追加

---

### 3. クラウドストレージ連携

#### 現行の問題点
- ローカルストレージのみ
- ファイルの同期がない
- デバイス間でのデータ共有ができない

#### 期待される改善
- Google Drive、OneDriveとの連携
- 自動同期機能
- クラウドからの直接ファイル読み込み

#### 具体的な機能仕様

##### 3.1 クラウドストレージ認証
- **目的**: 各種クラウドストレージサービスとの認証を実現する
- **実装内容**:
  - Google Drive API認証
  - Microsoft Graph API認証（OneDrive）
  - OAuth 2.0フローの実装
  - 認証情報の安全な保存

##### 3.2 ファイルブラウザ
- **目的**: クラウドストレージ内のファイルを参照・選択する
- **実装内容**:
  - フォルダ階層のナビゲーション
  - ファイル一覧表示
  - ファイル検索機能
  - サポート形式のフィルタリング

##### 3.3 直接ファイル読み込み
- **目的**: クラウドストレージから直接ファイルを読み込む
- **実装内容**:
  - クラウドファイルの直接読み込み
  - ダウンロードなしでのプレビュー
  - 大容量ファイルのストリーミング
  - キャッシュ管理

##### 3.4 自動同期
- **目的**: ローカルとクラウド間でのデータ同期
- **実装内容**:
  - プロジェクトデータの自動同期
  - 変更検出と同期
  - 競合解決
  - オフライン時のキューイング

#### 技術的な実装アプローチ

##### 3.1 クラウドストレージAPI抽象化
```typescript
// src/utils/cloudStorage.ts
export interface CloudStorageProvider {
  name: string;
  authenticate(): Promise<void>;
  isAuthenticated(): boolean;
  listFiles(folderId?: string): Promise<CloudFile[]>;
  getFile(fileId: string): Promise<Blob>;
  searchFiles(query: string): Promise<CloudFile[]>;
  createFolder(name: string, parentId?: string): Promise<CloudFolder>;
  uploadFile(file: File, folderId?: string): Promise<CloudFile>;
}

export interface CloudFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  modifiedTime: string;
  parents?: string[];
  webViewLink?: string;
}

export interface CloudFolder {
  id: string;
  name: string;
  parents?: string[];
}
```

##### 3.2 Google Drive実装
```typescript
// src/utils/googleDrive.ts
export class GoogleDriveProvider implements CloudStorageProvider {
  name = 'Google Drive';
  private accessToken: string | null = null;
  
  async authenticate(): Promise<void> {
    // Google OAuth 2.0フローの実装
  }
  
  isAuthenticated(): boolean {
    return this.accessToken !== null;
  }
  
  async listFiles(folderId?: string): Promise<CloudFile[]> {
    // Google Drive APIを使用したファイル一覧取得
  }
  
  async getFile(fileId: string): Promise<Blob> {
    // Google Drive APIを使用したファイルダウンロード
  }
  
  async searchFiles(query: string): Promise<CloudFile[]> {
    // Google Drive APIを使用したファイル検索
  }
  
  async createFolder(name: string, parentId?: string): Promise<CloudFolder> {
    // Google Drive APIを使用したフォルダ作成
  }
  
  async uploadFile(file: File, folderId?: string): Promise<CloudFile> {
    // Google Drive APIを使用したファイルアップロード
  }
}
```

##### 3.3 OneDrive実装
```typescript
// src/utils/oneDrive.ts
export class OneDriveProvider implements CloudStorageProvider {
  name = 'OneDrive';
  private accessToken: string | null = null;
  
  async authenticate(): Promise<void> {
    // Microsoft Graph OAuth 2.0フローの実装
  }
  
  isAuthenticated(): boolean {
    return this.accessToken !== null;
  }
  
  async listFiles(folderId?: string): Promise<CloudFile[]> {
    // Microsoft Graph APIを使用したファイル一覧取得
  }
  
  async getFile(fileId: string): Promise<Blob> {
    // Microsoft Graph APIを使用したファイルダウンロード
  }
  
  async searchFiles(query: string): Promise<CloudFile[]> {
    // Microsoft Graph APIを使用したファイル検索
  }
  
  async createFolder(name: string, parentId?: string): Promise<CloudFolder> {
    // Microsoft Graph APIを使用したフォルダ作成
  }
  
  async uploadFile(file: File, folderId?: string): Promise<CloudFile> {
    // Microsoft Graph APIを使用したファイルアップロード
  }
}
```

##### 3.4 クラウドストレージフック
```typescript
// src/hooks/useCloudStorage.ts
export const useCloudStorage = () => {
  const [providers, setProviders] = useState<CloudStorageProvider[]>([]);
  const [activeProvider, setActiveProvider] = useState<CloudStorageProvider | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  const initializeProviders = useCallback(() => {
    const googleDrive = new GoogleDriveProvider();
    const oneDrive = new OneDriveProvider();
    
    setProviders([googleDrive, oneDrive]);
  }, []);
  
  const authenticate = useCallback(async (providerName: string) => {
    const provider = providers.find(p => p.name === providerName);
    if (!provider) return;
    
    await provider.authenticate();
    setActiveProvider(provider);
    setIsAuthenticated(provider.isAuthenticated());
  }, [providers]);
  
  const listFiles = useCallback(async (folderId?: string) => {
    if (!activeProvider || !isAuthenticated) return [];
    return activeProvider.listFiles(folderId);
  }, [activeProvider, isAuthenticated]);
  
  const getFile = useCallback(async (fileId: string) => {
    if (!activeProvider || !isAuthenticated) return null;
    return activeProvider.getFile(fileId);
  }, [activeProvider, isAuthenticated]);
  
  return {
    providers,
    activeProvider,
    isAuthenticated,
    initializeProviders,
    authenticate,
    listFiles,
    getFile
  };
};
```

##### 3.5 クラウドファイルブラウザコンポーネント
```typescript
// src/components/CloudFileBrowser.tsx
interface CloudFileBrowserProps {
  provider: CloudStorageProvider;
  onFileSelect: (file: CloudFile) => void;
  onClose: () => void;
}

export const CloudFileBrowser: React.FC<CloudFileBrowserProps> = ({
  provider,
  onFileSelect,
  onClose
}) => {
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [files, setFiles] = useState<CloudFile[]>([]);
  const [folders, setFolders] = useState<CloudFolder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // 実装詳細
};
```

#### 必要なコンポーネントやAPI
- `CloudStorageProvider`インターフェース（新規）
- `GoogleDriveProvider`クラス（新規）
- `OneDriveProvider`クラス（新規）
- `useCloudStorage`フック（新規）
- `CloudFileBrowser`コンポーネント（新規）
- `CloudStorageSelector`コンポーネント（新規）

#### UI/UXの考慮点
- 認証プロセスの簡素化
- ファイルブラウザの直感的な操作
- 大容量ファイルの読み込み進捗表示
- 複数クラウドストレージの切り替え

#### 既存コードへの統合方法
- `src/components/FileUploader.tsx`にクラウドストレージ選択を追加
- `src/utils/fileLoader.ts`にクラウドファイル読み込みを統合
- `src/App.tsx`にクラウドストレージ認証状態を追加

---

### 4. PowerPoint・Google Slides連携

#### 現行の問題点
- ファイルのアップロードが必要
- 直接編集ができない
- 変更の同期がない

#### 期待される改善
- 直接連携によるシームレスな編集
- リアルタイム同期
- バージョン管理

#### 具体的な機能仕様

##### 4.1 直接API連携
- **目的**: PowerPoint・Google Slidesと直接連携する
- **実装内容**:
  - Microsoft Graph API（PowerPoint Online）
  - Google Slides API
  - OAuth 2.0認証
  - APIクォータ管理

##### 4.2 リアルタイム同期
- **目的**: 元ファイルの変更をリアルタイムで反映する
- **実装内容**:
  - WebSocketによるリアルタイム通信
  - 変更検出と通知
  - 差分更新
  - 競合解決

##### 4.3 バージョン管理
- **目的**: 編集履歴を管理し、バージョン間の移動を可能にする
- **実装内容**:
  - バージョン履歴の保存
  - バージョン比較機能
  - 以前のバージョンへの復元
  - バージョンごとの調整パラメータ保存

##### 4.4 協業機能
- **目的**: 複数ユーザーでの同時編集を可能にする
- **実装内容**:
  - リアルタイムの共同編集
  - ユーザーごとの変更表示
  - コメント機能
  - 変更の承認ワークフロー

#### 技術的な実装アプローチ

##### 4.1 プレゼンテーションAPI抽象化
```typescript
// src/utils/presentationApi.ts
export interface PresentationApi {
  name: string;
  authenticate(): Promise<void>;
  isAuthenticated(): boolean;
  listPresentations(): Promise<Presentation[]>;
  getPresentation(presentationId: string): Promise<Presentation>;
  getSlide(presentationId: string, slideId: string): Promise<Slide>;
  updateSlide(presentationId: string, slideId: string, slide: Partial<Slide>): Promise<Slide>;
  subscribeToChanges(presentationId: string, callback: (changes: PresentationChange[]) => void): () => void;
}

export interface Presentation {
  id: string;
  title: string;
  slides: Slide[];
  modifiedTime: string;
  webViewLink?: string;
}

export interface Slide {
  id: string;
  title: string;
  content: string;
  thumbnail?: string;
  background?: {
    color?: string;
    image?: string;
  };
  elements: SlideElement[];
}

export interface SlideElement {
  id: string;
  type: 'text' | 'image' | 'shape' | 'chart';
  content: any;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface PresentationChange {
  type: 'slide_added' | 'slide_removed' | 'slide_updated' | 'element_added' | 'element_removed' | 'element_updated';
  slideId?: string;
  elementId?: string;
  data: any;
  timestamp: string;
}
```

##### 4.2 Google Slides API実装
```typescript
// src/utils/googleSlides.ts
export class GoogleSlidesApi implements PresentationApi {
  name = 'Google Slides';
  private accessToken: string | null = null;
  
  async authenticate(): Promise<void> {
    // Google OAuth 2.0フローの実装
  }
  
  isAuthenticated(): boolean {
    return this.accessToken !== null;
  }
  
  async listPresentations(): Promise<Presentation[]> {
    // Google Drive APIを使用してプレゼンテーション一覧を取得
  }
  
  async getPresentation(presentationId: string): Promise<Presentation> {
    // Google Slides APIを使用してプレゼンテーションを取得
  }
  
  async getSlide(presentationId: string, slideId: string): Promise<Slide> {
    // Google Slides APIを使用してスライドを取得
  }
  
  async updateSlide(presentationId: string, slideId: string, slide: Partial<Slide>): Promise<Slide> {
    // Google Slides APIを使用してスライドを更新
  }
  
  subscribeToChanges(presentationId: string, callback: (changes: PresentationChange[]) => void): () => void {
    // Google Drive APIの変更通知を使用してリアルタイム同期を実装
    return () => {}; // unsubscribe関数
  }
}
```

##### 4.3 PowerPoint Online API実装
```typescript
// src/utils/powerpoint.ts
export class PowerPointApi implements PresentationApi {
  name = 'PowerPoint Online';
  private accessToken: string | null = null;
  
  async authenticate(): Promise<void> {
    // Microsoft Graph OAuth 2.0フローの実装
  }
  
  isAuthenticated(): boolean {
    return this.accessToken !== null;
  }
  
  async listPresentations(): Promise<Presentation[]> {
    // Microsoft Graph APIを使用してプレゼンテーション一覧を取得
  }
  
  async getPresentation(presentationId: string): Promise<Presentation> {
    // Microsoft Graph APIを使用してプレゼンテーションを取得
  }
  
  async getSlide(presentationId: string, slideId: string): Promise<Slide> {
    // Microsoft Graph APIを使用してスライドを取得
  }
  
  async updateSlide(presentationId: string, slideId: string, slide: Partial<Slide>): Promise<Slide> {
    // Microsoft Graph APIを使用してスライドを更新
  }
  
  subscribeToChanges(presentationId: string, callback: (changes: PresentationChange[]) => void): () => void {
    // Microsoft Graph APIの変更通知を使用してリアルタイム同期を実装
    return () => {}; // unsubscribe関数
  }
}
```

##### 4.4 プレゼンテーション連携フック
```typescript
// src/hooks/usePresentation.ts
export const usePresentation = () => {
  const [apis, setApis] = useState<PresentationApi[]>([]);
  const [activeApi, setActiveApi] = useState<PresentationApi | null>(null);
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [activePresentation, setActivePresentation] = useState<Presentation | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  const initializeApis = useCallback(() => {
    const googleSlides = new GoogleSlidesApi();
    const powerPoint = new PowerPointApi();
    
    setApis([googleSlides, powerPoint]);
  }, []);
  
  const connect = useCallback(async (apiName: string) => {
    const api = apis.find(a => a.name === apiName);
    if (!api) return;
    
    await api.authenticate();
    setActiveApi(api);
    setIsConnected(api.isAuthenticated());
    
    if (api.isAuthenticated()) {
      const presentations = await api.listPresentations();
      setPresentations(presentations);
    }
  }, [apis]);
  
  const loadPresentation = useCallback(async (presentationId: string) => {
    if (!activeApi || !isConnected) return;
    
    const presentation = await activeApi.getPresentation(presentationId);
    setActivePresentation(presentation);
    
    // 変更の購読を開始
    const unsubscribe = activeApi.subscribeToChanges(presentationId, (changes) => {
      // 変更を処理
    });
    
    return unsubscribe;
  }, [activeApi, isConnected]);
  
  return {
    apis,
    activeApi,
    presentations,
    activePresentation,
    isConnected,
    initializeApis,
    connect,
    loadPresentation
  };
};
```

##### 4.5 プレゼンテーション連携UIコンポーネント
```typescript
// src/components/PresentationConnector.tsx
interface PresentationConnectorProps {
  onPresentationSelect: (presentation: Presentation) => void;
  onClose: () => void;
}

export const PresentationConnector: React.FC<PresentationConnectorProps> = ({
  onPresentationSelect,
  onClose
}) => {
  const { apis, activeApi, presentations, isConnected, connect } = usePresentation();
  
  // 実装詳細
};

// src/components/PresentationViewer.tsx
interface PresentationViewerProps {
  presentation: Presentation;
  api: PresentationApi;
}

export const PresentationViewer: React.FC<PresentationViewerProps> = ({
  presentation,
  api
}) => {
  // 実装詳細
};
```

#### 必要なコンポーネントやAPI
- `PresentationApi`インターフェース（新規）
- `GoogleSlidesApi`クラス（新規）
- `PowerPointApi`クラス（新規）
- `usePresentation`フック（新規）
- `PresentationConnector`コンポーネント（新規）
- `PresentationViewer`コンポーネント（新規）

#### UI/UXの考慮点
- 認証プロセスの簡素化
- リアルタイム変更の視覚的フィードバック
- バージョン履歴の直感的な表示
- 協業中のユーザー表示

#### 既存コードへの統合方法
- `src/components/FileUploader.tsx`にプレゼンテーション連携を追加
- `src/App.tsx`にプレゼンテーション表示ロジックを追加
- `src/utils/fileLoader.ts`にプレゼンテーション読み込みを統合

---

## 技術的実現性の評価

### P0機能の実現性

#### 1. パフォーマンス最適化
- **実現性**: 高
- **技術的難易度**: 中
- **リスク**: WASMモジュールの互換性、メモリ管理の複雑さ
- **既存コードへの影響**: 中（fileLoader.ts、useProjectionRenderer.tsの拡張）

#### 2. モバイル対応の改善
- **実現性**: 高
- **技術的難易度**: 中
- **リスク**: タッチジェスチャーの実装、レスポンシブデザインの複雑さ
- **既存コードへの影響**: 中（UIコンポーネントの拡張）

#### 3. 調整プリセット機能
- **実現性**: 高
- **技術的難易度**: 低
- **リスク**: データ構造の変更、ストレージの拡張
- **既存コードへの影響**: 低（新規機能の追加）

#### 4. バッチ処理機能
- **実現性**: 高
- **技術的難易度**: 中
- **リスク**: Web Workersの実装、エラーハンドリングの複雑さ
- **既存コードへの影響**: 中（新規画面の追加）

### P1機能の実現性

#### 1. オフライン機能の拡充
- **実現性**: 高
- **技術的難易度**: 中
- **リスク**: Service Workerの実装、データ同期の複雑さ
- **既存コードへの影響**: 中（オフライン対応の追加）

#### 2. プロジェクト共有機能
- **実現性**: 高
- **技術的難易度**: 中
- **リスク**: セキュリティ、権限管理の実装
- **既存コードへの影響**: 中（共有機能の追加）

#### 3. クラウドストレージ連携
- **実現性**: 中
- **技術的難易度**: 高
- **リスク**: 外部APIの依存、認証の複雑さ
- **既存コードへの影響**: 高（ファイル読み込みの大幅な変更）

#### 4. PowerPoint・Google Slides連携
- **実現性**: 中
- **技術的難易度**: 高
- **リスク**: 外部APIの制限、リアルタイム同期の複雑さ
- **既存コードへの影響**: 高（新規連携機能の追加）

---

## 実装計画の策定

### フェーズ1（1ヶ月目）：基盤強化
1. パフォーマンス最適化（仮想化レンダリング）
2. モバイル対応の改善（タッチジェスチャー）
3. 調整プリセット機能（基本機能）

### フェーズ2（2ヶ月目）：機能拡充
1. パフォーマンス最適化（WASM拡張）
2. モバイル対応の改善（レスポンシブデザイン）
3. 調整プリセット機能（高度な機能）
4. バッチ処理機能（基本機能）

### フェーズ3（3ヶ月目）：P0機能完成
1. パフォーマンス最適化（プログレッシブローディング）
2. モバイル対応の改善（最適化）
3. バッチ処理機能（高度な機能）

### フェーズ4（4-6ヶ月目）：P1機能
1. オフライン機能の拡充
2. プロジェクト共有機能
3. クラウドストレージ連携
4. PowerPoint・Google Slides連携

---

## 結論

ViewSureアプリケーションの機能拡張について、P0とP1機能の具体的な仕様と実装アプローチを考案した。P0機能は技術的に実現可能であり、既存コードへの影響も限定的であるため、直近3ヶ月での実装が現実的である。P1機能は一部技術的難易度が高いものの、段階的な実装により実現可能である。

これらの機能拡張により、ViewSureはより使いやすく、高性能なプロジェクション準備支援アプリケーションとなり、ユーザー体験の大幅な向上が期待できる。