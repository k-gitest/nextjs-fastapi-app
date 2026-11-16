import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

// Vitest 4 では、new で呼ばれるモックはアロー関数にできないため class を使う
vi.mock("@aws-sdk/client-s3", () => ({
    S3Client: class {
        send = sendMock;
    },
    DeleteObjectCommand: class {
        constructor(public input: unknown) { }
    },
}));

vi.mock("../../../src/config", () => ({
    B2_ENDPOINT: "https://b2.example.invalid",
    B2_REGION: "us-west-004",
    B2_BUCKET: "test-bucket",
    B2_KEY_ID: "key-id",
    B2_APPLICATION_KEY: "app-key",
}));

import { deleteB2Object } from "../../../src/lib/b2";

describe("deleteB2Object", () => {
    beforeEach(() => {
        sendMock.mockReset();
        sendMock.mockResolvedValue({});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("10秒のabortSignalを付けてsendを呼ぶこと", async () => {
        const timeoutSpy = vi.spyOn(AbortSignal, "timeout");

        await deleteB2Object("uploads/target.jpg");

        expect(timeoutSpy).toHaveBeenCalledWith(10_000);
        expect(sendMock).toHaveBeenCalledWith(
            expect.objectContaining({ input: { Bucket: "test-bucket", Key: "uploads/target.jpg" } }),
            { abortSignal: expect.any(AbortSignal) },
        );
    });
});