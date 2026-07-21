# Demo and judge runbook

This is the executable v7 handoff for recording and judge testing. It describes
the product that exists now: one teacher the learner calls, one open learning
question, speech/keypad/SMS continuity, and no curriculum menu.

Use synthetic adults and consented phone numbers. Do not use real child data.

## Release gates

Before publishing the number or recording the final take:

- `npm run release:verify` passes from committed `HEAD`.
- `npm run eval` passes the current 39-case anti-wrapper gate.
- `npm run eval:live -- --confirm-spend` passes the revision-bound nine-case GPT
  v7 suite on the commit being deployed.
- `npm run phone:preflight` reports 11/11.
- The deployed `/health` reports `open_topic_teacher`, no curriculum requirement,
  one-time SMS reminders enabled, and the recurring call scheduler disabled.
- A real carrier journey proves language-first onboarding, open topic, teaching,
  DTMF, drop/recovery, SMS, and one-time reminder delivery.
- Five consecutive golden judge journeys pass on the same deployed commit.

Automated checks prove software behavior, not speech quality or carrier delivery.
Public language claims must name only adult-speaker patterns actually heard.

## Zero-credit judge path

```bash
git clone https://github.com/Tanya-Khanna/nomad-ai.git
cd nomad-ai
npm ci
npm run chat -- --name Judge --phone +910000000099 --language en
```

Try three unrelated topics, one at a time:

- `Help me understand a verb.`
- `Why does the moon seem to follow a moving car?`
- `Help me prepare for a chemistry exam.`

Type `exit`, run the same command again, and verify exact resume. The offline
adapter exercises state, evidence, memory, and recovery without pretending to
know arbitrary facts. Run `npm run verify:fresh` for the clean distributable gate.

## Final phone judge card

1. Call `[PUBLIC PHONE NUMBER]` from an ordinary phone.
2. Choose a language, give a nickname, and explicitly answer the learner-code
   question. A new learner receives a private six-digit code.
3. Verify the next question is “What would you like to learn?”—not a menu.
4. Ask to learn any safe topic. Then give an explanation that reveals a mistaken
   idea. Notice whether Continuum diagnoses from evidence and teaches one step.
5. Say the explanation did not help or press 2. The next method must differ.
6. Press 0 to repeat, 9 for a hint, or star for keypad fallback.
7. Hang up during a pending question. Call from another consented phone, enter the
   learner code plus pound, confirm the name, and hear the exact question.
8. If the phone was pre-enrolled for SMS, request one exam/revision reminder with
   an explicit date/time and confirm it in a separate yes/no or keypad turn.

Open `[PUBLIC DASHBOARD URL WITH TOKEN FRAGMENT]` to inspect the anonymized
diagnosis basis, supported misconception, trusted phase, policy checks, method
switch, evidence, understanding state, model route, latency, and cost. The token
belongs in the URL fragment, never the query string.

## Three-minute recording order

1. **0:00–0:15 — access.** Show a basic keypad phone. “No smartphone, app,
   internet, camera, or reading required. If you can make a phone call, school is open.”
2. **0:15–0:30 — callback.** Give a missed call; show the unanswered inbound ring
   and sponsor-funded callback. Do not call carrier access universally free.
3. **0:30–0:47 — no menu.** Choose language, give a name, receive the portable
   code, then hear “What would you like to learn?”
4. **0:47–1:17 — teaching.** Bring one topic and reveal one misconception. Show
   diagnosis basis and the first teaching method.
5. **1:17–1:35 — adaptation.** Mark the explanation not helpful. Show a genuinely
   different method, then a short teach-back or transfer check.
6. **1:35–1:51 — keypad floor.** Make speech unclear, press star, and answer one
   spoken choice. Label keypad-only evidence as developing, never secure.
7. **1:51–2:12 — connection drops.** Hang up with a question pending, show the one-
   segment pause SMS, call from another phone, and resume the exact question.
8. **2:12–2:30 — relationship thread.** Show one micro-practice reply and one
   explicit exam-reminder proposal followed by separate consent. Use a labeled
   time jump to show delivery; recurring tutoring calls are not part of the product.
9. **2:30–2:50 — not a wrapper.** Show Structured Outputs beside the trusted trace:
   verified words, phase/activity gate, diagnosis evidence, failed-method switch,
   mastery cap, exact checkpoint, safety boundary, and selective memory.
10. **2:50–2:57 — implementation.** Name GPT-5.6 Responses, Realtime SIP/DTMF,
    SQLite, Twilio, the 39-case eval, and how Codex built and tested the system.
11. **2:57–3:00 — close.** “The connection may drop. The learning continues.”

## Recording checklist

- Record the committed hash and deploy that exact revision.
- Use a new synthetic adult learner and a consented SMS phone.
- Pre-enroll SMS with `npm run guardian:enroll` without showing the private code.
- Record five consecutive golden journeys before the final take.
- Label sponsor funding, time jumps, and any synthetic proof.
- Do not show secrets, full phone numbers, learner codes, or dashboard tokens.
- Do not claim every language, universal free calling, child deployment approval,
  or population-level learning outcomes.
- Keep the deployment unchanged during judging except for documented outage fixes.

## Submission placeholders

- Public phone number: `[PENDING PHONE GATE]`
- Dashboard URL: `https://continuum-production-8971.up.railway.app/dashboard#token=<judge-token>`
- Demo video URL: `[PENDING RECORDING]`
- Repository: `https://github.com/Tanya-Khanna/nomad-ai`
- Main Codex feedback/session ID: `[PENDING FINAL FEEDBACK ACTION]`
- Deployed commit: `[PENDING RELEASE COMMIT]`
