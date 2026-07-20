import type { Prisma } from "@repo/db";
import { NotFoundError } from "@/errors/not-found-error";

type TransactionClient = Prisma.TransactionClient;

/**
 * Image削除の内部ドメインロジック。
 * imageService.ts / albumService.ts から共有される。
 * Route Handler・Hook・UIから直接importしないこと（services/internal/ の責務境界）。
 *
 * 所有権検証:
 * Image.userId で直接判定する（Albumを経由しない）。
 *
 * albumId が null（未所属）のImageも Image.userId により所有権を判定できる。
 * Album は分類の責務のみを持ち、所有権は持たない
 * （詳細はREADME.mdの「Image Ownership Principle」参照）。
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
      userId,
    },
    select: { storageKey: true },
  });

  if (!image) {
    throw new NotFoundError("Image not found or unauthorized");
  }

  await tx.image.delete({ where: { id: imageId } });

  return { storageKey: image.storageKey };
};