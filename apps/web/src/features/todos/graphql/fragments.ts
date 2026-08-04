import { gql } from "graphql-request";

/**
 * Todo基本フィールド
 *
 * images は TodoImageType（schema.graphql参照）に対応する安全な部分集合のみを取得する。
 * storageKey・albumId等はGraphQL契約として最初から公開しない設計のため、
 * REST側（TodoImageDto = Image全フィールド）とは意図的にフィールド構成が異なる。
 */
export const TODO_FRAGMENT = gql`
  fragment TodoFields on TodoType {
    id
    todoTitle
    priority
    progress
    userId
    images {
      id
      originalFileName
      mimeType
      fileSize
      order
    }
    createdAt
    updatedAt
  }
`;