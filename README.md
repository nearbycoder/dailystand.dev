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
- React Email + Resend digest workflows (daily/weekly, plan-aware)
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
- [Sentry](https://sentry.io) (optional monitoring + tracing)
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
RESET_PASSWORD_TOKEN_EXPIRES_IN=3600
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=DailyStand <no-reply@your-domain.com>
DRY_RUN_EMAILS=true
EMAIL_DIGEST_WORKFLOW_SECRET=replace-with-random-secret

# Optional: enable Sentry
VITE_SENTRY_DSN=https://...@o0.ingest.sentry.io/0
SENTRY_DSN=https://...@o0.ingest.sentry.io/0
VITE_SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_AUTH_TOKEN=
SENTRY_ORG=
SENTRY_PROJECT=

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
- `DRY_RUN_EMAILS` defaults to enabled in local development and prevents real email sends.
- Set `DRY_RUN_EMAILS=false` to send real emails (with `RESEND_API_KEY` + `RESEND_FROM_EMAIL` configured).
- If Resend env vars are missing, invite/reset links are not emailed and are logged server-side for local development.
- `EMAIL_DIGEST_WORKFLOW_SECRET` secures the digest workflow endpoint (`/api/workflows/email-digests`).
- Sentry is optional. Client + server instrumentation is enabled when DSN env vars are configured.
- Source map upload is enabled only when `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` are provided.

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

- Demo org: `Acme Corp` (18 users, 7 teams, business subscription, invites, digest preferences, share links, dense history)
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

## Email digest workflows

- User settings: `/app/settings/notifications`
- Free plan: weekly digest only
- Pro/Business: users can opt in and choose daily or weekly
- Emails are rendered with React Email and sent via Resend
- In local development, `DRY_RUN_EMAILS=true` logs email attempts and skips real sends

Run manually:

```bash
bun run workflow:email-digests
bun run workflow:email-digests daily
bun run workflow:email-digests weekly
```

Trigger via workflow endpoint:

```bash
curl -X POST http://localhost:3000/api/workflows/email-digests \
  -H "x-workflow-secret: $EMAIL_DIGEST_WORKFLOW_SECRET" \
  -H "content-type: application/json" \
  -d '{"cadence":"all"}'
```

## Sentry

- SDK: `@sentry/tanstackstart-react`
- Client init is wired in `src/router.tsx`
- Server instrumentation is in `instrument.server.mjs` and loaded via `NODE_OPTIONS`
- Server entry is wrapped in `src/server.ts` with `wrapFetchWithSentry`
- Vite plugin `sentryTanstackStart` is enabled only when org/project/auth token env vars are present

## Scripts

| Command | Description |
|---|---|
| `bun run dev` | Start dev server on port 3000 (loads `instrument.server.mjs`) |
| `bun run build` | Build for production and copy server instrumentation file |
| `bun run preview` | Preview production build |
| `bun run start` | Start production server with Sentry instrumentation import |
| `bun run test` | Run unit tests (Vitest) |
| `bun run test:unit` | Run unit tests (Vitest) |
| `bun run test:e2e` | Run end-to-end tests (Playwright) |
| `bun run test:e2e:headed` | Run Playwright tests in headed mode |
| `bun run test:all` | Run unit + end-to-end tests |
| `bun run typecheck` | TypeScript typecheck |
| `bun run lint` | Lint with Biome |
| `bun run format` | Format with Biome |
| `bun run check` | Biome check |
| `bun run db:push` | Push schema to DB |
| `bun run db:generate` | Generate Drizzle migrations |
| `bun run db:migrate` | Run migrations |
| `bun run db:pull` | Pull schema from DB |
| `bun run db:studio` | Open Drizzle Studio |
| `bun run db:seed` | Reset and seed DB |
| `bun run workflow:email-digests` | Run daily+weekly digest workflows |

## Testing + CI/CD

### Unit tests (Vitest)

- Config: `vitest.config.ts`
- Setup file: `src/test/setup.ts`
- Coverage report: text + `lcov`

Run:

```bash
bun run test:unit
```

Note: use `bun run test:unit` (or `bun run test`) for Vitest. `bun test` invokes Bun's native test runner, which is not this project's configured test harness.

### End-to-end tests (Playwright)

- Config: `playwright.config.ts`
- Specs: `tests/e2e/*.spec.ts`
- Default seeded test credentials:
  - `alex@dailystand.dev`
  - `password123`

Run locally (after DB push + seed):

```bash
bun run db:push
bun run db:seed
bun run test:e2e
```

### GitHub Actions

- CI workflow: `.github/workflows/ci.yml`
  - quality gate: typecheck, Vitest, build
  - e2e gate: Postgres service, DB push/seed, Playwright
- CD workflow: `.github/workflows/deploy.yml`
  - builds and publishes Docker image to `ghcr.io/<owner>/<repo>`
  - optional deploy trigger via `DEPLOY_WEBHOOK_URL` secret

### Container deployment

- Dockerfile: `Dockerfile`
- Built image runs `bun run start` and exposes port `3000`

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
