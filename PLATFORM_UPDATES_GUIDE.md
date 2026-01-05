# Publishing Platform Updates

The LingoCon platform now has a centralized system for broadcasting feature announcements and updates to all users via the notification bell in the navbar.

## Method 1: Using Server Actions (Programmatic)

You can publish a new update from any server-side component or server action using the `createPlatformUpdate` function.

```typescript
import { createPlatformUpdate } from "@/app/actions/platform-update"

await createPlatformUpdate({
  title: "New Feature: Interactive IPA Keyboard",
  description: "We've added a highly responsive IPA keyboard for easier transcription across the Studio.",
  icon: "zap", // Lucide icon name (sparkles, zap, star, gift, info, search, languages, book, file-text)
  link: "/studio/lang/my-conlang/alphabet" // Optional internal or external link
})
```

## Method 2: Using the Seed Script

Alternatively, you can modify and run the provided seed script to push a quick update manually.

1. Open `scripts/seed-updates.ts`.
2. Update the data object with your new feature details.
3. Run the following command in your terminal:

```bash
npx tsx scripts/seed-updates.ts
```

## Icons Reference

The system currently supports the following icon identifiers (case-insensitive):
- `sparkles`
- `zap`
- `star`
- `gift`
- `info`
- `search`
- `languages`
- `book`
- `file-text`

Adding a new update will automatically trigger a red notification badge for all users who have visited the site in the last 24 hours.
