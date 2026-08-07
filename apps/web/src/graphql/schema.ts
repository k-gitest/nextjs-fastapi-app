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
import {
  albumQueryResolvers,
  albumMutationResolvers,
} from "./modules/albums/resolvers";

// module名を渡すだけでSDLを読み込めるヘルパー
const loadSchema = (moduleName: string) =>
  readFileSync(
    join(process.cwd(), `src/graphql/modules/${moduleName}/schema.graphql`),
    "utf-8"
  );

const todoSchema = loadSchema("todos");
const albumSchema = loadSchema("albums");

export const schema = createSchema({
  typeDefs: [todoSchema, albumSchema],
  resolvers: {
    Query: {
      ...todoQueryResolvers,
      ...albumQueryResolvers,
    },
    Mutation: {
      ...todoMutationResolvers,
      ...albumMutationResolvers,
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
    AlbumCreateResult: {
      __resolveType: (obj: { __typename?: string }) => obj.__typename ?? null,
    },
    AlbumUpdateResult: {
      __resolveType: (obj: { __typename?: string }) => obj.__typename ?? null,
    },
    AlbumDeleteResult: {
      __resolveType: (obj: { __typename?: string }) => obj.__typename ?? null,
    },
  },
});