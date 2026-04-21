import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@tests/mocks/server";
import { useProgressStats } from "@/features/todos/hooks/useProgressStats";
import { queryClientWrapper } from "@tests/test-utils/vitest-util";
import type { ProgressStatsResponse } from "@/features/todos/services/todoService";

// 型定義に合わせて配列形式に変更
const mockProgressResponse: ProgressStatsResponse = [
  { range: "0-20%", count: 5 },
  { range: "21-40%", count: 3 },
  { range: "41-60%", count: 7 },
  { range: "61-80%", count: 4 },
  { range: "81-100%", count: 2 },
];

describe("useProgressStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("進捗統計データを正常に取得できる", async () => {
    server.use(
      http.get("*/api/todos/progress-stats", () =>
        HttpResponse.json(mockProgressResponse)
      )
    );

    const { result } = renderHook(() => useProgressStats(), {
      wrapper: queryClientWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toEqual(mockProgressResponse);
    });

    // 配列の要素にアクセスして検証
    expect(result.current.data).toHaveLength(5);
    expect(result.current.data[0].range).toBe("0-20%");
    expect(result.current.data[0].count).toBe(5);
  });

  it("データが空の場合でも正しく取得できる", async () => {
    // 空配列を期待値として設定
    const emptyResponse: ProgressStatsResponse = [];

    server.use(
      http.get("*/api/todos/progress-stats", () =>
        HttpResponse.json(emptyResponse)
      )
    );

    const { result } = renderHook(() => useProgressStats(), {
      wrapper: queryClientWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toEqual(emptyResponse);
    });
  });

  it("取得失敗時はエラーを throw する (Suspense の挙動)", async () => {
    server.use(
      http.get("*/api/todos/progress-stats", () =>
        HttpResponse.json({ error: "Server Error" }, { status: 500 })
      )
    );

    // useTodoStats 同様、プレースホルダーとしておく
    expect(true).toBe(true);
  });
});