/**
 * Onboard the "Game View" business and store its manual Meta connection.
 *
 * This runs through the REAL engine code: it reuses `encryptToken` from
 * `src/lib/meta.ts` so the stored token is encrypted exactly the way the live
 * cron / posting routes expect to decrypt it.
 *
 * It is the script-equivalent of POST /api/businesses + POST /api/meta/manual-connect,
 * so it can be run from a trusted shell without going through the dashboard UI.
 *
 * REQUIRED ENV (must match PRODUCTION so the live app can read what we write):
 *   DATABASE_URL        Supabase transaction pooler URL (port 6543, ?pgbouncer=true)
 *   AUTH_SECRET         MUST be the same value the live app uses — the token
 *                       encryption key is derived from it. A mismatch here means
 *                       the live cron will fail to decrypt the token.
 *   META_PAGE_TOKEN     The Page access token (or system-user token scoped to the
 *                       Page) to store. Passed via env, never hardcoded.
 *
 * OPTIONAL ENV:
 *   WEBSITE_URL         UTM fallback link on every post (default https://gameview.ai)
 *
 * Run:
 *   set -a; source .env; set +a
 *   META_PAGE_TOKEN='EAAG...' \
 *     npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/onboard-gameview.ts
 */
import { PrismaClient } from '@prisma/client'
import { encryptToken } from '../src/lib/meta'

const prisma = new PrismaClient()

// Identifiers supplied for the Game View product (Facebook Page + IG Business account).
const GAME_VIEW = {
  name: 'Game View',
  slug: 'game-view',
  metaPageId: '1065649296630607',
  metaIgAccountId: '17841428914060479',
} as const

async function main() {
  const pageToken = process.env.META_PAGE_TOKEN
  if (!pageToken || !pageToken.trim()) {
    throw new Error(
      'META_PAGE_TOKEN is required. Pass it via env, e.g.\n' +
        "  META_PAGE_TOKEN='EAAG...' npx ts-node --compiler-options '{\"module\":\"CommonJS\"}' scripts/onboard-gameview.ts"
    )
  }

  const websiteUrl = process.env.WEBSITE_URL?.trim() || 'https://gameview.ai'

  // 1. Create (or update) the Game View business.
  const business = await prisma.business.upsert({
    where: { slug: GAME_VIEW.slug },
    update: { name: GAME_VIEW.name, websiteUrl },
    create: { name: GAME_VIEW.name, slug: GAME_VIEW.slug, websiteUrl },
  })
  console.log(`✅ Business ready: ${business.name} (${business.id})  website=${websiteUrl}`)

  // 2. Store the manual Meta connection — encrypt the token exactly like
  //    /api/meta/manual-connect does, so the cron/posting code can decrypt it.
  const encryptedToken = encryptToken(pageToken.trim())
  const tokenExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) // 60-day reminder

  await prisma.business.update({
    where: { id: business.id },
    data: {
      metaPageId: GAME_VIEW.metaPageId,
      metaPageName: GAME_VIEW.name,
      metaPageToken: encryptedToken,
      metaIgAccountId: GAME_VIEW.metaIgAccountId,
      metaConnectedAt: new Date(),
      metaTokenExpiresAt: tokenExpiresAt,
    },
  })

  await prisma.activityLog.create({
    data: {
      businessId: business.id,
      actor: 'human',
      action: 'meta_manual_connected',
      entityType: 'business',
      entityId: business.id,
      details: {
        pageId: GAME_VIEW.metaPageId,
        pageName: GAME_VIEW.name,
        hasInstagram: true,
        method: 'onboard_script',
      },
    },
  })

  console.log('✅ Meta connection stored (token encrypted at rest).')
  console.log(`   Page ID:        ${GAME_VIEW.metaPageId}`)
  console.log(`   IG Account ID:  ${GAME_VIEW.metaIgAccountId}`)
  console.log(`   Token expiry reminder: ${tokenExpiresAt.toISOString()}`)
  console.log('\nNext: run the IG smoke test → npm run smoke:ig')
}

main()
  .catch((err) => {
    console.error('❌ Onboarding failed:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
