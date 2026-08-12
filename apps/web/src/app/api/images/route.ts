export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth0";
import { imageMutationRatelimit } from "@/lib/ratelimit";
import { checkRateLimit } from "@/lib/ratelimit-helper";
import { createImage } from "@/features/images/services/imageService";
import { createImageInputSchema } from "@/features/images/schemas";
import { logServiceError } from "@/lib/server-logger";
import { registerStorageCleanupTask } from "@/features/images/services/internal/storageCleanupTask";

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
    // B2 PUT成功後にImage DB作成が失敗した場合、B2オブジェクトが孤立する（Type A）。
    // b2_object_pathをcontextに含めて追跡可能にする（Type B: component="image-cleanup"と対になる）。
    const correlationId = crypto.randomUUID();

    logServiceError(error instanceof Error ? error : new Error(String(error)), {
      component: "image-create",
      correlationId,
      context: {
        // Sentryのデータスクラビングが "key" を含む文字列に反応してマスキングするため、
        // "key" を含まない名前にしている（stagingで storage_key が [Filtered] になることを確認済み）
        b2_object_path: parsed.data.storageKey,
      },
    });

    // Type AとしてGC対象タスクへ登録する（pending）。
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