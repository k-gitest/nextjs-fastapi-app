// "use server" は付けない
// このファイルはServer Actions/Route Handler両方から呼ばれる純粋なDB操作層
import { prisma } from "@/lib/prisma";
import { CreateTodoInput, UpdateTodoInput } from "../types";
import { NotFoundError } from "@/errors/not-found-error";
import { applyImageChange, cleanupDeletedStorageKeys, compensateFailedUpload } from "@/features/images/services/imageService";
import type { ImageInput } from "@/features/images/schemas";

export const todoService = {
  // 取得（DBのuserIdで絞り込み）
  // images を include して一覧表示でサムネイルを出せるようにする
  getTodos: async (userId: string) => {
    return await prisma.todo.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { images: true },
    });
  },

  // 作成
  // image: 添付する画像（未添付の場合は省略可）。作成時は「削除」の概念がないため null は渡さない想定。
  createTodo: async (data: CreateTodoInput, correlationId: string, image?: ImageInput) => {
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
        if (image) {
          await applyImageChange(tx, todo.id, image);
        }

        return todo;
      });
    } catch (error) {
      // Todo作成トランザクションが失敗した場合、新規アップロード済みのB2オブジェクトを補償削除する
      await compensateFailedUpload(image, { correlationId });
      throw error;
    }
  },

  // 更新
  // image: undefined=画像に関する変更なし / null=削除のみ / object=添付・差し替え
  updateTodo: async (data: UpdateTodoInput, userId: string, correlationId: string, image?: ImageInput) => {
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

        // 4. 画像の添付・差し替え・削除（imageがundefinedなら変更なし）
        if (image !== undefined) {
          deletedStorageKeys = await applyImageChange(tx, updated.id, image);
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
      // （差し替え対象だった旧画像はロールバックされ元のまま残るため触らない）
      await compensateFailedUpload(image, { correlationId });
      throw error;
    }
  },

  // 削除
  deleteTodo: async (id: string, userId: string, correlationId: string) => {
    let deletedStorageKeys: string[] = [];

    const todo = await prisma.$transaction(async (tx) => {
      // images を含めて取得し、削除前にB2クリーンアップ対象のstorageKeyを確保しておく
      // （Todo削除でImage行はCascadeされるが、B2上の実ファイルは別途消す必要があるため）
      const existing = await tx.todo.findFirst({
        where: { id, userId },
        include: { images: true },
      });

      if (!existing) {
        throw new NotFoundError("Todo not found or unauthorized");
      }

      deletedStorageKeys = existing.images.map((image) => image.storageKey);

      // 1. Todoの削除（Imageは onDelete: Cascade でDB上は自動削除される）
      const deleted = await tx.todo.delete({ where: { id } });

      // 2. Vector用Outboxイベント
      await tx.outbox_events.create({
        data: {
          aggregate_id: `todo:${deleted.id}`,
          event_type: "todo.deleted",
          event_version: 1,
          payload: {
            todo_id: deleted.id,
            todo_title: deleted.todo_title, // 削除後はDB参照不可のため事前に含める
            user_id: userId,
            operation: "delete",
            correlation_id: correlationId,
          },
          idempotency_key: `todo.deleted:${deleted.id}`,
          next_retry_at: new Date(Date.now() + 100),
        },
      });

      // 3. Analytics用Outboxイベント
      // 削除後はtodo参照不可のため削除前に取得済みのexistingから参照
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

    // トランザクション成功後、Todoに紐づいていたB2オブジェクトを実削除
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