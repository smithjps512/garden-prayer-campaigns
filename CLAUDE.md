# Campaign Engine — CLAUDE.md

> **Purpose**: This file is the primary context document for Claude Code working on this project. It contains architecture decisions, technical constraints, current status, and active sprint instructions. Read this file completely before making any changes.

---

## Project Overview

**Garden Prayer Campaigns** is a closed-loop marketing automation system that generates content from strategic playbooks, distributes across social platforms, tracks performance, and autonomously optimizes. Built for **Melissa for Educators** (EdTech — priority launch target) and **Vaquero Homes** (Real Estate — secondary).

**Owner**: James (Garden Prayer Publishing LLC)
**Priority Business**: Melissa for Educators is the primary launch target. All integration work, testing, and sample data should prioritize this business context first.

## Tech Stack

- **Framework**: Next.js 16.1.6 with App Router, React 19, TypeScript
- **Database**: PostgreSQL via Supabase (Transaction pooler, port 6543, `?pgbouncer=true`)
- **ORM**: Prisma v5.22.0 (**NOT v7** — breaking changes with JsonValue types)
- **AI**: Anthropic Claude API (`@anthropic-ai/sdk`) for content/playbook generation
- **Storage**: Supabase Storage for images (S3-compatible)
- **Auth**: JWT sessions via `jose` + `bcryptjs`, HTTP-only cookies
- **Styling**: Tailwind CSS v4
- **Scheduling**: Vercel Cron Jobs + Postgres queue (see Architecture Decisions)
- **Deployment**: Vercel

## Build & Run Commands

```bash
npm run dev              # Development server
npm run build            # prisma generate && next build
npm run lint             # ESLint
npm run db:push          # Push schema to database
npm run db:migrate       # Create migration
npm run db:seed          # Seed with initial data
npm run db:studio        # Prisma Studio GUI
```

## Environment Variables

Required in `.env` (see `.env.example`):

```
# Database
DATABASE_URL=postgresql://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:6543/postgres

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[ref].supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Auth
AUTH_SECRET=your-secret-key-at-least-32-characters-long
ADMIN_EMAIL=admin@campaignengine.local
ADMIN_PASSWORD=admin123

# AI
ANTHROPIC_API_KEY=sk-ant-...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Meta Integration (Sprint 4)
META_APP_ID=your-meta-app-id
META_APP_SECRET=your-meta-app-secret
META_REDIRECT_URI=https://garden-prayer-campaigns.vercel.app/api/meta/callback
CRON_SECRET=your-cron-secret-key
```

**Note on CRON_SECRET**: Vercel Cron Jobs call API endpoints publicly. The `CRON_SECRET` is sent as a bearer token in the `Authorization` header. All cron endpoints must validate this token before processing.

---

## Architecture Decisions & Constraints

### Critical — Do Not Change
- **Prisma v5 only**. v7 has breaking changes with enum types and JsonValue handling. Do not upgrade.
- **Supabase Transaction pooler** (port 6543) with `?pgbouncer=true`. Port 5432 will fail.
- **JWT auth via HTTP-only cookies** — no client-side token storage, no third-party auth providers.
- **API response format** must follow existing pattern (see API section below).

### Scheduling Architecture Decision (Sprint 4)
**Using Vercel Cron + Postgres queue. NOT Redis/BullMQ.**

Rationale: Redis + BullMQ requires a second hosting service, adds operational complexity, and introduces a new failure point — all for a pre-launch platform with two businesses. The simpler approach:

- The existing `Post` model already has `scheduledFor` and `status` fields — this IS the queue
- Vercel Cron Job hits `/api/cron/process-posts` every 5 minutes
- That endpoint queries `WHERE scheduledFor <= now AND status = 'scheduled'`, posts to Meta, updates status
- A second cron `/api/cron/poll-metrics` runs every 30 minutes to pull engagement data
- All cron endpoints validate `CRON_SECRET` before processing

**When to reconsider**: If posting volume exceeds 100+ posts/day or sub-minute scheduling precision is required, migrate to Redis/BullMQ on a dedicated worker service.

