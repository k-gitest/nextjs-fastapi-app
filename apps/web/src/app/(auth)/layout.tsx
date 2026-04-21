import { auth0 } from "@/lib/auth0";
import { syncUser } from "@/features/auth/services/userService";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

/**
 * 認証済みページ共通レイアウト
 *
 * 役割:
 * 1. 未認証ユーザーを /auth/login へリダイレクト
 * 2. 初回ログイン時にDBへUserレコードを作成（syncUser）
 *
 * syncUserをここで呼ぶ理由:
 * - 認証済みページへのすべてのアクセスで確実に実行される
 * - Route Handler / Server Action より前に実行されるため
 *   「UserがDBに存在しない」状態でTodo操作が走るのを防げる
 */
export default async function AuthLayout({ children }: { children: ReactNode }) {
  const session = await auth0.getSession();

  if (!session?.user) {
    redirect("/auth/login");
  }

  const { sub, email, name } = session.user;

  if (!email) {
    // Auth0の設定でemailスコープが取れていない場合
    throw new Error("Email is required from Auth0 session");
  }

  // DBにユーザーが存在しなければ作成（Upsert）
  // 毎リクエストで呼ばれるが、UpsertなのでDBへの負荷は低い
  await syncUser({ sub, email, name });

  return <>{children}</>;
}