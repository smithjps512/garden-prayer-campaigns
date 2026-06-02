/**
 * Smoke test: fire ONE immediate Instagram post for Game View through the real
 * engine path — stored encrypted token → decryptToken → postToInstagram.
 *
 * This is deliberately isolated: it does NOT create Content/Post rows and does
 * NOT touch the cron. It proves the exact "stored-token-to-postToInstagram"
 * path works inside the engine (not by hand in the Graph API Explorer), before
 * any refactor. The resulting post is a throwaway — delete it from Instagram
 * afterward.
 *
 * REQUIRED ENV (same DATABASE_URL + AUTH_SECRET used when onboarding, so the
 * stored token decrypts correctly):
 *   DATABASE_URL
 *   AUTH_SECRET
 *   SMOKE_IMAGE_URL   A PUBLICLY accessible image URL. Instagram requires an
 *                     aspect ratio between 4:5 and 1.91:1.
 *
 * OPTIONAL ENV:
 *   SMOKE_CAPTION     Caption text (default: a clearly-marked test caption).
 *
 * Run:
 *   set -a; source .env; set +a
 *   SMOKE_IMAGE_URL='https://.../public-image.jpg' \
 *     npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/smoke-ig-post.ts
 */
import { PrismaClient } from '@prisma/client'
import { decryptToken, postToInstagram } from '../src/lib/meta'

const prisma = new PrismaClient()

const SLUG = 'game-view'

async function main() {
  const imageUrl = process.env.SMOKE_IMAGE_URL
  if (!imageUrl || !imageUrl.trim()) {
    throw new Error(
      'SMOKE_IMAGE_URL is required — a publicly accessible image URL ' +
        '(IG aspect ratio between 4:5 and 1.91:1).'
    )
  }
  const caption =
    process.env.SMOKE_CAPTION?.trim() ||
    'Game View engine connectivity smoke test — please ignore. 🎮'

  const business = await prisma.business.findUnique({ where: { slug: SLUG } })
  if (!business) {
    throw new Error(`Business "${SLUG}" not found. Run npm run onboard:gameview first.`)
  }
  if (!business.metaIgAccountId) {
    throw new Error('Business has no metaIgAccountId — re-run onboarding.')
  }
  if (!business.metaPageToken) {
    throw new Error('Business has no stored Meta token — re-run onboarding.')
  }

  // Decrypt exactly the way the cron/posting routes do.
  const pageToken = decryptToken(business.metaPageToken)

  console.log(`→ Posting to IG account ${business.metaIgAccountId} ...`)
  console.log(`  image:   ${imageUrl}`)
  console.log(`  caption: ${caption}`)

  const result = await postToInstagram(business.metaIgAccountId, pageToken, {
    imageUrl: imageUrl.trim(),
    caption,
  })

  console.log(`\n✅ Smoke test PASSED. Published IG media id: ${result.id}`)
  console.log('   Connectivity confirmed: stored token → decrypt → postToInstagram works.')
  console.log('   This is a throwaway — delete the post from Instagram.')
}

main()
  .catch((err) => {
    console.error('\n❌ Smoke test FAILED:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
