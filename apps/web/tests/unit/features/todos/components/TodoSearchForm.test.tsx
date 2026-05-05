import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TodoSearchForm } from "@/features/todos/components/TodoSearchForm";
import { useTodoSearchState } from "@/features/todos/hooks/useTodoSearchState";

const resetStore = () =>
  useTodoSearchState.setState({ searchQuery: "" });

vi.mock("lucide-react", () => ({
  Search: () => <svg data-testid="search-icon" />,
  X: () => <svg data-testid="x-icon" />,
}));

describe("TodoSearchForm", () => {
  beforeEach(() => {
    resetStore();
  });

  // ---------------------------------------------------------------------------
  // レンダリング
  // ---------------------------------------------------------------------------
  describe("レンダリング", () => {
    it("検索インプットが表示される", () => {
      render(<TodoSearchForm />);
      expect(
        screen.getByPlaceholderText("タスクを意味で検索 (例: 急ぎの仕事)...")
      ).toBeInTheDocument();
    });

    it("初期状態で検索アイコンが表示される", () => {
      render(<TodoSearchForm />);
      expect(screen.getByTestId("search-icon")).toBeInTheDocument();
    });

    it("初期状態でクリアボタン（X）は非表示である", () => {
      render(<TodoSearchForm />);
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("初期状態のインプットは空文字列である", () => {
      render(<TodoSearchForm />);
      expect(screen.getByRole("textbox")).toHaveValue("");
    });
  });

  // ---------------------------------------------------------------------------
  // ユーザー入力（real timers）
  // ---------------------------------------------------------------------------
  describe("ユーザー入力", () => {
    it("テキスト入力がインプットに反映される", async () => {
      const user = userEvent.setup();
      render(<TodoSearchForm />);

      await user.type(screen.getByRole("textbox"), "急ぎの仕事");

      expect(screen.getByRole("textbox")).toHaveValue("急ぎの仕事");
    });

    it("文字を入力するとクリアボタンが表示される", async () => {
      const user = userEvent.setup();
      render(<TodoSearchForm />);

      await user.type(screen.getByRole("textbox"), "a");

      expect(screen.getByRole("button")).toBeInTheDocument();
      expect(screen.getByTestId("x-icon")).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // クリアボタン（real timers）
  // ---------------------------------------------------------------------------
  describe("クリアボタン", () => {
    it("クリアボタンを押すとインプットが空になる", async () => {
      const user = userEvent.setup();
      render(<TodoSearchForm />);

      await user.type(screen.getByRole("textbox"), "テスト");
      await user.click(screen.getByRole("button"));

      expect(screen.getByRole("textbox")).toHaveValue("");
    });

    it("クリアボタンを押した後、クリアボタン自体が非表示になる", async () => {
      const user = userEvent.setup();
      render(<TodoSearchForm />);

      await user.type(screen.getByRole("textbox"), "テスト");
      await user.click(screen.getByRole("button"));

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // debounce によるストア更新
  // fake timers + fireEvent.change + act でタイマーを同期的に進める
  // ---------------------------------------------------------------------------
  describe("debounce によるストア更新", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("入力後 300ms 経過すると searchQuery がストアに反映される", () => {
      render(<TodoSearchForm />);
      const input = screen.getByRole("textbox");

      act(() => {
        fireEvent.change(input, { target: { value: "急ぎ" } });
      });

      // 299ms 時点ではまだ反映されない
      act(() => { vi.advanceTimersByTime(299); });
      expect(useTodoSearchState.getState().searchQuery).toBe("");

      // 300ms 経過後に反映される
      act(() => { vi.advanceTimersByTime(1); });
      expect(useTodoSearchState.getState().searchQuery).toBe("急ぎ");
    });

    it("連続入力では最後の入力だけがストアに反映される（debounce）", () => {
      render(<TodoSearchForm />);
      const input = screen.getByRole("textbox");

      act(() => { fireEvent.change(input, { target: { value: "a" } }); });
      act(() => { vi.advanceTimersByTime(100); });

      act(() => { fireEvent.change(input, { target: { value: "ab" } }); });
      act(() => { vi.advanceTimersByTime(100); });

      act(() => { fireEvent.change(input, { target: { value: "abc" } }); });

      // 300ms 未満のため、まだ反映されない
      expect(useTodoSearchState.getState().searchQuery).toBe("");

      // 300ms 経過後に最終値のみ反映される
      act(() => { vi.advanceTimersByTime(300); });
      expect(useTodoSearchState.getState().searchQuery).toBe("abc");
    });

    it("クリアボタンで空にすると 300ms 後にストアも空になる", () => {
      render(<TodoSearchForm />);
      const input = screen.getByRole("textbox");

      // 値をセットしてストアに反映
      act(() => { fireEvent.change(input, { target: { value: "テスト" } }); });
      act(() => { vi.advanceTimersByTime(300); });
      expect(useTodoSearchState.getState().searchQuery).toBe("テスト");

      // クリアボタンをクリック
      act(() => { fireEvent.click(screen.getByRole("button")); });
      act(() => { vi.advanceTimersByTime(300); });
      expect(useTodoSearchState.getState().searchQuery).toBe("");
    });
  });

  // ---------------------------------------------------------------------------
  // アクセシビリティ
  // ---------------------------------------------------------------------------
  describe("アクセシビリティ", () => {
    it("インプットが textbox ロールを持つ", () => {
      render(<TodoSearchForm />);
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("プレースホルダーが適切に設定されている", () => {
      render(<TodoSearchForm />);
      expect(
        screen.getByPlaceholderText("タスクを意味で検索 (例: 急ぎの仕事)...")
      ).toBeInTheDocument();
    });
  });
});