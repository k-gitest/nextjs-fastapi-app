import { Prisma } from "@repo/db";
import type { Image } from "@repo/db";
import type { CreateImageInput } from "@/features/images/schemas";
import { ConflictError } from "@/errors/conflict-error";

type TransactionClient = Prisma.TransactionClient;

/**
 * Image作成の内部ドメインロジック。
 * imageService.ts（Image単体作成）から共有される。
 * Route Handler・Hook・UIから直接importしないこと（services/internal/ の責務境界）。
 *
 * Image作成のSingle Entry Point。
 * albumId は呼び出し元が決める（現状、Image単体作成APIからは常にnullが渡る。
 * Album所属の変更はAlbum画面のPATCHから行う設計のため、Todo保存フローからは
 * このalbumId引数は使われない）。
 * userId は所有権の源泉として必須。
 * 
 * storageKeyはDBレベルで@unique制約を持つ。クライアントが既存の（自分または他人の）
 * storageKeyを申告した場合、Prismaが P2002 を投げるため ConflictError に変換して
 * 呼び出し元（Route Handler）に409として扱わせる。
 */
export const createImageInTransaction = async (
  tx: TransactionClient,
  data: CreateImageInput,
  userId: string,
  albumId: string | null,
): Promise<Image> => {
  try {
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
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictError("この画像は既に登録されています");
    }
    throw error;
  }
};