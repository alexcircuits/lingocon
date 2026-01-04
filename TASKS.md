# Implementation Tasks - Detailed Checklist

This file contains step-by-step tasks that can be implemented one at a time.

## ✅ Task 1.1: Public LingoConge Browse Page

### Step 1.1.1: Create Browse Page Route
- [ ] Create `app/browse/page.tsx`
- [ ] Add server-side data fetching for public languages
- [ ] Include pagination logic
- [ ] Add basic layout with header

### Step 1.1.2: Create LingoConge Card Component
- [ ] Create `app/browse/components/language-card.tsx`
- [ ] Display: name, description, owner, stats
- [ ] Add link to language page
- [ ] Style with Card component

### Step 1.1.3: Add Filtering & Sorting
- [ ] Add sort dropdown (recent, updated, entries)
- [ ] Implement sorting logic in query
- [ ] Add filter UI (optional: by date range)

### Step 1.1.4: Update Navigation
- [ ] Add "Browse" link to main nav in `app/layout.tsx`
- [ ] Fix "Browse LingoConges" button on homepage to link to `/browse`
- [ ] Test navigation flow

**Files to create:**
- `app/browse/page.tsx`
- `app/browse/components/language-card.tsx`

**Files to modify:**
- `app/page.tsx` (fix Browse LingoConges link)
- `app/layout.tsx` (add Browse nav link)

---

## ✅ Task 1.2: Global Search Functionality

### Step 1.2.1: Create Search API Route
- [ ] Create `app/api/search/route.ts`
- [ ] Accept query parameter
- [ ] Search languages (name, description)
- [ ] Search dictionary entries (lemma, gloss, IPA)
- [ ] Search grammar pages (title, content)
- [ ] Return grouped results

### Step 1.2.2: Create Search Bar Component
- [ ] Create `components/search/search-bar.tsx`
- [ ] Add input with debounce
- [ ] Add keyboard shortcut (Cmd/Ctrl+K)
- [ ] Show dropdown with results preview
- [ ] Handle click outside to close

### Step 1.2.3: Create Search Results Page
- [ ] Create `app/search/page.tsx`
- [ ] Display results in tabs (LingoConges, Dictionary, Grammar)
- [ ] Highlight search terms
- [ ] Add pagination if needed

### Step 1.2.4: Add to Layout
- [ ] Add search bar to header in `app/layout.tsx`
- [ ] Make it responsive (hide on mobile, show icon)
- [ ] Test keyboard shortcut

**Files to create:**
- `app/api/search/route.ts`
- `components/search/search-bar.tsx`
- `components/search/search-results.tsx`
- `app/search/page.tsx`

**Files to modify:**
- `app/layout.tsx` (add search bar)

---

## ✅ Task 1.3: CSV Export for Dictionary

### Step 1.3.1: Create Export API Route
- [ ] Create `app/api/export/csv/route.ts`
- [ ] Accept languageId parameter
- [ ] Fetch dictionary entries
- [ ] Convert to CSV format
- [ ] Return as downloadable file

### Step 1.3.2: Add Export Button
- [ ] Add "Export CSV" button to dictionary manager
- [ ] Create handler function
- [ ] Trigger download
- [ ] Show success toast

**Files to create:**
- `app/api/export/csv/route.ts`

**Files to modify:**
- `app/studio/lang/[slug]/dictionary/dictionary-manager.tsx`

---

## ✅ Task 1.4: CSV Import for Dictionary

### Step 1.4.1: Create CSV Parser Utility
- [ ] Create `lib/utils/csv-parser.ts`
- [ ] Parse CSV string to array of objects
- [ ] Handle quoted fields
- [ ] Handle commas in fields

### Step 1.4.2: Create Import API Route
- [ ] Create `app/api/import/csv/route.ts`
- [ ] Accept file upload
- [ ] Parse CSV
- [ ] Validate entries
- [ ] Bulk insert with transaction
- [ ] Return results (success count, errors)

