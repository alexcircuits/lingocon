# Database (Prisma)

PostgreSQL is the primary data store. Prisma models live in `**prisma/schema.prisma**`; the generated client is imported from `**@/lib/prisma**`.

## Domain groups

### Identity and sessions (NextAuth)

- `**User**` — core account row; includes admin and moderation fields (`isAdmin`, `isSuspended`, …).
- `**Account**`, `**Session**`, `**VerificationToken**` — standard Auth.js tables.

These tables should rarely be written to manually except in seeds or admin tools.

### Languages and visibility

- `**Language**` — the central aggregate: name, `slug`, `visibility` (`PRIVATE` | `UNLISTED` | `PUBLIC`), owner, optional `LanguageFamily`, script settings, forking flags, metadata JSON for typology/wizard answers.
- `**LanguageCollaborator**` — many-to-many between users and languages with `CollaboratorRole` (`OWNER` is represented implicitly via `Language.ownerId`; collaborators use `EDITOR` / `VIEWER` as appropriate to the app’s checks — see `lib/auth-helpers.ts`).

**Rule of thumb:** anything “can a stranger see this?” flows from `Language.visibility` plus collaborator rows.

### Lexicon and morphology

- `**DictionaryEntry`** — lemma, gloss, optional IPA/POS, tags JSON, etymology, optional links to `**Paradigm**` and cognate/proto lineage.
- `**ExampleSentence**` — per-entry usage examples.
- `**Paradigm**` — inflection or conjugation tables as structured JSON (`slots`).

### Documentation and media

- `**GrammarPage**` — rich text JSON per language, ordered within the language.
- `**Article**` — blog-style posts with publish flags and timestamps.
- `**Text**` — longer-form works (`TextType` enum) with optional uploaded files.

### Families and reconstruction

- `**LanguageFamily**` — hierarchical grouping (`parentFamilyId`) with optional `**ProtoWord**` rows for shared proto-vocabulary.

### Social and engagement

Models such as `**Favorite**`, `**Follow**`, `**Activity**`, `**Comment**`, `**UserBadge**`, and related enums capture user engagement — inspect `schema.prisma` for the authoritative field list.

### Administration

- `**AuditLog**` — append-only record of sensitive admin actions.

## Migrations workflow

```bash
# After editing schema.prisma
npm run db:migrate
# Name the migration descriptively when prompted, e.g. add_dictionary_tags_index
```

Never rewrite applied migration history on shared branches. If a migration was never pushed, `migrate dev` can reset; once on `main`, only **forward** migrations.

## Seeding

```bash
npm run db:seed
```

Seeds are optional for minimal development but useful for UI work. Add seed data in `prisma/seed.ts` (or dedicated seed modules) rather than committing production user data.

## JSON columns

Several models store **TipTap JSON** or tag arrays in `Json` fields. Treat these as versioned payloads: when you change editor schema, consider backward compatibility or one-off migrations to transform stored documents.