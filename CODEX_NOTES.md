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

## 2026-07-17 — Lesson arc and callback retrieval

- Added a curriculum-configured lesson policy instead of hardcoding timing or subject behavior in the service.
- The first deployment now uses an eight-turn arc with explicit explore, independent-check, and recap phases.
- The live GPT-5.6 request now receives the current phase, turn count, previous prompt and diagnosis, and prior reasoning-evidence count.
- Enforced the two-evidence mastery rule in server code: a model cannot mark a learner secure from the first correct explanation.
- Preserved two distinct continuity behaviors: an immediate redial within fifteen minutes resumes the exact interrupted question, while a later return opens with a retrieval question.
- Completed lessons now create a new session on the next call and begin with retrieval practice instead of silently restarting the entry question.
- Verification: 26 of 26 automated tests and the 25-case offline teaching gate pass.

## 2026-07-17 — Live universal code-switching gate

- Added `npm run eval:live`, a deliberately small GPT-5.6 Luna evaluation that is separate from the default zero-credit test loop.
- The gate checks language tags, teaching strategy, and voice-safe formatting for synthetic Hindi/English, Spanish/English, and French/English learner turns.
- The first run scored 2/3. Luna correctly detected Spanish/English and correctly diagnosed supported reasoning, but chose `concrete_analogy` and repeated the solved example instead of moving to retrieval practice.
- Tightened the live prompt to evaluate meaning before isolated keywords, define the strategy taxonomy, and require a new transfer example after supported reasoning.
- The targeted Spanish/English rerun passed, followed by a full 3/3 regression pass. This is live evidence for arbitrary-language/code-switching architecture, not a claim that every language and accent has been field-validated.

## 2026-07-17 — Mission-control dashboard skeleton

- Added an auto-refreshing local dashboard at `/dashboard` with a JSON data surface at `/api/dashboard/sessions`.
- The dashboard shows recent sessions, learner/Nomad transcript pairs, diagnosis, mastery evidence, next strategy, language mode, and the actual model route recorded for each turn.
- Added a SQLite migration for per-turn model-route provenance; existing databases receive `unknown` for historical rows without losing data.
- Learners are represented by a one-way short reference derived from the internal learner ID. The dashboard snapshot excludes names, raw caller numbers, and phone hashes.
- Kept this local-only for now. It must not be exposed with real learner data until the planned consent, retention, and access-control work lands.
- Verified the complete page and API against a temporary offline lesson database. The response contained one anonymized session with the expected diagnosis strategy and route.
- Verification: 27 of 27 automated tests and the 25-case offline teaching gate pass.

## 2026-07-17 — Call admission and webhook reliability

- Added signed-webhook replay idempotency so OpenAI delivery retries cannot accept or allocate the same call twice.
- Added one-active-call-per-caller protection using the existing HMAC caller identity; a second simultaneous call is rejected before model or database resources are opened.
- Added a configurable sliding-window limit, defaulting to six call starts per caller per hour.
- Added the documented SIP reject boundary with status 486 for concurrent or over-limit calls.
- Bounded and time-pruned the in-memory webhook and caller admission maps to avoid turning the guard itself into an unbounded memory surface.
- Verification: 31 of 31 automated tests pass, including replay, concurrency, rate-window expiry, and SIP rejection coverage.

## 2026-07-17 — Voice-queryable learning history

- Added validated learning-history request and response contracts alongside the teaching-turn contract.
- Added `get_learning_history` to the Realtime tool set. It is available only after the caller selects a named profile.
- History queries collect only that learner's persisted lesson summaries, so siblings sharing a phone cannot hear each other's progress.
- GPT-5.6 Luna narrates live history in the saved language mode with `store: false`; Realtime is again limited to saying the authoritative `spoken_response` exactly.
- Added an offline narrator for zero-credit development without claiming it translates arbitrary languages.
- Added `npm run eval:live-history`; the synthetic Hindi/English history case passed with correct `hi-Latn+en` tagging and voice-safe formatting.
- Verification: 32 of 32 automated tests pass, including the sideband history handoff and shared-phone isolation.

## 2026-07-17 — Guarded curriculum compiler scaffold

