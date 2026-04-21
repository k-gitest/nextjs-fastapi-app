import { http, HttpResponse } from 'msw'

export const todoHandlers = [
  // Todo一覧
  http.get("*/api/todos", () => {
    return HttpResponse.json([
      {
        id: "clx1234",
        todo_title: "テストタスク1",
        priority: "HIGH",
        progress: 50,
        userId: "user1",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);
  }),

  http.post("*/api/todos", () => {
    return HttpResponse.json(
      { id: "clxnew", todo_title: "新しいタスク", priority: "MEDIUM", progress: 0, userId: "user1", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { status: 201 }
    );
  }),

  http.patch("*/api/todos/:id", () => {
    return HttpResponse.json({ id: "clx1234", todo_title: "更新済み", priority: "HIGH", progress: 100, userId: "user1", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }),

  http.delete("*/api/todos/:id", () => {
    return new HttpResponse(null, { status: 204 });
  }),

  http.get("*/api/todos/stats", () => {
    return HttpResponse.json([
      { priority: "HIGH", count: 1 },
      { priority: "MEDIUM", count: 1 },
      { priority: "LOW", count: 2 },
    ]);
  }),

  http.get("*/api/todos/progress-stats", () => {
    return HttpResponse.json([
      { range: "0-20%", count: 1 },
      { range: "21-40%", count: 0 },
      { range: "41-60%", count: 1 },
      { range: "61-80%", count: 0 },
      { range: "81-100%", count: 1 },
    ]);
  }),
];