import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  processEvent,
  PermanentError,
  TransientError,
} from "../../src/processor";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// テスト用のダミーイベント
const baseEvent = {
  id: "evt-1",
  event_type: "todo.created", // EVENT_MAP に存在する型に合わせる
  event_version: 1,
  payload: {},
  idempotency_key: "idem-1",
  aggregate_id: "agg-1",
} as any;

describe("processEvent", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal("AbortSignal", {
      ...AbortSignal,
      timeout: vi.fn().mockReturnValue(new AbortController().signal),
    });
  });

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
});
