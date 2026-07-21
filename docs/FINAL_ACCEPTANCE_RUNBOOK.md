# Final acceptance runbook

This is the condensed final sign-off. Run the complete feature-by-feature
procedure in [`TESTING_GUIDE.md`](TESTING_GUIDE.md) first; do not use this shorter
receipt flow as a substitute for the full test plan.

Run this once, in order, after feature freeze. Use synthetic adults and phone
numbers whose owners consented to receive calls and SMS. Do not use real child data.

## 1. Freeze the open-topic product and code

1. Run `npm run check`, `npm run eval`, and `npm run build`. The learner runtime
   must need no curriculum variable and expose no subject menu.
2. Commit every intended file, then run `npm run eval:live -- --confirm-spend`.
   The revision-bound live report must pass 9/9 on that exact commit.
3. Push the commit and wait for the GitHub release gate to pass.
4. Deploy that exact commit to Railway.
5. Run:

   ```bash
   npm run release:preflight -- \
     --base-url https://continuum-production-8971.up.railway.app
   ```

   Production must report `openai`, Realtime configured, `open_topic_teacher`,
   no curriculum requirement, callback/SMS/reminder/recap enabled, the recurring
   call scheduler disabled, and the same 12-character commit prefix.

## 2. Prepare a private acceptance receipt

Copy the template into the ignored data directory:

```bash
cp submission/release-input.example.json .data/release-input.json
```

Update a field to `true` only after personally observing that behavior. The file
contains no phone number, secret, transcript, or learner data and is never committed.

## 3. Carrier matrix

Reset to a new synthetic adult learner where noted. Save screenshots of Twilio,
Railway, the received SMS, and Mission Control without exposing credentials.

1. **Missed-call callback:** ring once and hang up. Confirm Twilio rejects the
   inbound call without answering, creates one job, and calls back once. A duplicate
   ring inside one minute must not create another callback.
2. **Language-first cold start:** choose a language, provide a name, explicitly
   answer the learner-code question, receive a code as a new learner, and hear
   “What would you like to learn?” No subject, grade, mode, or duration menu may appear.
3. **Real open-topic teaching:** bring a topic, then give a response that reveals
   a misconception. Confirm Continuum records its evidence basis, asks one question,
   and teaches a useful step instead of dumping an answer.
4. **Method feedback:** after an explanation, say no or press 2. Confirm the next
   method differs and the feedback appears in Mission Control.
5. **Teach-back and transfer:** explain the idea, then answer a different
   transfer question. Keypad-only success must remain `developing`, never `secure`.
6. **DTMF recovery:** press star for keypad fallback, 9 for a hint, 0 to repeat,
   and answer one currently spoken option. Invalid digits must not advance state.
7. **Drop recovery:** hang up while Question 2 is pending. Confirm one short pause
   SMS names Q2 without sensitive content.
8. **Same-phone resume:** call again, identify the learner, and hear the exact
   unfinished question—not onboarding or completed teaching.
9. **Cross-phone resume:** call from a second consented phone, enter the six-digit
   code plus pound, confirm the name, and resume the same question.
10. **Shared phone:** create a sibling profile on the first number. Confirm no name,
    progress, homework, schedule, or memory crosses profiles.
11. **Micro-practice:** consent to practice, receive one short SMS, reply with the expected
    code/answer, and confirm idempotent evidence on a duplicated webhook.
12. **Exam reminder:** pre-enroll the exact SMS phone, ask for a one-time review
    reminder with an explicit date/time, confirm it in a separate speech or keypad
    turn, and observe exactly one SMS outside quiet hours.
13. **STOP before send:** schedule a disposable reminder, send `STOP <guardian code>`
    before it is due, and confirm no message is sent.
14. **SMS controls:** exercise `PROGRESS`, `MEMORY`, `STOP`, and two-step `DELETE`.
    Unsupported SMS tutoring and retired scheduling commands must remain bounded.
15. **Language patterns:** complete named adult-speaker checks for English,
    Hindi-English, Spanish-English, and French-English. Record only the patterns
    actually heard; do not claim every language or accent was carrier-tested.
16. **Carrier receipts:** after Twilio pricing settles, confirm completed/no-answer
    state, call duration, SMS segments/delivery, carrier cost, OpenAI estimate, and
    cost per completed lesson in Mission Control.

Repeat the flagship judge journey five consecutive times without a state-machine,
identity, audio, or SMS failure. Set `consecutiveGoldenJudgeJourneys` to 5 only then.

## 4. Record and submit

1. Record the three-minute sequence in `docs/DEMO_AND_JUDGE_RUNBOOK.md` from the
   same deployed commit. Label sponsor-funded callback, synthetic data, and time
   jumps on screen.
2. Upload the video publicly to YouTube and add its URL to the private receipt.
3. Rewrite `docs/SUBMISSION_COPY.md` in your own voice; do not paste it unchanged.
4. Confirm all Devpost teammates accepted.
5. Make the repo public or share the private repo with `testing@devpost.com` and
   `build-week-event@openai.com`.
6. Retrieve the primary Codex `/feedback` Session ID and add it to the receipt.
7. Prepare the dashboard judge URL with its token in the fragment, never a query
   string. Do not commit the token.
8. Mark the public phone ready only after the entire carrier matrix passes.
9. Only then set `NOMAD_PUBLIC_PHONE_ENABLED=true` on Railway and verify the
   landing page exposes the intended missed-call CTA. Leave it false throughout
   development and any failed acceptance run.

## 5. Final machine gate

After the final commit:

```bash
npm run release:verify
npm run release:preflight -- \
  --automated-passed \
  --base-url https://continuum-production-8971.up.railway.app \
  --submission .data/release-input.json
```

The second command must report every row `PASS`. The first command deliberately
archives committed `HEAD`, installs from the lockfile, builds production, runs all
tests and the 39-case evaluation, seeds a paused lesson, and proves exact resume
without local secrets.
