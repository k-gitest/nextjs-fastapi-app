import type { TodoListFilters } from "../types";

// 一覧取得のfilters単位でキャッシュを分割する。
// invalidateQueries({ queryKey: TODO_QUERY_KEY }) は前方一致のため、
// todoQueryKey(filters) で生成した全filtersのキャッシュに対して
// 変更なく有効に機能する。
export const TODO_QUERY_KEY = ["todos"] as const;

export const todoQueryKey = (filters: TodoListFilters) =>
  [...TODO_QUERY_KEY, filters] as const;