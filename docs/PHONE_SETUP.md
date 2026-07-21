# Real-phone setup and release gate

This is the operator path from the local Continuum build to one controlled inbound
phone call. It keeps configuration proof separate from carrier-behavior proof
and never requires a secret to appear in a screenshot, issue, chat, or shell
argument.

The local readiness command currently reports only safe booleans:

```bash
npm run secrets:init
npm run phone:preflight
```

Do not commit `.env`. Edit that ignored file privately, keep it owner-readable
only, and never paste `OPENAI_API_KEY`, `OPENAI_WEBHOOK_SECRET`,
`TWILIO_AUTH_TOKEN`, or the dashboard token into a log or recording.

## 1. Put the current server on stable public HTTPS

Use the host-neutral [production deployment contract](DEPLOYMENT.md) to deploy
the committed server, or expose it through a stable HTTPS tunnel, without
changing these paths:

- `GET /health`
- `POST /webhooks/openai`
- `GET /dashboard`

After the OpenAI values below are configured, `/health` should report an `ok`
status, the OpenAI teaching engine, and configured Realtime without exposing any
credential. Keep `NOMAD_OPENAI_WEBHOOK_PUBLIC=false` until a valid signed
`realtime.call.incoming` delivery has actually reached Continuum.

The dashboard token has already been initialized safely by `npm run
secrets:init`; give a judge only the fragment form
`https://<host>/dashboard#token=<token>` after deployment.

## 2. Connect the OpenAI project

Sign in to the same OpenAI Platform project that owns the restricted API key.

1. In **Project > General**, copy the project ID beginning with `proj_` into
   `OPENAI_PROJECT_ID`.
2. In **Project > Webhooks**, create a webhook named `Continuum Realtime incoming`.
3. Set its endpoint to `https://<stable-host>/webhooks/openai`.
4. Subscribe only to `realtime.call.incoming`.
5. Copy the signing secret shown during creation into
   `OPENAI_WEBHOOK_SECRET`. Treat it like a password.

Continuum passes the untouched raw request body and headers to the official OpenAI
SDK's `webhooks.unwrap` method. An invalid signature is rejected before call
admission or learner state is opened.

The restricted key needs **Responses: Request/Write** for the teaching engine
and **Realtime: Request** for the phone layer. Continuum does not need Assistants,
Files, Images, Fine-tuning, or unrelated project permissions for this path.

