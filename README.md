# DailyStand

![DailyStand](public/screenshot.png)

Async daily standup app for teams. Employees join organizations, get assigned to teams, and post daily updates — what they completed, what they're working on next, and any blockers.

## Features

- **Daily standups** — One standup per user per day with three sections: completed, planned, and blockers. Re-submitting replaces the previous entry.
- **Organizations & teams** — Create an org, invite members, organize into teams.
- **Team timelines** — Paginated multi-day view of team standups with navigation (older/newer/today).
- **Personal history** — Browse your own standup history.
- **Dark/light/system theme** — Brutalist design with a bold lime accent, switchable between dark, light, and system preference.
- **Subscription tiers** — Free, Pro ($8/user/mo), and Business ($12/user/mo) via Stripe with enforced limits on teams, members, and history retention.

## Tech Stack

- [TanStack Start](https://tanstack.com/start) — SSR React framework with file-based routing
- [tRPC v11](https://trpc.io) — End-to-end typesafe API layer
- [Drizzle ORM](https://orm.drizzle.team) — TypeScript ORM with PostgreSQL
- [BetterAuth](https://www.better-auth.com) — Authentication with organization/team and Stripe plugins
- [Tailwind CSS v4](https://tailwindcss.com) — Utility-first styling with custom design tokens
- [Stripe](https://stripe.com) — Subscription billing

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) runtime
- PostgreSQL database
- Stripe account (for billing features)

### Setup

1. Install dependencies:

   ```bash
   bun install
   ```

2. Create `.env.local` with the required variables:

   ```
   DATABASE_URL=postgresql://user:pass@localhost:5432/dailystand
   BETTER_AUTH_SECRET=your-secret-here
   BETTER_AUTH_URL=http://localhost:3000
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

   Generate an auth secret:

   ```bash
   bunx --bun @better-auth/cli secret
   ```

3. Push the database schema:

   ```bash
   bun run db:push
   ```

4. (Optional) Seed with test data:

   ```bash
   bun run db:seed
   ```

   This creates 5 users, 1 org (Acme Corp), 2 teams, and ~170 standup entries. Default password: `password123`.

5. Start the dev server:

   ```bash
   bun run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---|---|
| `bun run dev` | Start dev server on port 3000 |
| `bun run build` | Production build |
| `bun run start` | Start production server |
| `bun run db:push` | Push Drizzle schema to database |
| `bun run db:generate` | Generate Drizzle migrations |
| `bun run db:studio` | Open Drizzle Studio |
| `bun run db:seed` | Seed database with test data |
| `bun run lint` | Lint with Biome |
| `bun run format` | Format with Biome |
| `bun run test` | Run tests with Vitest |

## Project Structure

```
src/
├── components/          # Shared UI components (theme toggle, etc.)
├── db/
│   ├── schema.ts        # Drizzle schema (auth tables + standupEntry)
│   ├── auth-schema.ts   # BetterAuth generated tables
│   └── seed.ts          # Database seed script
├── integrations/
│   ├── trpc/
│   │   ├── router.ts    # Main tRPC router
│   │   ├── init.ts      # tRPC context & procedures
│   │   └── routers/     # standups, teams, org sub-routers
│   └── tanstack-query/  # React Query + tRPC provider
├── lib/
│   ├── auth.ts          # BetterAuth server config
│   ├── auth-client.ts   # BetterAuth client
│   └── theme.tsx        # Theme provider (dark/light/system)
├── routes/
│   ├── index.tsx         # Landing page with pricing
│   ├── auth/             # Sign in & sign up
│   └── app/              # Authenticated app routes
│       ├── route.tsx     # App layout with sidebar
│       ├── index.tsx     # Dashboard
│       ├── standup.tsx   # Submit standup form
│       ├── history.tsx   # Personal history
│       ├── team.$teamId.tsx  # Team timeline
│       └── settings/     # Org settings, billing, members, teams
└── styles.css            # Tailwind config + DS theme tokens
```
