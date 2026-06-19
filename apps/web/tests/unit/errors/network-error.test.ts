import { describe, it, expect } from "vitest";
import { NetworkError } from "@/errors/network-error";

describe("NetworkError", () => {
  describe("constructor", () => {
    it("messageとoriginalErrorを保持する", () => {
      const original = new Error("fetch failed");
      const error = new NetworkError("接続できませんでした", original);

      expect(error.message).toBe("接続できませんでした");
      expect(error.originalError).toBe(original);
      expect(error.name).toBe("NetworkError");
    });

    it("messageを省略した場合はデフォルトメッセージになる", () => {
      const error = new NetworkError();

      expect(error.message).toBe("ネットワークエラーが発生しました");
    });

    it("instanceof Errorとして判定できる", () => {
      const error = new NetworkError();

      expect(error instanceof Error).toBe(true);
      expect(error instanceof NetworkError).toBe(true);
    });
  });

  describe("isTimeout", () => {
    it("originalErrorのmessageに'timeout'が含まれる場合はtrueを返す", () => {
      const error = new NetworkError("失敗", new Error("Request timeout"));

      expect(error.isTimeout).toBe(true);
    });

    it("originalErrorのmessageに'aborted'が含まれる場合はtrueを返す", () => {
      const error = new NetworkError("失敗", new Error("The operation was aborted"));

      expect(error.isTimeout).toBe(true);
    });

    it("大文字小文字を区別せず判定する", () => {
      const error = new NetworkError("失敗", new Error("TIMEOUT occurred"));

      expect(error.isTimeout).toBe(true);
    });

    it("timeout・abortedどちらも含まない場合はfalseを返す", () => {
      const error = new NetworkError("失敗", new Error("connection refused"));

      expect(error.isTimeout).toBe(false);
    });

    it("originalErrorが無い場合はfalseを返す", () => {
      const error = new NetworkError("失敗");

      expect(error.isTimeout).toBe(false);
    });

    it("originalErrorがErrorインスタンスでない場合はfalseを返す", () => {
      const error = new NetworkError("失敗", "timeout string");

      expect(error.isTimeout).toBe(false);
    });
  });
});