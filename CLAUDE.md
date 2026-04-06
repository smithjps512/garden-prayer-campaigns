# Campaign Engine — CLAUDE.md

> **Purpose**: This file is the primary context document for Claude Code working on this project. It contains architecture decisions, technical constraints, current status, and active sprint instructions. Read this file completely before making any changes.

---

## Project Overview

**Garden Prayer Campaigns** is a closed-loop marketing automation system that generates content from strategic playbooks, distributes across social platforms, tracks performance, and autonomously optimizes. Built for **Melissa for Educators** (EdTech — priority launch target) and **Vaquero Homes** (Real Estate — secondary).

**Owner**: James (Garden Prayer Publishing LLC)
**Priority Business**: Melissa for Educators is the primary launch target. All work, testing, and optimization should prioritize this business context first.

**The Three Loops**: The entire system is built around three interlocking automation loops:
1. **Volume + Variety** — Continuously produce high-volume, varied content from playbook pillars, cycling through audience segments and content archetypes to ensure the market hears the message from every angle
2. **Conversion Attribution** — Connect performance data back to content attributes (which hook, which audience, which pillar, which archetype) to understand what's working and why
3. **Message Intelligence** — Amplify winners, retire losers, generate new variations to test, and iterate toward the messages that convert quality customers

## Tech Stack

- **Framework**: Next.js 16.1.6 with App Router, React 19, TypeScript
- **Database**: PostgreSQL via Supabase (Transaction pooler, port 6543, `?pgbouncer=true`)
- **ORM**: Prisma v5.22.0 (**NOT v7** — breaking changes with JsonValue types)
- **AI**: Anthropic Claude API (`@anthropic-ai/sdk`) for content generation, playbook generation, performance analysis, and recommendations
- **Storage**: Supabase Storage for images (S3-compatible)
- **Auth**: JWT sessions via `jose` + `bcryptjs`, HTTP-only cookies
- **Styling**: Tailwind CSS v4
- **Scheduling**: Vercel Cron Jobs + Postgres queue
- **Social**: Meta Graph API v21.0 (Facebook Pages + Instagram)
- **Deployment**: Vercel
- **Domain**: https://campaigns.gardenprayerpublishing.com

## Build & Run Commands

```bash
npm run dev              # Development server
npm run build            # prisma generate && next build (NEVER add db:push here)
npm run lint             # ESLint
npm run db:push          # Push schema to database (manual only, never in build)
npm run db:migrate       # Create migration
npm run db:seed          # Seed with initial data
npm run db:studio        # Prisma Studio GUI
```

**CRITICAL**: Build script must remain `prisma generate && next build` only. Schema changes are applied manually via Supabase SQL Editor. If schema changes are needed, output the SQL migration separately.

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
NEXT_PUBLIC_APP_URL=https://campaigns.gardenprayerpublishing.com

# Meta Integration
META_APP_ID=1385792786209425
META_APP_SECRET=your-meta-app-secret
META_REDIRECT_URI=https://campaigns.gardenprayerpublishing.com/api/meta/callback
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
- **No `prisma db push` in build script** — schema changes via Supabase SQL Editor only.

### Scheduling Architecture
**Vercel Cron + Postgres queue. NOT Redis/BullMQ.**

Active crons (`vercel.json`):
- `/api/cron/process-posts` — every 5 minutes (posts scheduled content to Meta)
- `/api/cron/poll-metrics` — every 30 minutes (pulls engagement data from Meta)
- `/api/cron/generate-content` — daily at 6 AM UTC (auto-generates content for active campaigns)
- `/api/cron/analyze-performance` — weekly Monday 8 AM UTC (AI analysis and recommendations)

All cron endpoints validate `CRON_SECRET` bearer token before processing.

**When to reconsider**: If posting volume exceeds 100+ posts/day or sub-minute scheduling precision is required, migrate to Redis/BullMQ on a dedicated worker service.

### Meta API Integration
- **OAuth scopes**: `pages_show_list`, `pages_manage_posts`, `pages_read_user_content`, `instagram_basic`, `instagram_content_publish`, `public_profile`
- **Token storage**: Page access tokens encrypted with AES-256-GCM in Business model
- **Token refresh**: Long-lived tokens (60 days) with automatic refresh before expiry
- **Rate limiting**: Exponential backoff on 429 responses
- **Platform differences**: Facebook single API call, Instagram two-step publish (create container → publish)
- **Error handling**: Meta API errors auto-create Escalations
- **OAuth flow**: Includes `auth_type=rerequest` to force permission re-prompting on reconnect
- **Debug logging**: Token introspection and `/me/accounts` response logging in callback for diagnostics

