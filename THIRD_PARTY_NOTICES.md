# Third-party notices

Continuum's source code is released under the MIT License. Runtime and development dependencies retain their own licenses.

Direct dependencies audited for this release:

| Package | License |
|---|---|
| `better-sqlite3` | MIT |
| `dotenv` | BSD-2-Clause |
| `openai` | Apache-2.0 |
| `twilio` | MIT |
| `ws` | MIT |
| `zod` | MIT |
| TypeScript, Vitest, `tsx`, and the included type packages | MIT or Apache-2.0 |

The lockfile is the authority for exact package versions and transitive dependencies. Run `npm audit` and review dependency licenses before redistributing a modified build.

## APIs and trademarks

OpenAI, GPT, Twilio, Railway, Node.js, SQLite, and GitHub are names or trademarks of their respective owners. Their inclusion describes interoperability and does not imply endorsement or partnership.

## Sample audio

`public/samples/sample-universal-code-switch.mp3` is a synthetic demonstration fixture generated locally on July 17, 2026 with macOS system voices (`Eddy` and `Flo`, Spanish—Mexico) and encoded with FFmpeg. It is not a child recording, a real call, or user research. Its source text and generation script are in `src/samples/sample-session.ts` and `scripts/generate-sample-audio.ts`.

No third-party photographs, music, curriculum text, fonts, icon packs, or datasets are distributed in the current repository.
