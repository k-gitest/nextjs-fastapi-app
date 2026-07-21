import type { Prisma, Image } from "@repo/db";
import type { CreateImageInput } from "@/features/images/schemas";

type TransactionClient = Prisma.TransactionClient;

/**
 * Image作成の内部ドメインロジック。
 * imageService.ts（Image単体作成・applyImageChange双方）から共有される。
 * Route Handler・Hook・UIから直接importしないこと（services/internal/ の責務境界）。
 *
 * Image作成のSingle Entry Point。
 * albumId は呼び出し元が決める（Image単体作成APIからは常にnull、
 * Todo添付フローからはTodo保存時に指定されたalbumIdが渡る）。
 * userId は所有権の源泉として必須。
 */
export const createImageInTransaction = async (
  tx: TransactionClient,
  data: CreateImageInput,
  userId: string,
  albumId: string | null,
): Promise<Image> => {
  return await tx.image.create({
    data: {
      storageKey: data.storageKey,
      originalFileName: data.originalFileName,
      mimeType: data.mimeType,
      fileSize: data.fileSize,
      albumId,
      userId,
    },
  });
};