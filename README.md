# Nomad AI

> The connection may drop. The learning continues.

Nomad is a multilingual Socratic tutor designed for learners who may have only a basic phone. The current build combines an OpenAI Realtime SIP conversation layer with a server-side GPT-5.6 teaching engine and durable learner state. The real phone leg remains gated only on Twilio number and trunk setup.

## Universal architecture

The teaching engine contains no subject, country, grade, or language list. A deployment supplies a frozen curriculum pack with its concepts, misconception evidence, teaching scaffolds, placement diagnostic, syllabus identity, and locally tested language modes. The live model contract accepts any BCP-47-style language tag or code-switching combination. India Grade 6 fractions is the first deployment pack and demo fixture, not the product boundary.

Set `NOMAD_CURRICULUM_PATH` to any schema-valid compiled pack to change the deployment without changing teaching-engine code. Leaving it blank loads the built-in India fractions demo pack.

The offline language detector is deliberately a configurable test adapter; it does not claim to translate arbitrary languages. In live mode, the model detects and responds in the learner's actual language while remaining grounded in the selected pack.

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

With an API key configured, this low-cost command verifies live Realtime tool routing using text only:

```bash
npm run smoke:realtime
```

Run the small live GPT-5.6 multilingual teaching gate only when intentionally spending API credit:

```bash
npm run eval:live
```

It currently covers Hindi/English, Spanish/English, and French/English code-switching. The deterministic 25-case gate remains the normal zero-credit development loop.

## Phone architecture

For an incoming call, OpenAI sends the signed `realtime.call.incoming` webhook to `/webhooks/openai`. Nomad accepts the SIP call, extracts the caller identity from the SIP `From` header, and opens a sideband WebSocket to that exact Realtime call.

Realtime asks the learner's name and calls `start_lesson`. Every later learner answer must call `get_teaching_turn`; the server runs the frozen-pack teaching engine through GPT-5.6 Luna, persists the structured decision, and sends only the authoritative `spoken_response` back for Realtime to say. Asking for a name on every call keeps siblings on a shared phone separate, while phone number plus name resumes the correct interrupted lesson.

The lesson arc is deployment-configured. The first pack uses eight teaching turns with explicit explore, independent-check, and recap phases. An immediate redial resumes the exact interrupted question; a later return starts with retrieval practice, including after a completed lesson. The server also prevents any model from marking mastery secure until it has observed at least two reasoning turns.

## Mission control

Start the server and open `http://localhost:3000/dashboard` to inspect recent teaching sessions. The page refreshes automatically and shows the anonymized learner reference, transcript, diagnosis, mastery evidence, strategy, language mode, and actual model route stored for every turn. Names, caller numbers, and phone hashes are deliberately excluded from the dashboard API.

This is currently a local judge-demo surface, not an authenticated production dashboard. Do not expose it through a public tunnel with real learner data until the consent, retention, and access-control work in the plan is complete.

## Configuration

Copy `.env.example` to `.env`. The default `TEACHING_ENGINE=offline` mode requires no credentials. Local learner state is stored in `.data/nomad.db`, which is ignored by Git. Change `NOMAD_PHONE_HASH_SECRET` before any real deployment; it keys the one-way caller identifiers. Development defaults to `gpt-realtime-2.1-mini`; switch to the full Realtime model only for planned quality checks and the final demo.

The complete product scope and schedule are in [`docs/BUILD_PLAN.md`](docs/BUILD_PLAN.md). Current decisions and progress are in [`CODEX_NOTES.md`](CODEX_NOTES.md).
