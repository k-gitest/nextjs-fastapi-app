export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth0";
import { todoService } from "@/features/todos/services/todoService";
import { todoRatelimit } from "@/lib/ratelimit";
import { checkRateLimit } from "@/lib/ratelimit-helper";
import { NotFoundError } from "@/errors/not-found-error";

// PATCH /api/todos/[id] - Todo更新
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response } = await requireAuth();
  if (!user) return response;

  // レート制限チェック
  const rateLimitResponse = await checkRateLimit(todoRatelimit, user.id);
  if (rateLimitResponse) return rateLimitResponse;

  const { id } = await params;
  const body = await req.json();

  const correlationId = crypto.randomUUID();

  try {
    const todo = await todoService.updateTodo({ id, ...body }, user.id, correlationId,);
    return NextResponse.json(todo);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error; // それ以外は500
  }
}

// DELETE /api/todos/[id] - Todo削除
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response } = await requireAuth();
  if (!user) return response;

  // レート制限チェック
  const rateLimitResponse = await checkRateLimit(todoRatelimit, user.id);
  if (rateLimitResponse) return rateLimitResponse;

  const { id } = await params;
  const correlationId = crypto.randomUUID();

  try {
    await todoService.deleteTodo(id, user.id, correlationId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }

}