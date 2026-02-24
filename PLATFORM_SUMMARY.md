# Garden Prayer Campaigns — Platform Summary

## What It Is

Garden Prayer Campaigns is a closed-loop marketing automation platform built by Garden Prayer Publishing LLC. It generates social media content from strategic playbooks, distributes it across Facebook and Instagram via the Meta Graph API, tracks performance metrics, and uses AI (Anthropic Claude) to autonomously optimize messaging over time.

The platform currently serves two businesses:

- **Melissa for Educators** (EdTech) — primary launch target
- **Vaquero Homes** (Real Estate) — secondary

---

## Core Concept: Three Interlocking Loops

The entire system is organized around three automation loops:

1. **Volume + Variety** — Continuously produce high-volume, varied content from playbook pillars, cycling through audience segments and content archetypes so the market hears the message from every angle.
2. **Conversion Attribution** — Connect performance data back to content attributes (which hook, which audience, which pillar, which archetype) to understand what is working and why.
3. **Message Intelligence** — Amplify winners, retire losers, generate new variations to test, and iterate toward the messages that convert quality customers.

---

## Platform Pages and Features

The application is a Next.js dashboard with the following sections, accessible from a persistent sidebar:

### Dashboard (Home)
Aggregate stats, recent activity feed, and quick links to key actions. Provides a high-level view of all businesses and campaigns.

### Businesses
Create, view, edit, and delete client business profiles. Each business stores:
- Name, slug, website, brand colors, and general settings
- **Meta connection** — OAuth-linked Facebook Page and (optionally) Instagram Business Account, with encrypted page access token, token expiry tracking, and disconnect capability

### Playbooks
The playbook is the "brand DNA" — the central strategy document that governs all content generation. Playbooks can be created two ways:
- **Upload materials** — Upload a PDF, DOCX, TXT, or Markdown file. The platform parses the document and sends the text to Claude, which extracts a structured playbook.
- **AI generation** — Fill out a business brief form and Claude generates a complete playbook.

A playbook contains:
- Core positioning statement and founder story
- Core value pillars (e.g., Time Back, Bigger Paycheck, Not ChatGPT for Melissa)
- Brand voice rules (personality, tone, always/never rules, sentence style)
- Audience segments with lead pillars and entry messages
- Content archetypes (pain-point, stat/proof, contrast, aspiration, myth-buster, teacher reality, individualization, outcome)
- Marketing hooks to test
- Objection handlers
- Visual direction and image style guidelines
- Message boundaries (claims, compliance, tone guardrails)

Playbook statuses: **draft** → **active** → **archived**

### Campaigns
Campaigns execute marketing strategy from a playbook against a target audience across selected channels. Each campaign tracks budgets, date ranges, success metrics, and a full status workflow:

```
draft → review → approved → setup → live → paused → completed / failed
```

On approval, the system auto-generates both human tasks (Review Content, Upload Images, Setup Meta Ads) and system tasks (Generate Initial Content, Match Images, Generate UTM params).

**Auto-Mode** — Each campaign has a configurable automation level:
- `off` — Manual content generation and posting
- `generate-only` — Auto-generates content to keep the pipeline full; human reviews and posts
- `generate-and-post` — Full autonomous operation: generates, approves, schedules, and posts without manual intervention

Visual badges ("Auto-Gen" / "Full Auto") display the current mode on campaign cards and detail pages.

### Content
The content library holds all generated social media content pieces. Content can be:
- **Generated on demand** via Claude AI, using the campaign's playbook for context (positioning, audiences, hooks, pillars, archetypes, voice rules, and boundaries)
- **Auto-generated** by a daily cron job for campaigns with auto-mode enabled
- **Edited inline** — headline, body, CTA text, and CTA URL are editable from the UI

Each content piece is tagged with:
- **Pillar** — which value pillar it targets (e.g., time-back, bigger-paycheck)
- **Archetype** — what content pattern it follows (e.g., pain-point, stat-proof, aspiration)
- **Audience segment** — which audience it addresses
- **Performance score** — a weighted composite score calculated from engagement and conversion metrics

Content statuses: **generated** → **approved** → **scheduled** → **posted** → **paused** / **retired**

Content can be posted directly ("Post Now") or scheduled for a future date/time. An auto-matched image from the image library is attached during generation.

### Posts
The posts dashboard tracks every social media post sent to Facebook or Instagram. Each post shows:
- Platform (Facebook / Instagram)
- Status: **draft**, **scheduled**, **posting**, **posted**, **failed**
- Scheduled time, actual post time, and any error messages
- Link to the live post on the platform (via `platformPostId`)
- A "Retry" button for failed posts
- UTM parameters for conversion tracking

