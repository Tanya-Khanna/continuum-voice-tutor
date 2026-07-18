# Submission drafting material and claims ledger

This file is fact-checked drafting material, not text to submit unchanged. The
builder must rewrite the final description in her own voice and understand every
claim. Bracketed values remain blocked until the corresponding release gate
passes; do not delete a bracket by guessing.

## Title and one-line pitch

**Continuum — The connection may drop. The learning continues.**

An adaptive multilingual Socratic tutor that a learner can call from any phone,
with frozen curriculum, named memory, and exact lesson resume after a dropped
connection.

## Devpost description — truthful pre-release draft

Continuum is a patient teacher designed for a learner who may have a basic phone but
no app, laptop, or reliable data. The learner says the name they use, chooses a
reviewed subject or Curious Sandbox, and answers aloud. Continuum does not behave like
an answer machine: GPT-5.6 diagnoses the learner's reasoning, chooses a smaller
question, analogy, or retrieval check, and returns one short voice-native teaching
turn. If the connection drops, phone identity plus learner name restores the exact
pending question.

The access mismatch is concrete: ITU estimated 2.6 billion people were offline
in 2024, while GSMA separately counted a 3.1 billion-person usage gap—people
covered by mobile broadband but not using it. Those groups overlap and are not
added together. UNESCO projects a 44 million primary/secondary teacher deficit by
2030, so Continuum is designed to extend supervised learning support, not replace
teachers. Direct source links and caveats are in the README.

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
current evidence is 115/115 automated tests, 25/25 deterministic teaching cases,
and a historical complete 24/24 paid agent run. The repository's clean-clone gate
installs from the lockfile, runs every zero-credit check, seeds a synthetic paused
lesson, and proves exact resume without local secrets or prior state.

The real carrier-call release gate is still open. Until the Twilio/SIP path passes
the documented G.711, barge-in, disconnect, redial, and latency checks, use the
repository's complete offline judge path and do not describe browser or terminal
audio as a live phone call.

Continuum does not claim to invent voice AI or phone access. [Bakame](https://bakame.online/),
[Viamo AVA](https://viamo.io/ask-viamo-anything-ai/),
[1-800-ChatGPT](https://help.openai.com/en/articles/10193193-1-800-chatgpt-calling-and-messaging-chatgpt-with-your-phone),
[Rori](https://scale.stanford.edu/publications/effective-and-scalable-math-support-experimental-evidence-impact-ai-math-tutor-ghana),
and [Callee Me](https://callee.me/) each prove important parts of the landscape.
Continuum's narrower contribution is an inspectable combination of frozen reviewed
curriculum, source/reviewer provenance, subject-scoped placement and exact resume,
trusted turn validation, and reproducible release evidence. The README contains
the sourced comparison and does not infer undocumented limitations of those products.

## Final phone paragraph — adapt only after every phone gate passes

Call Continuum at **[PUBLIC PHONE NUMBER]**. Choose Math and say: “One-fourth is
bigger because four is bigger.” Continuum will teach rather than reveal the answer.
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
| Runnable Socratic tutor | Compiled-production smoke; clean-clone offline lesson; 115/115 tests; 25/25 deterministic gate | Safe now |
| GPT-5.6 at the teaching core | Structured Responses teacher plus 24/24 historical paid agent suite | Safe now; capture the saved scorecard before submission |
| Universal product architecture | Open language tags; pack/catalog routing; no language-pair or subject branch | Say “universal architecture,” not “every language proven” |
| Multilingual/code-switching behavior | Selected live Hindi/English, Spanish/English, French/English checks plus deterministic fixtures | Name tested patterns; do not claim every accent/noise condition |
| Five guided subjects | Runtime can route any reviewed catalog; only Math is reviewed and callable | Blocked until four packs pass human review and freeze |
| Works over a normal phone | SIP/Realtime server path is implemented; two-stage setup is documented | Blocked until signed delivery, 11/11 preflight, and real G.711 call checks pass |
| Drop and exact resume | Service, Realtime close, tests, and clean-clone paused fixture | Safe for software behavior; call it carrier-proven only after redial test |
| Live judge dashboard | Token-protected session API and local HTTP smoke | Blocked on deployed URL, token, retention decision, and release smoke |
| SMS recap | Opt-in, exactly-once code and tests | Say implemented; call it live only after Twilio delivery and consent test |
| WhatsApp, homework camera, parent SMS | Not shipped | Roadmap only |
| Cost per call | Exact-model API token estimate in Mission Control | Label as API estimate, not total carrier/unit economics |
| 2.6B offline / 3.1B usage gap | Separate ITU and GSMA 2024 estimates | Never add them; the populations overlap and neither proves affordable calling |
| 44M teacher deficit | UNESCO 2024 projection for primary and secondary teachers needed by 2030 | Say “projected deficit,” not current vacancies |
| Rori effect and ~$5 marginal cost | Preliminary year-one Ghana study of roughly 500 students | Attribute to Rori; Continuum cannot inherit the outcome |
| Adesua 93.75% helpfulness | Six-month feasibility deployment; only 16 ratings | Always state n=16 and preliminary scope |
| Socratic guardrails protect learning | Nearly 1,000-student math field experiment; unrestricted AI harmed unaided grades, hint safeguards mitigated | Use as design motivation, not a Continuum learning-outcome claim |
| Child-ready deployment | Safety behavior and privacy checklist exist | Never claim; supervised prototype until local review/consent/retention pass |
| “No competitor does this” | Current official pages show substantial overlap, especially Bakame and Callee Me | Never claim; describe the narrower inspectable combination |

## Final submission fields

- Category: Education
- Repository: `https://github.com/Tanya-Khanna/nomad-ai`
- Public phone number: `[PENDING SIGNED DELIVERY + 11/11 + CARRIER GATE]`
- Dashboard URL: `[PENDING PROTECTED DEPLOYMENT]`
- Public demo video: `[PENDING REAL-PHONE RECORDING]`
- Main Codex feedback/session ID: `[PENDING FINAL /feedback ACTION]`
- Deployed commit: `[PENDING RELEASE COMMIT]`
- Reviewed guided subjects: `Math` until four additional packs pass review
