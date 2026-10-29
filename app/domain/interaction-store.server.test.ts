import { describe, expect, it, vi } from "vitest";
import { persistInteraction } from "./interaction-store.server";
const body = {
  p_event_id: "00000000-0000-4000-8000-000000000001",
  p_session_id: "00000000-0000-4000-8000-000000000002",
  p_event_name: "result_feedback",
  p_helpful: true,
};
function client(fetchImpl: typeof fetch) {
  return {
    config: { supabaseUrl: "https://db.example", serviceKey: "test" },
    fetchImpl,
  };
}
describe("idempotent analytics writes", () => {
  it("retries a lost response with exactly the same event and vote", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new DOMException("late response", "TimeoutError"))
      .mockResolvedValueOnce(Response.json(true));
    const wait = vi.fn(async () => {});
    expect(await persistInteraction(client(fetchImpl), body, wait)).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledWith(150);
    expect(fetchImpl.mock.calls[0]![1]?.body).toBe(
      fetchImpl.mock.calls[1]![1]?.body,
    );
    expect(String(fetchImpl.mock.calls[0]![0])).toContain(
      "record_partner_interaction_v3",
    );
  });
  it("retries a transient upstream failure once", async () => {
    const f = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(Response.json(true));
    expect(await persistInteraction(client(f), body, async () => {})).toBe(
      true,
    );
    expect(f).toHaveBeenCalledTimes(2);
  });
  it("does not retry a permanent permission failure", async () => {
    const f = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("denied", { status: 403 }));
    await expect(
      persistInteraction(client(f), body, async () => {}),
    ).rejects.toThrow();
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("returns a delivery-ID collision without retrying or overwriting it", async () => {
    const f = vi.fn<typeof fetch>().mockResolvedValue(Response.json(false));
    expect(await persistInteraction(client(f), body, async () => {})).toBe(
      false,
    );
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("stops after its second transient failure", async () => {
    const f = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError("network unavailable"));
    await expect(
      persistInteraction(client(f), body, async () => {}),
    ).rejects.toThrow();
    expect(f).toHaveBeenCalledTimes(2);
  });
});
