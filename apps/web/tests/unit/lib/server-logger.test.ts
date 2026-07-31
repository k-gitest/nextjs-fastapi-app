import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logServiceError } from "@/lib/server-logger";

vi.mock("@sentry/nextjs", () => ({
  withScope: vi.fn(),
  captureException: vi.fn(),
}));

import * as Sentry from "@sentry/nextjs";

const mockWithScope = vi.mocked(Sentry.withScope);
const mockCaptureException = vi.mocked(Sentry.captureException);

// withScopeのオーバーロード解決でコールバック引数がScope型と誤推論されるため、
// 使用するメソッドのみを抜き出した最小限の型を明示して回避する
type ScopeStub = Pick<Sentry.Scope, "setTag" | "setContext" | "setLevel">;

const invokeWithScope = (scope: ScopeStub) => {
  mockWithScope.mockImplementation(((callback: (scope: ScopeStub) => void) => {
    callback(scope);
  }) as unknown as typeof Sentry.withScope);
};

describe("logServiceError", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  it("development環境ではconsole.errorのみ呼ばれ、Sentryへは送信しない", () => {
    vi.stubEnv("NODE_ENV", "development");
    const error = new Error("dev environment error");

    logServiceError(error, { component: "todo-service" });

    expect(consoleErrorSpy).toHaveBeenCalledWith("[SERVICE] todo-service:", {
      error,
      correlationId: undefined,
    });
    expect(mockWithScope).not.toHaveBeenCalled();
  });

  it("production環境ではconsole.errorとSentry.withScopeの両方が呼ばれる", () => {
    vi.stubEnv("NODE_ENV", "production");
    const error = new Error("prod environment error");

    logServiceError(error, { component: "todo-service" });

    expect(consoleErrorSpy).toHaveBeenCalledWith("[SERVICE] todo-service:", {
      error,
      correlationId: undefined,
    });
    expect(mockWithScope).toHaveBeenCalledTimes(1);
  });

  it("production環境でsetTag/setContext/setLevel/captureExceptionへ正しい値を渡す（correlationId・contextあり）", () => {
    vi.stubEnv("NODE_ENV", "production");
    const error = new Error("image cleanup failed");
    const setTag = vi.fn();
    const setContext = vi.fn();
    const setLevel = vi.fn();

    invokeWithScope({ setTag, setContext, setLevel });

    logServiceError(error, {
      component: "image-cleanup",
      correlationId: "corr-abc-123",
      context: { b2_object_path: "fail-key.jpg", todo_id: "todo-1" },
    });

    expect(setTag).toHaveBeenCalledWith("service", "web");
    expect(setTag).toHaveBeenCalledWith("component", "image-cleanup");
    expect(setTag).toHaveBeenCalledWith("correlation_id", "corr-abc-123");
    expect(setLevel).toHaveBeenCalledWith("error");
    expect(setContext).toHaveBeenCalledWith("image-cleanup", {
      b2_object_path: "fail-key.jpg",
      todo_id: "todo-1",
    });
    expect(mockCaptureException).toHaveBeenCalledWith(error);
  });

  it("correlationIdが無い場合はsetTag('correlation_id', ...)を呼ばない", () => {
    vi.stubEnv("NODE_ENV", "production");
    const error = new Error("no correlation id error");
    const setTag = vi.fn();
    const setContext = vi.fn();
    const setLevel = vi.fn();

    invokeWithScope({ setTag, setContext, setLevel });

    logServiceError(error, { component: "todo-service" });

    expect(setTag).toHaveBeenCalledWith("service", "web");
    expect(setTag).toHaveBeenCalledWith("component", "todo-service");
    expect(setTag).not.toHaveBeenCalledWith(
      "correlation_id",
      expect.anything(),
    );
    expect(setContext).not.toHaveBeenCalled();
    expect(mockCaptureException).toHaveBeenCalledWith(error);
  });

  it("contextが無い場合はsetContextを呼ばない", () => {
    vi.stubEnv("NODE_ENV", "production");
    const error = new Error("no context error");
    const setTag = vi.fn();
    const setContext = vi.fn();
    const setLevel = vi.fn();

    invokeWithScope({ setTag, setContext, setLevel });

    logServiceError(error, {
      component: "todo-service",
      correlationId: "corr-xyz",
    });

    expect(setContext).not.toHaveBeenCalled();
    expect(mockCaptureException).toHaveBeenCalledWith(error);
  });

  it("contextはoptions.componentの名前でsetContextされる（呼び出し側でcontext名を自由に付けられない）", () => {
    vi.stubEnv("NODE_ENV", "production");
    const error = new Error("context naming error");
    const setTag = vi.fn();
    const setContext = vi.fn();
    const setLevel = vi.fn();

    invokeWithScope({ setTag, setContext, setLevel });

    logServiceError(error, {
      component: "album-cleanup",
      context: { album_id: "album-1" },
    });

    expect(setContext).toHaveBeenCalledWith("album-cleanup", {
      album_id: "album-1",
    });
  });
});