# Nomad AI

> The connection may drop. The learning continues.

Nomad is a multilingual Socratic tutor designed for learners who may have only a basic phone. The current build combines an OpenAI Realtime SIP conversation layer with a server-side GPT-5.6 teaching engine and durable learner state. The real phone leg remains gated on an OpenAI project/webhook with a public signed-delivery path plus Twilio credentials, a voice-ready number, and the SIP trunk.

## Universal architecture

The teaching engine contains no subject, country, grade, or language list. A deployment supplies a frozen curriculum pack with its concepts, misconception evidence, teaching scaffolds, placement diagnostic, syllabus identity, and locally tested language modes. The live model contract accepts any BCP-47-style language tag or code-switching combination. India Grade 6 fractions is the first deployment pack and demo fixture, not the product boundary.

Academic vocabulary is pack-driven too. Every concept declares reviewed canonical terms, the language each term belongs to, a short spoken meaning, and informal learner expressions used only by the offline test adapter. In live teaching, GPT-5.6 can preserve a learner's own phrase, connect it briefly to the reviewed curriculum term, and continue in the learner's current language pattern. The engine contains no Hindi-to-English—or any other fixed language-pair—bridge.

Physical anchor activities are also curriculum data rather than engine branches. A learner can say they are holding a reviewed household object such as paper, a flatbread, a leaf, or—in another subject pack—a balloon. Nomad stores only the pack's generic `objectName`, carries it through a dropped call, and supplies it to the next teaching decision. The model cannot persist an unreviewed noun, owner, brand, location, or personal detail; physical manipulation must use the pack's reviewed safe prompt.

Set `NOMAD_CURRICULUM_PATH` to any schema-valid compiled pack to change the deployment without changing teaching-engine code. Leaving it blank loads the built-in India fractions demo pack.

The offline language detector is deliberately a configurable test adapter; it does not claim to translate arbitrary languages. In live mode, the model detects and responds in the learner's actual language while remaining grounded in the selected pack.

## Curriculum compiler

`npm run curriculum:compile -- --source reviewed-source.json --out frozen-pack.json` runs a build-time GPT-5.6 Terra compiler followed by an independent verifier pass. The source brief must include official-source URLs, reviewed themes, bounded required concepts, local-context notes, and explicit originality requirements. Source prose is used only for scope; learner-facing questions and explanations must be original.

Four pending India Grade 6 briefs for Science, English, History, and Geography live under `curriculum/source-briefs/drafts`. They point to official NCERT/CIET ePathshala resources and encode subject-specific voice teaching ideas, but they are deliberately not approved curriculum. Check one without using API credit:

```bash
npm run curriculum:brief:check -- --source curriculum/source-briefs/drafts/india-grade6-science-materials.json
```

The checker validates draft structure and exits with status 2 while review is pending. The paid compiler fails before its first model request unless a named, dated human approval receipt covers the exact set of source URLs. That receipt is preserved in compiled-pack provenance alongside compiler and verifier model routes.

The compiler writes nothing unless the approved source brief, generated pack schema, required vocabulary, and independent verifier all pass. Output is create-only and never fetched or changed during a live lesson. The review checklist and receipt shape are documented in [`curriculum/source-briefs/README.md`](curriculum/source-briefs/README.md); do not approve a brief without opening every listed official source.

Source briefs may provide `requiredVocabulary`. Trusted application code checks concept ID, canonical term, term language, and reviewed spoken meaning exactly after compilation and before verification; a model cannot silently replace a required curriculum term with a plausible alternative.

Every compiled concept must also include at least one no-purchase household anchor activity with a generic object name, offline recognition fixtures, one response lead, and one Socratic question. Compiler instructions exclude ingestion, heat, electricity, sharp tools, chemicals, and other unsupervised-risk activities.

Numerical fraction claims use a bounded, machine-checkable rational-comparison contract. The application verifies them by integer cross-multiplication when a pack is compiled or loaded; a false declared comparison is rejected before teaching. This currently covers rational comparisons and should be extended explicitly when reviewed packs introduce other operation types.

