// "use server" は付けない
// このファイルはServer Actions/Route Handler両方から呼ばれる純粋なDB操作層
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";
import { CreateTodoInput, UpdateTodoInput } from "../types";

/*
export type CreateTodoInput = {
  todo_title: string;
  priority?: Priority;
  progress?: number;
  userId: string; // PrismaのUser.id（cuid）を渡す
};

export type UpdateTodoInput = {
  id: string;
  todo_title?: string;
  priority?: Priority;
  progress?: number;
};
*/

export const todoService = {
  // 取得（DBのuserIdで絞り込み）
  getTodos: async (userId: string) => {
    return await prisma.todo.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  },

  // 作成
  createTodo: async (data: CreateTodoInput) => {
    return await prisma.$transaction(async (tx) => {
      // 1. 本来の業務データ保存
      const todo = await tx.todo.create({ data });

      // 2. Outboxイベントの保存
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
          },
          idempotency_key: randomUUID(),
          // トランザクションのコミット遅延を考慮し、処理対象を100ms後にする
          next_retry_at: new Date(Date.now() + 100),
        },
      });

      return todo;
    });
  },

  // 更新
  // 💡 ポイント: 第2引数で userId を確実に受け取る
  updateTodo: async (data: UpdateTodoInput, userId: string) => {
    const { id, ...body } = data;

    return await prisma.$transaction(async (tx) => {
      // 1. Todoの更新
      const todo = await tx.todo.update({
        where: { id },
        data: body,
      });

      // 2. Outboxイベントの保存
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
            user_id: userId, // 💡 引数から渡された確実なIDを使用
          },
          idempotency_key: randomUUID(),
          next_retry_at: new Date(Date.now() + 100),
        },
      });

      return todo;
    });
  },

  // 削除
  // 💡 注意: 削除イベントにも user_id を含めるため、引数に userId を追加しています
  deleteTodo: async (id: string, userId: string) => {
    return await prisma.$transaction(async (tx) => {
      // 1. Todoの削除
      const todo = await tx.todo.delete({ where: { id } });

      // 2. Outboxイベントの保存
      await tx.outbox_events.create({
        data: {
          aggregate_id: `todo:${id}`,
          event_type: "todo.deleted",
          event_version: 1,
          payload: {
            todo_id: id,
            user_id: userId, // 削除されたTodoの所有者をFastAPI側へ伝える
          },
          idempotency_key: randomUUID(),
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
      { range: "0-20%", count: todos.filter((t) => t.progress <= 20).length },
      { range: "21-40%", count: todos.filter((t) => t.progress > 20 && t.progress <= 40).length },
      { range: "41-60%", count: todos.filter((t) => t.progress > 40 && t.progress <= 60).length },
      { range: "61-80%", count: todos.filter((t) => t.progress > 60 && t.progress <= 80).length },
      { range: "81-100%", count: todos.filter((t) => t.progress > 80).length },
    ];
  },
};




// フロントエンドで使うための「関数の戻り値の型」を抽出
export type TodoStatsResponse = Awaited<ReturnType<typeof todoService.getTodoStats>>;
export type ProgressStatsResponse = Awaited<ReturnType<typeof todoService.getProgressStats>>;