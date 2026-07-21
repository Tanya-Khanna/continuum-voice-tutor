# Continuum handoff

Verified on **July 21, 2026**. This is a release handoff, not a product plan. Read
`README.md`, `AGENTS.md`, and the current implementation before changing anything.

## Release identity

- Branch: `main`
- Last application/code release commit: `4f6f6deb870684d07cb27dc7b01fc042943ff9ef`
- GitHub: <https://github.com/Tanya-Khanna/continuum-voice-tutor> (**private at handoff time**)
- Production: <https://continuum-production-8971.up.railway.app/>
- Health/revision: <https://continuum-production-8971.up.railway.app/health>
- Protected Mission Control shell: <https://continuum-production-8971.up.railway.app/dashboard>
- Primary Codex build task / `/feedback` Session ID:
  `019f6dd7-9486-74b2-9828-be19ee983b70` (recorded, but the `/feedback`
  share/upload flow is still a manual submission task)
- Successful release-gate run for the application commit:
  <https://github.com/Tanya-Khanna/continuum-voice-tutor/actions/runs/29872543757>

`HANDOFF.md` is the only change after the application release above. When this
repository is cloned, `git rev-parse HEAD` is the authoritative handoff-document
commit; the application revision remains the SHA above unless code changes.

## 1. What the project does

Continuum is a multilingual, voice-first Socratic teacher reached through an
ordinary phone. After spoken language selection and private identity, it asks one
open question: **“What would you like to learn?”** It teaches a safe topic through
short questions, explanations, method changes, practice, teach-back, transfer, and
reflection. Speech is primary; DTMF keypad input and bounded SMS keep a lesson
usable when audio or connectivity fails.

It is not a subject menu, curriculum/LMS, answer bot, companion, therapist, or
general SMS chatbot. It is a supervised prototype and does not claim measured
real-world learning outcomes or approved child deployment.

## 2. Exact end-to-end product flow

The implemented flow is:

1. The learner directly calls through the SIP route, or makes a missed call in the
   configured one-number deployment. The missed-call webhook validates Twilio's
   signature, returns `<Reject reason="busy">`, deduplicates/rate-limits the request,
   and places one outbound callback within policy.
2. OpenAI Realtime over SIP handles audio, transcription, interruptions, turn
   taking, speech output, and DTMF events. The language menu comes before identity.
3. A new learner gives a chosen name and explicitly says they have no code; the
   application issues a random six-digit portable code. A returning learner enters
   six digits plus `#`. Profiles remain separate on shared phones, and the same code
   can resume from another phone.
4. Continuum asks what the learner wants to learn. There is no subject, grade,
   mode, placement, curriculum, or duration menu.
5. GPT-5.6 proposes a Zod-validated structured learning intent, diagnosis basis,
   teaching method, voice activity, evidence interpretation, and safety decision.
   Trusted code applies semantic policy and saves the exact pending checkpoint
   before the prompt is spoken.
6. The learner answers by speech. The controller elicits a prior model, teaches,
   asks whether the method helped, switches method when it did not, then seeks
   practice, teach-back, novel transfer, reflection, and a next retrieval question.
   Correct guesses and DTMF-only answers cannot establish secure understanding.
7. During a lesson, `0` repeats the exact question, `9` requests a hint, and `*`
   requests reviewed keypad choices where available. Late, duplicate, malformed,
   unclear, or stale events cannot advance state.
8. If the call drops, the session pauses at the persisted prompt. An authorized
   short SMS may say the lesson is waiting. A later call with the learner identity
   resumes that exact prompt from the same or another phone.
9. Authorized SMS supports a recap, one coded practice reply, pause notice,
   one-time exam/revision or callback reminder, progress/memory controls, `STOP`,
   and two-step deletion. It never opens a second free-form model conversation.

The controller and adapters for this flow are implemented and covered by automated
tests. **The complete final-revision real-carrier matrix has not been signed off**;
see “Known limitations” before presenting the phone path as judge-ready.

## 3. Architecture and important files

The core trust boundary is: **the models propose; application code decides what is
valid, spoken, stored, sent, or acted upon.**

- `src/server.ts` — HTTP server, health/dashboard, signed OpenAI/Twilio webhooks,
  callback/SMS workers, and production composition.
- `src/config/env.ts` — Zod environment contract and safe defaults.
- `src/runtime/open-topic-runtime.ts` — selects the offline or OpenAI engine.
- `src/engine/open-topic-engine.ts` — model-independent teaching interface.
- `src/engine/openai-open-topic-engine.ts` — GPT-5.6 Responses API, Structured
  Outputs, validation retry, and policy checks.
- `src/engine/offline-open-topic-engine.ts` — zero-credit deterministic adapter;
  proves orchestration but not arbitrary factual teaching.
