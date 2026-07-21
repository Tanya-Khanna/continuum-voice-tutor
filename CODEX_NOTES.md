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

- Builder clarified that Continuum is a universal product; India, Hinglish, and fractions are only deployment #1.
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
- The dashboard shows recent sessions, learner/Continuum transcript pairs, diagnosis, mastery evidence, next strategy, language mode, and the actual model route recorded for each turn.
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
- Created a 33-second Spanish-English Socratic misconception-and-transfer fixture with distinct synthetic learner and Continuum voices.
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
- Continuum remains the disclosed product/tutor persona rather than imitating a real person. Perceived pace, voice fit, and accent behavior remain real-phone listening tasks after the Twilio/SIP leg is available.
- Verification: exact accept-payload assertions, lower/upper speed bounds, invalid-speed rejection, warm-delivery prompt assertion, and strict TypeScript pass.

## 2026-07-17 — Full paid agent-suite reliability pass

- The first complete run exposed a provider-incompatible Unicode-property regex in the teaching Structured Outputs schema. Split model-facing anchor shape validation from the stricter reviewed-pack name validator; exact pack-name filtering remains the persistence boundary, so multilingual reviewed names stay safe without emitting unsupported JSON Schema regex.
- Added typed `execution_error` case results so one fail-closed teacher or adapter error cannot abort the scorecard. Mission Control renders the stage and error, and historical semantic reports remain compatible.
- Added one bounded production teacher retry using exact trusted voice-policy feedback. The retry preserves the strict guard and aggregates both attempts' token usage instead of hiding the extra cost.
- Removed pending-lesson bait from orchestration simulators, aligned semantic eval requests with the already-detected learner language mode used by the phone path, matched code-switch tags by base language, and constrained the orchestration evaluator to reviewed focus rather than invented requirements.
- Targeted runs now write a separate `.targeted` artifact and cannot overwrite the complete report shown in Mission Control.
- Final complete result: 23 of 24 pass with 77,773 input and 13,173 output text tokens. All ten orchestration cases and every trusted structural check pass. The sole open case is Hindi-only confusion: correct diagnosis, language, smaller-step strategy, and safety, but an independently judged awkward Hindi question. Added a universal idiomatic-language instruction; a future complete run must prove it before claiming 24/24.
- Verification: 87 of 87 automated tests, 25 of 25 deterministic teaching cases, multiple targeted paid regressions, complete paid report persistence, and strict TypeScript pass.

## 2026-07-17 — F51 complete paid proof

- Re-ran the previously open Hindi-only confusion case after the universal idiomatic-language instruction; the targeted case passed and remained isolated in the `.targeted` report.
- Ran all 24 cases together afterward. The authoritative complete report passed 24 of 24 in one run: fourteen semantic teaching turns, ten orchestration results, zero execution errors, and zero failed trusted or evaluator checks.
- The complete run recorded 78,232 input and 13,674 output text tokens. Its Git-ignored report is the artifact Mission Control reads; the paid result is runtime evidence, not a checked-in fixture.
- F51 is now complete for the reviewed flagship deployment. Model behavior remains probabilistic, so future prompt, model, curriculum, or schema changes must rerun the full suite rather than relying on this historical pass.

## 2026-07-17 — Human-gated four-subject curriculum preparation

- Added separate pending and approved source-brief contracts. Drafts can be checked for free, while the paid compiler now fails before its first model request unless a named, dated approval receipt covers every source URL and no unlisted source.
- Compiled-pack provenance now requires and preserves the human reviewer, review time, and scope notes in addition to compiler/verifier model routes. Subject metadata mismatches fail before generation.
- Prepared pending official-source briefs for Science materials, English oral narratives, History timelines/sources, and Geography maps using NCERT/CIET ePathshala pages. Each includes reviewed-vocabulary candidates, safe subject flavor, originality rules, and explicit excluded risks; none is presented as approved.
- Added `curriculum:brief:check` plus a reviewer checklist. All four drafts validate and intentionally exit locked. No model credit was used and no extra subject pack or five-subject menu claim was made.
- Verification: 91 of 91 automated tests, 25 of 25 deterministic teaching cases, strict TypeScript pass, and clean diff validation.

## 2026-07-17 — Reproducible fresh-clone shipping gate

- Added `npm run verify:fresh`, which exports committed `HEAD` to a unique temporary directory rather than trusting the working tree.
- The gate fails if local `.env`, `.data`, or `node_modules` leaks into the archive, strips OpenAI/Twilio credentials and curriculum overrides from its child environment, forces the offline engine, and installs from `package-lock.json` with `npm ci`.
- It then runs strict TypeScript plus all tests, the full deterministic eval suite, and a scripted one-turn REPL lesson before deleting the temporary copy.
- Reran the command after committing the verifier itself: 91 of 91 tests, 25 of 25 eval cases, one saved offline teaching turn, and zero npm audit vulnerabilities passed from the clean archive.

## 2026-07-17 — Evidence-based plan reconciliation

