// export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "localhost"
export const SENTRY_DSN = process.env.SENTRY_DSN;
export const SENTRY_RELEASE = process.env.SENTRY_RELEASE || 'unknown';

// バックエンド（FastAPI）用のURL設定を追加
export const BACKEND_API_URL = process.env.BACKEND_API_URL ?? "http://localhost:8000";

// export const getFastapiPublicUrl = () => process.env.FASTAPI_PUBLIC_URL!;

export const getBaseUrl = () => {
  if (typeof window !== "undefined") return ""; // ブラウザ: 相対URLでOK
  return process.env.APP_BASE_URL ?? "http://localhost:3000"; // サーバー: 絶対URL必要
};
