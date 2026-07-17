# NOMAD AI — Agent Guide

## Source of truth

- Read `docs/BUILD_PLAN.md` before changing product scope or architecture.
- Treat that copied plan as the current build plan. Do not rely on older chat excerpts.
- Record meaningful decisions and milestone progress in `CODEX_NOTES.md`.

## Product invariant

Nomad is a multilingual, voice-first Socratic tutor for learners who may have only a basic phone. The flagship deployment is India, but the architecture must remain country, language, and grade configurable.

## Build commands

- `npm run chat` — zero-credit local teaching demo.
- `npm test` — deterministic pedagogy and integration-boundary tests.
- `npm run typecheck` — strict TypeScript validation.
- `npm run check` — typecheck and tests.

## Engineering rules

- Keep credentials in `.env`; never commit them.
- Offline mode must remain usable without OpenAI or Twilio credits.
- Keep curriculum facts in frozen, reviewable packs instead of fetching the web during a lesson.
- Validate all model-facing inputs and outputs with Zod.
- Put telephony behind an adapter; Twilio must not leak into the teaching engine.
- Use the OpenAI Responses API for text reasoning and the Realtime API SIP flow for phone calls.
- Prefer short, speakable responses: no Markdown, no unexplained slash notation, and one question at a time.

## Teaching rules

- Diagnose the learner's misconception before choosing the next strategy.
- Ask a useful question instead of dumping an answer.
- Never shame, threaten, or compare a learner with others.
- If a learner requests an answer, preserve agency while guiding them to reason.
- Mark mastery only when the learner supplies evidence, not merely a correct guess.
- Redirect unsafe or out-of-scope requests calmly.
