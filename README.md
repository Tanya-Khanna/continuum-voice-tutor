# Nomad AI

> The connection may drop. The learning continues.

Nomad is a multilingual Socratic tutor designed for learners who may have only a basic phone. The current build combines an OpenAI Realtime SIP conversation layer with a server-side GPT-5.6 teaching engine and durable learner state. The real phone leg remains gated only on Twilio number and trunk setup.

## Universal architecture

The teaching engine contains no subject, country, grade, or language list. A deployment supplies a frozen curriculum pack with its concepts, misconception evidence, teaching scaffolds, placement diagnostic, syllabus identity, and locally tested language modes. The live model contract accepts any BCP-47-style language tag or code-switching combination. India Grade 6 fractions is the first deployment pack and demo fixture, not the product boundary.

Set `NOMAD_CURRICULUM_PATH` to any schema-valid compiled pack to change the deployment without changing teaching-engine code. Leaving it blank loads the built-in India fractions demo pack.

The offline language detector is deliberately a configurable test adapter; it does not claim to translate arbitrary languages. In live mode, the model detects and responds in the learner's actual language while remaining grounded in the selected pack.

## Curriculum compiler

`npm run curriculum:compile -- --source reviewed-source.json --out frozen-pack.json` runs a build-time GPT-5.6 Terra compiler followed by an independent verifier pass. The source brief must include official-source URLs, reviewed themes, bounded required concepts, local-context notes, and explicit originality requirements. Source prose is used only for scope; learner-facing questions and explanations must be original.

The command writes nothing unless the generated pack passes the full schema and the verifier reports no errors. Output is create-only, carries trusted provenance attached by application code, and is never fetched or changed during a live lesson. Do not run this command on an unreviewed source brief merely to produce more subjects quickly.

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

## Verify the build

```bash
npm run check
npm run eval
```

`npm run eval` runs the frozen 25-case teaching gate and reports misconception, answer-request, reasoning, insufficient-evidence, multilingual, and voice-formatting results. Current multilingual fixtures include English, Hindi/English code-switching, Spanish, Swahili, and Tamil.

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

The separate `npm run eval:live-history` check validates one synthetic Hindi/English learning-history narration. Realtime exposes this capability through `get_learning_history` after the caller selects their name.

## Phone architecture

For an incoming call, OpenAI sends the signed `realtime.call.incoming` webhook to `/webhooks/openai`. Nomad accepts the SIP call, extracts the caller identity from the SIP `From` header, and opens a sideband WebSocket to that exact Realtime call.

Realtime asks the learner's name and calls `start_lesson`. The server returns a menu built from `deployment.subject`—currently guided Math or Curious Sandbox—and Realtime calls `choose_learning_mode` with the explicit choice. A server guard prevents a guided teaching call before that choice. Realtime may translate this non-decision onboarding copy into the caller's language, but it may not change the options or question meaning.

Every later guided learner answer must call `get_teaching_turn`; the server runs the frozen-pack teaching engine through GPT-5.6 Luna, persists the structured decision, and sends only the authoritative `spoken_response` back for Realtime to say. Asking for a name on every call keeps siblings on a shared phone separate, while phone number plus name resumes the correct interrupted lesson.

The lesson arc is deployment-configured. The first pack uses eight teaching turns with explicit explore, independent-check, and recap phases. An immediate redial resumes the exact interrupted question; a later return starts with retrieval practice, including after a completed lesson. The server also prevents any model from marking mastery secure until it has observed at least two reasoning turns.

Learners can ask what they worked on before. GPT-5.6 receives only that named profile's persisted, curriculum-grounded summaries and returns a short structured narration in the learner's current language mode. The Realtime layer says that narration exactly; it does not invent history from the conversation.

Learners can explicitly enter **Curious Sandbox** after choosing their name. Realtime routes that request to a separate GPT-5.6 structured contract for child-safe open curiosity: a small idea, honest low/medium/high certainty, and exactly one Socratic follow-up in any detected language combination. Sandbox questions are PII-redacted and stored in a separate trace; they never change guided lesson progress or mastery. The zero-credit adapter refuses to invent open-world facts and instead helps the learner reason from what they know.

## Mission control

Start the server and open `http://localhost:3000/dashboard` to inspect recent teaching sessions. The page refreshes automatically and shows the anonymized learner reference, transcript, diagnosis, mastery evidence, strategy, language mode, and actual model route stored for every turn. The **Eval gate** tab runs and displays the deterministic 25-case zero-credit gate. Names, caller numbers, and phone hashes are deliberately excluded from the dashboard API.

The session view also displays recorded Responses and Realtime usage, measured GPT-5.6 request latency, and an evidence-based cost estimate. Usage is stored by session with the provider response ID and separate text, cached-text, input-audio, cached-audio, and output-audio token counts. Cost uses exact-model rates dated 2026-07-17 for `gpt-5.6-luna` and `gpt-realtime-2.1-mini`; an unknown route is shown as unpriced instead of borrowing another model's rate.

The **Sample** tab ships a 33-second Spanish-English code-switching exhibit with a click-to-seek synced transcript. It is labeled as a curated synthetic fixture, not presented as a child or live-call recording. The manifest accepts arbitrary language tags and is separate from the teaching engine. The checked-in audio uses local es-MX system voices because the current restricted project key lacks the `api.model.audio.request` scope. After enabling that scope, regenerate with `npm run sample:audio`; use `NOMAD_SAMPLE_AUDIO_BACKEND=system npm run sample:audio` for the zero-credit fallback.

Before a teaching tool call, Realtime may say one neutral acknowledgment of fewer than six words in the learner's current language. It cannot judge correctness, hint, or ask a question; the GPT-5.6 structured turn remains the sole teaching authority. This masks part of the two-model handoff, while real phone mouth-to-ear latency still must be measured after Twilio/SIP setup.

This is currently a local judge-demo surface, not an authenticated production dashboard. Do not expose it through a public tunnel with real learner data until the consent, retention, and access-control work in the plan is complete.

Incoming-call admission is conservative by default: signed webhook retries are idempotent, one caller cannot occupy two simultaneous lessons, and a caller is limited to six call starts per sliding hour. Change `NOMAD_MAX_CALLS_PER_HOUR` only with an explicit deployment policy. Rejected calls are declined before a Realtime session or learner database connection is allocated.

## Safety and privacy

Learner speech is untrusted input: prompt-injection attempts cannot change the schema or frozen curriculum, unsafe requests are redirected, benign off-topic turns return to the pending question, and repeated unsafe turns end gracefully. Likely contact and address disclosures are redacted before the model call and database write.

This remains a supervised prototype—not an approved child deployment. The required consent flow, actual data inventory, dashboard warning, current retention limitation, and pre-pilot checklist are documented in [`docs/SAFETY_PRIVACY.md`](docs/SAFETY_PRIVACY.md).

## Configuration

Copy `.env.example` to `.env`. The default `TEACHING_ENGINE=offline` mode requires no credentials. Local learner state is stored in `.data/nomad.db`, which is ignored by Git. Change `NOMAD_PHONE_HASH_SECRET` before any real deployment; it keys the one-way caller identifiers. Development defaults to `gpt-realtime-2.1-mini`; switch to the full Realtime model only for planned quality checks and the final demo.

The complete product scope and schedule are in [`docs/BUILD_PLAN.md`](docs/BUILD_PLAN.md). Current decisions and progress are in [`CODEX_NOTES.md`](CODEX_NOTES.md).
