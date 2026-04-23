/**
 * GraphQLスキーマ統合
 *
 * Django版の schema.py に相当
 * 各モジュールのSDLとリゾルバーを統合する
 */
import { createSchema } from "graphql-yoga";
import { readFileSync } from "fs";
import { join } from "path";
import {
  todoQueryResolvers,
  todoMutationResolvers,
} from "./modules/todos/resolvers";

// SDL読み込み
const todoSchema = readFileSync(
  join(process.cwd(), "src/graphql/modules/todos/schema.graphql"),
  "utf-8"
);

export const schema = createSchema({
  typeDefs: todoSchema,
  resolvers: {
    Query: {
      ...todoQueryResolvers,
    },
    Mutation: {
      ...todoMutationResolvers,
    },
    // Union型の __resolveType
    TodoCreateResult: {
      __resolveType: (obj: { __typename?: string }) => obj.__typename ?? null,
    },
    TodoUpdateResult: {
      __resolveType: (obj: { __typename?: string }) => obj.__typename ?? null,
    },
    TodoDeleteResult: {
      __resolveType: (obj: { __typename?: string }) => obj.__typename ?? null,
    },
  },
});