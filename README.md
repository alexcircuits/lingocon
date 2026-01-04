# Langua

A platform for creating and documenting constructed languages.

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

## Prerequisites

- Node.js 18+ 
- PostgreSQL database
- GitHub account (for OAuth)

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Copy `.env.example` to `.env` and configure the following variables:

```bash
# Database
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"

# NextAuth
AUTH_SECRET="generate-with-openssl-rand-base64-32"
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"
```

#### Generating AUTH_SECRET

```bash
openssl rand -base64 32
```

#### Setting up GitHub OAuth

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in:
   - **Application name**: Langua (or your choice)
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`
4. Click "Register application"
5. Copy the **Client ID** and generate a **Client Secret**
6. Add both to your `.env` file

### 3. Database Setup

#### Create Database

```bash
# Using PostgreSQL CLI
createdb langua

# Or using psql
psql -U postgres
CREATE DATABASE langua;
```

#### Run Migrations

```bash
npx prisma migrate dev
```

This will:
- Create all database tables
- Set up indexes and foreign keys
- Apply the initial schema

#### (Optional) View Database

```bash
npx prisma studio
```

Opens a visual database browser at `http://localhost:5555`

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
langua/
├── app/
│   ├── actions/          # Server actions
│   ├── api/              # API routes
│   ├── dashboard/        # Dashboard pages
│   ├── lang/             # Public language pages
│   ├── login/            # Authentication pages
│   └── studio/           # Studio (editing) pages
├── components/
│   └── ui/               # shadcn/ui components
├── lib/
│   ├── validations/      # Zod schemas
│   └── utils/            # Utility functions
├── prisma/
│   ├── migrations/       # Database migrations
│   └── schema.prisma     # Database schema
└── types/                # TypeScript types
```

## Database Schema

### Models

- **User** - NextAuth user accounts (id, email, name, image)
- **Language** - Conlang projects (name, slug, description, visibility, ownerId)
- **ScriptSymbol** - Alphabet symbols (symbol, ipa, name, order)
- **GrammarPage** - Grammar documentation (title, slug, content JSON, order)
- **DictionaryEntry** - Lexicon entries (lemma, gloss, ipa, partOfSpeech, notes)

### Relations

- User → Languages (one-to-many via ownerId)
- Language → ScriptSymbols, GrammarPages, DictionaryEntries (one-to-many)
- All relations cascade on delete

### Indexes

- Language: ownerId, slug (unique)
- ScriptSymbol: languageId, (languageId, order)
- GrammarPage: languageId, (languageId, order), (languageId, slug) unique
- DictionaryEntry: languageId, (languageId, lemma)

## Routes

### Public Routes

- `/` - Home page
- `/lang/[slug]` - Language overview
- `/lang/[slug]/alphabet` - Public alphabet view
- `/lang/[slug]/grammar` - Grammar index
- `/lang/[slug]/grammar/[pageSlug]` - Individual grammar page
- `/lang/[slug]/dictionary` - Public dictionary with search

### Authenticated Routes

- `/dashboard` - User dashboard (list of languages)
- `/dashboard/new-language` - Create new language
- `/studio/lang/[slug]` - Studio overview
- `/studio/lang/[slug]/alphabet` - Manage alphabet
- `/studio/lang/[slug]/grammar` - Manage grammar pages
- `/studio/lang/[slug]/dictionary` - Manage dictionary
- `/studio/lang/[slug]/settings` - Language settings

### Authentication Routes

- `/login` - Sign in page
- `/api/auth/[...nextauth]` - NextAuth API handler

## Usage

### Creating a Language

1. Sign in with GitHub
2. Go to Dashboard
3. Click "Create Language"
4. Fill in name, slug, description, and visibility
5. Click "Create Language"

### Managing Alphabet

1. Go to Studio → Alphabet
2. Click "Add Symbol"
3. Enter symbol, IPA (optional), and name (optional)
4. Use up/down arrows to reorder
5. Edit or delete symbols as needed

### Creating Grammar Pages

1. Go to Studio → Grammar
2. Click "New Page"
3. Enter title and slug
4. Use the rich text editor to write grammar documentation
5. Save the page

### Managing Dictionary

1. Go to Studio → Dictionary
2. Click "Add Entry"
3. Fill in lemma, gloss, IPA (optional), part of speech (optional), notes (optional)
4. Use search to filter entries
5. Edit or delete entries as needed

### Changing Visibility

1. Go to Studio → Settings
2. Change visibility dropdown
3. Click "Save Changes"

- **Private**: Only you can see it
- **Unlisted**: Accessible via direct link, not listed publicly
- **Public**: Listed publicly and accessible to everyone

## Development

### Building for Production

```bash
npm run build
npm start
```

### Database Migrations

```bash
# Create a new migration
npx prisma migrate dev --name migration_name

