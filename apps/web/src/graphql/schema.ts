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

// module名を渡すだけでSDLを読み込めるヘルパー
const loadSchema = (moduleName: string) =>
  readFileSync(
    join(process.cwd(), `src/graphql/modules/${moduleName}/schema.graphql`),
    "utf-8"
  );

const todoSchema = loadSchema("todos");

export const schema = createSchema({
  typeDefs: [todoSchema],
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