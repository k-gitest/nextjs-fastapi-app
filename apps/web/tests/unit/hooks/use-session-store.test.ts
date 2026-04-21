import { describe, it, expect, beforeEach } from "vitest";
import { act } from "@testing-library/react";
import { useAuthStore } from "@/hooks/use-session-store";
import type { User } from "@/features/auth/types";

// 正しい User 型に準拠したモックデータ
const mockUser: User = {
  id: "user-1",
  email: "test@example.com",
  first_name: "Test",
  last_name: "User",
};

describe("useAuthStore (Cookie認証ストア)", () => {
  // 各テスト前にストアの状態をリセット
  beforeEach(() => {
    act(() => {
      useAuthStore.setState(
        {
          user: null,
          isInitialized: false,
        },
        false
      );
    });
  });

  // ----------------------------------------------------
  // シナリオ A: 初期状態の確認
  // ----------------------------------------------------
  it("ストアは正しい初期状態を持つ", () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isInitialized).toBe(false);
  });

  // ----------------------------------------------------
  // シナリオ B: setUser のテスト
  // ----------------------------------------------------
  it("setUser でユーザー情報を正しく設定できる", () => {
    act(() => {
      useAuthStore.getState().setUser(mockUser);
    });

    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.user?.first_name).toBe("Test");
    expect(state.user?.last_name).toBe("User");
  });

  // ----------------------------------------------------
  // シナリオ C: logout のテスト
  // ----------------------------------------------------
  it("logout でユーザー情報が null にリセットされる", () => {
    act(() => {
      useAuthStore.getState().setUser(mockUser);
    });
    expect(useAuthStore.getState().user).not.toBeNull();

    act(() => {
      useAuthStore.getState().logout();
    });

    expect(useAuthStore.getState().user).toBeNull();
  });

  // ----------------------------------------------------
  // シナリオ D: setInitialized のテスト
  // ----------------------------------------------------
  it("setInitialized で初期化フラグが正しく設定される", () => {
    expect(useAuthStore.getState().isInitialized).toBe(false);

    act(() => {
      useAuthStore.getState().setInitialized(true);
    });
    expect(useAuthStore.getState().isInitialized).toBe(true);

    act(() => {
      useAuthStore.getState().setInitialized(false);
    });
    expect(useAuthStore.getState().isInitialized).toBe(false);
  });
});