### Step 1.4.3: Add Import UI
- [ ] Add file upload button to dictionary manager
- [ ] Show file preview before import
- [ ] Display import progress
- [ ] Show errors if any
- [ ] Refresh dictionary after import

**Files to create:**
- `app/api/import/csv/route.ts`
- `lib/utils/csv-parser.ts`

**Files to modify:**
- `app/studio/lang/[slug]/dictionary/dictionary-manager.tsx`

---

## ✅ Task 1.5: Enhanced Landing Page

### Step 1.5.1: Fetch Featured LingoConges
- [ ] Query public languages in `app/page.tsx`
- [ ] Get 3-6 languages (most entries or recent)
- [ ] Include owner and stats

### Step 1.5.2: Create Featured LingoConges Component
- [ ] Create `components/featured-languages.tsx`
- [ ] Display languages as cards
- [ ] Link to language pages
- [ ] Add "View All" link to browse page

### Step 1.5.3: Update Landing Page Copy
- [ ] Improve hero section copy
- [ ] Add more compelling value proposition
- [ ] Update feature descriptions

**Files to create:**
- `components/featured-languages.tsx`

**Files to modify:**
- `app/page.tsx`

---

## ✅ Task 1.6: Mobile Responsiveness Audit

### Step 1.6.1: Test All Pages
- [ ] Test homepage on mobile viewport
- [ ] Test dashboard on mobile
- [ ] Test dictionary manager on mobile
- [ ] Test grammar editor on mobile
- [ ] Test browse page on mobile

### Step 1.6.2: Fix Table Responsiveness
- [ ] Create mobile-friendly table component
- [ ] Convert tables to cards on mobile
- [ ] Or make tables horizontally scrollable

### Step 1.6.3: Fix Forms
- [ ] Stack form inputs vertically on mobile
- [ ] Make buttons full-width on mobile
- [ ] Adjust spacing and padding

### Step 1.6.4: Fix Navigation
- [ ] Add hamburger menu for mobile
- [ ] Make nav items touch-friendly
- [ ] Test all navigation flows

**Files to modify:**
- All page components (add responsive classes)
- `components/ui/table.tsx` (add mobile variant)
- `app/layout.tsx` (mobile nav)

---

## ✅ Task 2.1: Basic Collaboration

### Step 2.1.1: Update Database Schema
- [ ] Add `LingoCongeCollaborator` model to `prisma/schema.prisma`
- [ ] Fields: id, languageId, userId, role (enum: OWNER, EDITOR, VIEWER)
- [ ] Add unique constraint on (languageId, userId)
- [ ] Create migration

### Step 2.1.2: Create Collaborator Actions
- [ ] Create `app/actions/collaborator.ts`
- [ ] Function: `inviteCollaborator(languageId, email, role)`
- [ ] Function: `removeCollaborator(languageId, userId)`
- [ ] Function: `updateCollaboratorRole(languageId, userId, role)`
- [ ] Function: `getCollaborators(languageId)`

### Step 2.1.3: Update Authorization
- [ ] Update `lib/auth-helpers.ts`
- [ ] Add function: `canEditLingoConge(userId, languageId)`
- [ ] Add function: `canViewLingoConge(userId, languageId)`
- [ ] Check collaborator permissions

### Step 2.1.4: Create Collaborator UI
- [ ] Create `app/studio/lang/[slug]/settings/collaborators.tsx`
- [ ] Add to settings page
- [ ] Show list of collaborators
- [ ] Add invite form
- [ ] Add remove/update role buttons

### Step 2.1.5: Update All Edit Actions
- [ ] Update dictionary actions to check collaboration
- [ ] Update grammar actions to check collaboration
- [ ] Update alphabet actions to check collaboration
- [ ] Update paradigm actions to check collaboration

**Files to create:**
- `app/actions/collaborator.ts`
- `app/studio/lang/[slug]/settings/collaborators.tsx`

**Files to modify:**
- `prisma/schema.prisma`
- `lib/auth-helpers.ts`
- All action files (add collaboration checks)
- `app/studio/lang/[slug]/settings/page.tsx`

