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

- Run controlled Terra and Sol smoke checks only if they materially affect routing.
- Finish Twilio onboarding only when the D2 gate calls for it; buy/configure the number and SIP trunk then.
- Measure phone latency, tune VAD/barge-in, and verify disconnect/resume on a real call.

## 2026-07-16 — Milestone 2: continuity and evaluation

- Added a local SQLite learning database with HMAC-pseudonymized caller numbers, named profiles, lesson sessions, and turn history.
- Added shared-phone identity: Ravi and Asha can use one caller number without mixing their progress.
- Added durable interruption recovery: exit the CLI, restart it with the same name and number, and the exact pending question resumes.
- Added a three-question, evidence-scored placement diagnostic.
- Added a frozen 25-case text evaluation across misconceptions, answer requests, correct reasoning, insufficient evidence, Hinglish, and voice formatting.
- The first eval scored 22 of 25 and revealed two missing Hinglish markers plus one incorrect expected result. After correcting the detector and the expectation, the gate reached 25 of 25.
- `npm run check`: 19 of 19 tests passed with strict typechecking.
- `npm run eval`: 25 of 25 cases passed; voice-friendly output 100%.
- CLI new-session, saved-session, cross-process resume, and placement-diagnostic smoke tests passed.

### Still open after Milestone 2

- Run model-based evaluator passes when API funding is available; the current gate is deterministic and offline.
- Build the 8–10 minute lesson arc and retrieval callback loop.
- Add the remaining four Grade 6 subject packs and curriculum compiler.
- Finish the real phone pipeline, latency measurement, VAD/barge-in tuning, and live disconnect/resume proof.

## 2026-07-17 — First live GPT-5.6 API check

- Builder added $5 of prepaid OpenAI API credit and kept auto-recharge off.
- Created a restricted project key with model-list read access plus Responses and Realtime request access.
- Stored the key only in local `.env`; verified the file is ignored by Git and set its permissions to owner-only.
- Ran one GPT-5.6 Luna Responses API call with Structured Outputs.
- The live model correctly diagnosed the larger-denominator misconception and selected a concrete roti analogy.
- No Realtime audio request has run yet; the phone/audio gate remains open.

## 2026-07-16 — Universal-product correction

- Builder clarified that Nomad is a universal product; India, Hinglish, and fractions are only deployment #1.
- Removed the closed English/Hindi/Hinglish language enum. Model-facing state now accepts arbitrary BCP-47-style language tags and code-switching combinations.
- Moved all fraction questions, answer signals, misconceptions, analogies, evidence rules, and response scaffolds out of the engine and into the India fractions curriculum pack.
- Added a generic curriculum teaching engine that resolves behavior entirely from the selected pack.
- Made lesson entry and placement diagnostics pack-driven instead of fractions-driven.
- Added `NOMAD_CURRICULUM_PATH`, allowing any validated deployment pack to be selected without changing engine code.
- Diversified the offline multilingual eval fixtures across Hindi/English code-switching, Spanish, Swahili, and Tamil.
- Added a separate Grade 6 science fixture test to prove a new subject/country/language can use the same engine without modifying its code.
- Universal refactor verification: 20 of 20 automated tests and 25 of 25 offline teaching evals passed.
- Reopened the build-plan code-switching prompt item until it passes a live model evaluation; offline keyword detection is explicitly only a configurable test adapter.

### Model roles

- Luna: high-volume teaching turns and evals.
- Terra: curriculum compilation and balanced reasoning tasks.
- Sol: difficult review, safety, and misconception-analysis passes.
- Realtime: phone-call speech experience through SIP.

## 2026-07-17 — Realtime sideband teaching bridge

- Implemented the actual two-layer call controller: Realtime owns listening, speech, and turn-taking; the server owns identity, curriculum state, and every teaching decision.
- Added `start_lesson` and `get_teaching_turn` tools. Realtime must ask for a learner name first, then route every substantive answer to the teaching engine instead of teaching directly.
- Connected accepted SIP calls to their documented server-side sideband WebSocket using the webhook `call_id`.
- Extracted the caller number from the documented SIP `From` header and retained phone-number-plus-name shared-phone resume behavior.
- Added serialized tool processing and call-ID idempotency because Realtime can surface the same completed function call in more than one lifecycle event.
- Added exact `function_call_output` handoff followed by `response.create`; Realtime is instructed to speak the teaching engine's `spoken_response` without adding or rewriting content.
- Removed a leftover Grade 6 phrase from the live model instructions; grade remains deployment-pack data rather than a core-engine assumption.
- A closed control socket pauses the current lesson before its database connection is released, preserving disconnect recovery.
- Changed the development voice model default to `gpt-realtime-2.1-mini`; `marin` is a provisional voice until the planned catalog listen-through.
- Ran the first live Realtime request as a text-only tool-routing smoke. Realtime Mini correctly called `start_lesson`; no audio tokens and no GPT-5.6 teaching request were used in this smoke.
- Verification after the bridge: strict TypeScript passed, 23 of 23 automated tests passed, and the 25-case offline teaching gate remained green.

### Still open after the bridge

- Complete Twilio number purchase and SIP trunk setup, then place the first real call.
- Confirm phone audio format, choose the final voice, measure latency, and tune VAD/barge-in.
- Run the live mid-call disconnect/resume gate over the phone.
