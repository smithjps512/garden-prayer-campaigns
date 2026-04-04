# Architecture Overview — Garden Prayer Campaigns

> **Last Updated**: April 4, 2026
> **Purpose**: Comprehensive technical reference for sprint planning and onboarding new development contexts. This document reflects the actual codebase state, not aspirational design.

---

## 1. System Summary

Garden Prayer Campaigns is a closed-loop marketing automation platform that:
1. Generates social content from strategic playbooks using Claude AI
2. Distributes content to Facebook and Instagram via Meta Graph API
3. Tracks performance metrics and conversion attribution
4. Autonomously optimizes through AI-driven recommendations

**Primary client**: Melissa for Educators (EdTech)
**Secondary client**: Vaquero Homes (Real Estate — not yet onboarded)

**Production URL**: https://campaigns.gardenprayerpublishing.com (Vercel)

---

## 2. Tech Stack

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Framework | Next.js (App Router) | 16.1.6 | React 19, TypeScript strict mode |
| Database | PostgreSQL | — | Via Supabase Transaction Pooler (port 6543, `?pgbouncer=true`) |
| ORM | Prisma | 5.22.0 | **Must stay on v5** — v7 has breaking JsonValue/enum changes |
| AI | Anthropic Claude API | SDK 0.72.1 | Claude Sonnet 4 (claude-sonnet-4-20250514) for all generation |
| Storage | Supabase Storage | 2.93.3 | S3-compatible, `images` bucket |
| Auth | JWT (jose 6.1.3) + bcryptjs | — | HTTP-only cookies, 7-day expiry |
| Styling | Tailwind CSS | 4.x | PostCSS plugin, no component library |
| Charts | Recharts | 3.7.0 | Time-series, heatmaps, bar charts |
| Scheduling | Vercel Cron Jobs | — | 4 crons, Postgres-backed queue |
| Social | Meta Graph API | v21.0 | Facebook Pages + Instagram Business |
| Deployment | Vercel | — | Serverless functions, edge middleware |

### Dependencies Not Actively Used
- `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` are in package.json but storage is handled through Supabase client. These may be vestigial or reserved for future direct S3 access.

---

## 3. Project Structure

```
src/
├── app/
│   ├── (auth)/login/              # Login page + auth layout
│   ├── (dashboard)/               # Protected dashboard (17 pages)
│   │   ├── page.tsx               # Dashboard home (server component)
│   │   ├── analytics/             # 871 lines — 3 tabs: Overview, Trends, Message Intelligence
│   │   ├── businesses/            # CRUD + Meta connection management
│   │   ├── campaigns/             # List + detail (1451 lines — largest page)
│   │   ├── content/               # Library + generation + inline editing (1087 lines)
│   │   ├── playbooks/             # List + detail/editor (1019 lines)
│   │   ├── posts/                 # Post dashboard with status tracking
│   │   ├── images/                # Image library + upload
│   │   ├── tasks/                 # Task management with complete/block actions
│   │   ├── recommendations/       # AI recommendations with accept/dismiss
│   │   └── escalations/           # Issues with acknowledge/resolve/dismiss
│   └── api/                       # 47 route files (see Section 7)
├── components/                    # Only 2 shared components (Sidebar, Header)
├── middleware.ts                   # Auth middleware — session verification on all routes
└── lib/                           # 10 utility files, 2,305 total lines
    ├── api.ts         (112 lines) # Response helpers, pagination
    ├── auth.ts        (103 lines) # JWT sessions, password hashing
    ├── claude.ts      (489 lines) # AI content gen, playbook gen, recommendations
    ├── document-parser.ts (289 lines) # PDF/DOCX → structured playbook via Claude
    ├── image-matcher.ts   (261 lines) # Weighted image matching algorithm
    ├── meta.ts        (520 lines) # Meta Graph API client (posting, metrics, OAuth, encryption)
    ├── prisma.ts       (15 lines) # Prisma singleton
    ├── scoring.ts     (297 lines) # Performance scoring, auto-retirement
    ├── storage.ts     (135 lines) # Supabase file uploads
    └── utm.ts          (84 lines) # UTM parameter generation
```

### Frontend Stats
- **17 pages**, ~9,600 lines of TSX
- **18 client components** (interactive data tables, forms, modals)
- **4 server components** (dashboard home, business detail/edit, images)
- **0 shared UI component library** — all styling is inline Tailwind
- **3 page-specific components** (DeleteBusinessButton, MetaConnection, ImageLibrary)

---

## 4. Database Schema

### 15 Models

