/**
 * Todo サービス切り替えスイッチ
 *
 * Django版の todo-service/index.ts から移植
 *
 * true にしたメソッドは GraphQL（/api/graphql 経由）
 * false にしたメソッドは REST（/api/todos 経由・Prisma直接）
 *
 * フック層・UI層はこのファイルをインポートするだけで
 * REST/GraphQLを意識せずに使用できる
 */
import { todoService as rest } from "./todoService";
import { todoServiceGraphQL as graphql } from "./todoServiceGraphQL";

const useGraphQL = {
  getTodos: true,
  createTodo: true,
  updateTodo: true,
  deleteTodo: true,
  getTodoStats: true,
  getProgressStats: true,
};

export const todoService = {
  getTodos: useGraphQL.getTodos ? graphql.getTodos : rest.getTodos,
  createTodo: useGraphQL.createTodo ? graphql.createTodo : rest.createTodo,
  updateTodo: useGraphQL.updateTodo ? graphql.updateTodo : rest.updateTodo,
  deleteTodo: useGraphQL.deleteTodo ? graphql.deleteTodo : rest.deleteTodo,
  getTodoStats: useGraphQL.getTodoStats ? graphql.getTodoStats : rest.getTodoStats,
  getProgressStats: useGraphQL.getProgressStats
    ? graphql.getProgressStats
    : rest.getProgressStats,
};