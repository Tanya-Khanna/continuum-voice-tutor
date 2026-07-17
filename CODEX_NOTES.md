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

## 2026-07-17 — Computed rational-comparison truth

- Added a bounded rational-number comparison contract to universal curriculum concepts.
- Frozen packs now verify every declared comparison by integer cross-multiplication during schema parsing; no generated expression or `eval` is executed.
- Added machine-verifiable claims for the flagship one-third versus one-fourth and one-fifth versus one-eighth transfer examples.
- Updated compiler and verifier instructions to require matching machine checks for numerical fraction claims.
- Added a fail-closed regression proving that a pack declaring one fourth greater than one third is rejected.
- Verification: 47 of 47 automated tests, 25 of 25 deterministic teaching evals, strict TypeScript, and curriculum Structured Outputs conversion pass.

## 2026-07-17 — Universal code-switched sample exhibit

- Added a reusable sample-session manifest whose language modes use the same arbitrary BCP-47-style tags as live teaching.
- Created a 33-second Spanish-English Socratic misconception-and-transfer fixture with distinct synthetic learner and Nomad voices.
- Labeled the exhibit explicitly as curated synthetic audio, not a child or live-call recording.
- Added a dashboard Sample tab with native audio controls, active-line synchronization, and click-to-seek transcript rows.
- Added a byte-range-capable audio endpoint so browser playback and seeking work reliably.
- The official TTS-1 HD request was attempted but the restricted key returned missing scope `api.model.audio.request`; the checked-in asset therefore uses the documented zero-credit local system-voice fallback. The OpenAI regeneration path remains available after the key scope changes.
- Verification: 49 of 49 automated tests, exact 32.65-second MP3 inspection, sample manifest/API checks, 206 byte-range smoke, dashboard HTML smoke, and strict TypeScript pass.

## 2026-07-17 — Curious Sandbox with honest uncertainty

- Added a separate structured Curious Sandbox contract for explicit ask-anything requests after learner identity is established.
- The live GPT-5.6 path detects arbitrary language combinations, supplies a small Socratic response, records low/medium/high certainty, and returns exactly one follow-up question.
- Current, local, disputed, or otherwise unverifiable claims must use low certainty; unsafe and prompt-injection requests use the same redirect boundary as guided teaching.
- Sandbox questions are PII-redacted before model access and persistence, stored in a dedicated SQLite trace, and never update guided turn counts or mastery.
- Added `get_sandbox_turn` to the Realtime tools while forbidding silent routing of ordinary guided answers into Sandbox.
- Mission control merges Sandbox interactions into the chronological transcript and labels their mastery status `not_assessed`.
- The zero-credit fallback makes no open-world factual claim. One live Luna Spanish-English current-weather case passed language, safety, low-certainty, and voice-format checks.
- Verification: 51 of 51 automated tests, 25 of 25 deterministic teaching evals, 1 of 1 live Sandbox gate, and strict TypeScript pass.

## 2026-07-17 — Metadata-driven voice menu

- Added required `deployment.subject` metadata to universal curriculum/source-brief contracts; compiler instructions must copy the reviewed subject exactly.
- Changed the call opening to name → subject-versus-Sandbox menu → explicit `choose_learning_mode` selection.
- Added a server-side guard that refuses `get_teaching_turn` before guided mode is selected, so Realtime cannot skip onboarding.
- Realtime can localize only the non-decision menu and opening prompt while preserving all options and meaning; structured teaching, history, and Sandbox responses remain exact.
- Verified the menu is not Math-hardcoded by loading an example Geography deployment and observing `guided Geography` without engine changes.
- Extended the live text-only Realtime smoke through both `start_lesson` and `choose_learning_mode`; GPT-Realtime-2.1 Mini routed both correctly.
- Verification: 53 of 53 automated tests, live Realtime name+menu routing, 25 of 25 deterministic teaching evals, and strict TypeScript pass.

## 2026-07-17 — Persisted semantic placement in the call flow

