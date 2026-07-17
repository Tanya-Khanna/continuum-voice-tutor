import { describe, expect, it, vi } from "vitest";
import {
  acceptRealtimeCall,
  buildRealtimeAcceptPayload,
  buildSipTarget,
  callerNumberFromIncomingCall,
  rejectRealtimeCall,
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
      model: "gpt-realtime-2.1-mini",
      audio: { output: { voice: "marin" } },
      tool_choice: "auto",
    });
    expect(buildRealtimeAcceptPayload().tools.map((tool) => tool.name)).toEqual([
      "start_lesson",
      "get_teaching_turn",
      "get_learning_history",
    ]);
  });

  it("extracts the caller identity from the documented SIP From header", () => {
    expect(
      callerNumberFromIncomingCall({
        id: "evt_123",
        type: "realtime.call.incoming",
        data: {
          call_id: "rtc_123",
          sip_headers: [
            { name: "From", value: '"Ravi" <sip:+919999900001@carrier.test>' },
          ],
        },
      }),
    ).toBe("+919999900001");
  });

  it("rejects a call through the documented endpoint", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, { status: 200 }),
    );

    await rejectRealtimeCall({
      apiKey: "test-key",
      callId: "call_busy",
      statusCode: 486,
      fetchImplementation,
    });

    expect(fetchImplementation).toHaveBeenCalledWith(
      "https://api.openai.com/v1/realtime/calls/call_busy/reject",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ status_code: 486 }),
      }),
    );
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
