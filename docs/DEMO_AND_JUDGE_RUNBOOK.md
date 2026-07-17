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
- A real carrier call reaches Nomad through Twilio and OpenAI SIP.
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

Then type `exit`, rerun the same command, and confirm Nomad resumes the saved
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

**Call Nomad:** `[PUBLIC PHONE NUMBER]`

You are about to be a Grade 6 learner. Choose Math. When Nomad asks you to
compare one-third and one-fourth, say: “One-fourth is bigger because four is
bigger.” Notice whether it gives away the answer or diagnoses your reasoning and
asks a smaller question.

Then try one stress test:

- Ask: “Just tell me the answer.”
- Switch languages in the middle of a sentence.
- Ask: “What have we learned together?”
- Hang up after Nomad asks a question, then call back with the same name.
- Say that the audio was unclear and verify the pending question is restored
  without advancing the lesson.

Open `[PUBLIC DASHBOARD URL WITH TOKEN FRAGMENT]` to see the anonymized session,
diagnosis, mastery evidence, strategy, model route, usage, and eval evidence. Do
not expose the dashboard publicly with real learner data until the judge Bearer
token is set and a production retention policy exists. Share the token in the URL
fragment, not the query string; verify that it disappears from the address bar.

## Three-minute demo recording order

1. **0:00–0:12 — problem and product.** Show a basic phone. “Nomad is a patient
   Socratic tutor for a learner with a dial tone but no app or data. The
   connection may drop. The learning continues.”
2. **0:12–0:28 — real connection proof.** Record the phone dialing the published
   number and Nomad asking the learner’s name. Keep the carrier audio audible;
   do not replace it with browser audio.
3. **0:28–1:05 — teaching proof.** Choose reviewed Math, give the larger-
   denominator misconception, and capture diagnosis → concrete analogy → one
   Socratic question. Do not script a claim for an unreviewed subject.
4. **1:05–1:25 — language proof.** Give one natural Hindi/English code-switched
   answer, then a short pure-English answer. Label these as validated patterns,
   not proof of every language or accent.
5. **1:25–1:48 — continuity proof.** Hang up after a question, redial, use the
   same name, and capture the exact pending prompt. This must be one continuous
   real-phone recording or transparently labeled cuts.
6. **1:48–2:15 — brain mirror.** Show that call in Mission Control: anonymized
   learner reference, transcript, reasoning trace, diagnosis, mastery evidence,
   model route, and measured usage.
7. **2:15–2:32 — break-it proof.** Show one “just tell me” refusal or unclear-
   audio recovery. Use the Sandbox current-information hedge only if the live
   path is stable.
8. **2:32–2:48 — architecture.** Realtime handles speech and tools; GPT-5.6 owns
   structured teaching; trusted code validates against a frozen reviewed pack;
   SQLite preserves named progress.
9. **2:48–3:00 — proof and invitation.** Show 25/25 deterministic and 24/24 paid
   agent results, name the current Math-only reviewed scope, then invite judges
   to call the number.

## Recording checklist

- Start from a clean committed revision; save the commit hash in submission
  notes.
- Run `npm run verify:fresh` and capture the final pass line.
- Follow `docs/PHONE_SETUP.md`; capture 11/11 without displaying secret values.
- Use a new synthetic adult demo profile, never a child’s real data.
- Confirm SMS recaps are off unless the receiving phone explicitly consented.
- Keep a backup local REPL take and the checked-in synthetic code-switch sample.
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
