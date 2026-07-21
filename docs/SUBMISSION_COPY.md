# Submission drafting material and claims ledger

This is fact-checked scaffolding, not final prose. Tanya must rewrite the project
description in her own voice, verify every claim against the final commit, and
leave blocked placeholders unresolved rather than guessing.

## Locked title and pitch ingredients

**Continuum — The connection may drop. The learning continues.**

Continuum is a patient teacher a learner can call from any phone. The learner asks
to learn any safe topic in their language; Continuum elicits their current model,
diagnoses only from evidence, changes teaching methods when one fails, checks
teach-back and transfer, remembers the exact next step, and uses keypad/SMS when
speech or connectivity breaks down.

**Do not describe it as:** a curriculum, LMS, course catalog, answer hotline,
companion bot, scheduled robocaller, WhatsApp product, or learner-facing web app.

## Technical story to rewrite personally

The phone call is the classroom. OpenAI Realtime handles multilingual audio,
turn-taking, interruption, and SIP keypad events. Every substantive learner turn
crosses a sideband tool boundary into a GPT-5.6 Responses model that returns a
Zod-validated learning intent, topic plan, diagnosis, teaching method, activity,
evidence assessment, uncertainty state, and human-support decision.

That structured output cannot directly mutate the product. Trusted code verifies
the server transcript, controls the lesson phase, rejects a diagnosis without
evidence, prevents a failed method from repeating, caps keypad guesses, requires
independent transfer or retention for secure understanding, persists the exact
question before speech, enforces safety/memory/consent policy, and records a
redacted proof trace. This application-owned learning loop is the main reason the
project is more than a teacher prompt around GPT.

A private six-digit learner code makes the learning relationship portable across
shared or changing phones. If a call drops, the saved pending question survives.
Optional SMS carries one bounded practice item, a pause notice, progress/memory
controls, or one learner-confirmed exam reminder. Unsupported SMS is never sent to
an open chatbot, and recurring tutoring calls are disabled.

The current deterministic release gate covers the product contract, Structured
Outputs, diagnosis evidence, pedagogy transitions, method switching, teach-back,
transfer, mastery honesty, prompt injection, dependency/secrecy/companion
boundaries, high-stakes and disputed knowledge, PII redaction, consented memory,
trusted traces, exact resume, and unrelated topics through one pack-free engine.
Refresh exact test and eval counts from the final CI run before submission.

Codex was used continuously for architecture migration, implementation, tests,
debugging, evaluation design, privacy/safety gates, telephony integration, and
release documentation. The commit history and `CODEX_NOTES.md` show the evolution,
including bugs found through real carrier testing. GPT-5.6 is used for the actual
pedagogical reasoning layer, not merely submission copy.

## Judge testing instructions

### Zero-credit path

```bash
git clone https://github.com/Tanya-Khanna/nomad-ai.git
cd nomad-ai
npm ci
npm run verify:fresh
npm run chat -- --name Judge --phone +910000000099 --language en
```

Ask unrelated questions, give an incorrect explanation, type `exit`, and rerun the
same command to prove exact resume. The offline adapter validates state and policy;
it does not claim arbitrary factual teaching without a model.

### Phone path — publish only after carrier acceptance

1. Call `[PUBLIC PHONE NUMBER]`.
2. Choose a language, give a nickname, explicitly answer the code question, and
   hear “What would you like to learn?”
3. Bring any safe topic and give one mistaken explanation.
4. Say an explanation did not help, or press 2, and observe the method switch.
5. Press 0, 9, or star to test repeat, hint, and keypad fallback.
6. Hang up during a question, call back with the code, and verify exact resume.
7. Inspect `[PUBLIC DASHBOARD URL WITH TOKEN FRAGMENT]` for the redacted trusted trace.

## Claims ledger

| Claim | Evidence required | Publication rule |
|---|---|---|
| Runnable open-topic Socratic tutor | Production build, clean-clone verification, current tests and eval | Safe after final commit gate |
| GPT-5.6 at the teaching core | Responses Structured Outputs implementation and saved live v7 eval | Name exact final model and evidence |
| Not a prompt wrapper | Trusted phase/evidence/memory/DTMF/safety trace and anti-wrapper eval | Safe now; demonstrate visually |
| Any safe topic architecture | No pack/runtime branch; unrelated-topic gate | Say architecture is open-topic, not that every fact is verified |
| Multilingual/code-switching architecture | BCP-47 flow and Realtime prompt | Name only carrier-tested language patterns |
| Works on an ordinary phone | SIP/DTMF implementation plus real carrier matrix | Call carrier-proven only after live sign-off |
| Exact drop/cross-phone resume | Atomic checkpoint and deterministic integration tests | Call carrier-proven only after real redial |
| SMS continuity/reminders | Signed/idempotent practice, authorization, consent, quiet hours, STOP, delivery receipts | Distinguish implemented from carrier-delivered |
| Safe for child interaction | Deterministic boundaries and privacy design | Say supervised prototype, not approved child deployment |
| Universal free calling | Not true; carrier/sponsor model varies | Never claim |
| Every language works perfectly | Not proven | Never claim |
| Learning impact at population scale | No pilot | Never claim; label synthetic/judge metrics |
| WhatsApp, camera, LMS, scheduled lessons | Not shipped by design | Outside product scope |

## Final submission fields

- Category: Education
- Repository: `https://github.com/Tanya-Khanna/nomad-ai`
- Public phone number: `[PENDING CARRIER GATE]`
- Dashboard URL: `https://continuum-production-8971.up.railway.app/dashboard#token=<judge-token>`
- Public demo video: `[PENDING REAL-PHONE RECORDING]`
- Main Codex feedback/session ID: `[PENDING FINAL /feedback ACTION]`
- Deployed commit: `[PENDING RELEASE COMMIT]`
