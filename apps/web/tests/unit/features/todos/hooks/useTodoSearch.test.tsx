import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@tests/mocks/server";
import { useTodoSearch } from "@/features/todos/hooks/useTodoSearch";
import { queryClientWrapper } from "@tests/test-utils/vitest-util";
import type { SimilarTodosResponse } from "@/features/todos/hooks/useTodoSearch";

const mockSearchResponse: SimilarTodosResponse = {
  results: [
    {
      id: "clx1111",
      score: 0.92,
      title: "テストタスク1",
      priority: "HIGH",
      progress: 50,
    },
    {
      id: "clx2222",
      score: 0.81,
      title: "テストタスク2",
      priority: "MEDIUM",
      progress: 0,
    },
  ],
  count: 2,
  query: "テスト",
};

describe("useTodoSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("enabled判定", () => {
    it("queryが3文字以上の場合は検索を実行する", async () => {
      server.use(
        http.get("*/api/todos/search", () =>
          HttpResponse.json(mockSearchResponse),
        ),
      );

      const { result } = renderHook(() => useTodoSearch("テスト検索"), {
        wrapper: queryClientWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.results).toHaveLength(2);
    });

    it("queryが2文字以下の場合は検索を実行しない", async () => {
      const fetchSpy = vi.fn(() => HttpResponse.json(mockSearchResponse));
      server.use(http.get("*/api/todos/search", fetchSpy));

      const { result } = renderHook(() => useTodoSearch("AB"), {
        wrapper: queryClientWrapper(),
      });

      // enabled: false のため fetchQuery 自体が走らないことを確認
      await waitFor(() => {
        expect(result.current.fetchStatus).toBe("idle");
      });

      expect(result.current.data).toBeUndefined();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("queryが空文字の場合は検索を実行しない", async () => {
      const { result } = renderHook(() => useTodoSearch(""), {
        wrapper: queryClientWrapper(),
      });

      await waitFor(() => {
        expect(result.current.fetchStatus).toBe("idle");
      });

      expect(result.current.data).toBeUndefined();
    });

    it("options.enabled=falseを指定すると3文字以上でも検索を実行しない", async () => {
      const { result } = renderHook(
        () => useTodoSearch("テスト検索", { enabled: false }),
        { wrapper: queryClientWrapper() },
      );

      await waitFor(() => {
        expect(result.current.fetchStatus).toBe("idle");
      });

      expect(result.current.data).toBeUndefined();
    });

    it("options.enabled=trueを指定すると2文字以下でも検索を実行する", async () => {
      server.use(
        http.get("*/api/todos/search", () =>
          HttpResponse.json(mockSearchResponse),
        ),
      );

      const { result } = renderHook(
        () => useTodoSearch("AB", { enabled: true }),
        { wrapper: queryClientWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.results).toHaveLength(2);
    });
  });

  describe("リクエストパラメータ", () => {
    it("デフォルトのtopK・minScoreがクエリパラメータに反映される", async () => {
      let capturedUrl: URL | undefined;
      server.use(
        http.get("*/api/todos/search", ({ request }) => {
          capturedUrl = new URL(request.url);
          return HttpResponse.json(mockSearchResponse);
        }),
      );

      const { result } = renderHook(() => useTodoSearch("テスト検索"), {
        wrapper: queryClientWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(capturedUrl?.searchParams.get("q")).toBe("テスト検索");
      expect(capturedUrl?.searchParams.get("top_k")).toBe("10");
      expect(capturedUrl?.searchParams.get("min_score")).toBe("0.5");
    });

    it("topK・minScoreを指定するとクエリパラメータに反映される", async () => {
      let capturedUrl: URL | undefined;
      server.use(
        http.get("*/api/todos/search", ({ request }) => {
          capturedUrl = new URL(request.url);
          return HttpResponse.json(mockSearchResponse);
        }),
      );

      const { result } = renderHook(
        () => useTodoSearch("テスト検索", { topK: 3, minScore: 0.7 }),
        { wrapper: queryClientWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(capturedUrl?.searchParams.get("top_k")).toBe("3");
      expect(capturedUrl?.searchParams.get("min_score")).toBe("0.7");
    });

    it("queryの前後の空白はtrimされてリクエストされる", async () => {
      let capturedUrl: URL | undefined;
      server.use(
        http.get("*/api/todos/search", ({ request }) => {
          capturedUrl = new URL(request.url);
          return HttpResponse.json(mockSearchResponse);
        }),
      );

      const { result } = renderHook(() => useTodoSearch("  テスト検索  "), {
        wrapper: queryClientWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(capturedUrl?.searchParams.get("q")).toBe("テスト検索");
    });
  });

  describe("エラーハンドリング", () => {
    it("APIがエラーレスポンスの場合、detailメッセージでエラーをthrowする", async () => {
      server.use(
        http.get("*/api/todos/search", () =>
          HttpResponse.json({ detail: "検索クエリが不正です" }, { status: 400 }),
        ),
      );

      const { result } = renderHook(() => useTodoSearch("テスト検索"), {
        wrapper: queryClientWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toBe("検索クエリが不正です");
    });

    it("APIがエラーレスポンスかつdetailが無い場合はデフォルトメッセージでエラーをthrowする", async () => {
      server.use(
        http.get("*/api/todos/search", () =>
          HttpResponse.json({}, { status: 500 }),
        ),
      );

      const { result } = renderHook(() => useTodoSearch("テスト検索"), {
        wrapper: queryClientWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toBe("検索に失敗しました");
    });

    it("レスポンスボディがJSONとしてパースできない場合もデフォルトメッセージでエラーをthrowする", async () => {
      server.use(
        http.get(
          "*/api/todos/search",
          () => new HttpResponse("not json", { status: 502 }),
        ),
      );

      const { result } = renderHook(() => useTodoSearch("テスト検索"), {
        wrapper: queryClientWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toBe("検索に失敗しました");
    });

    it("エラー時はリトライしない", async () => {
      let callCount = 0;
      server.use(
        http.get("*/api/todos/search", () => {
          callCount += 1;
          return HttpResponse.json({ detail: "失敗" }, { status: 500 });
        }),
      );

      const { result } = renderHook(() => useTodoSearch("テスト検索"), {
        wrapper: queryClientWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(callCount).toBe(1);
    });
  });
});