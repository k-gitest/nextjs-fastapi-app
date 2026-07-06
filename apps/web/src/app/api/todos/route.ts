export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth0";
import { todoService } from "@/features/todos/services/index";
import { todoRatelimit } from "@/lib/ratelimit";
import { checkRateLimit } from "@/lib/ratelimit-helper";
import { attachImageInputSchema } from "@/features/images/schemas";

// リクエストボディの image フィールドのみZod検証する
// （Todo側フィールドは既存の実装方針に合わせて今回は無検証のまま踏襲する）
// 作成時は「削除」の概念が無いため実質 undefined | AttachImageInput のみ意味を持つが、
// 型としてはnullも許容しておき、Route Handler側で無視する。
const imageFieldSchema = attachImageInputSchema.nullable().optional();

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

  const imageParsed = imageFieldSchema.safeParse(body.image);
  if (!imageParsed.success) {
    return NextResponse.json({ message: "画像データが不正です", data: imageParsed.error.flatten() }, { status: 400 });
  }
  // 作成時に null（削除指定）が来ても意味がないため undefined として扱う
  const image = imageParsed.data ?? undefined;

  const correlationId = crypto.randomUUID();
  const todo = await todoService.createTodo(
    {
      todo_title: body.todo_title,
      priority: body.priority,
      progress: body.progress ?? 0,
      userId: user.id, // DBのidを使う（subではない）
    },
    correlationId,
    image,
  );

  return NextResponse.json(todo, { status: 201 });
}