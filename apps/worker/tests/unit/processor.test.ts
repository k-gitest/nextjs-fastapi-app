import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  processEvent,
  PermanentError,
  TransientError,
} from "../../src/processor";
import { deleteB2Object } from "../../src/lib/b2";
import type { outbox_events } from "@repo/db";

vi.mock("../../src/lib/b2", () => ({
  deleteB2Object: vi.fn(),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// テスト用のダミーイベント（QStash系）
const baseEvent = {
  id: "evt-1",
  event_type: "todo.created",
  event_version: 1,
  payload: {},
  idempotency_key: "idem-1",
  aggregate_id: "agg-1",
} as unknown as outbox_events;

// テスト用のダミーイベント（Storage系）
const storageDeleteEvent = {
  id: "evt-storage-1",
  event_type: "image.storage_delete_requested",
  event_version: 1,
  payload: { storage_key: "uploads/target.jpg", correlation_id: "corr-1" },
  idempotency_key: "image.storage_delete_requested:img-1",
  aggregate_id: "img-1",
} as unknown as outbox_events;

describe("processEvent", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.mocked(deleteB2Object).mockReset();
    vi.stubGlobal("AbortSignal", {
      ...AbortSignal,
      timeout: vi.fn().mockReturnValue(new AbortController().signal),
    });
  });

  // ── QStash系 ──────────────────────────

  it("未知のevent_typeはPermanentErrorになる", async () => {
    await expect(
      processEvent({ ...baseEvent, event_type: "unknown.type" }),
    ).rejects.toBeInstanceOf(PermanentError);
  });

  it("409はDuplicate扱いで正常終了する", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 409,
      text: async () => "",
    });
    await expect(processEvent(baseEvent)).resolves.toBeUndefined();
  });

  it("429はTransientErrorになる", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => "rate limited",
    });
    await expect(processEvent(baseEvent)).rejects.toBeInstanceOf(
      TransientError,
    );
  });

  it("ネットワーク障害はTransientErrorになる", async () => {
    mockFetch.mockRejectedValue(new Error("ECONNRESET"));
    await expect(
      processEvent(baseEvent, new AbortController().signal),
    ).rejects.toBeInstanceOf(TransientError);
  });

  it("401はPermanentErrorになる", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "unauthorized",
    });
    await expect(processEvent(baseEvent)).rejects.toBeInstanceOf(
      PermanentError,
    );
  });

  // ── image.storage_delete_requested ──────────────────────────

  describe("image.storage_delete_requested", () => {
    it("QStashを経由せずdeleteB2Objectをstorage_keyで直接呼ぶこと", async () => {
      vi.mocked(deleteB2Object).mockResolvedValue(undefined);

      await processEvent(storageDeleteEvent);

      expect(deleteB2Object).toHaveBeenCalledWith("uploads/target.jpg");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("payloadにstorage_keyが存在しない場合はPermanentErrorになり、deleteB2Objectは呼ばれないこと", async () => {
      const invalidEvent = {
        ...storageDeleteEvent,
        payload: { correlation_id: "corr-1" },
      } as unknown as outbox_events;

      await expect(processEvent(invalidEvent)).rejects.toBeInstanceOf(
        PermanentError,
      );
      expect(deleteB2Object).not.toHaveBeenCalled();
    });

    it("storage_keyが文字列でない場合はPermanentErrorになること", async () => {
      const invalidEvent = {
        ...storageDeleteEvent,
        payload: { storage_key: 12345 },
      } as unknown as outbox_events;

      await expect(processEvent(invalidEvent)).rejects.toBeInstanceOf(
        PermanentError,
      );
    });

    it("B2エラーのhttpStatusCodeが403の場合はPermanentErrorになること", async () => {
      const b2Error = { name: "AccessDenied", $metadata: { httpStatusCode: 403 } };
      vi.mocked(deleteB2Object).mockRejectedValue(b2Error);

      await expect(processEvent(storageDeleteEvent)).rejects.toBeInstanceOf(
        PermanentError,
      );
    });

    it("B2エラーのhttpStatusCodeが401の場合はPermanentErrorになること", async () => {
      const b2Error = { name: "Unauthorized", $metadata: { httpStatusCode: 401 } };
      vi.mocked(deleteB2Object).mockRejectedValue(b2Error);

      await expect(processEvent(storageDeleteEvent)).rejects.toBeInstanceOf(
        PermanentError,
      );
    });

    it("B2エラーのhttpStatusCodeが400の場合はPermanentErrorになること", async () => {
      const b2Error = { name: "BadRequest", $metadata: { httpStatusCode: 400 } };
      vi.mocked(deleteB2Object).mockRejectedValue(b2Error);

      await expect(processEvent(storageDeleteEvent)).rejects.toBeInstanceOf(
        PermanentError,
      );
    });

    it("B2エラーのhttpStatusCodeが429の場合はTransientErrorになること（レートリミット）", async () => {
      const b2Error = { name: "TooManyRequests", $metadata: { httpStatusCode: 429 } };
      vi.mocked(deleteB2Object).mockRejectedValue(b2Error);

      await expect(processEvent(storageDeleteEvent)).rejects.toBeInstanceOf(
        TransientError,
      );
    });

    it("B2エラーのhttpStatusCodeが5xxの場合はTransientErrorになること", async () => {
      const b2Error = { name: "InternalError", $metadata: { httpStatusCode: 503 } };
      vi.mocked(deleteB2Object).mockRejectedValue(b2Error);

      await expect(processEvent(storageDeleteEvent)).rejects.toBeInstanceOf(
        TransientError,
      );
    });

    it("httpStatusCodeが取得できないエラー（ネットワーク断等）はTransientErrorになること", async () => {
      vi.mocked(deleteB2Object).mockRejectedValue(new Error("ECONNRESET"));

      await expect(processEvent(storageDeleteEvent)).rejects.toBeInstanceOf(
        TransientError,
      );
    });
  });
});
