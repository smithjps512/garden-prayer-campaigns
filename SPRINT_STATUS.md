# Sprint Status — Garden Prayer Campaigns

> **Last Updated**: February 19, 2026
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

### Phase 4B: Posting Engine

#### Posting Service (`src/lib/meta.ts` — extend)
- [ ] `postToFacebook(pageId, token, { message, link?, imageUrl? })`
- [ ] `postToInstagram(igAccountId, token, { imageUrl, caption })` (two-step publish)
- [ ] Platform-specific content formatting (FB text+link, IG image+caption)
- [ ] Return `platformPostId` on success
- [ ] Auto-create Escalation on failure

#### Post Creation API
- [ ] `POST /api/posts` — create post from approved Content
- [ ] `GET /api/posts` — list posts with filters (campaign, status, platform)
- [ ] `PATCH /api/posts/[id]` — retry failed, cancel scheduled
- [ ] Content → Post field mapping (headline + body → message, CTA → link)
- [ ] Validate Meta connection exists before allowing post
- [ ] Immediate post flow: status `posting` → Meta API → `posted`/`failed`

#### "Post Now" UI
- [ ] "Post" button on approved content cards
- [ ] Platform selector (Facebook, Instagram, or both)
- [ ] Post preview (how it'll look on each platform)
- [ ] Confirmation dialog with loading state
- [ ] Success/failure feedback
- [ ] Update content status after posting

#### Post Status Tracking
- [ ] Posts tab on campaign detail page (or standalone `/posts` page)
- [ ] Status badges: scheduled, posting, posted, failed
- [ ] Failed posts: show error message + "Retry" button
- [ ] Link to live post on platform
- [ ] Post count on campaign cards

### Phase 4C: Scheduling + Queue

#### Vercel Cron Setup
- [ ] Create `vercel.json` with cron configuration
- [ ] `/api/cron/process-posts` — every 5 minutes
- [ ] `/api/cron/poll-metrics` — every 30 minutes
- [ ] `CRON_SECRET` validation middleware

#### Post Processing Cron (`/api/cron/process-posts`)
- [ ] Query: `scheduledFor <= now AND status = 'scheduled'` (limit 10)
- [ ] Process each: `posting` → Meta API → `posted`/`failed`
- [ ] Activity logging for each processed post
- [ ] Handle partial failures (don't stop batch on single failure)
- [ ] Return processing summary in response

#### Schedule UI
- [ ] "Schedule" option alongside "Post Now"
- [ ] Date/time picker for scheduled posts
- [ ] Scheduled posts queue view (list with cancel/reschedule)
- [ ] Visual indicator of next scheduled post on dashboard

#### UTM Parameter Generation (`src/lib/utm.ts`)
- [ ] UTM generation utility function
- [ ] Pattern: `utm_source={platform}&utm_medium=social&utm_campaign={slug}&utm_content={id}`
- [ ] Auto-apply to all outbound links in posts
- [ ] Store UTM string on Post model

### Phase 4D: Metrics + Tracking

#### Metrics Polling Cron (`/api/cron/poll-metrics`)
- [ ] Query posted posts from last 30 days
- [ ] Call Meta API for: impressions, reach, clicks, reactions, comments, shares
- [ ] Upsert into Performance model
- [ ] Exponential backoff on rate limits
- [ ] Activity logging

#### Conversion Webhook
- [ ] `POST /api/webhooks/conversion` — receive conversion events
- [ ] Parse UTM params → map to Campaign and Content
- [ ] Create Conversion record (click, signup, trial, purchase)
- [ ] Payload validation (no auth, but structure check)

#### Analytics Dashboard Update
- [ ] Verify real post data displays correctly in existing analytics page
- [ ] Add post-level drill-down (which post drove which metrics)
- [ ] Add "Last Updated" timestamp from most recent metrics poll
- [ ] Test with real data from Meta test page

---

## Definition of Done — Sprint 4

- [ ] Meta connection can be established and disconnected from business settings
- [ ] A Melissa campaign can be posted to test Facebook Page from the UI
- [ ] Posts can be scheduled and are processed automatically by cron
- [ ] Engagement metrics are pulled from Meta and visible in analytics
- [ ] UTM parameters are auto-generated on all outbound links
- [ ] Conversion webhook endpoint is functional
- [ ] Error states create escalations automatically
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
