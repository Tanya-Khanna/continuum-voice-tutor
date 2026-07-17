import { describe, expect, it } from "vitest";
import { CallAdmissionGuard } from "../src/telephony/call-admission.js";

describe("call admission guard", () => {
  it("deduplicates webhook retries without consuming another call", () => {
    const guard = new CallAdmissionGuard({ maxCallsPerWindow: 2 });

    expect(guard.begin("evt_1", "caller_a")).toBe("allowed");
    guard.end("caller_a");
    expect(guard.begin("evt_1", "caller_a")).toBe("duplicate_webhook");
    expect(guard.begin("evt_2", "caller_a")).toBe("allowed");
  });

  it("blocks simultaneous calls from one caller but not another", () => {
    const guard = new CallAdmissionGuard({ maxCallsPerWindow: 3 });

    expect(guard.begin("evt_1", "caller_a")).toBe("allowed");
    expect(guard.begin("evt_2", "caller_a")).toBe(
      "caller_already_active",
    );
    expect(guard.begin("evt_3", "caller_b")).toBe("allowed");
  });

  it("limits starts in a sliding window and allows calls after expiry", () => {
    let now = 0;
    const guard = new CallAdmissionGuard({
      maxCallsPerWindow: 2,
      windowMilliseconds: 1_000,
      replayTtlMilliseconds: 5_000,
      clock: () => now,
    });

    expect(guard.begin("evt_1", "caller_a")).toBe("allowed");
    guard.end("caller_a");
    now = 200;
    expect(guard.begin("evt_2", "caller_a")).toBe("allowed");
    guard.end("caller_a");
    now = 400;
    expect(guard.begin("evt_3", "caller_a")).toBe("rate_limited");
    now = 1_201;
    expect(guard.begin("evt_4", "caller_a")).toBe("allowed");
  });
});