| Model | Records | Purpose | Key Relations |
|-------|---------|---------|---------------|
| **User** | 1 (admin) | Authentication | — |
| **Business** | Active | Client organizations + Meta connection | → Playbook[], Image[], Conversion[] |
| **Playbook** | Active | Marketing strategy (brand DNA) | → Business, Campaign[] |
| **Campaign** | Active | Campaign execution + auto-mode | → Playbook, Content[], Task[], Escalation[], Recommendation[] |
| **Content** | Growing | Generated social content | → Campaign, Image?, Post[] |
| **Post** | Growing | Published to Meta platforms | → Content, Performance[], Conversion[] |
| **Image** | Growing | Asset library | → Business, Content[] |
| **ImageRequest** | Low | Requests for new images | → Business, Campaign?, Image? |
| **Task** | Per campaign | Human/system tasks | → Campaign, self-referencing dependency chain |
| **Escalation** | Event-driven | Issues needing attention | → Campaign |
| **Performance** | Per metric poll | Engagement metrics per post | → Post |
| **Conversion** | Event-driven | Click/signup/trial/purchase tracking | → Business, Post?, Content?, Campaign? |
| **Recommendation** | Weekly batch | AI optimization suggestions | → Campaign |
| **ActivityLog** | Continuous | Audit trail | → Business?, Campaign? |

### Key JSON Fields
These store structured data that varies per record. All require `as unknown as Type` casting due to Prisma v5:

| Model.Field | Stores |
|------------|--------|
| Business.brandColors | `{primary, accent, ...}` |
| Business.settings | General config |
| Playbook.audiences | Array of audience segments with names, descriptions, pain points, hooks |
| Playbook.hooks | Array of hook templates |
| Playbook.keyMessages | Messages organized by segment |
| Playbook.content | Full playbook content bundle (pillars, voice, archetypes, boundaries) |
| Campaign.channels | `["facebook", "instagram"]` |
| Campaign.successMetrics | `{subscribers, cac, ...}` |
| Content.generationMetadata | AI generation parameters and context |
| Content.platformVariants | Platform-specific content adaptations |
| Post.targeting | Platform targeting + UTM params |
| Image.tags | `{segments: [], emotions: [], themes: []}` |
| Recommendation.actionData | Structured data for executing the recommendation |

### Enum Reference

| Enum | Values |
|------|--------|
| PlaybookStatus | draft, active, archived |
| CampaignStatus | draft, review, approved, setup, live, paused, completed, failed |
| ContentStatus | generated, approved, scheduled, posted, paused, retired |
| PostStatus | draft, scheduled, posting, posted, failed, deleted |
| ConversionType | click, signup, trial, purchase |
| TaskStatus | pending, in_progress, completed, blocked |
| TaskAssignee | human, system |
| EscalationType | below_threshold, persistent_failure, budget_depleted, anomaly_detected, strategic_question |
| EscalationSeverity | info, warning, critical |
| EscalationStatus | open, acknowledged, resolved, dismissed |

### Cascade Behavior
- Deleting a **Business** cascades to Playbook, Image, Conversion, ActivityLog
- Deleting a **Playbook** cascades to Campaign
- Deleting a **Campaign** cascades to Content, Task, Escalation, Recommendation
- Deleting a **Content** cascades to Post
- Deleting a **Post** cascades to Performance
- Conversions, ImageRequests use **SetNull** on parent delete (preserving analytics data)

---

## 5. Authentication & Authorization

- **Single admin user** — no multi-user, no roles, no RBAC
- Default credentials: `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars (seeded on first run)
- JWT signed with HS256 using `AUTH_SECRET`, stored in HTTP-only cookie `campaign-engine-session`
- Middleware (`src/middleware.ts`) enforces auth on all routes except: `/login`, `/api/auth/login`, `/_next`, `/favicon.ico`, `/api/webhooks`
- Cron endpoints authenticate via `CRON_SECRET` bearer token (no JWT)
- **No API keys, no OAuth for users, no session revocation mechanism**

---

## 6. Core Workflows

### 6.1 Playbook Creation
```
Upload PDF/DOCX/TXT → pdfjs-dist/mammoth parse → Claude extracts structure → Review/Edit → Save
       OR
Fill business brief form → Claude generates complete playbook → Review/Edit → Save
```
The playbook is the foundation. Content generation quality depends entirely on playbook richness.

### 6.2 Campaign Lifecycle
```
draft → approved (auto-creates tasks) → setup (human tasks complete) → live → paused/completed
                                                                              ↘ failed
```
**Auto-mode options** (per campaign):
- `off` — manual content generation and posting
- `generate-only` — auto-generates content, human reviews and posts
- `generate-and-post` — full autonomous loop

### 6.3 Content Generation Pipeline
```
Campaign + Playbook context → Claude API → 4+ variations per audience/hook combo
  → Tagged with pillar, archetype, audience segment
  → Auto-matched to images (weighted: segment 40%, emotion 30%, theme 20%, usage 10%)
  → Status: generated (or auto-approved if generate-and-post mode)
