import { gql } from "graphql-request";
import { TODO_FRAGMENT } from "./fragments";

export const CREATE_TODO = gql`
  ${TODO_FRAGMENT}
  mutation CreateTodo($input: TodoCreateInput!, $correlationId: String!) {
    createTodo(input: $input, correlationId: $correlationId) {
      __typename
      ... on CreateTodoPayload {
        todo {
          ...TodoFields
        }
      }
      ... on ValidationError {
        message
        field
      }
      ... on InternalError {
        message
      }
    }
  }
`;

export const UPDATE_TODO = gql`
  ${TODO_FRAGMENT}
  mutation UpdateTodo($id: ID!, $input: TodoUpdateInput!, $correlationId: String!) {
    updateTodo(id: $id, input: $input, correlationId: $correlationId) {
      __typename
      ... on UpdateTodoPayload {
        todo {
          ...TodoFields
        }
      }
      ... on ValidationError {
        message
        field
      }
      ... on NotFoundError {
        message
      }
      ... on InternalError {
        message
      }
    }
  }
`;

export const DELETE_TODO = gql`
  ${TODO_FRAGMENT}
  mutation DeleteTodo($id: ID!, $correlationId: String!) {
    deleteTodo(id: $id, correlationId: $correlationId) {
      __typename
      ... on DeleteTodoPayload {
        todo {
          ...TodoFields
        }
        deletedId
        message
      }
      ... on NotFoundError {
        message
      }
      ... on InternalError {
        message
      }
    }
  }
`;