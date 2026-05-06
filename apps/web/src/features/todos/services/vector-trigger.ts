import { qstashClient } from "@/lib/qstash";
import type { Todo } from "@repo/db";
import { getFastapiPublicUrl } from "@/lib/constants";

export const triggerVectorUpsert = async (todo: Todo) => {
  await qstashClient.publishJSON({
    url: `${getFastapiPublicUrl()}/webhooks/vector-indexing`,
    body: {
      todo_id: todo.id,
      operation: "upsert",
      todo_title: todo.todo_title,
      priority: todo.priority,
      progress: todo.progress,
      user_id: todo.userId,
      created_at: todo.createdAt.toISOString(),
    },
  });
};

export const triggerVectorDelete = async (todoId: string) => {
  await qstashClient.publishJSON({
    url: `${getFastapiPublicUrl()}/webhooks/vector-indexing`,
    body: {
      todo_id: todoId,
      operation: "delete",
    },
  });
};