import type { SessionStatus } from "../types";

export async function fetchSessionStatus(): Promise<SessionStatus | null> {
  const res = await fetch("/api/auth/session-status");

  // 401はエラーではなく「セッション切れ」という別の状態として扱う
  if (res.status === 401) {
    return null;
  }
  if (!res.ok) {
    throw new Error("Failed to fetch session status");
  }
  return res.json();
}