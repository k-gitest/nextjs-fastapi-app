import { PrismaClient } from "@repo/db";

const prisma = new PrismaClient();

const FASTAPI_URL = process.env.FASTAPI_PUBLIC_URL;
const INTERNAL_TOKEN = process.env.INTERNAL_API_SECRET;

async function main() {
  if (!FASTAPI_URL || !INTERNAL_TOKEN) {
    console.error(
      "FASTAPI_PUBLIC_URL と INTERNAL_API_SECRET が必要です"
    );
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const userId = args[0];

  // ユーザー指定があれば1ユーザーのみ、なければ全ユーザー
  const where = userId ? { userId } : {};

  console.log(
    userId
      ? `[INFO] ユーザー ${userId} のTodoを再構築します`
      : "[INFO] 全ユーザーのTodoを再構築します"
  );

  // ユーザーごとにグループ化して送信
  const todos = await prisma.todo.findMany({
    where,
    select: {
      id: true,
      todo_title: true,
      priority: true,
      progress: true,
      userId: true,
      createdAt: true,
    },
  });

  if (todos.length === 0) {
    console.error("[ERROR] 対象Todoが存在しません");
    process.exit(1);
  }

  console.log(`[INFO] 対象Todo: ${todos.length} 件`);

  // ユーザーIDでグループ化
  const grouped = todos.reduce<Record<string, typeof todos>>(
    (acc, todo) => {
      if (!acc[todo.userId]) acc[todo.userId] = [];
      acc[todo.userId]!.push(todo);
      return acc;
    },
    {}
  );

  let successCount = 0;
  let errorCount = 0;

  for (const [uid, userTodos] of Object.entries(grouped)) {
    console.log(
      `[INFO] userId=${uid} の ${userTodos.length} 件を送信中...`
    );

    const payload = {
      user_id: uid,
      todos: userTodos.map((t) => ({
        todo_id: t.id,
        todo_title: t.todo_title,
        priority: t.priority,
        progress: t.progress,
        user_id: t.userId,
        created_at: t.createdAt.toISOString(),
      })),
    };

    try {
      const response = await fetch(
        `${FASTAPI_URL}/internal/rebuild-vector-index`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Internal-Token": INTERNAL_TOKEN,
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const text = await response.text();
        console.error(
          `[ERROR] userId=${uid} 送信失敗: ${response.status} ${text}`
        );
        errorCount++;
      } else {
        console.log(`[OK]  userId=${uid} 送信成功`);
        successCount++;
      }
    } catch (e) {
      console.error(
        `[ERROR] userId=${uid} ネットワークエラー: ${e instanceof Error ? e.message : String(e)}`
      );
      errorCount++;
    }
  }

  console.log(
    `[INFO] 完了: 成功=${successCount} 失敗=${errorCount}`
  );

  if (errorCount > 0) {
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });