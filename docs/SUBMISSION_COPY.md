# Submission copy and claims ledger

This file is the ready-to-paste submission draft. Bracketed values remain blocked
until the corresponding release gate passes. Do not delete a bracket by guessing.

## Title and one-line pitch

**Nomad AI — The connection may drop. The learning continues.**

An adaptive multilingual Socratic tutor that a learner can call from any phone,
with frozen curriculum, named memory, and exact lesson resume after a dropped
connection.

## Devpost description — truthful pre-release draft

Nomad is a patient teacher designed for a learner who may have a basic phone but
no app, laptop, or reliable data. The learner says the name they use, chooses a
reviewed subject or Curious Sandbox, and answers aloud. Nomad does not behave like
an answer machine: GPT-5.6 diagnoses the learner's reasoning, chooses a smaller
question, analogy, or retrieval check, and returns one short voice-native teaching
turn. If the connection drops, phone identity plus learner name restores the exact
pending question.

The system separates voice from teaching. OpenAI Realtime handles listening,
speech, interruption, and tool orchestration. A server-side GPT-5.6 teaching engine
owns diagnosis and pedagogy. Trusted code validates every structured turn against
a frozen curriculum pack before it can be spoken or saved. SQLite keeps placement,
mastery evidence, physical learning anchors, and history isolated by learner and
subject. Mission Control shows an anonymized teaching trace, reasoning evidence,
model routes, latency, token usage, and exact-model cost estimates.

The engine contains no Hindi, India, Math, or fixed language-pair branch. A
deployment supplies reviewed curriculum packs and metadata; the validated catalog
builds the subject menu and routes placement, history, and resume state by pack.
India Grade 6 Math is the reviewed flagship today. Four official-source briefs are
prepared for Science, English, History, and Geography, but they will not become
callable until human review, compilation, independent verification, and spot-check
all pass.

Codex built the telephony bridge, state machine, curriculum compiler, evaluation
harness, dashboard, tests, privacy gates, and documentation in one continuous task
with inspectable milestone commits. GPT-5.6 powers live teaching, curriculum
compilation/verification, and a separate simulated-learner/evaluator suite. The
current evidence is 105/105 automated tests, 25/25 deterministic teaching cases,
and a historical complete 24/24 paid agent run. The repository's clean-clone gate
installs from the lockfile, runs every zero-credit check, seeds a synthetic paused
lesson, and proves exact resume without local secrets or prior state.

The real carrier-call release gate is still open. Until the Twilio/SIP path passes
the documented G.711, barge-in, disconnect, redial, and latency checks, use the
repository's complete offline judge path and do not describe browser or terminal
audio as a live phone call.

## Final phone paragraph — paste only after every phone gate passes

Call Nomad at **[PUBLIC PHONE NUMBER]**. Choose Math and say: “One-fourth is
bigger because four is bigger.” Nomad will teach rather than reveal the answer.
Then hang up after its next question and call back with the same name to test exact
resume. Open **[PUBLIC DASHBOARD URL WITH TOKEN FRAGMENT]** to inspect the
anonymized teaching trace from your own call.

## Judge testing instructions

### Zero-credit path available now

```bash
git clone https://github.com/Tanya-Khanna/nomad-ai.git
cd nomad-ai
npm ci
npm run verify:fresh
npm run seed:demo
```

Run the resume command printed by `seed:demo`. Then try:

- “Just tell me the answer.”
- “One fourth is bigger because four is bigger than three.”
- One answer that switches between any two languages you speak.
- `exit`, followed by the same chat command, to restore the pending question.

Start Mission Control with `npm start`, then open
`http://localhost:3000/dashboard`. The Sample tab is clearly labeled synthetic;
the Eval tab is zero-credit. The local dashboard needs no token.

### Real-phone path — activate only after release

1. Call **[PUBLIC PHONE NUMBER]**.
2. Use a nickname, choose reviewed Math, and give the larger-denominator
   misconception above.
3. Try one interruption, one code-switched answer, or “What have we learned?”
4. Hang up after a question, redial, and use the same name.
5. Open **[PUBLIC DASHBOARD URL WITH TOKEN FRAGMENT]**. The fragment should
   disappear from the address bar; the session API remains locked without it.

## Claims ledger

| Claim | Current evidence | Publication rule |
|---|---|---|
| Runnable Socratic tutor | Clean-clone offline lesson; 105/105 tests; 25/25 deterministic gate | Safe now |
| GPT-5.6 at the teaching core | Structured Responses teacher plus 24/24 historical paid agent suite | Safe now; capture the saved scorecard before submission |
| Universal product architecture | Open language tags; pack/catalog routing; no language-pair or subject branch | Say “universal architecture,” not “every language proven” |
| Multilingual/code-switching behavior | Selected live Hindi/English, Spanish/English, French/English checks plus deterministic fixtures | Name tested patterns; do not claim every accent/noise condition |
| Five guided subjects | Runtime can route any reviewed catalog; only Math is reviewed and callable | Blocked until four packs pass human review and freeze |
| Works over a normal phone | SIP/Realtime server path is implemented | Blocked until 11/11 preflight and real G.711 call checks pass |
| Drop and exact resume | Service, Realtime close, tests, and clean-clone paused fixture | Safe for software behavior; call it carrier-proven only after redial test |
| Live judge dashboard | Token-protected session API and local HTTP smoke | Blocked on deployed URL, token, retention decision, and release smoke |
| SMS recap | Opt-in, exactly-once code and tests | Say implemented; call it live only after Twilio delivery and consent test |
| WhatsApp, homework camera, parent SMS | Not shipped | Roadmap only |
| Cost per call | Exact-model API token estimate in Mission Control | Label as API estimate, not total carrier/unit economics |
| Child-ready deployment | Safety behavior and privacy checklist exist | Never claim; supervised prototype until local review/consent/retention pass |

## Final submission fields

- Category: Education
- Repository: `https://github.com/Tanya-Khanna/nomad-ai`
- Public phone number: `[PENDING 11/11 PHONE GATE]`
- Dashboard URL: `[PENDING PROTECTED DEPLOYMENT]`
- Public demo video: `[PENDING REAL-PHONE RECORDING]`
- Main Codex feedback/session ID: `[PENDING FINAL /feedback ACTION]`
- Deployed commit: `[PENDING RELEASE COMMIT]`
- Reviewed guided subjects: `Math` until four additional packs pass review