### Meta API Integration Patterns (Sprint 4)
- **Token storage**: Page access tokens stored encrypted in Business model (new `metaPageToken` field, encrypted at rest)
- **Token refresh**: Long-lived tokens (60 days) with automatic refresh before expiry
- **Rate limiting**: Meta API rate limits are per-page. Implement exponential backoff on 429 responses
- **Platform differences**: Facebook accepts text+link+image posts directly. Instagram requires an image and uses a two-step publish flow (create media container → publish)
- **Error handling**: Meta API errors should create Escalations automatically (same pattern as task blocking)

### Prisma JsonValue Type Casting (frequent gotcha)
Prisma v5 JSON fields return `JsonValue` type. Always cast when accessing typed properties:
```typescript
// Reading
const audiences = playbook.audiences as unknown as AudienceSegment[]
const hooks = playbook.hooks as unknown as Hook[]

// Writing
import { Prisma } from '@prisma/client'
data: { audiences: myArray as unknown as Prisma.InputJsonValue }
```

### Date Serialization in Server Components
Prisma Date objects can't call `.toLocaleDateString()` directly in Next.js Server Components:
```typescript
const createdAt = new Date(business.createdAt).toLocaleDateString()
// Use {createdAt} in JSX, NOT {business.createdAt.toLocaleDateString()}
```

### Paginated vs Direct API Responses
- `/api/businesses` returns paginated: `{ data: { items: [...], pagination: {...} } }`
- `/api/playbooks`, `/api/campaigns`, etc. return direct arrays: `{ data: [...] }`
- Client components fetching businesses must extract `.data.items`

### PDF Parsing
- `pdf-parse` npm package requires DOM APIs — breaks in Node.js server
- Use `pdfjs-dist` instead with dynamic import for server-side text extraction
- DOCX parsing uses `mammoth` (works fine server-side)

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/login/page.tsx           # Login page
│   ├── (dashboard)/                    # Protected routes (session required)
│   │   ├── page.tsx                    # Dashboard home (stats, activity)
│   │   ├── businesses/                 # CRUD + [slug] detail + edit
│   │   ├── playbooks/                  # List + [id] detail/editor
│   │   ├── campaigns/                  # List + create + [id] detail with actions
│   │   ├── content/                    # Content library + generation + inline editing
│   │   ├── images/                     # Image library + upload
│   │   ├── tasks/                      # Task management with complete/block actions
│   │   ├── analytics/                  # Performance metrics (real data from Performance model)
│   │   └── escalations/               # Issues with acknowledge/resolve/dismiss actions
│   └── api/
│       ├── auth/                       # login, logout, session
│       ├── businesses/                 # CRUD + [id]
│       ├── playbooks/                  # CRUD + [id] + parse + generate + activate
│       ├── campaigns/                  # CRUD + [id] + approve/launch/pause/resume/complete
│       ├── content/                    # CRUD + [id] + generate
│       ├── images/                     # CRUD + upload
│       ├── tasks/                      # CRUD + [id]/complete + [id]/block
│       ├── escalations/               # CRUD + [id] (acknowledge/resolve/dismiss)
│       ├── analytics/                  # Aggregated performance data
│       ├── meta/                       # 🔄 Sprint 4: OAuth callback, webhooks
│       └── cron/                       # 🔄 Sprint 4: process-posts, poll-metrics
├── components/
│   ├── Sidebar.tsx                     # Navigation sidebar
│   ├── Header.tsx                      # Top header with user menu
│   └── ImageLibrary.tsx                # Reusable image picker
└── lib/
    ├── auth.ts                         # JWT session management
    ├── prisma.ts                       # Prisma singleton
    ├── api.ts                          # Response helpers, pagination
    ├── claude.ts                       # Claude API: content gen, playbook gen, perf analysis
    ├── storage.ts                      # Supabase file uploads
    ├── document-parser.ts              # PDF/DOCX/TXT/MD → structured playbook via Claude
    ├── image-matcher.ts                # Weighted image matching
    └── meta.ts                         # 🔄 Sprint 4: Meta API client (posting, metrics, tokens)