- Added persistent placement level, score, total, and per-question evidence to learner profiles with a backward-compatible SQLite migration.
- Guided mode now returns the curriculum pack's placement questions for every unplaced learner and blocks teaching until `complete_placement` succeeds.
- Realtime retains faithful answers and submits them; it never scores, rewrites, or answers the diagnostic itself.
- Live GPT-5.6 evaluates semantic answer/reasoning evidence across arbitrary languages. Trusted application code validates question IDs, computes the score and level, and selects only a pack-declared concept.
- The zero-credit engine keeps deterministic signal scoring for repeatable local tests without pretending those signals are a universal language evaluator.
- Added a real foundational equal-shares concept. Learners without fraction evidence now begin there, while grade-ready learners begin at unit-fraction comparison.
- Placement level reaches each teaching request for pace/scaffold adaptation and is displayed with evidence in mission control.
- Extended the live Realtime smoke through name, menu, and placement tool routing. A separate live Luna Spanish placement gate passed three of three as grade-ready.
- Verification: 56 of 56 automated tests, 25 of 25 deterministic teaching evals, live Realtime three-tool routing, 1 of 1 live Spanish placement gate, backward-compatible database migration, and strict TypeScript pass.

## 2026-07-17 — Opt-in language-matched SMS recap

- Added a dependency-free Twilio Messages REST boundary using form encoding and HTTP Basic authentication, with request validation, a ten-second timeout, and sanitized failures that do not expose credentials or provider response text.
- SMS is disabled by default and fails closed at startup if explicitly enabled without a complete Account SID, auth token, and Twilio sender number.
- A normal guided lesson recap schedules the exact already-language-matched `spoken_response` to the originating caller after the authoritative Realtime output is sent. Messaging failure cannot replace the voice result or undo lesson state.
- Realtime function-call idempotency plus a controller completion guard limits the recap to one attempt per call. Curious Sandbox and safety-forced endings never trigger it.
- The prototype deliberately does not collect or infer a parent number. Shared-phone recipient consent, lock-screen disclosure, provider retention, opt-out handling, and local messaging compliance remain pre-pilot requirements.
- No live SMS was sent because Twilio number/upgrade setup remains an external account gate. Verification used an exact mock of Twilio's documented Messages request.
- Verification: 62 of 62 automated tests, including request/auth shape, default-off configuration, missing-credential fail-closed behavior, exactly-once completion, and safety-ending exclusion; strict TypeScript passes.

## 2026-07-17 — Universal curriculum vocabulary bridging

- Replaced the plan's Hindi-to-English prompt shorthand with a universal pack contract: every concept now declares canonical curriculum terms, each term's own language, a voice-friendly meaning, informal-expression test signals, and deterministic fallback bridge copy.
- Live GPT-5.6 instructions preserve the learner's informal or other-language expression, connect it briefly to the pack's reviewed term, explain it in the learner's current language pattern, and continue Socratically. Language choice is not treated as weak subject reasoning.
- The offline engine contains only a generic signal-to-bridge mechanism. A separate Science/Swahili-English fixture introduces `mass` from the learner's word `heaviness` without exposing any fraction or Hindi-specific behavior.
- Curriculum source briefs can declare required vocabulary. Trusted application code now checks the exact concept ID, canonical term, term language, and reviewed meaning after compilation and before verification, failing closed on substitutions.
- Added denominator, unit-fraction, and equal-shares bridges to the flagship pack. Offline signals remain test fixtures, not a closed list of phrases the live product understands.
- Verification: 65 of 65 automated tests, the 25-of-25 deterministic teaching gate, Structured Outputs schema conversion, and strict TypeScript pass.

## 2026-07-17 — Spend-gated GPT-5.6 agent evaluation pilot

