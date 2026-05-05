import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useTodoSearchState } from "@/features/todos/hooks/useTodoSearchState";

const resetStore = () =>
  useTodoSearchState.setState({ searchQuery: "" });

describe("useTodoSearchState", () => {
  beforeEach(() => {
    resetStore();
  });

  describe("初期状態", () => {
    it("searchQuery の初期値は空文字列である", () => {
      const { result } = renderHook(() => useTodoSearchState());
      expect(result.current.searchQuery).toBe("");
    });

    it("setSearchQuery が関数として存在する", () => {
      const { result } = renderHook(() => useTodoSearchState());
      expect(typeof result.current.setSearchQuery).toBe("function");
    });
  });

  describe("setSearchQuery", () => {
    it("クエリ文字列をセットできる", () => {
      const { result } = renderHook(() => useTodoSearchState());

      act(() => {
        result.current.setSearchQuery("急ぎの仕事");
      });

      expect(result.current.searchQuery).toBe("急ぎの仕事");
    });

    it("空文字列をセットできる（クリア操作）", () => {
      const { result } = renderHook(() => useTodoSearchState());

      act(() => {
        result.current.setSearchQuery("一時的なクエリ");
      });
      act(() => {
        result.current.setSearchQuery("");
      });

      expect(result.current.searchQuery).toBe("");
    });

    it("連続して異なる値をセットした場合、最後の値が保持される", () => {
      const { result } = renderHook(() => useTodoSearchState());

      act(() => { result.current.setSearchQuery("first"); });
      act(() => { result.current.setSearchQuery("second"); });
      act(() => { result.current.setSearchQuery("third"); });

      expect(result.current.searchQuery).toBe("third");
    });

    it("日本語・英数字・記号を含む文字列をセットできる", () => {
      const { result } = renderHook(() => useTodoSearchState());
      const complexQuery = "テスト & Test 123!";

      act(() => {
        result.current.setSearchQuery(complexQuery);
      });

      expect(result.current.searchQuery).toBe(complexQuery);
    });
  });

  describe("複数フックインスタンス間の状態共有", () => {
    it("異なるフックインスタンスが同じストアを参照する", () => {
      const { result: result1 } = renderHook(() => useTodoSearchState());
      const { result: result2 } = renderHook(() => useTodoSearchState());

      act(() => {
        result1.current.setSearchQuery("共有テスト");
      });

      expect(result2.current.searchQuery).toBe("共有テスト");
    });

    it("セレクターで特定フィールドのみを購読できる", () => {
      const { result } = renderHook(() =>
        useTodoSearchState((state) => state.searchQuery)
      );

      expect(result.current).toBe("");

      act(() => {
        useTodoSearchState.getState().setSearchQuery("セレクターテスト");
      });

      expect(result.current).toBe("セレクターテスト");
    });
  });

  describe("getState による直接操作", () => {
    it("getState で現在の状態を直接取得できる", () => {
      act(() => {
        useTodoSearchState.getState().setSearchQuery("直接取得");
      });

      expect(useTodoSearchState.getState().searchQuery).toBe("直接取得");
    });
  });
});