- Reconciled the core manifest against implemented paths and current gates, striking only the completed software behavior for universal code-switching architecture, strict Socratic routing, flagship auditory grounding, short verbal units, adaptive/judgment-free teaching, the lesson arc, named/shared-phone continuity, callback retrieval, and two-layer model routing.
- Kept the claims narrower than the product aspiration: actual G.711 accent/timing behavior remains open; Science/English/History/Geography flavor remains in F21; “every language” is not claimed from a finite multilingual gate.
- Re-ran the secret-safe phone preflight. Readiness remains 3/10: live teaching mode, API key, and the phone HMAC secret pass; OpenAI project/webhook/public delivery plus Twilio credentials/number/routing/trunk remain external setup work.

## 2026-07-17 — Honest judge and demo runbook

- Added one executable runbook for the current secret-free local judge path, the future real-phone judge card, the three-minute demo recording, final evidence capture, and submission placeholders.
- Release gates explicitly forbid publishing a phone number before preflight and real G.711 behavior pass, presenting local/browser audio as a carrier call, exposing the unauthenticated dashboard with learner data, or claiming five callable subjects while four packs remain human-gated.
- The demo order centers observable teaching evidence: misconception diagnosis, code-switching, exact drop/resume, Mission Control reasoning/usage, break-it behavior, architecture, and the 25/25 plus 24/24 scorecards.

## 2026-07-17 — Callable multi-subject runtime architecture

- Replaced the implicit single-pack phone assumption with an ordered `CurriculumCatalog`. It rejects empty catalogs, duplicate pack IDs, duplicate case-insensitive subject labels, and packs from a different country/grade deployment.
- Added `NOMAD_CURRICULUM_PATHS` as an ordered JSON array while retaining `NOMAD_CURRICULUM_PATH`. The explicit `builtin:india-ncert-grade-6-fractions` identifier makes the hand-built flagship usable beside future frozen JSON packs without copying it into generated content.
- Split learner identification from guided-session creation. Realtime now returns `guided_subjects`; a multi-pack call cannot create a session until the learner explicitly selects a valid subject. Subject changes pause the old session and route to the selected pack.
- Migrated curriculum pack ID and placement evidence onto lesson sessions. Placement, retrieval history, active/paused state, and exact resume are now subject-specific; learner-level placement fields remain only as a backward-compatible latest-result mirror.
- Catalog routing is shared by the server runtime, Realtime bridge, dashboard, REPL, and diagnostic. Mission Control shows subject/pack, and `/health` exposes only safe subject labels.
- Added two-subject adversarial coverage for missing selection, case-insensitive routing, independent Math/Science placement, cross-subject history isolation, subject switching, legacy default-pack adoption, environment loading, and dashboard metadata. The fixture is not shipped as reviewed Science content.

## 2026-07-17 — Reproducible paused-lesson judge fixture

- Added `npm run seed:demo`, an explicitly synthetic, zero-credit Ravi fixture built through the real offline lesson service. It completes placement, records one canonical misconception turn, pauses on the actual next prompt, and prints the exact resume command.
- The seed is idempotent: rerunning it does not add turns. Tests also prove that a second name on the same synthetic phone inherits no lesson state.
- Expanded `npm run verify:fresh` to clear both single- and multi-pack curriculum overrides, seed the fixture in the secret-free archive, and prove exact resume from committed source. Local verification is 101/101 tests plus the 25/25 deterministic teaching gate.

## 2026-07-17 — Access-controlled Mission Control sessions

- Added optional constant-time Bearer authentication to `/api/dashboard/sessions`. Local development remains zero-config; when a token is configured, missing, malformed, repeated, or incorrect authorization fails before the learner database is opened.
- The browser accepts a judge token only from the URL fragment, moves it to tab-scoped session storage, removes it from the address bar, and sends it in the authorization header. It never puts the token in a request query string.
- Public-webhook server startup now fails closed without a 24-character-or-longer dashboard token, and phone preflight includes the same readiness boundary. The synthetic sample and eval scorecard remain accessible because they contain no real learner sessions.
- This is an honest hackathon judge-access control, not role-based production authorization or an enforced retention policy.
- HTTP smoke proof: missing and incorrect tokens returned 401, the exact token returned 200, the synthetic sample remained 200, the dashboard returned no-referrer/no-sniff headers, and public-webhook startup without a token exited before listening. Local phone readiness is now 3/11; the new access-token check is intentionally open until deployment.

## 2026-07-17 — Evidence-bound submission package

- Added a compact README architecture map plus explicit Codex-build evidence and honest-limitations sections.
- Added `docs/SUBMISSION_COPY.md` with capability-first Devpost prose, the executable zero-credit judge path, a gated real-phone paragraph, final field placeholders, and a claim-by-claim release ledger.
- The copy keeps software proof separate from external proof: it does not call the carrier path live, does not claim five reviewed subjects, does not turn selected language checks into “every language proven,” and does not present a shared judge token as institutional access control.

## 2026-07-17 — Primary-source evidence stack

