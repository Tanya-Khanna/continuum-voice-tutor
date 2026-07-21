import { describe, expect, it, vi } from "vitest";
import {
  applyCarrierStatusWebhook,
  applyTwilioCallResource,
  carrierCallStatusCallbackUrl,
  createCarrierCallReceipt,
  fetchTwilioCallResource,
  markCarrierCallQueued,
} from "../src/telephony/carrier-usage.js";
import { SqliteLearningRepository } from "../src/persistence/sqlite-learning-repository.js";
import { TwilioMessageStatusWebhookSchema } from "../src/domain/carrier-usage.js";

const CALL_SID = `CA${"a".repeat(32)}`;

describe("carrier usage receipts", () => {
  it("accepts Twilio's temporary zero segment count", () => {
    expect(
      TwilioMessageStatusWebhookSchema.parse({
        MessageSid: `SM${"c".repeat(32)}`,
        MessageStatus: "queued",
        NumSegments: "0",
      }).NumSegments,
    ).toBe(0);
  });

  it("persists a receipt and ignores out-of-order status callbacks", () => {
    const repository = new SqliteLearningRepository(":memory:");
    const created = createCarrierCallReceipt({
      id: "receipt-1",
      kind: "scheduled",
      learnerId: "learner-1",
      requestedDurationMinutes: 5,
      now: "2026-07-20T12:00:00.000Z",
      synthetic: true,
    });
    const queued = markCarrierCallQueued(
      created,
      CALL_SID,
      "2026-07-20T12:00:01.000Z",
    );
    repository.saveCarrierCallReceipt(queued);

    const completed = applyCarrierStatusWebhook({
      receipt: queued,
      payload: {
        CallSid: CALL_SID,
        CallStatus: "completed",
        SequenceNumber: "3",
        CallDuration: "42",
      },
      now: "2026-07-20T12:01:00.000Z",
    });
    expect(completed).toMatchObject({
      advanced: true,
      becameTerminal: true,
      receipt: { status: "completed", durationSeconds: 42 },
    });
    repository.saveCarrierCallReceipt(completed.receipt);

    expect(
      applyCarrierStatusWebhook({
        receipt: completed.receipt,
        payload: {
          CallSid: CALL_SID,
          CallStatus: "in-progress",
          SequenceNumber: "2",
        },
        now: "2026-07-20T12:01:01.000Z",
      }),
    ).toMatchObject({ advanced: false, becameTerminal: false });
    expect(repository.findCarrierCallReceipt("receipt-1")).toEqual(
      completed.receipt,
    );
    expect(repository.findCarrierCallReceiptByProviderSid(CALL_SID)).toEqual(
      completed.receipt,
    );
    repository.close();
  });

  it("attaches eventual Twilio duration and a positive USD cost receipt", () => {
    const receipt = createCarrierCallReceipt({
      id: "receipt-2",
      kind: "missed_call",
      now: "2026-07-20T12:00:00.000Z",
    });
    expect(
      applyTwilioCallResource({
        receipt: markCarrierCallQueued(
          receipt,
          CALL_SID,
          "2026-07-20T12:00:01.000Z",
        ),
        resource: {
          sid: CALL_SID,
          status: "completed",
          duration: "61",
          price: "-0.0142",
          price_unit: "USD",
        },
        now: "2026-07-20T12:02:00.000Z",
      }),
    ).toMatchObject({
      status: "completed",
      durationSeconds: 61,
      priceAmount: 0.0142,
      priceCurrency: "USD",
      priceFetchAttempts: 1,
    });
  });

  it("builds an opaque receipt URL and fetches the Call resource safely", async () => {
    expect(
      carrierCallStatusCallbackUrl(
        "https://continuum.example",
        "receipt with spaces",
      ),
    ).toBe(
      "https://continuum.example/webhooks/twilio/call-status?receipt_id=receipt+with+spaces",
    );
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          sid: CALL_SID,
          status: "completed",
          duration: "12",
          price: null,
          price_unit: "USD",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    await expect(
      fetchTwilioCallResource({
        accountSid: `AC${"b".repeat(32)}`,
        authToken: "secret-token",
        callSid: CALL_SID,
        fetchImplementation,
      }),
    ).resolves.toMatchObject({ sid: CALL_SID });
    expect(
      new Headers(fetchImplementation.mock.calls[0]![1]?.headers).get(
        "Authorization",
      ),
    ).toMatch(/^Basic /u);
  });
});
