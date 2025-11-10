/**
 * 統一されたエラーハンドリングユーティリティ
 */

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ErrorContext {
  component: string;
  operation: string;
  userMessage?: string;
  metadata?: Record<string, any>;
}

export interface AppError {
  id: string;
  message: string;
  severity: ErrorSeverity;
  context: ErrorContext;
  timestamp: string;
  originalError?: unknown;
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private errors: AppError[] = [];
  private maxErrors = 100;

  private constructor() {}

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * エラーを記録し、ユーザーに表示するメッセージを返す
   */
  handleError(
    error: unknown,
    context: ErrorContext,
    severity: ErrorSeverity = 'medium'
  ): string {
    const errorId = this.generateErrorId();
    const timestamp = new Date().toISOString();
    
    const appError: AppError = {
      id: errorId,
      message: this.extractErrorMessage(error),
      severity,
      context,
      timestamp,
      originalError: error
    };

    this.addError(appError);
    
    // 開発環境では詳細なエラーをログに出力
    if (process.env.NODE_ENV === 'development') {
      console.error(`[${context.component}] ${context.operation}:`, error);
    }

    // ユーザー向けメッセージを返す
    return context.userMessage || this.getDefaultUserMessage(severity);
  }

  /**
   * 警告を記録（エラーではないが注意が必要なケース）
   */
  handleWarning(message: string, context: ErrorContext): void {
    const errorId = this.generateErrorId();
    const timestamp = new Date().toISOString();

    const warning: AppError = {
      id: errorId,
      message,
      severity: 'low',
      context,
      timestamp
    };

    this.addError(warning);

    if (process.env.NODE_ENV === 'development') {
      console.warn(`[${context.component}] ${context.operation}:`, message);
    }
  }

  /**
   * エラー履歴を取得
   */
  getErrorHistory(): AppError[] {
    return [...this.errors];
  }

  /**
   * 特定のコンポーネントのエラーを取得
   */
  getErrorsByComponent(component: string): AppError[] {
    return this.errors.filter(error => error.context.component === component);
  }

  /**
   * 重大度でフィルタリングしたエラーを取得
   */
  getErrorsBySeverity(severity: ErrorSeverity): AppError[] {
    return this.errors.filter(error => error.severity === severity);
  }

  /**
   * エラー履歴をクリア
   */
  clearErrors(): void {
    this.errors = [];
  }

  private addError(error: AppError): void {
    this.errors.unshift(error);
    
    // 最大数を超えた古いエラーを削除
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(0, this.maxErrors);
    }
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    if (error && typeof error === 'object' && 'message' in error) {
      return String((error as any).message);
    }
    return '不明なエラーが発生しました';
  }

  private getDefaultUserMessage(severity: ErrorSeverity): string {
    switch (severity) {
      case 'low':
        return '操作中に問題が発生しましたが、処理は続行されます';
      case 'medium':
        return '問題が発生しました。もう一度お試しください';
      case 'high':
        return '重大な問題が発生しました。ページを再読み込みしてください';
      case 'critical':
        return 'システムエラーが発生しました。サポートにお問い合わせください';
      default:
        return 'エラーが発生しました';
    }
  }
}

// シングルトンインスタンスのエクスポート
export const errorHandler = ErrorHandler.getInstance();

// 共通エラータイプ
export const CommonErrors = {
  FILE_LOAD: {
    component: 'FileUploader',
    operation: 'ファイル読み込み',
    userMessage: 'ファイルの読み込みに失敗しました'
  },
  WCAG_ANALYSIS: {
    component: 'WcagHelper',
    operation: 'WCAG解析',
    userMessage: 'アクセシビリティ解析に失敗しました'
  },
  PROJECTOR_PROCESSING: {
    component: 'Projector',
    operation: '画像処理',
    userMessage: '画像処理に失敗しました'
  },
  TEMPLATE_APPLICATION: {
    component: 'TemplateManager',
    operation: 'テンプレート適用',
    userMessage: 'テンプレートの適用に失敗しました'
  },
  AUTO_CORRECTION: {
    component: 'AutoCorrection',
    operation: '自動修正',
    userMessage: '自動修正の適用に失敗しました'
  }
} as const;