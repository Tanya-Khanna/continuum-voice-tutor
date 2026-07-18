# Demo and judge runbook

This is the executable handoff for recording and judge testing. It distinguishes
what works now from claims that require the real phone line or four additional
reviewed curriculum packs.

For the exact OpenAI project, webhook, Twilio number, and SIP-trunk sequence, use
the [real-phone setup guide](PHONE_SETUP.md).

## Release gates

`npm run phone:preflight` has two deliberate stages. A 10/11 result permits
exactly one controlled inbound smoke call only when signed public webhook
delivery is the sole open check. After that delivery is verified, set the public
webhook attestation and require 11/11 before wider testing.

Do not publish a phone number or record a “live call” sequence until all of these
are true:

- `npm run phone:preflight` reports 11/11, including signed delivery and Mission
  Control access protection.
- A real carrier call reaches Continuum through Twilio and OpenAI SIP.
- Barge-in, unclear-audio recovery, disconnect, and redial have been heard over
  G.711—not merely unit-tested.
- At least one complete guided call produces a dashboard session and accurate
  token usage.

Do not say “five subjects are available” until Science, English, History, and
Geography have each completed human source review, compilation, independent
verification, builder spot-check, frozen-pack loading, and voice-menu routing.
Until then, say: “Math is the reviewed flagship; four official-source briefs are
prepared and human-gated.”

## Working judge path today

Prerequisite: Node.js 22 or newer.

```bash
git clone https://github.com/Tanya-Khanna/nomad-ai.git
cd nomad-ai
npm ci
npm run chat -- --name Judge --phone +910000000099 --language en
```

Use this misconception exactly:

> One fourth is bigger because four is bigger than three.

Then type `exit`, rerun the same command, and confirm Continuum resumes the saved
question. This path is deterministic, offline, and uses no API credit. To verify
the entire distributable archive first, run `npm run verify:fresh`.

Optional local surfaces:

```bash
npm start
```

- Mission Control, local: `http://localhost:3000/dashboard`
- Mission Control, deployed: `https://<host>/dashboard#token=<judge-token>`
- Deterministic gate: `npm run eval` (expected: 25/25)
- Paid agent proof: the latest complete runtime report is 24/24; do not rerun it
  casually or replace it with a targeted report.

## Final judge card — fill only after release gates pass

**Call Continuum:** `[PUBLIC PHONE NUMBER]`

You are about to be a Grade 6 learner. Choose Math. When Continuum asks you to
compare one-third and one-fourth, say: “One-fourth is bigger because four is
bigger.” Notice whether it gives away the answer or diagnoses your reasoning and
asks a smaller question.

Then try one stress test:

- Ask: “Just tell me the answer.”
- Switch languages in the middle of a sentence.
- Ask: “What have we learned together?”
- Hang up after Continuum asks a question, then call back with the same name.
- Say that the audio was unclear and verify the pending question is restored
  without advancing the lesson.

Open `[PUBLIC DASHBOARD URL WITH TOKEN FRAGMENT]` to see the anonymized session,
diagnosis, mastery evidence, strategy, model route, usage, and eval evidence. Do
not expose the dashboard publicly with real learner data until the judge Bearer
token is set and a production retention policy exists. Share the token in the URL
fragment, not the query string; verify that it disappears from the address bar.

## Three-minute demo recording order

1. **0:00–0:12 — the access problem.** Show an ordinary keypad phone. “No
   smartphone. No app. No data. Continuum is a tutor a learner can reach through
   calls, keypad, and SMS.”
2. **0:12–0:25 — missed-call access.** Meena gives a missed call; the inbound call
   is visibly rejected, and Continuum calls her back. Do not call this universally
   free: label the demo callback as sponsor-funded.
3. **0:25–0:42 — cold start.** Capture Hinglish onboarding, six-digit portable
   learner code, reviewed Math selection, and a five-minute lesson choice.
4. **0:42–1:12 — actual teaching.** Meena gives the larger-denominator
   misconception. The first method fails; Continuum asks whether it helped, accepts
   “no” or keypad 2, and changes to a concrete local analogy. The visible proof is
   diagnosis and method change—not model eloquence.
5. **1:12–1:28 — evidence of learning.** Capture teach-back and a different
   reviewed transfer item. Show baseline incorrect, hints, transfer result, and the
   honest mastery state. Never turn a keypad choice alone into secure mastery.
6. **1:28–1:47 — connectivity failure.** Drop the call while a question is
   pending. Show the short pause SMS. No completed step may be replayed.
7. **1:47–2:02 — portable continuity.** Call from another phone, enter the learner
   code plus pound, confirm the name, and resume the exact unfinished question.
8. **2:02–2:14 — speech fallback.** Make one answer intentionally unclear, press
   star for reviewed options, and answer by keypad. Show that state advances only
   after a valid choice.
9. **2:14–2:27 — homework loop.** Show the tiny homework SMS and a signed,
   idempotent reply updating the same learner. If this carrier path is not green,
   replace it with the labeled deterministic proof and say so.
10. **2:27–2:39 — proactive retention.** Use an explicit “next day” title card;
    show one consented scheduled callback beginning with due retrieval or homework.
11. **2:39–2:48 — breadth without bluffing.** Show the multi-turn Curiosity Trail
    and the five-subject target. State that only packs passing the human release
    gate appear in the callable menu.
12. **2:48–2:57 — implementation.** Show Realtime SIP/DTMF, GPT-5.6 Structured
    Outputs, frozen packs, selective SQLite memory, access/reliability/learning
    metrics, and the Codex-built test/eval story.
13. **2:57–3:00 — close.** “The connection may drop. The learning continues.”

## Recording checklist

- Start from a clean committed revision; save the commit hash in submission
  notes.
- Run `npm run verify:fresh` and capture the final pass line.
- Follow `docs/PHONE_SETUP.md`; capture 11/11 without displaying secret values.
- Use a new synthetic adult demo profile, never a child’s real data.
- Confirm SMS recaps are off unless the receiving phone explicitly consented.
- Keep a backup local REPL take and the checked-in synthetic code-switch sample.
- Record five consecutive golden judge journeys before recording the final take.
- Label every time jump, synthetic fixture, and sponsor-funded call visibly.
- After recording, verify every on-screen number, URL, score, and scope statement.
- Keep the deployed phone and dashboard revision unchanged except for outage
  fixes during judging.

## Submission placeholders

- Public phone number: `[PENDING PHONE GATE]`
- Dashboard URL: `[PENDING AUTHENTICATED DEPLOYMENT]`
- Demo video URL: `[PENDING RECORDING]`
- Repository: `https://github.com/Tanya-Khanna/nomad-ai`
- Main Codex feedback/session ID: `[PENDING FINAL FEEDBACK ACTION]`
- Deployed commit: `[PENDING RELEASE COMMIT]`
- Five-subject status: `Math reviewed; four briefs pending human review`