```

---

## Database Schema (Prisma)

14 models in `prisma/schema.prisma`:

| Model | Purpose | Key Fields |
|-------|---------|------------|
| User | Admin authentication | email, passwordHash |
| Business | Client organizations | name, slug, brandColors (JSON), settings (JSON) |
| Playbook | Marketing strategy docs | positioning, founderStory, audiences (JSON), hooks (JSON), keyMessages (JSON), objectionHandlers (JSON), visualDirection (JSON), content (JSON) |
| Campaign | Campaign execution | status (enum workflow), targetAudience, channels (JSON), budgets, dates, successMetrics (JSON) |
| Content | Generated social content | headline, body, ctaText, hookSource, audienceSegment, generationMetadata (JSON) |
| Post | Posted to platforms | platform (fb/ig/twitter), status, scheduledFor, budgetSpent |
| Image | Asset library | storageUrl, tags (JSON: segments/emotions/themes), usageCount |
| ImageRequest | Request for new images | description, suggestedPrompt, suggestedTags (JSON) |
| Task | Human/system tasks | assignee (human/system), type, status, priority, dependsOn |
| Escalation | Issues needing attention | type, severity, aiAnalysis, aiRecommendation |
| Performance | Engagement metrics | impressions, clicks, ctr, spend, roas |
| Conversion | Tracking conversions | type (click/signup/trial/purchase), utm params |
| ActivityLog | Audit trail | actor, action, entityType, details (JSON) |

### Schema Changes Required for Sprint 4

The following fields need to be added to existing models. Create a migration for these:

**Business model** — Meta connection fields:
- `metaPageId` (String, optional) — Facebook Page ID
- `metaPageName` (String, optional) — Display name for connected page
- `metaPageToken` (String, optional) — Encrypted long-lived page access token
- `metaIgAccountId` (String, optional) — Instagram Business Account ID
- `metaConnectedAt` (DateTime, optional) — When Meta was connected
- `metaTokenExpiresAt` (DateTime, optional) — Token expiry for refresh scheduling

**Post model** — verify these fields exist (they should from Sprint 1 schema):
- `platform` — fb, ig, twitter
- `status` — draft, scheduled, posting, posted, failed
- `scheduledFor` — DateTime
- `platformPostId` (String, optional) — Meta's post ID for metrics polling
- `postedAt` (DateTime, optional) — Actual post time
- `errorMessage` (String, optional) — Failure details

### Enum Statuses

- **PlaybookStatus**: draft, active, archived
- **CampaignStatus**: draft → review → approved → setup → live → paused → completed / failed
- **ContentStatus**: generated, approved, scheduled, posted, paused, retired
- **PostStatus**: draft, scheduled, posting, posted, failed
- **TaskStatus**: pending, in_progress, completed, blocked
- **TaskAssignee**: human, system

**Important**: Prisma enums use PascalCase names but lowercase values. Database columns use snake_case via `@map()`.

---

## Key Workflows

### Playbook Creation (two methods)
1. **Upload Materials**: Upload PDF/DOCX/TXT/MD → parsed by pdfjs-dist/mammoth → Claude extracts structured playbook → review/edit → save
2. **AI Generate**: Fill in business brief form → Claude generates complete playbook

### Campaign Lifecycle
```
draft → approved (auto-generates tasks) → setup (when human tasks complete) → live → paused/completed
```

On approval, system creates:
- Human tasks: Review Content, Upload Images, Setup Meta Ads
- System tasks: Generate Initial Content, Match Images, Generate UTM params

### Content Generation
```
POST /api/content/generate { campaignId, count?, contentType?, platform? }
```
Claude generates platform-optimized variations using playbook context (positioning, audiences, hooks). Auto-matches images using weighted algorithm.

### Meta Posting Flow (Sprint 4)
```
Content (approved) → Schedule Post (select datetime + platform) → Post queued in Post model
→ Cron picks up at scheduledFor → Posts to Meta API → Updates status to posted/failed
→ Metrics cron polls engagement data → Writes to Performance model → Analytics dashboard shows results
```

**Facebook posting**: Single API call with message + link/image attachment
**Instagram posting**: Two-step flow — (1) create media container with image URL + caption, (2) publish container

---

## API Response Format

All API routes follow this pattern:
```typescript
// Success
{ success: true, data: <payload> }

// Error
{ success: false, error: "Error message" }

