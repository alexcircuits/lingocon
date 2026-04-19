# Contributing to LingoCon

**LingoCon is currently under-resourced.** We don't have time for corporate fluff, long approval cycles, or bikeshedding about code style. We need things that work.

If you have 10 minutes or 10 hours, you can help.

## The "No Shame" Policy

*   **AI-generated work is fine.** If you used LLMs to draft documentation, write tests, or fix a bug, just ship it.
*   **Messy is better than nothing.** We don't care if your code is "ugly" as long as it solves a problem. We can refactor later.
*   **Silence is the enemy.** Don't wait until it's "perfect" to open a PR. Open it now.

## How to Help

We've mapped out specific paths for everyone on our [**Contributions Hub**](https://lingocon.com/contributions).

### 1. The Observer (2 mins)
Found a typo? A broken button? A weird logic bug? 
[**Open a GitHub Issue**](https://github.com/alexcircuits/lingocon/issues/new). Be as descriptive as you want, or just drop a screenshot.

### 2. The Prompter (10-30 mins)
Good at prompting AI? Help us write glossary examples, grammar explanations, or sample conlang data.
[**Submit Markdown**](https://github.com/alexcircuits/lingocon/issues/new?labels=content).

### 3. The Hotfixer (1 hour)
Grab an issue labeled `good first issue`. Change a CSS class. Update a dependency. Fix a small bug.
[**View Issues**](https://github.com/alexcircuits/lingocon/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22).

### 4. The Academic (45 mins)
Are we teaching people the wrong IPA chart? Is our glossaries logic linguistically sound? Fix our data.
[**Edit Data Files**](https://github.com/alexcircuits/lingocon/tree/main/lib/data) (and related `lib/` / `prisma/` seeds).

### 5. The Old School
Don't like GitHub? Email your files or napkin sketches to **contribute@noirsystems.com**.

## What You Get

1.  **Permanent Credit**: All contributors are added to the [AUTHORS.md](AUTHORS.md) file.
2.  **Discord Titles**: Frequent contributors get specific roles (Language Curator, Code Architect) in our [Discord](https://discord.gg/EaVRggatDQ).
3.  **Real Impact**: Your change might be live on lingocon.com within 24 hours.

**Stop overthinking it. Just ship it.**

---

## For developers (repository layout)

If you are writing or reviewing code, use the docs in **`docs/`** as the canonical tour (also published on the live site at **[lingocon.com/docs](https://lingocon.com/docs)** after each deploy):

- [docs/README.md](docs/README.md) — index of all guides
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — auth, routing, caching mental model
- [docs/CODEBASE.md](docs/CODEBASE.md) — where features live on disk
- [docs/DATABASE.md](docs/DATABASE.md) — Prisma domains and migration workflow
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) — environment variables and scripts
- [docs/SERVER_ACTIONS_AND_API.md](docs/SERVER_ACTIONS_AND_API.md) — Server Actions vs Route Handlers

### Local checks before you open a PR

```bash
npm run lint
npm run build
```

If your change touches Prisma, include the generated migration under `prisma/migrations/`. If it is UI-only, a successful `lint` run is often enough.

### Code style expectations

- Prefer **`@/` imports** and existing patterns in neighboring files.
- **Server Actions** belong in `app/actions/` and should call `getUserId` / `canEditLanguage` (or related helpers) before mutating language data.
- Add a **short comment at the top of non-trivial files** explaining the module’s responsibility; explain *why* for non-obvious branches inside functions.
- Avoid drive-by reformatting unrelated files in the same PR—small, reviewable diffs get merged faster.

