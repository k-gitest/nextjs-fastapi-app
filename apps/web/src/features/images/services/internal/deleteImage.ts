import type { Prisma } from "@repo/db";
import { NotFoundError } from "@/errors/not-found-error";

type TransactionClient = Prisma.TransactionClient;

/**
 * Image削除の内部ドメインロジック。
 * imageService.ts / albumService.ts から共有される。
 * Route Handler・Hook・UIから直接importしないこと（services/internal/ の責務境界）。
 *
 * 所有権検証:
 * Image → Album → userId で判定する。
 *
 * albumId が null のImageはAlbum所有者を特定できないため、
 * 所有権検証に失敗し NotFoundError として扱う。
 * Todo.userId へのフォールバックは行わない
 * （Albumが所有権の唯一の起点であり、albumId=nullは所有権を証明できないため対象外）。
 *
 * TodoImageは明示的に削除しない。PrismaスキーマのonDelete Cascadeを
 * 唯一の削除経路とする。
 */
export const deleteImageInTransaction = async (
  tx: TransactionClient,
  imageId: string,
  userId: string,
): Promise<{ storageKey: string }> => {
  const image = await tx.image.findFirst({
    where: {
      id: imageId,
      album: { userId },
    },
    select: { storageKey: true },
  });

  if (!image) {
    throw new NotFoundError("Image not found or unauthorized");
  }

  await tx.image.delete({ where: { id: imageId } });

  return { storageKey: image.storageKey };
};