import type { Prisma } from "@repo/db";
import { deleteB2Object } from "@/lib/b2";
import { logServiceError } from "@/lib/server-logger";
import { ValidationError } from "@/errors/validation-error";
import {
  MAX_IMAGES_PER_TODO,
  MAX_TOTAL_IMAGE_SIZE_BYTES,
  type ImageListInput,
  type CreateImageListInput,
} from "@/features/images/schemas";

// Prisma標準の型を使う（将来Prismaが$metrics等を追加しても自動で追従する）
type TransactionClient = Prisma.TransactionClient;

/**
 * Todo作成/更新のPrismaトランザクション内から呼び出すヘルパー。
 * todoService.createTodo / updateTodo の $transaction ブロック内から呼ぶ。
 *
 * images の意味:
 *   undefined = 画像に関する変更なし（呼び出し不要だが、呼ばれても何もしない）
 *   配列      = 保存後の最終状態そのもの。配列のindexがそのままorderになる。
 *               既存Imageのうち配列に含まれないものは削除される（空配列 = 全削除）。
 *
 * この関数が行う差分適用は「削除・追加・並び順更新」の3種類。
 *   削除:     配列に含まれない既存Imageをdeleteする
 *   追加:     kind:"new"の要素をcreateする
 *   並び順更新: kind:"existing"の要素は、配列内のindexに合わせてorderをupdateする
 *              （内容自体は変わらないためcreate/deleteは発生しない）
 *
 * 所有権検証・合計サイズ検証・枚数検証は、この関数内でDBから取得した
 * 現在のImage一覧（existingImages）を使い回して一括で行う。
 * Route Handler側で重複してDBを参照する必要はない。
 *
 * 戻り値の deletedStorageKeys は、トランザクション成功後に
 * 呼び出し側でB2から実削除する対象キー（差し替え・削除で不要になった旧ファイル）。
 *
 * この関数は todoService 内の Prisma $transaction ブロックからのみ呼び出す想定。
 * Route Handlerから直接利用しない（UI → hook → service → Prisma の責務分離を維持するため）。
 */
export const applyImageChange = async (
  tx: TransactionClient,
  todoId: string,
  images: ImageListInput,
): Promise<string[]> => {
  if (images === undefined) {
    return [];
  }

  // 枚数検証。Zod側の.max(MAX_IMAGES_PER_TODO)でも弾けるが、
  // 「クライアント申告値を信用しない」方針のためサーバー側でも二重に確認する。
  if (images.length > MAX_IMAGES_PER_TODO) {
    throw new ValidationError(`添付できる画像は最大${MAX_IMAGES_PER_TODO}枚です`);
  }

  // 1. 現在のDB状態を取得（このデータセットを所有権確認・サイズ検証・差分計算すべてに使い回す）
  const existingImages = await tx.image.findMany({ where: { todoId } });
  const existingById = new Map(existingImages.map((img) => [img.id, img]));

  // 2. 所有権検証：existing.idが本当にこのtodoIdに属するか
  //    複数添付化で初めてクライアントが既存Image.idを送るようになったため、
  //    他Todo/他ユーザーのIDが紛れ込んでいないことをここで必ず確認する。
  const existingIdsInRequest: string[] = [];
  for (const slot of images) {
    if (slot.kind === "existing") {
      if (!existingById.has(slot.id)) {
        throw new ValidationError("不正な画像が指定されました");
      }
      existingIdsInRequest.push(slot.id);
    }
  }

  // 同一existing.idが複数回指定されていないか確認する。
  // UI操作では起きない想定だが、「クライアント申告値は信用しない」方針のため
  // API単体でも不正な入力（同じ画像を2回updateしようとする等）を弾いておく。
  if (new Set(existingIdsInRequest).size !== existingIdsInRequest.length) {
    throw new ValidationError("同じ画像が複数回指定されています");
  }

  // 3. 合計サイズ検証（残す既存 + 新規追加分）
  const totalSize = images.reduce((sum, slot) => {
    if (slot.kind === "existing") {
      return sum + (existingById.get(slot.id)?.fileSize ?? 0);
    }
    return sum + slot.data.fileSize;
  }, 0);
  if (totalSize > MAX_TOTAL_IMAGE_SIZE_BYTES) {
    throw new ValidationError("画像の合計サイズが上限を超えています");
  }

  // 4. 差分計算・適用
  const keepIds = new Set(
    images.filter((s) => s.kind === "existing").map((s) => s.id),
  );
  const toDelete = existingImages.filter((img) => !keepIds.has(img.id));
  const deletedStorageKeys = toDelete.map((img) => img.storageKey);

  if (toDelete.length > 0) {
    await tx.image.deleteMany({ where: { id: { in: toDelete.map((i) => i.id) } } });
  }

  // update（既存のorder更新）とcreate（新規追加）は互いに依存しないため並列実行する。
  // delete対象はkeepIdsで事前に除外済みなので、更新対象と削除対象が競合することはない。
  // order は入力配列（images）のindexから決定されるため、
  // update/createの実行順序そのものには依存しない。
  // （将来coverImage・primaryImageのような「順序自体に業務的な意味を持つ」概念を
  //   追加する場合は、この非依存性の前提が崩れないか改めて確認すること）
  await Promise.all(
    images.map((slot, index) => {
      if (slot.kind === "existing") {
        return tx.image.update({ where: { id: slot.id }, data: { order: index } });
      }
      return tx.image.create({
        data: {
          todoId,
          order: index,
          storageKey: slot.data.storageKey,
          originalFileName: slot.data.originalFileName,
          mimeType: slot.data.mimeType,
          fileSize: slot.data.fileSize,
        },
      });
    }),
  );

  return deletedStorageKeys;
};

/**
 * トランザクション成功後、不要になったB2オブジェクトを削除する。
 * ここでの失敗はTodo保存自体には影響させない（ログのみ。Phase2でQStash委譲を検討）。
 */
export const cleanupDeletedStorageKeys = async (
  storageKeys: string[],
  context: { correlationId: string; todoId?: string },
): Promise<void> => {
  await Promise.all(
    storageKeys.map(async (key) => {
      try {
        await deleteB2Object(key);
      } catch (error) {
        logServiceError(error instanceof Error ? error : new Error(String(error)), {
          component: "image-cleanup",
          correlationId: context.correlationId,
          context: {
            storage_key: key,
            ...(context.todoId ? { todo_id: context.todoId } : {}),
          },
        });
      }
    }),
  );
};

/**
 * Todo保存トランザクションが失敗した場合の補償処理。
 * 削除対象は「今回新規アップロードした分」のみ。
 *
 * 引数を CreateImageListInput（kind:"new"のみを許容する型）に絞ることで、
 * 「existingは絶対に削除対象にならない」という制約をコメントだけでなく型でも表現する。
 * update失敗時であっても、ロールバックでexisting分のDB状態はそのまま残るため、
 * 呼び出し側は images のうち kind:"new" の要素だけを抽出して渡すこと。
 *
 * この時点では新規Todoの場合DBに存在しないため todoId は渡さない。
 */
export const compensateFailedUpload = async (
  images: CreateImageListInput,
  context: { correlationId: string },
): Promise<void> => {
  if (!images) {
    return;
  }

  await Promise.all(
    images.map(async (slot) => {
      try {
        await deleteB2Object(slot.data.storageKey);
      } catch (error) {
        logServiceError(error instanceof Error ? error : new Error(String(error)), {
          component: "image-cleanup",
          correlationId: context.correlationId,
          context: { storage_key: slot.data.storageKey },
        });
      }
    }),
  );
};