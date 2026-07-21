# Contributing

Continuum is a safety-sensitive teaching system. Small, reviewable changes with evidence are preferred over broad feature additions.

## Development setup

Use Node.js 22 and npm 10.9.3. Install exactly from the lockfile:

```bash
npm ci
cp .env.example .env
npm run verify
```

The default `TEACHING_ENGINE=offline` path uses no OpenAI or Twilio credit. Live calls and model evaluations are opt-in and may incur provider charges.

## Pull requests

- Keep credentials, phone numbers, learner data, recordings, transcripts, databases, and completed release receipts out of Git.
- Add deterministic coverage for changed controller, persistence, privacy, safety, SMS, or telephony behavior.
- Keep model-facing inputs and outputs Zod-validated.
- Keep Twilio behind adapters and probabilistic model output behind trusted application policy.
- Preserve one-question, voice-native teaching and evidence-based mastery rules.
- Run `npm run verify:fresh` before requesting review.
- Describe any paid or manual carrier verification separately; never present a local simulation as live proof.

Please use GitHub issues for reproducible bugs and proposals. Do not include production credentials, real learner conversations, or private phone numbers in an issue.
