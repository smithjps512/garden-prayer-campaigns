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
