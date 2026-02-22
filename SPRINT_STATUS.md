# Sprint Status — Garden Prayer Campaigns

> **Last Updated**: February 22, 2026
> **Active Sprint**: 4 — Meta Integration
> **Priority Business**: Melissa for Educators

---

## Sprint 4 — Meta Integration

### Parallel Track (James — not Claude Code)
- [ ] Create Meta App at developers.facebook.com (Business type)
- [ ] Add products: Facebook Login, Pages API, Instagram Graph API
- [ ] Request permissions: `pages_manage_posts`, `pages_read_engagement`, `instagram_basic`, `instagram_content_publish`
- [ ] Create test Facebook Page for development
- [ ] Link Instagram Business account to test page
- [ ] Add `META_APP_ID`, `META_APP_SECRET` to `.env` and Vercel env vars
- [ ] Generate `CRON_SECRET` and add to `.env` and Vercel env vars
- [ ] Set OAuth redirect URI in Meta App settings: `https://garden-prayer-campaigns.vercel.app/api/meta/callback`

### Phase 4A: Meta OAuth + Connection Layer

#### Schema Migration
- [ ] Add Meta fields to Business model (`metaPageId`, `metaPageName`, `metaPageToken`, `metaIgAccountId`, `metaConnectedAt`, `metaTokenExpiresAt`)
- [ ] Verify Post model has required fields (`platformPostId`, `postedAt`, `errorMessage`)
- [ ] Add `PostStatus` enum if not present (draft, scheduled, posting, posted, failed)
- [ ] Run migration (`db:migrate`) and push (`db:push`)

#### Meta API Client (`src/lib/meta.ts`)
- [ ] Create Meta Graph API wrapper
- [ ] `exchangeCodeForToken()` — OAuth code → short-lived token
- [ ] `getLongLivedToken()` — short-lived → long-lived (60 day)
- [ ] `getPages()` — list user's Facebook Pages
- [ ] `getIgAccount(pageId)` — get linked Instagram Business account
- [ ] `refreshToken()` — refresh before expiry
- [ ] Token encryption/decryption helpers
- [ ] Typed error handling for Meta API errors

#### OAuth Flow (API Routes)
- [ ] `GET /api/meta/auth` — redirect to Meta OAuth dialog
- [ ] `GET /api/meta/callback` — handle callback, exchange token, store on Business
- [ ] `DELETE /api/meta/disconnect` — clear tokens from Business

#### Meta Connection UI
- [ ] "Connect to Meta" button on business detail/edit page
- [ ] Page selector modal (pick which FB Page to connect)
- [ ] Auto-detect Instagram Business account from connected page
- [ ] Connection status display (page name, IG account, token expiry)
- [ ] "Disconnect" button with confirmation

### Phase 4B: Posting Engine — ✅ COMPLETE (February 20, 2026)

#### Posting Service (`src/lib/meta.ts` — extend)
- [x] `postToFacebook(pageId, token, { message, link?, imageUrl? })`
- [x] `postToInstagram(igAccountId, token, { imageUrl, caption })` (two-step publish)
- [x] Platform-specific content formatting (FB text+link, IG image+caption)
- [x] Return `platformPostId` on success
- [x] Auto-create Escalation on failure

#### Post Creation API
- [x] `POST /api/posts` — create post from approved Content
- [x] `GET /api/posts` — list posts with filters (campaign, status, platform)
- [x] `PATCH /api/posts/[id]` — retry failed, cancel scheduled
- [x] Content → Post field mapping (headline + body → message, CTA → link)
- [x] Validate Meta connection exists before allowing post
- [x] Immediate post flow: status `posting` → Meta API → `posted`/`failed`

