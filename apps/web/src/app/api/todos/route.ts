export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth0";
import { todoService } from "@/features/todos/services/index";
import { todoRatelimit } from "@/lib/ratelimit";
import { checkRateLimit } from "@/lib/ratelimit-helper";
import { ValidationError } from "@/errors/validation-error";
import { createImageListInputSchema } from "@/features/images/schemas";
import { albumIdInputSchema } from "@/features/albums/schemas";

// リクエストボディの images フィールドのみZod検証する
// （Todo側フィールドは既存の実装方針に合わせて今回は無検証のまま踏襲する）
// 作成時は「既存画像」という概念が存在しないため、API契約としてkind:"new"のみを
// 許可する専用スキーマを使う（kind:"existing"はここでバリデーションエラーになる）。
const imagesFieldSchema = createImageListInputSchema.optional();

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

  const imagesParsed = imagesFieldSchema.safeParse(body.images);
  if (!imagesParsed.success) {
    return NextResponse.json({ message: "画像データが不正です", data: imagesParsed.error.flatten() }, { status: 400 });
  }
  const images = imagesParsed.data;

  // albumId: 未指定はnull扱い（Album未選択のまま保存を許可する）
  const albumIdParsed = albumIdInputSchema.safeParse(body.albumId ?? null);
  if (!albumIdParsed.success) {
    return NextResponse.json({ message: "アルバム指定が不正です", data: albumIdParsed.error.flatten() }, { status: 400 });
  }
  const albumId = albumIdParsed.data;

  const correlationId = crypto.randomUUID();

  try {
    const todo = await todoService.createTodo(
      {
        todo_title: body.todo_title,
        priority: body.priority,
        progress: body.progress ?? 0,
        userId: user.id, // DBのidを使う（subではない）
      },
      correlationId,
      images,
      albumId,
    );

    return NextResponse.json(todo, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    throw error; // それ以外は500
  }
}