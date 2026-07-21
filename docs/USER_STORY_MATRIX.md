# Current user-story proof matrix

This matrix describes the submitted open-topic phone teacher. Retired subject menus, curriculum packs, placement, recurring lesson calls, and guardian voice menus are not current features.

| ID | User story | Deterministic proof | External proof still required |
|---|---|---|---|
| US-01 | I hear language selection before any English identity question. | `voice-language-menu`, `open-topic-realtime-bridge`, deterministic eval | Adult-speaker carrier call for every claimed language pattern |
| US-02 | Silence, noise, or my name cannot select a language or topic. | Realtime bridge and language-menu regression tests | Noisy-line carrier smoke |
| US-03 | I can name an unlisted language after pressing `*`. | Stage-gated DTMF/controller tests | One configured adult-speaker carrier example |
| US-04 | My name and learner-code answer are separate turns. | Realtime bridge tests | New-learner carrier journey |
| US-05 | I can ask to learn any safe topic without choosing a subject or grade. | Open-topic service tests and `contract-open-prompt` eval | GPT live cases on unrelated topics |
| US-06 | The teacher finds out what I understand before claiming a misconception. | Diagnosis-basis and first-request evals | GPT live open-response journey |
| US-07 | I receive one short, speakable question at a time. | Voice policy tests/evals | Carrier intelligibility and latency |
| US-08 | A failed explanation causes a genuinely different method. | Method-switch service test and eval | GPT live feedback journey |
| US-09 | I can say or press whether an explanation helped. | Realtime feedback and persistence tests | DTMF carrier feedback |
| US-10 | A guess or keypad answer cannot become secure understanding. | Mastery and DTMF evals | One live keypad learning check |
| US-11 | Teach-back, novel transfer, and reflection produce distinct evidence. | Phase/evidence service tests and evals | Complete GPT live lesson arc |
| US-12 | `0`, `9`, and `*` repeat, hint, and request keypad fallback only in a lesson. | DTMF bridge tests | Carrier keypad matrix |
| US-13 | Unclear audio repeats the exact pending prompt without changing evidence. | Realtime recovery tests and eval | Bad-line/noise smoke |
| US-14 | Interrupting speech cancels unplayed audio and stale actions. | Response-ID and DTMF bridge tests | Carrier barge-in smoke |
| US-15 | My lesson survives a dropped call. | Atomic checkpoint, persistence, and exact-resume eval | Hang-up/redial carrier journey |
| US-16 | My portable six-digit code resumes from another phone. | Portable identity and cross-phone tests | Two-phone carrier journey |
| US-17 | Siblings sharing one number keep separate profiles. | Identity/persistence isolation tests | Synthetic shared-phone journey |
| US-18 | The system stores only useful, permitted learning memory. | Consent and privacy tests/evals | Mission Control inspection |
| US-19 | PII is redacted before model input and storage. | Privacy tests and eval | Redacted live trace inspection |
| US-20 | I can receive one authorized practice SMS and reply asynchronously. | Homework, SMS, signature, idempotency tests | Real SMS delivery/reply |
| US-21 | A dropped-call notice arrives only when the exact phone is authorized. | Pause-SMS authorization tests | Real drop/SMS journey |
| US-22 | One-time reminders require an explicit request and separate confirmation. | Reminder proposal/consent/locking tests | Real reminder delivery |
| US-23 | `STOP` immediately cancels future proactive messages. | SMS/reminder cancellation tests | Real Twilio `STOP` journey |
| US-24 | I can inspect memory and delete a profile with confirmation. | SMS authorization/deletion tests | Synthetic deployed deletion |
| US-25 | A missed call creates one bounded callback without answering the inbound leg. | Signed webhook, `<Reject>`, dedupe, limits tests | Real carrier billing/callback behavior |
| US-26 | Duplicate and out-of-order provider events cannot regress state. | Callback, carrier-receipt, webhook tests | Deployed status-event inspection |
| US-27 | High-stakes, unsafe, and disputed topics fail to a human/uncertainty boundary. | Safety/injection/evidence evals | Revision-bound GPT live safety cases |
| US-28 | Ordinary academic struggle is not silently reported. | Human-support decision tests | Policy review before pilot |
| US-29 | Mission Control exposes teaching proof without learner identity or secrets. | Dashboard/access/privacy tests and production smoke | Authenticated deployed inspection |
| US-30 | A clean machine can install, verify, and reproduce exact resume without credentials. | `npm run verify:fresh` | Independent GitHub Actions run |

The current deterministic release evidence is 29 test files/122 tests plus 39 teaching, safety, privacy, continuity, and product-contract evaluations. Paid GPT, browser, and carrier results are recorded separately and must be tied to the exact deployed revision.