### Images
An image library where assets are uploaded to Supabase Storage. Images are tagged with JSON metadata (audience segments, emotions, themes) and are automatically matched to content using a weighted matching algorithm. Supports JPEG, PNG, GIF, and WebP up to 10 MB.

### Tasks
Task management tracks both human and system work items for each campaign. Tasks have:
- Assignee: human or system
- Status: pending → in_progress → completed / blocked
- Priority, due date, dependencies (one task can depend on another)
- Complete and Block actions from the UI

### Analytics
A three-tabbed analytics dashboard powered by real performance data:

**Overview Tab** — Aggregate metrics: total impressions, clicks, CTR, conversions, spend, ROAS. Per-campaign breakdown.

**Trends Tab** — Time-series charts (built with Recharts):
- Impressions + clicks dual-axis line chart
- CTR trend line
- Conversions over time
- Per-pillar performance trends
- Per-audience-segment trends
- Date range selector (7-day / 30-day / 90-day) and daily/weekly toggle

**Message Intelligence Tab** — Understanding what messages work:
- Message effectiveness heatmap: audience segment x pillar matrix, color-coded by performance (green = high, red = low, gray = untested)
- Archetype performance horizontal bar chart
- Top and bottom performing combinations
- Untested combinations list
- Content funnel bar chart (generated → approved → posted → retired → clicked → converted)

### Recommendations
AI-generated recommendations from weekly performance analysis. Claude analyzes performance data and produces recommendations in four categories:
- **Amplify** — High performers to generate more variations of
- **Retire** — Underperformers to stop using
- **Test** — Untested pillar/audience/archetype combinations to try
- **Iterate** — Top performers to explore further variations of

Each recommendation displays the AI's reasoning and offers Accept / Dismiss actions. Accepted recommendations trigger their associated action (e.g., retiring content, marking for new generation).

### Escalations
Issues that need human attention. Escalations are auto-created when:
- Meta API calls fail during posting
- Content is auto-retired for underperformance
- Budget thresholds are hit
- Anomalies are detected

Each escalation includes AI analysis and a recommendation. Actions: **acknowledge**, **resolve**, **dismiss**.

Escalation types: below_threshold, persistent_failure, budget_depleted, anomaly_detected, strategic_question.
Severity levels: info, warning, critical.

---

## Automated Background Processes

Four Vercel Cron Jobs run on schedule without manual intervention:

| Cron | Schedule | Purpose |
|------|----------|---------|
| `/api/cron/process-posts` | Every 5 minutes | Picks up posts where `scheduledFor <= now` and `status = scheduled`, posts them to Meta (Facebook or Instagram), updates status to `posted` or `failed` |
| `/api/cron/poll-metrics` | Every 30 minutes | Pulls engagement data (impressions, reach, clicks, reactions, comments, shares) from Meta for all posts made in the last 30 days; upserts into Performance model; recalculates performance scores; auto-retires underperformers |
| `/api/cron/generate-content` | Daily at 6:00 AM UTC | For campaigns with auto-mode enabled, checks pipeline depth; if below threshold (default 10 unposted pieces), generates a batch from the playbook with variety enforcement; auto-approves and auto-schedules for `generate-and-post` campaigns |
| `/api/cron/analyze-performance` | Weekly, Monday 8:00 AM UTC | Sends performance data to Claude for analysis; generates structured recommendations (amplify / retire / test / iterate); stores in Recommendation model |

All cron endpoints validate a `CRON_SECRET` bearer token before processing.

---

## Meta (Facebook + Instagram) Integration

### Connection Flow
1. Business owner clicks "Connect to Meta" on their business settings page
2. OAuth redirect to Meta with required permissions: `pages_manage_posts`, `pages_read_engagement`, `instagram_basic`, `instagram_content_publish`
3. Callback exchanges the short-lived code for a long-lived page access token (60-day expiry)
4. User selects which Facebook Page to connect (if they manage multiple)
5. Instagram Business Account is auto-detected from the connected page
6. Token is encrypted with AES-256-GCM and stored on the Business record

### Posting
- **Facebook**: Single API call with message + optional link/image attachment
- **Instagram**: Two-step flow — (1) create media container with image URL + caption, (2) publish the container. Instagram always requires an image.
- Posts can be sent immediately ("Post Now") or scheduled for a future date/time
- Failed posts auto-create escalations and can be retried from the UI

### Metrics Collection
The poll-metrics cron pulls engagement data from Meta's Graph API for all posted content and writes it to the Performance model. This data feeds the analytics dashboard, performance scoring, and the recommendation engine.

---

