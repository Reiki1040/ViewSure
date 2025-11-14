import { useCallback, useState } from 'react';

export type LoadingState = {
  isLoading: boolean;
  isExporting: boolean;
  isAnalyzing: boolean;
  isApplying: boolean;
};

export type LoadingActions = {
  startLoading: (type: keyof LoadingState) => void;
  stopLoading: (type: keyof LoadingState) => void;
  setLoading: (type: keyof LoadingState, value: boolean) => void;
  resetAll: () => void;
  withLoading: <T>(
    type: keyof LoadingState,
    asyncFn: () => Promise<T>,
    errorHandler?: (error: unknown) => void
  ) => Promise<T>;
};

const INITIAL_LOADING_STATE: LoadingState = {
  isLoading: false,
  isExporting: false,
  isAnalyzing: false,
  isApplying: false
};

export const useLoadingState = (): [LoadingState, LoadingActions] => {
  const [loadingState, setLoadingState] = useState<LoadingState>(INITIAL_LOADING_STATE);

  const startLoading = useCallback((type: keyof LoadingState) => {
    setLoadingState(prev => ({
      ...prev,
      [type]: true
    }));
  }, []);

  const stopLoading = useCallback((type: keyof LoadingState) => {
    setLoadingState(prev => ({
      ...prev,
      [type]: false
    }));
  }, []);

  const setLoading = useCallback((type: keyof LoadingState, value: boolean) => {
    setLoadingState(prev => ({
      ...prev,
      [type]: value
    }));
  }, []);

  const resetAll = useCallback(() => {
    setLoadingState(INITIAL_LOADING_STATE);
  }, []);

  const withLoading = useCallback(async <T>(
    type: keyof LoadingState,
    asyncFn: () => Promise<T>,
    errorHandler?: (error: unknown) => void
  ): Promise<T> => {
    startLoading(type);
    try {
      const result = await asyncFn();
      return result;
    } catch (error) {
      if (errorHandler) {
        errorHandler(error);
      } else {
        console.error(`Error during ${type}:`, error);
      }
      throw error;
    } finally {
      stopLoading(type);
    }
  }, [startLoading, stopLoading]);

  const actions: LoadingActions = {
    startLoading,
    stopLoading,
    setLoading,
    resetAll,
    withLoading
  };

  return [loadingState, actions];
};

// Utility to check if any loading state is active
export const isLoadingAny = (state: LoadingState): boolean => {
  return Object.values(state).some(Boolean);
};

// Utility to get loading message based on state
export const getLoadingMessage = (state: LoadingState): string | null => {
  if (state.isLoading) return 'ファイルを読み込み中...';
  if (state.isExporting) return 'PDFをエクスポート中...';
  if (state.isAnalyzing) return 'WCAG解析を実行中...';
  if (state.isApplying) return '調整を適用中...';
  return null;
};