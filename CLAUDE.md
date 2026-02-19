# Campaign Engine — CLAUDE.md

> **Purpose**: This file is the primary context document for Claude Code working on this project. It contains architecture decisions, technical constraints, current status, and active sprint instructions. Read this file completely before making any changes.

---

## Project Overview

**Garden Prayer Campaigns** is a closed-loop marketing automation system that generates content from strategic playbooks, distributes across social platforms, tracks performance, and autonomously optimizes. Built for **Melissa for Educators** (EdTech — priority launch target) and **Vaquero Homes** (Real Estate — secondary).

**Owner**: James (Garden Prayer Publishing LLC)
**Priority Business**: Melissa for Educators is the primary launch target. All frontend completion work, seed data, and testing should prioritize this business context first.

## Tech Stack

- **Framework**: Next.js 16.1.6 with App Router, React 19, TypeScript
- **Database**: PostgreSQL via Supabase (Transaction pooler, port 6543, `?pgbouncer=true`)
- **ORM**: Prisma v5.22.0 (**NOT v7** — breaking changes with JsonValue types)
- **AI**: Anthropic Claude API (`@anthropic-ai/sdk`) for content/playbook generation
- **Storage**: Supabase Storage for images (S3-compatible)
- **Auth**: JWT sessions via `jose` + `bcryptjs`, HTTP-only cookies
- **Styling**: Tailwind CSS v4
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
DATABASE_URL=postgresql://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:6543/postgres
NEXT_PUBLIC_SUPABASE_URL=https://[ref].supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
AUTH_SECRET=your-secret-key-at-least-32-characters-long
ADMIN_EMAIL=admin@campaignengine.local
ADMIN_PASSWORD=admin123
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Architecture Decisions & Constraints

### Critical — Do Not Change
- **Prisma v5 only**. v7 has breaking changes with enum types and JsonValue handling. Do not upgrade.
- **Supabase Transaction pooler** (port 6543) with `?pgbouncer=true`. Port 5432 will fail.
- **JWT auth via HTTP-only cookies** — no client-side token storage, no third-party auth providers.
- **API response format** must follow existing pattern (see API section below).

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
│   │   ├── campaigns/                  # List + create modal ⚠️ MISSING detail page
│   │   ├── content/                    # Generated content library ⚠️ display-only
│   │   ├── images/                     # Image library + upload
│   │   ├── tasks/                      # Task management ⚠️ read-only
│   │   ├── analytics/                  # Performance metrics ⚠️ placeholder only
│   │   └── escalations/               # Issues requiring attention ⚠️ no actions
│   └── api/
│       ├── auth/                       # login, logout, session
│       ├── businesses/                 # CRUD + [id]
│       ├── playbooks/                  # CRUD + [id] + parse + generate + activate
│       ├── campaigns/                  # CRUD + [id] + approve/launch/pause/resume/complete
│       ├── content/                    # CRUD + generate
│       ├── images/                     # CRUD + upload
│       └── tasks/                      # CRUD + [id]/complete + [id]/block
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
    └── image-matcher.ts                # Weighted image matching (40% segment, 30% emotion, 20% theme, 10% usage)
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

### Enum Statuses

- **PlaybookStatus**: draft, active, archived
- **CampaignStatus**: draft → review → approved → setup → live → paused → completed / failed
- **ContentStatus**: generated, approved, scheduled, posted, paused, retired
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
- If login fails after fresh deploy, verify the seed script created the admin user

---

## File Upload

Images upload to Supabase Storage bucket `images`:
- Path: `businesses/{slug}/images/{uuid}.{ext}`
- Accepts: JPEG, PNG, GIF, WebP (max 10MB)
- Returns public URL for immediate use
- Tags stored as JSON: `{ segments: [], emotions: [], themes: [] }`

---

## Infrastructure Status (as of restart)

