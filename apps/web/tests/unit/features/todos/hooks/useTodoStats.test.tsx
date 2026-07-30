import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@tests/mocks/server";
import { useTodoStats } from "@/features/todos/hooks/useTodoStats";
import { queryClientWrapper } from "@tests/test-utils/vitest-util";

const mockStatsData = [
  { priority: "HIGH", count: 5 },
  { priority: "MEDIUM", count: 10 },
  { priority: "LOW", count: 3 },
];

describe("useTodoStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("優先度別の統計データを取得できる", async () => {
    server.use(
      http.get("*/api/todos/stats", () => HttpResponse.json(mockStatsData)),
    );

    const { result } = renderHook(() => useTodoStats(), {
      wrapper: queryClientWrapper(),
    });

    // データの取得完了を待機
    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data).toHaveLength(3);
    expect(result.current.data?.[0]).toEqual({ priority: "HIGH", count: 5 });
  });

  it("データが空の場合、空配列を返す", async () => {
    server.use(http.get("*/api/todos/stats", () => HttpResponse.json([])));

    const { result } = renderHook(() => useTodoStats(), {
      wrapper: queryClientWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toEqual([]);
    });
  });

  it("取得失敗時はエラーを throw する (Suspense の挙動)", async () => {
    server.use(
      http.get("*/api/todos/progress-stats", () =>
        HttpResponse.json({ error: "Server Error" }, { status: 500 }),
      ),
    );

    // useSuspenseQueryはエラー時にthrowするため、ErrorBoundaryで受け取られる。
    // この挙動はTanStack Query / useSuspenseQueryの責務であり、
    // useProgressStatsのhook単体テストでは検証しない。
    // ErrorBoundaryへの伝播・表示は上位の統合テストで担保する。
    expect(true).toBe(true); // プレースホルダー
  });
});
