# LingoCon

A platform for creating and documenting constructed languages. Live at [lingocon.com](https://lingocon.com).
[Join our Discord](https://discord.gg/EaVRggatDQ)

> [!NOTE]
> Changes pushed to this repository will be checked and pushed to production after some time.

## Features

- **Language Management** - Create and manage multiple constructed languages
- **Alphabet/Script** - Document script symbols with IPA notation
- **Grammar Documentation** - Rich text grammar pages with TipTap editor
- **Dictionary/Lexicon** - Searchable dictionary with lemma, gloss, IPA, and part of speech
- **Visibility Control** - Private, unlisted, or public language documentation
- **Authentication** - Secure GitHub OAuth authentication

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS + shadcn/ui
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js (Auth.js)
- **Rich Text**: TipTap
- **Validation**: Zod

## Development Setup

Follow these steps to get a local development environment running.

### 1. Prerequisites

- **Node.js 18+**
- **PostgreSQL** database (local or remote)
- **GitHub Account** (for OAuth)

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Open `.env`. For local development, you only need to configure the database and enable `DEV_MODE`.

```bash
# Development Mode (Bypasses authentication)
DEV_MODE="true"

# Database (Required)
DATABASE_URL="postgresql://user:password@localhost:5432/langua?schema=public"
```

> [!TIP]
> **DEV_MODE="true"** allows you to use the app without configuring GitHub OAuth or NextAuth secrets. It simulates a verified user environment via a fixed local user (see `lib/constants/dev-user.ts`). Never enable this in production.

### 4. Database Setup

Create the database and run migrations:

```bash
# Create and migrate
npx prisma migrate dev

# (Optional) Seed the database if a seed script exists
# npm run db:seed
```

### 5. Run Development Server

Start the local development server:

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the app.

## Project structure

```
lingocon/
├── app/                  # App Router: pages, layouts, Server Actions, Route Handlers
│   ├── actions/          # Server Actions (mutations + guarded reads)
│   ├── api/              # HTTP endpoints (auth, exports, uploads, integrations)
│   ├── lang/             # Public reader experience per language slug
│   ├── studio/           # Authoring tools for language owners/editors
│   └── ...
├── components/           # Shared React UI (feature widgets + shadcn primitives)
├── docs/                 # Contributor docs (architecture, database, dev setup)
├── lib/                  # Prisma singleton, auth helpers, validations, TipTap, utilities
├── prisma/               # Database schema, migrations, seeds
├── public/               # Static assets, icons, service worker
├── tests/                # Shared test helpers (mocks)
└── types/                # Global TypeScript augmentations (e.g. next-auth)
```

**New to the repo?** Browse **[Developer docs on the site](https://lingocon.com/docs)** (or locally at `/docs` when running the app), or read [docs/README.md](docs/README.md) in GitHub, then [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/CODEBASE.md](docs/CODEBASE.md).

## Common tasks

### Database Management

```bash
# Open visual database editor
npx prisma studio

# Create a new migration after schema changes
npx prisma migrate dev --name <migration_name>
```

### IPA Pronunciation (Optional)

To enable the IPA audio feature locally, you need AWS credentials for Polly.
Add these to your `.env`:

```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

See `/app/api/pronounce/route.ts` for implementation details.

## Contributing

Maintainers merge pragmatic fixes quickly, but **readable, documented changes** help the next person—even if that next person is you in six months.

If you want to help and do not know where to start, visit the [**Contributions Hub**](https://lingocon.com/contributions). We still welcome AI-assisted work, small partial fixes, and non-GitHub contributions described in [CONTRIBUTING.md](CONTRIBUTING.md).

For code changes: skim [docs/CODEBASE.md](docs/CODEBASE.md), run `npm run lint`, and describe **what user-visible behavior** changed in your PR.

## Authors

See the full list of humans who built this in [AUTHORS.md](AUTHORS.md).

## License

[AGPLv3](LICENSE)

