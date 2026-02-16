# DailyStand

![DailyStand](public/screenshot.png)

Open source, self-hostable async standups for modern teams.

- GitHub: [nearbycoder/dailystand.dev](https://github.com/nearbycoder/dailystand.dev)

## What is included now

- Daily standups with `completed`, `planned`, `blockers`
- Multi-team submission modes:
  - submit the same update to multiple teams
  - submit different updates per team
- Dashboard focused on your teams and today's team standups
- Advanced analytics at `/app/analytics` with overlays/popovers and drilldowns
- Team and personal history with markdown copy flows
- Export analytics range to markdown or CSV
- Per-day public share links for personal standups, with retract support
- Auto-linking for URLs in standup content (including domains like `x.com`)
- API keys (with expiring or non-expiring tokens)
- Public REST API (`/api/public/v1/*`)
- MCP server (`/api/mcp`) authenticated by API key
- Organization/team/member management UI (including search/filter/pagination on members)
- Stripe-backed billing (optional) via Better Auth Stripe plugin
- Landing page messaging for MCP+AI workflows and open-source/self-hosted deployment
- Integrations roadmap callouts for Slack + Linear (coming soon)
- Privacy and Terms pages
- Fully responsive app shell + pages

## Pricing and enforced limits

Current plans:

| Plan | Price | Team limit | Member limit | History window |
|---|---|---:|---:|---:|
| Free | $0 | 1 | 5 | 7 days |
| Pro | $16/mo | Unlimited | 15 | 90 days |
| Business | $65/mo | Unlimited | Unlimited | Unlimited |

Limits are enforced across:

- UI flows
- tRPC procedures
- Public API
- MCP tools

## Tech stack

- [TanStack Start](https://tanstack.com/start)
- [TanStack Router + Query](https://tanstack.com/router)
- [tRPC v11](https://trpc.io)
- [Drizzle ORM](https://orm.drizzle.team) + PostgreSQL
- [Better Auth](https://www.better-auth.com) (organization, API key, Stripe plugins)
- [Stripe](https://stripe.com) (optional, for paid plans)
- [Tailwind CSS v4](https://tailwindcss.com)
- [Sonner](https://sonner.emilkowal.ski/) for toasts

## Quick start

### 1) Install deps

```bash
bun install
```

### 2) Configure environment

Create `.env.local`:

```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/dailystand
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=your-secret-here
BETTER_AUTH_TRUSTED_ORIGINS=http://localhost:3000
ALLOWED_HOSTS=localhost,127.0.0.1
API_ALLOWED_ORIGINS=http://localhost:3000

# Optional: enable billing
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_BUSINESS_PRICE_ID=price_...
```

Generate a Better Auth secret:

```bash
bunx --bun @better-auth/cli secret
```

Notes:

- Stripe is optional. If Stripe env vars are missing, billing flows are disabled.
- Dev host allowlist currently includes `43c61fda6a66.ngrok.app` in Vite and Better Auth config.

### 3) Push schema

```bash
bun run db:push
```

### 4) Seed data (optional)

```bash
bun run db:seed
```

`db:seed` now resets the database before inserting data.

Seed includes:

- Demo org: `Acme Corp` (5 users, 2 teams)
- Enterprise org: `Northstar Enterprise` (10 teams, 100 users, business subscription, large standup volume)
- Default password for all seeded users: `password123`

### 5) Run app

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000)

## API keys, REST API, and MCP

Create keys from `/app/settings/api-keys`.

- Expiration options include fixed-day presets and `Never expires`.
- API key copy actions surface Sonner toasts.
- Default key scope is least-privilege (`profile`, `teams`, `standups`, `analytics`); owner member-management scope can be added explicitly when creating a key.

### Public API

Base: `/api/public/v1`

Auth:

- `x-api-key: <key>` header, or
- `Authorization: Bearer <key>`

Core endpoints:

- `GET /api/public/v1` (docs metadata)
- `GET /api/public/v1/me`
- `GET /api/public/v1/teams`
- `GET /api/public/v1/teams/mine`
- `GET /api/public/v1/standups/day`
- `GET /api/public/v1/standups/history`
- `POST /api/public/v1/standups`
- `GET /api/public/v1/analytics`

When using team-scoped read/write operations, access is limited to teams the API key user belongs to.

### MCP server

Endpoint: `/api/mcp` (JSON-RPC over HTTP POST)

Flow:

1. `initialize`
2. `tools/list`
3. `tools/call`

Tooling includes:

- Team/org discovery: `list_organizations`, `list_teams`, `list_my_teams`
- Member/team management (owner-only): `add_organization_member`, `assign_user_to_team`, `remove_user_from_team`
- Standup read/write: `submit_my_standup`, `get_my_standup`, `get_my_standup_history`, `get_team_standup_day`, `get_team_standup_history`

Reference docs are available in-app at `/app/settings/api-docs`.

## Standup and history behavior

- Standup date uses local browser date (`YYYY-MM-DD`) for timezone-safe "today" behavior.
- Submitting a daily standup navigates to history.
- Team members can copy team day updates as markdown.
- Users can copy:
  - one history day as markdown
  - all personal history as markdown
- Users can create/retract a public share URL for a specific day (`/share/:token`).
- Shared links are public and do not require sign-in.

## Analytics

Analytics route: `/app/analytics`

Includes:

- range filters (`7/14/30/60/90`)
- team scope filters
- metric overlays and drilldowns
- task/person detail overlays
- export panel for markdown/CSV with custom date range and team filter

Exports honor plan history limits.

## Scripts

| Command | Description |
|---|---|
| `bun run dev` | Start dev server on port 3000 |
| `bun run build` | Build for production |
| `bun run preview` | Preview production build |
| `bun run start` | Start production server |
| `bun run test` | Run tests |
| `bun run lint` | Lint with Biome |
| `bun run format` | Format with Biome |
| `bun run check` | Biome check |
| `bun run db:push` | Push schema to DB |
| `bun run db:generate` | Generate Drizzle migrations |
| `bun run db:migrate` | Run migrations |
| `bun run db:pull` | Pull schema from DB |
| `bun run db:studio` | Open Drizzle Studio |
| `bun run db:seed` | Reset and seed DB |

## Key routes

- Landing: `/`
- Dashboard: `/app`
- Standup: `/app/standup`
- History: `/app/history`
- Team timeline: `/app/team/:teamId`
- Analytics: `/app/analytics`
- Settings:
  - `/app/settings`
  - `/app/settings/billing`
  - `/app/settings/members`
  - `/app/settings/teams`
  - `/app/settings/api-keys`
  - `/app/settings/api-docs`
- Public share: `/share/:token`
- Legal: `/privacy`, `/terms`
