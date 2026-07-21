# CONTINUUM — THE CALL IS THE CLASSROOM (v6 · CURRENT AUTHORITY)

> Continuum is not designed to replace school or teachers. It extends high-quality tutoring to the hours, places, languages, and devices conventional digital education cannot reach.

**Primary tagline:** The connection may drop. The learning continues.
**Supporting line:** Any phone. Any language. A tutor who comes back tomorrow.

## Current product contract

Continuum is a persistent, multilingual tutor delivered through ordinary phone calls, keypad input, and short SMS. The learner needs no smartphone, app, camera, internet, email address, or personal device. The conversation is the classroom: lessons, Socratic questions, explanations, stories, worked examples, hint ladders, quizzes, flashcards, teach-back, transfer, reflection, homework, study plans, and retrieval calls are rendered for voice first.

The deployment ladder is missed-call callback, toll-free access, sponsored minutes, or direct dial. Calls are not claimed to be universally free. The hackathon deployment uses one Twilio number in callback-only mode: an inbound ring is rejected without answering, then the same number calls the learner back and remains the SMS sender. Direct answered inbound tutoring is deferred rather than requiring a second paid number. Child deployments require prior guardian enrollment; adult judges may use an explicitly enabled self-request demo. Every proactive learner call requires consent, respects quiet hours, and can be stopped immediately.

The trusted tutoring loop is:

`RECALL → DIAGNOSE → CHOOSE METHOD → TEACH → PRACTICE → TEACH-BACK → TRANSFER → REFLECT → SAVE → SCHEDULE REVIEW`

GPT-5.6 proposes structured pedagogical decisions. Application code validates them, enforces curriculum and safety policy, renders one speakable question at a time, persists the exact pending activity before speech, and controls state transitions. A correct guess is never secure mastery. Keypad-only success is capped at developing. Curious Sandbox and Curiosity Trails never change guided mastery.

Continuum remembers what helps a learner learn and forgets what it does not need. It may retain curriculum progress, misconceptions, homework, helpful methods, language preferences, schedules, and explicitly approved goals or interests. It does not retain raw audio by default or infer sensitive psychological, family, caste, religious, or economic profiles.

## Locked submission scope

- Ordinary phone calls, Realtime SIP, DTMF, and short SMS are the complete learner classroom.
- Missed-call callback is submission-core. The single hackathon number is callback-only for inbound access and also originates callbacks, scheduled calls, and SMS; direct answered inbound tutoring is not a submission requirement.
- Portable identity is a six-digit learner code with separate guardian authorization.
- Math fractions is the deepest proof-of-learning journey.
- Five Grade 6 starter units remain the release target, but only human-approved, compiled, verified, spot-checked, frozen packs may appear in the public menu.
- Learner feedback, reflection, drop recovery, cross-phone resume, homework, recurring calls, guardian voice controls, memory controls, and access/reliability/learning metrics are core.
- Ask Anything is multi-turn and may create a learner-approved Curiosity Trail, never formal mastery.
- Human escalation is a tested decision contract, not a claimed live support network.
- Educator summaries are a permissioned deployment contract, not a dashboard.
- Synthetic evidence must always be labeled synthetic.

Do not add WhatsApp, camera homework, a learner-facing web classroom, emotional-companion behavior, large educator dashboards, unreviewed language claims, or decorative animation before the core is stable.

## Implementation ledger — July 18

### Implemented and automated

- Structured `LearningActivity`, `PedagogyDecision`, `LearningEvidence`, learner feedback, reflection, safe mastery, Curiosity Trail, educational profile, human-support, educator-summary, study-plan, SMS-command, callback-job, and product-metric contracts.
- Explicit strategy switching after failed or learner-reported unhelpful teaching; speech and DTMF teaching feedback; reviewed transfer choices; DTMF-only mastery cap.
- Portable salted learner identity, three-attempt and cross-source throttling, shared-phone privacy, and signed cross-phone resume.
- Atomic pending-question persistence, pause-on-drop, pause SMS callback, same-phone and cross-phone resume, and no state advance on unclear audio.
- Signed missed-call webhook with first-verb `<Reject reason="busy">`, deduplication, allowlists, quiet hours, rate limits, encrypted callback destination, outbound Twilio callback, and signed Realtime identity relay.
- Signed, idempotent SMS controls for start, stop, pause, resume, time, days, progress, memory, and two-step deletion.
- One-segment reviewed homework assignments with recipient-bound codes, signed/idempotent SMS replies, learner evidence, and an explicit no-secure-mastery cap for multiple-choice work.
- Consent-gated recurring study plans and due-job locking; one dial per scheduled slot with no immediate application retry.
- Low-literacy guardian keypad controls for progress, time, pause/resume, and two-step deletion.
- Access/reliability/learning metric ledger and protected metrics API.
- Mobile-first public landing page with no learner web classroom.
- Three-, five-, and ten-minute lesson state, with duration-specific activity targets.
- Signed scheduled-duration and access-mode relay into Realtime plus idempotent Twilio call lifecycle callbacks, no-answer handling, duration/price reconciliation, SMS segment/delivery receipts, sponsor-versus-learner-paid completion evidence, and aggregate cost-per-completed-lesson and retained-concept evidence.
- Evidence-backed product proof now includes shared-phone completion, keypad-fallback conversion, exact drop/resume recovery, unclear-audio recovery, application response-latency percentiles, diagnostic-to-transfer improvement, hint reduction, teach-back success, strategy-switch success, and learner-reported helpfulness.
- Offline demo, deterministic evaluator, strict TypeScript, and automated unit/integration tests remain zero-credit runnable.

### Still gated before a public claim

- A second measured carrier call must prove the corrected onboarding and teaching state machine.
- Live missed-call callback, DTMF code, reviewed quiz, feedback, drop SMS, same/cross-phone resume, homework reply, schedule, no-answer, and guardian menu require carrier smoke tests.
- Science, English, History, and Geography source briefs are human-approved and their digest-bound candidates pass the independent verifier. Builder spot-check and freeze are still required. Until then the public guided menu must expose Math only.
- Carrier status callbacks and priced usage receipt collection are implemented; real completed/no-answer receipts must be captured before claiming measured call-completion or cost-per-lesson values.
- English, Hindi-English, Spanish-English, and French-English must be described only as named tested adult-speaker patterns after the actual carrier matrix passes.
- Demo recording, YouTube upload, Devpost team acceptance, human-written submission copy, `/feedback` Session ID, clean-clone proof, and final repository sharing remain human submission gates.

## Execution order

1. Finish the flagship Math journey, voice/DTMF feedback, duration choices, homework SMS, and deterministic judge journey.
2. Prove portable identity, exact drop recovery, missed-call callback, schedules, guardians, and deletion on the carrier.
3. Human-review and freeze the four pending curriculum packs; hide every pack that misses the gate.
4. Run five consecutive golden judge journeys, freeze features, record the three-minute demo, and complete clean-clone verification.
5. Human-rewrite Devpost copy, retrieve `/feedback`, publish/share the repository, and submit by noon PT on July 21.

---

