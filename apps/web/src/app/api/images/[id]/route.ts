export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth0";
import { deleteImage } from "@/features/images/services/imageService";
import { todoRatelimit } from "@/lib/ratelimit";
import { checkRateLimit } from "@/lib/ratelimit-helper";
import { NotFoundError } from "@/errors/not-found-error";

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