| Item | Status | Notes |
|------|--------|-------|
| Tests | ❌ None | No test files, no test runner configured |
| CI/CD | ❌ None | No GitHub Actions or deployment pipelines |
| Docker | ❌ None | No containerization |
| Redis/BullMQ | ❌ Not configured | Needed for Sprint 4 job queue — not needed now |
| Meta API | ❌ Not connected | DB fields exist but no OAuth flow — Sprint 4 scope |

---

## Current Sprint: Frontend Completion (Sprint 3.5F)

> **Objective**: Complete all frontend gaps in Sprints 1-3 so the platform is fully usable through the UI before moving to Sprint 4 (Meta Integration). All work should use Melissa for Educators context for testing and seed data.

See `SPRINT_STATUS.md` for detailed task tracking and completion status.

### Sprint 3.5F Tasks (Priority Order)

#### P0 — Blocking Core Usability
1. **Campaign Detail Page** (`/campaigns/[id]/page.tsx`)
   - View full campaign details (name, status, audience, channels, dates, metrics)
   - Action buttons: Approve, Launch, Pause, Resume, Complete (call existing API endpoints)
   - Display associated tasks and content
   - Status badge with visual workflow indicator

2. **Task Action Buttons** (`/tasks/page.tsx`)
   - Add "Complete" and "Block" buttons to each task row
   - Wire to existing `POST /api/tasks/[id]/complete` and `POST /api/tasks/[id]/block` endpoints
   - Show dependency warnings (task X blocks task Y)
   - Auto-refresh task list after actions

#### P1 — Important for Content Workflow
3. **Content Generation UI** (`/content/page.tsx`)
   - Add "Generate Content" button/modal
   - Campaign selector, count, content type, platform inputs
   - Wire to existing `POST /api/content/generate` endpoint
   - Show generation progress/loading state
   - Display results inline after generation

4. **Content Editing** (`/content/page.tsx` or `/content/[id]/page.tsx`)
   - Edit generated content (headline, body, CTA) before approval
   - Status change buttons (approve, retire)
   - Image reassignment from image library

#### P2 — Operational Completeness
5. **Escalation Actions** (`/escalations/page.tsx`)
   - Add Acknowledge, Resolve, Dismiss buttons
   - Wire to appropriate API endpoints (may need to create these)
   - Show AI analysis and recommendation prominently

6. **Analytics — Real Data** (`/analytics/page.tsx`)
   - Replace static placeholder cards with real data from Performance model
   - Basic charts (impressions, clicks, CTR over time)
   - Per-campaign breakdown
   - Note: Full analytics engine is Sprint 5 — this is just "show what exists"

### Definition of Done for Sprint 3.5F
- All pages listed above are interactive (not just display-only)
- Campaign lifecycle can be driven entirely from the UI (create → approve → manage tasks → launch)
- Content can be generated, reviewed, and approved from the UI
- Tested end-to-end with Melissa for Educators data

---

## Sprint Roadmap (After 3.5F)

| Sprint | Focus | Dependencies |
|--------|-------|-------------|
| **3.5F** (current) | Frontend completion for Sprints 1-3 | None |
| **4** | Meta Integration — OAuth, posting, scheduling | Redis/BullMQ setup required |
| **5** | Analytics engine + optimization | Real post data from Sprint 4 |
| **6** | Polish + production launch | All sprints complete |

---

## Sprint History

| Sprint | Scope | Backend | Frontend | Notes |
|--------|-------|---------|----------|-------|
| 1 | Foundation | ✅ Complete | ✅ Complete | Auth, dashboard, business CRUD all working |
| 2 | Playbooks + Content | ✅ Complete | ⚠️ Partial | Content library is display-only, no generation UI |
| 3 | Campaigns + Tasks | ✅ Complete | ⚠️ Partial | No campaign detail page, tasks are read-only |
| 3.5 | Document Upload | ✅ Complete | ✅ Complete | PDF/DOCX parsing → Claude extraction |
| **3.5F** | **Frontend Gaps** | — | 🔄 Active | **Current sprint** |