// Paginated (businesses only currently)
{ success: true, data: { items: [...], pagination: { page, limit, total, totalPages } } }
```

---

## Authentication

- Default admin: `admin@campaignengine.local` / `admin123` (via ADMIN_EMAIL/ADMIN_PASSWORD env vars)
- JWT stored in HTTP-only cookie `campaign-engine-session` (7-day expiry)
- Dashboard layout checks session and redirects to `/login` if missing
- API routes use `ensureAuthenticated()` which throws if no valid session
- Cron endpoints use `CRON_SECRET` bearer token (no JWT required)
- If login fails after fresh deploy, verify the seed script created the admin user

---

## File Upload

Images upload to Supabase Storage bucket `images`:
- Path: `businesses/{slug}/images/{uuid}.{ext}`
- Accepts: JPEG, PNG, GIF, WebP (max 10MB)
- Returns public URL for immediate use
- Tags stored as JSON: `{ segments: [], emotions: [], themes: [] }`

---

## Infrastructure Status

| Item | Status | Notes |
|------|--------|-------|
| Tests | ❌ None | No test files, no test runner configured |
| CI/CD | ❌ None | No GitHub Actions or deployment pipelines |
| Docker | ❌ None | No containerization |
| Redis/BullMQ | ⏭️ Not needed | Using Vercel Cron + Postgres queue instead (see Architecture Decisions) |
| Meta API | 🔄 In progress | Meta App being created, test page access available. App Review pending for production |
| Vercel Cron | 🔜 Sprint 4C | Will configure in `vercel.json` |

---

## Current Sprint: Sprint 4 — Meta Integration

> **Objective**: Connect the platform to Meta (Facebook/Instagram) APIs to enable real social media posting, scheduling, and performance tracking. Uses Vercel Cron + Postgres queue for scheduling (no Redis). All work should be testable against James's Meta test page.

See `SPRINT_STATUS.md` for detailed task tracking and completion status.

### Phase 4A: Meta OAuth + Connection Layer
**Goal**: Let a business connect their Facebook Page and Instagram account.

1. **Meta API Client** (`src/lib/meta.ts`)
   - Wrapper around Meta Graph API (Facebook Pages API + Instagram Graph API)
   - Token exchange: short-lived → long-lived page access token
   - Token encryption for storage, decryption for use
   - Methods: `exchangeToken()`, `getPages()`, `getIgAccount()`, `refreshToken()`
   - Error handling with typed Meta API errors

2. **OAuth Flow**
   - `GET /api/meta/auth` — Redirect to Meta OAuth dialog with required permissions
   - `GET /api/meta/callback` — Handle OAuth callback, exchange code for token, store encrypted token
   - Permissions requested: `pages_manage_posts`, `pages_read_engagement`, `instagram_basic`, `instagram_content_publish`

3. **Business Settings — Meta Connection UI**
   - "Connect to Meta" button on business edit/detail page
   - Page selector (user may have multiple pages — let them pick)
   - Instagram account auto-detection from connected page
   - Connection status display (connected page name, token expiry)
   - "Disconnect" option that clears stored tokens

4. **Schema Migration**
   - Add Meta fields to Business model (see Schema Changes section above)
   - Run migration and verify with `db:push`

### Phase 4B: Posting Engine
**Goal**: Post approved content to Facebook and Instagram from the UI.

1. **Posting Service** (`src/lib/meta.ts` — extend)
   - `postToFacebook(pageId, token, { message, link?, imageUrl? })` — Single API call
   - `postToInstagram(igAccountId, token, { imageUrl, caption })` — Two-step: create container → publish
   - Handle platform-specific formatting (FB supports text-only, IG requires image)
   - Return `platformPostId` for later metrics polling
   - Auto-create Escalation on API failure (severity based on error type)

2. **Post Creation API**
   - `POST /api/posts` — Create a post from approved Content
   - Map Content fields to platform format (headline + body → message, ctaText → link text)
   - Attach image from Content's matched image
   - Validate business has Meta connection before allowing post
   - For immediate posting: set status to `posting`, call Meta API, update to `posted` or `failed`

3. **"Post Now" UI**
   - Button on content cards (only for approved content with connected business)
   - Platform selector (Facebook, Instagram, or both)
   - Preview of how the post will look on each platform
   - Confirmation dialog → post → show success/failure
   - Update content status to `posted`

4. **Post Status Tracking**
   - Posts list page or tab on campaign detail showing all posts
   - Status badges: scheduled, posting, posted, failed
   - Failed posts show error message and "Retry" button
   - Link to live post on platform (using `platformPostId`)

### Phase 4C: Scheduling + Queue
**Goal**: Schedule posts for future dates, process them automatically via cron.

1. **Vercel Cron Configuration** (`vercel.json`)
   ```json
   {
     "crons": [
       { "path": "/api/cron/process-posts", "schedule": "*/5 * * * *" },
       { "path": "/api/cron/poll-metrics", "schedule": "*/30 * * * *" }
     ]
   }
   ```

2. **Post Processing Cron** (`/api/cron/process-posts`)
   - Validate `CRON_SECRET` bearer token
   - Query: `Post WHERE scheduledFor <= now AND status = 'scheduled' ORDER BY scheduledFor ASC LIMIT 10`
   - For each post: set status `posting` → call Meta API → set `posted` or `failed`
   - Log results to ActivityLog
   - Handle partial failures (some posts succeed, others fail in same batch)

3. **Schedule UI**
   - Extend "Post Now" to include "Schedule" option with date/time picker
   - Show scheduled posts in a queue view (calendar or list)
   - Cancel/reschedule actions for queued posts
   - Visual indicator of next scheduled post

4. **UTM Parameter Generation**
   - Auto-generate UTM params for all outbound links: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`
   - Pattern: `?utm_source=facebook&utm_medium=social&utm_campaign={campaign-slug}&utm_content={content-id}`
   - Store UTM params on Post model for conversion tracking
   - Utility function in `src/lib/utm.ts`

