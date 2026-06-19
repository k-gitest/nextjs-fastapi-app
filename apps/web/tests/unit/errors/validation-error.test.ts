import { describe, it, expect } from "vitest";
import { ValidationError } from "@/errors/validation-error";

describe("ValidationError", () => {
  describe("constructor", () => {
    it("messageとfieldsを保持する", () => {
      const error = new ValidationError("入力エラーがあります", {
        email: ["必須です"],
      });

      expect(error.message).toBe("入力エラーがあります");
      expect(error.fields).toEqual({ email: ["必須です"] });
      expect(error.name).toBe("ValidationError");
    });

    it("messageを省略した場合はデフォルトメッセージになる", () => {
      const error = new ValidationError();

      expect(error.message).toBe("入力内容に誤りがあります");
    });

    it("fieldsを省略した場合はundefinedになる", () => {
      const error = new ValidationError("エラー");

      expect(error.fields).toBeUndefined();
    });

    it("instanceof Errorとして判定できる", () => {
      const error = new ValidationError();

      expect(error instanceof Error).toBe(true);
      expect(error instanceof ValidationError).toBe(true);
    });
  });

  describe("getFieldErrors", () => {
    it("指定したフィールドのエラーメッセージ配列を返す", () => {
      const error = new ValidationError("エラー", {
        email: ["必須です", "形式が不正です"],
        title: ["文字数が不足しています"],
      });

      expect(error.getFieldErrors("email")).toEqual([
        "必須です",
        "形式が不正です",
      ]);
    });

    it("存在しないフィールドを指定した場合はnullを返す", () => {
      const error = new ValidationError("エラー", {
        email: ["必須です"],
      });

      expect(error.getFieldErrors("title")).toBeNull();
    });

    it("fieldsが無い場合はnullを返す", () => {
      const error = new ValidationError("エラー");

      expect(error.getFieldErrors("email")).toBeNull();
    });
  });

  describe("allMessages", () => {
    it("fieldsの全メッセージをフラットな配列で返す", () => {
      const error = new ValidationError("エラー", {
        email: ["必須です", "形式が不正です"],
        title: ["文字数が不足しています"],
      });

      expect(error.allMessages).toEqual([
        "必須です",
        "形式が不正です",
        "文字数が不足しています",
      ]);
    });

    it("fieldsが無い場合はmessageを1件の配列で返す", () => {
      const error = new ValidationError("単一のエラーメッセージ");

      expect(error.allMessages).toEqual(["単一のエラーメッセージ"]);
    });

    it("fieldsが空オブジェクトの場合は空配列を返す", () => {
      const error = new ValidationError("エラー", {});

      expect(error.allMessages).toEqual([]);
    });
  });
});