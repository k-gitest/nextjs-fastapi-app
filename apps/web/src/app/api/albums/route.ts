export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth0";
import { albumService } from "@/features/albums/services/albumService";
import { todoRatelimit } from "@/lib/ratelimit";
import { checkRateLimit } from "@/lib/ratelimit-helper";
import { ConflictError } from "@/errors/conflict-error";
import { createAlbumSchema } from "@/features/albums/schemas";

// GET /api/albums - Album一覧取得
export async function GET() {
  const { user, response } = await requireAuth();
  if (!user) return response;

  const albums = await albumService.getAlbums(user.id);
  return NextResponse.json(albums);
}

// POST /api/albums - Album作成
export async function POST(req: Request) {
  const { user, response } = await requireAuth();
  if (!user) return response;

  // レート制限チェック（Album CRUDはTodo CRUDと負荷特性が同じため専用limiterを設けず流用する）
  const rateLimitResponse = await checkRateLimit(todoRatelimit, user.id);
  if (rateLimitResponse) return rateLimitResponse;

  const body = await req.json();

  const parsed = createAlbumSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "アルバム名が不正です", data: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const album = await albumService.createAlbum({
      name: parsed.data.name,
      userId: user.id,
    });

    return NextResponse.json(album, { status: 201 });
  } catch (error) {
    if (error instanceof ConflictError) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }
    throw error; // それ以外は500
  }
}