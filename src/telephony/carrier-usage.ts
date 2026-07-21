import {
  CarrierCallReceiptSchema,
  TwilioCallResourceSchema,
  TwilioCallStatusWebhookSchema,
  carrierStatusFromTwilio,
  terminalCarrierCallStatus,
  type CarrierCallReceipt,
} from "../domain/carrier-usage.js";

export function carrierCallStatusCallbackUrl(
  publicBaseUrl: string,
  receiptId: string,
): string {
  const url = new URL("/webhooks/twilio/call-status", publicBaseUrl);
  url.searchParams.set("receipt_id", receiptId);
  return url.toString();
}

export function createCarrierCallReceipt(options: {
  id: string;
  kind: "missed_call" | "scheduled";
  now: string;
  learnerId?: string;
  callbackJobId?: string;
  requestedDurationMinutes?: 3 | 5 | 10;
  synthetic?: boolean;
}): CarrierCallReceipt {
  return CarrierCallReceiptSchema.parse({
    id: options.id,
    providerCallSid: null,
    kind: options.kind,
    learnerId: options.learnerId ?? null,
    callbackJobId: options.callbackJobId ?? null,
    requestedDurationMinutes: options.requestedDurationMinutes ?? null,
    status: "creating",
    sequenceNumber: -1,
    durationSeconds: null,
    priceAmount: null,
    priceCurrency: null,
    priceFetchAttempts: 0,
    missedNoticeSent: false,
    synthetic: options.synthetic ?? false,
    createdAt: options.now,
    updatedAt: options.now,
    completedAt: null,
  });
}

export function markCarrierCallQueued(
  receipt: CarrierCallReceipt,
  providerCallSid: string,
  now: string,
): CarrierCallReceipt {
  return CarrierCallReceiptSchema.parse({
    ...receipt,
    providerCallSid,
    status:
      receipt.status === "creating" || receipt.status === "queued"
        ? "queued"
        : receipt.status,
    updatedAt: now,
  });
}

export function applyCarrierStatusWebhook(options: {
  receipt: CarrierCallReceipt;
  payload: unknown;
  now: string;
}): { receipt: CarrierCallReceipt; advanced: boolean; becameTerminal: boolean } {
  const payload = TwilioCallStatusWebhookSchema.parse(options.payload);
  if (
    options.receipt.providerCallSid &&
    options.receipt.providerCallSid !== payload.CallSid
  ) {
    throw new Error("Carrier status CallSid does not match its receipt.");
  }
  if (payload.SequenceNumber <= options.receipt.sequenceNumber) {
    return { receipt: options.receipt, advanced: false, becameTerminal: false };
  }
  const status = carrierStatusFromTwilio(payload.CallStatus);
  const wasTerminal = terminalCarrierCallStatus(options.receipt.status);
  const becameTerminal = !wasTerminal && terminalCarrierCallStatus(status);
  return {
    receipt: CarrierCallReceiptSchema.parse({
      ...options.receipt,
      providerCallSid: payload.CallSid,
      status,
      sequenceNumber: payload.SequenceNumber,
      durationSeconds:
        payload.CallDuration ?? options.receipt.durationSeconds,
      updatedAt: options.now,
      completedAt: becameTerminal
        ? options.now
        : options.receipt.completedAt,
    }),
    advanced: true,
    becameTerminal,
  };
}

export function applyTwilioCallResource(options: {
  receipt: CarrierCallReceipt;
  resource: unknown;
  now: string;
}): CarrierCallReceipt {
  const resource = TwilioCallResourceSchema.parse(options.resource);
  if (
    options.receipt.providerCallSid &&
    options.receipt.providerCallSid !== resource.sid
  ) {
    throw new Error("Twilio Call resource does not match its receipt.");
  }
  const duration = resource.duration === null || resource.duration === undefined
    ? options.receipt.durationSeconds
    : Number(resource.duration);
  const price = resource.price === null || resource.price === undefined
    ? options.receipt.priceAmount
    : Math.abs(Number(resource.price));
  const status = carrierStatusFromTwilio(resource.status);
  return CarrierCallReceiptSchema.parse({
    ...options.receipt,
    providerCallSid: resource.sid,
    status: terminalCarrierCallStatus(status) ? status : options.receipt.status,
    durationSeconds: duration,
    priceAmount: price,
    priceCurrency: resource.price_unit ?? options.receipt.priceCurrency,
    priceFetchAttempts: options.receipt.priceFetchAttempts + 1,
    updatedAt: options.now,
    completedAt:
      terminalCarrierCallStatus(status) && !options.receipt.completedAt
        ? options.now
        : options.receipt.completedAt,
  });
}

export async function fetchTwilioCallResource(options: {
  accountSid: string;
  authToken: string;
  callSid: string;
  fetchImplementation?: typeof fetch;
}): Promise<unknown> {
  const response = await (options.fetchImplementation ?? fetch)(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(options.accountSid)}/Calls/${encodeURIComponent(options.callSid)}.json`,
    {
      headers: {
        Authorization: `Basic ${Buffer.from(`${options.accountSid}:${options.authToken}`).toString("base64")}`,
      },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) {
    throw new Error(`Twilio Call receipt lookup failed with status ${response.status}.`);
  }
  return response.json();
}