- Replaced the stale 17-million-teacher-shortage plan figure with UNESCO's 44-million primary/secondary teacher deficit projection for 2030.
- Added direct ITU and GSMA receipts for 2.6 billion people offline and the separate 3.1 billion mobile-internet usage gap. The README explicitly forbids adding these overlapping populations or treating coverage as proof of affordable calls.
- Grounded strict Socratic guardrails in the nearly 1,000-student Bastani et al. field experiment: unrestricted GPT-4 hurt unaided grades after practice access was removed, while hint-based safeguards largely mitigated that effect.
- Added preliminary Rori and Adesua receipts with their limitations intact: Rori's roughly 500-student year-one study and estimated marginal cost cannot be inherited by Continuum; Adesua's 93.75% helpfulness came from only 16 ratings.
- Added the peer-reviewed SIGDIAL code-switching tutoring paper as a design receipt without turning selected model checks into a universal quality claim.

## 2026-07-17 — Current landscape and complete README handoff

- Re-audited the comparison against current official product pages. Removed stale claims that Bakame is English-only, that 1-800-ChatGPT is merely an answer machine without memory, and that no competitor combines more than two relevant capabilities; Callee Me and Rori are now credited explicitly too.
- Differentiation is now the source-visible combination the repository can prove: frozen curriculum/reviewer provenance, subject-scoped placement and resume, trusted turn guards, and reproducible deterministic plus paid-agent evidence.
- Added an institution-led distribution and supervised-pilot path, a gate-ordered roadmap, the MIT/license and technology credits, official curriculum-source links, and a compact research source index.
- Reconciled the build plan with the shipped product: History is not offered before review, the sample is synthetic Spanish-English rather than Hinglish, language universality is architectural rather than a promise about every language/accent, and no compiler-generated pack or five-subject deployment is claimed.

## 2026-07-17 — Browser-verified Mission Control polish

- Exercised Sessions, Eval gate, and Sample through the local app in a real browser at desktop and phone-sized viewports. The sample audio loaded, all four transcript lines rendered, and click-to-seek moved to the expected 16.715-second cue without horizontal overflow.
- The visual pass found deterministic category labels colliding with the PASS column and 24 successful agent rationales overwhelming the scorecard. Evaluation columns now wrap safely, successful rationales are collapsed behind an accessible `details` control, and any failure remains immediately visible.
- Seeded the reproducible paused Ravi lesson and inspected the full teaching trace at desktop and phone widths. Raw learner-state enums are now human-readable (`Needs Support`, `Ask Reasoning`, `Foundational`, `Paused`) while exact language tags and model routes remain untouched for auditing; neither layout has horizontal overflow.
- Re-ran the committed-HEAD clean-clone gate after the browser fixes: 107/107 tests, 25/25 deterministic cases, synthetic paused-state seed, exact resume, and a zero-vulnerability lockfile install all passed without local secrets or prior state.
- Reconciled the schedule ledger with already-shipped flagship grounding, the Continuum persona, honest-limitations and consent/retention documentation, and roadmap coverage. The secret-safe phone preflight remains 3/11; every open check requires OpenAI project/webhook or Twilio/deployment configuration rather than more local teaching-engine code.

## 2026-07-17 — Secret-safe dashboard readiness

- Extended `npm run secrets:init` to fill a missing or blank Mission Control token as well as the phone-HMAC secret, without printing either value or changing any other `.env` line. A configured dashboard token is never overwritten; an invalid short one fails with an explicit repair instruction.
- Added idempotency, preservation, mode-0600, generated-shape, and weak-token refusal coverage. The local ignored `.env` was initialized successfully, preserving the existing OpenAI key, and phone readiness advanced from 3/11 to 4/11.
- The remaining seven checks are OpenAI project/webhook/public-delivery and Twilio account/number/routing/trunk actions. The initializer cannot truthfully mark any operator attestation itself.

## 2026-07-17 — Two-stage real-phone release gate

- Fixed a circular readiness rule: a valid signed `realtime.call.incoming` delivery cannot be observed before the first inbound SIP call. Preflight now permits exactly one controlled smoke call at 10/11 only when signed public delivery is the sole open check; 11/11 remains mandatory before wider carrier testing.
- Added `docs/PHONE_SETUP.md` with the exact public-HTTPS, OpenAI project/webhook, Twilio number/origination, first-call, and carrier-behavior sequence. The guide uses OpenAI's official Realtime SIP and webhook documentation plus Twilio's official trunk documentation and connector tutorial.
- Tightened attestation inputs: the OpenAI project ID must have the documented `proj_` shape, the Twilio Account SID must have its `AC` shape, and the number must be E.164. Placeholder-looking values no longer count as configured.
- Added one secret-free server log after OpenAI SDK signature verification so the first valid delivery can be evidenced without printing the call ID, caller, project, or credentials.
- Kept the release claim honest: 11/11 proves configuration, not G.711 clarity, latency, barge-in, unclear-audio behavior, or disconnect/redial. The number remains private until those real-carrier checks pass.
- Verification: strict TypeScript and 111/111 automated tests pass, including the sole-open-check smoke-call rule and rejection of placeholder-shaped external account values.

## 2026-07-17 — Host-neutral production artifact

