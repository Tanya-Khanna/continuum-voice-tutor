# Final acceptance runbook

Run this once, in order, after feature freeze. Use synthetic adults and phone
numbers whose owners consented to receive calls and SMS. Do not use real child data.

## 1. Freeze curriculum and code

1. Complete `docs/CURRICULUM_RELEASE.md`, or keep the public menu honestly limited
   to Math.
2. Run `npm run curriculum:release:check`; record whether the truthful public claim
   is one reviewed subject or five.
3. Commit and push every intended file.
4. Wait for the GitHub release gate to pass.
5. Deploy that exact commit to Railway.
6. Run:

   ```bash
   npm run release:preflight -- \
     --base-url https://continuum-production-8971.up.railway.app
   ```

   Production must report `openai`, Realtime configured, the intended subject
   count, all four access switches, and the same 12-character commit prefix.

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
   ring inside ten minutes must not create another callback.
2. **Cold start and duration:** provide a name, receive a six-digit learner code,
   select Math, and select three, five, then ten minutes across separate profiles.
3. **Real teaching:** give the larger-denominator misconception. Confirm Continuum
   diagnoses it, asks one question, and does not reveal the final answer.
4. **Method feedback:** after an explanation, say no or press 2. Confirm the next
   method differs and the feedback appears in Mission Control.
5. **Teach-back and transfer:** explain the idea, then answer a different reviewed
   transfer question. Keypad-only success must remain `developing`, never `secure`.
6. **DTMF recovery:** press star for keypad fallback, 9 for a hint, 0 to repeat,
   and answer one reviewed option. Invalid digits must not advance state.
7. **Drop recovery:** hang up while Question 2 is pending. Confirm one short pause
   SMS names Q2 without sensitive content.
8. **Same-phone resume:** call again, identify the learner, and hear the exact
   unfinished question—not onboarding or completed teaching.
9. **Cross-phone resume:** call from a second consented phone, enter the six-digit
   code plus pound, confirm the name, and resume the same question.
10. **Shared phone:** create a sibling profile on the first number. Confirm no name,
    progress, homework, schedule, or memory crosses profiles.
11. **Homework:** consent to homework, receive one short SMS, reply with the expected
    code/answer, and confirm idempotent evidence on a duplicated webhook.
12. **Scheduled lesson:** create a guardian-approved slot. Confirm exactly one call,
    due homework or retrieval first, and no call outside quiet hours.
13. **Missed scheduled lesson:** do not answer. Confirm one SMS and no immediate
    application redial.
14. **Guardian voice controls:** press 8, enter the guardian code, hear progress,
    change time using four digits plus pound, pause calls, and exercise the two-step
    deletion confirmation with a disposable profile.
15. **SMS controls:** exercise `PROGRESS`, `MEMORY`, `TIME`, `DAYS`, `PAUSE`,
    `RESUME`, `STOP`, and the two-step `DELETE` flow against a disposable profile.
16. **Language patterns:** complete named adult-speaker checks for English,
    Hindi-English, Spanish-English, and French-English. Record only the patterns
    actually heard; do not claim every language or accent was carrier-tested.
17. **Carrier receipts:** after Twilio pricing settles, confirm completed/no-answer
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
tests and the 25-case evaluation, seeds a paused lesson, and proves exact resume
without local secrets.
