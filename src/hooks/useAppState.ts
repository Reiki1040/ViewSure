/**
 * アプリケーション状態管理フック
 *
 * ViewSureアプリケーションのコア状態を管理するカスタムフックです。
 * ファイル操作、調整値、ナビゲーション、UI状態などを一元管理します。
 *
 * 管理する状態:
 * - ファイルアセットとメタデータ
 * - 明るさ・コントラスト調整値
 * - ページナビゲーション状態
 * - ローディング状態
 * - UI状態（ステータスメッセージ、アスペクト比など）
 */
import { useCallback, useRef, useState } from 'react';
import type { ProjectionAsset } from '../utils/fileLoader';

export interface AppState {
  // Core state
  brightness: number;
  contrast: number;
  asset: ProjectionAsset | null;
  currentFrame: number;
  activeFileName: string | null;
  
  // Loading states
  isLoading: boolean;
  isExporting: boolean;
  
  // UI state
  statusMessage: string | null;
  projectorEnabled: boolean;
  pageInputValue: string;
  isLandingVisible: boolean;
  
  // Aspect ratio management
  wcagAspectRatio: number;
  lockedViewportAspect: number | null;
}

export interface AppActions {
  // File operations
  handleFileSelected: (file: File) => Promise<void>;
  resetAsset: () => void;
  
  // Adjustments
  setBrightness: (value: number) => void;
  setContrast: (value: number) => void;
  resetAdjustments: () => void;
  
  // Navigation
  setCurrentFrame: (frame: number) => void;
  goToPrevious: () => void;
  goToNext: () => void;
  handlePageInputCommit: () => void;
  
  // Projector
  setProjectorEnabled: (enabled: boolean) => void;
  
  // UI
  setStatusMessage: (message: string | null) => void;
  setPageInputValue: (value: string) => void;
  setLockedViewportAspect: (aspect: number | null) => void;
  setWcagAspectRatio: (ratio: number) => void;
  setIsLandingVisible: (visible: boolean) => void;
}

const INITIAL_BRIGHTNESS = 100;
const INITIAL_CONTRAST = 0;
const DEFAULT_WCAG_ASPECT = 9 / 16;
const INITIAL_STATUS_MESSAGE = 'PDF または画像ファイルを読み込んでください';

export const useAppState = (): [AppState, AppActions] => {
  // Core state
  const [brightness, setBrightness] = useState(INITIAL_BRIGHTNESS);
  const [contrast, setContrast] = useState(INITIAL_CONTRAST);
  const [asset, setAsset] = useState<ProjectionAsset | null>(null);
  const [currentFrame, setCurrentFrame] = useState(1);
  const [activeFileName, setActiveFileName] = useState<string | null>(null);
  
  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  // UI state
  const [statusMessage, setStatusMessage] = useState<string | null>(INITIAL_STATUS_MESSAGE);
  const [projectorEnabled, setProjectorEnabled] = useState(false);
  const [pageInputValue, setPageInputValue] = useState('1');
  const [isLandingVisible, setIsLandingVisible] = useState(true);
  
  // Aspect ratio management
  const [wcagAspectRatio, setWcagAspectRatio] = useState(DEFAULT_WCAG_ASPECT);
  const [lockedViewportAspect, setLockedViewportAspect] = useState<number | null>(null);

  // Refs for stable references
  const initialViewportAspectRef = useRef<number | null>(null);

  const resetAsset = useCallback(() => {
    setAsset(null);
    setActiveFileName(null);
    setCurrentFrame(1);
    setPageInputValue('1');
    setStatusMessage(INITIAL_STATUS_MESSAGE);
    initialViewportAspectRef.current = null;
    setLockedViewportAspect(null);
  }, []);

  const handleFileSelected = useCallback(async (file: File) => {
    setIsLoading(true);
    setStatusMessage(null);

    try {
      initialViewportAspectRef.current = null;
      setLockedViewportAspect(null);
      
      const { loadProjectionAsset } = await import('../utils/fileLoader');
      const projectionAsset = await loadProjectionAsset(file);
      
      setAsset(projectionAsset);
      setCurrentFrame(1);
      setPageInputValue('1');
      setActiveFileName(file.name);
      
      const message = projectionAsset.pageCount > 1
        ? `${file.name} (${projectionAsset.pageCount} ページ)`
        : `${file.name} を読み込みました`;
      setStatusMessage(message);
    } catch (error) {
      console.error(error);
      resetAsset();
      setStatusMessage(error instanceof Error ? error.message : '読み込みに失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, [resetAsset]);

  const resetAdjustments = useCallback(() => {
    setStatusMessage('設定をリセットしました');
    setBrightness(INITIAL_BRIGHTNESS);
    setContrast(INITIAL_CONTRAST);
  }, []);

  const goToPrevious = useCallback(() => {
    if (asset && currentFrame > 1) {
      setCurrentFrame(currentFrame - 1);
    }
  }, [asset, currentFrame]);

  const goToNext = useCallback(() => {
    if (asset && currentFrame < (asset.pageCount || 1)) {
      setCurrentFrame(currentFrame + 1);
    }
  }, [asset, currentFrame]);

  const handlePageInputCommit = useCallback(() => {
    const total = asset?.pageCount ?? 0;
    if (total < 1) {
      return;
    }
    const parsed = Number(pageInputValue);
    if (!Number.isFinite(parsed)) {
      return;
    }
    const nextPage = Math.min(Math.max(parsed, 1), total || 1);
    setCurrentFrame(nextPage);
  }, [asset, pageInputValue]);

  const state: AppState = {
    brightness,
    contrast,
    asset,
    currentFrame,
    activeFileName,
    isLoading,
    isExporting,
    statusMessage,
    projectorEnabled,
    pageInputValue,
    isLandingVisible,
    wcagAspectRatio,
    lockedViewportAspect,
  };

  const actions: AppActions = {
    handleFileSelected,
    resetAsset,
    setBrightness,
    setContrast,
    resetAdjustments,
    setCurrentFrame,
    goToPrevious,
    goToNext,
    handlePageInputCommit,
    setProjectorEnabled,
    setStatusMessage,
    setPageInputValue,
    setLockedViewportAspect,
    setWcagAspectRatio,
    setIsLandingVisible,
  };

  return [state, actions];
};
