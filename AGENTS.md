# CONTINUUM — Agent Guide

## Source of truth

- Read `README.md`, this guide, and the current implementation before changing product scope or architecture.
- The submitted product is the open-topic phone teacher documented in the README. Historical plans and implementations in Git history are context, not runtime authority.

## Product invariant

Continuum is a multilingual, voice-first Socratic tutor for learners who may have only a basic phone. It has one open teaching experience: after language and identity, it asks what the learner wants to learn. It is not a subject menu, LMS, fixed curriculum, or companion.

India, fractions, and Hindi/English code-switching may appear only in deployment configuration, fixtures, evals, or demo defaults. Core domain, teaching, persistence, and model-adapter modules must not contain country, subject, concept, grade, or closed-language assumptions.

## Build commands

- `npm run chat` — zero-credit local teaching demo.
- `npm run eval` — 39-case deterministic teaching quality gate.
- `npm test` — deterministic pedagogy and integration-boundary tests.
- `npm run typecheck` — strict TypeScript validation.
- `npm run check` — typecheck and automated tests.
- `npm run verify` — formatting hygiene, lint, tests, evaluations, build, and production smoke.
- `npm run verify:fresh` — clean exported-tree install and release verification.

## Engineering rules

- Keep credentials in `.env`; never commit them.
- Offline mode must remain usable without OpenAI or Twilio credits.
- Do not require curriculum packs, a subject catalog, grade placement, Guided mode, or Curious Sandbox to begin a lesson.
- Generate a validated open-topic plan for the learner's request. Apply explicit uncertainty, factuality, and high-stakes policies; optional server-side grounding must never become a learner internet requirement.
- Validate all model-facing inputs and outputs with Zod.
- Put telephony behind an adapter; Twilio must not leak into the teaching engine.
- Use the OpenAI Responses API for text reasoning and the Realtime API SIP flow for phone calls.
- Prefer short, speakable responses: no Markdown, no unexplained slash notation, and one question at a time.

## Teaching rules

- Diagnose the learner's misconception before choosing the next strategy.
- Ask a useful question instead of dumping an answer.
- Teaching must not become withholding: explain clearly or model a step when the learner lacks the prerequisite or cannot begin.
- Change methods when the first method does not help; never repeat it silently.
- Never shame, threaten, or compare a learner with others.
- If a learner requests an answer, preserve agency while guiding them to reason.
- Mark mastery only when the learner supplies evidence, not merely a correct guess.
- Cap keypad-only evidence at developing; secure understanding requires explanation, novel transfer, or later retention.
- Redirect unsafe or out-of-scope requests calmly.
