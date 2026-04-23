import { gql } from "graphql-request";

/**
 * Todo基本フィールド（Django版から流用）
 * userEmail → 削除（Next.jsではAuth0で管理）
 */
export const TODO_FRAGMENT = gql`
  fragment TodoFields on TodoType {
    id
    todoTitle
    priority
    progress
    createdAt
    updatedAt
  }
`;