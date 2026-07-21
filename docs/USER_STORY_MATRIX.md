# Continuum v6 user-story proof matrix

This is the release ledger for the 32 user stories in `docs/BUILD_PLAN.md`. “Automated” means deterministic repository proof. “Carrier” means a real phone/SMS check is still required before the public claim.

| Story | Automated proof | Carrier/release gate |
|---|---|---|
| US-01 missed-call callback | `missed-call-callback.test.ts`: signed webhook, first-verb Reject, dedupe, encrypted destination, outbound SIP | Place one live missed call and preserve the callback CallSid/status receipt |
| US-02 3/5/10-minute lesson | `learning-evidence.test.ts`: trusted duration-specific activity targets; SQLite persistence | Speak each choice once over the carrier |
| US-03 voice-native activities | `activity-renderer.test.ts`: every activity kind renders speech, DTMF support state, SMS support state, and PII-free proof | Listen for short one-question delivery |
| US-04 method switch | `learning-evidence.test.ts`: not-helpful blocks strategy repetition | Golden misconception call |
| US-05 learner feedback | `realtime-teaching-bridge.test.ts`: speech and DTMF persist without advancing | Say no and press 2 in separate calls |
| US-06 feedback affects teaching | `learning-evidence.test.ts`: future strategy differs and records reason | Golden two-method journey |
| US-07 consented interests/aspirations | `classroom.test.ts`, `learning-evidence.test.ts`: consent, storage, inspection boundary | Voice consent phrasing |
| US-08 safe motivation | `classroom.test.ts`: dependency and career-guarantee copy rejected | One adversarial live prompt |
| US-09 Curiosity Trail | `sandbox.test.ts`: learner-approved multi-turn trail persists | Ask and approve one trail |
| US-10 no curiosity mastery | `sandbox.test.ts`: formal mastery unchanged | Dashboard inspection |
| US-11 five subjects | Five-pack release gate validates Math, Science, English, History, and Geography plus all digest-bound receipts | Verify the five configured subjects on the deployed carrier menu |
| US-12 non-shaming placement | placement and voice/eval tests | One adult carrier placement in each published subject |
| US-13 guesses are not mastery | `classroom.test.ts`, `learning-evidence.test.ts` | Reviewed transfer call |
| US-14 same-phone drop resume | `lesson-service.test.ts`: atomic prompt plus recovery metric | Drop, pause SMS, redial |
| US-15 cross-phone resume | `portable-identity.test.ts`: same learner/session plus metric | Two real phones and DTMF code |
| US-16 sibling privacy | shared-phone lesson/history/guardian tests | Two synthetic adult profiles on one phone |
| US-17 keypad fallback | Realtime DTMF routing tests; reviewed pack choices | `*`, choice, and invalid choice over carrier |
| US-18 honest keypad scoring | `learning-evidence.test.ts`: DTMF independent=false and never secure | Dashboard inspection |
| US-19 SMS homework | `homework.test.ts`: one segment, phone binding, MessageSid idempotency, correct learner evidence | Send and reply on Twilio |
| US-20 recurring schedule | `study-plan-scheduler.test.ts`: consent, due lock, single dial, next slot; signed duration relay into SIP | Live scheduled call and retention opening |
| US-21 no repeated missed call | scheduler single-slot tests; idempotent Twilio lifecycle receipts; one no-answer SMS; no application retry; duration/price reconciliation | Capture one live no-answer receipt and confirm no redial |
| US-22 low-literacy guardian | Realtime guardian DTMF tests for progress, time, pause/resume, deletion | Full guardian menu over carrier |
| US-23 inspect memory | SMS and guardian summary tests | SMS plus voice readback |
| US-24 delete profile | SMS and guardian two-step deletion tests; cascading state removal | Synthetic live profile only |
| US-25 learner reflection | `learning-evidence.test.ts`: transfer → reflection → recap | Complete one golden lesson |
| US-26 human-help decision | `support-and-metrics.test.ts`: academic, accommodation, curriculum, safety states | No real escalation network is claimed |
| US-27 no silent reporting | contracts expose decisions only; no outbound educator/human contact path | Review deployment protocol before pilot |
| US-28 educators complement | `support-and-metrics.test.ts`: dual authorization and conversation-free summary | Synthetic example only |
| US-29 language/code-switching | deterministic and paid text gates; universal typed contract | English, Hindi-English, Spanish-English, French-English adult carrier matrix |
| US-30 local relevance | frozen reviewed anchors; trusted learner-confirmation check | Native-speaker spot-check |
| US-31 unclear audio | Realtime recovery tests: no model request or state advance | Clipped/noisy carrier test |
| US-32 judge validation | offline REPL, protected dashboard Outcomes tab, access/reliability/learning/cost receipts, evals, `verify:fresh` | Five consecutive golden calls and final clean-clone run |

## Required commands

```bash
npm run check
npm run eval
npm run verify:fresh
npm run curriculum:release:check
npm run release:preflight -- --base-url https://continuum-production-8971.up.railway.app
```

The current automated suite is the engineering gate, not a substitute for the carrier matrix, curriculum human review, a child-safety review, or real-world learning-outcome evidence. The final human sequence and private sign-off receipt are in `docs/FINAL_ACCEPTANCE_RUNBOOK.md`.