# ARCHIVED V5 PLAN — HISTORICAL CONTEXT ONLY, DO NOT IMPLEMENT

The material below records prior research and status receipts. Any reference to WhatsApp, camera input, or the older scope is superseded by v6 above.

# CONTINUUM — FINAL BUILD PLAN (v5 · ARCHIVED)

> **📋 STATUS AUDIT — Friday July 17, late night (verified against repo `Tanya-Khanna/nomad-ai` @ `3e11e8b`,
> 55 commits, by independent clone + test run: 115/115 tests, 25/25 deterministic eval, REPL + resume verified live).**
> This evidence snapshot remains tied to `3e11e8b`; later plan-only commits do not expand what was technically
> verified. Re-run the clean-clone gate after the next implementation change.
> Legend: ~~struck~~ ✅ = completely done and verified · ⏳ = partially done (note says what remains) · unmarked = not started.
> **The remaining critical path: ① measured real-carrier behavior checks (configuration preflight 11/11 → PHONE_SETUP.md) ② human review of 4 subject
> briefs → compile → freeze ③ landing-page minimum ④ Hinglish sample recording ⑤ demo video ⑥ human rewrite of
> submission copy ⑦ submit.**

> **🚀 DEPLOYMENT UPDATE — Saturday July 18:** commit `31a8988` is live at
> [continuum-production-8971.up.railway.app](https://continuum-production-8971.up.railway.app). Railway built the
> checked-in Dockerfile, attached a persistent `/data` volume, and passed public health, Mission Control,
> unauthorized-access, authenticated-session, readiness, and writable-SQLite checks. The startup process prepares
> the root-mounted volume and then drops to the unprivileged Node user. This closes the hosting prerequisite only:
> phone configuration is now 11/11: the OpenAI project/webhook, upgraded Twilio account, voice-capable number,
> number association, TLS SIP origination route, and verified signed `realtime.call.incoming` delivery have all
> passed. Real codec, latency, VAD, barge-in, noisy-line, hang-up/redial, dashboard-session, and live-SMS behavior
> remain unverified until the corresponding measured carrier checks run.

> **📞 FIRST CARRIER-BEHAVIOR RESULT — Saturday July 18:** configuration reached 11/11, but the first
> learner-facing call **failed** the product gate. After Tanya selected fractions and answered the first placement
> question, Continuum replayed the guided-versus-Sandbox menu; Mission Control confirmed zero completed placement
> or teaching turns. The fix replaces model-retained batch placement with server-driven one-answer-at-a-time
> placement and uses Realtime `session.update` to expose only the tools valid for the active call stage. A regression
> reproduces the exact `One by three` failure; 117/117 tests and the 25/25 deterministic eval pass. The fix is live
> in Railway deployment `b8f1c012`; a second measured carrier call is required before any phone-experience claim is
> marked complete.

> **This is the only document Codex needs.** Everything is in here: product, judging-criteria engineering,
> judge experience, complete feature manifest, architecture, schedule, demo, eval, submission package, risks.
> (Deep research receipts & citations: NOMAD_FEATURES.md. Provenance: IDEAS.md. Rules: HACKATHON_INSTRUCTIONS.md.)
>
> **Deadline control: July 21, 5:00 PM PT.** The official reminder and calendar weekday labels conflict, so the
> absolute date/time controls. Verify the live Devpost countdown and target submission by noon PT on July 21.
> **Goal: 1st place, Education track ($15,000), ~30k participants.**

---

# 1 · THE PRODUCT

> **Final product name: Continuum.** Tanya selected the name on July 17 after a human-led naming pass.

**A GLOBAL product with one proven deployment.** An adaptive multilingual tutor that works on **any phone,
anywhere**. Call a normal number — from a $15 feature phone, no smartphone, no app, no data — and a Socratic
teacher follows the caller's language or code-switching pattern without a closed engine allowlist. The release
must distinguish model-supported breadth from the finite language patterns actually tested. The release target is
five Grade 6 subjects taught from **frozen, verified curriculum packs** compiled from official syllabus sources;
only subjects that pass the full human-review and freeze gate become callable. It diagnoses misconceptions, never
dumps answers, **remembers every learner by name** (shared-phone aware), and **resumes mid-lesson after dropped
calls**. Same brain reachable by WhatsApp voice note.

**The global mechanism (this IS the product, not a roadmap wish):** a deployment =
`{locally tested language patterns + national syllabus + grade + local phone number}` — one config profile plus one Curriculum
Compiler run. **Three expansion axes, one machine:** new language, new country, new grade — each is a config
change + a compiler run, never a rebuild. Grade 6 ships first (fractions = the canonical misconception showcase;
age ~11 = the documented heart of the learning crisis). Off-grade callers are never turned away: the placement
diagnostic adapts difficulty, and the sandbox teaches any age, any topic.
**Born global, proven in India first:** the flagship deployment showcased this week is India (Hindi/English/Hinglish,
NCERT Grade 6) because it is a large multilingual deployment context, a 22-language society is a demanding
code-switching test, and the builder speaks the flagship language pattern, so the demo can be authentic.
India is deployment #1, not the boundary.

- **Tagline:** *"The connection may drop. The learning continues."*
- **Framing:** *"Two-way radio for the offline half of the world."*
- **Three audiences:** (1) the usage gap — GSMA estimates 3.1B people are covered by mobile broadband but do not
  use it, while ITU separately estimates 2.6B people offline globally (overlapping populations; never add them);
  (2) low-literacy learners; (3) text-barrier learners (dyslexia) — voice as equalizer.
- **Positioning:** "Bakame proved learners will call an AI. Viamo proved the channel scales to 22 countries.
  1-800-ChatGPT proved frontier voice AI works over a phone line. **Nobody has put an actual teacher on that line.**
  Continuum is that teacher." (Never claim channel novelty — always claim the teacher.)

# 1.5 · THE PLAIN-ENGLISH PITCH (use for: Devpost opening, video voiceover, README hero, judge Q&A)

**It's a teacher you call on the phone — or message on WhatsApp.**

A kid in a village — no laptop, no internet, just a basic ₹1,000 phone — dials a regular phone number.
A friendly voice answers: *"What do you want to learn today — Math, Science, English, History, Geography…
or anything else you're curious about?"* And then it **teaches them. By talking.**

- The kid can speak Hindi, English, or the mix everyone actually speaks — *"Didi, mujhe fractions samajh
  nahi aata"* — and the teacher keeps up, mid-sentence.
- It doesn't give answers like a homework machine. It teaches the way a good tutor does — asks questions,
  uses examples from the kid's real life (*"if one roti is shared between four people…"*), and catches **why**
  the kid is confused, not just that they're wrong.
- It **remembers each child.** Call back tomorrow: *"Welcome back, Ravi — last time one-fourth and one-third
  were confusing us. Let's try again."* Call drops mid-lesson? Call back — it continues from that exact sentence.
- What it teaches comes from the real school syllabus — the stuff the kid is actually examined on — and it's
  checked in advance so it never confidently teaches something wrong.
- Parents can get a text afterward saying what their kid practiced.

**Same teacher, two doors:**
- **The phone door** — for the kid with a button phone: dial, a voice answers, the lesson happens live.
- **The WhatsApp door** — for the kid or family with a cheap smartphone and patchy data: send a voice note,
  get a voice note back. Same teacher, same memory, same Hinglish. Costs almost nothing in data; works when
  the network is too weak for a call. Send a photo of the homework problem — it explains *that exact problem* out loud.

And it's the **same brain behind both** — learn on a call today, ask a follow-up on WhatsApp tonight, and it
remembers you're Ravi and you were fighting with fractions.

**Who it's for:** the 3.1 billion people GSMA estimates are covered by mobile broadband but do not use it — plus kids who can't read well
yet, and kids for whom reading itself is the barrier. Every learning app ever made assumes a screen, a download,
and data. This assumes nothing but a dial tone — or a WhatsApp voice note.

**And it's not an India-only architecture.** The same teacher can follow model-supported languages and
code-switching patterns without a language-pair branch. Bringing it to a new country is a config file, reviewed
curriculum compilation, and local language/accent testing—not a rebuild. India is deployment #1, not the boundary.

**One sentence:** *A patient, personal tutor designed for a child who owns nothing but a phone—across reviewed
subjects and locally tested, model-supported language patterns. If it can make a call, school is open.*

Everything else in this document is the machinery to make that sentence credible by the July 21 deadline.

# 2 · JUDGING CRITERIA, WORD BY WORD → ENGINEERING RESPONSE

**Stage One (pass/fail):** *"reasonably fits the theme and reasonably applies the required APIs/SDKs."*
→ Education track ✅. GPT-5.6 at the product's literal center (teaching engine, compiler, eval agents) ✅.
Codex builds everything ✅. Cleared by architecture, not by claims.

### Criterion 1 — Technological Implementation (1st tiebreaker = effectively highest weight)
*"How thoroughly and skillfully does the project use **Codex**?"*
— The first sentence of the top criterion is about **Codex usage itself**.
→ **Thoroughly:** Codex builds code, tests, docs, and reviews its own PRs across the whole system.
→ **Skillfully:** structured collaboration — plans first, then implementation, Codex-run code review, eval-driven
iteration. **CODEX_NOTES.md maintained live** (what Codex built, what the human decided, what GPT-5.6 contributed)
— this is evidence for the criterion, not garnish. One main Codex session = the `/feedback` Session ID.
*"Does the **code** reflect genuine effort and a **working, non-trivial** implementation?"*
→ Judges may read the repo: clean structure, meaningful commits, real tests (eval harness = the test suite),
runnable via README. **Non-trivial:** self-built telephony↔AI orchestration (NO Vapi/Retell — Twilio is raw
infrastructure only), SIP + G.711 handling, state machine with drop-resume, compiler pipeline, multi-agent QA.

### Criterion 2 — Design
*"Delivers a **working or runnable** project"* → runnable BY JUDGES: the phone number is the install.
*"**complete** product experience"* → no dead ends: silence, nonsense, off-topic, abuse, disconnects — every path
answered gracefully (lesson arc, recovery, rate limiting, recap).
*"**coherent**"* → one thesis (a teacher on a dial tone); every feature serves it (coherence lesson: sprawl kills).
*"**not just a technical proof of concept**"* → the exact failure mode of hackathon voice demos; answered by
onboarding, named memory, lesson arc with recap, SMS follow-up, dashboard, safety behavior — a product, not a pipe.

### Criterion 3 — Potential Impact
*"**credible, specific** case"* → numbers, named audience, cost math (README evidence stack §8).
*"**real problem** for a **real audience**"* → the usage-gap learner; UNESCO's projected 44M primary/secondary teacher deficit by 2030.
*"does the solution **actually address** that problem **based on what's demonstrated**"* → **THE key phrase.**
The demonstration must carry the claim → **the judge personally gets taught** (§3 Judge Experience), the video shows
a real learner journey end-to-end, and the dashboard proves teaching (mastery evidence), not chatting.

### Criterion 4 — Quality of the Idea
*"**creative and novel** … **differ from existing concepts**"* → never claim channel novelty. Current products
already demonstrate overlapping phone, voice, multilingual, subject, personalization, and low-bandwidth
capabilities. Continuum's narrower distinction is the inspectable combination of frozen reviewed packs,
source/reviewer provenance, per-subject placement and exact resume, trusted turn guards, and reproducible
deterministic plus paid-agent evidence.
*"genuine understanding of the problem space"* (site variant) → research-literate package: verified Adesua citation
(executes its published future-work agenda; 93.75% helpfulness, n=16 caveat), transfer-problem pedagogy as design,
code-switching as documented open problem (Cameroon paper), honest limitations section, honest competitor credit.

# 3 · THE JUDGE EXPERIENCE (testing access designed as a lesson, not a feature tour)

**Principle: the judge is not an evaluator watching teaching — the judge is a learner receiving it.**

1. **The invitation (testing instructions, verbatim style):** *"You're about to be a Grade 6 learner. Call
   +1-XXX-XXX-XXXX. Pick Math. When the tutor asks you to compare one-third and one-fourth — tell it one-fourth is
   bigger, because four is bigger. See what happens to you."* → the judge personally experiences misconception
   diagnosis + the Socratic strategy pivot.
2. **The mirror:** dashboard shows the judge's OWN call live — transcript, the diagnosis JSON about THEM, their
   mastery state flipping. Getting taught, then seeing the brain's reasoning about yourself, is the one-two punch.
3. **The break-it menu (published in testing instructions):** "Try to make it just give you the answer." ·
   "Hang up mid-lesson; call back." · "Interrupt it mid-sentence." · "Ask: *what have we learned together?*" ·
   "Try another reviewed subject." Publish a subject-specific stress test only after that pack passes review,
   compilation, independent verification, spot-checking, freeze, and routing.
4. **The Hinglish exhibit:** judges can't produce code-switched speech → dashboard hosts a recorded sample Hinglish
   session with synced transcript + the invitation: "try any Hindi word you know — even one."
5. **English is first-class:** the entire experience works beautifully in pure English (placement diagnostic adapts
   naturally to an adult English caller). Code-switching is the bonus wow, never a gate.
5.5 **The multilingual invitation:** invite judges to try a language pattern they speak while naming every pattern
   actually spot-checked. Describe arbitrary language tags and code-switching as an open architecture—not proof of
   every language, dialect, accent, or noisy phone condition.
6. **Zero friction:** no repo clone, no login, no sandbox code. The public landing page puts the verified phone
   number first, explains call → learn → call back and continue, and links to Mission Control. Live through Aug 5.

# 4 · COMPLETE FEATURE MANIFEST (the confirmed scope — build exactly this)

### 4.1 CORE — BUILD (days 1–3)

**Channel & pipeline**
- ⏳ **F1 Zero-data dial-in** — ~~code + SIP target + signed-webhook boundary + paid voice number + Twilio TLS origination route + verified signed public delivery; configuration preflight 11/11~~ ✅; the end-to-end learner audio experience still needs a measured carrier call.
- ⏳ **F7 2G/GSM-native** — inherited claim ready; needs one real G.711 carrier call to be true.
- ~~**F8 Server-side inference** — phone is a dumb audio pipe; all intelligence in the cloud.~~ ✅
- ⏳ **F9 G.711 μ-law 8kHz** — SIP path coded + schema-verified; live codec behavior unheard.
- ⏳ **F10 Realtime streaming pipeline** — bridge (`realtime-teaching-bridge.ts`) + call-accept built and unit-tested; **no live call yet. Still THE critical path.**
- ⏳ **F12 VAD + barge-in** — configured (commit `a41f2c8`); must be HEARD over a real call, not unit-tested.
- ⏳ **F13/F50 Preambles + latency choreography** — coded in bridge; live latency tuning pending.
- ⏳ **F14 Connection-degradation recovery** — ~~session-state drop→resume machinery~~ ✅ (verified: exact-question resume across process restart) · unclear-audio recovery coded (`7e9f4c3`) · live over-the-wire behavior pending.
- ⏳ **F15 Warm voice, ~20% slower** — ~~voice configured (`6a091f8`) + persona named: **Continuum**~~ ✅ · live listen-through pending.

**Language**
- ~~**F16 Mid-sentence code-switching** — live text-model checks pass for Hindi/English, Spanish/English, and
  French/English; deterministic multilingual fixtures also pass.~~ ✅ · real G.711 phone-audio proof remains in F19.
- ~~**F17/F31 Concept bridging + in-context vocabulary** — pack-driven canonical terms with language tags + spoken meanings.~~ ✅
- ~~**F18 Multi-language architecture** — engine contains no fixed language list or pair; arbitrary BCP-47-style
  tags and code-switch combinations pass through the typed contract.~~ ✅ **Release contract:** publish the tested
  language-pattern matrix; never turn architectural openness into an identical-quality claim for every language.
- ⏳ **F19 Accent robustness** — needs builder's-own-voice validation over a real call.

**Teaching (the authored layer: system prompt + curriculum packs)**
- ~~**F20 Curious Sandbox mode** — Socratic, fact-hedging, no pack; eval-covered (`sandbox.ts`, sandbox hedging cases).~~ ✅
- ⏳ **F21 Guided Path, five subjects** — ~~Math flagship fractions pack, hand-built + schema-frozen~~ ✅ · **Science,
  English, History, and Geography source briefs are human-approved; candidates are compiled and independently verified.
  They now await builder candidate spot-check → freeze.** The release target is five genuinely callable guided subjects, each with at least
  one coherent voice-first starter lesson, placement evidence, misconception handling, and a safe completion path—not
  empty menu labels or unreviewed flavored Sandbox. If a pack misses its gate, hide that subject and state the
  smaller verified menu honestly.
- ⏳ **F22 Voice-menu onboarding** — per-subject routing built (`710a01f`); full five-subject menu gated on the 4 packs.
- ~~**F23 Strict Socratic method** — enforced by eval ("just tell me" ×2, answer-request handling).~~ ✅
- ~~**F24 Household experiments + anchor objects** — reviewed safe objects persisted through drops (`c161fa8`); no unreviewed nouns storable.~~ ✅
- ~~**F25 Auditory mental modeling** — roti analogy live (verified in my own session: `concrete_analogy` strategy).~~ ✅
- ~~**F26/F27 Micro-lessons + verbal checks**.~~ ✅
- ~~**F28 Short-form structure**.~~ ✅
- ~~**F29→F54 Placement diagnostic** — three-question, evidence-scored (`placement-diagnostic.ts` + live run).~~ ✅
- ~~**F32-flavor Real-world grounding** — roti/household contexts in pack content.~~ ✅
- ~~**F34 Radio-host turn-taking**.~~ ✅ ~~**F35 Judgment-free tone**.~~ ✅ ~~**F36 Adaptive pacing**.~~ ✅
- ~~**F40 Voice-native output** — 100% voice-friendly rate on eval.~~ ✅
- ~~**G4 Lesson arc** — phased with recap + `should_end_session` (`lesson-service.ts`).~~ ✅

**Breadth release contract — this is part of the product, not a roadmap footnote**
- **Guided Learning:** Math, Science, English, History, and Geography become public only as individually reviewed,
  frozen packs. Memory, placement, resume, dashboard evidence, and mastery stay isolated per subject.
- **Curious Sandbox:** accepts broader safe learning questions in the learner's language pattern, but never awards
  guided-curriculum mastery and must hedge current, local, disputed, or unverifiable claims.
- **Language:** the learner speaks naturally; there is no engine language picker or closed pair. Public copy names
  the language/code-switch patterns actually tested in text and over the carrier path, while the architecture
  remains open to additional model-supported patterns after local review.

**Memory & learner model**
- ~~**F41 Named continuity + resume + voice-queryable history** — SQLite, HMAC-pseudonymized numbers, exact-question resume (verified), history queries (live-history-run).~~ ✅
- ~~**G1 Shared-phone identity** — Ravi and Asha coexist on one number without mixing progress (tested).~~ ✅
- ~~**F47 Callback loop** — retrieval practice on return (retrieval cases in eval + engine support).~~ ✅
- ~~**F48 Think-aloud diagnosis** — `ask_reasoning` strategy live (observed in verification session).~~ ✅

**Intelligence & integrity**
- ~~**F42 Hybrid routing (two-layer architecture)** — offline deterministic + live GPT-5.6 Structured-Outputs adapters (`store:false`); trusted code validates every turn against the frozen pack before speech/persist.~~ ✅
- ~~**F37 Controlled curriculum grounding** — frozen reviewed packs only; no live web lookup during lessons.~~ ✅
- ⏳ **F38/F39 Curriculum Compiler + G3** — ~~compiler + schema + source review + compile + independent verification~~ ✅ · **execution pending: builder candidate spot-check → freeze.**
- ~~**F52 Computed math truth** — deterministic verification in engine + tests.~~ ✅
- ~~**F56 Uncertainty honesty** — insufficient-evidence eval cases ×4 passing.~~ ✅

**Trust, proof & product surface**
- ⏳ **F44 SMS recap** — ~~Twilio SMS module + schema + tests~~ ✅ · live send blocked on Twilio upgrade/number; G8 parent registration pending.
- ⏳ **F45 Mission-control dashboard** — ~~sessions, eval gate, Release tab, token-protected APIs, humanized states, browser-verified desktop+mobile, cost tracking, anonymized IDs~~ ✅ · **sample audio is synthetic Spanish-English — Hinglish recording (builder's voice) pending**; live-call mirror needs the phone leg.
- **F60 Public judge landing page** — after the real-phone gate, ship a fast mobile-first page with the Continuum
  name/tagline, Call → Learn → Resume story, the verified subject menu and tested-language matrix, and links to the
  phone number, demo, Mission Control, repository, safety notes, and testing instructions. The call CTA stays gated
  until 11/11 configuration and the real-carrier checks pass; the page contains no dashboard token or learner data.
  Optional polish is one restrained GSAP disconnect→resume sequence with `prefers-reduced-motion`, followed only if
  time remains by a user-triggered, captioned, controllable teaching sample. No autoplay or scroll-triggered sound.
- ~~**F46 Child-safety guardrails** — PII redaction, safety evals, SAFETY_PRIVACY.md with consent/retention (G2).~~ ✅
- ~~**G6 Abuse guard** — call-admission rate limiting + jailbreak eval cases ×2.~~ ✅
- ~~**F51 Eval harness** — 25-case deterministic suite (25/25, 100% voice-friendly — independently re-verified) + paid
  GPT-5.6 simulated-learner × evaluator agent eval (24-case full pass recorded, `1810ffa`) + results on dashboard +
  enforced in CI on every push (clean-clone release gate, badge green).~~ ✅ *(exceeded plan: CI enforcement was never asked for)*

### 4.2 STRETCH — day 4 only, strict order, never at stability's expense
1. **F4 WhatsApp voice notes** — same brain, async channel; zero latency pressure = demo insurance; Twilio WhatsApp API.
2. **F3 Missed-call callback** — hang up after one ring → server calls back; missed-call culture; ~2h webhook.
3. **F5 WhatsApp text** — accessibility completeness on the same brain.
4. **F6 Homework camera (WhatsApp)** — photo + voice explanation; executes Adesua's stated future work (citable).
5. **F59 Keypad DTMF fallback** — "Press 1, 2, or 3" when audio fails; "Press 1 to practice tomorrow."
6. **F55 Vocal-cue basics** — react to silence/monosyllables with reassurance or a step back.

### 4.3 ROADMAP — README mentions ONLY (with citations where noted; zero build time)
F2 toll-free/local numbers per country · F11 field-grade noise hardening · F15-accents · F18 more locally tested language patterns ·
F29 full grade coverage · F30 pronunciation coaching · F32 full scenario curricula (market/commerce, exam prep,
health basics) · F33-depth all-subject packs beyond Grade 6 · F43 budget enforcement caps · F49 rehearsal mode ·
F53 collaborative oral storytelling (oral-tradition alignment) · F57 teacher SMS assignments · F58 cohort insights ·
G5 proactive re-engagement nudges · deep emotional adaptation · canvas companion "act two" · workflow-embedded
tutoring pattern · living simulations from real-world observation.

### 4.4 DO NOT BUILD (binding)
Grades beyond 6 · language-specific engine branches or untested every-language quality claims · native apps · WhatsApp as PRIMARY interface · parent
accounts/payments · school management · live web search mid-call · real deployment with children · complex auth ·
custom noise DSP · toll-free provisioning · managed voice platforms (Vapi/Retell/Bland).

# 5 · SCHEDULE (gates are law)

**⚠️ D0 — TONIGHT (Thu), 10 minutes, no code (triggered by Devpost forum finding, July 16):** The $100 Build Week
credits are CODEX credits — they extend Codex usage, do NOT upgrade model access, and per forum reports do NOT
apply to the API. Verify: ① your ChatGPT plan tier (Sol in Codex reportedly needs Pro+; **Terra/Luna ARE GPT-5.6
and fully satisfy the rules** — the "Sol is mandatory" forum claim is wrong) ② ~~which models Codex's picker actually
offers you~~ ✅ *(Sol, Terra, and Luna available)* ③ platform.openai.com → Billing: ~~do credits appear on the API
side?~~ ✅ *(none initially; $5 of prepaid API credit added Jul 17 — Codex credits are separate)* ~~Payment method~~ ✅. **Use budget alerts and keep auto-recharge off** *(project budgets are soft alerts, not hard caps)* ④ Realtime
API access on your API account. Consequences flow to routing (Terra-only mode if Sol gated) — the architecture
absorbs every outcome; the point is knowing TONIGHT, not Friday noon.

## 💰 API BUDGET: $5 INITIAL PREPAID CREDIT · ADD UP TO $5 MORE ONLY IF NEEDED

Auto-recharge is off. Use project alerts at 50%, 80%, and 100%; the platform project budget is a soft alert, not a hard cutoff. Realtime voice is the main API expense; keep deterministic work offline, develop on Realtime Mini, and reserve full Realtime 2.1 for final-quality calls.
**Burn rules:** ① iterate prompts/teaching logic in TEXT first (plain API calls, then the REPL) — voice only for
latency, UX feel, and demos ② every live test call has a purpose ③ cost/call visible on dashboard from D2.

| Day | Purpose | Budget |
|---|---|---|
| D1 Fri | pipeline bring-up + latency tests (~12 live min) | $3 |
| D2 Sat | gate-test calls (teaching iterated in text first) | $4 |
| D3 Sun | compiler runs + ~~25-case eval (text)~~ ✅ + 2–3 live smoke calls | $3 |
| D4 Mon | demo takes, montage, WhatsApp tests | $5 |
| D5 Tue | final verification calls | $1 |
| Jul 22–Aug 5 | **judges' test calls (reserve — do not touch)** | $4 |

**Codex model rule all week:** batch focused sessions, use smaller models for disposable exploration, and reserve
GPT-5.6 for submission-relevant reasoning. "Best" below = Sol if available, else Terra (equally rules-compliant).

---

### 🌙 TONIGHT — Thu Jul 16, 10 PM (≤1 hour, then SLEEP)
1. (20 min) **D0 checks above**: plan tier → ~~Codex model picker~~ ✅ → ~~API balance/credit-grant check~~ ✅ → ~~payment method + $5 prepaid API credit~~ ✅ *(auto-recharge off)* → Realtime API access.
2. (15 min) Create accounts if missing: ~~Twilio account created~~ ✅ *(onboarding/verification still in progress; paid upgrade remains deferred per D2 gate)* · ~~GitHub repo created private with MIT license~~ ✅ *([Tanya-Khanna/nomad-ai](https://github.com/Tanya-Khanna/nomad-ai))*.
~~3. Tell Claude the D0 findings → routing defaults get locked to reality.~~ ✅ *(recorded in CODEX_NOTES)*
~~4. Skim §1–§5 once.~~ ✅
- ~~**Codex: not tonight.**~~ ✅ *(superseded — Codex started the zero-credit offline build the same night, correctly: no API/telephony spend)*

### 📅 FRI Jul 17 — D1: PROVE THE PIPE (Codex: BEST model, HIGH reasoning all day — this is the novel engineering)
**Morning (~9 AM):**
- ~~Open THE main Codex session (this becomes the `/feedback` session — everything core happens here). First prompt: point it at this file + repo init + AGENTS.md + CODEX_NOTES.md skeleton.~~ ✅
- Access checks in practice: ~~first live structured-output API call to GPT-5.6 Luna~~ ✅ *(Jul 17; correct misconception diagnosis returned)*; Terra/Sol smoke checks; Realtime session hello-world; voice catalog listen-through (pick the warm voice; note accent options).
- ~~Twilio: buy US number, configure SIP trunk → OpenAI Realtime SIP connector.~~ ✅ *(voice number active; do-not-record trunk routes to OpenAI over TLS)*
**Afternoon:**
- The bridge: phone call → Twilio → SIP → Realtime → AI voice answers. G.711 8kHz confirmed.
- Measure real latency (phone-to-response). Tune VAD/barge-in settings.
- If SIP path fails by 3 PM → switch to Media Streams ↔ own WebSocket server (Codex: BEST, xhigh — this is harder).
**Evening:**
- Minimal conversation loop with prompt v0 (Socratic + Hinglish sketch). Call it from your own phone; talk to it; note everything that feels wrong.
- Commit milestones (≥3 today). CODEX_NOTES: 10 min.
- **Exit: a real phone conversation with an AI exists. Latency number written down.**
- **📦 Features landing today:** ~~F8 server-side inference~~ ✅ · ~~F15-voice configured + persona named (Continuum)~~ ✅ · **F1 · F7 · F9 · F10 · F12 · F19 — carrier configuration and signed webhook proof are 11/11; the measured audio/latency/barge-in/resume checks in PHONE_SETUP.md remain the #1 task.**

### 📅 SAT Jul 18 — D2: PROVE THE TEACHER ⛔ GO/NO-GO (Codex: BEST, XHIGH for engine/state machine; BEST for prompt & pack authoring; Luna/Spark for boilerplate)
**Morning:**
- ~~Two-layer teaching engine: structured-JSON schema + Luna/Terra↔Sol routing (offline deterministic + live Structured-Outputs adapters) + trusted turn validation.~~ ✅ *(latency choreography coded in bridge; live tuning pending phone leg)*
- ~~Quick TEXT loop harness (pre-REPL) so all teaching iteration today is text-first (cheap).~~ ✅ *(built early as `npm run chat` / `make chat`; offline by default)*
**Afternoon:**
- ~~Hand-build the fractions flagship pack: objectives, micro-lessons, verified question bank (code-checked answers, F52), misconception taxonomy (larger-denominator front and center), roti/paper-folding analogies.~~ ✅ *(schema-frozen, checked in as `builtin:india-ncert-grade-6-fractions`)*
- ~~Learner DB: named profiles per number (G1 "Is this Ravi?"), resume state, placement diagnostic v0.~~ ✅ *(local SQLite; caller number stored as a keyed HMAC identifier)*
- ~~Prompts v1: Socratic discipline, turn-taking, voice-math, code-switching (universal — multilingual eval ×5 passing), 8–10 min arc with recap phase, judgment-free tone.~~ ✅
**Evening — ⛔ THE GATE:**
- Live gate test (budget: ~6 live calls): a working Socratic fractions lesson, in Hinglish, over a real phone call, acceptable latency, **survives a mid-call disconnect and resumes**.
- **PASS → celebrate, commit, THEN upgrade Twilio to Pay-as-you-go ($20 balance — deferred until the project earned it; trial's preamble + verified-caller limits are fine for D1–D2 dev but must be gone before eval calls, video, and judges). FAIL → activate fallback (grading copilot, IDEAS.md #1, 3 days runway). No rationalizing a marginal fail.** (Note: if trial mode blocks SIP-trunk config on Friday, either use media-streams fallback during trial or upgrade a day early.)
- **📦 Features landing today:** ~~F42 two-layer architecture + hybrid routing · F14 drop recovery + resume machinery · F21-flagship fractions pack · F23 Socratic · F16 code-switching · F17/F31 bridging + vocabulary · F25 analogies · F26/F27 micro-lessons + checks · F28 short-form · F52 computed math · F40 voice-math · F34 turn-taking · F35 tone · F36 pacing · G4 lesson arc · F41 learner DB + resume · G1 shared-phone profiles · F54/F29 placement diagnostic · F56 uncertainty honesty · F48 think-aloud~~ **✅ ALL 20 DONE** · ⏳ F13/F50 latency choreography (coded; live tuning pending) · **⛔ THE GATE ITSELF (real Hinglish phone call + live disconnect/resume) REMAINS OPEN — blocked on phone leg**

### 📅 SUN Jul 19 — D3: PROVE THE SCHOOL (Codex: Terra for compiler + eval harness; Luna/Spark for REPL + dashboard skeleton)
**Morning:**
- Curriculum Compiler: syllabus structure in → ORIGINAL lessons/questions out (G3 rule) → verifier-agent pass. Run
  for Science, English, History, and Geography (Grade 6). Spot-check each pack yourself (~15 min each) → freeze.
  Reject any pack that lacks a coherent voice-first starter lesson, placement evidence, misconception handling, or
  safe completion path; never expose an empty or unreviewed subject merely to make the menu look broad.
- ~~Text-mode REPL (`make chat`) — formalize the text loop into the judges' run path.~~ ✅ *(landed early)*
**Afternoon:**
- ⏳ Five-subject voice onboarding + flavored-sandbox fallbacks — per-subject routing built (`710a01f`); full menu gated on the 4 reviewed packs.
- ~~Callback loop (retrieval practice on return) · voice-queryable history · shared-phone profiles polished.~~ ✅
- ~~**Eval harness**: deterministic 25/25 green + paid GPT-5.6 agent-based judge pass (24-case full pass, `1810ffa`) + CI enforcement.~~ ✅
**Evening:**
- ~~Dashboard skeleton~~ ✅ *(exceeded: full Mission Control — Sessions/Eval/Sample/Release tabs, token-protected, browser-verified desktop+mobile)*.
- ~~**Decisions due: tutor persona name + product name**~~ ✅ **CONTINUUM** *(human-selected Jul 17)*.
- **Exit: five subjects callable (⏳ OPEN — needs candidate spot-check and freeze) · ~~eval green~~ ✅ · ~~REPL works~~ ✅ · ~~dashboard~~ ✅.**
- **📦 Features landing today:** ~~F38/F39 compiler + G3 review gate (code) · F37 frozen-pack grounding · F20 sandbox · F24 anchor objects · F32-flavor · F47 callback · F41-query history · F18 universal language architecture · F51 eval harness · §7.5 REPL · F45 dashboard · F15-persona (Continuum)~~ **✅ 12 DONE** · ⏳ **F21-full + F22 five-subject menu — the 4 model-verified candidates await YOUR spot-check → freeze**

### 📅 MON Jul 20 — D4: PROVE IT TO JUDGES (Codex: Luna/Spark for UI/SMS/stretch; Terra if logic gets hairy; Luna for README prose)
**Morning:**
- ~~Dashboard complete: eval-results page, anonymized IDs, cost/call, click-to-seek sample player, Release tab.~~ ✅ · ⏳ live-call mirror view (needs phone leg) · ⏳ **sample is synthetic Spanish-English — record the Hinglish sample in YOUR voice**.
- ⏳ SMS recap — ~~module + tests~~ ✅, live send needs Twilio upgrade · ~~per-number rate limiting~~ ✅.
- **After the real-phone gate:** ship the F60 landing-page minimum, verify it signed out on desktop and mobile,
  confirm the phone CTA matches the carrier release state, and show only the subjects and language patterns that
  passed their gates. Record the demo before optional GSAP or audio polish.
**Afternoon — stretch bench, §4.2 order, ONLY while stable:** WhatsApp voice notes → missed-call callback → WhatsApp text → homework camera → DTMF → vocal cues. *(none started — correct per gate discipline)*
**Evening — the submission package (budget ~$5 of live calls):**
- 🎬 Record the demo video (§6 — all beats). **OPEN.**
- ✍️ ⏳ README — ~~repo README substantially complete: evidence stack w/ primary citations, honest landscape table, distribution/pilot path, universal architecture, run-it-yourself, safety, limitations, roadmap~~ ✅ · **remaining: real phone number in hero + judge card phone items + YOUR human rewrite of Devpost copy (Codex enforced an authorship gate — SUBMISSION_COPY.md is a draft aid, not paste-ready).**
- **Exit: phone gate passed · verified subject menu callable · landing-page minimum live · video uploaded · README done · system stable.**
- **📦 Features landing today:** ~~F45 dashboard (sans live mirror) · G6 rate limiting · F46 safety end-to-end · G9 honest limitations · G2 consent/retention docs · §4.3 roadmap mentions~~ **✅ DONE** · ⏳ F60 landing-page minimum, then optional accessible GSAP/user-triggered audio polish · ⏳ F44 live SMS + G8 parent number (post-Twilio-upgrade) · **stretch bench untouched: F4 → F3 → F5 → F6 → F59 → F55** · 🎬 video + Hinglish sample + human-rewrite = the open D4 core

### 📅 TUE Jul 21 — D5: SHIP (deadline 5:00 PM PT / 8:00 PM ET — builder is US-based; target noon PT regardless)
**Morning:**
- Final stability pass: 2 live verification calls ($1) · `make eval` one last time · REPL fresh-clone test (does §7.5 actually work from a clean machine?).
- Video → public on YouTube. Repo → public (MIT) or share with testing@devpost.com + build-week-event@openai.com.
- In the main Codex session: run `/feedback`, copy the Session ID.
**By noon PT:**
- Devpost form: Education category · description · landing-page URL · video URL · repo URL · `/feedback` Session ID · Judge Experience testing instructions (verified phone number front and center). **SUBMIT.** Screenshot the confirmation.
**After:**
- Afternoon = buffer only. Keep phone line + dashboard live through **Aug 5** (the $4 judge reserve exists for this). Don't touch the deployed system except for outages.

**Iron rules:** live call = critical path — nothing from D3–D4 starts before the D2 gate passes · stretch never
jeopardizes stability (a flawless 6-feature demo beats a broken 20-feature one) · text-first iteration, voice for
truth · commit at every milestone · CODEX_NOTES 10 min every evening · all core work in the ONE main Codex session.

**✅ Coverage checksum — STATUS TALLY (verified Fri night against repo):**
**~34 of 43 core features fully DONE** (all teaching, memory, integrity, eval, dashboard, safety, docs).
**Everything still open clusters into six human-or-external workstreams:**
1. **📞 THE PHONE LEG** — F1, F7, F9, F10, F12, F13/50-live, F14-live, F15-live, F19 all unblock together when
   preflight has reached ~~7/11 → 10/11 → one signed-webhook smoke call → 11/11~~ ✅ → measured real-carrier checks (PHONE_SETUP.md has the sequence;
   prerequisites complete: ~~public HTTPS deploy~~ ✅, ~~OpenAI project/webhook~~ ✅, ~~Twilio upgrade + number + trunk~~ ✅)
2. **📚 PACK REVIEW** — F21-full + F22: ~~review 4 source briefs → compile → verify~~ ✅ · spot-check the generated candidate packet → freeze
3. **🎙️ HINGLISH SAMPLE** — your voice, replaces synthetic Spanish-English exhibit
4. **🎬 DEMO VIDEO + human rewrite** of Devpost copy (authorship gate)
5. **🌐 PRODUCT SURFACE** — F60 static/mobile-first landing page after the phone gate; GSAP and audio remain optional
6. **📱 POST-UPGRADE** — F44 live SMS + G8 parent number · then stretch bench (F4→F3→F5→F6→F59→F55) only if time
If a feature slips, it moves DOWN into stretch/roadmap — never into the final day.

# 6 · DEMO VIDEO (<3 min · public YouTube · voiceover REQUIRED: what we built + how Codex + how GPT-5.6)

Record against the real system (rehearse the script, never fake the tech). No copyrighted music. English voiceover.
1. (0:00–0:15) **Mission cold open (voiceover over black, then the phone):** *"A quarter of the world has no real
   internet. Their kids' education ends where the data signal does. But almost everyone has this—"* → $15 feature
   phone fills the frame, no WiFi anywhere → dials a normal number.
2. (0:15–0:45) Onboarding menu shows every subject that passed its review/freeze gate (target: five) → learner
   speaks **Hinglish, switching mid-sentence** — tutor follows the tested pattern.
3. (0:45–1:05) The misconception: "one-fourth is bigger because four is bigger" → tutor catches it (diagnosis JSON
   flashes on dashboard split-screen).
4. (1:05–1:25) The pivot: roti analogy instead of repetition; learner interrupts mid-sentence — tutor stops, listens.
5. (1:25–1:30) **The call DROPS.** Silence. Nothing crashes.
6. (1:30–1:35) Learner calls back.
7. (1:35–1:50) "Welcome back, Ravi — we were comparing one-third and one-fourth. You said one-fourth was larger…"
8. (1:50–2:00) Learner answers correctly → dashboard mastery flips "Needs support" → "Developing."
8.5 (2:00–2:10) **The sandbox flash (Mode 2):** off-script curiosity — "ek aur sawaal… why do stars twinkle?" —
   tutor answers with a Socratic question back. The kid who lingers after class. Any topic under the sun.
8.7 (2:10–2:22) **The language montage:** the same number receives questions in two or three language patterns that
   passed recorded carrier spot checks. Label each pattern. On-screen text: *"One architecture. Locally tested
   language patterns."* A finite montage proves those examples, not every language, dialect, accent, or condition.
9. (2:22–2:55) WhatsApp voice-note encore (if built) → voiceover over architecture diagram covering, in order:
   **the three audiences in one line** ("No screen, no text, no app — so it works for the 3 billion without
   internet, for learners who can't yet read, and for kids for whom text itself is the barrier") → **the global
   line** ("Its engine has no hard-coded subject or language pair. Each deployment still needs reviewed curriculum
   and local language testing. India is deployment #1, not the boundary") → **how Codex built it** (telephony bridge, compiler,
   eval harness — one main session) and **how GPT-5.6 powers it** (teaching-engine JSON, Luna/Terra/Sol routing,
   compiler, simulated-classroom QA) → judge invitation: "call the number in our README — try a language pattern
   you speak" → tagline card: *"The connection may drop. The learning continues."*

# 7 · CODEX PROCESS (submission-critical — also scored under Criterion 1)

- ⏳ **ONE main Codex session** → run `/feedback` and copy the Session ID **on ship day** (the one human step left here).
- ~~Dated commits at every milestone~~ ✅ *(57 commits through the independent status-audit commit, all descriptive)*.
- ~~**CODEX_NOTES.md live during the build**~~ ✅ *(exemplary — milestone-by-milestone with verification evidence)*.
- ~~**AGENTS.md** in repo root.~~ ✅
- ~~Use Codex skillfully and visibly: plan → implement → review → eval-driven iteration.~~ ✅ *(+ CI release gate — beyond plan)*
- ~~**Budget guard:** routing discipline + cost tracking on dashboard.~~ ✅ *(reserve discipline continues through Aug 5)*

# 8 · SUBMISSION PACKAGE

> **STATUS (Fri night):** ~~README sections 1–5, 8–11 (evidence stack w/ primary citations, honest landscape table,
> distribution/pilot path, universal architecture, run-it-yourself w/ `npm run chat`, safety, limitations, roadmap)~~
> ✅ **substantially shipped in repo README** — stronger than this spec in places (Codex re-audited competitors
> against primary sources and corrected stale claims). **OPEN: phone number in hero (post phone-leg) · §6 Codex
> narrative distillation · §7 judge card phone items · Hinglish sample · Devpost description HUMAN REWRITE
> (authorship gate) · repo sharing with testing@devpost.com + build-week-event@openai.com · `/feedback` ID.**

**README (11 sections):**
1. Hero: product + tagline + **THE VERIFIED PHONE NUMBER** ("it will teach you — call it") + landing-page link +
   dashboard link + architecture diagram. If carrier proof is open, show the limitation instead of a call-now claim.
2. Why: three audiences · GSMA 3.1B mobile-internet usage gap · separate ITU 2.6B offline estimate, never added ·
   UNESCO projected 44M primary/secondary teacher deficit by 2030 · preliminary Rori benchmark (~1 yr schooling
   gain @ ~$5/child), attributed with its year-one limitation.
2.5 **Distribution & adoption path (the "who hands the child the number?" answer):** do not assume learner-direct
   digital acquisition. The proposed path is institution-first: (a) teachers/schools distribute the number after
   local review, consent, and learner assent; (b) an NGO/state-education pilot starts with one district, one grade,
   and roughly 200 learners measured on independent tests plus attendance, feedback, subgroup access, failures, and
   deletion/retention compliance; (c) carrier partnerships are explored only after the carrier and learning gates
   pass. Missed-call callback and teacher/parent messaging remain later consent-sensitive channels.
3. What's different: sourced comparison crediting Bakame, Viamo AVA, 1-800-ChatGPT, Rori, and Callee Me for the
   overlapping capabilities they document. Differentiate Continuum on the inspectable combination of frozen
   reviewed packs/provenance, per-subject placement/resume, trusted turn guards, and reproducible evidence—not on
   unsupported claims that competitors lack languages, subjects, personalization, memory, or basic-phone access.
4. Research grounding: Adesua verified citation (executes its published future-work agenda; 93.75% helpfulness,
   **n=16 caveat stated honestly**) · transfer problem (+0.73 local vs +0.13 independent effect sizes; 17%-worse
   exam finding) → Continuum's context-anchored design answer · Cameroon paper (code-switching = documented open problem).
5. How it works: two-layer architecture · Curriculum Compiler + G3 originality rule · named learner memory ·
   eval harness with results table (24/24) · honest cost/call math + scale path (carrier partnerships, Viamo precedent).
6. **How we built it with Codex** (scored under BOTH Technical Implementation and Quality of the Idea — per
   official submission guidance): the CODEX_NOTES.md distillation — where Codex accelerated, where key decisions
   were made, how GPT-5.6 and Codex were used.
7. **Judge Experience** (§3 verbatim): the invitation, the mirror, the break-it menu, the Hinglish exhibit.
7.5 **Run it yourself (REQUIRED by submission rules — setup, sample data, run guidance):**
   - Prerequisites + `.env.example` (OpenAI key; Twilio optional)
   - **Local text-mode REPL** (`make chat`): the full GPT-5.6 teaching engine in the terminal — no telephony
     needed. Judge types as the learner; sees Socratic turns + live diagnosis JSON. One command to meet the tutor.
   - **Eval suite** (`make eval`): runs all 25 scripted cases, prints the scorecard.
   - **Sample data shipped in-repo:** one hand-authored frozen fractions pack, four pending source briefs that are
     not callable until approved and compiled, a synthetic seeded learner ("Ravi", paused mid-lesson), and a
     clearly labeled synthetic Spanish-English audio/transcript fixture.
   - Full telephony setup guide (Twilio number + SIP trunk) for complete reproduction, marked optional.
8. Safety & privacy: child-safety behavior, anonymized IDs, retention, deployment consent flow (G2).
9. **Honest limitations:** deaf/HoH excluded by voice-only (inverse of the dyslexia strength) · ASR limits under
   heavy accents/noise · Grade 6 scope · US demo number ≠ rural 2G deployment · what a real pilot must measure
   (independent-test learning outcomes — the transfer bar).
10. Roadmap (§4.3) with citations.
11. License (MIT) · credits · full source list (from NOMAD_FEATURES.md).

**Devpost description:** capability-first ("An adaptive multilingual tutor that works on any phone") → breadth
claims stated plainly and honestly: *"Guided learning across every subject that passed its review gate (target:
Math, Science, English, History, and Geography), plus a Curious Sandbox for broader safe questions. Its engine has
no fixed language pair; the submission names the language patterns actually tested."* → the 9-beat story in prose → evidence stack →
Codex/GPT-5.6 summary → the judge invitation.

# 9 · RISK REGISTER

| Risk | Mitigation | Fallback |
|---|---|---|
| GPT-5.6 realtime variant unavailable on credits | D1 morning check | Two-layer arch: available realtime voice model + GPT-5.6 brain — still Stage-One compliant |
| **Codex credits do not fund API runtime; no further distribution expected** | $5 prepaid API balance, alerts, auto-recharge off, deterministic loops offline | Add at most $5 if needed; trim paid evals and preserve Realtime credit for carrier proof/demo |
| **Sol gated behind Pro plan** | Terra/Luna ARE GPT-5.6 — rules fully satisfied without Sol ("Sol is mandatory" forum claim is wrong) | Terra-only routing (already designed); README states tiering honestly ("Sol where available") |
| SIP connector unavailable/flaky | D1 check | Twilio Media Streams ↔ own WS server (more code = more Criterion-1 credit) |
| Latency reads as broken | Preambles + Socratic floor-holding + rehearsed demo conditions | WhatsApp async path shows full intelligence, zero latency pressure |
| D2 gate fails | Binary gate, Saturday evening | Grading copilot (IDEAS.md #1), 3 days runway |
| Compiler packs mediocre | Verifier pass + spot-checks; fractions hand-built regardless | Affected subjects → flavored sandbox |
| Judge's call hits an edge case | 24-case eval; rate limiting; graceful recovery everywhere | Dashboard transcript shows even failure handled gracefully |
| Credit burn | Routing discipline + cost dashboard + headroom reserve | Terra-only mode |
| Anything unfinished on July 21 | Video + README done before the absolute deadline | The final submission window is buffer, not planned build time |

---

*Scope authority: HACKATHON_SUBMISSION.md (43 IN · 6 stretch · roadmap · 9 audit gaps resolved — all reflected
above). Receipts: NOMAD_FEATURES.md. Provenance: 16-idea tournament, IDEAS.md. Build the pipe → pass the gate →
ship the school → let it teach the judges.* 📞
