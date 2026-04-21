import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useUIStore, useExclusiveModal } from "@/hooks/useExclusiveModal";

describe("useUIStore (Zustand Store)", () => {
  beforeEach(() => {
    // テストごとにストアの状態をリセット
    act(() => {
      useUIStore.setState({ currentModalId: null });
    });
  });

  it("初期状態では currentModalId は null であること", () => {
    expect(useUIStore.getState().currentModalId).toBeNull();
  });

  it("openModal で ID がセットされ、true を返すこと", () => {
    let result: boolean = false;
    act(() => {
      result = useUIStore.getState().openModal("modal-1");
    });
    expect(result).toBe(true);
    expect(useUIStore.getState().currentModalId).toBe("modal-1");
  });

  it("既にモーダルが開いている場合、別の ID で openModal すると false を返すこと", () => {
    act(() => {
      useUIStore.getState().openModal("modal-1");
    });

    let result: boolean = true;
    act(() => {
      result = useUIStore.getState().openModal("modal-2");
    });

    expect(result).toBe(false);
    expect(useUIStore.getState().currentModalId).toBe("modal-1"); // 最初のが保持される
  });

  it("closeModal で正しい ID を渡すと null にリセットされること", () => {
    act(() => {
      useUIStore.getState().openModal("modal-1");
      useUIStore.getState().closeModal("modal-1");
    });
    expect(useUIStore.getState().currentModalId).toBeNull();
  });

  it("異なる ID で closeModal しても null にならないこと", () => {
    act(() => {
      useUIStore.getState().openModal("modal-1");
      useUIStore.getState().closeModal("modal-wrong");
    });
    expect(useUIStore.getState().currentModalId).toBe("modal-1");
  });
});

describe("useExclusiveModal (Hook)", () => {
  beforeEach(() => {
    act(() => {
      useUIStore.setState({ currentModalId: null });
    });
  });

  it("open を呼ぶと isOpen が true になること", () => {
    const { result } = renderHook(() => useExclusiveModal());

    act(() => {
      const success = result.current.open();
      expect(success).toBe(true);
    });

    expect(result.current.isOpen).toBe(true);
  });

  it("close を呼ぶと isOpen が false になり、ストアが解放されること", () => {
    const { result } = renderHook(() => useExclusiveModal());

    act(() => {
      result.current.open();
      result.current.close();
    });

    expect(result.current.isOpen).toBe(false);
    expect(useUIStore.getState().currentModalId).toBeNull();
  });

  it("他のフックが既にモーダルを開いている場合、open は失敗すること", () => {
    const { result: hook1 } = renderHook(() => useExclusiveModal());
    const { result: hook2 } = renderHook(() => useExclusiveModal());

    act(() => {
      hook1.current.open();
    });

    let success: boolean = true;
    act(() => {
      success = hook2.current.open();
    });

    expect(success).toBe(false);
    expect(hook2.current.isOpen).toBe(false);
    expect(hook1.current.isOpen).toBe(true);
  });

  it("アンマウント時に closeModal が呼ばれ、ストアが解放されること", () => {
    const { result, unmount } = renderHook(() => useExclusiveModal());

    act(() => {
      result.current.open();
    });
    
    expect(useUIStore.getState().currentModalId).not.toBeNull();

    unmount();

    expect(useUIStore.getState().currentModalId).toBeNull();
  });
});