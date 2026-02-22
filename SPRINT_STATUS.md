# Sprint Status — Garden Prayer Campaigns

## Current Sprint: Sprint 5 — Intelligence + Automation Engine

**Started**: February 2026
**Objective**: Build the intelligence layer — performance scoring, auto-generation pipeline, AI recommendations, and enhanced analytics.

---

### Phase 5A: Playbook Enrichment ✅ COMPLETE

- [x] Core Value Pillars (Time Back, Bigger Paycheck, Not ChatGPT)
- [x] Cross-Pillar Theme (Individualization)
- [x] Brand Voice (personality, tone attributes, always/never rules, sentence style)
- [x] Audience-Specific Angles (TIA Seekers, Time-Starved, True Believers, Tech-Hesitant)
- [x] Content Variety Framework (8 archetypes)
- [x] Message Boundaries (claims, compliance, tone guardrails)
- [x] Founder Story
- [x] Playbook entered into Campaign Engine

### Phase 5B: Performance Scoring + Message Intelligence ✅ COMPLETE (February 22, 2026)

- [x] Schema changes (Content: pillar, archetype, performanceScore, scoredAt; new Recommendation model; Campaign: autoMode)
- [x] SQL migration script for Supabase (`sprint5_migration.sql`)
- [x] Performance scorer (`src/lib/scoring.ts`) with configurable weight presets (conversion, awareness, engagement)
- [x] Content auto-tagging on generation (pillar, archetype extracted from Claude response)
- [x] Backfill tagging for existing content (`POST /api/content/backfill-tags`)
- [x] Score calculation endpoint (`POST /api/content/score` — single content or all for campaign)
- [x] Message attribution API (`GET /api/analytics/message-intelligence` — by pillar, archetype, audience, combinations)
- [x] Integrate scoring into metrics polling cron (recalculate scores + auto-retire on each poll)

### Phase 5C: Auto-Generation Pipeline ✅ COMPLETE (February 22, 2026)

- [x] Campaign autoMode field + UI toggle on campaign detail page (off / generate-only / generate-and-post)
- [x] Confirmation dialog for generate-and-post mode
- [x] Visual auto-mode indicator on campaign cards ("Auto-Gen" / "Full Auto" badges) and detail page
- [x] Content pipeline cron (`GET /api/cron/generate-content` — daily at 6 AM UTC)
- [x] Added cron to `vercel.json`
- [x] Variety enforcement logic (tracks last 20 content, biases toward underrepresented pillars/archetypes/audiences)
- [x] Playbook context injection into Claude API generation prompts (pillars, archetypes, voice rules, boundaries)
- [x] Auto-approve + auto-schedule logic for generate-and-post campaigns
- [x] Cadence configuration (2 posts/day at 14:00 and 19:00 UTC, hash-based minute offset per campaign)
- [x] Variety sequencing (no back-to-back same pillar/archetype)
- [x] ActivityLog entries for all auto-generation events

### Phase 5D: AI Recommendation Engine ✅ COMPLETE (February 22, 2026)

- [x] Performance analysis cron (`GET /api/cron/analyze-performance` — weekly Monday 8 AM UTC)
- [x] Added cron to `vercel.json`
- [x] Claude API prompt for structured recommendations (amplify/retire/test/iterate categories)
- [x] Recommendation model and API (`GET /api/recommendations` with filters, `PATCH /api/recommendations/[id]` for accept/dismiss)
- [x] Recommendation dashboard page (`/recommendations`) with summary stats, filters, action buttons
- [x] Accept action triggers (retire: updates content status; amplify/test/iterate: marks executed with outcome)
- [x] Auto-retire underperformers (bottom 20th percentile after ≥500 impressions, min 5 scored items)
- [x] Escalation creation on auto-retire (type: below_threshold)
- [x] Sidebar navigation link for recommendations (lightbulb icon)

### Phase 5E: Time-Series Charts + Enhanced Analytics ✅ COMPLETE (February 22, 2026)

- [x] Installed recharts
- [x] Time-series API (`GET /api/analytics/time-series` with range, campaignId, groupBy params)
- [x] Time-series line charts (impressions+clicks dual axis, CTR, conversions — daily/weekly toggle)
- [x] Per-pillar performance trend lines
- [x] Per-audience-segment trend lines
- [x] Date range selector (7d / 30d / 90d)
- [x] Message effectiveness heatmap (audience × pillar matrix, color-coded green/yellow/red/gray)
- [x] Archetype performance horizontal bar chart
- [x] Top/bottom performing combinations display
- [x] Untested combinations list
- [x] Content funnel bar chart (generated → approved → posted → retired → clicked → converted)
- [x] Analytics page restructured with 3 tabbed sections: Overview, Trends, Message Intelligence

