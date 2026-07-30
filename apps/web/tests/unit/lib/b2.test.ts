import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

// S3Client.send() のモック。vi.mockのfactory内から参照するためvi.hoistedで定義する
const mockSend = vi.hoisted(() => vi.fn());

vi.mock("@aws-sdk/client-s3", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@aws-sdk/client-s3")>();
  return {
    ...actual, // PutObjectCommand等の実クラスは残す（.inputプロパティの検証に使うため）
    S3Client: vi.fn().mockImplementation(function () {
      return { send: mockSend };
    }),
  };
});

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(),
}));

describe("lib/b2", () => {
  let b2: typeof import("@/lib/b2");
  let mockGetSignedUrl: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    mockSend.mockReset();

    // B2_BUCKET等はモジュールトップレベルでprocess.envを読むため、
    // import前にstubし、resetModulesで再評価させる
    vi.stubEnv("B2_ENDPOINT", "https://s3.us-west-004.backblazeb2.com");
    vi.stubEnv("B2_REGION", "us-west-004");
    vi.stubEnv("B2_BUCKET", "test-bucket");
    vi.stubEnv("B2_KEY_ID", "test-key-id");
    vi.stubEnv("B2_APPLICATION_KEY", "test-app-key");

    b2 = await import("@/lib/b2");

    const presigner = await import("@aws-sdk/s3-request-presigner");
    mockGetSignedUrl = vi.mocked(presigner.getSignedUrl);
    mockGetSignedUrl.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("buildStorageKey", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("UTC日付・userId・uuid・拡張子からストレージキーを生成する", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-07-04T12:34:56Z"));

      const key = b2.buildStorageKey("user-123", "uuid-abc", "jpg");

      expect(key).toBe("uploads/2026/07/04/user-123/uuid-abc.jpg");
    });

    it("月・日が1桁の場合は0埋めされる", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-05T00:00:00Z"));

      const key = b2.buildStorageKey("user-1", "uuid-1", "png");

      expect(key).toBe("uploads/2026/01/05/user-1/uuid-1.png");
    });
  });

  describe("createPresignedPutUrl", () => {
    it("PutObjectCommandを正しい引数で生成し、getSignedUrlの戻り値をそのまま返す", async () => {
      mockGetSignedUrl.mockResolvedValue("https://signed-put-url.example.com");

      const url = await b2.createPresignedPutUrl(
        "uploads/foo.jpg",
        "image/jpeg",
      );

      expect(url).toBe("https://signed-put-url.example.com");
      expect(mockGetSignedUrl).toHaveBeenCalledTimes(1);

      const [clientArg, commandArg, optionsArg] = mockGetSignedUrl.mock
        .calls[0] as [unknown, PutObjectCommand, { expiresIn: number }];

      expect(clientArg).toBe(b2.b2Client);
      expect(commandArg.input).toEqual({
        Bucket: "test-bucket",
        Key: "uploads/foo.jpg",
        ContentType: "image/jpeg",
      });
      expect(optionsArg).toEqual({ expiresIn: 300 });
    });
  });

  describe("createPresignedGetUrl", () => {
    it("GetObjectCommandを正しい引数で生成し、getSignedUrlの戻り値をそのまま返す", async () => {
      mockGetSignedUrl.mockResolvedValue("https://signed-get-url.example.com");

      const url = await b2.createPresignedGetUrl("uploads/foo.jpg");

      expect(url).toBe("https://signed-get-url.example.com");
      expect(mockGetSignedUrl).toHaveBeenCalledTimes(1);

      const [clientArg, commandArg, optionsArg] = mockGetSignedUrl.mock
        .calls[0] as [unknown, GetObjectCommand, { expiresIn: number }];

      expect(clientArg).toBe(b2.b2Client);
      expect(commandArg.input).toEqual({
        Bucket: "test-bucket",
        Key: "uploads/foo.jpg",
      });
      expect(optionsArg).toEqual({ expiresIn: 300 });
    });
  });

  describe("deleteB2Object", () => {
    it("DeleteObjectCommandを正しい引数で生成し、S3Client.sendを1回呼び出す", async () => {
      mockSend.mockResolvedValue(undefined);

      await b2.deleteB2Object("uploads/foo.jpg");

      expect(mockSend).toHaveBeenCalledTimes(1);

      const commandArg = mockSend.mock.calls[0][0] as DeleteObjectCommand;
      expect(commandArg.input).toEqual({
        Bucket: "test-bucket",
        Key: "uploads/foo.jpg",
      });
    });

    it("send()が失敗した場合はエラーがそのまま伝播する", async () => {
      const sendError = new Error("B2 delete failed");
      mockSend.mockRejectedValue(sendError);

      await expect(b2.deleteB2Object("uploads/foo.jpg")).rejects.toBe(
        sendError,
      );
    });
  });
});