### Prisma JsonValue Type Casting (frequent gotcha)
```typescript
// Reading
const audiences = playbook.audiences as unknown as AudienceSegment[]
const hooks = playbook.hooks as unknown as Hook[]
// Writing
import { Prisma } from '@prisma/client'
data: { audiences: myArray as unknown as Prisma.InputJsonValue }
```

### Date Serialization in Server Components
```typescript
const createdAt = new Date(business.createdAt).toLocaleDateString()
// Use {createdAt} in JSX, NOT {business.createdAt.toLocaleDateString()}
```

### Paginated vs Direct API Responses
- `/api/businesses` returns paginated: `{ data: { items: [...], pagination: {...} } }`
- All other endpoints return direct arrays: `{ data: [...] }`
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
│   ├── (auth)/login/page.tsx
│   ├── (dashboard)/
│   │   ├── page.tsx                    # Dashboard home
│   │   ├── businesses/                 # CRUD + [slug] detail + Meta connection
│   │   ├── playbooks/                  # List + [id] detail/editor
│   │   ├── campaigns/                  # List + create + [id] detail with actions
│   │   ├── content/                    # Library + generation + inline editing + posting
│   │   ├── posts/                      # Post dashboard with status tracking
│   │   ├── images/                     # Image library + upload
│   │   ├── tasks/                      # Task management with complete/block actions
│   │   ├── analytics/                  # Performance metrics + post drill-down
│   │   ├── recommendations/            # AI recommendations with accept/dismiss
│   │   └── escalations/               # Issues with acknowledge/resolve/dismiss
│   └── api/
│       ├── auth/                       # login, logout, session
│       ├── businesses/                 # CRUD + [id]
│       ├── playbooks/                  # CRUD + [id] + parse + generate + activate
│       ├── campaigns/                  # CRUD + [id] + approve/launch/pause/resume/complete
│       ├── content/                    # CRUD + [id] + generate + score
│       ├── images/                     # CRUD + upload
│       ├── tasks/                      # CRUD + [id]/complete + [id]/block
│       ├── escalations/               # CRUD + [id] (acknowledge/resolve/dismiss)
│       ├── analytics/                  # Aggregated performance + message intelligence
│       ├── recommendations/            # CRUD + accept/dismiss/execute
│       ├── posts/                      # CRUD + [id] (retry/cancel)
│       ├── meta/                       # OAuth (auth, callback, pages, connect, disconnect)
│       ├── cron/                       # process-posts, poll-metrics, generate-content, analyze-performance
│       └── webhooks/                   # conversion tracking
├── components/
│   ├── Sidebar.tsx
│   ├── Header.tsx
│   └── ImageLibrary.tsx
└── lib/
    ├── auth.ts                         # JWT session management
    ├── prisma.ts                       # Prisma singleton
    ├── api.ts                          # Response helpers, pagination
    ├── claude.ts                       # Claude API: content gen, playbook gen, perf analysis, recommendations
    ├── scoring.ts                      # Performance scoring engine
    ├── storage.ts                      # Supabase file uploads
    ├── document-parser.ts              # PDF/DOCX/TXT/MD → structured playbook
    ├── image-matcher.ts                # Weighted image matching
    ├── meta.ts                         # Meta API client (posting, metrics, tokens, OAuth)
    └── utm.ts                          # UTM parameter generation