- `src/lesson/open-topic-lesson-service.ts` — trusted teaching stages, evidence,
  method switching, mastery caps, checkpoints, and safety boundary.
- `src/telephony/open-topic-realtime-bridge.ts` — Realtime sideband controller,
  verified transcription, language/identity stages, cancellation, and DTMF.
- `src/telephony/open-topic-realtime.ts` and `src/telephony/sip.ts` — stage-gated
  Realtime tools and SIP accept/end control.
- `src/telephony/missed-call-callback.ts` — signed missed-call callback jobs,
  encryption, dedupe, limits, and Twilio call placement.
- `src/messaging/` — bounded homework, recap, reminder, and Twilio SMS adapters.
- `src/persistence/sqlite-learning-repository.ts` — automatic schema setup and
  SQLite storage for selective memory, identity, evidence, checkpoints,
  authorization, idempotency, reminders, and usage.
- `src/privacy/redact-pii.ts` and `src/security/` — PII defense, dashboard access,
  and bounded request bodies.
- `src/observability/` and `src/dashboard/page.ts` — PII-redacted Mission Control.
- `src/evals/` — 39 deterministic cases and the spend-gated nine-case GPT suite.
- `scripts/verify-fresh-clone.ts`, `scripts/verify-production.ts`, and
  `scripts/release-preflight.ts` — release, compiled-server, and receipt gates.
- `test/` — 29 files / 125 automated tests at the application release SHA.
- `docs/TESTING_GUIDE.md`, `docs/PHONE_SETUP.md`, `docs/DEPLOYMENT.md`, and
  `docs/SAFETY_PRIVACY.md` — authoritative operating and acceptance procedures.

Twilio owns the PSTN/SMS boundary. OpenAI Realtime owns live voice transport and
turn-taking. GPT-5.6 performs semantic pedagogical reasoning through the Responses
API. Zod plus the application state machine constrain those probabilistic outputs.
SQLite owns selective educational continuity. The learner never needs the hosted
web page or mobile data.

## 4. Completed during Build Week

Git history starts July 16, 2026 and supports that the project was built during the
July 16–21 period. Completed work includes:

- Zero-credit offline teaching controller and exact process-boundary resume.
- Open-topic GPT-5.6 teaching adapter with structured, validated decisions.
- OpenAI Realtime SIP sideband flow with interruption and stale-event handling.
- Twilio single-number missed-call callback, carrier receipts, DTMF, and bounded SMS.
- Language-first onboarding, portable learner codes, shared-phone isolation, and
  same/cross-phone persistence contracts.
- Evidence-based teaching stages, method switching, learner feedback, teach-back,
  transfer, reflection, mastery rules, uncertainty, and human-support boundaries.
- Selective memory, PII redaction, consent/authorization, STOP, and deletion paths.
- Protected Mission Control, access/reliability/learning metrics, landing page,
  container/volume deployment, public documentation, and release automation.
- Refactor from the retired curriculum/menu prototype to one clean open-topic
  teacher. The current runtime has no curriculum-pack dependency.

## 5. What GPT-5.6 does

The configured text model is `gpt-5.6-luna`. It preserves open-topic intent,
separates missing evidence from a supported misconception, chooses and changes a
teaching method, interprets free-form reasoning, proposes short voice activities,
expresses uncertainty, and proposes safety/human-support decisions. It returns a
versioned structured object through the Responses API; it does not own stages,
identity, authorization, persistence, SMS delivery, mastery, or telephony actions.

The latest local paid report is `open_topic_live_v7`: **9/9 passed** on
`d72afb80f74a1cba23a072ef9366d68b302ae610` with model `gpt-5.6-luna`, generated
2026-07-21T12:09:15Z. The report is ignored in `.data/` and is not public evidence
unless deliberately summarized without secrets or learner data.

## 6. What Codex helped implement

Codex collaborated throughout architecture, implementation, debugging, refactoring,
testing, privacy/security review, deployment validation, and documentation. Concrete
areas include the Realtime sideband boundary, trusted teaching controller, Zod
schemas, SQLite repository, DTMF/callback/SMS adapters, Mission Control, deterministic
and live evaluations, and clean-export release tooling.

A documented debugging example is the live call that replayed the language menu,
selected Science after silence, and treated a spoken name as proof that no learner
code existed. Codex traced delayed Realtime events, added response cancellation and
stale-response rejection, separated identity into trusted turns, and added regression
tests. Product decisions—open-topic scope, bounded SMS, DTMF mastery cap, selective
memory, no recurring lesson calls, and the publication gate—were made by the builder.

## 7. Install, run, test, package, and deploy

