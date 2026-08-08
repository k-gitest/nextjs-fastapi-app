import { gql } from "graphql-request";
import { TODO_FRAGMENT } from "./fragments";

export const GET_TODOS = gql`
  ${TODO_FRAGMENT}
  query GetTodos {
    todos {
      ...TodoFields
    }
  }
`;

export const GET_TODO_STATS = gql`
  query GetTodoStats {
    priorityStats {
      priority
      count
    }
  }
`;

export const GET_PROGRESS_STATS = gql`
  query GetProgressStats {
    progressStats {
      range020
      range2140
      range4160
      range6180
      range81100
    }
  }
`;

export const SEARCH_TODOS = gql`
  query SearchTodos($input: TodoSearchInput!) {
    searchTodos(input: $input) {
      id
      todoTitle
      priority
      progress
      score
    }
  }
`;