```

---

## Database Schema (Prisma)

15 models in `prisma/schema.prisma`:

| Model | Purpose | Key Fields |
|-------|---------|------------|
| User | Admin authentication | email, passwordHash |
| Business | Client organizations + Meta connection | name, slug, brandColors (JSON), settings (JSON), metaPageId, metaPageName, metaPageToken (encrypted), metaIgAccountId, metaConnectedAt, metaTokenExpiresAt |
| Playbook | Marketing strategy (brand DNA) | positioning, founderStory, audiences (JSON), hooks (JSON), keyMessages (JSON), objectionHandlers (JSON), visualDirection (JSON), content (JSON) |
| Campaign | Campaign execution + auto-mode | status (enum), targetAudience, channels (JSON), budgets, dates, successMetrics (JSON), autoMode |
| Content | Generated social content | headline, body, ctaText, hookSource, audienceSegment, pillar, archetype, performanceScore, scoredAt, generationMetadata (JSON) |
| Post | Posted to platforms | platform, status, scheduledFor, platformPostId, postedAt, errorMessage, targeting (JSON with UTM) |
| Image | Asset library | storageUrl, tags (JSON), usageCount |
| ImageRequest | Request for new images | description, suggestedPrompt, suggestedTags (JSON) |
| Task | Human/system tasks | assignee, type, status, priority, dependsOn |
| Escalation | Issues needing attention | type, severity, aiAnalysis, aiRecommendation |
| Performance | Engagement metrics | impressions, clicks, ctr, spend, roas |
| Conversion | Tracking conversions | type (click/signup/trial/purchase), utm params |
| Recommendation | AI-generated optimization suggestions | type (amplify/retire/test/iterate), title, reasoning, actionData (JSON), status |
| ActivityLog | Audit trail | actor, action, entityType, details (JSON) |

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

### Playbook as Brand DNA
The playbook is the most critical piece of the system. It contains core value pillars, brand voice rules, audience-specific angles, content variety archetypes, and message boundaries. The auto-generation engine references the playbook every time it generates content. A rich playbook = on-brand content at scale. The Melissa playbook has been fully enriched with:
- 3 Core Value Pillars (Time Back, Bigger Paycheck, Not ChatGPT)
- Cross-Pillar Theme (Individualization)
- Brand Voice (personality, tone, always/never rules, sentence style)
- 4 Audience Segments: **TIA Seekers**, **Time-Starved Teachers**, **True Believers**, **Tech-Hesitant Teachers**
- 8 Content Archetypes (pain-point, stat/proof, contrast, aspiration, myth-buster, teacher reality, individualization, outcome)
- Message Boundaries (claims, compliance, tone guardrails)
- Founder Story

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

### Campaign Auto-Mode
```
off              → Manual content generation and posting
generate-only    → Auto-generates content to keep pipeline full, human reviews and posts
generate-and-post → Full autonomous — generates, approves, schedules, posts
```
Auto-mode is a per-campaign toggle that can be changed at any time from the campaign detail page.

### Content Generation
```
POST /api/content/generate { campaignId, count?, contentType?, platform? }
```
Claude generates platform-optimized variations using playbook context (positioning, audiences, hooks). Auto-matches images using weighted algorithm.

### Auto-Generation Pipeline
```
Cron checks pipeline depth → Below threshold? → Generate batch from playbook
→ Tag with pillar, archetype, audience → Status: generated (or auto-approved if generate-and-post mode)
→ Auto-schedule if generate-and-post → Process cron posts to Meta
```
Variety enforcement: tracks recent pillar/archetype/audience usage, biases new generation toward underrepresented combinations.

### Meta Posting Flow
```
Content (approved) → Schedule Post → Cron posts to Meta → Metrics cron polls engagement
→ Performance scorer calculates composite scores → Message intelligence identifies patterns
→ AI recommendations generated → Accepted recommendations trigger new content/retirements
```

**Facebook posting**: Single API call with message + link/image attachment
**Instagram posting**: Two-step flow — (1) create media container with image URL + caption, (2) publish container

### Performance Scoring
```
Metrics in → Weighted composite score (conversions highest, then CTR, then engagement, then reach)
→ Score stored on Content → Rankings available → Feeds into message intelligence
```

---

## API Response Format

```typescript
// Success
{ success: true, data: <payload> }
// Error
{ success: false, error: "Error message" }
// Paginated (businesses only)
{ success: true, data: { items: [...], pagination: { page, limit, total, totalPages } } }
```

---

## Authentication

- Default admin: `admin@campaignengine.local` / `admin123` (via ADMIN_EMAIL/ADMIN_PASSWORD env vars)
- JWT stored in HTTP-only cookie `campaign-engine-session` (7-day expiry)
- Dashboard layout checks session and redirects to `/login` if missing
- API routes use `ensureAuthenticated()` which throws if no valid session
- Cron endpoints use `CRON_SECRET` bearer token (no JWT required)
- Webhook endpoints validate payload structure (no auth)
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
| Custom Domain | ✅ Live | campaigns.gardenprayerpublishing.com → Vercel CNAME, SSL active |
| Meta Facebook | ⚠️ Partially connected | OAuth completes, but dashboard doesn't show connection. Waiting on Meta App Review for Advanced Access |
| Meta Instagram | ⚠️ Linked but blocked | IG Business account (@melissaforeducators) linked to FB Page. Same App Review blocker |
| Meta App Review | 🔄 In progress | Business verified. Privacy policy created. Awaiting Advanced Access approval for page/IG permissions |
| Vercel Cron | ✅ Active | 4 crons: process-posts (5min), poll-metrics (30min), generate-content (daily 6AM UTC), analyze-performance (weekly Mon 8AM UTC) |
| Tests | ❌ None | No test files, no test runner configured |
| CI/CD | ❌ None | No GitHub Actions or deployment pipelines |
| Error Monitoring | ❌ None | Sentry planned for Sprint 6D |

### Meta Integration — Detailed Status

The Meta connection issue has been thoroughly diagnosed:

**What works:**
- OAuth flow completes successfully (user authorizes, token exchanged)
- Token is valid with correct scopes (confirmed via debug_token introspection)
- Business Integrations on Facebook shows Garden Prayer Campaigns as active with full permissions
- Instagram account linked to Facebook Page

**What doesn't work:**
- `/me/accounts` returns `data: []` — no pages listed
- This is confirmed in Meta's own Graph API Explorer (not a code bug)
- Root cause: Facebook Login for Business app type requires Advanced Access for page enumeration in Development mode

**What was already fixed (Sprint 6A):**
- Added `pages_show_list` to OAuth scopes
- Replaced deprecated `pages_read_engagement` with `pages_read_user_content`
- Added `auth_type=rerequest` to force permission re-prompting on reconnect
- Added debug_token introspection and `/me/accounts` response logging in callback
- Registered Melissa For Educators page (ID: 909420422264955) in developer console

**Resolution path:**
1. Meta App Review approves Advanced Access permissions
2. Reconnect Meta in Campaign Engine
3. `/me/accounts` should return the page
4. Dashboard will show connection
5. Test posting to Facebook and Instagram

**DO NOT spend time debugging this further until App Review completes.**

---

## Current Sprint: Sprint 6B — Live Campaign Bug Fixes + UX

> **Objective**: Fix bugs discovered during live campaign testing, improve UX, and get the Campaign Engine to a state where we can record a screencast for Meta App Review.

See `SPRINT_STATUS.md` for detailed task tracking.

### Priority 1: Fix Content Generation (BLOCKING)

**Bug 1 — Audience segment lookup crash (500 error)**
- `/api/content/generate` throws: `Audience segment "Tia Seekers" not found in playbook`
- Root cause: Audience lookup is case-sensitive and doesn't handle comma-separated strings
- **Fix:** Make lookup case-insensitive. Split comma-separated audience strings. Return helpful 400 error listing available segments if not found.

**Bug 2 — Campaign audience field is free-text (UX problem)**
- Free-text input causes typos, case mismatches, and invalid segment names
- **Fix:** Replace with multi-select dropdown populated from the linked playbook's audience segments. When playbook is selected, fetch its segments and display as checkboxes/multi-select.

**Bug 3 — Campaign launch returns 400**
- `/api/campaigns/[id]/launch` returns 400 with unclear error
- **Fix:** Investigate validation, improve error messages to tell user exactly what prerequisite is missing.

### Priority 2: Content Generation Quality
Once bugs are fixed:
- Verify AI-generated content quality matches playbook strategy
- Check platform-specific formatting (Facebook vs Instagram)
- Ensure content variety (not repeating same posts)
- Test full flow: Generate → Review → Approve → Schedule

### Priority 3: Meta Integration Display (WAITING — do not block)
- Waiting on Meta App Review for Advanced Access approval
- Once approved: reconnect, verify dashboard display, test posting

### Priority 4: General Polish
- Add `export const dynamic = 'force-dynamic'` to business detail page (fixes stale cache)
- Ensure all API errors return descriptive `error` field in JSON body
- Frontend should display actual API error messages, not generic failures

---

## Sprint Roadmap

| Sprint | Focus | Status |
|--------|-------|--------|
| 1 | Foundation | ✅ Complete |
| 2 | Playbooks + Content | ✅ Complete |
| 3 | Campaigns + Tasks | ✅ Complete |
| 3.5 | Document Upload | ✅ Complete |
| 3.5F | Frontend Completion | ✅ Complete |
| 4 | Meta Integration | ✅ Complete |
| 5 | Intelligence + Automation | ✅ Complete |
| **6A** | **Instagram + Custom Domain** | **✅ Complete** |
| **6B** | **Live Campaign Bug Fixes** | **🔄 Active** |
| 6C | Paid Ads Foundation | Planned |
| 6D | Production Hardening | Planned |

---

## Sprint History

| Sprint | Scope | Status | Notes |
|--------|-------|--------|-------|
| 1 | Foundation | ✅ Complete | Auth, dashboard, business CRUD |
| 2 | Playbooks + Content | ✅ Complete | AI generation, document parsing, content engine |
| 3 | Campaigns + Tasks | ✅ Complete | Full lifecycle API, task management |
| 3.5 | Document Upload | ✅ Complete | PDF/DOCX parsing → Claude extraction |
| 3.5F | Frontend Gaps | ✅ Complete | Campaign detail, task actions, content gen/edit, escalation actions, analytics |
| 4A | Meta OAuth + Connection | ✅ Complete | OAuth flow, token encryption, page selector, connection UI |
| 4B | Posting Engine | ✅ Complete | Facebook/IG posting, post status tracking, auto-escalation |
| 4C | Scheduling + Queue | ✅ Complete | Vercel Cron, post processing, schedule UI, UTM generation |
| 4D | Metrics + Tracking | ✅ Complete | Metrics polling, conversion webhook, analytics update |
| 5A | Playbook Enrichment | ✅ Complete | 3 pillars, brand voice, audience angles, archetypes, boundaries, founder story |
| 5B | Performance Scoring | ✅ Complete | Composite scoring, content tagging, message intelligence API |
| 5C | Auto-Generation Pipeline | ✅ Complete | Content pipeline cron, auto-scheduling, campaign auto-mode toggle |
| 5D | AI Recommendations | ✅ Complete | Weekly analysis cron, recommendation CRUD, accept/dismiss actions |
| 5E | Analytics Charts | ✅ Complete | Time-series charts, performance visualization |
| 6A | Instagram + Custom Domain | ✅ Complete | Custom domain live, OAuth scope fixes, IG linking, debug logging |
| 6B | Live Campaign Bug Fixes | 🔄 Active | Audience lookup crash, UX improvements, launch validation |

### Deferred Items
- **Paid ads** — Meta Ads API, boost top performers, lookalike audience targeting (Sprint 6C)
- **Image picker component** — reusable image browser for content reassignment
- **Production hardening** — testing infrastructure, CI/CD, error monitoring, Sentry (Sprint 6D)
- **Multi-user access** — currently single admin user

---

## Fixed Issues (Do Not Re-Investigate)

| Issue | Root Cause | Fix | Sprint |
|-------|-----------|-----|--------|
| **Playbook upload `ERR_UPLOAD_FILE_CHANGED`** | Browser holds a reference to the on-disk file. If the file changes between selection and upload (common with recently converted `.pptx→.pdf` or cloud-synced files), Chrome aborts the request. | Read file contents into `ArrayBuffer` immediately on selection (`addFiles()` in `playbooks/page.tsx`). Reconstruct `File` objects from in-memory buffers at upload time in `handleParseDocuments()`. | 7A |
| **Meta `/me/accounts` returns empty in Development mode** | Facebook Login for Business app type requires Advanced Access for page enumeration. In Development mode, `/me/accounts` returns `data: []` even with valid tokens and correct scopes. Not a code bug. | Added manual Page ID + Token override form in `MetaConnection.tsx` + `/api/meta/manual-connect` endpoint. Bypasses OAuth page enumeration entirely. | 7A |
| **Instagram publish without status polling** | Original `postToInstagram()` went directly from container creation to publish without checking container readiness. Could fail silently on large images or slow processing. | Added status polling loop (max 10 polls, 3s interval) between container creation and publish. Added `InstagramPublishError` class for rate limits, invalid aspect ratio, and inaccessible media URLs. | 7A |
| **Content generation pillars hardcoded to Melissa** | `CONTENT_GENERATION_PROMPT` in `claude.ts` had hardcoded pillar list (`time-back`, `bigger-paycheck`, `not-chatgpt`). Other businesses got misclassified content. | Changed prompt to infer pillars dynamically from business positioning and audience context. | 7B |
| **UTM links not in post body text** | `process-posts` cron passed UTM-tagged URL only as Meta `link` param (preview card), not in the message text. Instagram appended it separately but Facebook posts had no visible tracking link. | Append UTM-tagged link to message body for all platforms. Fall back to `business.websiteUrl` when content has no `ctaUrl`. Enforce platform character limits after appending. | 7C |

---

## Session Rules for Claude Code
- Start fresh each session — do not assume previous session state
- Read CLAUDE.md and SPRINT_STATUS.md completely before making changes
- Run `npx tsc --noEmit` before committing — zero errors required
- Run lint check before committing — no new errors
- Test API endpoints with curl when possible
- Check Vercel deployment succeeds after push
- Schema changes go through Supabase SQL Editor — output SQL migration separately
- Never add `db:push` to the build script
