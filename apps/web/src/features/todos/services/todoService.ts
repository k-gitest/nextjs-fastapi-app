import { Priority } from "@repo/db";
import { prisma } from "@/lib/prisma";
import { CreateTodoInput, UpdateTodoInput, Todo, TodoWithImageSummaries } from "../types";
import { NotFoundError } from "@/errors/not-found-error";
import { ValidationError } from "@/errors/validation-error";
import { syncTodoImages } from "@/features/images/services/imageService";
import { cleanupDeletedStorageKeys } from "@/features/images/services/internal/storageCleanup";
import type { ImageListInput } from "@/features/images/schemas";
import { todoSchema, updateTodoSchema } from "../schemas";

export const todoService = {
  // 戻り値契約はREST/GraphQL両実装が共有するService契約であり、DBモデル
  // そのものではない。Prisma結果（userId・createdAt含む）は構造的部分型付けにより
  // TodoWithImageSummaries（狭い契約）を満たすため、実装側の変更は不要
  // （README.md「Service契約とTransport変換」参照）。
  getTodos: async (userId: string): Promise<TodoWithImageSummaries[]> => {
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
        id: ti.image.id,
        originalFileName: ti.image.originalFileName,
        mimeType: ti.image.mimeType,
        fileSize: ti.image.fileSize,
        order: ti.order,
      })),
    }));
  },

  createTodo: async (
    data: CreateTodoInput,
    correlationId: string,
    images?: ImageListInput,
  ): Promise<Todo> => {
    const normalized = {
      todo_title: data.todo_title,
      priority: data.priority ?? Priority.MEDIUM,
      progress: data.progress ?? 0,
    };

    const parsed = todoSchema.safeParse(normalized);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "入力内容に誤りがあります");
    }

    return await prisma.$transaction(async (tx) => {
      const todo = await tx.todo.create({
        data: { ...data, ...parsed.data },
      });

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

      if (images) {
        await syncTodoImages(tx, todo.id, images, todo.userId);
      }

      return todo;
    });
  },

  updateTodo: async (
    data: UpdateTodoInput,
    userId: string,
    correlationId: string,
    images?: ImageListInput,
  ): Promise<Todo> => {
    const { id, ...body } = data;

    const parsed = updateTodoSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "入力内容に誤りがあります");
    }

    let deletedStorageKeys: string[] = [];

    const todo = await prisma.$transaction(async (tx) => {
      const existing = await tx.todo.findFirst({
        where: { id, userId },
      });

      if (!existing) {
        throw new NotFoundError("Todo not found or unauthorized");
      }

      const updated = await tx.todo.update({
        where: { id },
        data: parsed.data,
      });

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
          idempotency_key: `analytics.todo_event:updated:${updated.id}:${updated.updatedAt.getTime()}`,
          next_retry_at: new Date(Date.now() + 100),
        },
      });

      if (images !== undefined) {
        deletedStorageKeys = await syncTodoImages(tx, updated.id, images, userId);
      }

      return updated;
    });

    if (deletedStorageKeys.length > 0) {
      await cleanupDeletedStorageKeys(deletedStorageKeys, { correlationId });
    }

    return todo;
  },

  deleteTodo: async (id: string, userId: string, correlationId: string): Promise<Todo> => {
    const todo = await prisma.$transaction(async (tx) => {
      const existing = await tx.todo.findFirst({
        where: { id, userId },
      });

      if (!existing) {
        throw new NotFoundError("Todo not found or unauthorized");
      }

      const deleted = await tx.todo.delete({ where: { id } });

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

    return todo;
  },

  getTodoStats: async (userId: string): Promise<Array<{ priority: Priority; count: number }>> => {
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

  getProgressStats: async (userId: string): Promise<Array<{ range: string; count: number }>> => {
    const todos = await prisma.todo.findMany({
      where: { userId },
      select: { progress: true },
    });

    return [
      { range: "0-20%", count: todos.filter((t) => t.progress <= 20).length },
      { range: "21-40%", count: todos.filter((t) => t.progress > 20 && t.progress <= 40).length },
      { range: "41-60%", count: todos.filter((t) => t.progress > 40 && t.progress <= 60).length },
      { range: "61-80%", count: todos.filter((t) => t.progress > 60 && t.progress <= 80).length },
      { range: "81-100%", count: todos.filter((t) => t.progress > 80).length },
    ];
  },
};

export type TodoStatsResponse = Awaited<ReturnType<typeof todoService.getTodoStats>>;
export type ProgressStatsResponse = Awaited<ReturnType<typeof todoService.getProgressStats>>;