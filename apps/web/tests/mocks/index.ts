import { authHandlers } from "./auth.handlers";
import { todoHandlers } from "./todo.handlers";
import { albumHandlers } from "./albums.handlers";

export const handlers = [
  ...authHandlers,
  ...todoHandlers,
  ...albumHandlers,
];