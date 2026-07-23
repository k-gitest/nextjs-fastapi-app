export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth0";
import { deleteImage, updateImageAlbum } from "@/features/images/services/imageService";
import { todoRatelimit } from "@/lib/ratelimit";
import { checkRateLimit } from "@/lib/ratelimit-helper";
import { NotFoundError } from "@/errors/not-found-error";
import { ValidationError } from "@/errors/validation-error";
import { albumIdInputSchema } from "@/features/albums/schemas";

// PATCH /api/images/[id] - Imageの所属Album変更（未所属⇔Album間、Album間移動を含む）
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireAuth();
  if (!user) return response;

  const rateLimitResponse = await checkRateLimit(todoRatelimit, user.id);
  if (rateLimitResponse) return rateLimitResponse;

  const { id } = await params;
  const body = await req.json();

  const parsed = albumIdInputSchema.safeParse(body.albumId);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "アルバム指定が不正です", data: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const image = await updateImageAlbum(id, parsed.data, user.id);
    return NextResponse.json(image);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    throw error;
  }
}

// DELETE /api/images/[id] - Image単体削除（画像管理機能）
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireAuth();
  if (!user) return response;

  const rateLimitResponse = await checkRateLimit(todoRatelimit, user.id);
  if (rateLimitResponse) return rateLimitResponse;

  const { id } = await params;
  const correlationId = crypto.randomUUID();

  try {
    await deleteImage(id, user.id, { correlationId });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}