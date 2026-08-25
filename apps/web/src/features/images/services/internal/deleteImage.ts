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
 *
 * B2削除はここでは行わない。Image DB削除と同一トランザクションで
 * outbox_events（image.storage_delete_requested）を書き込み、
 * Commit後にWorkerが非同期でB2 DeleteObjectを実行する
 * （Transaction + External I/O Patternに従い、外部I/OをTransaction外へ出す設計）。
 *
 * 戻り値を持たない（旧設計ではstorageKeyを呼び出し元へ返し、Commit後の
 * cleanupDeletedStorageKeys()呼び出しに使っていたが、Outbox化によりB2削除に
 * 必要な情報はoutbox_events.payloadへ完結させたため、呼び出し元は
 * Commit後に何もする必要がない）。
 */
export const deleteImageInTransaction = async (
  tx: TransactionClient,
  imageId: string,
  userId: string,
  correlationId: string,
): Promise<void> => {
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

  await tx.outbox_events.create({
    data: {
      aggregate_id: imageId,
      event_type: "image.storage_delete_requested",
      payload: {
        storage_key: image.storageKey,
        correlation_id: correlationId,
      },
      idempotency_key: `image.storage_delete_requested:${imageId}`,
    },
  });
};