## Run the zero-credit demo

```bash
npm install
npm run chat -- --name Ravi --phone +919999900001
```

Try: `One fourth is bigger because four is bigger than three.`

Type `exit` to simulate a dropped call. Run the same command again and Nomad resumes the saved question. The phone number is hashed before storage, and multiple names can safely share it.

Run the placement diagnostic:

```bash
npm run diagnostic
```

The CLI command is the zero-credit deterministic adapter. In a live call, a first-time guided learner hears the same pack-defined questions before teaching. GPT-5.6 judges meaning across languages, while application code derives the score, placement level, and valid recommended concept. The result, score, and per-question evidence persist on the learner profile.

## Verify the build

```bash
npm run check
npm run eval
```

`npm run eval` runs the frozen 25-case teaching gate and reports misconception, answer-request, reasoning, insufficient-evidence, multilingual, and voice-formatting results. Current multilingual fixtures include English, Hindi/English code-switching, Spanish, Swahili, and Tamil.

The full 24-case agent harness is deliberately separate and paid. Fourteen semantic cases use GPT-5.6 as a synthetic learner, the production teaching engine, and an independent evaluator. Ten orchestration cases use the same simulator/evaluator pair around dedicated application adapters for disconnect persistence, exact reconnect, shared-phone identity, placement, callback retrieval, menu routing, Sandbox hedging, and voice formatting. Trusted code independently checks language, strategy, state, isolation, routing, question count, voice formatting, and answer leakage. It will not run without explicit confirmation:

```bash
npm run eval:agents -- --confirm-spend --case agent-spanish-english-switch
```

Omit `--case` only when intentionally running all 24 scenarios. Each case makes two live GPT-5.6 requests; semantic teaching, placement, Sandbox, and voice-format cases add one production-engine request, with one bounded retry when a teaching result fails the trusted voice policy. The latest complete report is written under `.data`, stays out of Git, and appears below the deterministic gate in Mission Control. Targeted runs use a separate `.targeted` report and cannot overwrite the full-suite evidence.

The latest complete paid run is **24/24**: fourteen semantic teaching results, ten orchestration results, zero execution errors, and no failed trusted or evaluator checks. The run recorded 78,232 input and 13,674 output text tokens. Mission Control reads this complete report; a targeted 1/1 result cannot replace it.

With an API key configured, this low-cost command verifies live Realtime name capture and guided-subject/Sandbox menu routing using text only:

```bash
npm run smoke:realtime
```

Run the small live GPT-5.6 multilingual teaching gate only when intentionally spending API credit:

```bash
npm run eval:live
```

It currently covers Hindi/English, Spanish/English, and French/English code-switching. The deterministic 25-case gate remains the normal zero-credit development loop.

`npm run eval:live-sandbox` intentionally spends one small Luna request to verify that a Spanish-English current-information question is tagged correctly, treated as safe, and hedged with low certainty.

`npm run eval:live-placement` spends one small Luna request to verify that semantically correct Spanish answers—not English keyword matches—produce a three-of-three, grade-ready placement.

The separate `npm run eval:live-history` check validates one synthetic Hindi/English learning-history narration. Realtime exposes this capability through `get_learning_history` after the caller selects their name.

## Phone architecture

Run the secret-safe readiness check before attempting a paid call:

```bash
npm run secrets:init
npm run phone:preflight
```

The initializer changes only a missing/development-default phone HMAC secret, preserves every other `.env` line, sets owner-only file permissions, and never prints the generated value. The preflight reports booleans and next actions only—never keys, tokens, project IDs, webhook secrets, or phone numbers. Three operator attestations remain false until a human has actually verified the public signed webhook, Twilio voice routing, and SIP trunk; possession of credentials alone is not reported as readiness.

For an incoming call, OpenAI sends the signed `realtime.call.incoming` webhook to `/webhooks/openai`. Nomad accepts the SIP call, extracts the caller identity from the SIP `From` header, and opens a sideband WebSocket to that exact Realtime call.