## AI-Powered Features (Claude API)

The platform uses the Anthropic Claude API for:

1. **Content generation** — Produces platform-optimized social media posts using full playbook context (pillars, archetypes, voice rules, audience angles, message boundaries). Each generated piece is auto-tagged with its pillar and archetype.
2. **Playbook generation** — Creates complete marketing playbooks from a business brief or from uploaded documents (PDF, DOCX, TXT, Markdown).
3. **Content classification** — Tags existing content with pillar and archetype via text analysis (backfill capability).
4. **Performance analysis** — Weekly analysis of message effectiveness data producing structured recommendations.
5. **Escalation analysis** — AI-generated analysis and recommendations attached to escalation records.

---

## Content Variety and Optimization

### Variety Enforcement
The auto-generation pipeline tracks the last 20 content pieces and biases new generation toward underrepresented pillar/archetype/audience combinations. This ensures diverse messaging rather than repeated themes.

### Performance Scoring
Each content piece receives a composite performance score based on weighted metrics:
- Configurable weight presets: **conversion** (conversions weighted highest), **awareness** (reach/impressions weighted highest), **engagement** (likes/comments/shares weighted highest)
- Scores are recalculated on each metrics poll
- Scores are stored on the Content model for ranking and intelligence queries

### Auto-Retire
Content pieces scoring in the bottom 20th percentile after receiving at least 500 impressions (with a minimum of 5 scored items for statistical relevance) are automatically retired. An escalation is created to notify the operator.

### Scheduling Cadence
For full-auto campaigns, posts are scheduled at a configurable cadence (default: 2 posts/day at 14:00 and 19:00 UTC with a hash-based minute offset per campaign to avoid simultaneous posting). The scheduler enforces variety — no back-to-back posts with the same pillar or archetype.

---

## Conversion Tracking

- **UTM parameters** are auto-generated for all outbound links using the pattern:
  `?utm_source={platform}&utm_medium=social&utm_campaign={campaign-slug}&utm_content={content-id}`
- A **conversion webhook** (`/api/webhooks/conversion`) receives events from UTM-tagged traffic and maps them back to the originating Campaign, Content, and Post records
- Conversion types tracked: **click**, **signup**, **trial**, **purchase**

---

## Authentication and Security

- JWT-based authentication with sessions stored in HTTP-only cookies (7-day expiry)
- No client-side token storage; no third-party auth providers
- API routes validate sessions via `ensureAuthenticated()`
- Cron endpoints authenticate via `CRON_SECRET` bearer token
- Meta page tokens are encrypted at rest with AES-256-GCM

---

## Tech Stack Summary

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Database | PostgreSQL via Supabase (transaction pooler) |
| ORM | Prisma v5 |
| AI | Anthropic Claude API |
| File Storage | Supabase Storage (S3-compatible) |
| Social APIs | Meta Graph API v21.0 (Facebook Pages + Instagram) |
| Scheduling | Vercel Cron Jobs + Postgres queue |
| Charts | Recharts |
| Styling | Tailwind CSS v4 |
| Auth | JWT via `jose` + `bcryptjs` |
| Deployment | Vercel |

---

## Data Model Overview

The platform uses 15 database models:

| Model | Role |
|-------|------|
| **User** | Admin authentication |
| **Business** | Client organizations with Meta connection details |
| **Playbook** | Marketing strategy / brand DNA documents |
| **Campaign** | Execution containers with status workflow and auto-mode |
| **Content** | AI-generated social media content with pillar/archetype tags and performance scores |
| **Post** | Individual posts sent to Facebook/Instagram with scheduling and status tracking |
| **Image** | Uploaded image assets with weighted tag metadata |
| **ImageRequest** | Requests for new images to be created |
| **Task** | Human and system work items with dependencies |
| **Escalation** | Issues requiring attention, with AI analysis |
| **Performance** | Engagement and conversion metrics per post |
| **Conversion** | Tracked conversion events from UTM-tagged traffic |
| **Recommendation** | AI-generated optimization recommendations |
| **ActivityLog** | Audit trail of all system and human actions |

---

## Current Status

Sprints 1 through 5 are complete. The platform has:
- Full business, playbook, campaign, content, and post management
- Live Facebook posting via Meta API (Melissa for Educators page connected, token valid through April 2026)
- Automated scheduling, metrics collection, content generation, and performance analysis
- AI-powered recommendations and auto-retire of underperformers
- Time-series analytics charts and message effectiveness heatmaps

**Remaining items for Sprint 6** (not yet started): paid ads via Meta Ads API, Instagram account linking, image picker component, CI/CD and testing infrastructure, production hardening.