- Added a dedicated production TypeScript build and `node dist/server.js` start path rather than depending on the development-only `tsx` loader in deployment.
- Added a multi-stage Node 22 container that runs as the unprivileged `node` user, includes only production dependencies plus runtime assets/curriculum, owns its default SQLite directory, and probes the host-provided port through `/health`. `.dockerignore` excludes local secrets, state, dependencies, Git history, and logs.
- Added a zero-credit production smoke verifier. It blocks local `.env` loading, compiles the server, binds an ephemeral loopback port, and proves safe health metadata, token-protected Mission Control sessions, writable SQLite access, and HTTP range delivery of the sample audio.
- The clean-clone gate now runs that compiled-server smoke before tests and deterministic evaluation. `HOST` is explicit and defaults to `0.0.0.0` for container platforms.
- Added `docs/DEPLOYMENT.md` covering stable HTTPS, provider secret injection, a single persistent SQLite disk, single-instance operation, dashboard access checks, and the boundary between reachability and signed-webhook attestation.
- Verification: the production smoke, strict TypeScript, and 112/112 automated tests pass locally. Docker itself is not installed in this workspace, so the image definition is source-reviewed but still needs one build on the selected deployment host.

## 2026-07-17 — Browser-visible release readiness

- Added a Mission Control Release tab backed by the same typed 11-check preflight report as the CLI. It distinguishes blocked setup, the one-call 10/11 exception, and 11/11 configuration while always showing the public number as separately gated.
- Protected `/api/dashboard/readiness` with the same constant-time Bearer boundary as learner sessions. The response contains only booleans, labels, next actions, counts, and a fixed guide path; the compiled production smoke verifies configured dashboard and phone-HMAC values never appear.
- The browser UI links directly to the checked-in phone setup guide and gives every open check a concrete next action, so setup can be driven from Mission Control without pasting credentials into terminal output or screenshots.
- Browser verification passed at the normal desktop viewport and at 390 by 844: all 11 checks rendered, the active tab and guide were accessible, no horizontal overflow occurred, and the browser console had no warnings or errors.
- Verification: compiled production smoke, strict TypeScript, 113/113 automated tests, and browser inspection pass. The current local real-account state remains 4/11; this view does not infer or change external console state.

## 2026-07-17 — Repository-enforced release gate

- Added a read-only GitHub Actions workflow for every `main` push, pull request, and manual dispatch. It installs from the lockfile and runs the same committed-archive `verify:fresh` gate used locally.
- The job receives no OpenAI or Twilio secrets and has only `contents: read`; checkout persistence is disabled. Concurrency cancels stale runs for the same ref, and a 15-minute timeout bounds failures.
- Pinned the current official major lines, `actions/checkout@v6` and `actions/setup-node@v6`, after checking their 2026 release pages rather than copying older workflow examples. Node remains fixed to the repository's supported major, 22.
- Added the Release gate badge and documented that CI repeats the compiled-server smoke, 113 tests, 25-case deterministic eval, synthetic seed, and exact resume proof.
- The first GitHub-hosted push run, `29570390805`, completed green in 42 seconds on commit `578f797`; every workflow step passed without repository secrets.

## 2026-07-17 — Official midweek reminder reconciliation

- Reconciled the user-provided Build Week halfway reminder against the source-of-truth plan instead of appending it verbatim. Existing coverage—demo sequence, continuous Codex usage, `/feedback`, repository recipients, README requirements, and frequent commits—was retained once.
- Added the missing free-tier/model guidance: no future credit distribution is assumed, GPT-5.6 is required meaningfully rather than exclusively, Codex and API balances remain separate, and focused batching plus cheaper exploratory work preserves limits.
- Added an explicit human-authorship gate for the Devpost description, code comprehension, project naming, and demo script. `docs/SUBMISSION_COPY.md` is now unmistakably a drafting aid that the builder must rewrite in her own voice.
- Added an actionable submission-now checklist covering Devpost draft creation, accepted team invitations, public YouTube verification, `/feedback` retrieval, private-repository sharing, a calendar reminder if access is deferred, final field review, and a saved confirmation screenshot.
- Confirmed through GitHub that `Tanya-Khanna/nomad-ai` is currently private, so both official repository-access recipients remain an open human action rather than a checked claim.
- Preserved the absolute July 21, 5:00 PM PT cutoff while flagging the source conflict: the official reminder calls it Monday and the copied plan called it Tuesday. The plan now requires checking the live Devpost countdown and treats noon PT on July 21 as the internal deadline.
- Removed three conflicting legacy instructions: weekday labels from the date-based schedule, “spend credits freely,” and “ready-to-paste” AI submission copy. The plan now uses absolute dates, finite-credit discipline, and an explicit human rewrite gate; `docs/SUBMISSION_COPY.md` carries the same boundary.
- Reworded the historical D0 and credit-risk entries so the source-of-truth plan no longer expects another distribution or calls the already-funded $5 API runtime “unfunded.”

# 2026-07-17 — Human-selected Continuum brand

