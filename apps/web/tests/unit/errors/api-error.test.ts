import { describe, it, expect } from "vitest";
import { ApiError } from "@/errors/api-error";

describe("ApiError", () => {
  describe("constructor", () => {
    it("status・message・data・originalErrorを保持する", () => {
      const original = new Error("network down");
      const error = new ApiError(400, "不正なリクエストです", { field: "title" }, original);

      expect(error.status).toBe(400);
      expect(error.message).toBe("不正なリクエストです");
      expect(error.data).toEqual({ field: "title" });
      expect(error.originalError).toBe(original);
      expect(error.name).toBe("ApiError");
    });

    it("messageを省略した場合はデフォルトメッセージになる", () => {
      const error = new ApiError(500);

      expect(error.message).toBe("API Error: 500");
    });

    it("instanceof Errorとして判定できる", () => {
      const error = new ApiError(404);

      expect(error instanceof Error).toBe(true);
      expect(error instanceof ApiError).toBe(true);
    });
  });

  describe("field", () => {
    it("dataにfieldが含まれる場合はその値を返す", () => {
      const error = new ApiError(400, "エラー", { field: "email" });

      expect(error.field).toBe("email");
    });

    it("dataが無い場合はundefinedを返す", () => {
      const error = new ApiError(400, "エラー");

      expect(error.field).toBeUndefined();
    });

    it("dataにfieldが含まれない場合はundefinedを返す", () => {
      const error = new ApiError(400, "エラー", { other: "value" });

      expect(error.field).toBeUndefined();
    });

    it("dataがオブジェクトでない場合はundefinedを返す", () => {
      const error = new ApiError(400, "エラー", "string-data");

      expect(error.field).toBeUndefined();
    });
  });

  describe("fields", () => {
    it("dataにfieldsが含まれる場合はその値を返す", () => {
      const error = new ApiError(400, "エラー", {
        fields: { email: ["必須です"] },
      });

      expect(error.fields).toEqual({ email: ["必須です"] });
    });

    it("dataにfieldsが含まれない場合はundefinedを返す", () => {
      const error = new ApiError(400, "エラー", { other: "value" });

      expect(error.fields).toBeUndefined();
    });
  });

  describe("serverMessage", () => {
    it("messageを返す", () => {
      const error = new ApiError(400, "サーバーエラーです");

      expect(error.serverMessage).toBe("サーバーエラーです");
    });
  });

  describe("fieldErrors", () => {
    it("status 400でも409でもない場合はnullを返す", () => {
      const error = new ApiError(500, "サーバーエラー");

      expect(error.fieldErrors).toBeNull();
    });

    it("fieldが指定されている場合はそのフィールドにmessageを紐付ける", () => {
      const error = new ApiError(400, "メールアドレスが不正です", {
        field: "email",
      });

      expect(error.fieldErrors).toEqual({
        email: ["メールアドレスが不正です"],
      });
    });

    it("fieldsが指定されている場合は正規化して返す（string配列）", () => {
      const error = new ApiError(400, "エラー", {
        fields: { email: ["必須です", "形式が不正です"] },
      });

      expect(error.fieldErrors).toEqual({
        email: ["必須です", "形式が不正です"],
      });
    });

    it("fieldsの値がstring単体の場合は配列に正規化される", () => {
      const error = new ApiError(400, "エラー", {
        fields: { email: "必須です" },
      });

      expect(error.fieldErrors).toEqual({ email: ["必須です"] });
    });

    it("fieldsが空オブジェクトの場合はnullを返す", () => {
      const error = new ApiError(400, "エラー", { fields: {} });

      expect(error.fieldErrors).toBeNull();
    });

    it("dataから一括抽出する場合（配列値）", () => {
      const error = new ApiError(400, "エラー", {
        email: ["必須です"],
        title: ["文字数が不足しています"],
      });

      expect(error.fieldErrors).toEqual({
        email: ["必須です"],
        title: ["文字数が不足しています"],
      });
    });

    it("dataから一括抽出する場合（string値）", () => {
      const error = new ApiError(409, "エラー", {
        email: "既に使用されています",
      });

      expect(error.fieldErrors).toEqual({
        email: ["既に使用されています"],
      });
    });

    it("dataの値が配列でもstringでもない場合は無視される", () => {
      const error = new ApiError(400, "エラー", {
        email: { nested: "value" },
      });

      expect(error.fieldErrors).toBeNull();
    });

    it("dataが存在しない場合はnullを返す", () => {
      const error = new ApiError(400, "エラー");

      expect(error.fieldErrors).toBeNull();
    });

    it("field指定がfieldsより優先される", () => {
      const error = new ApiError(400, "優先されるメッセージ", {
        field: "email",
        fields: { title: ["別のエラー"] },
      });

      expect(error.fieldErrors).toEqual({
        email: ["優先されるメッセージ"],
      });
    });
  });

  describe("ステータス判定ゲッター", () => {
    it("isAuthError: 401の場合trueを返す", () => {
      expect(new ApiError(401).isAuthError).toBe(true);
      expect(new ApiError(400).isAuthError).toBe(false);
    });

    it("isForbiddenError: 403の場合trueを返す", () => {
      expect(new ApiError(403).isForbiddenError).toBe(true);
      expect(new ApiError(401).isForbiddenError).toBe(false);
    });

    it("isServerError: 500以上の場合trueを返す", () => {
      expect(new ApiError(500).isServerError).toBe(true);
      expect(new ApiError(503).isServerError).toBe(true);
      expect(new ApiError(499).isServerError).toBe(false);
    });

    it("isValidationError: 400の場合trueを返す", () => {
      expect(new ApiError(400).isValidationError).toBe(true);
      expect(new ApiError(401).isValidationError).toBe(false);
    });

    it("isNotFoundError: 404の場合trueを返す", () => {
      expect(new ApiError(404).isNotFoundError).toBe(true);
      expect(new ApiError(400).isNotFoundError).toBe(false);
    });

    it("isConflictError: 409の場合trueを返す", () => {
      expect(new ApiError(409).isConflictError).toBe(true);
      expect(new ApiError(400).isConflictError).toBe(false);
    });

    it("isRateLimitError: 429の場合trueを返す", () => {
      expect(new ApiError(429).isRateLimitError).toBe(true);
      expect(new ApiError(400).isRateLimitError).toBe(false);
    });
  });
});