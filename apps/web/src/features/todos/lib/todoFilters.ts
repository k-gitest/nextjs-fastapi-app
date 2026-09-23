import type { Priority } from "@repo/db";
import type { TodoListFilters } from "../types";

/**
 * Todoが指定されたfiltersの表示条件に合致するかを判定する。
 *
 * useUpdateTodoの楽観的更新で、更新後のTodoが表示中のfiltersに
 * 合致し続けるかを判定するために使う（合致しなくなった場合は
 * 一覧から除外する。例: completedOnly表示中に未完了へ戻した場合）。
 */
export function matchesTodoFilters(
  todo: { priority: Priority; progress: number },
  filters: TodoListFilters,
): boolean {
  if (filters.completedOnly && todo.progress !== 100) return false;
  if (filters.priority && todo.priority !== filters.priority) return false;
  return true;
}