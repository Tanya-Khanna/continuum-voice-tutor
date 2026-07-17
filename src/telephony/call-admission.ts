export type CallAdmissionDecision =
  | "allowed"
  | "duplicate_webhook"
  | "caller_already_active"
  | "rate_limited";

export class CallAdmissionGuard {
  readonly #maxCallsPerWindow: number;
  readonly #windowMilliseconds: number;
  readonly #replayTtlMilliseconds: number;
  readonly #maxRememberedEvents: number;
  readonly #clock: () => number;
  readonly #seenEvents = new Map<string, number>();
  readonly #callStarts = new Map<string, number[]>();
  readonly #activeCallers = new Set<string>();

  constructor(options: {
    maxCallsPerWindow: number;
    windowMilliseconds?: number;
    replayTtlMilliseconds?: number;
    maxRememberedEvents?: number;
    clock?: () => number;
  }) {
    this.#maxCallsPerWindow = Math.max(
      1,
      Math.trunc(options.maxCallsPerWindow),
    );
    this.#windowMilliseconds = options.windowMilliseconds ?? 60 * 60 * 1_000;
    this.#replayTtlMilliseconds =
      options.replayTtlMilliseconds ?? 24 * 60 * 60 * 1_000;
    this.#maxRememberedEvents = options.maxRememberedEvents ?? 10_000;
    this.#clock = options.clock ?? Date.now;
  }

  begin(eventId: string, callerKey: string): CallAdmissionDecision {
    const now = this.#clock();
    this.#pruneEvents(now);
    this.#pruneCallStarts(now);
    if (this.#seenEvents.has(eventId)) return "duplicate_webhook";
    this.#seenEvents.set(eventId, now);
    while (this.#seenEvents.size > this.#maxRememberedEvents) {
      const oldestEventId = this.#seenEvents.keys().next().value as
        | string
        | undefined;
      if (!oldestEventId) break;
      this.#seenEvents.delete(oldestEventId);
    }

    if (this.#activeCallers.has(callerKey)) return "caller_already_active";
    const recentStarts = (this.#callStarts.get(callerKey) ?? []).filter(
      (startedAt) => now - startedAt < this.#windowMilliseconds,
    );
    if (recentStarts.length >= this.#maxCallsPerWindow) {
      this.#callStarts.set(callerKey, recentStarts);
      return "rate_limited";
    }

    recentStarts.push(now);
    this.#callStarts.set(callerKey, recentStarts);
    this.#activeCallers.add(callerKey);
    return "allowed";
  }

  end(callerKey: string): void {
    this.#activeCallers.delete(callerKey);
  }

  #pruneEvents(now: number): void {
    for (const [eventId, seenAt] of this.#seenEvents) {
      if (now - seenAt >= this.#replayTtlMilliseconds) {
        this.#seenEvents.delete(eventId);
      }
    }
  }

  #pruneCallStarts(now: number): void {
    for (const [callerKey, starts] of this.#callStarts) {
      const recentStarts = starts.filter(
        (startedAt) => now - startedAt < this.#windowMilliseconds,
      );
      if (recentStarts.length === 0 && !this.#activeCallers.has(callerKey)) {
        this.#callStarts.delete(callerKey);
      } else {
        this.#callStarts.set(callerKey, recentStarts);
      }
    }
  }
}
