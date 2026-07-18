# Safety and privacy boundary

Continuum is a hackathon prototype, not an approved child deployment. Do not invite real children to use it until a qualified local reviewer has approved the curriculum, consent flow, emergency language, access controls, and retention policy for that deployment.

## Before a supervised pilot

1. Obtain informed consent from the responsible adult or institution and age-appropriate assent from the learner.
2. Explain that an AI system will process the learner's speech, produce tutoring responses, and save limited lesson progress.
3. State who operates the phone number and server, who can view the dashboard, how long records are kept, and how deletion can be requested.
4. Use a nickname or chosen first name, never a full legal name. Do not request an address, school identifier, account credential, parent contact, or other unnecessary personal data.
5. Test the deployment's languages and local emergency wording with native speakers. Continuum does not infer a caller's language from their country.
6. Keep the mission-control dashboard private and restrict it to authorized adults. Set `NOMAD_DASHBOARD_TOKEN` before any public tunnel and share it only through the documented URL fragment; the server refuses public-webhook startup without this control. Anonymized references reduce exposure but do not make conversation transcripts anonymous, and one shared judge token is not role-based institutional access control.
7. Keep SMS homework, pause notices, progress summaries, and schedules disabled unless the caller or responsible adult explicitly consents to learning content appearing on that exact phone. Treat shared phones and lock-screen previews as disclosure risks; do not assume the learner is the sole recipient.

> Continuum remembers what helps a learner learn and forgets what it does not need.

## Data currently stored

- A keyed HMAC of the caller number. The raw caller number is not written to SQLite.
- The learner's chosen name or nickname so multiple learners can share a phone.
- Curriculum concept, exact pending question, session status, diagnoses, strategy, evidence, language mode, model route, redacted learner text, and Continuum's spoken text. Raw call audio is not stored by Continuum, and the Twilio trunk is configured not to record calls.
- Structured teaching feedback, homework status, review schedule, Curiosity Trails, and only those goals, interests, aspirations, examples, activities, pace, or grade details the learner explicitly approved for educational use.
- Salted, one-way learner and guardian access-code records. Raw six-digit codes cannot be recovered from SQLite.
- Missed-call callback destinations are stored only in an authenticated encrypted envelope while the job is pending. Logs and metric events use phone hashes rather than raw numbers.
- At most one pack-reviewed generic physical anchor name per guided session, such as `paper` or `leaf`. Unreviewed model output, owners, brands, and locations are not accepted into this field.
- Likely email addresses, links, long phone-like numbers, and explicit address phrases are redacted before model processing and persistence. Pattern redaction is defense in depth, not a guarantee that every possible identifier will be recognized.

OpenAI Responses requests use `store: false` and a one-way safety identifier. The local SQLite database remains on the operator's machine. The application does not send live lesson content to web search.

Optional Twilio messaging sends reviewed one-segment homework, pause notices, missed-lesson reminders, and requested guardian controls only to an authorized number. Homework replies use a short assignment code bound to that recipient and are MessageSid-idempotent. Sandbox and safety-forced endings do not issue homework. Twilio necessarily receives the destination, sender, and message body when messaging is enabled; provider-side records and retention must be included in the deployment's consent and deletion policy.

## Retention

The prototype currently retains the local SQLite lesson database until the learner or guardian completes the two-step deletion control, or the operator deletes it. Deletion removes the learner profile and dependent educational state and cancels future schedules; minimal de-identified SMS processing receipts may retain the fact that a profile was deleted so provider retries remain idempotent. This is acceptable only for synthetic development data. Before any real pilot, configure and enforce a time-based retention period, provider deletion procedure, backup policy, and access audit appropriate to local law and institutional policy.

## Safety behavior

- Learner speech is treated as untrusted content and cannot override system instructions, the structured schema, or the frozen curriculum.
- Benign off-topic requests are acknowledged briefly and redirected to the pending lesson question.
- Unsafe, sexual, violent, illegal, self-harm, and immediate-danger content receives a short refusal and an age-appropriate trusted-adult or local-emergency redirect where relevant.
- Repeated unsafe or prompt-injection turns end the lesson gracefully instead of consuming unlimited model or phone resources.
- Academic struggle can suggest asking a guardian, teacher, or facilitator, but it never silently contacts another person. Immediate danger, high-stakes health/legal/crisis questions, and curriculum uncertainty use distinct structured decisions and deployment-specific human protocols.
- Continuum may connect an approved aspiration to lesson relevance, but it may not infer aspirations, promise career outcomes, manufacture dependency, or present itself as a friend, parent, therapist, or replacement for a teacher.
- These controls support supervised tutoring; they are not emergency services, content-moderation certification, or a substitute for a responsible adult.
