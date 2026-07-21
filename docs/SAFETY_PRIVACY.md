# Safety and privacy boundary

Continuum is a hackathon prototype, not an approved child deployment. Public testing must use synthetic adult participants. Do not invite real children until a qualified local team has approved consent, language, retention, access, incident, and human-support procedures.

## Current technical controls

- OpenAI and Twilio webhook signatures are verified before state changes.
- Provider retries are idempotent; duplicate or stale events cannot advance a lesson twice.
- The application stores a keyed phone hash, not the raw caller number.
- Portable learner and guardian codes are one-way protected and rate-limited.
- Pending callback destinations use authenticated encryption and are retained only as required for the job.
- Likely email addresses, URLs, phone numbers, and explicit street-address phrases are redacted before model input and persistence.
- OpenAI Responses requests use `store: false` and a one-way safety identifier.
- Raw call audio is not recorded by Continuum. Twilio recording must remain disabled.
- Model requests and Structured Outputs are Zod-validated; trusted semantic policy runs after schema validation.
- Mission Control requires a strong token and returns anonymized learner references, not names, phone numbers, phone hashes, secrets, or hidden chain-of-thought.
- Shared-phone learners have separate profiles. A caller is not greeted with another learner's name before identity is established.
- SMS actions require a guardian code bound to the exact receiving phone. `MessageSid` idempotency prevents retry duplication.
- One-time reminders require a separately confirmed proposal, authorization, quiet-hour checks, and can be cancelled by `STOP` before delivery.
- Profile deletion uses a two-step confirmation and cancels future contact.

Pattern redaction and token authentication are defense in depth, not guarantees. A single dashboard token is not role-based institutional access control.

## Selective educational memory

> Continuum remembers what helps a learner learn and forgets what it does not need.

The current application may retain:

- Chosen first name or nickname and selected language.
- Current topic, learning objective, and exact pending question.
- Learner response after PII redaction.
- Supported obstacle or misconception and its evidence basis.
- Teaching methods attempted, learner feedback, hints, teach-back, transfer, reflection, and understanding state.
- Explicitly approved example, activity, pace, or learning-goal preferences.
- Authorization, idempotency receipts, provider usage, and de-identified reliability events.

It does not intentionally retain:

- Raw call recordings or background audio.
- Full legal identity, precise location, school identifier, credential, or account data.
- Unnecessary personal stories or unrelated sensitive disclosures.
- Inferred caste, religion, economic status, family profile, mental-health profile, or personality assessment.
- Hidden model chain-of-thought.

The SQLite schema still understands selected legacy fields so an existing database can migrate without data loss. Retired curriculum, placement, curiosity-mode, and recurring-schedule features are not reachable in the current runtime.

## Safety and human-support behavior

Learner text and speech are untrusted content. Prompt injection cannot change the schema, trusted stage, evidence type, authorization, or safety policy.

- Benign requests enter open-topic teaching.
- Ambiguous requests receive one clarifying question.
- Current, disputed, or unverifiable claims require explicit uncertainty and cannot produce secure understanding.
- Medical, legal, financial, crisis, abuse, immediate-danger, and operationally harmful requests receive a brief age-appropriate boundary and a suggestion to involve an appropriate trusted or qualified human.
- Academic difficulty may suggest a teacher or guardian after several distinct methods fail, but it never silently reports the learner.
- Continuum never presents itself as a friend, parent, therapist, romantic companion, only source of support, or replacement for a human teacher.
- It rejects secrecy, exclusivity, dependency, shame, threats, comparisons, and career guarantees.

The hackathon build selects and tests a structured human-support decision. It does not claim to operate a live escalation network or emergency service.

## Shared-phone and SMS risks

Authorization does not make a shared phone private. A recap, reminder, progress summary, or practice question may be visible in lock-screen previews or to another family member. Before enabling SMS:

1. Obtain explicit permission for learning content on that exact number.
2. Explain what message types can arrive and how to send `STOP`.
3. Use short, neutral wording that avoids sensitive lesson details.
4. Test deletion and consent revocation on the deployed revision.
5. Include Twilio's provider-side records and retention in the privacy notice.

## Retention

The prototype retains its local SQLite database until an authorized deletion completes or the operator removes the synthetic environment. Minimal de-identified processing receipts may preserve that a deletion or provider event was handled so a retry remains idempotent.

This is acceptable only for synthetic development data. Before a real pilot, define and enforce:

- A time-based retention schedule.
- Backup encryption and deletion.
- OpenAI and Twilio provider-data procedures.
- Role-based access and audit logs.
- Legal basis, consent withdrawal, export, correction, and deletion processes.
- Incident response and breach notification.
- Local child-safeguarding and mandatory-reporting responsibilities.

## Before any supervised pilot

1. Obtain informed guardian/institutional consent and age-appropriate learner assent.
2. Explain AI processing, limited memory, SMS disclosure, cost, and human-support boundaries in the learner's language.
3. Use a nickname, never require a legal identity.
4. Test carrier speech, DTMF, accessibility, and safety wording with adult native speakers first.
5. Establish qualified local safeguarding and escalation protocols.
6. Configure sponsorship or toll-free access without claiming every call is free.
7. Keep Mission Control private and replace the single-token prototype with appropriate roles.
8. Complete legal, security, privacy, accessibility, and educational review.
9. Measure access and learning honestly; do not generalize synthetic eval results to children or real outcomes.
