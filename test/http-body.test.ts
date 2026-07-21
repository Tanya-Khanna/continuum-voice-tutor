import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import {
  RequestBodyTooLargeError,
  readRequestBody,
} from "../src/security/http-body.js";

describe("bounded HTTP body reading", () => {
  it("joins an in-bounds streamed body", async () => {
    await expect(
      readRequestBody(Readable.from(["signed=", "payload"]), 32),
    ).resolves.toBe("signed=payload");
  });

  it("fails before buffering an oversized webhook body", async () => {
    await expect(
      readRequestBody(Readable.from([Buffer.alloc(8), Buffer.alloc(8)]), 12),
    ).rejects.toBeInstanceOf(RequestBodyTooLargeError);
  });

  it("rejects invalid limits", async () => {
    await expect(readRequestBody(Readable.from(["x"]), 0)).rejects.toThrow(
      /positive safe integer/u,
    );
  });
});
