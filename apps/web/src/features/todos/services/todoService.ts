// "use server" は付けない
// このファイルはServer Actions/Route Handler両方から呼ばれる純粋なDB操作層
import { prisma } from "@/lib/prisma";
//import { Priority } from "@prisma/client";
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
    return await prisma.todo.create({ data });
  },

  // 更新
  updateTodo: async (data: UpdateTodoInput) => {
    const { id, ...body } = data;
    return await prisma.todo.update({
      where: { id },
      data: body,
    });
  },

  // 削除
  deleteTodo: async (id: string) => {
    return await prisma.todo.delete({ where: { id } });
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