Requirements: Node 22 (`.nvmrc`) and npm 10.9.3. Keep the single
`package-lock.json`.

```bash
nvm use
npm ci
cp .env.example .env
npm run secrets:init
```

Free local experience and development server:

```bash
npm run chat -- --name Ravi --phone +910000000042 --language en
npm run dev
```

Free deterministic verification:

```bash
npm run typecheck
npm test
npm run eval
npm run verify
npm run verify:fresh
```

Paid/external checks—run only with credentials and authorization to spend:

```bash
npm run eval:live -- --confirm-spend
npm run phone:preflight
npm run release:preflight -- --automated-passed \
  --base-url https://continuum-production-8971.up.railway.app \
  --submission .data/release-input.json
```

Build/package/run production:

```bash
npm run build
npm run smoke:production
npm run start:prod
docker build -t continuum .
docker run --rm -p 3000:3000 --env-file .env continuum
```

Host contract: `npm ci`, `npm run build`, `npm run start:prod`, Node 22+, HTTPS,
health path `/health`, host-provided `PORT`, and one persistent volume with
`NOMAD_DATABASE_PATH=/data/nomad.db`. Use one application replica for SQLite. On
Railway, the checked-in startup wrapper supports `RAILWAY_RUN_UID=0` only to prepare
the mounted directory and then drops privileges. Deployment itself is a provider
action; no repository script deploys to Railway. Preserve secrets in Railway, not
the repository or image.

## 8. Environment-variable names

`.env.example` is authoritative. It currently contains these names (never copy
values into Git or a handoff message):

```text
TEACHING_ENGINE
HOST
PORT
NOMAD_DATABASE_PATH
NOMAD_PHONE_HASH_SECRET
NOMAD_LEARNER_CODE_SECRET
NOMAD_GUARDIAN_CODE_SECRET
NOMAD_CALLBACK_SECRET
NOMAD_PUBLIC_BASE_URL
NOMAD_RELEASE_COMMIT
NOMAD_PUBLIC_PHONE_ENABLED
NOMAD_MISSED_CALL_ENABLED
NOMAD_MISSED_CALL_ADULT_DEMO
NOMAD_SMS_CONTROLS_ENABLED
NOMAD_SMS_REMINDERS_ENABLED
NOMAD_SMS_REMINDER_INTERVAL_MS
NOMAD_CALLBACK_ALLOWED_PREFIXES
NOMAD_DEPLOYMENT_TIME_ZONE
NOMAD_CALLBACK_QUIET_START_HOUR
NOMAD_CALLBACK_QUIET_END_HOUR
NOMAD_CALLBACK_PER_NUMBER_DAILY_LIMIT
NOMAD_CALLBACK_GLOBAL_DAILY_LIMIT
NOMAD_OPEN_TOPIC_LIVE_EVAL_REPORT_PATH
NOMAD_MAX_CALLS_PER_HOUR
NOMAD_DASHBOARD_TOKEN
OPENAI_API_KEY
OPENAI_TEXT_MODEL
OPENAI_REALTIME_MODEL
OPENAI_REALTIME_VOICE
OPENAI_REALTIME_SPEED
NOMAD_VAD_THRESHOLD
NOMAD_VAD_PREFIX_PADDING_MS
NOMAD_VAD_SILENCE_MS
OPENAI_WEBHOOK_SECRET
OPENAI_PROJECT_ID
NOMAD_OPENAI_WEBHOOK_PUBLIC
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER
TWILIO_MISSED_CALL_NUMBER
NOMAD_TWILIO_SIP_TRUNK_CONFIGURED
NOMAD_TWILIO_NUMBER_VOICE_READY
NOMAD_SMS_RECAP_ENABLED
```

`RAILWAY_RUN_UID` is a Railway runtime setting documented in `docs/DEPLOYMENT.md`,
not part of the general `.env.example` contract.

## 9. Current services and safe URLs

- Railway hosts the production Node service and a persistent SQLite volume.
- OpenAI supplies the Responses and Realtime APIs and the signed incoming-call
  webhook.
- Twilio supplies one voice/SMS-capable number, missed-call/SMS webhooks, callbacks,
  and delivery/status receipts.
- GitHub hosts the private repository and release-gate Actions workflow.

Safe public URLs are listed under “Release identity.” Do not add the phone number,
dashboard token, account/project IDs, webhook secrets, API keys, provider console
links, or Railway internal identifiers to this file. The protected judge dashboard
URL exists only in the private release receipt and must be shared separately.

## 10. Known limitations and unreliable paths

- The final-revision carrier matrix is **0/17** and consecutive golden journeys are
  **0/5** in the private release receipt. Do not describe live phone acceptance as
  complete.