- Tanya chose **Continuum** as the final product name after a human-led naming pass. The selected tagline is **“The connection may drop. The learning continues.”**
- Updated learner-facing prompts, CLI output, Mission Control, safety and operator documentation, the build plan, and submission drafting material so the tutor introduces itself consistently as Continuum.
- Renamed the private npm package to `continuum`. Kept `NOMAD_` environment variables, the `Tanya-Khanna/nomad-ai` repository slug, database paths, and internal fixture discriminators as compatibility identifiers for this build; changing those now would risk existing secret configuration, persisted state, and external links without changing the product experience.
- Added regression checks for the Realtime call identity and Mission Control brand. Strict TypeScript and 115/115 automated tests pass in the working tree; the committed-archive release gate is rerun after the rename commit.

## 2026-07-17 — Gated public landing-page milestone

- Tanya chose to add a public Continuum landing page to the build plan. The required minimum is a fast, mobile-first judge entry point with the tagline, call/learn/resume story, verified release-state CTA, and links to the demo, Mission Control, repository, safety notes, and testing instructions.
- The landing page is explicitly downstream of the real-phone gate. A call-now claim and public number remain blocked until 11/11 configuration and the real-carrier behavior checks pass.
- GSAP is limited to one optional continuity animation plus restrained reveals with `prefers-reduced-motion`. Audio is optional, user-triggered, captioned, controllable, and never tied to scrolling or autoplay. Both are dropped before they can delay the phone path, video, or submission.

## 2026-07-18 — Reconciled independent v5 status audit

- Fast-forwarded to Tanya's pushed `93d623a` status-marked build-plan audit and preserved its verified done/partial/open ledger.
- Made the breadth commitment explicit: the release target is five genuinely callable guided subjects—Math, Science, English, History, and Geography—plus Curious Sandbox for broader safe questions. Each additional subject must pass human source review, compilation, independent verification, builder spot-checking, freeze, and a coherent voice-first starter-lesson gate; empty labels are forbidden.
- Preserved the open multilingual architecture while separating it from proof: there is no fixed engine language pair, but public claims must name the text and carrier language/code-switch patterns actually tested. Local curriculum, language, accent, and phone-condition testing remain deployment gates.
- Restored the F60 landing-page milestone lost because the audit was based on the pre-F60 commit, and corrected stale regressions in the audit copy: Continuum is final, impact figures use the sourced GSMA/ITU/UNESCO values, competitor differentiation avoids disproven exclusivity claims, the $5 API balance is acknowledged, and current sample/pack status is not overstated.

## 2026-07-18 — Public Railway deployment with persistent state

- Activated the Railway Hobby workspace and deployed commit `31a8988` from the checked-in multi-stage Dockerfile to the stable HTTPS service at `https://continuum-production-8971.up.railway.app`.
- Attached one persistent volume at `/data` and configured SQLite at `/data/nomad.db`, preserving the single-instance operating boundary documented in `docs/DEPLOYMENT.md`.
- Railway volumes mount as root, so the production entrypoint now prepares only the configured database directory and any existing SQLite sidecar files, then drops immediately to the image's existing unprivileged Node UID/GID before importing the HTTP server. The live startup log confirmed that transition, and the database directory and file are owned by `node:node`.
- Transferred 21 runtime variables from the ignored local environment without printing their values. OpenAI/Twilio fields that are not genuinely configured remain unset or false; deployment does not claim phone readiness.
- Public verification passed: `/health` and `/dashboard` return 200, an unauthenticated learner-session request returns 401, the same request with the local judge token returns 200, the readiness endpoint returns 200, and SQLite opens successfully on the mounted volume. The previous `unable to open database file` failure is resolved.
- Local release verification before deploy: strict TypeScript, 115/115 automated tests, compiled production smoke, writable SQLite, dashboard authentication, release readiness, and ranged sample audio all passed. Railway build `c912370e-94b6-435f-bdf1-26a75990748e` completed successfully.
- Hosting is now ready for the next external gate. Phone readiness remains 4/11 until the OpenAI project ID/webhook signing secret and Twilio credentials, number, verified routing, and SIP trunk are configured and the signed-delivery plus real-carrier checks pass.

## 2026-07-18 — OpenAI Realtime webhook connected

- Used the signed-in OpenAI Platform console to confirm the API key belongs to the Default project, capture its documented `proj_` identifier, and create `Continuum Realtime incoming` at the deployed `/webhooks/openai` endpoint.
- Subscribed the endpoint only to `realtime.call.incoming`. The one-time `whsec_` signing secret was written directly to the ignored mode-0600 local environment and Railway without being pasted into chat, committed, or printed by the configuration command.
- Redeployed the unchanged committed application after setting the project ID and webhook secret. The Railway deployment succeeded, and public `/health` now reports `ok: true`, the OpenAI teaching engine, and `realtimeConfigured: true` without exposing either configured value.
- Secret-safe phone preflight advanced from 4/11 to 6/11. The remaining checks are signed-delivery proof from the first controlled call plus Twilio credentials, a voice-capable number, verified number routing, and the OpenAI SIP trunk.
- `NOMAD_OPENAI_WEBHOOK_PUBLIC` deliberately remains false. A created endpoint and healthy server do not substitute for receiving a valid signed `realtime.call.incoming` event over the carrier path.

