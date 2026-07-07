import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { auth0 } from "@/lib/auth0";
import { presignedUrlRequestSchema } from "@/features/images/schemas";
import { buildStorageKey, createPresignedPutUrl } from "@/lib/b2";

export const dynamic = "force-dynamic";

// MIME <-> 拡張子はサーバー側でも固定マッピングを持つ。
// クライアントの検証結果を信用せず、ここでも同じ制約を強制する。
const MIME_TO_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

export async function POST(request: Request) {
  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    return NextResponse.json({ message: "認証が必要です" }, { status: 401 });
  }

  // NOTE: このプロジェクトのAuth0セッションのuserはauth0Id(sub)。
  // 実際のUser.id（cuid）解決が必要な場合はgetUserBySub()等、
  // 既存の認証フローに合わせて解決してください（todoServiceの認証パターンを参照）。
  const auth0UserId = session.user.sub;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "リクエストボディが不正です" }, { status: 400 });
  }

  const parsed = presignedUrlRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "リクエストが不正です", data: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { mimeType, fileSize } = parsed.data;

  const extension = MIME_TO_EXTENSION[mimeType];
  if (!extension) {
    // presignedUrlRequestSchemaのenumで既に絞られているため通常到達しないが、
    // 型安全のためのフォールバック
    return NextResponse.json({ message: "許可されていないファイル形式です" }, { status: 400 });
  }

  try {
    const storageKey = buildStorageKey(auth0UserId, randomUUID(), extension);
    const uploadUrl = await createPresignedPutUrl(storageKey, mimeType);

    return NextResponse.json({ uploadUrl, storageKey, fileSize });
  } catch (error) {
    console.error("presigned_url_generation_failed", error);
    return NextResponse.json({ message: "アップロードURLの発行に失敗しました" }, { status: 500 });
  }
}