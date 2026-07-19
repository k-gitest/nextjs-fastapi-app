export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth0";
import { albumService } from "@/features/albums/services/albumService";
import { todoRatelimit } from "@/lib/ratelimit";
import { checkRateLimit } from "@/lib/ratelimit-helper";
import { NotFoundError } from "@/errors/not-found-error";
import { ConflictError } from "@/errors/conflict-error";
import { updateAlbumSchema } from "@/features/albums/schemas";

// GET /api/albums/[id] - Album詳細取得（所属画像一覧・usageCount込み）
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireAuth();
  if (!user) return response;

  const { id } = await params;

  try {
    const album = await albumService.getAlbumDetail(id, user.id);
    return NextResponse.json(album);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}

// PATCH /api/albums/[id] - Album更新
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireAuth();
  if (!user) return response;

  const rateLimitResponse = await checkRateLimit(todoRatelimit, user.id);
  if (rateLimitResponse) return rateLimitResponse;

  const { id } = await params;
  const body = await req.json();

  const parsed = updateAlbumSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "アルバム名が不正です", data: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const album = await albumService.updateAlbum({ id, name: parsed.data.name }, user.id);
    return NextResponse.json(album);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ConflictError) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }
    throw error;
  }
}

// DELETE /api/albums/[id] - Album削除
// Image単体削除機能追加に伴い仕様変更: 所属Imageを全削除した上でAlbumを削除するため、
// P2003（画像が残っている場合の制約違反）は発生しなくなった。ConflictErrorハンドリングは不要。
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireAuth();
  if (!user) return response;

  const rateLimitResponse = await checkRateLimit(todoRatelimit, user.id);
  if (rateLimitResponse) return rateLimitResponse;

  const { id } = await params;
  const correlationId = crypto.randomUUID();

  try {
    await albumService.deleteAlbum(id, user.id, { correlationId });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}