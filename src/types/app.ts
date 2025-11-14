import type { ProjectionAsset } from '../utils/fileLoader';
import type { DocumentAnalysis } from '../utils/wcag/analyzer';
import type { FontAdjustments } from '../hooks/useWcagHelper';

// Core application state types
export interface AppCoreState {
  brightness: number;
  contrast: number;
  asset: ProjectionAsset | null;
  currentFrame: number;
  activeFileName: string | null;
  statusMessage: string | null;
  projectorEnabled: boolean;
  pageInputValue: string;
  wcagAspectRatio: number;
  lockedViewportAspect: number | null;
}

export interface AppLoadingState {
  isLoading: boolean;
  isExporting: boolean;
  isAnalyzing: boolean;
  isApplying: boolean;
}

export interface AppWcagState {
  analysis: DocumentAnalysis | null;
  analysisError: string | null;
  fontAdjustments: FontAdjustments | null;
  previousAdjustments: { brightness: number; contrast: number } | null;
}

// File handling types
export interface FileHandlingOptions {
  onFileSelected: (file: File) => Promise<void>;
  onFileLoadStart?: () => void;
  onFileLoadSuccess?: (fileName: string, pageCount: number) => void;
  onFileLoadError?: (error: Error) => void;
}

// Navigation types
export interface NavigationState {
  currentFrame: number;
  totalFrames: number;
  canGoPrevious: boolean;
  canGoNext: boolean;
}

export interface NavigationActions {
  goToPrevious: () => void;
  goToNext: () => void;
  goToFrame: (frame: number) => void;
  setCurrentFrame: (frame: number) => void;
}

// Adjustment types
export interface AdjustmentState {
  brightness: number;
  contrast: number;
  projectorEnabled: boolean;
}

export interface AdjustmentActions {
  setBrightness: (value: number) => void;
  setContrast: (value: number) => void;
  setProjectorEnabled: (enabled: boolean) => void;
  resetAdjustments: () => void;
}

// Export types
export interface ExportState {
  isExporting: boolean;
  exportProgress: number;
  exportMessage: string | null;
}

export interface ExportActions {
  startExport: () => void;
  updateExportProgress: (progress: number, message: string) => void;
  completeExport: () => void;
  cancelExport: () => void;
}

// WCAG analysis types
export interface WcagAnalysisState {
  analysis: DocumentAnalysis | null;
  analysisError: string | null;
  isAnalyzing: boolean;
  isApplying: boolean;
  fontAdjustments: FontAdjustments | null;
  previousAdjustments: { brightness: number; contrast: number } | null;
}

export interface WcagAnalysisActions {
  applyAdjustments: () => void;
  clearAdjustments: () => void;
  startAnalysis: () => void;
  completeAnalysis: (analysis: DocumentAnalysis) => void;
  failAnalysis: (error: Error) => void;
}

// UI state types
export interface UIState {
  isLandingVisible: boolean;
  statusMessage: string | null;
  pageInputValue: string;
}

export interface UIActions {
  showLanding: () => void;
  hideLanding: () => void;
  setStatusMessage: (message: string | null) => void;
  setPageInputValue: (value: string) => void;
}

// Combined application state
export interface AppState extends AppCoreState, AppLoadingState, AppWcagState {
  // Additional derived state
  hasAsset: boolean;
  canDownload: boolean;
  effectiveViewportAspect: number;
  sliderMax: number;
  sliderValue: number;
  sliderDisabled: boolean;
  wcagProcessing: boolean;
  hasWcagAdjustments: boolean;
}

// Event handler types
export interface AppEventHandlers {
  onFileSelected: (file: File) => Promise<void>;
  onDownloadCurrentView: () => Promise<void>;
  onPageChange: (page: number) => void;
  onToggleProjector: (enabled: boolean) => void;
  onApplyWcagAdjustments: () => void;
  onResetAdjustments: () => void;
  onOpenFileDialog: () => void;
  onPageInputCommit: () => void;
  onGoPrevious: () => void;
  onGoNext: () => void;
}

// Component prop types
export interface ProjectionViewportProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  isLoading: boolean;
  isReady: boolean;
  canGoPrev?: boolean;
  canGoNext?: boolean;
  onGoPrev?: () => void;
  onGoNext?: () => void;
  aspectRatio?: number | null;
  textOverlay?: any; // This should be properly typed based on useWcagHelper
}

export interface ControlToolbarProps {
  brightness: number;
  contrast: number;
  projectorEnabled: boolean;
  onBrightnessChange: (value: number) => void;
  onContrastChange: (value: number) => void;
  onToggleProjector: (enabled: boolean) => void;
  onResetAdjustments: () => void;
  hasAsset: boolean;
  hasWcagAdjustments: boolean;
  wcagProcessing: boolean;
  onApplyWcagAdjustments: () => void;
}

export interface FileUploaderProps {
  disabled?: boolean;
  statusMessage?: string | null;
  onFileSelected: (file: File) => void | Promise<void>;
}

// Configuration types
export interface AppConfig {
  initialBrightness: number;
  initialContrast: number;
  defaultWcagAspect: number;
  initialStatusMessage: string;
  supportedFileTypes: string[];
  maxFileSize: number;
}

// Constants
export const DEFAULT_CONFIG: AppConfig = {
  initialBrightness: 100,
  initialContrast: 0,
  defaultWcagAspect: 9 / 16,
  initialStatusMessage: 'PDF または画像ファイルを読み込んでください',
  supportedFileTypes: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/heic',
    'image/heif'
  ],
  maxFileSize: 100 * 1024 * 1024 // 100MB
};