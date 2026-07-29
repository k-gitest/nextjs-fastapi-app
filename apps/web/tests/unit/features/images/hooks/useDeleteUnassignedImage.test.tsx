import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@tests/mocks/server";
import { useDeleteUnassignedImage } from "@/features/images/hooks/useDeleteUnassignedImage";
import { createQueryClientWrapper } from "@tests/test-utils/vitest-util";
import { UNASSIGNED_IMAGES_QUERY_KEY } from "@/features/images/lib/queryKeys";

describe("useDeleteUnassignedImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Image削除が成功すること", async () => {
    server.use(
      http.delete("*/api/images/img-1", () => new HttpResponse(null, { status: 204 })),
    );

    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useDeleteUnassignedImage(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync("img-1");
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it("成功後にUNASSIGNED_IMAGES_QUERY_KEYがinvalidateされること", async () => {
    server.use(
      http.delete("*/api/images/img-1", () => new HttpResponse(null, { status: 204 })),
    );

    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeleteUnassignedImage(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync("img-1");
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: UNASSIGNED_IMAGES_QUERY_KEY,
    });
  });

  it("削除失敗時はエラーになり、invalidateQueriesは呼ばれないこと", async () => {
    server.use(
      http.delete("*/api/images/img-1", () =>
        HttpResponse.json({ message: "Not found" }, { status: 404 }),
      ),
    );

    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeleteUnassignedImage(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      try {
        await result.current.mutateAsync("img-1");
      } catch {
        // エラーは期待通り
      }
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});