- Added ten reviewed semantic scenarios covering correct reasoning, correct answer with wrong reasoning, the denominator misconception, Hindi-only confusion, Spanish-English and French-English switching, answer pressure, benign off-topic drift, unsafe content, and prompt injection.
- Each live case makes three explicit GPT-5.6 calls: a synthetic learner produces a natural utterance from intent rather than a fixed answer, the production teaching engine responds, and an independent evaluator grades diagnosis, language, voice format, answer leakage, follow-up quality, mastery justification, and safety.
- Trusted application checks independently enforce required language tags, an allowed strategy set, exactly one spoken question, no Markdown or symbolic fractions, and no answer reveal under pressure. Model evaluation cannot override these failures.
- The CLI refuses to spend without `--confirm-spend`, supports one-case targeting, records all three model routes and text-token totals, and writes the latest validated report to a Git-ignored `.data` path.
- Mission Control now shows the saved semantic report below the deterministic zero-credit gate, or states plainly that no agent run exists.
- Ran only the Spanish-English switch case. It passed with `es+en`, `retrieval_practice`, an independent evaluator pass, and no structural failures. The three calls recorded 4,064 input and 684 output text tokens.
- This is a ten-scenario semantic pilot, not the plan's completed 24-case F51 suite. Disconnect/reconnect, shared-phone, placement, menu, history, and Sandbox adapters remain open.
- Verification: 68 of 68 automated tests, 25 of 25 deterministic evals, spend-refusal CLI smoke, one-of-one live three-agent pilot, dashboard API/HTML smoke, and strict TypeScript pass.

## 2026-07-17 — Auditable think-aloud reasoning traces

- Extended every guided teaching decision with a bounded structured reasoning trace that separates `learner_stated` claims from `tutor_inference` entries and marks each `supported`, `unsupported`, or `unclear` against the frozen curriculum.
- The live GPT-5.6 contract requires faithful learner evidence plus an explicit tutor inference, forbids invented reasoning steps, and states that language, accent, confidence, and brevity are not evidence of subject understanding.
- The deterministic adapter now makes its evidence path inspectable: the denominator-as-whole-number claim is unsupported, the matching misconception diagnosis is supported, and correct piece-size reasoning is supported.
- Full traces persist inside the existing turn JSON and appear in Mission Control. No extra learner data is collected.
- Added a compatibility reader for historical turn JSON and saved agent reports. Old records receive only their historical diagnosis as a tutor inference marked unclear; the application neither fabricates missing learner claims nor discards the turn.
- The agent pilot's trusted structural layer now fails future live cases that omit either learner-stated evidence or a tutor inference.
- Verification: 70 of 70 automated tests, 25 of 25 deterministic evals, legacy SQLite/report compatibility, TeachingTurn Structured Outputs conversion, and strict TypeScript pass.

## 2026-07-17 — Enforced voice-native turn policy

- Added one shared application validator for the offline adapter, live GPT-5.6 teaching output, lesson-service persistence boundary, and agent-eval structural checks.
- Active teaching turns must contain exactly one spoken question and no more than three short sentences. A completed recap or safety-forced ending intentionally contains zero spoken questions while keeping exactly one voice-friendly `next_question` for later retrieval.
- Markdown markers, digit-slash and Unicode symbolic fractions, multiple questions, missing stored questions, and overlong responses fail closed before a turn reaches SQLite or Realtime speech.
- The first run of the new guard caught genuine four-sentence composition in the frozen pack. Vocabulary bridge leads, the successful-reasoning lead, the silence lead, unsafe guidance, and a two-question retrieval prompt were tightened instead of weakening the validator.
- Curriculum compiler and verifier instructions now account for the composed response, not just each string in isolation.
- Verification: 76 of 76 automated tests and 25 of 25 deterministic evals pass with the guard enabled; strict TypeScript and diff checks pass.

## 2026-07-17 — Explicit Realtime VAD and barge-in policy

- Verified the current OpenAI Realtime server-VAD contract from official API documentation: threshold, prefix padding, silence duration, automatic response creation, and response interruption are input-audio turn-detection fields.
- Added server VAD to the actual SIP call-accept payload instead of relying on undocumented defaults. `interrupt_response` is always true so detected learner speech cancels an ongoing default-conversation response.
- Added bounded deployment settings for threshold, prefix padding, and silence duration. Invalid values fail at startup rather than reaching a paid call.
- Chose provisional development values of 0.5 threshold, 300 ms prefix audio, and 650 ms silence. The slightly patient silence window is an explicit hypothesis for child think-aloud speech, not field evidence.
- Did not set an idle timeout: an automatic timeout response could bypass the current lesson-tool rhythm, and silence handling is already explicit in the teaching flow.
- Real G.711 phone audio, noisy-line activation, cut-off pauses, mouth-to-ear latency, and physical barge-in remain blocked on the Twilio number and SIP trunk.
- Verification: 78 of 78 automated tests, exact accept-payload assertions, invalid-env rejection, and strict TypeScript pass.

