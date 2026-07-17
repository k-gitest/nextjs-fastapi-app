import { toast } from "sonner";
import { useAuthStore } from "@/hooks/use-session-store";
import { ApiError } from "./api-error";
import { NetworkError } from "./network-error";
import { ValidationError } from "./validation-error";

/**
 * アプリケーション全体のエラーハンドラ
 * 全てのエラーはここを通して処理される
 *
 * @param error - キャッチされたエラー
 * @param context - エラーが発生した文脈（オプション）
 */
export const errorHandler = (error: unknown, context?: string): void => {
  // デバッグ用：開発環境では詳細なログを出力
  if (process.env.NODE_ENV === "development") {
    console.group(`🚨 Error Handler ${context ? `[${context}]` : ""}`);
    console.error(error);
    console.groupEnd();
  }

  // 1. ApiError の処理
  if (error instanceof ApiError) {
    handleApiError(error);
    return;
  }

  // 2. NetworkError の処理
  if (error instanceof NetworkError) {
    handleNetworkError(error);
    return;
  }

  // 3. ValidationError の処理
  if (error instanceof ValidationError) {
    handleValidationError(error);
    return;
  }

  // 4. 標準的なErrorオブジェクト
  if (error instanceof Error) {
    toast.error(error.message || "予期しないエラーが発生しました");
    logErrorToService(error);
    return;
  }

  // 5. それ以外（プリミティブ値などが throw された場合）
  toast.error("予期しないエラーが発生しました");
  logErrorToService(new Error(String(error)));
};

/**
 * APIエラーの処理
 */
const handleApiError = (error: ApiError): void => {
  // 401: 認証エラー → ログアウト処理
  if (error.isAuthError) {
    const authStore = useAuthStore.getState();

    // 既にログアウト済みでない場合のみログアウト
    if (authStore.user !== null) {
      authStore.logout();
      toast.error("セッションが切れました。再ログインしてください。");
    }
    return;
  }

  // 403: 権限エラー
  if (error.isForbiddenError) {
    toast.error("この操作を行う権限がありません。");
    return;
  }

  // 404: リソースが見つからない
  if (error.isNotFoundError) {
    toast.error("リソースが見つかりませんでした。");
    return;
  }

  // 400: バリデーションエラー（フィールド別エラーがある場合）
  if (error.isValidationError && error.fieldErrors) {
    // フィールド別エラーは通常フォームコンポーネントが処理するため
    // ここでは汎用的なメッセージのみ表示
    const firstError = Object.values(error.fieldErrors)[0]?.[0];
    toast.error(firstError || "入力内容に誤りがあります。");
    return;
  }

  if (error.isConflictError) {
    toast.error(error.message);
    return;
  }

  if (error.isRateLimitError) {
    toast.error(error.message || "リクエスト制限にかかりました。");
    return;
  }

  // 500番台: サーバーエラー
  if (error.isServerError) {
    toast.error(
      "サーバーエラーが発生しました。しばらくしてから再度お試しください。",
    );
    logErrorToService(error);
    return;
  }

  // その他のエラー
  const message =
    error.serverMessage || error.message || "エラーが発生しました";
  toast.error(message);
};

/**
 * ネットワークエラーの処理
 */
const handleNetworkError = (error: NetworkError): void => {
  if (error.isTimeout) {
    toast.error("通信がタイムアウトしました。再度お試しください。");
  } else {
    toast.error("ネットワークエラーが発生しました。接続を確認してください。");
  }
  logErrorToService(error);
};

/**
 * バリデーションエラーの処理
 */
const handleValidationError = (error: ValidationError): void => {
  // 最初のエラーメッセージを表示
  const message = error.allMessages[0] || error.message;
  toast.error(message);
};

/**
 * エラーログを外部サービスに送信
 * 本番環境でのみ実行
 */
const logErrorToService = (error: Error): void => {
  if (process.env.NODE_ENV !== "production") {
    // 開発環境（development）の場合のみ、シミュレーションログを表示
    if (process.env.NODE_ENV === "development") {
      console.info("📤 [Dev Only] Error would be logged to service:", error);
    }

    return;
  }
  // --- 本番環境のみ実行される処理 ---
  // Sentry.captureException(error);
};

/**
 * エラーハンドラのユーティリティ型
 * Promise を返す関数をラップしてエラーハンドリングを自動化
 */
export const withErrorHandler = <Args extends unknown[], Return>(
  fn: (...args: Args) => Promise<Return>,
  context?: string,
): ((...args: Args) => Promise<Return>) => {
  return async (...args: Args): Promise<Return> => {
    try {
      return await fn(...args);
    } catch (error) {
      errorHandler(error, context);
      throw error; // 上位（コンポーネント側など）でも処理が必要な場合のため再throw
    }
  };
};
