# Safety and privacy boundary

Nomad is a hackathon prototype, not an approved child deployment. Do not invite real children to use it until a qualified local reviewer has approved the curriculum, consent flow, emergency language, access controls, and retention policy for that deployment.

## Before a supervised pilot

1. Obtain informed consent from the responsible adult or institution and age-appropriate assent from the learner.
2. Explain that an AI system will process the learner's speech, produce tutoring responses, and save limited lesson progress.
3. State who operates the phone number and server, who can view the dashboard, how long records are kept, and how deletion can be requested.
4. Use a nickname or chosen first name, never a full legal name. Do not request an address, school identifier, account credential, parent contact, or other unnecessary personal data.
5. Test the deployment's languages and local emergency wording with native speakers. Nomad does not infer a caller's language from their country.
6. Keep the mission-control dashboard private and restrict it to authorized adults. Anonymized references reduce exposure but do not make conversation transcripts anonymous.

## Data currently stored

- A keyed HMAC of the caller number. The raw caller number is not written to SQLite.
- The learner's chosen name or nickname so multiple learners can share a phone.
- Curriculum concept, session status, diagnoses, mastery evidence, language mode, model route, learner answers, and Nomad's spoken responses.
- Likely email addresses, links, long phone-like numbers, and explicit address phrases are redacted before model processing and persistence. Pattern redaction is defense in depth, not a guarantee that every possible identifier will be recognized.

OpenAI Responses requests use `store: false` and a one-way safety identifier. The local SQLite database remains on the operator's machine. The application does not send live lesson content to web search.

## Retention

The prototype currently retains the local SQLite lesson database until the operator deletes it. That is acceptable only for synthetic development data. Before any real pilot, configure and enforce a documented retention period, deletion-request process, backup policy, and access audit appropriate to local law and institutional policy. Do not rely on the current local default as a production retention policy.

## Safety behavior

- Learner speech is treated as untrusted content and cannot override system instructions, the structured schema, or the frozen curriculum.
- Benign off-topic requests are acknowledged briefly and redirected to the pending lesson question.
- Unsafe, sexual, violent, illegal, self-harm, and immediate-danger content receives a short refusal and an age-appropriate trusted-adult or local-emergency redirect where relevant.
- Repeated unsafe or prompt-injection turns end the lesson gracefully instead of consuming unlimited model or phone resources.
- These controls support supervised tutoring; they are not emergency services, content moderation certification, or a substitute for a responsible adult.