- The public phone number is deliberately hidden (`publicPhonePublished: false`).
- “Any language” is an architectural goal. The paid suite covers English, Hinglish,
  and Spanish model behavior, but no final-revision multilingual carrier-quality
  claim is verified. Accent, noise, codec, ASR, and DTMF behavior vary by carrier.
- The offline adapter demonstrates orchestration and recovery, not arbitrary factual
  knowledge. Open-topic factual teaching needs the OpenAI engine.
- No recurring outbound tutoring calls exist. The build supports missed-call
  callbacks and separately consented one-time SMS reminders.
- SMS is bounded continuity, not a general teacher over text.
- Continuum does not browse during lessons. Unstable/current/disputed and high-stakes
  topics must use uncertainty or a qualified-human boundary.
- Voice-only teaching excludes deaf/hard-of-hearing learners; supplementary SMS is
  not an equivalent classroom. PII redaction is defense in depth, not a guarantee.
- No pilot, partnership, accessibility certification, user research, or measured
  educational outcome is claimed.
- Railway, its volume, OpenAI billing, and Twilio must remain funded/configured
  through August 5, 2026 at 5:00 PM PT.

## 11. Last successfully tested flows

Verified on the application release SHA:

- `npm run verify:fresh`: clean exported-tree `npm ci`, formatting, strict lint,
  typecheck, **29 files / 125 tests**, **39/39 deterministic evaluations**, production
  build/smoke, and process-boundary exact resume all passed.
- The latest paid `npm run eval:live -- --confirm-spend` report is **9/9** on
  `d72afb80f74a1cba23a072ef9366d68b302ae610`; it must be rerun before claiming
  revision-bound live-model proof for `4f6f6de`.
- GitHub Actions release gate passed on `4f6f6de`.
- Production `/health` currently reports `ok: true`, OpenAI teaching, Realtime
  configured, `open_topic_teacher`, no curriculum dependency, revision
  `4f6f6deb8706`, callback/SMS/reminder/recap enabled, scheduler disabled, and public
  phone hidden.
- Phone configuration preflight previously reached **11/11**. This is configuration
  evidence, not carrier-behavior evidence.
- The hosted landing page and health endpoint loaded without application errors in
  the final browser smoke.

No complete live carrier journey after the final deployment is recorded. Earlier
interactive calls exposed bugs and must not be reused as final acceptance evidence.

## 12. Remaining submission tasks

1. Run the 17-item real-carrier matrix in `docs/TESTING_GUIDE.md` on the exact final
   deployed revision; use synthetic adults and record privacy-safe evidence.
2. Complete five consecutive golden judge journeys. A product error resets the
   count after any fix/redeploy.
3. Only after those pass, decide whether to set `NOMAD_PUBLIC_PHONE_ENABLED=true` and
   publish the number. Otherwise provide the documented deterministic/demo path.
4. Record/upload the public demo video and add its YouTube URL to the private receipt
   and Devpost. No demo URL is currently verified.
5. Run `/feedback` in the primary Codex build task and complete the share/upload
   flow. The locally recorded session ID alone does not prove submission.
6. Complete Devpost team invitation acceptance. Current receipt: not confirmed.
7. Make the GitHub repository public or share the private repository with the
   official judging accounts. Current repository state: private and not confirmed
   shared.
8. Re-run `npm run release:preflight` with `--automated-passed`, `--base-url`, and the
   completed ignored receipt until every automated/manual item is supported.
9. Ensure the human-written Devpost copy, demo, screenshots, README, deployment, and
   test counts all describe this open-topic release—not the retired curriculum/menu
   prototype.
10. Keep provider services and budget active through the judging window.

## 13. Do not change before submission

- Do not reintroduce subject/grade menus, curriculum packs, Guided/Curious modes, a
  learner web classroom, WhatsApp, camera input, or companion behavior.
- Do not add recurring tutoring calls or turn SMS into a free-form chatbot.
- Do not let model output control identity, state transitions, persistence, mastery,
  safety, authorization, or provider actions without trusted validation.
- Do not weaken signed webhooks, idempotency, stale-event rejection, atomic
  checkpoint-before-speech, portable identity, sibling isolation, selective memory,
  STOP/deletion, DTMF mastery caps, or Mission Control privacy.
- Do not change prompts, VAD, Realtime routing, schemas, persistence, deployment
  variables, or the demo flow without re-running `verify:fresh`, the paid nine-case
  suite, deployment revision check, and affected carrier acceptance tests.
- Do not publish the phone number or claim languages, live access, safety guarantees,
  or learning outcomes that the final evidence does not support.

For any change, keep credentials in `.env`/provider secret stores, record a concise
decision in `CODEX_NOTES.md` only if that local file exists and remains intentionally
untracked, and follow `CONTRIBUTING.md`.
