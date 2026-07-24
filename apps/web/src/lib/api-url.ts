export const resolveApiUrl = (path: string): string => {
  if (typeof window !== "undefined") {
    return path; // ブラウザ: 相対URLのままでOK
  }
  // サーバー: base URLを環境変数から組み立てる
  const base = process.env.APP_BASE_URL ?? "http://localhost:3000";
  return `${base}${path}`;
};