# LingoCon documentation

This folder is the **onboarding map** for contributors. Start here if you are new to the codebase.

The same guides are published on the live site at **[lingocon.com/docs](https://lingocon.com/docs)** (after deploy).

| Document | What it covers |
|----------|----------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | How requests flow through Next.js, where auth runs, and how major subsystems connect. |
| [CODEBASE.md](./CODEBASE.md) | Directory-by-directory guide: where UI, server logic, and data live. |
| [DATABASE.md](./DATABASE.md) | Prisma models grouped by domain, visibility rules, and migration tips. |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | Local setup, environment variables, scripts, and optional features (Polly, email). |
| [SERVER_ACTIONS_AND_API.md](./SERVER_ACTIONS_AND_API.md) | Server Actions conventions, `ActionResult`, and Route Handlers overview. |

The root [README.md](../README.md) stays a short “clone and run” entry point; deeper detail lives in this folder.

**Adding a new guide:** create the `.md` file here, then register it in `lib/docs/site-docs.ts` (`DOC_PAGES`) so it appears in the sidebar and sitemap on the website.
