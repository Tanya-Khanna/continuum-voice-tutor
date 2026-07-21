# Production deployment contract

Continuum ships a host-neutral Node.js build and container. The deployment must
provide stable public HTTPS because OpenAI sends signed inbound-call events to
`POST /webhooks/openai`; a changing local tunnel is useful for development but
is a fragile judge endpoint.

## Verify the production artifact locally

```bash
npm ci
npm run smoke:production
```

The smoke command compiles `src` to `dist`, starts `node dist/start-production.js` with no
local `.env`, and verifies health, Mission Control authentication, SQLite access,
and ranged sample audio. It makes no OpenAI or Twilio request.

Docker is optional. Where it is available:

```bash
docker build -t continuum .
docker run --rm -p 3000:3000 --env-file .env continuum
```

The image runs as the unprivileged `node` user, includes a health check, and does
not copy `.env`, `.data`, source tests, or local dependencies into the runtime
image.

## Required host settings

- Install: `npm ci`
- Build: `npm run build`
- Start: `npm run start:prod`
- Node: 22 or newer
- Health path: `/health`
- Public port: use the host-provided `PORT`; Continuum binds `HOST=0.0.0.0` by
  default.
- HTTPS: terminate TLS at the hosting provider or reverse proxy and forward to
  Continuum over its private port.
- Webhook path: preserve `/webhooks/openai` exactly.

Use the ignored `.env` only for local development. In a hosted deployment, save
every credential and token through the provider's secret manager rather than in
the image, repository, build arguments, or deploy logs.

## Persistent learner state

The default `.data/nomad.db` path is a compatibility identifier and works in the container's writable application
directory, but container-local storage may disappear on redeploy. Attach one
persistent disk and set:

```dotenv
NOMAD_DATABASE_PATH=/data/nomad.db
```

The process user must be able to create and update that file. Use a single Continuum
server instance for this hackathon SQLite deployment; multiple replicas must not
write separate local database files. Back up the disk before a release migration
and apply the retention/deletion policy in `docs/SAFETY_PRIVACY.md` before real
learner use.

Railway mounts volumes as root. For Railway only, set `RAILWAY_RUN_UID=0`; the
checked-in production startup wrapper prepares only the configured SQLite
directory and immediately drops to the image's existing unprivileged `node`
UID/GID before loading the HTTP server. Do not use that variable with a command
that bypasses `npm run start:prod` or `dist/start-production.js`.

## Deployment validation

Before connecting Twilio:

1. Deploy a committed revision and record its commit hash.
2. Confirm `GET https://<host>/health` returns `ok: true`,
   `teachingEngine: openai`, `experience: open_topic_teacher`,
   `curriculumRequiredForCalls: false`, and `realtimeConfigured: true` without credentials.
3. Open `https://<host>/dashboard#token=<judge-token>` and confirm the fragment
   disappears while Sessions remains accessible.
4. Confirm the same dashboard URL without the token cannot read Sessions.
5. Continue with `docs/PHONE_SETUP.md`; keep the phone number private until its
   signed-delivery and carrier-behavior gates pass.

Do not set `NOMAD_OPENAI_WEBHOOK_PUBLIC=true` merely because the deployment is
reachable. That flag attests that a valid signed incoming-call event was
observed, which happens during the single controlled smoke call when every
other readiness check is green.