## 2026-07-18 — Twilio trial boundary verified without purchase

- Inspected the signed-in Twilio account without changing billing. The account is a healthy 30-day trial with 29 days remaining, 75 free Programmable Voice minutes, and a trial-phone-number entitlement.
- The product catalog exposes Elastic SIP Trunking, but both the Trunks page and phone-number inventory page present an explicit upgrade wall. This confirms the current account cannot complete Continuum's SIP origination path without either upgrading or changing the carrier integration.
- Stored the existing Account SID and primary auth token directly in the ignored mode-0600 local environment and Railway without pasting or printing either credential. Redeployed the unchanged committed application after the runtime-variable update.
- Secret-safe readiness advanced from 6/11 to 7/11. The remaining four checks are the E.164 voice number, verified number routing, configured OpenAI SIP trunk, and signed public webhook delivery proven by the first controlled carrier call.
- No Twilio upgrade, funding, number allocation, or other purchase was submitted. The free `Try out Voice` activation remains available but is not equivalent to an Elastic SIP trunk; activating it is a separate external action requiring Tanya's approval.

## 2026-07-18 — Paid carrier path configured at 10/11

- Upgraded the Twilio account with Tanya's explicit approval and confirmed the $20 starting balance. The balance is prepaid usage, not a $20 monthly subscription; auto-recharge remains off.
- Created the required Individual primary compliance profile, then purchased one New Jersey US local number for Continuum at the displayed $1.15 monthly fee. Twilio reports the number active with Voice, SMS, and MMS capabilities.
- Created the `Continuum OpenAI` Elastic SIP trunk. Its recording mode is `do-not-record`; the single enabled origination target uses the documented OpenAI project SIP address with `;transport=tls`; the Continuum number is associated with the trunk. No termination route is configured because this release is inbound-only.
- Saved the E.164 number and the two verified Twilio routing attestations in the ignored local environment and Railway without exposing credentials or the OpenAI project identifier. The Railway variable update deployed successfully, and public health remains green.
- `npm run phone:preflight` now reports 10/11. The only open check is a valid signed `realtime.call.incoming` webhook from exactly one controlled inbound call; `NOMAD_OPENAI_WEBHOOK_PUBLIC` remains false until that evidence exists.
- The controlled inbound call produced Railway's `Verified signed realtime.call.incoming webhook; evaluating call admission.` log. Only after observing that evidence, enabled the public-webhook attestation locally and in Railway; the redeployment succeeded and `npm run phone:preflight` now reports 11/11.
- Configuration readiness is complete, but this does not yet prove learner-facing call quality. G.711 audio clarity, mouth-to-ear latency, VAD, barge-in, unclear-audio recovery, hang-up/redial resume, and Mission Control session visibility remain explicit measured carrier checks.

## 2026-07-18 — First carrier behavior test failed; routing hardened

- Tanya's first learner-facing call reached Continuum with clear two-way speech, but failed state continuity: after identity and guided fractions selection, the first placement answer (`One by three`) sent the call back to the guided-versus-Sandbox welcome menu. Her earlier Hindi algebra request was also not handled as a valid guided curriculum choice.
- Mission Control showed the session paused with placement still `unplaced`, zero teaching turns, and no saved learner answer. This narrows the failure to Realtime tool orchestration rather than Twilio, SIP, webhook verification, persistence, or the teaching engine.
- Root cause: the accepted Realtime session exposed identity, mode-selection, placement, and teaching tools simultaneously. The model could call `get_teaching_turn` while placement was still active; the controller's defensive branch then replayed the onboarding menu. The batch placement design also depended on the voice model retaining every answer before one final tool call.
- Implemented the official dynamic-conversation-flow pattern: the sideband now sends validated `session.update` events that expose only identity, menu, placement, guided, or Sandbox tools for the active server state. Onboarding tools are removed after mode selection.
- Added server-driven `submit_placement_answer`: each faithful answer advances exactly one curriculum-provided question, and the final answer triggers placement evaluation. If a stale model response still calls `get_teaching_turn` during placement, the controller safely treats its transcript as the current placement answer instead of resetting the menu. Duplicate mode selection repeats only the pending stage prompt.
- Added a regression for Tanya's exact first-call sequence plus stage-tool schema coverage. Strict TypeScript, 117/117 automated tests, the production TypeScript build, and the 25/25 deterministic teaching eval pass.
- Deployed commit `337c055` through Railway deployment `b8f1c012-6b07-4ffb-8b7b-7d83564559b4`. Public health reports the OpenAI engine and Realtime configuration healthy, and the protected release report remains configuration-ready. A second measured carrier call is still required before the live phone behavior gate can pass.

## 2026-07-18 — Continuum v6 “call is the classroom” implementation

### Builder decisions incorporated

- Calls, DTMF, and short SMS are the complete learner classroom; WhatsApp, camera input, and a learner-facing web classroom are out of submission scope.
- Continuum is reactive and proactive, but every proactive child call requires guardian consent. Missed-call callback, toll-free, sponsored, and direct-dial deployments are described separately so “no data” is never misrepresented as “free.”
- The product is a persistent tutor rather than a general phone chatbot: it diagnoses, chooses and changes teaching method, asks for learner feedback, checks teach-back and transfer, reflects, saves, and schedules retrieval.
- Portable learning belongs to the learner rather than a phone. Memory keeps only approved educational state and can be inspected or deleted.

