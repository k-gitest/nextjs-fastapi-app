export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth0";
import { imageMutationRatelimit } from "@/lib/ratelimit";
import { checkRateLimit } from "@/lib/ratelimit-helper";
import { createImage } from "@/features/images/services/imageService";
import { createImageInputSchema } from "@/features/images/schemas";
import { logServiceError } from "@/lib/server-logger";
import { registerStorageCleanupTask } from "@/features/images/services/internal/storageCleanupTask";
import { ConflictError } from "@/errors/conflict-error";

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

  try {
    const image = await createImage(parsed.data, user.id);
    return NextResponse.json(image, { status: 201 });
  } catch (error) {
    // storageKey重複（ConflictError）は、既存Imageが正当にstorageKeyを参照している
    // 可能性があるケースであり、B2オブジェクトの孤立（Type A）ではない。
    // GC登録の対象外とし、409をそのまま返す。
    if (error instanceof ConflictError) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }
    
    // B2 PUT成功後にImage DB作成が失敗すると、B2オブジェクトが孤立する。
    // 失敗したB2オブジェクトを後から追跡できるよう、storageKeyをSentryのcontextに記録する。
    const correlationId = crypto.randomUUID();

    logServiceError(error instanceof Error ? error : new Error(String(error)), {
      component: "image-create",
      correlationId,
      context: {
        b2_object_path: parsed.data.storageKey,
      },
    });

    // Type A（B2 PUT成功後にImage作成が失敗し、B2オブジェクトが孤立するケース）
    // としてGC対象タスクへ登録する（pending）。
    // B2削除の再試行はWorker（apps/worker）の定期ポーリングが行う。
    await registerStorageCleanupTask({
      storageKey: parsed.data.storageKey,
      reason: "image_create_failed",
      error,
      correlationId,
    });

    throw error;
  }
}