# Five-subject curriculum release

The engine and voice menu are subject-agnostic. The India Grade 6 release target is
declared in `curriculum/releases/india-grade6.json`; it does not add subject branches
to the teaching engine. Math is the existing hand-reviewed flagship. Science,
English, History, and Geography remain hidden until every stage below passes.

## Human source review

Open every official source and compare it with the themes, concepts, vocabulary,
local examples, and exclusions in the matching draft:

| Subject | Official source | Draft |
|---|---|---|
| Science | [NCERT ePathshala: Materials Around Us](https://epathshala.nic.in/topicc.php?id=0677CH06) | `curriculum/source-briefs/drafts/india-grade6-science-materials.json` |
| English | [NCERT ePathshala: Fables and Folk Tales](https://epathshala.nic.in/topic.php?id=0673CH01) | `curriculum/source-briefs/drafts/india-grade6-english-oral-narratives.json` |
| History | [NCERT ePathshala: Timeline and Sources of History](https://epathshala.nic.in/topicc.php?id=0681CH04) | `curriculum/source-briefs/drafts/india-grade6-history-sources.json` |
| Geography | [NCERT ePathshala: Locating Places on the Earth](https://epathshala.nic.in/topicc.php?id=0681CH01) | `curriculum/source-briefs/drafts/india-grade6-geography-maps.json` |

For each subject, run the create-only review command documented in
`curriculum/source-briefs/README.md`. Use your real name, a specific scope note,
and the exact `I_REVIEWED_EVERY_SOURCE` confirmation. Codex must not perform or
invent this human sign-off.

## Compile, independently verify, and freeze

For each approved brief:

1. Run `npm run curriculum:compile` to generate a candidate with GPT-5.6 Terra.
2. The independent verifier must approve every required check with no error.
3. Read the candidate. Check learning objectives, facts, answer keys, voice length,
   one-question formatting, DTMF choices, one-segment SMS, safety, and originality.
4. Run `npm run curriculum:freeze` with the exact
   `I_SPOT_CHECKED_THIS_PACK` confirmation.
5. Run `npm run curriculum:release:check`.

The last command prints `NOMAD_CURRICULUM_PATHS` only when all five subjects are
digest-bound and release-ready. Copy that JSON-array value to Railway, redeploy,
and confirm `/health` lists Math, Science, English, History, and Geography in the
declared order.

Never copy a candidate straight into the frozen directory. A changed brief,
candidate, verification, or release receipt invalidates the chain by SHA-256.