The call-accept payload explicitly enables OpenAI server VAD with automatic response creation and `interrupt_response: true`, so new learner speech can cancel ongoing Nomad audio instead of forcing the caller to wait. Threshold, prefix padding, and silence duration are bounded environment settings. The checked-in 0.5 / 300 ms / 650 ms values are provisional development policy, not a claim of field tuning; adjust them only after measuring missed speech, pause-cutoffs, and barge-in on the real Twilio phone leg.

Nomad's default Realtime voice is `marin` at a 0.8 playback multiplier, with explicit warm, calm, patient, unhurried delivery instructions. Both voice and speed are deployment settings, and speed is bounded to the documented 0.25–1.5 range. The multiplier changes playback rate; the prompt separately shapes cadence, following OpenAI's [Realtime prompting guidance](https://developers.openai.com/api/docs/guides/realtime-models-prompting#speed-instructions). These are configuration receipts, not a claim that the voice has already been tuned over an actual G.711 phone call.

If speech is missing, clipped, or too unclear to transcribe faithfully, the Realtime layer must call `recover_unclear_audio` instead of guessing or sending partial text to a teaching tool. The server returns the correct pending identity, menu, placement, guided-lesson, or Sandbox prompt and localizes only the neutral retry lead. This path makes no teaching-model request and does not change lesson progress, mastery, or Sandbox history.

Realtime asks the learner's name and calls `start_lesson`. The server returns a menu built from `deployment.subject`—currently guided Math or Curious Sandbox—and Realtime calls `choose_learning_mode` with the explicit choice. A server guard prevents a guided teaching call before that choice. A first-time guided learner must then complete the curriculum's placement questions through `complete_placement`; teaching remains blocked until the result is stored. Realtime may translate this non-decision onboarding copy into the caller's language, but it may not change the options or question meaning.

Every later guided learner answer must call `get_teaching_turn`; the server runs the frozen-pack teaching engine through GPT-5.6 Luna, persists the structured decision, and sends only the authoritative `spoken_response` back for Realtime to say. Asking for a name on every call keeps siblings on a shared phone separate, while phone number plus name resumes the correct interrupted lesson.

Each structured teaching turn also carries an auditable `reasoning_trace`. Learner-stated claims are kept separate from tutor inferences and marked supported, unsupported, or unclear against the frozen curriculum. The live prompt forbids inventing an unstated reasoning step or treating language choice, accent, confidence, or brevity as subject evidence. Historical turns written before this field are read with one explicitly `unclear` legacy inference instead of being lost.

Voice formatting is enforced after generation, not left to prompt wording. Before a turn can be saved or handed to Realtime, application code rejects Markdown, symbolic fractions such as `1/3`, more than three spoken sentences, and anything other than one question. Normal recaps and safety-forced endings are the deliberate no-question exception; their next retrieval question remains stored for a later call. The same guard runs in offline tests, the live engine, the lesson service, and the trusted layer of the agent evaluator.

The lesson arc is deployment-configured. The first pack uses eight teaching turns with explicit explore, independent-check, and recap phases. An immediate redial resumes the exact interrupted question; a later return starts with retrieval practice, including after a completed lesson. The server also prevents any model from marking mastery secure until it has observed at least two reasoning turns.

After a normally completed guided lesson, Nomad can send the exact language-matched spoken recap to the caller through Twilio SMS. This is a non-blocking side effect: a messaging failure cannot replace the voice response or undo lesson completion. It never runs for Sandbox turns or safety-forced endings, and duplicate Realtime lifecycle events cannot send it twice.

Learners can ask what they worked on before. GPT-5.6 receives only that named profile's persisted, curriculum-grounded summaries and returns a short structured narration in the learner's current language mode. The Realtime layer says that narration exactly; it does not invent history from the conversation.

Learners can explicitly enter **Curious Sandbox** after choosing their name. Realtime routes that request to a separate GPT-5.6 structured contract for child-safe open curiosity: a small idea, honest low/medium/high certainty, and exactly one Socratic follow-up in any detected language combination. Sandbox questions are PII-redacted and stored in a separate trace; they never change guided lesson progress or mastery. The zero-credit adapter refuses to invent open-world facts and instead helps the learner reason from what they know.

## Mission control

Start the server and open `http://localhost:3000/dashboard` to inspect recent teaching sessions. The page refreshes automatically and shows the anonymized learner reference, transcript, diagnosis, mastery evidence, strategy, language mode, and actual model route stored for every turn. The **Eval gate** tab runs and displays the deterministic 25-case zero-credit gate. Names, caller numbers, and phone hashes are deliberately excluded from the dashboard API.

The session view also displays the latest reasoning trace, recorded Responses and Realtime usage, measured GPT-5.6 request latency, and an evidence-based cost estimate. Usage is stored by session with the provider response ID and separate text, cached-text, input-audio, cached-audio, and output-audio token counts. Cost uses exact-model rates dated 2026-07-17 for `gpt-5.6-luna` and `gpt-realtime-2.1-mini`; an unknown route is shown as unpriced instead of borrowing another model's rate. The Eval gate also shows the latest saved GPT-5.6 learner/teacher/evaluator report when one exists; absence is labeled plainly rather than presented as a pass.

The **Sample** tab ships a 33-second Spanish-English code-switching exhibit with a click-to-seek synced transcript. It is labeled as a curated synthetic fixture, not presented as a child or live-call recording. The manifest accepts arbitrary language tags and is separate from the teaching engine. The checked-in audio uses local es-MX system voices because the current restricted project key lacks the `api.model.audio.request` scope. After enabling that scope, regenerate with `npm run sample:audio`; use `NOMAD_SAMPLE_AUDIO_BACKEND=system npm run sample:audio` for the zero-credit fallback.

Before a teaching tool call, Realtime may say one neutral acknowledgment of fewer than six words in the learner's current language. It cannot judge correctness, hint, or ask a question; the GPT-5.6 structured turn remains the sole teaching authority. This masks part of the two-model handoff, while real phone mouth-to-ear latency still must be measured after Twilio/SIP setup.

This is currently a local judge-demo surface, not an authenticated production dashboard. Do not expose it through a public tunnel with real learner data until the consent, retention, and access-control work in the plan is complete.

Incoming-call admission is conservative by default: signed webhook retries are idempotent, one caller cannot occupy two simultaneous lessons, and a caller is limited to six call starts per sliding hour. Change `NOMAD_MAX_CALLS_PER_HOUR` only with an explicit deployment policy. Rejected calls are declined before a Realtime session or learner database connection is allocated.

## Safety and privacy

Learner speech is untrusted input: prompt-injection attempts cannot change the schema or frozen curriculum, unsafe requests are redirected, benign off-topic turns return to the pending question, and repeated unsafe turns end gracefully. Likely contact and address disclosures are redacted before the model call and database write.

This remains a supervised prototype—not an approved child deployment. The required consent flow, actual data inventory, dashboard warning, current retention limitation, and pre-pilot checklist are documented in [`docs/SAFETY_PRIVACY.md`](docs/SAFETY_PRIVACY.md).

## Configuration

Copy `.env.example` to `.env`. The default `TEACHING_ENGINE=offline` mode requires no credentials. Local learner state is stored in `.data/nomad.db`, which is ignored by Git. Change `NOMAD_PHONE_HASH_SECRET` before any real deployment; it keys the one-way caller identifiers. Development defaults to `gpt-realtime-2.1-mini`; switch to the full Realtime model only for planned quality checks and the final demo.

SMS recaps are off by default. Enable `NOMAD_SMS_RECAP_ENABLED=true` only after the caller or responsible adult has explicitly consented to lesson content appearing on that specific phone, then provide the three Twilio variables in `.env`. The prototype sends only to the number that placed the call; it does not collect or infer a parent number. Shared-phone deployments need a stricter recipient policy before this flag is enabled.

The complete product scope and schedule are in [`docs/BUILD_PLAN.md`](docs/BUILD_PLAN.md). Current decisions and progress are in [`CODEX_NOTES.md`](CODEX_NOTES.md).
