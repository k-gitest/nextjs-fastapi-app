import { authHandlers } from "./auth.handlers";
import { todoHandlers } from "./todo.handlers";

export const handlers = [
  ...authHandlers,
  ...todoHandlers,
];