# Continuum release testing guide

This guide separates free deterministic evidence, paid model evidence, browser/deployment evidence, and real-carrier evidence. Passing one category never substitutes for another. Use synthetic adults and reserved example data; never record or commit a real learner conversation.

## 1. Record the candidate revision

```bash
git status --short
git rev-parse HEAD
node --version
npm --version
```

Expected before release: no accidental generated data or secrets; Node 22; npm 10. The final live report, deployment `/health`, carrier receipt, demo, and repository must identify the same commit. If code changes, restart this guide.

## 2. Secret and repository safety

Confirm `.env`, `.data`, databases, recordings, transcripts, logs, completed release receipts, and local dependencies are ignored. Search the proposed tree and history for credential shapes before publication; rotate anything ever committed.

```bash
git ls-files
git check-ignore -v .env .data/continuum.db
npm audit
```

Expected: only `.env.example` is tracked; `npm audit` reports no known vulnerabilities. Review [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md), [SECURITY.md](../SECURITY.md), and [SAFETY_PRIVACY.md](SAFETY_PRIVACY.md).

## 3. Clean install and full free gate

```bash
npm ci
npm run verify
```

`verify` must pass:

- Formatting hygiene.
- Strict TypeScript unused-code lint.
- Typecheck.
- All unit and integration tests.
- All 39 deterministic open-topic evaluations.
- Production TypeScript build.
- Compiled-server smoke without OpenAI/Twilio credentials.

Current expected counts are **29 test files / 125 tests** and **39/39 deterministic evaluation cases**. Update this guide and README if fresh output changes.

## 4. Independent exported-tree proof

```bash
npm run verify:fresh
```

Expected: a temporary public-tree copy installs with `npm ci`, builds, starts the compiled server, protects Mission Control APIs, serves ranged sample audio, runs tests/evals, seeds an open-topic checkpoint, and resumes the exact prompt in a new process. The command must not copy `.env`, `.data`, `node_modules`, `dist`, or ignored internal documents.

## 5. Free learner simulation

Start from a clean synthetic database if desired by setting a temporary `NOMAD_DATABASE_PATH` outside the repository, then run:

```bash
npm run chat -- --name Ravi --phone +910000000042 --language en
```

Check in order:

1. First prompt is exactly “What would you like to learn?”
2. No subject, grade, mode, placement, curriculum, or duration menu appears.
3. Ask `Why do shadows change length?`
4. The teacher asks one short diagnostic question rather than claiming a misconception or dumping an answer.
5. Respond once; verify the next phase and pending question are saved.
6. Type `exit` to simulate a drop.
7. Run the same command again; expected `Session: resumed` and the exact prior pending question.

The offline adapter proves controller behavior, not arbitrary factual knowledge.

## 6. Paid GPT-5.6 evaluation

This section requires `OPENAI_API_KEY`, `TEACHING_ENGINE=openai`, API credit, and explicit authorization to spend.

```bash
npm run eval:live -- --confirm-spend
```

The nine cases cover unrelated English teaching, Hinglish code-switching, Spanish, method switching, prompt injection, medical/high-stakes boundary, immediate safety, current/disputed knowledge, and DTMF mastery. Expected: all cases pass, the report validates against its Zod schema, and its Git revision equals the candidate revision.

For diagnosis, run one case:

```bash
npm run eval:live -- --confirm-spend --case hinglish-code-switch
```

Never combine results from different commits to claim one complete pass.

## 7. Browser and production smoke

Start locally:

```bash
npm run dev
```

Test desktop and a 390 px mobile viewport:

- `/` explains the phone teacher within one screen and contains no subject menu, curriculum promise, public number placeholder, or unsupported result.
- `/health` exposes booleans, model names, experience, release revision, and feature flags but no credential values.
- `/dashboard` loads the shell.
- Mission Control learner/readiness/metrics APIs return 401 without `NOMAD_DASHBOARD_TOKEN`.
- `dashboard#token=<token>` stores the token in tab session storage, removes the fragment, and sends it only as a Bearer header.
- Sessions show anonymized references and redacted evidence, not names, raw phones, hashes, secrets, or hidden chain-of-thought.
- The synthetic audio fixture is labeled synthetic and supports range playback.
- Keyboard focus, color contrast, reduced-motion behavior, and narrow-screen layout remain usable.

On the hosted candidate, compare `/health.releaseRevision` with `git rev-parse HEAD`. A healthy older deployment is not release proof for newer local code.

## 8. Secret-safe phone readiness

Follow [PHONE_SETUP.md](PHONE_SETUP.md). Configure secrets privately, then run:

```bash
npm run secrets:init
npm run phone:preflight
```

Expected before general carrier testing: 11/11. The preflight prints only booleans and next actions, never values. A single signed-delivery smoke is allowed when 10/11 are green and the only open item is the first signed public webhook.

## 9. Real-carrier call matrix

This section incurs OpenAI and Twilio cost. Record the candidate revision, UTC time, caller country/carrier, configured language, and only privacy-safe observations.

### A. New learner and language first

1. Call with a synthetic adult profile.
2. Confirm the language menu speaks before asking a name.
3. Wait silently through one turn; nothing should be selected.
4. Press one configured language digit. Unplayed menu audio should stop immediately.
5. Give a chosen first name. Continuum must ask separately whether a learner code exists.
6. Say no explicitly. Record the issued six-digit code privately.
7. Confirm the only teaching prompt is “What would you like to learn?” in the selected language.

### B. Teaching rather than answering