---

## ✅ Task 2.2: Activity Feed

### Step 2.2.1: Create Activity Component
- [x] Create `components/activity-feed.tsx`
- [x] Display list of activities
- [x] Show: action, entity, user, timestamp
- [x] Group by date
- [x] Link to changed items

### Step 2.2.2: Add to Dashboard
- [x] Add activity section to `app/dashboard/page.tsx`
- [x] Fetch recent activities
- [x] Show activities across all user's languages

### Step 2.2.3: Add to LingoConge Page
- [x] Add activity section to `app/studio/lang/[slug]/page.tsx`
- [x] Fetch activities for that language
- [x] Show recent changes

**Files to create:**
- `components/activity-feed.tsx`
- `lib/utils/activity.ts`
- `prisma/schema.prisma` (Activity model)

**Files to modify:**
- `app/dashboard/page.tsx`
- `app/studio/lang/[slug]/page.tsx`
- `app/actions/dictionary-entry.ts` (activity tracking)

---

## ✅ Task 2.3: PDF Export

### Step 2.3.1: Install PDF Library
- [x] Install `@react-pdf/renderer` or `puppeteer`
- [x] Choose based on needs (client vs server)

### Step 2.3.2: Create PDF Template
- [x] Create `lib/utils/pdf-generator-server.tsx`
- [x] Design cover page
- [x] Design table of contents
- [x] Design content pages

### Step 2.3.3: Create Export API Route
- [x] Create `app/api/export/pdf/route.ts`
- [x] Fetch language data
- [x] Generate PDF
- [x] Return downloadable file

### Step 2.3.4: Add Export Button
- [x] Add "Export PDF" button to settings
- [x] Show loading state
- [x] Handle download

**Files to create:**
- `app/api/export/pdf/route.ts`
- `lib/utils/pdf-generator-server.tsx`

**Files to modify:**
- `app/studio/lang/[slug]/settings/language-settings.tsx`

---

## ✅ Task 2.4: Enhanced Dictionary Features

### Step 2.4.1: Add Etymology Field
- [x] Update `prisma/schema.prisma` - add `etymology` field
- [x] Update validation schemas
- [x] Update dictionary entry actions
- [x] Add etymology field to add/edit forms
- [x] Display etymology in dictionary table

### Step 2.4.2: Add Related Words
- [x] Update `prisma/schema.prisma` - add `relatedWords` JSON field
- [x] Update validation schemas
- [x] Update dictionary entry actions
- [x] Add relatedWords field to forms (prepared for future UI)

### Step 2.4.3: Bulk Edit Functionality
- [x] Create `components/dictionary/bulk-edit.tsx`
- [x] Add checkbox selection to dictionary table
- [x] Add "Bulk Edit" button
- [x] Implement bulk update action
- [x] Support updating part of speech and notes

**Files to create:**
- `components/dictionary/bulk-edit.tsx`
- `components/ui/checkbox.tsx` (via shadcn)

**Files to modify:**
- `prisma/schema.prisma`
- `lib/validations/dictionary-entry.ts`
- `app/actions/dictionary-entry.ts` (add bulkUpdateDictionaryEntries)
- `app/studio/lang/[slug]/dictionary/dictionary-manager.tsx`

---

## ✅ Task 3.1: Social Sharing

### Step 3.1.1: Add Open Graph Meta Tags
- [x] Update `app/lang/[slug]/page.tsx` (generateMetadata)
- [x] Generate dynamic meta tags
- [x] Include: title, description, URL

### Step 3.1.2: Create Share Buttons Component
- [x] Create `components/share-buttons.tsx`
- [x] Add Twitter share button
- [x] Add Reddit share button
- [x] Add Facebook share button
- [x] Add copy link button
- [x] Style appropriately

### Step 3.1.3: Add to LingoConge Pages
- [x] Add share buttons to `app/lang/[slug]/page.tsx`
- [x] Position prominently
- [x] Test sharing

