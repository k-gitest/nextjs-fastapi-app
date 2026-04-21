import { qstashClient } from "@/lib/qstash";
import type { Todo } from "@prisma/client";
import { WEBHOOK_ENDPOINTS } from "@/lib/constants"

const FASTAPI_PUBLIC_URL = process.env.FASTAPI_PUBLIC_URL!;

export const triggerVectorUpsert = async (todo: Todo) => {
  await qstashClient.publishJSON({
    url: `${FASTAPI_PUBLIC_URL}/webhooks/vector-indexing`,
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
    url: WEBHOOK_ENDPOINTS.VECTOR_INDEXING,
    body: {
      todo_id: todoId,
      operation: "delete",
    },
  });
};