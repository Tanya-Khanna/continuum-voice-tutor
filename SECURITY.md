# Security policy

Continuum is a hackathon prototype and is not approved for unsupervised child deployment.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting for this repository. Do not open a public issue containing a secret, private phone number, learner content, or an exploitable production endpoint. Include the affected revision, a minimal reproduction, impact, and any suggested mitigation.

## Supported version

Only the latest revision on `main` is supported. Historical curriculum and scheduler implementations in Git history are not supported runtime surfaces.

## Operator responsibilities

- Rotate any credential that is exposed, even briefly.
- Keep Mission Control behind a strong `NOMAD_DASHBOARD_TOKEN` and private network controls where possible.
- Validate OpenAI and Twilio webhook signatures before changing state.
- Use synthetic adult test data. Do not record real children or commit transcripts.
- Configure consent, retention, provider deletion, quiet hours, local safety language, and human escalation before any supervised pilot.
- Keep the public phone number gated until the carrier acceptance matrix passes on the deployed revision.

See [docs/SAFETY_PRIVACY.md](docs/SAFETY_PRIVACY.md) for product boundaries and pre-pilot requirements.
