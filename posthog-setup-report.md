# PostHog post-wizard report

The wizard has completed a deep integration of your TanStack Start project with PostHog analytics. The integration includes:

- **Client-side tracking** via `@posthog/react` with the `PostHogProvider` wrapper in the root layout
- **Server-side tracking** capability via `posthog-node` with a singleton client in `src/lib/posthog-server.ts`
- **Automatic pageviews, sessions, and web vitals** tracking
- **User identification** on sign-in and sign-up events
- **Exception capture** on authentication and form errors
- **Proxy configuration** in Vite to route analytics through `/ingest` for better ad-blocker resistance

## Event Tracking Summary

| Event Name | Description | File |
|------------|-------------|------|
| `user_signed_up` | User completed sign-up form and created a new account | `src/routes/auth/sign-up.tsx` |
| `user_signed_in` | User successfully signed in to their account | `src/routes/auth/sign-in.tsx` |
| `standup_submitted` | User submitted their daily standup with completed/planned/blocker items | `src/routes/app/standup.tsx` |
| `standup_shared` | User created a public share link for their standup | `src/routes/app/history.tsx` |
| `standup_share_retracted` | User revoked a public share link for their standup | `src/routes/app/history.tsx` |
| `team_created` | Admin created a new team in the organization | `src/routes/app/settings/teams.tsx` |
| `team_member_added` | Admin added a member to a team | `src/routes/app/settings/teams.tsx` |
| `team_member_removed` | Admin removed a member from a team | `src/routes/app/settings/teams.tsx` |
| `member_invited` | Admin invited a new member to the organization via email | `src/routes/app/settings/members.tsx` |
| `member_deactivated` | Admin deactivated a member from the organization | `src/routes/app/settings/members.tsx` |
| `subscription_upgrade_started` | User initiated an upgrade to a paid subscription plan | `src/routes/app/settings/billing.tsx` |
| `subscription_cancelled` | User cancelled their subscription plan | `src/routes/app/settings/billing.tsx` |
| `subscription_restored` | User restored a previously cancelled subscription | `src/routes/app/settings/billing.tsx` |
| `api_key_created` | User created a new API key for integrations | `src/routes/app/settings/api-keys.tsx` |
| `api_key_revoked` | User revoked an existing API key | `src/routes/app/settings/api-keys.tsx` |

## Files Modified

- `src/routes/__root.tsx` - Added PostHogProvider wrapper
- `vite.config.ts` - Added proxy configuration for `/ingest` endpoint
- `src/lib/posthog-server.ts` - Created server-side PostHog client (new file)
- `.env` - Added PostHog API key and host environment variables

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

### Dashboard
- [Analytics basics](https://us.posthog.com/project/315228/dashboard/1282888) - Main dashboard with all insights

### Insights
- [User Signups & Logins](https://us.posthog.com/project/315228/insights/6EoLNiP7) - Track daily sign-ups and sign-ins over time
- [Standup Activity](https://us.posthog.com/project/315228/insights/lC8ZSM5B) - Track standup submissions over time
- [Signup to Standup Funnel](https://us.posthog.com/project/315228/insights/as1IWpSp) - Conversion funnel from user sign-up to first standup submission
- [Team Management Activity](https://us.posthog.com/project/315228/insights/E5o1y3IP) - Track team creation and member management
- [Subscription Events](https://us.posthog.com/project/315228/insights/6fUKTEIP) - Track subscription upgrades, cancellations, and restorations

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/posthog-integration-tanstack-start/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.
