import { describe, expect, it, vi } from "vitest";
import {
  acceptRealtimeCall,
  buildSipTarget,
  callerNumberFromIncomingCall,
  rejectRealtimeCall,
} from "../src/telephony/sip.js";
import {
  buildOpenTopicRealtimeAcceptPayload,
  buildOpenTopicToolUpdate,
} from "../src/telephony/open-topic-realtime.js";

describe("Realtime SIP boundary", () => {
  it("builds the OpenAI SIP target for Twilio", () => {
    expect(buildSipTarget("proj_example")).toBe(
      "sip:proj_example@sip.api.openai.com;transport=tls",
    );
  });

  it("uses the current Realtime model in the accept payload", () => {
    expect(buildOpenTopicRealtimeAcceptPayload()).toMatchObject({
      type: "realtime",
      model: "gpt-realtime-2.1-mini",
      audio: {
        input: {
          transcription: { model: "gpt-4o-mini-transcribe" },
          turn_detection: {
            type: "server_vad",
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 650,
            create_response: false,
            interrupt_response: true,
          },
        },
        output: { voice: "marin", speed: 0.8 },
      },
      tool_choice: "auto",
    });
    expect(
      buildOpenTopicRealtimeAcceptPayload().tools.map((tool) => tool.name),
    ).toEqual([
      "select_language",
      "start_lesson",
      "teach_open_topic",
      "record_teaching_feedback",
      "save_learning_preferences",
      "recover_unclear_audio",
      "propose_exam_reminder",
      "propose_callback_reminder",
      "confirm_sms_reminder",
    ]);
    const teachingTool = buildOpenTopicRealtimeAcceptPayload().tools.find(
      (tool) => tool.name === "teach_open_topic",
    );
    expect(teachingTool?.parameters).toMatchObject({
      properties: {
        learner_input: expect.objectContaining({ type: "string" }),
      },
    });
    expect(buildOpenTopicRealtimeAcceptPayload().instructions).toContain(
      "call recover_unclear_audio",
    );
    expect(buildOpenTopicRealtimeAcceptPayload().instructions).toContain(
      "There is no subject menu",
    );
    expect(buildOpenTopicRealtimeAcceptPayload().instructions).toContain(
      "Continuum's realtime conversation layer",
    );
    expect(buildOpenTopicRealtimeAcceptPayload().instructions).not.toContain(
      "Nomad",
    );
  });

  it("exposes only the tools needed for each live call stage", () => {
    expect(
      buildOpenTopicToolUpdate("language").session.tools.map(
        (tool) => tool.name,
      ),
    ).toEqual(["select_language", "recover_unclear_audio"]);
    expect(
      buildOpenTopicToolUpdate("identity").session.tools.map(
        (tool) => tool.name,
      ),
    ).toEqual(["start_lesson", "recover_unclear_audio"]);
    expect(
      buildOpenTopicToolUpdate("open_topic").session.tools.map(
        (tool) => tool.name,
      ),
    ).toContain("teach_open_topic");
    expect(
      buildOpenTopicToolUpdate("identity", {
        languageMode: "hi",
        displayName: "Hindi",
      }).session.instructions,
    ).toContain("Speak only in Hindi");
    expect(
      buildOpenTopicToolUpdate("identity", {
        languageMode: "hi",
        displayName: "Hindi",
      }).session.instructions,
    ).toContain("Do not fall back to English");
  });

  it("keeps barge-in enabled when tuning server VAD", () => {
    expect(
      buildOpenTopicRealtimeAcceptPayload("gpt-realtime-2.1-mini", "marin", {
        type: "server_vad",
        threshold: 0.65,
        prefix_padding_ms: 450,
        silence_duration_ms: 900,
        create_response: false,
        interrupt_response: true,
      }).audio.input.turn_detection,
    ).toEqual({
      type: "server_vad",
      threshold: 0.65,
      prefix_padding_ms: 450,
      silence_duration_ms: 900,
      create_response: false,
      interrupt_response: true,
    });
  });

  it("accepts only documented Realtime playback speeds", () => {
    const turnDetection =
      buildOpenTopicRealtimeAcceptPayload().audio.input.turn_detection;
    expect(
      buildOpenTopicRealtimeAcceptPayload(
        "gpt-realtime-2.1-mini",
        "marin",
        turnDetection,
        0.75,
      ).audio.output.speed,
    ).toBe(0.75);
    expect(() =>
      buildOpenTopicRealtimeAcceptPayload(
        "gpt-realtime-2.1-mini",
        "marin",
        turnDetection,
        0.2,
      ),
    ).toThrow();
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
      payload: buildOpenTopicRealtimeAcceptPayload(),
      fetchImplementation,
    });

    expect(fetchImplementation).toHaveBeenCalledWith(
      "https://api.openai.com/v1/realtime/calls/call_123/accept",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