**Files to create:**
- `components/share-buttons.tsx`

**Files to modify:**
- `app/lang/[slug]/page.tsx` (metadata and share buttons)

---

## ✅ Task 3.2: Favorites/Bookmarks

### Step 3.2.1: Add Favorite Model
- [x] Update `prisma/schema.prisma` - add Favorite model
- [x] Add unique constraint on userId + languageId
- [x] Add relations to User and LingoConge models
- [x] Run migration

### Step 3.2.2: Create Favorite Actions
- [x] Create `app/actions/favorite.ts`
- [x] Implement `toggleFavorite` action
- [x] Implement `getUserFavorites` action
- [x] Implement `checkIsFavorite` action

### Step 3.2.3: Create Favorite Button Component
- [x] Create `components/favorite-button.tsx`
- [x] Add heart icon with fill state
- [x] Handle toggle favorite
- [x] Show loading states
- [x] Only show for authenticated users

### Step 3.2.4: Add Favorite Button to LingoConge Cards
- [x] Add FavoriteButton to `app/browse/components/language-card.tsx`
- [x] Position next to visibility badge

### Step 3.2.5: Create Favorites Page
- [x] Create `app/favorites/page.tsx`
- [x] Fetch user's favorites
- [x] Display as grid of language cards
- [x] Show empty state

### Step 3.2.6: Add to Navigation
- [x] Add "Favorites" link to main nav (`app/page.tsx`)
- [x] Add "Favorites" link to mobile nav (`components/mobile-nav.tsx`)

**Files to create:**
- `app/actions/favorite.ts`
- `lib/validations/favorite.ts`
- `components/favorite-button.tsx`
- `app/favorites/page.tsx`

**Files to modify:**
- `prisma/schema.prisma`
- `app/browse/components/language-card.tsx`
- `app/page.tsx`
- `components/mobile-nav.tsx`

---

## ✅ Task 3.3: Follow Users

### Step 3.3.1: Add Follow Model
- [x] Update `prisma/schema.prisma` - add Follow model
- [x] Add unique constraint on followerId + followingId
- [x] Add relations to User model (followers and following)
- [x] Run migration

### Step 3.3.2: Create Follow Actions
- [x] Create `app/actions/follow.ts`
- [x] Implement `toggleFollow` action
- [x] Implement `getFollowers` action
- [x] Implement `getFollowing` action
- [x] Implement `checkIsFollowing` action
- [x] Implement `getFollowCounts` action

### Step 3.3.3: Create Follow Button Component
- [x] Create `components/follow-button.tsx`
- [x] Add follow/unfollow toggle
- [x] Show loading states
- [x] Prevent self-follow
- [x] Only show for authenticated users

### Step 3.3.4: Create User Profile Page
- [x] Create `app/users/[userId]/page.tsx`
- [x] Display user info (name, email, avatar)
- [x] Show user's public languages
- [x] Show followers and following lists
- [x] Display follow counts
- [x] Add tabs for languages/followers/following
- [x] Add follow button (if not own profile)

### Step 3.3.5: Add User Profile Links
- [x] Add link to owner profile in language cards
- [x] Make owner name clickable

**Files to create:**
- `app/actions/follow.ts`
- `lib/validations/follow.ts`
- `components/follow-button.tsx`
- `app/users/[userId]/page.tsx`
- `components/ui/tabs.tsx` (via shadcn)
- `components/ui/avatar.tsx` (via shadcn)

**Files to modify:**
- `prisma/schema.prisma`
- `app/browse/components/language-card.tsx`

---

## 🎯 Quick Start: First 3 Tasks

If you want to start implementing right away, begin with these three tasks in order:

1. **Task 1.1: Browse Page** - Enables discovery (highest impact)
2. **Task 1.2: Search** - Improves usability (high impact)
3. **Task 1.3: CSV Export** - Quick win, high user value

Each task is broken down into small, implementable steps. Check off each step as you complete it!

