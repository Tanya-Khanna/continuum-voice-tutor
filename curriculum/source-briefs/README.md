# Curriculum source briefs

These files are build-time scope contracts, not curriculum packs. Drafts under
`drafts/` are intentionally marked `pending`; Continuum will validate their shape but
will refuse to spend model credit compiling them.

Check a draft without using the API:

```bash
npm run curriculum:brief:check -- --source curriculum/source-briefs/drafts/india-grade6-science-materials.json
```

The command exits with status 2 while human review is pending. Before creating an
approved copy, the reviewer must open every listed official-source URL and
confirm all of the following:

1. The title, grade, subject, themes, required concepts, and vocabulary stay within
   the source.
2. Local examples are culturally plausible, safe without supervision or purchase,
   and do not add factual claims.
3. The source URLs in `reviewedSourceUrls` exactly match `sourceMaterials`.
4. `scopeNotes` record what was checked and any excluded scope.

Record that review without editing the pending draft in place:

```bash
npm run curriculum:brief:review -- \
  --source curriculum/source-briefs/drafts/india-grade6-science-materials.json \
  --out curriculum/source-briefs/approved/india-grade6-science-materials.json \
  --reviewed-by "Your name" \
  --scope-note "Checked every stated theme and excluded all other chapter facts." \
  --confirm I_REVIEWED_EVERY_SOURCE
```

The command is create-only, copies the exact source URL set into the approval
receipt, and refuses to imply that it inspected the sources. An approval receipt
has this shape:

```json
{
  "status": "approved",
  "reviewedBy": "reviewer name",
  "reviewedAt": "2026-07-17T00:00:00.000Z",
  "reviewedSourceUrls": ["https://official.example/source"],
  "scopeNotes": ["Confirmed the stated themes and vocabulary against the source."]
}
```

Only then run `curriculum:compile`. The compiler performs an independent model
verification pass and writes a create-only candidate plus a digest-bound
verification receipt; human source approval is necessary but does not replace that
verifier.

```bash
npm run curriculum:compile -- \
  --source curriculum/source-briefs/approved/india-grade6-science-materials.json \
  --out curriculum/packs/candidates/india-grade6-science-materials.json
```

Finally, inspect the candidate's objectives, answers, spoken prompts, keypad/SMS
items, safety behavior, and originality. Freeze it only after that human spot-check:

```bash
npm run curriculum:freeze -- \
  --source curriculum/source-briefs/approved/india-grade6-science-materials.json \
  --candidate curriculum/packs/candidates/india-grade6-science-materials.json \
  --compile-receipt curriculum/packs/candidates/india-grade6-science-materials.json.verification.json \
  --out curriculum/packs/frozen/india-grade6-science-materials.json \
  --release-receipt-out curriculum/packs/frozen/india-grade6-science-materials.release.json \
  --released-by "Your name" \
  --note "Checked source scope, answer keys, voice, keypad, SMS, and safety." \
  --confirm I_SPOT_CHECKED_THIS_PACK
```

Every stage is create-only. A changed brief or candidate changes its SHA-256 digest,
invalidating downstream receipts instead of silently reusing an earlier approval.
