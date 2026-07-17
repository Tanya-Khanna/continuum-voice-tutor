# Nomad AI

> The connection may drop. The learning continues.

Nomad is a multilingual Socratic tutor designed for learners who may have only a basic phone. The first build proves the teaching brain locally with a frozen Grade 6 fractions pack. OpenAI Responses and Realtime SIP integrations are kept behind adapters until API and Twilio funding are enabled.

## Run the zero-credit demo

```bash
npm install
npm run chat -- --name Ravi --phone +919999900001
```

Try: `One fourth is bigger because four is bigger than three.`

Type `exit` to simulate a dropped call. Run the same command again and Nomad resumes the saved question. The phone number is hashed before storage, and multiple names can safely share it.

Run the placement diagnostic:

```bash
npm run diagnostic
```

## Verify the build

```bash
npm run check
npm run eval
```

`npm run eval` runs the frozen 25-case teaching gate and reports misconception, answer-request, reasoning, insufficient-evidence, Hinglish, and voice-formatting results.

## Configuration

Copy `.env.example` to `.env`. The default `TEACHING_ENGINE=offline` mode requires no credentials. Local learner state is stored in `.data/nomad.db`, which is ignored by Git. Change `NOMAD_PHONE_HASH_SECRET` before any real deployment; it keys the one-way caller identifiers. Do not enable the OpenAI engine until API credits are available.

The complete product scope and schedule are in [`docs/BUILD_PLAN.md`](docs/BUILD_PLAN.md). Current decisions and progress are in [`CODEX_NOTES.md`](CODEX_NOTES.md).