### Implemented in this milestone

- Added typed, validated classroom contracts for learning activities, objective evidence, pedagogy decisions, learner feedback, educational preferences, Curiosity Trails, human-support decisions, educator assignments/summaries, study plans, SMS controls, callback jobs, and product metrics.
- Extended the universal fractions pack with human-reviewed keypad transfer items. The lesson renderer now creates voice and DTMF activities from frozen pack data; keypad-only evidence is explicitly non-independent and cannot become secure mastery.
- Implemented a learner-feedback interlude in the Realtime sideband controller. After a meaningful strategy switch, Continuum speaks the explanation, asks whether it helped, accepts speech or `1/2`, persists the answer without advancing curriculum state, and then restores the exact pending question.
- Added three-, five-, and ten-minute lesson state. Trusted code derives a shorter or longer activity target from the pack's normal arc; duration is persisted and may change only before teaching begins.
- Added six-digit portable learner identity using a fingerprint lookup plus a per-record salted scrypt hash, three attempts per call, cross-source throttling, portable cross-phone resume, and shared-phone name confirmation.
- Added Realtime DTMF routing for identity, menus, reviewed quiz choices, learner feedback, repeats, hints/fallback, scheduled calls, and guardian controls.
- Added atomic pending-question persistence and pause-on-drop behavior. Consent-gated pause SMS, same-phone recovery, and signed cross-phone recovery restore the exact unfinished question instead of replaying onboarding.
- Added a signed missed-call webhook returning first-verb `<Reject reason="busy">`, duplicate collapse, enrollment/adult-demo gate, country allowlist, quiet hours, per-caller/global limits, AES-GCM callback destination protection, outbound Twilio callback, and signed identity relay to OpenAI SIP.
- Added signed and idempotent SMS commands for schedule consent/control, progress, selective memory, and two-step deletion. Added due-job locking and consent checks for recurring outbound lessons, with no immediate application retry after a missed slot.
- Added a separate guardian authorization code and low-literacy voice/keypad controls for progress, lesson time, pause/resume, and two-step deletion.
- Added Curiosity Trail persistence separated from formal mastery, optional consented aspirations/preferences, structured human-support decisions, permission-bounded educator summaries, and access/reliability/learning metric aggregation with explicit synthetic/live labeling.
- Added a mobile-first public landing page centered on missed-call access, teaching, exact resume, selective memory, and reviewed-subject honesty. It does not become a screen-based classroom.
- Replaced the active build-plan authority with v6 and marked the old WhatsApp/camera plan historical so future Codex work cannot follow the wrong scope.

### Verification and honest open gates

- The repository remains strict-TypeScript and zero-credit runnable. The expanded automated suite covers the new domain, persistence, callback, SMS, scheduler, guardian, DTMF, evidence, and metrics paths.
- Latest local gate after homework, scheduled-call controls, hint routing, Outcomes UI, and expanded secret initialization: strict TypeScript passed, 171/171 automated tests passed, and the deterministic teaching eval remained 25/25 with 100% voice-friendly output.
- Expanded `npm run secrets:init` to create missing portable-identity, guardian, and callback secrets without printing or overwriting configured values. Generated the three missing local values in the ignored mode-0600 environment and transferred them plus the public base URL to Railway with deployment intentionally deferred; the feature switches and Twilio routing remain off until a dedicated missed-call route is chosen and carrier-tested.
- The four additional subject packs remain correctly human-gated. They are not exposed merely to satisfy a breadth claim.
- No live carrier claim is made yet for the new missed-call, DTMF, feedback, cross-phone, scheduling, or guardian paths. They require the documented smoke matrix and five consecutive golden journeys.
- Carrier status callbacks and actual Twilio duration/price receipts remain open before measured completion/cost claims. The homework assignment/reply ledger is implemented and automated, but still needs its live carrier smoke.

## 2026-07-20 — Single-number callback deployment

- Locked the no-extra-number constraint: the existing Twilio number becomes callback-only for inbound voice, then originates the teaching callback and remains the SMS sender. Direct answered inbound tutoring is deferred, not treated as a second-number prerequisite.
- Preserved guardian enrollment and learner quiet hours in normal deployment while allowing the explicitly enabled private adult hackathon surface to accept judge callbacks across time zones; added deterministic coverage for both modes.
- Updated the current build plan and phone runbook with the reversible trunk-to-webhook routing sequence. Live carrier claims remain gated until the route is enabled and the documented smoke journey passes.
- Pushed commits `ebb4fc4` and `931def6`; GitHub's release gate passed and Railway deployment `6fcabc8b-bc3a-4cde-9894-6786e2d1dead` completed successfully. Public health remains green with the OpenAI teaching engine, Realtime configuration, and Math catalog.
- Enabled the production missed-call, private adult-demo, SMS-control, SMS-recap, and scheduler switches. The public webhook endpoints reject unsigned probes with `403`, confirming that enabling them did not bypass Twilio signature validation.
- Reconfigured the existing voice/SMS-capable Twilio number through the authenticated API: removed its inbound trunk association, set the signed missed-call Voice webhook and SMS-control webhook to HTTP POST, and kept the same owned number available as the outbound callback caller ID. No second number was purchased. A learner-initiated live missed call is still required before the callback journey is claimed as carrier-proven.