OpenAI's official [Realtime SIP guide](https://developers.openai.com/api/docs/guides/realtime-sip)
documents the project ID, webhook event, SIP target, accept endpoint, and
sideband connection. Its [webhook guide](https://developers.openai.com/api/docs/guides/webhooks)
documents SDK signature verification against the raw body.

## 3. Connect OpenAI SIP and the single Twilio number

Buying or upgrading a number is a paid external action; complete it in the
Twilio Console only when ready.

1. Save the Account SID beginning with `AC` as `TWILIO_ACCOUNT_SID` and save the
   auth token as `TWILIO_AUTH_TOKEN`.
2. Buy or assign one voice-capable number and save it in E.164 form, for example
   `+14155550100`, as `TWILIO_PHONE_NUMBER`.
3. In **Elastic SIP Trunking > Trunks**, create a trunk named `Continuum OpenAI`.
4. Under **Origination**, add exactly:

   ```text
   sip:proj_YOUR_PROJECT_ID@sip.api.openai.com;transport=tls
   ```

   Replace the placeholder with the `proj_` value from OpenAI. Use `sip:` with
   `;transport=tls`, not `sips:`. Default priority and weight are sufficient for
   this single target.
5. Leave recording at **Do Not Record**.
6. Use the trunk association only for the first direct-call SIP smoke test. Once
   signed OpenAI delivery is proven, remove the number from the trunk and switch
   it to the callback-only routing below.

### Hackathon single-number callback mode

Continuum does not require a second paid number. The one owned number performs
three jobs:

- An incoming voice call posts to
  `https://YOUR_HOST/webhooks/twilio/missed-call`, receives `<Reject
  reason="busy">`, and is not answered.
- The application creates an outbound call from the same number to the caller
  and bridges that call to the OpenAI SIP target with inline TwiML.
- Incoming SMS posts to `https://YOUR_HOST/webhooks/twilio/sms`; outbound
  practice, pause notices, and one-time reminders use the same number as sender.

In **Phone Numbers > Manage > Active numbers**, configure the number with:

```text
Voice webhook (HTTP POST): https://YOUR_HOST/webhooks/twilio/missed-call
Messaging webhook (HTTP POST): https://YOUR_HOST/webhooks/twilio/sms
```

Remove the number from the Elastic SIP trunk before setting the Voice webhook;
the trunk itself and its OpenAI origination URI may remain configured. Direct
answered inbound tutoring is disabled in this mode. Outbound callbacks use the
Programmable Voice Calls API and inline `<Dial><Sip>`
TwiML, so the same owned number can remain their caller ID.

Enable these only after the public deployment is healthy and the two webhook
URLs are configured:

```dotenv
NOMAD_MISSED_CALL_ENABLED=true
NOMAD_MISSED_CALL_ADULT_DEMO=true
NOMAD_SMS_CONTROLS_ENABLED=true
NOMAD_SMS_RECAP_ENABLED=true
NOMAD_SMS_REMINDERS_ENABLED=true
```

The adult-demo switch creates a private hackathon test surface for adult judges
across time zones, so it suspends the deployment quiet-hours gate. Never enable
it for a child deployment; with the switch off, guardian enrollment and quiet
hours both remain enforced.

Every callback call supplies a signed Twilio status-callback URL for
`initiated`, `ringing`, `answered`, and `completed` events. Continuum stores the
highest sequence number so late/out-of-order webhooks cannot regress state. On a
terminal event it records seconds, reconciles the eventually consistent Call
resource for connectivity price, and retries that reconciliation in the
background. The product does not schedule recurring tutoring calls or create an
immediate application redial. Outbound SMS also
uses a status callback and records segment count plus delivered/failed state.

The callback and SMS paths use:

```text
POST https://YOUR_HOST/webhooks/twilio/call-status?receipt_id=OPAQUE_ID
POST https://YOUR_HOST/webhooks/twilio/message-status
```

Both endpoints validate `X-Twilio-Signature` against the exact public URL and
form body before changing state. Twilio Call prices can be temporarily null, so
the first dashboard view may show duration before cost.

Set these attestations to `true` only after the corresponding Console save
succeeds:

```dotenv
NOMAD_TWILIO_NUMBER_VOICE_READY=true
NOMAD_TWILIO_SIP_TRUNK_CONFIGURED=true
```

Twilio's official [Elastic SIP Trunking documentation](https://www.twilio.com/docs/sip-trunking)
defines origination as routing incoming PSTN calls and documents the TLS URI
form. Twilio's [OpenAI Realtime connector tutorial](https://www.twilio.com/en-us/blog/developers/tutorials/product/openai-realtime-api-elastic-sip-trunking)
shows the same OpenAI webhook, origination URI, and number-association sequence.

## 4. Make exactly one controlled smoke call at 10/11

Run:

```bash
npm run phone:preflight
```

The command allows a smoke call only when it reports **10/11** and the sole open
check is **Signed webhook reachable over public HTTPS**. That exception exists
because signed inbound delivery cannot be proven before the first SIP call.

Use a clearly synthetic adult profile for one call. Success means all three are
observable:

- the server prints `Verified signed realtime.call.incoming webhook` rather
  than a signature error;
- Continuum answers the carrier call;
- the synthetic session appears in Mission Control.

Only after that signed delivery is observed, set:

```dotenv
NOMAD_OPENAI_WEBHOOK_PUBLIC=true
```

Rerun preflight. It must report **11/11** before wider carrier testing. Do not
publish the number merely because configuration reached 11/11.

## 5. Pass the carrier-behavior release gate

On real calls, record the deployed commit and verify:

- understandable G.711 audio in both directions;
- measured mouth-to-ear response latency;
- barge-in interrupts Continuum cleanly;
- unclear audio restores the pending prompt without advancing lesson state;
- missed-call access rejects the inbound call before answer and creates exactly one callback;
- language selection is first, identity requires separate name and code-status turns, and no subject, grade, mode, or duration menu appears;
- DTMF identity, current-choice answer, feedback, repeat, and hint mappings advance only the valid stage;
- hang-up and redial with the same name resumes the exact question;
- a second phone with the learner code resumes the same pending question;
- pause and micro-practice SMS arrive once and signed replies update the correct learner;
- a consented one-time reminder respects quiet hours and `STOP` cancels it before send;
- shared-phone learner profiles preserve sibling privacy;
- a completed open-topic call appears in Mission Control with diagnosis basis,
  trusted phase, policy checks, evidence, and usage recorded.

Publish the number or record the final live-call demo only after these checks
pass. Record the deployed commit and results in a private release receipt based
on `submission/release-input.example.json`; do not commit the completed copy. A local REPL, browser audio, or successful
11/11 configuration is not a substitute for carrier proof.

## Troubleshooting

| Symptom | Check |
|---|---|
| No incoming webhook | Confirm the public HTTPS URL, OpenAI project, exact `proj_` SIP URI, and Twilio number association. |
| Signature rejection | Confirm the webhook belongs to the same project and that `OPENAI_WEBHOOK_SECRET` is the creation-time signing secret. Do not parse or rewrite the raw body upstream. |
| Call declined or busy | Check the server admission logs, active-call limit, and per-caller hourly limit before retrying. |
| Call answers but no session appears | Complete language, name, and learner-code status; then ask a topic and check the authenticated Mission Control Sessions tab. |
| Audio is clipped or interruptions fail | Keep the number private and tune the provisional VAD settings only from measured carrier calls. |
