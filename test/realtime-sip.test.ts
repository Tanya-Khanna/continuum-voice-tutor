import { describe, expect, it, vi } from "vitest";
import {
  acceptRealtimeCall,
  buildRealtimeAcceptPayload,
  buildSipTarget,
} from "../src/telephony/realtime-sip.js";

describe("Realtime SIP boundary", () => {
  it("builds the OpenAI SIP target for Twilio", () => {
    expect(buildSipTarget("proj_example")).toBe(
      "sip:proj_example@sip.api.openai.com;transport=tls",
    );
  });

  it("uses the current Realtime model in the accept payload", () => {
    expect(buildRealtimeAcceptPayload()).toMatchObject({
      type: "realtime",
      model: "gpt-realtime-2.1",
    });
  });

  it("accepts a call through the documented endpoint without real network use", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, { status: 200 }),
    );

    await acceptRealtimeCall({
      apiKey: "test-key",
      callId: "call_123",
      payload: buildRealtimeAcceptPayload(),
      fetchImplementation,
    });

    expect(fetchImplementation).toHaveBeenCalledWith(
      "https://api.openai.com/v1/realtime/calls/call_123/accept",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
