# Implementation Plan - Step-by-Step Tasks

This document breaks down the product improvements into concrete, implementable tasks.

## 🎯 Phase 1: Foundation (Highest Priority)

### Task 1.1: Public LingoConge Browse Page
**Priority: CRITICAL**  
**Estimated Time: 4-6 hours**

#### Steps:
1. Create `/app/browse/page.tsx`
   - Server component that fetches all public languages
   - Include pagination (20 per page)
   - Show: name, description, owner, stats, created date

2. Create `/app/browse/components/language-card.tsx`
   - Reusable card component for language preview
   - Link to `/lang/[slug]`
   - Show visibility badge, stats, owner info

3. Add filtering/sorting:
   - Filter by: recently created, recently updated, most entries
   - Sort dropdown component

4. Add to navigation:
   - Add "Browse" link to main nav
   - Update homepage "Browse LingoConges" button

#### Files to Create/Modify:
- `app/browse/page.tsx` (NEW)
- `app/browse/components/language-card.tsx` (NEW)
- `app/page.tsx` (UPDATE - fix Browse LingoConges link)
- `app/layout.tsx` or nav component (UPDATE - add Browse link)

#### Database Query:
```typescript
// In app/browse/page.tsx
const languages = await prisma.language.findMany({
  where: { visibility: 'PUBLIC' },
  include: {
    owner: { select: { name: true, image: true } },
    _count: {
      select: {
        scriptSymbols: true,
        grammarPages: true,
        dictionaryEntries: true,
      },
    },
  },
  orderBy: { createdAt: 'desc' },
  take: 20,
  skip: (page - 1) * 20,
})
```

---

### Task 1.2: Global Search Functionality
**Priority: HIGH**  
**Estimated Time: 6-8 hours**

#### Steps:
1. Create search API route `/app/api/search/route.ts`
   - Accept query parameter
   - Search across: languages, dictionary entries, grammar pages
   - Return grouped results

2. Create search component `/components/search/search-bar.tsx`
   - Global search bar (header)
   - Debounced input
   - Dropdown with results preview
   - Keyboard shortcuts (Cmd/Ctrl+K)

3. Create search results page `/app/search/page.tsx`
   - Full search results page
   - Tabs: LingoConges, Dictionary, Grammar
   - Highlight search terms

4. Add search to navigation:
   - Add search bar to header
   - Make it accessible

#### Files to Create/Modify:
- `app/api/search/route.ts` (NEW)
- `components/search/search-bar.tsx` (NEW)
- `components/search/search-results.tsx` (NEW)
- `app/search/page.tsx` (NEW)
- `app/layout.tsx` (UPDATE - add search bar)

#### Database Queries:
```typescript
// Search languages
const languages = await prisma.language.findMany({
  where: {
    OR: [
      { name: { contains: query, mode: 'insensitive' } },
      { description: { contains: query, mode: 'insensitive' } },
    ],
    visibility: 'PUBLIC',
  },
})

// Search dictionary entries
const entries = await prisma.dictionaryEntry.findMany({
  where: {
    OR: [
      { lemma: { contains: query, mode: 'insensitive' } },
      { gloss: { contains: query, mode: 'insensitive' } },
      { ipa: { contains: query, mode: 'insensitive' } },
    ],
    language: { visibility: 'PUBLIC' },
  },
  include: { language: true },
})
```

---

### Task 1.3: CSV Export for Dictionary
**Priority: HIGH**  
**Estimated Time: 3-4 hours**

#### Steps:
1. Create export API route `/app/api/export/csv/route.ts`
   - Accept languageId
   - Generate CSV from dictionary entries
   - Return downloadable file

2. Add export button to dictionary manager
   - Add "Export CSV" button
   - Trigger download

3. Add export action to dictionary manager component

#### Files to Create/Modify:
- `app/api/export/csv/route.ts` (NEW)
- `app/studio/lang/[slug]/dictionary/dictionary-manager.tsx` (UPDATE - add export button)