## 2026-07-20 — Carrier lifecycle and cost evidence

- Added durable, idempotent carrier-call receipts for missed-call and scheduled access. Twilio progress callbacks are signature-validated, sequence-aware, and terminal-state sticky, so duplicate or out-of-order delivery cannot regress a call.
- Added eventual Call-resource reconciliation for duration and connectivity price, bounded retry on the live server, aggregate Twilio/OpenAI cost-per-completed-lesson evidence, SMS segment counting, and outbound message delivery/failure callbacks.
- Added one-shot scheduled no-answer behavior: a terminal busy/failed/no-answer/canceled receipt increments the missed count, sends one compact SMS, leaves the next regular slot intact, and never dials again immediately.
- Signed the configured 3/5/10-minute scheduled duration into the SIP relay context and applied it before the Realtime lesson opens; altered caller, learner, or duration headers now fail verification together.
- Verified the increment with strict TypeScript, 176/176 automated tests, and the unchanged 25/25 deterministic teaching gate. Live carrier receipts remain intentionally unclaimed until Tanya runs the final matrix.

## 2026-07-20 — Digest-bound curriculum and final release workflow

- Split curriculum release into four auditable artifacts: a named human source-approval copy, a GPT-5.6 Terra candidate, an independent-verifier receipt, and a human builder spot-check receipt plus create-only frozen pack. The CLI cannot overwrite the pending brief or silently treat model verification as human review.
- Bound source briefs, candidates, verification receipts, and release receipts with canonical SHA-256 digests. A changed source, pack, answer key, or receipt invalidates the downstream chain instead of inheriting an earlier approval.
- Added an India Grade 6 five-subject release target and `npm run curriculum:release:check`. It loads the existing Math flagship, validates every compiled pack and receipt, constructs the real catalog, and prints `NOMAD_CURRICULUM_PATHS` only after all five subjects pass. The truthful current result remains 1/5 until Tanya completes the four official-source reviews and candidate spot-checks.
- Added `docs/CURRICULUM_RELEASE.md` with the four NCERT/ePathshala source links and exact review, compile, verify, freeze, and deployment commands.
- Added a secret-free release preflight and private ignored acceptance receipt. It checks committed-head proof, clean Git state, five-pack status, 11/11 phone configuration, deployed health/revision and access switches, the complete carrier matrix, five golden journeys, video, `/feedback`, Devpost acceptance, repository access, and human-authored submission copy.
- Added `/health` release-revision and access-feature booleans so a final preflight can prove Railway runs the tested commit and callback/SMS/scheduler settings without exposing any credential or phone number.
- Added `docs/FINAL_ACCEPTANCE_RUNBOOK.md`, updated the judge/submission/phone documentation to current callback-only reality, and fixed the Twilio message-status parser to accept the provider's temporary zero segment count.
- Verification after this increment: strict TypeScript passed, 179/179 automated tests passed, and the deterministic teaching gate remained 25/25 with 100% voice-friendly output. Curriculum human approval, full carrier behavior, five consecutive judge journeys, video/upload, `/feedback`, Devpost team acceptance, repository sharing, and the final human rewrite remain explicit manual release gates.

## 2026-07-20 — Release-safe public access and complete product metrics

- Kept the judge phone number private by default behind `NOMAD_PUBLIC_PHONE_ENABLED`. The public landing page shows a verified-access holding state and contains no number or `tel:` link until the final carrier matrix, five golden journeys, and explicit publication switch pass.
- Added a signed access-mode claim to callback and scheduled SIP relays. The lesson session now durably records missed-call, sponsored, direct-dial, scheduled, or unknown access, so lesson and SMS evidence can distinguish sponsor-funded access from learner-paid access without trusting model output.
- Added shared-phone completion evidence and cost per retained concept, using only independent correct retention evidence for the retained-concept denominator.
- Completed the judge-facing metric set with keypad-fallback conversion, unclear-audio recovery, exact resume accuracy, scheduled-answer rate, median and p95 application response latency, diagnostic-to-transfer improvement, hint reduction, teach-back success, strategy-switch success, homework completion, and learner-reported helpfulness.
- Metric events inherit the session's verified access mode. Keypad requests and unclear-audio recovery attempts are recorded separately from successful completion so the rates cannot be fabricated from a single success counter.
- Verification after this increment: strict TypeScript passed, 181/181 automated tests passed, and the deterministic teaching gate remained 25/25 with 100% voice-friendly output. The remaining gates are external or human: four curriculum approvals, carrier acceptance, five golden journeys, demo/upload, `/feedback`, Devpost/team/repository access, and the human-authored submission rewrite.
