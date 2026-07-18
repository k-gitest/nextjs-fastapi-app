import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from "@/lib/auth0";
import { prisma } from "@/lib/prisma";
import { createPresignedGetUrl } from "@/lib/b2";
import { logServiceError } from "@/lib/server-logger";
// NOTE: 既存の認証フロー（auth0.getSession() → getUserBySub() → Prisma User.id）に
// 合わせて、実際のヘルパー名・パスに置き換えてください。
import { getUserBySub } from "@/features/auth/services/userService";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest, 
  { params }: { params: Promise<{ id: string }> } 
) {
  const { id } = await params;

  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    return NextResponse.json({ message: "認証が必要です" }, { status: 401 });
  }

  const user = await getUserBySub(session.user.sub);
  if (!user) {
    return NextResponse.json({ message: "ユーザーが見つかりません" }, { status: 401 });
  }

  // 所有権確認: Imageは必ずTodo経由でuserIdと紐づく（存在有無を秘匿するため404で統一）
  const image = await prisma.image.findFirst({
    where: {
      id: id,
      OR: [
        { album: { userId: user.id } },
        { todoImages: { some: { todo: { userId: user.id } } } },
      ],
    },
    select: { storageKey: true },
  });

  if (!image) {
    return NextResponse.json({ message: "画像が見つかりません" }, { status: 404 });
  }

  try {
    const url = await createPresignedGetUrl(image.storageKey);
    return NextResponse.redirect(url, { status: 302 });
  } catch (error) {
    logServiceError(error instanceof Error ? error : new Error(String(error)), {
      component: "image-presigned-get-url",
      context: { image_id: id, user_id: user.id },
    });
    return NextResponse.json({ message: "画像の取得に失敗しました" }, { status: 500 });
  }
}