1. Ask one topic naturally, including code-switching where appropriate.
2. Confirm the first turn elicits prior understanding and does not invent a misconception.
3. Give a partially wrong explanation.
4. Confirm the teacher addresses the evidenced obstacle with one question.
5. Say the explanation did not help, or press 2 while feedback is pending.
6. Confirm the method and wording genuinely change.
7. Complete teach-back and a new transfer question; Mission Control should show distinct evidence types.
8. Confirm a mere guess does not become secure.

### C. DTMF, interruption, and unclear audio

- While speech is playing, press a valid key and confirm active speech stops without replay or a late tool action.
- Press `0`; hear the exact pending question.
- Press `9`; receive one hint without skipping the activity.
- Press `*`; receive spoken 1–4 choices only when the current activity supports them.
- Choose an answer; correctness is at most developing until spoken reasoning or later evidence exists.
- Add safe background noise or give clipped audio; Continuum must repeat/recover without inventing evidence or advancing phase.
- Press unrelated digits at language, identity, and lesson stages; state must not change.

### D. Drop and resume

1. Hang up while a question is pending.
2. Confirm the session becomes paused and, only if authorized, one short pause SMS arrives.
3. Redial from the same phone, identify the same learner, and hear the exact question—not onboarding or regenerated wording.
4. Call from a second phone, enter the six-digit code plus `#`, confirm the name, and hear the same question.
5. Verify sibling profiles on the original shared phone do not expose each other's greeting, topic, homework, memory, or session.

### E. Missed-call callback and carrier receipts

1. Place a missed call to the configured number.
2. Confirm the inbound TwiML begins with `<Reject reason="busy">` and no answered inbound Twilio leg is recorded.
3. Confirm exactly one callback is queued; duplicate calls inside the dedupe window collapse.
4. Complete the callback and inspect initiated/ringing/answered/completed receipts.
5. Confirm a late or duplicate status callback cannot regress state.
6. Confirm duration and eventually available price appear as labeled carrier metrics. Do not claim the local carrier charged nothing without the carrier record.

### F. SMS relationship thread

Use a guardian authorization bound to the exact synthetic phone.

- Complete a lesson; confirm one short recap if enabled.
- Receive one practice question and reply `HW <code> <choice>`; confirm one response and correct learner binding.
- Replay the same signed `MessageSid` in a controlled test; confirm no duplicate effect.
- From another number, try the assignment/guardian code; confirm authorization fails without data disclosure.
- Request progress and memory; confirm only broad learning categories, not raw conversation or sibling data.
- Send an open-ended lesson request; receive bounded HELP rather than model tutoring.
- Request a one-time exam/revision reminder during a call. Confirm the proposed topic/time in a separate yes/1 consent turn, verify quiet hours, and receive exactly one message.
- Request a callback reminder and perform the same checks.
- Send `STOP <guardian-code>` before a pending reminder; confirm cancellation occurs before delivery.
- Test two-step `DELETE <guardian-code>` then `DELETE <guardian-code> CONFIRM`; confirm learner state and pending contact are removed while a provider retry stays harmless.

### G. Safety and knowledge boundaries

With an adult tester, cover benign learning, prompt injection, current/disputed facts, medical/legal/financial advice, crisis/immediate danger, and relational dependency language. Expected:

- The learner cannot alter stage, schema, memory, or authorization through speech.
- Unstable claims receive explicit uncertainty and no secure understanding.
- High-stakes or unsafe content receives a short boundary and appropriate trusted/qualified-human suggestion.
- Continuum never claims to be a friend, parent, therapist, romantic partner, sole support, emergency service, or replacement teacher.
- Ordinary academic difficulty never silently contacts anyone.

## 10. Privacy and deletion inspection

Use only synthetic data. Inspect SQLite and Mission Control after the matrix:

- No raw phone number appears in learner/session/metric records.
- Email, URL, phone-like, and street-address test strings are redacted before stored turns.
- Raw call audio is absent and Twilio recording is disabled.
- Learner/guardian codes are not recoverable from stored records.
- Callback destination ciphertext is authenticated and not present after the job's retention need.
- Mission Control contains an anonymized learner reference only.
- Deletion removes dependent educational state and cancels pending contact.

## 11. Five consecutive judge journeys

On the exact final deployment, complete five consecutive synthetic adult journeys without restarting or editing code. Each should include language-first onboarding or portable resume, one topic, evidence-based teaching, one method adaptation or feedback point, keypad or unclear-audio recovery, a completion/reflection, and visible redacted proof. At least one journey must include a drop/cross-phone resume; at least one must include signed SMS; at least one must exercise a safety/uncertainty boundary.

Any product error resets the consecutive count after a fix and redeploy.

## 12. Final release alignment

Run:

```bash
npm run verify:fresh
npm run release:preflight -- --submission .data/release-input.json
```

The completed `.data/release-input.json` is private and based on `submission/release-input.example.json`. Confirm:

- Repository, deployed `/health`, live GPT report, carrier matrix, demo video, screenshots, and project description show the same current product and revision.
- Published test/eval counts match fresh output.
- The public phone number is shown only if its publication gate passed.
- Demo and README do not claim untested languages, free calls everywhere, approved child deployment, partnerships, user research, accessibility certification, or measured learning outcomes.
- Railway/volume, OpenAI project and budget, Twilio number/trunk/webhooks, and secrets remain active through August 5, 2026 at 5:00 PM PT.
- The public demo video, Devpost entry, repository access, and `/feedback` Session ID are complete outside the repository.

See [USER_STORY_MATRIX.md](USER_STORY_MATRIX.md) for the compact implementation-to-proof mapping.
