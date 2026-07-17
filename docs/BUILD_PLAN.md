# NOMAD AI — FINAL BUILD PLAN (v4 · SELF-CONTAINED CODEX HANDOVER)

> **This is the only document Codex needs.** Everything is in here: product, judging-criteria engineering,
> judge experience, complete feature manifest, architecture, schedule, demo, eval, submission package, risks.
> (Deep research receipts & citations: NOMAD_FEATURES.md. Provenance: IDEAS.md. Rules: HACKATHON_INSTRUCTIONS.md.)
>
> **Deadline: Tuesday, July 21, 5:00 PM PT.** Today: Thursday July 16. Build: Fri–Mon. Submit Tue by noon PT.
> **Goal: 1st place, Education track ($15,000), ~30k participants.**

---

# 1 · THE PRODUCT

> *(Product name: "Nomad" is a WORKING TITLE — builder will rename before submission; it's a find-and-replace.)*

**A GLOBAL product with one proven deployment.** An adaptive multilingual tutor that works on **any phone,
anywhere**. Call a normal number — from a $15 feature phone, no smartphone, no app, no data — and a Socratic
teacher answers **in whatever language the caller speaks** (the model's native multilingualism is unrestricted:
Spanish, Swahili, Tamil, Portuguese… answered out of the box). Five Grade 6 subjects taught from **frozen,
verified curriculum packs** compiled from any country's official syllabus. It diagnoses misconceptions, never
dumps answers, **remembers every learner by name** (shared-phone aware), and **resumes mid-lesson after dropped
calls**. Same brain reachable by WhatsApp voice note.

**The global mechanism (this IS the product, not a roadmap wish):** a deployment =
`{language pair + national syllabus + GRADE + local phone number}` — one config profile plus one Curriculum
Compiler run. **Three expansion axes, one machine:** new language, new country, new grade — each is a config
change + a compiler run, never a rebuild. Grade 6 ships first (fractions = the canonical misconception showcase;
age ~11 = the documented heart of the learning crisis). Off-grade callers are never turned away: the placement
diagnostic adapts difficulty, and the sandbox teaches any age, any topic.
**Born global, proven in India first:** the flagship deployment showcased this week is India (Hindi/English/Hinglish,
NCERT Grade 6) because (a) it's the largest usage-gap population on Earth, (b) a 22-language society is the hardest
code-switching test — pass it and easier cases follow, and (c) the builder speaks it, so the demo is authentic.
India is deployment #1, not the boundary.

- **Tagline:** *"The connection may drop. The learning continues."*
- **Framing:** *"Two-way radio for the offline half of the world."*
- **Three audiences:** (1) the usage gap — cell coverage, no internet (63% of Africans; 2.5–3.4B people offline; ~900M feature phones); (2) low-literacy learners; (3) text-barrier learners (dyslexia) — voice as equalizer.
- **Positioning:** "Bakame proved learners will call an AI. Viamo proved the channel scales to 22 countries.
  1-800-ChatGPT proved frontier voice AI works over a phone line. **Nobody has put an actual teacher on that line.**
  Nomad is that teacher." (Never claim channel novelty — always claim the teacher.)

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

**Who it's for:** the ~3 billion people with phone signal but no real internet — plus kids who can't read well
yet, and kids for whom reading itself is the barrier. Every learning app ever made assumes a screen, a download,
and data. This assumes nothing but a dial tone — or a WhatsApp voice note.

**And it's not an India product.** The same teacher answers in Spanish, Swahili, Portuguese, Tamil — whatever
the caller speaks, out of the box. Bringing it to a new country isn't a rebuild; it's a config file and one
compiler run on that country's syllabus. The story above happens to star Ravi because our first proven deployment
is India — the hardest test we could pick. Tomorrow the same phone rings in Lagos, Oaxaca, or Dhaka.

**One sentence:** *A patient, personal tutor for every child on Earth who owns nothing but a phone — any phone,
any language. If it can make a call or open WhatsApp, school is open.*

Everything else in this document is just the machinery to make that sentence true by Tuesday.

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
*"**real problem** for a **real audience**"* → the usage-gap learner; UNESCO 17M teacher shortfall.
*"does the solution **actually address** that problem **based on what's demonstrated**"* → **THE key phrase.**
The demonstration must carry the claim → **the judge personally gets taught** (§3 Judge Experience), the video shows
a real learner journey end-to-end, and the dashboard proves teaching (mastery evidence), not chatting.

### Criterion 4 — Quality of the Idea
*"**creative and novel** … **differ from existing concepts**"* → five-pillar white space, competitor-matrix-proven:
live call + all subjects + curriculum grounding + Socratic + code-switching — no competitor owns more than two
(Bakame: English-only/one country · Viamo: info, not teaching · 1-800-ChatGPT: answer machine, US/CA only, no memory ·
WhatsApp tutors: text, literacy+data required · India voice apps: smartphone required).
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
   "Try History — make a choice in the story." Every stress test becomes a judge activity that passes.
4. **The Hinglish exhibit:** judges can't produce code-switched speech → dashboard hosts a recorded sample Hinglish
   session with synced transcript + the invitation: "try any Hindi word you know — even one."
5. **English is first-class:** the entire experience works beautifully in pure English (placement diagnostic adapts
   naturally to an adult English caller). Code-switching is the bonus wow, never a gate.
5.5 **The any-language invitation:** *"Speak to it in YOUR language — Spanish, Portuguese, Mandarin, whatever you
   grew up with. It will answer."* Judges experience the global claim personally instead of reading it.
6. **Zero friction:** no repo clone, no login, no sandbox code. A phone number and a dashboard URL. Live through Aug 5.

# 4 · COMPLETE FEATURE MANIFEST (the confirmed scope — build exactly this)

### 4.1 CORE — BUILD (days 1–3)

**Channel & pipeline**
- **F1 Zero-data dial-in** — full tutor over a standard voice call; works from any phone; no app/account.
- **F7 2G/GSM-native** — inherited property of F1 via G.711; README claim with technical receipt.
- **F8 Server-side inference** — phone is a dumb audio pipe; all intelligence in the cloud.
- **F9 G.711 μ-law 8kHz** — configure the SIP path for real telephone codec (not browser audio).
- **F10 Realtime streaming pipeline** — Twilio number → SIP trunk → OpenAI Realtime voice layer
  (fallback: Twilio Media Streams ↔ own WebSocket server). THE critical path.
- **F12 VAD + barge-in** — Realtime API server VAD; caller can interrupt mid-sentence; configure + test.
- **F13/F50 Preambles + latency choreography** — no dead air: fast model holds the floor Socratically
  ("Good question — while I think, what would YOU guess?") while Sol works. The latency mask IS pedagogy.
- **F14 Connection-degradation recovery** — graceful "didn't catch that over the wire" + full session-state
  machinery for drop→resume (demo's emotional peak).
- **F15 Warm voice, ~20% slower** — voice config + cultural persona name (builder picks; folklore archetype,
  NOT real-person cosplay). Accent options → roadmap; check voice catalog D1.

**Language**
- **F16 Mid-sentence code-switching** — Hindi/English/Hinglish held fluidly; the demo's soul; proven by eval cases.
- **F17/F31 Concept bridging + in-context vocabulary** — explain in Hindi, bridge to the English academic term
  ("aadha — in math English we say half"); prompt-level.
- **F18 Multi-language architecture** — `language_mode` in the JSON schema; per-country deployment profile
  {language pair + syllabus + phone number} as config. **No language restriction built:** the model's native
  multilingualism stays on (a Spanish- or Tamil-speaking caller gets answered). Validated & tuned pair:
  hi/en/hinglish. Positioning claim: "Speaks whatever the model speaks — dozens of languages out of the box;
  validated for Hinglish; a new country = a config profile + one compiler run." One Spanish smoke-test in eval.
- **F19 Accent robustness** — inherited from platform ASR; validated with builder's own accent; hardening → roadmap.

**Teaching (the authored layer: system prompt + curriculum packs — budget real writing time)**
- **F20 Curious Sandbox mode** — "ask me anything," Socratic, hedges facts (no pack behind it); identity feature
  and fallback layer.
- **F21 Guided Path, five subjects** — Math (flagship fractions pack, HAND-BUILT) + Science/English/History/Geography
  (Curriculum Compiler). Subject flavors: Science = household experiments + anchor objects; History = time-machine
  roleplay with genuine decision points ("the market or the mountain?"); Geography = look-around prompts;
  English = conversation + vocabulary.
- **F22 Voice-menu onboarding** — "Math, Science, English, History, Geography — or ask me anything?" Demo's opening.
- **F23 Strict Socratic method** — never reveals answers; guides via questions; enforced by eval ("just tell me" cases).
- **F24 Household experiments + anchor objects** — "fold a paper in half… again — how many parts?"; child names a
  physical object ("I'm holding a leaf") kept as persistent shared lesson context.
- **F25 Auditory mental modeling** — roti analogy and friends; analogies as the substitute for diagrams.
- **F26/F27 Micro-lessons + verbal checks** — ~1-min units, one check question each; instant encouraging feedback.
- **F28 Short-form structure** — design principle (evidence: Adesua drop-off — most quiz abandonment before 10% of
  questions; long tests kill engagement).
- **F29→F54 Placement diagnostic** — warm ~2-min first-call calibration (graded questions disguised as chat):
  level, language mix, confidence. Adapts difficulty within Grade 6.
- **F32-flavor Real-world grounding** — word problems set in mandis/rotis/local life (cultural grounding, free).
- **F34 Radio-host turn-taking** — ≤2–3 sentences per turn, always ends with a question back.
- **F35 Judgment-free tone** — infinite patience, warm, never scolds; prompt property.
- **F36 Adaptive pacing** — repeats/rephrases on confusion; never rushes.
- **F40 Voice-native output** — speakable prose only; voice-math craft: "one-fourth," NEVER "1/4"; no notation,
  no markdown.
- **G4 Lesson arc** — ~8–10 min session: greet → teach → check → recap → "call again tomorrow."

**Memory & learner model**
- **F41 Named continuity + resume** — learner DB keyed phone# → named profiles; welcome-back with exact lesson state;
  **voice-queryable history** ("what have we learned together?").
- **G1 Shared-phone identity** — "Is this Ravi, or someone new?" — multiple named profiles per number (siblings).
- **F47 Callback loop** — next call OPENS with retrieval practice on last session's struggle (spaced repetition
  by phone call).
- **F48 Think-aloud diagnosis** — "walk me through how you got that" — diagnoses the reasoning path from spoken work;
  voice is the superior medium for process-visible tutoring (Devpost argument).

**Intelligence & integrity**
- **F42 Hybrid routing (two-layer architecture)** — Realtime layer owns fluid speech; **GPT-5.6 teaching engine owns
  every teaching decision as structured JSON per turn**: {learner_id, concept, learner_answer, diagnosis,
  language_mode, next_strategy, mastery_status, mastery_evidence, next_question}. Luna/Terra converse; Sol on
  diagnosis/compile turns. GPT-5.6 stays central regardless of realtime model availability.
- **F37 Controlled curriculum grounding** — tutor teaches ONLY from frozen verified packs; personalizes HOW,
  never invents WHAT. No live web search mid-call, ever.
- **F38/F39 Curriculum Compiler** (build-time pipeline) — reads official Grade 6 syllabi + past-exam THEMES for
  structure/topics only; **generates ORIGINAL explanations and questions (G3 — licensing rule)**; GPT-5.6 compiles →
  verifier-agent pass → builder spot-check → freeze. Fractions stays hand-built. Fallback: flavored sandbox.
- **F52 Computed math truth** — every arithmetic check verified by code execution; the tutor never tells a child
  7×8 is 54.
- **F56 Uncertainty honesty** — "I'm not sure — let's work it out together"; hedge beats hallucination.

**Trust, proof & product surface**
- **F44 SMS recap** — post-session summary in the learner's language mode (G7); optional voice-registered parent
  number (G8).
- **F45 Mission-control dashboard** — judges' window: live transcript (their own call — §3 the mirror), per-turn
  model routing, diagnosis JSON, mastery evidence ("Needs support"→"Developing"), cost/call (F43-lite),
  **eval-results page**, sample Hinglish session recording, anonymized learner IDs (G2).
- **F46 Child-safety guardrails** — content boundaries, zero PII collection, graceful off-topic/unsafe handling;
  verified by eval; README documents deployment consent flow + retention (G2).
- **G6 Abuse guard** — per-number rate limiting + graceful disengage; jailbreak cases in eval.
- **F51 Eval harness** — simulated-learner agent × evaluator agent (both GPT-5.6 — the multi-agent story). **24 cases:**
  correct+correct-reasoning · correct+wrong-reasoning · larger-denominator misconception · Hindi-only · English-only ·
  mid-sentence switch · silence/unclear · repeat-request · disconnect · reconnect-resume · "just tell me"×2 ·
  off-topic · unsafe · jailbreak×2 (G6) · shared-phone identity×2 (G1) · placement accuracy · callback retrieval ·
  menu routing×2 · sandbox hedging · voice-math formatting · Spanish smoke-test (untuned-language claim check).
  Judged on: diagnosis correctness, language mixture,
  voice-friendly explanation, no premature answer, follow-up quality, resume state, justified mastery decision.
  **Results displayed on dashboard.**

### 4.2 STRETCH — day 4 only, strict order, never at stability's expense
1. **F4 WhatsApp voice notes** — same brain, async channel; zero latency pressure = demo insurance; Twilio WhatsApp API.
2. **F3 Missed-call callback** — hang up after one ring → server calls back; missed-call culture; ~2h webhook.
3. **F5 WhatsApp text** — accessibility completeness on the same brain.
4. **F6 Homework camera (WhatsApp)** — photo + voice explanation; executes Adesua's stated future work (citable).
5. **F59 Keypad DTMF fallback** — "Press 1, 2, or 3" when audio fails; "Press 1 to practice tomorrow."
6. **F55 Vocal-cue basics** — react to silence/monosyllables with reassurance or a step back.

### 4.3 ROADMAP — README mentions ONLY (with citations where noted; zero build time)
F2 toll-free/local numbers per country · F11 field-grade noise hardening · F15-accents · F18 more language pairs ·
F29 full grade coverage · F30 pronunciation coaching · F32 full scenario curricula (market/commerce, exam prep,
health basics) · F33-depth all-subject packs beyond Grade 6 · F43 budget enforcement caps · F49 rehearsal mode ·
F53 collaborative oral storytelling (oral-tradition alignment) · F57 teacher SMS assignments · F58 cohort insights ·
G5 proactive re-engagement nudges · deep emotional adaptation · canvas companion "act two" · workflow-embedded
tutoring pattern · living simulations from real-world observation.

### 4.4 DO NOT BUILD (binding)
Grades beyond 6 · languages beyond hi/en/hinglish · native apps · WhatsApp as PRIMARY interface · parent
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

**Codex model rule all week (Codex credits are the $100 — spend them freely on the build):** *think with the
biggest model, type with the smallest.* "Best" below = Sol if your plan has it, else Terra (equally rules-compliant).

---

### 🌙 TONIGHT — Thu Jul 16, 10 PM (≤1 hour, then SLEEP)
1. (20 min) **D0 checks above**: plan tier → ~~Codex model picker~~ ✅ → ~~API balance/credit-grant check~~ ✅ → ~~payment method + $5 prepaid API credit~~ ✅ *(auto-recharge off)* → Realtime API access.
2. (15 min) Create accounts if missing: ~~Twilio account created~~ ✅ *(onboarding/verification still in progress; paid upgrade remains deferred per D2 gate)* · ~~GitHub repo created private with MIT license~~ ✅ *([Tanya-Khanna/nomad-ai](https://github.com/Tanya-Khanna/nomad-ai))*.
3. (10 min) Tell Claude the D0 findings → routing defaults get locked to reality.
4. (5 min) Skim §1–§5 once. Then sleep — Friday is the most important day of the week.
- **Codex: not tonight.** No code before the pipe plan is confirmed against D0 findings.

### 📅 FRI Jul 17 — D1: PROVE THE PIPE (Codex: BEST model, HIGH reasoning all day — this is the novel engineering)
**Morning (~9 AM):**
- ~~Open THE main Codex session (this becomes the `/feedback` session — everything core happens here). First prompt: point it at this file + repo init + AGENTS.md + CODEX_NOTES.md skeleton.~~ ✅
- Access checks in practice: ~~first live structured-output API call to GPT-5.6 Luna~~ ✅ *(Jul 17; correct misconception diagnosis returned)*; Terra/Sol smoke checks; ~~Realtime session hello-world~~ ✅ *(Jul 17; text-only Realtime Mini selected the live `start_lesson` tool)*; voice catalog listen-through (pick the warm voice; note accent options).
- Twilio: buy US number, configure SIP trunk → OpenAI Realtime SIP connector.
**Afternoon:**
- The bridge: phone call → Twilio → SIP → Realtime → AI voice answers. G.711 8kHz confirmed.
- Measure real latency (phone-to-response). Tune VAD/barge-in settings.
- If SIP path fails by 3 PM → switch to Media Streams ↔ own WebSocket server (Codex: BEST, xhigh — this is harder).
**Evening:**
- Minimal conversation loop with prompt v0 (Socratic + Hinglish sketch). Call it from your own phone; talk to it; note everything that feels wrong.
- Commit milestones (≥3 today). CODEX_NOTES: 10 min.
- **Exit: a real phone conversation with an AI exists. Latency number written down.**
- **📦 Features landing today:** F1 zero-data dial-in · F7 GSM-native (inherited, confirmed) · F8 server-side inference · F9 G.711/SIP · F10 realtime pipeline · F12 VAD+barge-in · F15-voice (warm voice chosen, ~20% slower; persona NAME deferred to D3) · F19 accent check (catalog listen-through)

### 📅 SAT Jul 18 — D2: PROVE THE TEACHER ⛔ GO/NO-GO (Codex: BEST, XHIGH for engine/state machine; BEST for prompt & pack authoring; Luna/Spark for boilerplate)
**Morning:**
- ~~Two-layer teaching engine: Realtime sideband tool bridge → structured GPT-5.6 teaching turn → exact spoken response, with schema {learner_id, concept, learner_answer, diagnosis, language_mode, next_strategy, mastery_status, mastery_evidence, next_question}~~ ✅ *(Jul 17; deterministic integration coverage plus live Realtime Mini tool-selection proof; end-to-end phone/audio remains gated on Twilio)*; Luna/Terra↔Sol routing (or Terra-only per D0); latency choreography wiring.
- ~~Quick TEXT loop harness (pre-REPL) so all teaching iteration today is text-first (cheap).~~ ✅ *(built early as `npm run chat` / `make chat`; offline by default)*
**Afternoon:**
- Hand-build the fractions flagship pack: ~~objectives~~ ✅, micro-lessons, verified question bank (code-checked answers, F52), ~~misconception taxonomy (larger-denominator front and center), roti/paper-folding analogies~~ ✅.
- ~~Learner DB: named profiles per number (G1 "Is this Ravi?"), resume state, placement diagnostic v0.~~ ✅ *(local SQLite; caller number stored as a keyed HMAC identifier)*
- Prompts v1: ~~Socratic discipline, turn-taking, voice-math ("one-fourth" never "1/4")~~ ✅, ~~universal code-switching behavior~~ ✅ *(live GPT-5.6 Luna gate: hi-Latn+en, es+en, and fr+en all pass; the first run exposed and fixed an evidence-to-strategy mapping error)*, ~~8–10 min arc~~ ✅, ~~judgment-free tone~~ ✅.
**Evening — ⛔ THE GATE:**
- Live gate test (budget: ~6 live calls): a working Socratic fractions lesson, in Hinglish, over a real phone call, acceptable latency, **survives a mid-call disconnect and resumes**.
- **PASS → celebrate, commit, THEN upgrade Twilio to Pay-as-you-go ($20 balance — deferred until the project earned it; trial's preamble + verified-caller limits are fine for D1–D2 dev but must be gone before eval calls, video, and judges). FAIL → activate fallback (grading copilot, IDEAS.md #1, 3 days runway). No rationalizing a marginal fail.** (Note: if trial mode blocks SIP-trunk config on Friday, either use media-streams fallback during trial or upgrade a day early.)
- **📦 Features landing today:** ~~F42 two-layer architecture + hybrid routing~~ ✅ · F13/F50 preambles + latency choreography · ~~F14 drop recovery + resume machinery~~ ✅ · F21-flagship fractions pack · F23 Socratic method · ~~F16 universal code-switching (live model gate)~~ ✅ · F17/F31 concept bridging + vocabulary · F25 auditory analogies · F26/F27 micro-lessons + verbal checks · F28 short-form structure · F52 computed math truth · F40 voice-math formatting · F34 turn-taking · F35 judgment-free tone · F36 adaptive pacing · ~~G4 curriculum-configured explore → check → recap lesson arc~~ ✅ · ~~F41 learner DB + resume~~ ✅ · ~~G1 shared-phone named profiles~~ ✅ · ~~F54/F29 placement diagnostic v0~~ ✅ · F56 uncertainty honesty · F48 think-aloud diagnosis *(most are prompt-lines inside prompts v1 + pack content — that's why one day holds them)*

### 📅 SUN Jul 19 — D3: PROVE THE SCHOOL (Codex: Terra for compiler + eval harness; Luna/Spark for REPL + dashboard skeleton)
**Morning:**
- Curriculum Compiler: syllabus structure in → ORIGINAL lessons/questions out (G3 rule) → verifier-agent pass. Run for Science, English, History, Geography (Grade 6). Spot-check each pack yourself (~15 min each) → freeze.
- ~~Text-mode REPL (`make chat`) — formalize the text loop into the judges' run path.~~ ✅ *(landed early)*
**Afternoon:**
- Five-subject voice onboarding + flavored-sandbox fallbacks (experiments/anchor objects · conversation · time-machine choices · look-around prompts).
- ~~Callback loop (exact recent-drop recovery, later retrieval practice, and post-completion retrieval)~~ ✅ · voice-queryable history · shared-phone profiles polished.
- **Eval harness**: simulated-learner × evaluator agents; ~~all 25 cases (§4.1) in text mode; iterate prompts until green~~ ✅ *(deterministic offline gate; agent-based judge pass still open)*. 2–3 live smoke calls only.
**Evening:**
- Dashboard skeleton (transcript, diagnosis JSON, mastery, cost/call).
- **Decisions due today: tutor persona name + product name** (video is tomorrow; the name gets spoken aloud).
- **Exit: five subjects callable · ~~eval 25/25 green~~ ✅ · ~~REPL works~~ ✅ · dashboard skeleton live.**
- **📦 Features landing today:** F38/F39 Curriculum Compiler + G3 originality rule · F37 frozen-pack grounding (formalized) · F20 sandbox mode · F21-full five subjects + flavored fallbacks · F22 voice-menu onboarding · F24 experiments + anchor objects (pack/prompt content) · F32-flavor real-world word problems · F47 callback loop · F41-query voice-queryable history · F18 language_mode config + Spanish smoke test · F51 eval harness (25 cases) · §7.5 REPL (`make chat`) · F45-skeleton dashboard · F15-persona NAME decided (+ product name)

### 📅 MON Jul 20 — D4: PROVE IT TO JUDGES (Codex: Luna/Spark for UI/SMS/stretch; Terra if logic gets hairy; Luna for README prose)
**Morning:**
- Dashboard complete: mirror view (live call transcript), eval-results page, sample Hinglish recording + synced transcript, anonymized IDs, cost/call.
- SMS recap (language-matched) + optional parent number · per-number rate limiting.
**Afternoon — stretch bench, §4.2 order, ONLY while stable:** WhatsApp voice notes → missed-call callback → WhatsApp text → homework camera → DTMF → vocal cues. Stop the moment anything core wobbles.
**Evening — the submission package (budget ~$5 of live calls):**
- 🎬 Record the demo video (§6, all beats incl. sandbox flash + language montage — spot-check montage languages in text first). Multiple takes; pick the best; upload unlisted.
- ✍️ README (§8, all 11 sections + 2.5 + 7.5) + Devpost description + Judge Experience card with the real number. Distill CODEX_NOTES → README §6.
- **Exit: video uploaded · README done · system stable. Nothing ships tomorrow that isn't done tonight.**
- **📦 Features landing today:** F45-complete dashboard (mirror view, eval-results page, sample recording, cost/call F43-lite, anonymized IDs G2) · F44 SMS recap + G7 language-matched · G8 parent number · G6 rate limiting + graceful disengage · F46 child-safety (verified end-to-end + documented) · **stretch bench:** F4 WhatsApp voice → F3 missed-call → F5 WhatsApp text → F6 homework camera → F59 DTMF → F55 vocal cues · G9 honest-limitations + G2 consent/retention (README) · §4.3 roadmap features (README mentions)

### 📅 TUE Jul 21 — D5: SHIP (deadline 5:00 PM PT / 8:00 PM ET — builder is US-based; target noon PT regardless)
**Morning:**
- Final stability pass: 2 live verification calls ($1) · `make eval` one last time · REPL fresh-clone test (does §7.5 actually work from a clean machine?).
- Video → public on YouTube. Repo → public (MIT) or share with testing@devpost.com + build-week-event@openai.com.
- In the main Codex session: run `/feedback`, copy the Session ID.
**By noon PT:**
- Devpost form: Education category · description · video URL · repo URL · `/feedback` Session ID · Judge Experience testing instructions (phone number front and center). **SUBMIT.** Screenshot the confirmation.
**After:**
- Afternoon = buffer only. Keep phone line + dashboard live through **Aug 5** (the $4 judge reserve exists for this). Don't touch the deployed system except for outages.

**Iron rules:** live call = critical path — nothing from D3–D4 starts before the D2 gate passes · stretch never
jeopardizes stability (a flawless 6-feature demo beats a broken 20-feature one) · text-first iteration, voice for
truth · commit at every milestone · CODEX_NOTES 10 min every evening · all core work in the ONE main Codex session.

**✅ Coverage checksum (every §4.1 core feature has exactly one landing day):**
D1: F1, F7, F8, F9, F10, F12, F15-voice, F19 (8) · D2: F13/F50, F14, F16, F17/F31, F21-flagship, F23, F25, F26/F27,
F28, F34, F35, F36, F40, F41, F42, F48, F52, F54/F29, F56, G1, G4 (21) · D3: F18, F20, F21-full, F22, F24,
F32-flavor, F37, F38/F39+G3, F41-query, F45-skeleton, F47, F51, F15-persona, REPL (14) · D4: F43-lite, F44+G7,
F45-complete, F46, G2, G6, G8, G9 + stretch F3/F4/F5/F6/F55/F59 + roadmap mentions (rest) · D5: ships, adds nothing.
If a feature slips its day, it moves DOWN the stretch ladder or into the roadmap — never into Tuesday.

# 6 · DEMO VIDEO (<3 min · public YouTube · voiceover REQUIRED: what we built + how Codex + how GPT-5.6)

Record against the real system (rehearse the script, never fake the tech). No copyrighted music. English voiceover.
1. (0:00–0:15) **Mission cold open (voiceover over black, then the phone):** *"A quarter of the world has no real
   internet. Their kids' education ends where the data signal does. But almost everyone has this—"* → $15 feature
   phone fills the frame, no WiFi anywhere → dials a normal number.
2. (0:15–0:45) Onboarding menu (five subjects) → learner speaks **Hinglish, switching mid-sentence** — tutor flows.
3. (0:45–1:05) The misconception: "one-fourth is bigger because four is bigger" → tutor catches it (diagnosis JSON
   flashes on dashboard split-screen).
4. (1:05–1:25) The pivot: roti analogy instead of repetition; learner interrupts mid-sentence — tutor stops, listens.
5. (1:25–1:30) **The call DROPS.** Silence. Nothing crashes.
6. (1:30–1:35) Learner calls back.
7. (1:35–1:50) "Welcome back, Ravi — we were comparing one-third and one-fourth. You said one-fourth was larger…"
8. (1:50–2:00) Learner answers correctly → dashboard mastery flips "Needs support" → "Developing."
8.5 (2:00–2:10) **The sandbox flash (Mode 2):** off-script curiosity — "ek aur sawaal… why do stars twinkle?" —
   tutor answers with a Socratic question back. The kid who lingers after class. Any topic under the sun.
8.7 (2:10–2:22) **The language montage:** the SAME number dialed again and again — a child's question in Spanish…
   Swahili… Tamil… Portuguese… the same teacher answers in each. Fast cuts, real calls. On-screen text: *"One
   number. Any language."* (Rule: only include languages spot-checked for output quality before filming; 3–4
   languages is plenty — this proves the claim, it doesn't inventory it.)
9. (2:22–2:55) WhatsApp voice-note encore (if built) → voiceover over architecture diagram covering, in order:
   **the three audiences in one line** ("No screen, no text, no app — so it works for the 3 billion without
   internet, for learners who can't yet read, and for kids for whom text itself is the barrier") → **the global
   line** ("It already speaks dozens of languages — a new country is a config file and one compiler run on its
   syllabus. India is deployment #1, not the boundary") → **how Codex built it** (telephony bridge, compiler,
   eval harness — one main session) and **how GPT-5.6 powers it** (teaching-engine JSON, Luna/Terra/Sol routing,
   compiler, simulated-classroom QA) → judge invitation: "call the number in our README — speak any language —
   it will teach YOU" → tagline card: *"The connection may drop. The learning continues."*

# 7 · CODEX PROCESS (submission-critical — also scored under Criterion 1)

- **ONE main Codex session** for core functionality → its `/feedback` Session ID goes in the form.
- Dated commits at every milestone (required evidence of Submission-Period work).
- **CODEX_NOTES.md live during the build:** where Codex accelerated, key product/engineering decisions and who made
  them, how GPT-5.6 contributed → distilled into README §"How we built it with Codex."
- **AGENTS.md** in repo root: project context, architecture summary, build/run commands, how to run the eval suite.
- Use Codex skillfully and visibly: plan → implement → Codex code-reviews its own diffs → eval-driven iteration.
- **Budget guard:** Luna/Terra default; Sol only on diagnosis/compile turns; cost/call on dashboard; leave credit
  headroom for judges' test calls through Aug 5.

# 8 · SUBMISSION PACKAGE

**README (11 sections):**
1. Hero: product + tagline + **THE PHONE NUMBER** ("it will teach you — call it") + dashboard link + architecture diagram.
2. Why: three audiences · 63% usage-gap · 2.5–3.4B offline · ~900M feature phones · UNESCO 17M teacher shortfall ·
   Rori benchmark (~1 yr schooling gain @ ~$5/child) · rural-India voice adoption (12% MAU organic).
2.5 **Distribution & adoption path (the "who hands the child the number?" answer):** learner-direct digital
   acquisition FAILS in these markets (documented in the rural-India 2G deployment — adoption came via teachers,
   NGOs, and in-person onboarding). So the go-to-market is institution-first: (a) teachers/schools distribute the
   number and receive SMS recaps (the teacher is the trust channel, not the app store); (b) NGO/state-education
   pilots — concrete next step: one district, one grade, ~200 learners, measured on INDEPENDENT tests (the transfer
   bar), with a state education department or NGO network as partner; (c) carrier partnerships for zero-cost
   calling at scale (Viamo precedent: 22 countries). Missed-call callback + SMS keep the learner side free and
   familiar. Distribution isn't an afterthought to the product — the phone number IS distributable by a teacher
   with a chalkboard, which no app ever was.
3. What's different: five-pillar matrix vs Bakame / Viamo AVA / 1-800-ChatGPT / WhatsApp tutors / India voice apps
   (honest, sourced) + pre-emptive Q&A ("Isn't this 1-800-ChatGPT?" → answer machine vs teacher: Socratic,
   curriculum-grounded, remembers you, works where you live, speaks your mix. "Isn't this Bakame?" → English-only
   conversation practice vs all-subject curriculum-grounded teaching).
4. Research grounding: Adesua verified citation (executes its published future-work agenda; 93.75% helpfulness,
   **n=16 caveat stated honestly**) · transfer problem (+0.73 local vs +0.13 independent effect sizes; 17%-worse
   exam finding) → Nomad's context-anchored design answer · Cameroon paper (code-switching = documented open problem).
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
   - **Sample data shipped in-repo:** frozen fractions pack + one compiler-generated pack, seeded demo learner
     ("Ravi", mid-lesson state — so resume/callback behavior is testable immediately), sample call transcript.
   - Full telephony setup guide (Twilio number + SIP trunk) for complete reproduction, marked optional.
8. Safety & privacy: child-safety behavior, anonymized IDs, retention, deployment consent flow (G2).
9. **Honest limitations:** deaf/HoH excluded by voice-only (inverse of the dyslexia strength) · ASR limits under
   heavy accents/noise · Grade 6 scope · US demo number ≠ rural 2G deployment · what a real pilot must measure
   (independent-test learning outcomes — the transfer bar).
10. Roadmap (§4.3) with citations.
11. License (MIT) · credits · full source list (from NOMAD_FEATURES.md).

**Devpost description:** capability-first ("An adaptive multilingual tutor that works on any phone") → breadth
claims stated plainly and honestly: *"Ask it anything under the sun — five subjects with full curriculum depth,
everything else a genuine Socratic conversation. Speaks whatever the model speaks; validated for Hinglish; a new
country is a config profile and a compiler run."* → the 9-beat story in prose → five pillars → evidence stack →
Codex/GPT-5.6 summary → the judge invitation.

# 9 · RISK REGISTER

| Risk | Mitigation | Fallback |
|---|---|---|
| GPT-5.6 realtime variant unavailable on credits | D1 morning check | Two-layer arch: available realtime voice model + GPT-5.6 brain — still Stage-One compliant |
| **Credits are Codex-only; API runtime unfunded** (Devpost forum + OpenAI support reply, July 16) | D0 check tonight; hard API spend cap; ~$30–80 own-budget runtime reserve | Trim eval-run frequency; Luna/Terra-only routing; REPL/WhatsApp demos burn fewer realtime minutes |
| **Sol gated behind Pro plan** | Terra/Luna ARE GPT-5.6 — rules fully satisfied without Sol ("Sol is mandatory" forum claim is wrong) | Terra-only routing (already designed); README states tiering honestly ("Sol where available") |
| SIP connector unavailable/flaky | D1 check | Twilio Media Streams ↔ own WS server (more code = more Criterion-1 credit) |
| Latency reads as broken | Preambles + Socratic floor-holding + rehearsed demo conditions | WhatsApp async path shows full intelligence, zero latency pressure |
| D2 gate fails | Binary gate, Saturday evening | Grading copilot (IDEAS.md #1), 3 days runway |
| Compiler packs mediocre | Verifier pass + spot-checks; fractions hand-built regardless | Affected subjects → flavored sandbox |
| Judge's call hits an edge case | 24-case eval; rate limiting; graceful recovery everywhere | Dashboard transcript shows even failure handled gracefully |
| Credit burn | Routing discipline + cost dashboard + headroom reserve | Terra-only mode |
| Anything unfinished Tuesday | Video + README done MONDAY | Tuesday is buffer, not build |

---

*Scope authority: HACKATHON_SUBMISSION.md (43 IN · 6 stretch · roadmap · 9 audit gaps resolved — all reflected
above). Receipts: NOMAD_FEATURES.md. Provenance: 16-idea tournament, IDEAS.md. Build the pipe → pass the gate →
ship the school → let it teach the judges.* 📞