## 2026-07-17 — Secret-safe phone readiness boundary

- Added `npm run phone:preflight`, a ten-check report covering live engine selection, OpenAI key/project/webhook, public signed delivery, deployment phone-HMAC secret, Twilio credentials/number, verified voice routing, and the SIP trunk.
- The report contains only pass/open booleans, labels, and next actions. Tests prove it never serializes API keys, auth tokens, project values, webhook secrets, or phone numbers.
- Added explicit operator attestations for public webhook reachability, Twilio voice readiness, and SIP trunk routing. Credentials alone cannot turn these checks green.
- Added `npm run secrets:init` to rotate only a missing/development-default phone-HMAC secret, preserve the rest of `.env`, enforce mode 0600, and print no value. Ran it successfully on the local ignored environment.
- Local readiness moved from 2/10 to 3/10. The live engine, API key, and deployment hash secret are ready.
- The remaining seven checks require external state: OpenAI project ID, webhook/signing secret, public signed delivery, Twilio credentials, a purchased/assigned number, verified inbound voice, and the Twilio-to-OpenAI SIP trunk.
- Corrected the README's previously too-narrow claim that only a Twilio number/trunk blocked the real call.
- Verification: 81 of 81 automated tests, secret-initializer idempotency and permissions, live local preflight without value exposure, and strict TypeScript pass.

## 2026-07-17 — Persistent, pack-reviewed physical anchors

- Added curriculum-level anchor activities with a canonical generic object name, offline learner expressions, a safe response lead, and one concept-grounded Socratic question.
- The flagship fractions pack supports paper, flatbread, and leaf anchors; the independent Science fixture uses a balloon, proving the engine contains no Math-object branch.
- A learner saying “I am holding a leaf” now produces `anchor_object: leaf`, follows the reviewed leaf prompt, stores the anchor on the lesson session, and carries it through pause/redial into subsequent teaching requests.
- Live GPT-5.6 receives the current anchor but may only return an exact object name from the active concept's reviewed activities. Application code independently discards unreviewed model nouns rather than exposing them in persistence or Mission Control.
- Learner input remains PII-redacted before anchor matching. Persistent state contains only a short generic pack name—never the owner's words, brand, location, or arbitrary object description.
- Added a backward-compatible SQLite `anchor_object` migration and compatibility defaults for historical turn JSON and saved agent reports.
- Curriculum compiler instructions require no-purchase, low-risk household activities and exclude ingestion, heat, electricity, sharp tools, chemicals, and unsupervised-risk manipulation.
- Mission Control now displays the current shared physical anchor alongside diagnosis and reasoning evidence.
- Verification: 83 of 83 automated tests, including drop/resume continuity, PII-before-anchor handling, unreviewed-output rejection, legacy database migration, 25 of 25 deterministic evals, Structured Outputs conversion, and strict TypeScript pass.

## 2026-07-17 — Complete 24-case agent-evaluation contract

- Expanded the spend-gated manifest from ten to exactly 24 unique scenarios: fourteen semantic teaching/safety/language cases and ten orchestration cases covering disconnect persistence, exact reconnect, two shared-phone identity paths, multilingual placement, callback retrieval, two menu routes, Sandbox hedging, and voice-math formatting.
- Added a discriminated, backward-compatible report format. Historical semantic reports without a result `kind` still parse; new orchestration results carry only synthetic summaries, bounded observations, and explicit trusted checks.
- State and identity adapters exercise the real LessonService and in-memory SQLite persistence with zero teacher-model spend. Placement, Sandbox, and voice-format adapters use the configured production TeachingEngine so their model-dependent contracts are evaluated rather than mocked during a paid run.
- Every orchestration case still uses GPT-5.6 as a synthetic learner and independent evaluator. Trusted application assertions remain authoritative: a model evaluator cannot turn a failed state, isolation, routing, safety, or voice check into a pass.
- Mission Control now distinguishes a complete 24-case green report from a passing targeted run, avoiding a misleading 24/24 claim.
- Verification: 84 of 84 automated tests, all ten orchestration adapters in the zero-credit controlled-engine gate, 25 of 25 deterministic teaching cases, spend-refusal CLI smoke, and a one-of-one paid reconnect run. The reconnect run passed all four trusted checks with 659 input and 179 output text tokens; the paid full 24-case execution remains open.

