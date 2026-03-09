# Sprint Status — Garden Prayer Campaign Engine

## Sprint 6A: Instagram + Custom Domain ✅ COMPLETE (with caveats)
- [x] Custom domain live: campaigns.gardenprayerpublishing.com
- [x] Meta OAuth scopes fixed (pages_show_list, auth_type=rerequest, deprecated scope replaced)
- [x] Instagram account linked to Facebook Page
- [x] Debug logging added to Meta callback
- [ ] Meta integration display on dashboard — BLOCKED by App Review (see below)

## Sprint 6B: Live Campaign Bug Fixes — IN PROGRESS

### Blocking Bugs (fix first)
- [ ] **Content generation 500** — Audience lookup is case-sensitive and crashes on mismatch
- [ ] **Audience field UX** — Replace free-text with multi-select dropdown from playbook segments  
- [ ] **Campaign launch 400** — Investigate and fix validation error, improve error messages

### After Bugs Fixed
- [ ] End-to-end content generation test
- [ ] Content quality review (AI output matches playbook strategy)
- [ ] Platform-specific formatting verification (FB vs IG)
- [ ] Schedule and publish test post(s)
- [ ] Record screencast for Meta App Review submission

### Meta Integration (WAITING — do not block)
- [ ] Meta App Review submission — in progress, needs screencast video
- [ ] Privacy policy uploaded to gardenprayerpublishing.com
- [ ] Advanced Access approval for: pages_show_list, pages_manage_posts, pages_read_user_content, instagram_basic, instagram_content_publish, pages_read_engagement
- [ ] After approval: reconnect Meta, verify dashboard shows connection
- [ ] Test Facebook posting
- [ ] Test Instagram cross-posting

## Sprint 6C: Paid Ads Foundation — PLANNED
- [ ] Meta Ads API integration
- [ ] Boost top organic performers
- [ ] Custom audiences
- [ ] Lookalike audiences
- [ ] Budget tracking + ROAS

## Sprint 6D: Production Hardening — PLANNED
- [ ] Error monitoring (Sentry)
- [ ] Alerting on failures
- [ ] Token refresh automation
- [ ] Rate limit resilience

## Completed Sprints
- Sprint 1-3: Core platform build (businesses, campaigns, playbooks, content, posting)
- Sprint 4: Meta Facebook integration, OAuth flow, posting pipeline
- Sprint 5: Intelligence layer — performance scoring, auto-generation, recommendations, analytics charts, cron jobs
- Sprint 6A: Custom domain, Instagram linking, OAuth scope fixes
