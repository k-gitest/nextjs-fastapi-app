export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth0";
import { imageMutationRatelimit } from "@/lib/ratelimit";
import { checkRateLimit } from "@/lib/ratelimit-helper";
import { createImage } from "@/features/images/services/imageService";
import { createImageInputSchema } from "@/features/images/schemas";

// POST /api/images - Image単体作成（ライブラリへの新規登録）
export async function POST(req: Request) {
  const { user, response } = await requireAuth();
  if (!user) return response;

  const rateLimitResponse = await checkRateLimit(imageMutationRatelimit, user.id);
  if (rateLimitResponse) return rateLimitResponse;

  const body = await req.json();
  const parsed = createImageInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "画像データが不正です", data: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const image = await createImage(parsed.data, user.id);
  return NextResponse.json(image, { status: 201 });
}