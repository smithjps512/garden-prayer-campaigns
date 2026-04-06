import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting seed...')

  // Create admin user
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@campaignengine.local'
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'
  const passwordHash = await bcrypt.hash(adminPassword, 12)

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash,
      name: 'Admin',
    },
  })
  console.log(`✅ Admin user created: ${adminUser.email}`)

  // Create Melissa for Educators business
  const melissa = await prisma.business.upsert({
    where: { slug: 'melissa' },
    update: {},
    create: {
      name: 'Melissa for Educators',
      slug: 'melissa',
      description:
        'Education SaaS platform helping teachers create personalized learning experiences. $99/year subscription.',
      websiteUrl: 'https://melissaforeducators.com',
      brandColors: {
        primary: '#6A1A19',
        secondary: '#8B2E2D',
        accent: '#F7AC13',
        background: '#FFF8F0',
        text: '#1A1A1A',
      },
      settings: {
        industry: 'education',
        pricePoint: 99,
        billingCycle: 'yearly',
        targetMarkets: ['United States'],
        primaryAudiences: [
          'TIA Seekers',
          'Time-Starved Teachers',
          'True Believers',
          'Tech-Hesitant Teachers',
        ],
        timezone: 'America/Chicago',
      },
    },
  })
  console.log(`✅ Business created: ${melissa.name}`)

  // Create Vaquero Homes business
  const vaquero = await prisma.business.upsert({
    where: { slug: 'vaquero' },
    update: {},
    create: {
      name: 'Vaquero Homes',
      slug: 'vaquero',
      description:
        'Custom home builder and real estate developer serving the Texas market. Premium construction with a focus on quality craftsmanship.',
      websiteUrl: 'https://vaquerohomes.com',
      brandColors: {
        primary: '#2C3E50',
        secondary: '#34495E',
        accent: '#E67E22',
        background: '#FFFFFF',
        text: '#1A1A1A',
      },
      settings: {
        industry: 'real_estate',
        targetMarkets: ['Texas', 'Dallas-Fort Worth', 'Austin', 'Houston', 'San Antonio'],
        primaryAudiences: [
          'First-Time Buyers',
          'Growing Families',
          'Empty Nesters',
          'Relocating Professionals',
        ],
        timezone: 'America/Chicago',
      },
    },
  })
  console.log(`✅ Business created: ${vaquero.name}`)

  // Create Game View business
  const gameView = await prisma.business.upsert({
    where: { slug: 'game-view' },
    update: {},
    create: {
      name: 'Game View',
      slug: 'game-view',
      description:
        'Immersive AI platform turning sports highlights and creative visions into playable 3D experiences.',
      websiteUrl: 'https://gameview.ai',
      brandColors: {
        primary: '#000000',
        accent: '#ffffff',
      },
      settings: {
        industry: 'technology',
        targetMarkets: ['United States', 'Global'],
        primaryAudiences: ['Sports Fans', 'Creators'],
        timezone: 'America/New_York',
      },
    },
  })
  console.log(`✅ Business created: ${gameView.name}`)

  // Create Game View Playbook with two audience segments
  const gameViewPlaybook = await prisma.playbook.upsert({
    where: { id: 'gameview-playbook-001' },
    update: {},
    create: {
      id: 'gameview-playbook-001',
      businessId: gameView.id,
      name: 'Game View Launch Playbook',
      status: 'active',
      positioning:
        'Game View transforms flat video into explorable 3D worlds. For sports fans, it turns highlights into immersive replays you can walk through. For creators, it is the fastest path from imagination to interactive experience — no 3D expertise required.',
      founderStory: null,
      audiences: [
        {
          name: 'Sports Fans',
          description:
            'Sports enthusiasts interested in reliving game moments and highlights',
          painPoints: [
            'Miss key moments',
            'Want to experience games from new angles',
            'Passive viewing feels limiting',
          ],
          desires: [
            'Step inside the highlight reel',
            'See plays from any angle',
            'Share immersive moments with friends',
          ],
          objections: [
            'Sounds too futuristic to be real',
            'Probably requires expensive hardware',
            'I just want to watch the game, not play a game',
          ],
        },
        {
          name: 'Creators',
          description:
            'Content creators, game designers, and developers who want to build immersive experiences',
          painPoints: [
            'Tools are too complex',
            '3D creation has a steep learning curve',
            "Can't visualize the end result",
          ],
          desires: [
            'Build immersive experiences quickly',
            'Skip the 3D learning curve',
            'Bring creative visions to life',
          ],
          objections: [
            'Another tool that over-promises',
            'Will it actually work for my use case?',
            "I need full control, not a black box",
          ],
        },
      ],
      hooks: [
        {
          id: 'gv_hook_1',
          text: 'What if you could step inside the highlight reel?',
          angle: 'curiosity',
          targetAudience: 'Sports Fans',
        },
        {
          id: 'gv_hook_2',
          text: 'Your favorite play. Now playable.',
          angle: 'aspiration',
          targetAudience: 'Sports Fans',
        },
        {
          id: 'gv_hook_3',
          text: 'Watching is over. Playing is here.',
          angle: 'transformation',
          targetAudience: 'Sports Fans',
        },
        {
          id: 'gv_hook_4',
          text: 'You have the vision. We have the engine.',
          angle: 'empowerment',
          targetAudience: 'Creators',
        },
        {
          id: 'gv_hook_5',
          text: 'Stop imagining it. Build it.',
          angle: 'aspiration',
          targetAudience: 'Creators',
        },
        {
          id: 'gv_hook_6',
          text: '3D used to take a team. Now it takes a prompt.',
          angle: 'contrast',
          targetAudience: 'Creators',
        },
        {
          id: 'gv_hook_7',
          text: "The game just changed. Literally.",
          angle: 'curiosity',
          targetAudience: 'Sports Fans',
        },
        {
          id: 'gv_hook_8',
          text: 'From flat screen to full world in seconds.',
          angle: 'transformation',
          targetAudience: 'Creators',
        },
      ],
      keyMessages: {
        'Sports Fans': [
          'Experience sports highlights in immersive 3D — walk through the play, choose your angle, feel the moment.',
          'Game View turns any highlight into a playable experience you can share.',
          'This is not VR goggles and motion sickness — it is instant, browser-based, and stunning.',
        ],
        Creators: [
          'Turn your creative vision into interactive 3D worlds without writing a single line of code.',
          'Game View gives you a 3D creation engine that works at the speed of your ideas.',
          'Professional-quality immersive experiences, built in minutes instead of months.',
        ],
      },
      objectionHandlers: {
        'Sounds too futuristic': 'It is live today. Try a demo in your browser right now — no download needed.',
        'Requires expensive hardware': 'Runs in any modern browser. No VR headset, no gaming PC required.',
        'Another tool that over-promises': 'We show, not tell. The free tier lets you build and publish before you spend a dollar.',
        'Need full control': 'Start with AI-assisted creation, then fine-tune every detail. You have full export and customization.',
      },
      content: {
        pillars: [
          {
            id: 'immersion',
            name: 'Immersion',
            description: 'The core value — turning flat media into explorable 3D worlds',
          },
          {
            id: 'accessibility',
            name: 'Accessibility',
            description: 'No expertise, no expensive hardware, instant results',
          },
          {
            id: 'creation-speed',
            name: 'Creation Speed',
            description: 'Build in minutes what used to take months and a team',
          },
        ],
        voice: {
          personality: 'Bold, confident, slightly futuristic but grounded',
          tone: 'Energetic and direct. No jargon. Short sentences.',
          always: [
            'Lead with the experience, not the technology',
            'Use active, present-tense language',
            'Paint a picture the reader can feel',
          ],
          never: [
            'Use corporate buzzwords like "leverage" or "synergy"',
            'Over-explain the tech stack',
            'Sound like a press release',
          ],
        },
        archetypes: [
          'pain-point',
          'contrast',
          'aspiration',
          'transformation',
          'curiosity-hook',
          'social-proof',
          'demo-invite',
          'future-vision',
        ],
      },
      visualDirection: {
        style: 'Dark backgrounds, neon accents, high-contrast imagery',
        avoid: 'Clip art, stock photos of people pointing at screens',
        references: 'Unreal Engine showcases, Apple product launches, Nike campaigns',
      },
    },
  })
  console.log(`✅ Playbook created: ${gameViewPlaybook.name}`)

  // Create Campaign 1: Sports Audience
  const sportsCampaign = await prisma.campaign.upsert({
    where: { id: 'gameview-campaign-sports' },
    update: {},
    create: {
      id: 'gameview-campaign-sports',
      playbookId: gameViewPlaybook.id,
      name: 'Playable Highlights — Sports Audience',
      status: 'draft',
      autoMode: 'off',
      targetAudience: 'Sports Fans',
      channels: ['facebook', 'instagram'],
    },
  })
  console.log(`✅ Campaign created: ${sportsCampaign.name}`)

  // Create Campaign 2: Creator Audience
  const creatorCampaign = await prisma.campaign.upsert({
    where: { id: 'gameview-campaign-creators' },
    update: {},
    create: {
      id: 'gameview-campaign-creators',
      playbookId: gameViewPlaybook.id,
      name: 'Build With Game View — Creator Audience',
      status: 'draft',
      autoMode: 'off',
      targetAudience: 'Creators',
      channels: ['facebook', 'instagram'],
    },
  })
  console.log(`✅ Campaign created: ${creatorCampaign.name}`)

  console.log('🌱 Seed completed successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
