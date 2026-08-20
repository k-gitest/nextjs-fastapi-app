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
    it("uuid・拡張子からストレージキーを生成する", () => {
      const key = b2.buildStorageKey("uuid-abc", "jpg");

      expect(key).toBe("uploads/uuid-abc.jpg");
    });

    it("拡張子違いでも同じ形式で生成される", () => {
      const key = b2.buildStorageKey("uuid-1", "png");

      expect(key).toBe("uploads/uuid-1.png");
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

      expect(clientArg).toBe(b2.getB2Client());
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

      expect(clientArg).toBe(b2.getB2Client());
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

  describe("環境変数読み込み（Lazy化）", () => {
    it("import時点では環境変数を読まず、B2操作関数呼び出し時に初めて検証される", async () => {
      // このdescribe内ではbeforeEachのstubEnvを上書きし、必須変数を未設定にする
      vi.unstubAllEnvs();
      vi.resetModules();
      // importまでは何もthrowしない（モジュール評価時にはprocess.envを読まないため）
      b2 = await import("@/lib/b2");
      expect(b2).toBeDefined();
    });

    it("必須環境変数が1つ未設定の場合、明確なエラーメッセージでthrowする", async () => {
      vi.unstubAllEnvs();
      vi.resetModules();
      vi.stubEnv("B2_ENDPOINT", "https://s3.us-west-004.backblazeb2.com");
      vi.stubEnv("B2_REGION", "us-west-004");
      // B2_BUCKETのみ未設定
      vi.stubEnv("B2_KEY_ID", "test-key-id");
      vi.stubEnv("B2_APPLICATION_KEY", "test-app-key");

      b2 = await import("@/lib/b2");

      await expect(b2.createPresignedGetUrl("uploads/foo.jpg")).rejects.toThrow(
        "Missing required B2 environment variables: B2_BUCKET",
      );
    });

    it("必須環境変数が複数未設定の場合、すべてを列挙したエラーメッセージでthrowする", async () => {
      vi.unstubAllEnvs();
      vi.resetModules();
      // 何も設定しない（B2_ENDPOINT・B2_BUCKET・B2_KEY_ID・B2_APPLICATION_KEYすべて欠如）

      b2 = await import("@/lib/b2");

      await expect(b2.createPresignedGetUrl("uploads/foo.jpg")).rejects.toThrow(
        "Missing required B2 environment variables: B2_ENDPOINT, B2_BUCKET, B2_KEY_ID, B2_APPLICATION_KEY",
      );
    });

    it("B2_REGIONが未設定でもデフォルト値（us-west-000）で正常に動作する", async () => {
      vi.unstubAllEnvs();
      vi.resetModules();
      vi.stubEnv("B2_ENDPOINT", "https://s3.us-west-004.backblazeb2.com");
      // B2_REGIONは未設定のまま
      vi.stubEnv("B2_BUCKET", "test-bucket");
      vi.stubEnv("B2_KEY_ID", "test-key-id");
      vi.stubEnv("B2_APPLICATION_KEY", "test-app-key");

      b2 = await import("@/lib/b2");
      mockSend.mockResolvedValue(undefined);

      await expect(b2.deleteB2Object("uploads/foo.jpg")).resolves.toBeUndefined();
    });

    it("getB2Client()は同一インスタンスを返す（Singleton）", async () => {
      vi.unstubAllEnvs();
      vi.resetModules();
      vi.stubEnv("B2_ENDPOINT", "https://s3.us-west-004.backblazeb2.com");
      vi.stubEnv("B2_REGION", "us-west-004");
      vi.stubEnv("B2_BUCKET", "test-bucket");
      vi.stubEnv("B2_KEY_ID", "test-key-id");
      vi.stubEnv("B2_APPLICATION_KEY", "test-app-key");

      b2 = await import("@/lib/b2");

      const client1 = b2.getB2Client();
      const client2 = b2.getB2Client();
      expect(client1).toBe(client2);
    });
  });
});