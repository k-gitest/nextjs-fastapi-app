import { auth0 } from "@/lib/auth0";

interface SessionExpiryResult {
  authenticated: boolean;
  expiresAt: number | null;
}

/**
 * auth0.getSession() が返すSessionDataには、公式型定義として`exp`フィールドが
 * 含まれていない（@auth0/nextjs-auth0のAuth0Client.session.inactivityDuration /
 * absoluteDurationから内部計算される値だが、TypeScript契約としては非公開）。
 *
 * 実機検証（2026-09、@auth0/nextjs-auth0 4.16.0）により、session.expが
 * ブラウザのセッションCookieのExpiresと誤差1秒以内で一致することを確認済み。
 * tokenSet.expiresAt（Access Token期限）とは別レイヤーの値であり、
 * 偶然一致することはあっても警告基準には使わない。
 *
 * SDKアップグレード時はこの前提（`exp`フィールドの存在・Cookie期限との対応）を
 * 再検証すること。
 */
function extractSessionExp(session: unknown): number | null {
  if (typeof session !== "object" || session === null) return null;
  const value = (session as Record<string, unknown>).exp;
  return typeof value === "number" ? value : null;
}

/**
 * 現在のAuth0セッションの認証状態と有効期限を取得する。
 * DB Userの取得は行わない（lib/auth0.tsのgetAuthenticatedUser/requireAuthとは
 * 異なり、Auth0セッションの状態そのものだけを扱う責務のため）。
 */
export async function getSessionExpiryStatus(): Promise<SessionExpiryResult> {
  const session = await auth0.getSession();

  if (!session?.user) {
    return { authenticated: false, expiresAt: null };
  }

  return { authenticated: true, expiresAt: extractSessionExp(session) };
}