import { useCallback, useState } from 'react';

export interface AppError {
  id: string;
  type: 'file' | 'render' | 'export' | 'analysis' | 'network';
  message: string;
  timestamp: number;
  details?: unknown;
  recoverable?: boolean;
}

export interface ErrorHandlerActions {
  reportError: (type: AppError['type'], message: string, details?: unknown, recoverable?: boolean) => void;
  clearError: (id: string) => void;
  clearAllErrors: () => void;
  getErrorsByType: (type: AppError['type']) => AppError[];
}

export const useErrorHandler = (): [AppError[], ErrorHandlerActions] => {
  const [errors, setErrors] = useState<AppError[]>([]);

  const reportError = useCallback((
    type: AppError['type'],
    message: string,
    details?: unknown,
    recoverable = false
  ) => {
    const error: AppError = {
      id: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      message,
      timestamp: Date.now(),
      details,
      recoverable
    };

    setErrors(prev => {
      // Avoid duplicate errors within 1 second
      const isDuplicate = prev.some(
        e => e.type === type && 
             e.message === message && 
             Date.now() - e.timestamp < 1000
      );
      
      if (isDuplicate) {
        return prev;
      }
      
      console.error(`[${type.toUpperCase()}] ${message}`, details);
      return [...prev, error];
    });
  }, []);

  const clearError = useCallback((id: string) => {
    setErrors(prev => prev.filter(error => error.id !== id));
  }, []);

  const clearAllErrors = useCallback(() => {
    setErrors([]);
  }, []);

  const getErrorsByType = useCallback((type: AppError['type']) => {
    return errors.filter(error => error.type === type);
  }, [errors]);

  const actions: ErrorHandlerActions = {
    reportError,
    clearError,
    clearAllErrors,
    getErrorsByType
  };

  return [errors, actions];
};

// Error boundary component for React error handling
export class ErrorBoundary extends Error {
  constructor(
    message: string,
    public componentStack: string,
    public originalError: Error
  ) {
    super(message);
    this.name = 'ErrorBoundary';
  }
}

// Utility functions for specific error types
export const ErrorUtils = {
  createFileError: (message: string, details?: unknown): AppError => ({
    id: `file-${Date.now()}`,
    type: 'file',
    message,
    timestamp: Date.now(),
    details,
    recoverable: true
  }),

  createRenderError: (message: string, details?: unknown): AppError => ({
    id: `render-${Date.now()}`,
    type: 'render',
    message,
    timestamp: Date.now(),
    details,
    recoverable: false
  }),

  createExportError: (message: string, details?: unknown): AppError => ({
    id: `export-${Date.now()}`,
    type: 'export',
    message,
    timestamp: Date.now(),
    details,
    recoverable: true
  }),

  createAnalysisError: (message: string, details?: unknown): AppError => ({
    id: `analysis-${Date.now()}`,
    type: 'analysis',
    message,
    timestamp: Date.now(),
    details,
    recoverable: true
  }),

  // Common error messages
  MESSAGES: {
    FILE_LOAD_FAILED: 'ファイルの読み込みに失敗しました',
    FILE_UNSUPPORTED: '対応していないファイル形式です',
    RENDER_INIT_FAILED: 'レンダラーの初期化に失敗しました',
    EXPORT_FAILED: 'エクスポートに失敗しました',
    ANALYSIS_FAILED: '解析に失敗しました',
    NETWORK_ERROR: 'ネットワークエラーが発生しました'
  } as const
};