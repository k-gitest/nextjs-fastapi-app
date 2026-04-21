import { prisma } from "@/lib/prisma";
import { qstashClient } from "@/lib/qstash";
import { WEBHOOK_ENDPOINTS } from "@/lib/constants";

/**
 * Auth0のsub（例: auth0|xxx）からDBのUserを取得または作成
 * Route Handler / Server Action / layout.tsx から呼ぶ
 *
 * @returns Prisma User（DBのid=cuidを持つ）
 */
export async function syncUser({
  sub,
  email,
  name,
}: {
  sub: string;
  email: string;
  name?: string | null;
}) {
  // 1. 既存ユーザーの確認
  const existingUser = await getUserBySub(sub);

  // 2. ユーザーの保存 (upsert)
  const user = await prisma.user.upsert({
    where: { auth0Id: sub },
    update: { email, name: name ?? null },
    create: { auth0Id: sub, email, name: name ?? null },
  });

  // 3. 初回登録時のみ QStash にメッセージを送信
  if (!existingUser) {
    await publishWelcomeEmail(user.email, user.name);
  }

  return user;
}

/**
 * Auth0のsubからDBのUserを取得（存在しない場合はnull）
 */
export async function getUserBySub(sub: string) {
  return await prisma.user.findUnique({
    where: { auth0Id: sub },
  });
}

/**
 * QStashへのパブリッシュを分離しておくと、
 * 管理画面からの「手動再送」などでも使い回せて便利
 */
async function publishWelcomeEmail(email: string, name: string | null) {
  try {
    await qstashClient.publishJSON({
      url: WEBHOOK_ENDPOINTS.WELCOME_EMAIL,
      body: { email, first_name: name || "User" },
    });
  } catch (e) {
    console.error("QStash Publish Error:", e);
  }
}