#### Implementation:
```typescript
// Generate CSV
const csv = [
  ['Lemma', 'Gloss', 'IPA', 'Part of Speech', 'Notes'].join(','),
  ...entries.map(e => [
    e.lemma,
    e.gloss,
    e.ipa || '',
    e.partOfSpeech || '',
    e.notes || '',
  ].map(field => `"${field.replace(/"/g, '""')}"`).join(','))
].join('\n')
```

---

### Task 1.4: CSV Import for Dictionary
**Priority: HIGH**  
**Estimated Time: 4-5 hours**

#### Steps:
1. Create import API route `/app/api/import/csv/route.ts`
   - Accept CSV file upload
   - Parse CSV
   - Validate entries
   - Bulk insert

2. Add import UI to dictionary manager
   - File upload button
   - Preview before import
   - Show import progress
   - Handle errors gracefully

3. Add validation:
   - Check required fields
   - Validate IPA format
   - Check for duplicates

#### Files to Create/Modify:
- `app/api/import/csv/route.ts` (NEW)
- `app/studio/lang/[slug]/dictionary/dictionary-manager.tsx` (UPDATE - add import)
- `lib/utils/csv-parser.ts` (NEW - CSV parsing utility)

---

### Task 1.5: Enhanced Landing Page
**Priority: MEDIUM**  
**Estimated Time: 2-3 hours**

#### Steps:
1. Add featured languages section
   - Fetch 3-6 public languages
   - Display as cards
   - Link to browse page

2. Improve copy:
   - More compelling value proposition
   - Clear call-to-action
   - Feature highlights

3. Add stats section:
   - Total languages
   - Total entries
   - Active users (if tracking)

#### Files to Create/Modify:
- `app/page.tsx` (UPDATE - add featured section)
- `components/featured-languages.tsx` (NEW)

---

### Task 1.6: Mobile Responsiveness Audit
**Priority: MEDIUM**  
**Estimated Time: 4-6 hours**

#### Steps:
1. Test all pages on mobile viewport
2. Fix responsive issues:
   - Tables (make scrollable or card-based)
   - Forms (stack inputs vertically)
   - Navigation (hamburger menu)
   - Modals/dialogs (full-screen on mobile)

3. Add mobile-specific components:
   - Mobile-friendly table component
   - Touch-friendly buttons
   - Swipe gestures where appropriate

#### Files to Modify:
- All page components (responsive classes)
- `components/ui/table.tsx` (UPDATE - mobile variant)
- `app/layout.tsx` (UPDATE - mobile nav)

---

## 🎯 Phase 2: Core Features

### Task 2.1: Basic Collaboration (Invite Collaborators)
**Priority: HIGH**  
**Estimated Time: 8-10 hours**

#### Steps:
1. Update database schema:
   - Add `LingoCongeCollaborator` model
   - Fields: languageId, userId, role (OWNER, EDITOR, VIEWER)

2. Create collaborator actions:
   - `app/actions/collaborator.ts`
   - Functions: invite, remove, update role

3. Add collaborator UI:
   - Settings page: manage collaborators
   - Invite form (email or username)
   - List of current collaborators
   - Role management

4. Update authorization:
   - Check collaborator permissions
   - Allow editors to edit
   - Viewers can only view

#### Files to Create/Modify:
- `prisma/schema.prisma` (UPDATE - add Collaborator model)
- `prisma/migrations/...` (NEW - migration)
- `app/actions/collaborator.ts` (NEW)
- `app/studio/lang/[slug]/settings/collaborators.tsx` (NEW)
- `lib/auth-helpers.ts` (UPDATE - check collaboration)

---

### Task 2.2: Activity Feed
**Priority: MEDIUM**  
**Estimated Time: 6-8 hours**

#### Steps:
1. Create activity log system:
   - Add `Activity` model (optional, or use updatedAt)
   - Track: created, updated, deleted actions
   - Store: entity type, entity id, user, timestamp

2. Create activity feed component:
   - Show recent changes
   - Group by date
   - Link to changed items

3. Add to dashboard and language pages:
   - Dashboard: recent activity across all languages
   - LingoConge page: activity for that language

#### Files to Create/Modify:
- `prisma/schema.prisma` (UPDATE - add Activity model, optional)
- `components/activity-feed.tsx` (NEW)
- `app/dashboard/page.tsx` (UPDATE - add activity section)
- `app/studio/lang/[slug]/page.tsx` (UPDATE - add activity)

---

### Task 2.3: PDF Export
**Priority: MEDIUM**  
**Estimated Time: 8-10 hours**

#### Steps:
1. Install PDF library (react-pdf or puppeteer)
2. Create PDF template:
   - LingoConge cover page
   - Table of contents
   - Alphabet section
   - Grammar pages
   - Dictionary (alphabetical)

3. Create export API route:
   - `/app/api/export/pdf/route.ts`
   - Generate PDF from language data
   - Return downloadable file

4. Add export button to language settings

#### Files to Create/Modify:
- `app/api/export/pdf/route.ts` (NEW)
- `lib/utils/pdf-generator.ts` (NEW)
- `app/studio/lang/[slug]/settings/page.tsx` (UPDATE - add export)

---

### Task 2.4: Enhanced Dictionary Features
**Priority: MEDIUM**  
**Estimated Time: 6-8 hours**

#### Steps:
1. Add etymology field:
   - Update schema: add `etymology` to DictionaryEntry
   - Add to form
   - Display in dictionary view

2. Add related words:
   - Update schema: add `relatedWords` (JSON array)
   - UI to link words
   - Display relationships

3. Bulk edit:
   - Select multiple entries
   - Edit common fields
   - Apply changes

#### Files to Create/Modify:
- `prisma/schema.prisma` (UPDATE)
- `app/studio/lang/[slug]/dictionary/dictionary-manager.tsx` (UPDATE)
- `components/dictionary/bulk-edit.tsx` (NEW)

---

## 🎯 Phase 3: Engagement Features

### Task 3.1: Social Sharing
**Priority: MEDIUM**  
**Estimated Time: 4-5 hours**

#### Steps:
1. Add Open Graph meta tags:
   - LingoConge pages: title, description, image
   - Dynamic meta generation

2. Add share buttons:
   - Twitter, Reddit, Facebook
   - Copy link button
   - Share component

3. Add Twitter Card support:
   - Meta tags for Twitter
   - Preview cards

#### Files to Create/Modify:
- `app/lang/[slug]/layout.tsx` (UPDATE - add meta tags)
- `components/share-buttons.tsx` (NEW)
- `app/lang/[slug]/page.tsx` (UPDATE - add share buttons)

---

### Task 3.2: Favorites/Bookmarks
**Priority: LOW**  
**Estimated Time: 4-5 hours**

#### Steps:
1. Add Favorite model:
   - userId, languageId
   - Unique constraint

2. Create favorite actions:
   - Add/remove favorite
   - Get user favorites

3. Add favorite button:
   - Heart icon on language cards
   - Toggle favorite
   - Show favorites page

#### Files to Create/Modify:
- `prisma/schema.prisma` (UPDATE)
- `app/actions/favorite.ts` (NEW)
- `components/favorite-button.tsx` (NEW)
- `app/favorites/page.tsx` (NEW)

---

### Task 3.3: Follow Users
**Priority: LOW**  
**Estimated Time: 5-6 hours**

#### Steps:
1. Add Follow model:
   - followerId, followingId
   - Unique constraint

2. Create follow actions:
   - Follow/unfollow user
   - Get followers/following

3. Add follow button:
   - On user profiles
   - Show followers count

4. Create user profile page:
   - Show user's languages
   - Followers/following
   - Activity

#### Files to Create/Modify:
- `prisma/schema.prisma` (UPDATE)
- `app/actions/follow.ts` (NEW)
- `app/users/[userId]/page.tsx` (NEW)
- `components/follow-button.tsx` (NEW)

---

## 🎯 Phase 4: Advanced Features

### Task 4.1: API Access
**Priority: MEDIUM**  
**Estimated Time: 8-10 hours**

#### Steps:
1. Design RESTful API:
   - `/api/v1/languages`
   - `/api/v1/languages/[slug]/dictionary`
   - Authentication via API keys

2. Create API routes:
   - CRUD operations
   - Pagination
   - Filtering

3. Add API key management:
   - Generate API keys
   - Revoke keys
   - Rate limiting per key

#### Files to Create/Modify:
- `app/api/v1/` (NEW - API routes)
- `app/studio/settings/api-keys.tsx` (NEW)
- `lib/api-auth.ts` (NEW)

---

### Task 4.2: Tags/Categories for LingoConges
**Priority: MEDIUM**  
**Estimated Time: 5-6 hours**

#### Steps:
1. Add tags system:
   - Tag model (many-to-many with LingoConge)
   - Predefined tags + custom tags

2. Add tag UI:
   - Tag input component
   - Tag display
   - Filter by tags

3. Update browse page:
   - Filter by tags
   - Tag cloud

#### Files to Create/Modify:
- `prisma/schema.prisma` (UPDATE)
- `components/tags/tag-input.tsx` (NEW)
- `app/browse/page.tsx` (UPDATE - tag filtering)

---

## 📋 Implementation Order Recommendation

### Week 1 (Foundation)
1. ✅ Task 1.1: Browse Page (Day 1-2)
2. ✅ Task 1.2: Global Search (Day 3-4)
3. ✅ Task 1.3: CSV Export (Day 5)

### Week 2 (Data & UX)
4. ✅ Task 1.4: CSV Import (Day 1-2)
5. ✅ Task 1.5: Enhanced Landing Page (Day 3)
6. ✅ Task 1.6: Mobile Responsiveness (Day 4-5)

### Week 3 (Collaboration)
7. ✅ Task 2.1: Basic Collaboration (Day 1-3)
8. ✅ Task 2.2: Activity Feed (Day 4-5)

### Week 4 (Export & Polish)
9. ✅ Task 2.3: PDF Export (Day 1-3)
10. ✅ Task 3.1: Social Sharing (Day 4-5)

---

## 🛠️ Technical Considerations

### Database Migrations
- Always create migrations for schema changes
- Test migrations on dev database first
- Backup production before migrations

### Performance
- Add database indexes for search queries
- Implement pagination for large datasets
- Cache frequently accessed data

### Security
- Validate all user inputs
- Check permissions for all actions
- Rate limit API endpoints
- Sanitize user-generated content

### Testing
- Test each feature thoroughly
- Test on mobile devices
- Test with different user roles
- Test error cases

---

## 📝 Notes

- Start with Phase 1 tasks - they provide the most value
- Test each feature before moving to the next
- Gather user feedback after each phase
- Iterate based on feedback

