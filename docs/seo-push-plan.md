# DailyStand SEO Push Plan

Last updated: February 16, 2026

## Goals

- Increase qualified organic traffic for teams actively evaluating async standup tools.
- Rank for high-intent phrases around standup software, open source deployment, and API automation.
- Grow trial signups from organic landing sessions.

## Primary keyword clusters

### Core product intent

- async standup software
- daily standup software
- remote team standup tool
- async scrum updates

### Platform positioning

- open source standup tool
- self hosted standup app
- developer standup platform

### API and automation intent

- standup API
- MCP standup tools
- AI standup generator
- standup analytics dashboard

## Ranking targets (90-day)

- Top 10: at least 5 primary keywords
- Top 20: at least 10 primary/secondary keywords
- Organic conversion rate from landing + docs: +30% vs baseline

## On-page implementation (already shipped)

- Route-level title, description, canonical, robots, Open Graph, and Twitter tags.
- Generated OG images using `@vercel/og` (`/api/og`) with page-specific themes.
- Home page content expanded with use-case blocks and FAQ targeting keyword intent.
- JSON-LD added for `SoftwareApplication` and `Organization`.
- `robots.txt` includes sitemap reference.
- `sitemap.xml` includes all major crawlable marketing/docs routes.

## Content expansion roadmap

### Wave 1 (Weeks 1-2)

- Publish `/compare/async-standup-vs-daily-meeting`.
- Publish `/guides/async-standup-template`.
- Publish `/guides/self-hosted-standup-software`.

### Wave 2 (Weeks 3-6)

- Publish `/guides/engineering-standup-automation`.
- Publish `/guides/standup-api-integration`.
- Publish `/guides/remote-team-status-updates`.

### Wave 3 (Weeks 7-12)

- Publish customer implementation stories.
- Add template libraries for standup workflows (Scrum, SRE, product engineering).
- Add benchmark content using aggregate standup metrics.

## Internal linking rules

- Home page links to docs and top intent pages with exact-match anchors where natural.
- Docs pages link back to pricing and signup intent CTAs.
- Each new guide links to at least 2 related guides and 1 product page.

## Technical SEO checklist

- Keep all indexable pages under 200ms TTFB at p75 in production.
- Preserve SSR output for all marketing routes.
- Ensure OG generation endpoint stays stable and cacheable.
- Re-submit sitemap after each content wave.
- Validate canonical consistency after route additions.

## Measurement cadence

- Weekly: Search Console query ranking changes by keyword cluster.
- Weekly: Organic sessions, CTR, and landing page engagement.
- Biweekly: New content indexation and internal link crawl stats.
- Monthly: Conversion impact (organic signup starts and paid conversions).

## Constraints and expectation setting

SEO cannot guarantee first-page rankings on a fixed timeline. Ranking depends on competition, domain authority, backlinks, and content quality over time. This plan prioritizes controllable factors and continuous optimization for sustainable first-page movement.
