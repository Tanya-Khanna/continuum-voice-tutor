# Codex Notes

## 2026-07-16 — D0 and first build milestone

### Builder decisions

- Start building the zero-credit foundation now.
- Add OpenAI API credits later.
- Defer the Twilio paid upgrade until the build-plan gate after the text tutor is working.
- Use the updated `BUILD_PLAN.md` from the Desktop project folder as the only plan source.

### Completed setup

- Created the private GitHub repository and added the MIT license.
- Confirmed Codex Sol, Terra, and Luna availability.
- Created the Twilio account; billing and number purchase remain intentionally deferred.
- Added the official OpenAI developer-docs MCP server to Codex configuration. A Codex restart may be required before it appears as a callable connector.

### Build started

- Copied the updated plan byte-for-byte to `docs/BUILD_PLAN.md`.
- Added repository instructions, strict TypeScript configuration, and credential-safe environment templates.
- Began the offline fractions tutor so development and evaluation do not consume API or telephony credits.

### Milestone 1 verification

- Added a frozen, schema-validated Grade 6 unit-fractions curriculum pack.
- Added a deterministic offline Socratic engine with misconception diagnosis, answer-request handling, evidence-based mastery, Hinglish detection, and voice-friendly output.
- Added a live OpenAI Responses adapter using Structured Outputs and `store: false`; it remains disabled without an API key.
- Added the verified Realtime SIP target, incoming-call schema, signed-webhook boundary, and call-accept request without attempting a paid call.
- Added `npm run chat`, `/health`, and 12 automated tests.
- `npm run typecheck`: passed.
- `npm test`: 12 of 12 passed.
- CLI smoke test: passed in offline mode.
- Health endpoint smoke test: returned `ok: true`, offline engine, Realtime not configured.

### Still open

- Fund the OpenAI API and run one controlled live Responses request.
- Finish Twilio onboarding only when the D2 gate calls for it; buy/configure the number and SIP trunk then.
- Measure phone latency, tune VAD/barge-in, and verify disconnect/resume on a real call.
- Persist learner profiles and call state in a durable database.

### Model roles

- Luna: high-volume teaching turns and evals.
- Terra: curriculum compilation and balanced reasoning tasks.
- Sol: difficult review, safety, and misconception-analysis passes.
- Realtime: phone-call speech experience through SIP.
