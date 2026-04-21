export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth0";
//import { getUserBySub } from "@/features/auth/services/userService";
import { todoService } from "@/features/todos/services/todoService";
import { triggerVectorUpsert, triggerVectorDelete } from "@/features/todos/services/vector-trigger";
import { triggerAnalyticsEvent } from "@/features/analytics/services/analytics-trigger";
import { runAfterResponse } from "@/lib/background-task"

/*
async function getAuthenticatedUser() {
  const session = await auth0.getSession();
  if (!session?.user) return null;
  return await getUserBySub(session.user.sub);
}
*/

// PATCH /api/todos/[id] - Todo更新
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response } = await requireAuth();
  if (!user) return response;

  const { id } = await params;
  const body = await req.json();

  const todo = await todoService.updateTodo({ id, ...body });

  // 後続の重い処理や外部連携はafterで逃がす
  runAfterResponse([
    triggerVectorUpsert(todo),
    triggerAnalyticsEvent("todo_event", {
      event_type: "update",
      todo_id: todo.id,
      user_id: user.id,
      progress: todo.progress,
    }),
  ]);

  return NextResponse.json(todo);
}

// DELETE /api/todos/[id] - Todo削除
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response } = await requireAuth();
  if (!user) return response;

  const { id } = await params;
  await todoService.deleteTodo(id);

  runAfterResponse([
    triggerVectorDelete(id),
    triggerAnalyticsEvent("todo_event", {
      event_type: "delete",
      todo_id: id,
      user_id: user.id,
    }),
  ]);

  return new NextResponse(null, { status: 204 });
}