---

## Definition of Done — Sprint 5

- [x] Content pieces are auto-tagged with pillar, archetype, and audience segment
- [x] Performance scores are calculated and stored on all content with metrics
- [x] Message intelligence API returns top/bottom performers by segment, pillar, and archetype
- [x] Auto-generation cron keeps content pipeline above threshold for generate-only and generate-and-post campaigns
- [x] Campaign auto-mode toggle works (off / generate-only / generate-and-post) and can be changed at any time
- [x] AI recommendations are generated weekly with accept/dismiss actions
- [x] Auto-retire removes underperformers with escalation notification
- [x] Time-series charts show performance trends on analytics page
- [x] Message effectiveness heatmap visualizes what's working
- [ ] Tested with Melissa for Educators data (requires live Meta data flowing)

---

## New Files Created in Sprint 5

| File | Purpose |
|------|---------|
| `sprint5_migration.sql` | SQL migration for Supabase SQL Editor |
| `src/lib/scoring.ts` | Performance scorer with weight presets, auto-retire logic |
| `src/app/api/content/score/route.ts` | Score content API endpoint |
| `src/app/api/content/backfill-tags/route.ts` | Backfill pillar/archetype tags on existing content |
| `src/app/api/analytics/message-intelligence/route.ts` | Message attribution analytics API |
| `src/app/api/analytics/time-series/route.ts` | Time-series data API for charts |
| `src/app/api/cron/generate-content/route.ts` | Auto-generation pipeline cron |
| `src/app/api/cron/analyze-performance/route.ts` | Weekly AI recommendation generation cron |
| `src/app/api/recommendations/route.ts` | Recommendations list API |
| `src/app/api/recommendations/[id]/route.ts` | Recommendation accept/dismiss API |
| `src/app/(dashboard)/recommendations/page.tsx` | Recommendations dashboard page |

## Modified Files in Sprint 5

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Added Campaign.autoMode, Content.pillar/archetype/scoredAt, Recommendation model |
| `src/lib/claude.ts` | Added classifyContentTags, generateRecommendations, updated content gen prompt for tagging |
| `src/app/api/content/generate/route.ts` | Saves pillar/archetype from generation response |
| `src/app/api/cron/poll-metrics/route.ts` | Integrated scoring + auto-retire after metrics update |
| `src/app/api/campaigns/[id]/route.ts` | Added autoMode support to PUT handler |
| `src/app/(dashboard)/campaigns/[id]/page.tsx` | Auto-mode toggle component + badge |
| `src/app/(dashboard)/campaigns/page.tsx` | Auto-mode badges on campaign cards |
| `src/app/(dashboard)/analytics/page.tsx` | Complete rewrite with charts, heatmap, funnel (3 tabs) |
| `src/components/Sidebar.tsx` | Added Recommendations nav item |
| `vercel.json` | Added generate-content + analyze-performance crons |
| `package.json` | Added recharts dependency |

---

## Completed Sprints

### Sprint 4 — Meta Integration ✅ COMPLETE

- [x] 4A: Meta OAuth + Connection Layer (schema, API client, OAuth flow, connection UI)
- [x] 4B: Posting Engine (post API, PostNowModal, post dashboard, auto-escalation)
- [x] 4C: Scheduling + Queue (Vercel Cron, process-posts cron, schedule UI, UTM generation)
- [x] 4D: Metrics + Tracking (poll-metrics cron, conversion webhook, analytics update)
- [x] Live Facebook posting validated

### Sprint 3.5F — Frontend Completion ✅ COMPLETE

- [x] Campaign detail page with contextual actions and status workflow
- [x] Task actions (complete/block) on tasks page and campaign detail
- [x] Content generation UI with campaign selector and auto-filtering
- [x] Content inline editing with status actions and new API endpoints
- [x] Escalation actions (acknowledge/resolve/dismiss) with API endpoints
- [x] Analytics dashboard with real Performance data and per-campaign breakdown

### Sprint 3.5 — Document Upload ✅ COMPLETE
### Sprint 3 — Campaigns + Tasks ✅ COMPLETE
### Sprint 2 — Playbooks + Content ✅ COMPLETE
### Sprint 1 — Foundation ✅ COMPLETE

---

## Deferred Items

| Item | Deferred From | Target Sprint |
|------|--------------|---------------|
| Image picker component | Sprint 3.5F | Sprint 6 |
| Paid ads (Meta Ads API) | Sprint 5 | Sprint 6 |
| Lookalike audience targeting | Sprint 5 | Sprint 6 |
| Instagram linking | Sprint 4 | Sprint 6 |
| CI/CD + testing infrastructure | — | Sprint 6 |
| Campaign comparison overlay in charts | Sprint 5E | Sprint 6 |
