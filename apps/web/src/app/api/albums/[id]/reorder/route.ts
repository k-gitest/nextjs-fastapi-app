export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth0";
import { albumService } from "@/features/albums/services/";
import { todoRatelimit } from "@/lib/ratelimit";
import { checkRateLimit } from "@/lib/ratelimit-helper";
import { NotFoundError } from "@/errors/not-found-error";
import { ValidationError } from "@/errors/validation-error";
import { reorderAlbumImagesSchema } from "@/features/albums/schemas";

// PATCH /api/albums/[id]/reorder - Album内画像の並び替え
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireAuth();
  if (!user) return response;

  const rateLimitResponse = await checkRateLimit(todoRatelimit, user.id);
  if (rateLimitResponse) return rateLimitResponse;

  const { id } = await params;
  const body = await req.json();

  const parsed = reorderAlbumImagesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "並び替えの指定が不正です", data: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    await albumService.reorderAlbumImages(id, parsed.data.imageIds, user.id);
    return new NextResponse(null, { status: 204 });
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