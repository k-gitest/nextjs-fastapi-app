import type { TodoListFilters, TodoSortOrder } from "../types";

/**
 * TodoListFilters（Service契約、sortOrder: "asc"|"desc"）と
 * GraphQLのTodoListFilterInput（sortOrder: "ASC"|"DESC"）を相互変換するヘルパーです。
 * REST/GraphQL両方でこの変換ロジックが必要になるため、
 * Resolver側とServiceGraphQL側の両方から使えるよう独立したファイルにしています。
 */

// GraphQLのSortOrder enum値（大文字）
export type GqlSortOrder = "ASC" | "DESC";

export interface GqlTodoListFilterInput {
  sortOrder?: GqlSortOrder;
  completedOnly?: boolean;
  priority?: string;
}

// TodoListFilters（Service契約） → GraphQL variables.filter への変換。
// todoServiceGraphQL.getTodos が使用する。
export function toGqlFilterInput(filters: TodoListFilters): GqlTodoListFilterInput {
  return {
    sortOrder: filters.sortOrder === "asc" ? "ASC" : "DESC",
    completedOnly: filters.completedOnly,
    ...(filters.priority && { priority: filters.priority }),
  };
}

// GraphQL resolver引数（filter: TodoListFilterInput、省略可）→
// TodoListFilters（Service契約）への変換。todoQueryResolvers.todos が使用する。
export function fromGqlFilterInput(
  filter: GqlTodoListFilterInput | null | undefined,
): TodoListFilters {
  const sortOrder: TodoSortOrder = filter?.sortOrder === "ASC" ? "asc" : "desc";
  return {
    sortOrder,
    completedOnly: filter?.completedOnly ?? false,
    priority: (filter?.priority as TodoListFilters["priority"]) ?? undefined,
  };
}