// "use server" は付けない
// このファイルはServer Actions/Route Handler両方から呼ばれる純粋なDB操作層
import { prisma } from "@/lib/prisma";
import { CreateTodoInput, UpdateTodoInput } from "../types";
import { NotFoundError } from "@/errors/not-found-error";
import { applyImageChange, cleanupDeletedStorageKeys, compensateFailedUpload } from "@/features/images/services/imageService";
import type { ImageListInput, CreateImageListInput, ImageSlotInput } from "@/features/images/schemas";

export const todoService = {
  // 取得（DBのuserIdで絞り込み）
  // Phase3-2以降、Todo-Image関係はTodoImage中間テーブル経由になったが、
  // 呼び出し側（Route Handler・フロント）への影響を避けるため、
  // 戻り値の形は Phase2 までと同じ `images: Image[]` を維持する（DTO変換）。
  // 内部実装の切り替えが呼び出し側に波及しないようにするための変換層。
  getTodos: async (userId: string) => {
    const todos = await prisma.todo.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        todoImages: {
          orderBy: { order: "asc" },
          include: { image: true },
        },
      },
    });

    return todos.map(({ todoImages, ...todo }) => ({
      ...todo,
      images: todoImages.map((ti) => ({
        ...ti.image,
        order: ti.order,
      })),
    }));
  },

  // 作成
  // images: 添付する画像（未添付の場合は省略可）。作成時は「既存画像」の概念がないため
  // CreateImageListInput（kind:"new"のみ）を受け取る。
  // albumId: Todo単位で選択されたAlbum（null=未所属のまま保存）。添付する全Imageへ
  //          一括適用する（applyImageChange側で設定）。デフォルト引数によりundefinedもnullへ
  //          正規化される（Route Handler側でbody.albumIdが未指定の場合もnullとして扱うため）。
  createTodo: async (
    data: CreateTodoInput,
    correlationId: string,
    images?: CreateImageListInput,
    albumId: string | null = null,
  ) => {
    try {
      return await prisma.$transaction(async (tx) => {
        // 1. 本来の業務データ保存
        const todo = await tx.todo.create({ data });

        // 2. Vector用Outboxイベント
        await tx.outbox_events.create({
          data: {
            aggregate_id: `todo:${todo.id}`,
            event_type: "todo.created",
            event_version: 1,
            payload: {
              todo_id: todo.id,
              todo_title: todo.todo_title,
              priority: todo.priority,
              progress: todo.progress,
              user_id: todo.userId,
              operation: "upsert",
              correlation_id: correlationId,
            },
            idempotency_key: `todo.created:${todo.id}`,
            next_retry_at: new Date(Date.now() + 100),
          },
        });

        // 3. Analytics用Outboxイベント
        await tx.outbox_events.create({
          data: {
            aggregate_id: `todo:${todo.id}`,
            event_type: "analytics.todo_event",
            event_version: 1,
            payload: {
              event_type: "todo_event",
              event_data: {
                action: "created",
                user_id: todo.userId,
                todo_id: todo.id,
                priority: todo.priority,
                progress: todo.progress,
                timestamp: todo.createdAt.toISOString(),
                correlation_id: correlationId,
              },
            },
            idempotency_key: `analytics.todo_event:created:${todo.id}`,
            next_retry_at: new Date(Date.now() + 100),
          },
        });

        // 4. 画像の添付（あれば）
        // CreateImageListInputはImageListInputの部分型（kind:"new"のみ）なので、
        // applyImageChangeへそのまま渡せる。albumIdはtodo.userIdで所有権検証する。
        if (images) {
          await applyImageChange(tx, todo.id, images, { albumId, userId: todo.userId });
        }

        return todo;
      });
    } catch (error) {
      // Todo作成トランザクションが失敗した場合、新規アップロード済みのB2オブジェクトを補償削除する
      await compensateFailedUpload(images, { correlationId });
      throw error;
    }
  },

  // 更新
  // images: undefined=画像に関する変更なし / 配列=保存後の最終状態（existing/new混在、空配列で全削除）
  // albumId: Todo単位で選択されたAlbum（null=未所属のまま保存）。デフォルト引数によりundefinedも
  //          nullへ正規化される。
  updateTodo: async (
    data: UpdateTodoInput,
    userId: string,
    correlationId: string,
    images?: ImageListInput,
    albumId: string | null = null,
  ) => {
    const { id, ...body } = data;
    let deletedStorageKeys: string[] = [];

    try {
      const todo = await prisma.$transaction(async (tx) => {
        const existing = await tx.todo.findFirst({
          where: { id, userId },
        });

        if (!existing) {
          throw new NotFoundError("Todo not found or unauthorized");
        }

        // 1. Todoの更新
        const updated = await tx.todo.update({
          where: { id },
          data: body,
        });

        // 2. Vector用Outboxイベント
        await tx.outbox_events.create({
          data: {
            aggregate_id: `todo:${updated.id}`,
            event_type: "todo.updated",
            event_version: 1,
            payload: {
              todo_id: updated.id,
              todo_title: updated.todo_title,
              priority: updated.priority,
              progress: updated.progress,
              user_id: userId,
              operation: "upsert",
              correlation_id: correlationId,
            },
            idempotency_key: `todo.updated:${updated.id}:${updated.updatedAt.getTime()}`,
            next_retry_at: new Date(Date.now() + 100),
          },
        });

        // 3. Analytics用Outboxイベント
        await tx.outbox_events.create({
          data: {
            aggregate_id: `todo:${updated.id}`,
            event_type: "analytics.todo_event",
            event_version: 1,
            payload: {
              event_type: "todo_event",
              event_data: {
                action: "updated",
                user_id: userId,
                todo_id: updated.id,
                priority: updated.priority,
                progress: updated.progress,
                timestamp: updated.updatedAt.toISOString(),
                correlation_id: correlationId,
              },
            },
            // updatedAtのミリ秒で同一Todoへの連続更新でもキーが衝突しない
            idempotency_key: `analytics.todo_event:updated:${updated.id}:${updated.updatedAt.getTime()}`,
            next_retry_at: new Date(Date.now() + 100),
          },
        });

        // 4. 画像の追加・削除・並び替え・Album適用（imagesがundefinedなら変更なし）
        if (images !== undefined) {
          deletedStorageKeys = await applyImageChange(tx, updated.id, images, { albumId, userId });
        }

        return updated;
      });

      // トランザクション成功後、不要になった旧B2オブジェクトを実削除
      if (deletedStorageKeys.length > 0) {
        await cleanupDeletedStorageKeys(deletedStorageKeys, { correlationId });
      }

      return todo;
    } catch (error) {
      // トランザクション失敗時、新規アップロード済みのB2オブジェクトを補償削除する
      // （差し替え・維持対象だった既存画像はロールバックされ元のまま残るため触らない。
      //   images（existing+new混在）から new のみを抽出して渡す。
      //   compensateFailedUploadはCreateImageListInput専用のため、ここでfilterする）
      await compensateFailedUpload(
        images?.filter(
          (slot): slot is Extract<ImageSlotInput, { kind: "new" }> => slot.kind === "new",
        ),
        { correlationId },
      );
      throw error;
    }
  },

  // 削除
  deleteTodo: async (id: string, userId: string, correlationId: string) => {
    let deletedStorageKeys: string[] = [];

    const todo = await prisma.$transaction(async (tx) => {
      // todoImages経由でimageをjoinして取得し、削除前にB2クリーンアップ対象のstorageKeyを
      // 確保しておく（Todo削除でTodoImage行はCascadeされるが、Image本体・B2上の実ファイルは
      // 別途消す必要があるため）。Todo削除時はImage本体・B2実ファイルも削除する
      // （Phase2から継続している仕様）。
      const existing = await tx.todo.findFirst({
        where: { id, userId },
        include: { todoImages: { include: { image: true } } },
      });

      if (!existing) {
        throw new NotFoundError("Todo not found or unauthorized");
      }

      deletedStorageKeys = existing.todoImages.map((ti) => ti.image.storageKey);

      // 1. Todoの削除（TodoImageは onDelete: Cascade でDB上は自動削除される。
      //    Image本体はTodoImage経由では削除されない設計のため、B2クリーンアップのみ別途行う）
      const deleted = await tx.todo.delete({ where: { id } });

      // 2. Vector用Outboxイベント
      await tx.outbox_events.create({
        data: {
          aggregate_id: `todo:${deleted.id}`,
          event_type: "todo.deleted",
          event_version: 1,
          payload: {
            todo_id: deleted.id,
            todo_title: deleted.todo_title,
            user_id: userId,
            operation: "delete",
            correlation_id: correlationId,
          },
          idempotency_key: `todo.deleted:${deleted.id}`,
          next_retry_at: new Date(Date.now() + 100),
        },
      });

      // 3. Analytics用Outboxイベント
      await tx.outbox_events.create({
        data: {
          aggregate_id: `todo:${deleted.id}`,
          event_type: "analytics.todo_event",
          event_version: 1,
          payload: {
            event_type: "todo_event",
            event_data: {
              action: "deleted",
              user_id: userId,
              todo_id: deleted.id,
              priority: existing.priority,
              progress: existing.progress,
              timestamp: new Date().toISOString(),
              correlation_id: correlationId,
            },
          },
          idempotency_key: `analytics.todo_event:deleted:${deleted.id}`,
          next_retry_at: new Date(Date.now() + 100),
        },
      });

      return deleted;
    });

    if (deletedStorageKeys.length > 0) {
      await cleanupDeletedStorageKeys(deletedStorageKeys, { correlationId, todoId: id });
    }

    return todo;
  },

  // 優先度別統計
  getTodoStats: async (userId: string) => {
    const stats = await prisma.todo.groupBy({
      by: ["priority"],
      where: { userId },
      _count: { priority: true },
    });
    return stats.map((s) => ({
      priority: s.priority,
      count: s._count.priority,
    }));
  },

  // 進捗分布統計（20%刻み）
  getProgressStats: async (userId: string) => {
    const todos = await prisma.todo.findMany({
      where: { userId },
      select: { progress: true },
    });
    return [
      { range: "0-20%",   count: todos.filter((t) => t.progress <= 20).length },
      { range: "21-40%",  count: todos.filter((t) => t.progress > 20 && t.progress <= 40).length },
      { range: "41-60%",  count: todos.filter((t) => t.progress > 40 && t.progress <= 60).length },
      { range: "61-80%",  count: todos.filter((t) => t.progress > 60 && t.progress <= 80).length },
      { range: "81-100%", count: todos.filter((t) => t.progress > 80).length },
    ];
  },
};

// フロントエンドで使うための「関数の戻り値の型」を抽出
export type TodoStatsResponse = Awaited<ReturnType<typeof todoService.getTodoStats>>;
export type ProgressStatsResponse = Awaited<ReturnType<typeof todoService.getProgressStats>>;