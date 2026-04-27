export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth0";
//import { getUserBySub } from "@/features/auth/services/userService";
import { todoService } from "@/features/todos/services/index";
import { triggerVectorUpsert } from "@/features/todos/services/vector-trigger";
import { triggerAnalyticsEvent } from "@/features/analytics/services/analytics-trigger";
import { runAfterResponse } from "@/lib/background-task";
import { todoRatelimit } from "@/lib/ratelimit";
import { checkRateLimit } from "@/lib/ratelimit-helper";

/**
 * 認証チェックとDBユーザー取得の共通処理
 * Route Handler内で毎回書かなくていいようにヘルパー化
 */
/*
async function getAuthenticatedUser() {
  const session = await auth0.getSession();
  if (!session?.user) return null;

  const dbUser = await getUserBySub(session.user.sub);
  if (!dbUser) return null; // layout.tsxのsyncUserより前に来た場合の安全策

  return dbUser;
}
*/

// GET /api/todos - Todo一覧取得
export async function GET() {
  const { user, response } = await requireAuth();
  if (!user) return response;

  const todos = await todoService.getTodos(user.id); // DBのidを使う
  return NextResponse.json(todos);
}

// POST /api/todos - Todo作成
export async function POST(req: Request) {
  const { user, response } = await requireAuth();
  if (!user) return response;

  // レート制限チェック
  const rateLimitResponse = await checkRateLimit(todoRatelimit, user.id);
  if (rateLimitResponse) return rateLimitResponse;

  const body = await req.json();
  const todo = await todoService.createTodo({
    todo_title: body.todo_title,
    priority: body.priority,
    progress: body.progress ?? 0,
    userId: user.id, // DBのidを使う（subではない）
  });

  // 外部連携はrunAfterResponseへ
  /*
  runAfterResponse([
    triggerVectorUpsert(todo),
    triggerAnalyticsEvent("todo_event", {
      event_type: "create",
      todo_id: todo.id,
      user_id: user.id,
      priority: todo.priority,
      progress: todo.progress,
    }),
  ]);
  */

  return NextResponse.json(todo, { status: 201 });
}