- Added a provenance-bearing curriculum source-brief contract with official-source URLs, reviewed themes, required concepts, local context, and explicit originality requirements.
- Added a GPT-5.6 Terra compiler pass that produces the same universal pack schema used by the teaching engine.
- Added an independent verifier pass covering source grounding, original wording, schema completeness, voice formatting, answer consistency, and unreviewed-scope rejection.
- Trusted application code attaches source and model provenance after generation; the model cannot author its own provenance record.
- Added a create-only CLI that writes no output unless verification approves the pack with no error issues, and refuses to overwrite an existing reviewed artifact.
- Kept the hand-built fractions pack explicitly marked `hand_verified`.
- No live compiler request was run. Official source briefs and human spot-checks are required before generating the four additional subject packs.
- Verification: 35 of 35 automated tests pass, and the full curriculum draft schema successfully converts to the Responses Structured Outputs format.

## 2026-07-17 — Child-safety and untrusted-input boundary

- Added deployment-configured offline safety fixtures for unsafe, prompt-injection, and benign off-topic paths while keeping semantic live handling in GPT-5.6 for arbitrary languages.
- Added application-level redaction for likely emails, links, long phone-like numbers, and explicit address disclosures before both the model request and SQLite persistence. Short math notation remains intact.
- Live prompts now treat every learner answer as untrusted content and explicitly forbid instruction overrides, prompt disclosure, schema changes, safety bypasses, and frozen-curriculum escape.
- Added auditable `safety_redirect` behavior and a configured two-strike graceful lesson ending.
- Rebalanced the existing 25-case deterministic gate rather than inflating it with repetitive cases: it now includes unsafe, off-topic, and two jailbreak cases while preserving misconception, reasoning, insufficient-evidence, and multilingual coverage.
- The first live injection test resisted the request but mislabeled its strategy as `smaller_step`. Tightening the strategy contract fixed the issue; targeted and full live reruns then passed for prompt injection and an unsafe request.
- Added `docs/SAFETY_PRIVACY.md` with a pre-pilot consent checklist, exact data inventory, dashboard caveat, honest local-retention limitation, and supervised-prototype boundary.
- Verification: 41 of 41 automated tests, 25 of 25 deterministic eval cases, and 2 of 2 live Luna safety cases pass.

## 2026-07-17 — Evidence-based usage, cost, and dashboard eval gate

- Captured Responses API usage from both teaching and learning-history calls, including provider response ID, exact model route, total/cached text input, and text output.
- Captured every Realtime `response.done` usage event with separate text, cached-text, input-audio, cached-audio, and output-audio tokens. Opening usage is buffered until the caller selects a named profile, then attributed to that lesson.
- Added a durable SQLite usage ledger keyed to the anonymized lesson session rather than inferring cost from transcript length or call duration.
- Added dated exact-model pricing for GPT-5.6 Luna and GPT-Realtime-2.1 Mini. Unknown routes remain explicitly unpriced.
- Added `/api/dashboard/evals` and an Eval gate view that exposes all deterministic case outcomes, pass rate, and voice-friendly rate without spending API credit.
- Extended the session dashboard with recorded request/token totals and estimated API cost.
- Verification: 44 of 44 automated tests, 25 of 25 deterministic eval cases, API/HTML smoke checks, and strict TypeScript pass.

## 2026-07-17 — Latency choreography and measurement

- Added a strict Realtime pre-tool acknowledgment: fewer than six words, language-matched, neutral, and prohibited from judging correctness, hinting, answering, or asking a new question.
- Kept every teaching decision behind `get_teaching_turn`; the preamble is conversation-floor management only.
- Measured each live GPT-5.6 Responses request at the application boundary and persisted the duration alongside its exact usage record.
- Added average and maximum measured GPT-5.6 latency to the session dashboard.
- Ran one intentional live Luna teaching turn after the change. The request returned a correct retrieval-practice turn in 2,701 ms and persisted 1,936 input tokens, 270 output tokens, and the measured duration.
- Real phone mouth-to-ear latency, VAD, and barge-in tuning remain blocked on the Twilio number/SIP leg; the dashboard does not mislabel server request time as phone latency.
