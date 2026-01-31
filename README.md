# Campaign Engine

Marketing Automation System - A closed-loop marketing automation platform that generates content from strategic playbooks, distributes across social platforms, tracks performance, and autonomously optimizes based on results.

## Sprint 1 - Foundation

This sprint implements:
- Next.js 14+ project with App Router
- PostgreSQL database with Prisma ORM
- Basic password authentication
- Dashboard layout with navigation
- Business CRUD operations
- Image upload with S3/R2 storage integration

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Authentication**: JWT-based sessions
- **Storage**: AWS S3 / Cloudflare R2
- **Styling**: Tailwind CSS

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- AWS S3 bucket or Cloudflare R2 bucket (for image storage)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the environment example file:
   ```bash
   cp .env.example .env
   ```

4. Update `.env` with your configuration:
   - `DATABASE_URL` - PostgreSQL connection string
   - `AUTH_SECRET` - Secret key for JWT tokens (min 32 characters)
   - `ADMIN_EMAIL` - Admin user email
   - `ADMIN_PASSWORD` - Admin user password
   - AWS S3 or Cloudflare R2 credentials

5. Generate Prisma client:
   ```bash
   npm run db:generate
   ```

6. Push schema to database:
   ```bash
   npm run db:push
   ```

7. Seed the database with initial data:
   ```bash
   npm run db:seed
   ```

8. Start the development server:
   ```bash
   npm run dev
   ```

9. Open [http://localhost:3000](http://localhost:3000) and log in with your admin credentials

## Project Structure

```
src/
├── app/
│   ├── (auth)/           # Auth pages (login)
│   ├── (dashboard)/      # Dashboard pages
│   │   ├── businesses/   # Business management
│   │   ├── playbooks/    # Playbook management
│   │   ├── campaigns/    # Campaign management
│   │   ├── content/      # Content library
│   │   ├── images/       # Image library
│   │   ├── tasks/        # Task management
│   │   ├── analytics/    # Analytics dashboard
│   │   └── escalations/  # Escalation handling
│   └── api/              # API routes
├── components/           # Shared components
└── lib/                  # Utilities and helpers
    ├── prisma.ts         # Prisma client
    ├── auth.ts           # Authentication helpers
    ├── storage.ts        # S3/R2 storage helpers
    └── api.ts            # API response helpers
prisma/
├── schema.prisma         # Database schema
└── seed.ts               # Seed script
```

## Supported Businesses

The system is pre-configured for:
- **Melissa for Educators** - Education SaaS platform ($99/year subscription)
- **Vaquero Homes** - Custom home builder (Texas market)

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema to database
- `npm run db:seed` - Seed the database
- `npm run db:studio` - Open Prisma Studio
- `npm run db:reset` - Reset database

## Sprint Roadmap

- [x] **Sprint 1** - Foundation, database, basic UI shell
- [ ] **Sprint 2** - Playbook + Content generation
- [ ] **Sprint 3** - Campaign + Tasks management
- [ ] **Sprint 4** - Meta Integration
- [ ] **Sprint 5** - Analytics + Optimization
- [ ] **Sprint 6** - Polish + Launch