```

### 6.4 Publishing Flow
```
Content (approved) → Schedule Post → Cron processes every 5 min
  → Facebook: single API call (message + attachment)
  → Instagram: two-step (create container → publish)
  → On failure: auto-creates Escalation, marks Post as failed
```

### 6.5 Intelligence Loop
```
Metrics cron (every 30 min) → Pull engagement from Meta
  → Performance scorer: weighted composite (conversions > CTR > engagement > reach)
  → Score stored on Content (0-100 scale)
  → Auto-retire bottom 20th percentile (requires 5+ items, 500+ impressions each)
  → Weekly AI analysis → Recommendations (amplify/retire/test/iterate)
  → Human accepts/dismisses → Feeds back into content generation
```

---

## 7. API Surface

**47 route files** across 14 resource groups.

### Resource Routes
| Resource | Endpoints | Methods | Notes |
|----------|-----------|---------|-------|
| auth | 3 | POST, GET | login, logout, session |
| businesses | 3 | GET, POST, PUT, DELETE | Paginated list (unique among all endpoints) |
| playbooks | 5 | GET, POST, PUT, DELETE | + generate, parse, activate actions |
| campaigns | 8 | GET, POST, PUT, DELETE | + approve, launch, pause, resume, complete |
| content | 6 | GET, POST, PUT, DELETE | + generate, score, backfill-tags |
| posts | 3 | GET, POST, PUT, DELETE | Posting creates Meta API calls |
| images | 4 | GET, POST, PUT, DELETE | + upload endpoint |
| tasks | 4 | GET, PUT | + complete, block actions |
| escalations | 2 | GET, PUT, DELETE | + acknowledge, resolve, dismiss |
| recommendations | 2 | GET, PUT | + accept, dismiss, execute |
| analytics | 3 | GET | overview, time-series, message-intelligence |
| meta | 3 | GET, POST | OAuth auth, callback, disconnect |
| cron | 4 | GET | process-posts, poll-metrics, generate-content, analyze-performance |
| webhooks | 1 | POST | conversion tracking |

### Response Format
```typescript
// Standard
{ success: true, data: <payload> }
{ success: false, error: "message" }

