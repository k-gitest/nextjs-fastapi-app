export interface User {
  id: string;  // Auth0のsub（例: "auth0|507f1f77bcf86cd799439011"）
  email: string;
  first_name: string;
  last_name: string;
}

export interface AuthState {
  user: User | null;
  isInitialized: boolean;
  setUser: (user: User | null) => void;
  logout: () => void;
  setInitialized: (value: boolean) => void;
}

// --- セッション期限警告 ---

/**
 * GET /api/auth/session-status のレスポンス型。
 * "unknown" は認証は成功しているがsession.expを取得できなかった状態
 * （SDK側の非公式フィールド仕様変更等）を表す。
 */
export type SessionStatus =
  | { status: "ok"; expiresAt: number }
  | { status: "unknown" };