export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth0";
import { todoService } from "@/features/todos/services/index";
import { todoRatelimit } from "@/lib/ratelimit";
import { checkRateLimit } from "@/lib/ratelimit-helper";

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
  const correlationId = crypto.randomUUID();
  const todo = await todoService.createTodo({
    todo_title: body.todo_title,
    priority: body.priority,
    progress: body.progress ?? 0,
    userId: user.id, // DBのidを使う（subではない）
  },
    correlationId);

  return NextResponse.json(todo, { status: 201 });
}