## 2026-07-17 — State-aware degraded-audio recovery

- Added a zero-argument `recover_unclear_audio` Realtime tool and instructed the voice layer to use it whenever audio is missing, clipped, or too unclear for a faithful transcript. Partial guesses must never reach placement, teaching, history, or Sandbox tools.
- The server, not the voice model, selects the pending recovery stage: learner identity, subject/Sandbox menu, first placement prompt, exact guided lesson question, or Sandbox curiosity prompt.
- Recovery localizes only the neutral connection retry lead and preserves the pending prompt's meaning. It makes no teaching-engine request and leaves lesson turns, mastery, placement, and Sandbox history unchanged.
- Existing close/pause and phone-plus-normalized-name resume behavior completes the drop-to-redial path; real packet-loss and noisy-line validation remains gated on the Twilio/SIP leg.
- Verification: targeted Realtime SIP/controller tests cover all five recovery stages, exact guided-prompt continuity, specialized speech instructions, and zero state mutation; strict TypeScript passes.

## 2026-07-17 — Bounded warm Realtime voice policy

- Verified from current official Realtime prompting guidance and the installed SDK contract that output `speed` is a playback multiplier from 0.25 to 1.5, while vocal pacing should also be instructed because post-processing alone does not shape cadence.
- Added `OPENAI_REALTIME_SPEED`, bounded at startup and defaulting to 0.8, to the actual SIP call-accept `audio.output` payload alongside the configurable `marin` voice.
- Added a provider-neutral delivery contract: warm, calm, patient, unhurried, clear pauses, and never theatrical, patronizing, or sleepy. Authoritative tool words remain unchanged.
- Nomad remains the disclosed product/tutor persona rather than imitating a real person. Perceived pace, voice fit, and accent behavior remain real-phone listening tasks after the Twilio/SIP leg is available.
- Verification: exact accept-payload assertions, lower/upper speed bounds, invalid-speed rejection, warm-delivery prompt assertion, and strict TypeScript pass.

## 2026-07-17 — Full paid agent-suite reliability pass

- The first complete run exposed a provider-incompatible Unicode-property regex in the teaching Structured Outputs schema. Split model-facing anchor shape validation from the stricter reviewed-pack name validator; exact pack-name filtering remains the persistence boundary, so multilingual reviewed names stay safe without emitting unsupported JSON Schema regex.
- Added typed `execution_error` case results so one fail-closed teacher or adapter error cannot abort the scorecard. Mission Control renders the stage and error, and historical semantic reports remain compatible.
- Added one bounded production teacher retry using exact trusted voice-policy feedback. The retry preserves the strict guard and aggregates both attempts' token usage instead of hiding the extra cost.
- Removed pending-lesson bait from orchestration simulators, aligned semantic eval requests with the already-detected learner language mode used by the phone path, matched code-switch tags by base language, and constrained the orchestration evaluator to reviewed focus rather than invented requirements.
- Targeted runs now write a separate `.targeted` artifact and cannot overwrite the complete report shown in Mission Control.
- Final complete result: 23 of 24 pass with 77,773 input and 13,173 output text tokens. All ten orchestration cases and every trusted structural check pass. The sole open case is Hindi-only confusion: correct diagnosis, language, smaller-step strategy, and safety, but an independently judged awkward Hindi question. Added a universal idiomatic-language instruction; a future complete run must prove it before claiming 24/24.
- Verification: 87 of 87 automated tests, 25 of 25 deterministic teaching cases, multiple targeted paid regressions, complete paid report persistence, and strict TypeScript pass.