// Paginated (businesses only)
{ success: true, data: { items: [...], pagination: { page, limit, total, totalPages } } }
```

---

## 8. Cron Jobs & Automation

| Cron | Schedule | Purpose | Key Logic |
|------|----------|---------|-----------|
| process-posts | Every 5 min | Post scheduled content to Meta | Picks up `scheduled` posts where `scheduledFor <= now` |
| poll-metrics | Every 30 min | Pull engagement data from Meta | Updates Performance records, triggers scoring + auto-retire |
| generate-content | Daily 6 AM UTC | Auto-generate content pipeline | Maintains 10-item buffer, enforces variety across pillars/archetypes/audiences |
| analyze-performance | Weekly Mon 8 AM UTC | AI performance analysis | Generates Recommendation records (amplify/retire/test/iterate) |

All crons validate `CRON_SECRET` bearer token. Defined in `vercel.json`.

---

## 9. External Integrations

### Meta Graph API v21.0
- **Status**: OAuth flow works. Blocked on Meta App Review for Advanced Access (pages/IG permissions)
- **Token flow**: Short-lived → Long-lived (60 days) → stored encrypted (AES-256-GCM) in Business model
- **Scopes**: pages_show_list, pages_manage_posts, pages_read_user_content, instagram_basic, instagram_content_publish, public_profile
- **Error handling**: Typed MetaError class with rate-limit detection, exponential backoff (2s/4s/8s)
- **Known issue**: `/me/accounts` returns empty in Development mode — requires Advanced Access approval

### Anthropic Claude API
- **Model**: claude-sonnet-4-20250514 (4096-8192 token budget per call)
- **Used for**: Content generation, playbook generation from documents, content tagging/classification, performance analysis, recommendation generation
- **JSON parsing**: Regex-based extraction from Claude responses (fragile — no structured output validation)
- **Cost exposure**: No token tracking, no budget caps, no rate limiting on generation endpoints

### Supabase Storage
- **Bucket**: `images`
- **Path pattern**: `businesses/{slug}/images/{uuid}.{ext}`
- **Limits**: JPEG/PNG/GIF/WebP, max 10MB
- **Access**: Public URLs for served images

---

## 10. Known Technical Debt

### Critical
1. **Zero test coverage** — no test files, no test runner, no test framework configured
2. **Zero CI/CD** — no GitHub Actions, no deployment pipeline, no pre-merge checks
3. **No error monitoring** — no Sentry, no structured logging, no alerting
4. **Single admin user** — no multi-user support, no RBAC, no audit per-user

### Significant
5. **Large page components** — Campaign detail (1451 lines), Content (1087 lines), Playbooks (1019 lines), Analytics (871 lines) need decomposition
6. **Only 2 shared components** — massive code duplication across pages (data tables, modals, status badges, action buttons are reimplemented per page)
7. **AI JSON parsing is fragile** — uses regex extraction from Claude responses; no schema validation; failures silently produce bad data
8. **Hardcoded scoring benchmarks** — impressions=1K, reach=800, CTR=2%, engagement=3% in scoring.ts; not configurable per business/industry
9. **No token/cost tracking** — Claude API calls have no metering; could exceed budget without visibility
10. **Prisma v5 JsonValue casting** — every JSON field read requires `as unknown as Type`; error-prone and not type-safe at runtime

### Minor
11. **AWS S3 SDK in dependencies** but not used in code — should be removed or documented
12. **SPRINT_STATUS.md is stale** — still says "Current Sprint: Sprint 5" but CLAUDE.md shows Sprint 6B is active
13. **No database indexes beyond defaults** — no explicit indexes on frequently queried fields (campaignId, status, scheduledFor)
14. **No rate limiting on API endpoints** — all endpoints are open to abuse behind auth
15. **Empty next.config.ts** — no image optimization, no security headers, no custom middleware config

---

## 11. Infrastructure Status

| Item | Status | Details |
|------|--------|---------|
| Production deployment | Active | Vercel, custom domain with SSL |
| Database | Active | Supabase PostgreSQL, transaction pooler |
| Storage | Active | Supabase Storage, images bucket |
| Cron jobs | Active | 4 crons in vercel.json |
| Meta Facebook | Blocked | OAuth works, App Review pending for Advanced Access |
| Meta Instagram | Blocked | IG Business account linked, same App Review blocker |
| Tests | None | No framework, no files |
| CI/CD | None | No pipeline |
| Error monitoring | None | Sentry planned |
| Multi-user | None | Single admin only |

---

## 12. Sprint History & Current State

| Sprint | Focus | Status |
|--------|-------|--------|
| 1 | Foundation (auth, dashboard, business CRUD) | Complete |
| 2 | Playbooks + Content (AI generation, document parsing) | Complete |
| 3 | Campaigns + Tasks (lifecycle API, task management) | Complete |
| 3.5 | Document Upload (PDF/DOCX parsing → Claude extraction) | Complete |
| 3.5F | Frontend Completion (campaign detail, task actions, content gen/edit) | Complete |
| 4A-4D | Meta Integration (OAuth, posting, scheduling, metrics) | Complete |
| 5A-5E | Intelligence + Automation (scoring, auto-gen, recommendations, charts) | Complete |
| 6A | Instagram + Custom Domain | Complete |
| **6B** | **Live Campaign Bug Fixes + UX** | **Active** |

### Sprint 6B Active Work
- Audience segment lookup crash — fixed (case-insensitive, comma-separated handling)
- Campaign audience multi-select dropdown — implemented (replaces free-text)
- Campaign launch error messages — improved
- Meta display issue — waiting on App Review (do not debug further)

### Planned Sprints
- **6C**: Paid Ads Foundation (Meta Ads API, boost top performers, lookalike audiences)
- **6D**: Production Hardening (testing infrastructure, CI/CD, error monitoring, Sentry)

### Deferred Items
- Image picker component (reusable image browser)
- Campaign comparison overlay in analytics charts
- Multi-user access with roles

---

## 13. Environment Variables Required

```
DATABASE_URL          # Supabase PostgreSQL connection (port 6543, ?pgbouncer=true)
NEXT_PUBLIC_SUPABASE_URL  # Supabase project URL
SUPABASE_SERVICE_ROLE_KEY # Supabase service role key
AUTH_SECRET           # JWT signing secret (min 32 chars)
ADMIN_EMAIL           # Seed admin email
ADMIN_PASSWORD        # Seed admin password
ANTHROPIC_API_KEY     # Claude API key
NEXT_PUBLIC_APP_URL   # Production URL
META_APP_ID           # Meta app ID
META_APP_SECRET       # Meta app secret
META_REDIRECT_URI     # OAuth callback URL
CRON_SECRET           # Bearer token for cron endpoint auth
```

---

## 14. Build & Deploy

```bash
npm run build    # prisma generate && next build (NEVER add db:push)
npm run dev      # Development server
npm run lint     # ESLint
npm run db:push  # Manual only — push schema to database
npm run db:seed  # Seed admin user
```

**Critical constraints**:
- Schema changes go through Supabase SQL Editor — output SQL migration separately
- Never add `db:push` to the build script
- Run `npx tsc --noEmit` before committing (zero errors required)
- Prisma must stay on v5.x
