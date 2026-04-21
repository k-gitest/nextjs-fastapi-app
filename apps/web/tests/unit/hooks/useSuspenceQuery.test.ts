import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useApiSuspenseQuery } from "@/hooks/useSuspenseQuery";
import { queryClientWrapper } from "@tests/test-utils/vitest-util";

describe("useApiSuspenseQuery / useSuspenseQueryEffect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("データが変更された際に再度 onSuccess が呼ばれること", async () => {
    const onSuccess = vi.fn();
    
    const { rerender } = renderHook(
      ({ data }) =>
        useApiSuspenseQuery(
          {
            // 1. QueryKeyを動的にして、新しいクエリとして認識させる
            queryKey: ["test-rerender", data.id], 
            // 2. data を直接返すと、その時点の data が Promise で解決される
            queryFn: async () => data,
          },
          { onSuccess }
        ),
      {
        wrapper: queryClientWrapper(),
        initialProps: { data: { id: 100 } },
      }
    );

    // 1回目の成功を待機
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith({ id: 100 });
    });

    // 2回目のレンダリング（id を変える）
    rerender({ data: { id: 200 } });

    // 3. waitFor の中で回数と内容をチェック
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(2);
      expect(onSuccess).toHaveBeenLastCalledWith({ id: 200 });
    }, { timeout: 2000 }); // Suspenseの再レンダリングを考慮して少し余裕を持たせる
  });

  it("エラー発生時は throw され、成功時用コールバックは実行されないこと", async () => {
    const onSuccess = vi.fn();
    const onSettled = vi.fn();

    // エラーを投げるクエリ
    const queryFn = vi.fn().mockRejectedValue(new Error("API Error"));

    // コンソールエラー出力を抑制（ErrorBoundaryがない警告を防ぐ）
    vi.spyOn(console, "error").mockImplementation(() => {});

    renderHook(
      () =>
        useApiSuspenseQuery(
          {
            queryKey: ["test-error"],
            queryFn,
          },
          { onSuccess, onSettled },
        ),
      { wrapper: queryClientWrapper() },
    );

    // Suspense環境ではエラー時に即座に処理が中断（throw）されるため、
    // 成功時の副作用には到達しない
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(onSuccess).not.toHaveBeenCalled();
    expect(onSettled).not.toHaveBeenCalled();
  });
});
