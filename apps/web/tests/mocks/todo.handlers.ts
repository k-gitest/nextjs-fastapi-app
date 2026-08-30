import { http, HttpResponse } from 'msw'

export const todoHandlers = [
  // Todo一覧（GET /api/todos は toTodoWithImageSummaries() 適用後の
  // TodoWithImageSummaries[] を返す。userId/createdAtは含まず、
  // imagesはTodoImageDto[]。REST公開DTOに揃えている）
  http.get("*/api/todos", () => {
    return HttpResponse.json([
      {
        id: "clx1234",
        todo_title: "テストタスク1",
        priority: "HIGH",
        progress: 50,
        updatedAt: new Date().toISOString(),
        images: [],
      },
    ]);
  }),

  // POST /api/todos は toTodoDTO() 適用後の Todo を返す（imagesを含まない）
  http.post("*/api/todos", () => {
    return HttpResponse.json(
      {
        id: "clxnew",
        todo_title: "新しいタスク",
        priority: "MEDIUM",
        progress: 0,
        updatedAt: new Date().toISOString(),
      },
      { status: 201 }
    );
  }),

  // PATCH /api/todos/:id も toTodoDTO() 適用後の Todo を返す
  http.patch("*/api/todos/:id", () => {
    return HttpResponse.json({
      id: "clx1234",
      todo_title: "更新済み",
      priority: "HIGH",
      progress: 100,
      updatedAt: new Date().toISOString(),
    });
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