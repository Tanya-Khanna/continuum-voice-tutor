# Safety and privacy boundary

Nomad is a hackathon prototype, not an approved child deployment. Do not invite real children to use it until a qualified local reviewer has approved the curriculum, consent flow, emergency language, access controls, and retention policy for that deployment.

## Before a supervised pilot

1. Obtain informed consent from the responsible adult or institution and age-appropriate assent from the learner.
2. Explain that an AI system will process the learner's speech, produce tutoring responses, and save limited lesson progress.
3. State who operates the phone number and server, who can view the dashboard, how long records are kept, and how deletion can be requested.
4. Use a nickname or chosen first name, never a full legal name. Do not request an address, school identifier, account credential, parent contact, or other unnecessary personal data.
5. Test the deployment's languages and local emergency wording with native speakers. Nomad does not infer a caller's language from their country.
6. Keep the mission-control dashboard private and restrict it to authorized adults. Anonymized references reduce exposure but do not make conversation transcripts anonymous.
7. Keep SMS recaps disabled unless the caller or responsible adult explicitly consents to lesson content appearing on that exact phone. Treat shared phones and lock-screen previews as disclosure risks; do not assume the learner is the sole recipient.

## Data currently stored

- A keyed HMAC of the caller number. The raw caller number is not written to SQLite.
- The learner's chosen name or nickname so multiple learners can share a phone.
- Curriculum concept, session status, diagnoses, mastery evidence, language mode, model route, learner answers, and Nomad's spoken responses.
- At most one pack-reviewed generic physical anchor name per guided session, such as `paper` or `leaf`. Unreviewed model output, owners, brands, and locations are not accepted into this field.
- Likely email addresses, links, long phone-like numbers, and explicit address phrases are redacted before model processing and persistence. Pattern redaction is defense in depth, not a guarantee that every possible identifier will be recognized.

OpenAI Responses requests use `store: false` and a one-way safety identifier. The local SQLite database remains on the operator's machine. The application does not send live lesson content to web search.

Optional Twilio SMS recaps reuse the final language-matched guided-lesson recap and send it only to the originating caller number. They are disabled by default, never run for Sandbox or safety-forced endings, and are not written to a separate local message log. Twilio necessarily receives the destination, sender, and message body when the feature is enabled; provider-side messaging records and retention must be included in the deployment's consent and deletion policy.

## Retention

The prototype currently retains the local SQLite lesson database until the operator deletes it. That is acceptable only for synthetic development data. Before any real pilot, configure and enforce a documented retention period, deletion-request process, backup policy, and access audit appropriate to local law and institutional policy. Do not rely on the current local default as a production retention policy.

## Safety behavior

- Learner speech is treated as untrusted content and cannot override system instructions, the structured schema, or the frozen curriculum.
- Benign off-topic requests are acknowledged briefly and redirected to the pending lesson question.
- Unsafe, sexual, violent, illegal, self-harm, and immediate-danger content receives a short refusal and an age-appropriate trusted-adult or local-emergency redirect where relevant.
- Repeated unsafe or prompt-injection turns end the lesson gracefully instead of consuming unlimited model or phone resources.
- These controls support supervised tutoring; they are not emergency services, content moderation certification, or a substitute for a responsible adult.
