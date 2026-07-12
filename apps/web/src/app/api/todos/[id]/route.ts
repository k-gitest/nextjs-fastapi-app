export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth0";
import { todoService } from "@/features/todos/services/todoService";
import { todoRatelimit } from "@/lib/ratelimit";
import { checkRateLimit } from "@/lib/ratelimit-helper";
import { NotFoundError } from "@/errors/not-found-error";
import { ValidationError } from "@/errors/validation-error";
import { imageListInputSchema } from "@/features/images/schemas";

// images フィールドのみZod検証する（既存のTodoフィールド検証方針は変更しない）
const imagesFieldSchema = imageListInputSchema.optional();

// PATCH /api/todos/[id] - Todo更新
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireAuth();
  if (!user) return response;

  // レート制限チェック
  const rateLimitResponse = await checkRateLimit(todoRatelimit, user.id);
  if (rateLimitResponse) return rateLimitResponse;

  const { id } = await params;
  const body = await req.json();

  // images は Todo の data には混ぜず、todoService.updateTodo の別引数として渡す
  // （UpdateTodoInput 型に images を含めていないため、混ぜるとPrismaの型エラーになる）
  const { images: rawImages, ...todoBody } = body;

  const imagesParsed = imagesFieldSchema.safeParse(rawImages);
  if (!imagesParsed.success) {
    return NextResponse.json({ message: "画像データが不正です", data: imagesParsed.error.flatten() }, { status: 400 });
  }
  const images = imagesParsed.data;

  const correlationId = crypto.randomUUID();

  try {
    const todo = await todoService.updateTodo({ id, ...todoBody }, user.id, correlationId, images);
    return NextResponse.json(todo);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    throw error; // それ以外は500
  }
}

// DELETE /api/todos/[id] - Todo削除
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
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