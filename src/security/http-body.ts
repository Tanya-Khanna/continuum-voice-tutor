export class RequestBodyTooLargeError extends Error {
  constructor(readonly limitBytes: number) {
    super(`Request body exceeds the ${limitBytes}-byte limit.`);
    this.name = "RequestBodyTooLargeError";
  }
}

export async function readRequestBody(
  stream: NodeJS.ReadableStream,
  limitBytes = 1_000_000,
): Promise<string> {
  if (!Number.isSafeInteger(limitBytes) || limitBytes < 1) {
    throw new Error("Request body limit must be a positive safe integer.");
  }
  const chunks: Buffer[] = [];
  let receivedBytes = 0;
  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    receivedBytes += buffer.length;
    if (receivedBytes > limitBytes) {
      throw new RequestBodyTooLargeError(limitBytes);
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks, receivedBytes).toString("utf8");
}