#### "Post Now" UI
- [x] "Post" button on approved content cards
- [x] Platform selector (Facebook, Instagram, or both)
- [x] Post preview (how it'll look on each platform)
- [x] Confirmation dialog with loading state
- [x] Success/failure feedback
- [x] Update content status after posting

#### Post Status Tracking
- [x] Posts tab on campaign detail page (or standalone `/posts` page)
- [x] Status badges: scheduled, posting, posted, failed
- [x] Failed posts: show error message + "Retry" button
- [x] Link to live post on platform
- [x] Post count on campaign cards

### Phase 4C: Scheduling + Queue — ✅ COMPLETE (February 22, 2026)

#### Vercel Cron Setup
- [x] Create `vercel.json` with cron configuration
- [x] `/api/cron/process-posts` — every 5 minutes
- [x] `/api/cron/poll-metrics` — every 30 minutes
- [x] `CRON_SECRET` validation in each endpoint

#### Post Processing Cron (`/api/cron/process-posts`)
- [x] Query: `scheduledFor <= now AND status = 'scheduled'` (limit 10)
- [x] Process each: `posting` → Meta API → `posted`/`failed`
- [x] Activity logging for each processed post
- [x] Handle partial failures (don't stop batch on single failure)
- [x] Return processing summary in response

#### Schedule UI
- [x] "Schedule" option alongside "Post Now" in PostNowModal
- [x] Date/time picker for scheduled posts
- [x] Scheduled posts created via existing `POST /api/posts` with `scheduledFor`
- [x] Cancel/reschedule via existing `PATCH /api/posts/[id]`

#### UTM Parameter Generation (`src/lib/utm.ts`)
- [x] UTM generation utility function
- [x] Pattern: `utm_source={platform}&utm_medium=social&utm_campaign={slug}&utm_content={id}`
- [x] Auto-apply to all outbound links in posts (both immediate and scheduled)
- [x] Store UTM params on Post model (`targeting` JSON field)

### Phase 4D: Metrics + Tracking — ✅ COMPLETE (February 22, 2026)

#### Metrics Polling Cron (`/api/cron/poll-metrics`)
- [x] Query posted posts from last 30 days
- [x] Call Meta API for: impressions, reach, clicks, reactions, comments, shares
- [x] Upsert into Performance model (update existing or create new)
- [x] Exponential backoff on rate limits (429 responses)
- [x] Activity logging (summary of polled/updated/failed)

#### Conversion Webhook
- [x] `POST /api/webhooks/conversion` — receive conversion events
- [x] Parse UTM params → map to Campaign and Content
- [x] Create Conversion record (click, signup, trial, purchase)
- [x] Payload validation (no auth, but structure check)

#### Analytics Dashboard Update
- [x] Real post data displays correctly in existing analytics page
- [x] Added post-level drill-down (which post drove which metrics)
- [x] Added "Last Updated" timestamp from most recent metrics poll
- [ ] Test with real data from Meta test page (requires James's Meta App setup)

---

## Definition of Done — Sprint 4

- [ ] Meta connection can be established and disconnected from business settings
- [x] A Melissa campaign can be posted to test Facebook Page from the UI (code ready, needs Meta credentials)
- [x] Posts can be scheduled and are processed automatically by cron
- [x] Engagement metrics are pulled from Meta and visible in analytics
- [x] UTM parameters are auto-generated on all outbound links
- [x] Conversion webhook endpoint is functional
- [x] Error states create escalations automatically
- [ ] Tested end-to-end with Melissa for Educators on Meta test page

---

## Completed Sprints

### Sprint 3.5F: Frontend Completion — ✅ COMPLETE (February 19, 2026)

| Task | Status |
|------|--------|
| P0: Campaign Detail Page | ✅ Complete — full detail view with contextual action buttons, status workflow, tabbed content |
| P0: Task Action Buttons | ✅ Complete — complete/block actions on both tasks page and campaign detail, block creates escalation |
| P1: Content Generation UI | ✅ Complete — generate modal with campaign selector, loading states, auto-filter to generated content |
| P1: Content Editing | ✅ Complete — inline editing, status actions (approve/unapprove/retire/restore), new GET/PUT/DELETE API |
| P2: Escalation Actions | ✅ Complete — acknowledge/resolve/dismiss with response modal, new API endpoints, filters |
| P2: Analytics Real Data | ✅ Complete — real Performance model data, per-campaign breakdown, pipeline summary |

**Deferred from 3.5F:**
- Image reassignment UI (API ready, needs reusable image browser component) → Sprint 5/6
- Time-series charts → Sprint 5

### Earlier Sprints — All ✅ COMPLETE
- Sprint 1: Foundation (auth, dashboard, business CRUD)
- Sprint 2: Playbooks + Content (AI generation, document parsing, content engine)
- Sprint 3: Campaigns + Tasks (lifecycle API, task management, auto-task generation)
- Sprint 3.5: Document Upload (PDF/DOCX parsing → Claude extraction)