### Phase 4D: Metrics + Tracking
**Goal**: Pull engagement data from Meta and track conversions.

1. **Metrics Polling Cron** (`/api/cron/poll-metrics`)
   - Validate `CRON_SECRET` bearer token
   - Query: `Post WHERE status = 'posted' AND postedAt > (now - 30 days)`
   - For each post: call Meta API for impressions, reach, clicks, reactions, comments, shares
   - Upsert into Performance model (create or update)
   - Handle rate limiting with exponential backoff

2. **Conversion Webhook** (`/api/webhooks/conversion`)
   - Receives conversion events (from UTM-tagged traffic hitting your site)
   - Maps UTM params back to Campaign and Content
   - Creates Conversion record with type (click, signup, trial, purchase)
   - No auth required (webhook) but validate payload structure

3. **Analytics Dashboard Update**
   - The analytics page already reads from Performance model (built in Sprint 3.5F)
   - Verify it displays real post data correctly once metrics start flowing
   - Add post-level drill-down if not present
   - Add "Last Updated" timestamp from most recent metrics poll

### Definition of Done for Sprint 4
- A Melissa for Educators campaign can be posted to a test Facebook Page from the UI
- Posts can be scheduled for future dates and are processed automatically by cron
- Engagement metrics are pulled from Meta and visible in the analytics dashboard
- UTM parameters are auto-generated on all outbound links
- Conversion webhook endpoint is functional
- Meta connection can be established and disconnected from business settings
- Error states create escalations automatically

---

## Sprint Roadmap

| Sprint | Focus | Status |
|--------|-------|--------|
| 1 | Foundation | ✅ Complete |
| 2 | Playbooks + Content | ✅ Complete |
| 3 | Campaigns + Tasks | ✅ Complete |
| 3.5 | Document Upload | ✅ Complete |
| 3.5F | Frontend Completion | ✅ Complete |
| **4** | **Meta Integration** | **🔄 Active** |
| 5 | Analytics engine + optimization | Not started |
| 6 | Polish + production launch | Not started |

---

## Sprint History

| Sprint | Scope | Backend | Frontend | Notes |
|--------|-------|---------|----------|-------|
| 1 | Foundation | ✅ Complete | ✅ Complete | Auth, dashboard, business CRUD all working |
| 2 | Playbooks + Content | ✅ Complete | ✅ Complete | AI generation, document parsing, content generation + editing |
| 3 | Campaigns + Tasks | ✅ Complete | ✅ Complete | Full lifecycle API + campaign detail page + task actions |
| 3.5 | Document Upload | ✅ Complete | ✅ Complete | PDF/DOCX parsing → Claude extraction |
| 3.5F | Frontend Gaps | — | ✅ Complete | Campaign detail, task actions, content gen/edit, escalation actions, analytics real data |

### Deferred Items (from Sprint 3.5F)
- **Image reassignment UI** — API supports it (`PUT /api/content/[id]` with `imageId`), needs reusable image browser component. Target: Sprint 5 or 6.
- **Time-series charts** — Analytics shows aggregate data. Time-series charts planned for Sprint 5 with full analytics engine.
