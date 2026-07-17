# Curriculum source briefs

These files are build-time scope contracts, not curriculum packs. Drafts under
`drafts/` are intentionally marked `pending`; Nomad will validate their shape but
will refuse to spend model credit compiling them.

Check a draft without using the API:

```bash
npm run curriculum:brief:check -- --source curriculum/source-briefs/drafts/india-grade6-science-materials.json
```

The command exits with status 2 while human review is pending. Before changing a
receipt to `approved`, the reviewer must open every listed official-source URL and
confirm all of the following:

1. The title, grade, subject, themes, required concepts, and vocabulary stay within
   the source.
2. Local examples are culturally plausible, safe without supervision or purchase,
   and do not add factual claims.
3. The source URLs in `reviewedSourceUrls` exactly match `sourceMaterials`.
4. `scopeNotes` record what was checked and any excluded scope.

An approval receipt has this shape:

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
verification pass and writes a create-only frozen pack; human approval is necessary
but does not replace that verifier.
