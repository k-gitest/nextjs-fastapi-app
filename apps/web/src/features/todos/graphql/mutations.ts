import { gql } from "graphql-request";
import { TODO_FRAGMENT } from "./fragments";

export const CREATE_TODO = gql`
  ${TODO_FRAGMENT}
  mutation CreateTodo($input: TodoCreateInput!) {
    createTodo(input: $input) {
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
  mutation UpdateTodo($id: ID!, $input: TodoUpdateInput!) {
    updateTodo(id: $id, input: $input) {
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
  mutation DeleteTodo($id: ID!) {
    deleteTodo(id: $id) {
      __typename
      ... on DeleteTodoPayload {
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