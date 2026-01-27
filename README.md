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
> **DEV_MODE="true"** allows you to use the app without configuring GitHub OAuth or NextAuth secrets. It simulates a verified user environment.

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

## Project Structure

```
lingocon/
├── app/                  # App Router pages and layouts
│   ├── actions/          # Server Actions
│   ├── api/              # API Routes
│   └── ...
├── components/           # React components
│   └── ui/               # Reusable UI components (shadcn/ui)
├── lib/                  # Utilities and libraries
├── prisma/               # Database schema and migrations
└── types/                # Global type definitions
```

## Common Tasks

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

**We are under-resourced and strictly prioritize momentum over polish.**

If you want to help, but don't know where to start, visit our [**Contributions Hub**](https://lingocon.com/contributions). We explicitly welcome:
- AI-generated content/fixes
- Messy, partial, or "unprofessional" code that solves a problem
- Direct file drops via email for non-technical users

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full "No Shame" policy.

## Authors

See the full list of humans who built this in [AUTHORS.md](AUTHORS.md).

## License

[AGPLv3](LICENSE)