# Apply migrations in production
npx prisma migrate deploy

# Reset database (development only)
npx prisma migrate reset
```

### Prisma Commands

```bash
# Generate Prisma Client
npx prisma generate

# Open Prisma Studio
npx prisma studio

# Format schema
npx prisma format
```

## IPA Pronunciation Feature

The platform includes a user-triggered IPA audio pronunciation feature. Users can click a speaker icon next to any IPA string to hear an approximate pronunciation.

### Features

- **Speaker Icon**: Appears next to IPA strings in dictionary entries, script symbols, and paradigm cells
- **On-Demand Playback**: Audio only plays when the user clicks the speaker icon (no autoplay)
- **Graceful Error Handling**: Shows helpful messages if audio cannot be generated
- **Accessibility**: Proper ARIA labels and keyboard support
- **Rate Limiting**: Prevents abuse with 1 request per second per IP

### Setting Up IPA Reader Service

The IPA pronunciation feature requires an external IPA reader service. The API route at `/app/api/pronounce/route.ts` is configured to work with AWS Polly, but can be adapted to other services.

#### Option 1: AWS Polly (Recommended)

1. **Install AWS SDK**:
   ```bash
   npm install @aws-sdk/client-polly
   ```

2. **Set up AWS Credentials**:
   - Create an AWS account
   - Create an IAM user with `AmazonPollyFullAccess` policy
   - Get Access Key ID and Secret Access Key

3. **Configure Environment Variables**:
   Add to your `.env` file:
   ```bash
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=your-access-key-id
   AWS_SECRET_ACCESS_KEY=your-secret-access-key
   AWS_POLLY_VOICE_ID=Joanna  # Optional, defaults to Joanna
   ```

4. **Enable AWS Polly in API Route**:
   - Open `/app/api/pronounce/route.ts`
   - Uncomment the AWS Polly code block (lines 104-138)
   - Remove or comment out the placeholder error return (lines 98-101)

#### Option 2: Other IPA Reader Services

You can adapt the `synthesizeIPA` function in `/app/api/pronounce/route.ts` to use other services:

- **eSpeak-ng**: Requires server-side installation
- **Custom API**: Integrate with any IPA-to-speech API
- **ipa-reader.com**: If they provide a public API endpoint

### Usage

Once configured, users will see a speaker icon (🔊) next to IPA strings. Clicking it will:

1. Send the IPA string to the pronunciation service
2. Generate audio (or show an error if unavailable)
3. Play the audio automatically
4. Show warnings if the IPA contains unsupported symbols

### Labeling

All IPA pronunciation audio is clearly labeled as "approximate" to indicate that:
- The audio is generated from IPA notation
- It may not reflect all accents or phonological nuances
- It's a synthetic approximation, not native pronunciation

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `AUTH_SECRET` | Secret for NextAuth session encryption | Yes |
| `GITHUB_CLIENT_ID` | GitHub OAuth App Client ID | Yes |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App Client Secret | Yes |
| `AWS_REGION` | AWS region for Polly (e.g., us-east-1) | No* |
| `AWS_ACCESS_KEY_ID` | AWS access key for Polly | No* |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key for Polly | No* |
| `AWS_POLLY_VOICE_ID` | Polly voice ID (default: Joanna) | No |

*Required only if using AWS Polly for IPA pronunciation

## Security

- All authenticated routes verify user ownership
- Server actions validate inputs with Zod
- Cascade deletion ensures data consistency
- Visibility rules enforced at database query level

## License

MIT
