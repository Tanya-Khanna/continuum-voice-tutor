# Nomad AI

> The connection may drop. The learning continues.

Nomad is a multilingual Socratic tutor designed for learners who may have only a basic phone. The first build proves the teaching brain locally with a frozen Grade 6 fractions pack. OpenAI Responses and Realtime SIP integrations are kept behind adapters until API and Twilio funding are enabled.

## Run the zero-credit demo

```bash
npm install
npm run chat
```

Try: `One fourth is bigger because four is bigger than three.`

## Verify the build

```bash
npm run check
```

## Configuration

Copy `.env.example` to `.env`. The default `TEACHING_ENGINE=offline` mode requires no credentials. Do not enable the OpenAI engine until API credits are available.

The complete product scope and schedule are in [`docs/BUILD_PLAN.md`](docs/BUILD_PLAN.md). Current decisions and progress are in [`CODEX_NOTES.md`](CODEX_NOTES.md).
