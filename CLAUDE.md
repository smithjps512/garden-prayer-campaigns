# Campaign Engine - CLAUDE.md

## Project Overview

Marketing automation system ("Campaign Engine") for managing multi-business social media campaigns. Supports two businesses: **Melissa for Educators** (EdTech) and **Vaquero Homes** (Real Estate). Built across 3 sprints with a 4th planned.

## Tech Stack

- **Framework**: Next.js 16.1.6 with App Router, React 19, TypeScript
- **Database**: PostgreSQL via Supabase (Transaction pooler, port 6543, `?pgbouncer=true`)
- **ORM**: Prisma v5.22.0 (NOT v7 — breaking changes with JsonValue types)
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

## Database Connection Notes

- **Must use Supabase Transaction pooler** (port 6543), NOT direct connection (port 5432)
- Connection string must include `?pgbouncer=true`
- Prisma v5 is required — v7 has breaking changes with enum types and JsonValue handling

## Project Structure

```
src/
├── app/
│   ├── (auth)/login/page.tsx           # Login page
│   ├── (dashboard)/                    # Protected routes (session required)
│   │   ├── page.tsx                    # Dashboard home (stats, activity)
│   │   ├── businesses/                 # CRUD + [slug] detail + edit
│   │   ├── playbooks/                  # List + [id] detail/editor
│   │   ├── campaigns/                  # List + create modal
│   │   ├── content/                    # Generated content library
│   │   ├── images/                     # Image library + upload
│   │   ├── tasks/                      # Task management
│   │   ├── analytics/                  # Performance metrics
│   │   └── escalations/                # Issues requiring attention
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
- **CampaignStatus**: draft, review, approved, setup, live, paused, completed, failed
- **ContentStatus**: generated, approved, scheduled, posted, paused, retired
- **TaskStatus**: pending, in_progress, completed, blocked
- **TaskAssignee**: human, system

**Important**: Prisma enums use PascalCase names but lowercase values. Database columns use snake_case via `@map()`.

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

## Known Issues & Gotchas

### Prisma JsonValue Type Casting
Prisma v5 JSON fields return `JsonValue` type. When accessing typed properties, you must cast:
```typescript
const audiences = playbook.audiences as unknown as AudienceSegment[]
const hooks = playbook.hooks as unknown as Hook[]
```
For writing JSON to Prisma:
```typescript
import { Prisma } from '@prisma/client'
data: { audiences: myArray as unknown as Prisma.InputJsonValue }
```

### Date Serialization in Server Components
Prisma Date objects can't call `.toLocaleDateString()` directly in Next.js Server Components. Serialize first:
```typescript
const createdAt = new Date(business.createdAt).toLocaleDateString()
// Then use {createdAt} in JSX, not {business.createdAt.toLocaleDateString()}
```

### Paginated vs Direct API Responses
- `/api/businesses` returns paginated: `{ data: { items: [...], pagination: {...} } }`
- `/api/playbooks`, `/api/campaigns`, etc. return direct arrays: `{ data: [...] }`
- Client components fetching businesses must extract `.data.items`

### PDF Parsing
- `pdf-parse` npm package requires DOM APIs (DOMMatrix, canvas) — breaks in Node.js server
- Use `pdfjs-dist` instead with dynamic import for server-side text extraction
- DOCX parsing uses `mammoth` (works fine server-side)

### Supabase Connection
- Must use Transaction pooler URL (port 6543), not Session pooler or Direct
- Add `?pgbouncer=true` to connection string
- Connection errors with port 5432 are expected — switch to 6543

## Authentication

- Default admin: `admin@campaignengine.local` / `admin123` (via ADMIN_EMAIL/ADMIN_PASSWORD env vars)
- JWT stored in HTTP-only cookie `campaign-engine-session` (7-day expiry)
- Dashboard layout checks session and redirects to `/login` if missing
- API routes use `ensureAuthenticated()` which throws if no valid session
- If login fails after fresh deploy, check that the seed script created the admin user

## Sprint History

- **Sprint 1**: Foundation — Next.js setup, Prisma schema, Supabase connection, auth, dashboard shell, business CRUD
- **Sprint 2**: Playbook management, Claude API integration, content generation, image matching, playbook UI
- **Sprint 3**: Campaign lifecycle (approve/launch/pause/resume/complete), task management, auto-task generation
- **Sprint 3.5**: Document upload feature (PDF/DOCX parsing → Claude extraction → playbook creation)
- **Sprint 4** (planned): Meta/Facebook integration, Redis job queues, scheduling, performance tracking

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

## File Upload

Images upload to Supabase Storage bucket `images`:
- Path: `businesses/{slug}/images/{uuid}.{ext}`
- Accepts: JPEG, PNG, GIF, WebP (max 10MB)
- Returns public URL for immediate use
- Tags stored as JSON: `{ segments: [], emotions: [], themes: [] }`
