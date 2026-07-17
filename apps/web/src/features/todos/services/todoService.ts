// "use server" は付けない
// このファイルはServer Actions/Route Handler両方から呼ばれる純粋なDB操作層
import { prisma } from "@/lib/prisma";
import { CreateTodoInput, UpdateTodoInput } from "../types";
import { NotFoundError } from "@/errors/not-found-error";

export const todoService = {
  // 取得（DBのuserIdで絞り込み）
  getTodos: async (userId: string) => {
    return await prisma.todo.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  },

  // 作成
  createTodo: async (data: CreateTodoInput, correlationId: string) => {
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

      return todo;
    });
  },

  // 更新
  updateTodo: async (data: UpdateTodoInput, userId: string, correlationId: string) => {
    const { id, ...body } = data;

    return await prisma.$transaction(async (tx) => {
      const existing = await tx.todo.findFirst({
        where: { id, userId },
      });

      if (!existing) {
        throw new NotFoundError("Todo not found or unauthorized");
      }

      // 1. Todoの更新
      const todo = await tx.todo.update({
        where: { id },
        data: body,
      });

      // 2. Vector用Outboxイベント
      await tx.outbox_events.create({
        data: {
          aggregate_id: `todo:${todo.id}`,
          event_type: "todo.updated",
          event_version: 1,
          payload: {
            todo_id: todo.id,
            todo_title: todo.todo_title,
            priority: todo.priority,
            progress: todo.progress,
            user_id: userId,
            operation: "upsert",
            correlation_id: correlationId,
          },
          idempotency_key: `todo.updated:${todo.id}:${todo.updatedAt.getTime()}`,
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
              action: "updated",
              user_id: userId,
              todo_id: todo.id,
              priority: todo.priority,
              progress: todo.progress,
              timestamp: todo.updatedAt.toISOString(),
              correlation_id: correlationId,
            },
          },
          // updatedAtのミリ秒で同一Todoへの連続更新でもキーが衝突しない
          idempotency_key: `analytics.todo_event:updated:${todo.id}:${todo.updatedAt.getTime()}`,
          next_retry_at: new Date(Date.now() + 100),
        },
      });

      return todo;
    });
  },

  // 削除
  deleteTodo: async (id: string, userId: string, correlationId: string) => {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.todo.findFirst({
        where: { id, userId },
      });

      if (!existing) {
        throw new NotFoundError("Todo not found or unauthorized");
      }

      // 1. Todoの削除
      const todo = await tx.todo.delete({ where: { id } });

      // 2. Vector用Outboxイベント
      await tx.outbox_events.create({
        data: {
          aggregate_id: `todo:${todo.id}`,
          event_type: "todo.deleted",
          event_version: 1,
          payload: {
            todo_id: todo.id,
            todo_title: todo.todo_title, // 削除後はDB参照不可のため事前に含める
            user_id: userId,
            operation: "delete",
            correlation_id: correlationId,
          },
          idempotency_key: `todo.deleted:${todo.id}`,
          next_retry_at: new Date(Date.now() + 100),
        },
      });

      // 3. Analytics用Outboxイベント
      // 削除後はtodo参照不可のため削除前に取得済みのexistingから参照
      await tx.outbox_events.create({
        data: {
          aggregate_id: `todo:${todo.id}`,
          event_type: "analytics.todo_event",
          event_version: 1,
          payload: {
            event_type: "todo_event",
            event_data: {
              action: "deleted",
              user_id: userId,
              todo_id: todo.id,
              priority: existing.priority,
              progress: existing.progress,
              timestamp: new Date().toISOString(),
              correlation_id: correlationId,
            },
          },
          idempotency_key: `analytics.todo_event:deleted:${todo.id}`,
          next_retry_at: new Date(Date.now() + 100),
        },
      });

      return todo;
    });
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