import { prisma, Prisma } from "@/lib/prisma";

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
  return await prisma.$transaction(async (tx) => {
    let isNewUser = false;

    let user;

    try {
      user = await tx.user.create({
        data: {
          auth0Id: sub,
          email,
          name: name ?? null,
        },
      });

      isNewUser = true;
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        user = await tx.user.update({
          where: { auth0Id: sub },
          data: {
            email,
            name: name ?? null,
          },
        });
      } else {
        throw error;
      }
    }

    if (isNewUser) {
      await tx.outbox_events.create({
        data: {
          aggregate_id: `user:${user.id}`,
          event_type: "user.registered",
          event_version: 1,
          payload: {
            id: user.id,
            auth0Id: user.auth0Id,
            email: user.email,
            name: user.name,
          },

          idempotency_key: `user.registered:${user.id}`,

          next_retry_at: new Date(Date.now() + 100),
        },
      });
    }

    return user;
  });
}

/**
 * Auth0のsubからDBのUserを取得（存在しない場合はnull）
 */
export async function getUserBySub(sub: string) {
  return await prisma.user.findUnique({
    where: { auth0Id: sub },
  });
}
