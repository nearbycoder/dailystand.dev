import { config } from "dotenv"
config({ path: [".env.local", ".env"] })

import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import * as schema from "./schema"
import { hashPassword } from "better-auth/crypto"
import { randomBytes } from "node:crypto"

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! })
const db = drizzle(pool, { schema })

function id() {
	return randomBytes(16).toString("hex")
}

function daysAgo(n: number): Date {
	const d = new Date()
	d.setDate(d.getDate() - n)
	return d
}

function dateStr(d: Date): string {
	return d.toISOString().split("T")[0]
}

const PEOPLE = [
	{ name: "Alex Chen", email: "alex@dailystand.dev" },
	{ name: "Jamie Rivera", email: "jamie@dailystand.dev" },
	{ name: "Sam Park", email: "sam@dailystand.dev" },
	{ name: "Morgan Lee", email: "morgan@dailystand.dev" },
	{ name: "Taylor Kim", email: "taylor@dailystand.dev" },
]

const PASSWORD = "password123"

const TEAMS = ["Engineering", "Design"]

const COMPLETED_ITEMS = [
	"Implemented user authentication flow",
	"Fixed pagination bug on dashboard",
	"Reviewed PR #142 - API refactor",
	"Deployed v2.3.1 to staging",
	"Updated API documentation",
	"Migrated database to new schema",
	"Wrote unit tests for payment module",
	"Resolved merge conflicts on feature branch",
	"Optimized image loading pipeline",
	"Added error tracking with Sentry",
	"Refactored notification service",
	"Completed design review for settings page",
	"Fixed CORS issue on API endpoints",
	"Upgraded dependencies to latest versions",
	"Set up CI/CD pipeline for staging",
	"Created wireframes for onboarding flow",
	"Designed new icon set for navigation",
	"Built prototype for team dashboard",
	"Updated color system documentation",
	"Finished responsive layout for mobile",
]

const PLANNED_ITEMS = [
	"Start work on billing integration",
	"Review open pull requests",
	"Write integration tests for auth",
	"Investigate memory leak in worker",
	"Set up monitoring alerts",
	"Pair with Jamie on API design",
	"Draft RFC for new caching strategy",
	"Update deployment scripts",
	"Research WebSocket alternatives",
	"Begin SSO integration spike",
	"Design empty states for all pages",
	"Create component library docs",
	"Build chart components for analytics",
	"Update design tokens for dark mode",
	"User testing session for new flow",
]

const BLOCKER_ITEMS = [
	"Waiting on API key from third-party vendor",
	"Blocked by infrastructure team on VPN access",
	"Need design approval for checkout flow",
	"CI pipeline failing intermittently",
	"Waiting on legal review for ToS changes",
	"Database migration needs DBA review",
	"Staging environment is down",
	"Need access to production logs",
]

function pick<T>(arr: T[]): T {
	return arr[Math.floor(Math.random() * arr.length)]
}

function pickN<T>(arr: T[], min: number, max: number): T[] {
	const n = min + Math.floor(Math.random() * (max - min + 1))
	const shuffled = [...arr].sort(() => Math.random() - 0.5)
	return shuffled.slice(0, n)
}

async function seed() {
	console.log("Seeding database...")

	// Create users
	const userIds: string[] = []
	const accountIds: string[] = []
	const hashedPassword = await hashPassword(PASSWORD)

	for (const person of PEOPLE) {
		const userId = id()
		userIds.push(userId)

		await db.insert(schema.user).values({
			id: userId,
			name: person.name,
			email: person.email,
			emailVerified: true,
			createdAt: daysAgo(30),
			updatedAt: daysAgo(30),
		})

		const accountId = id()
		accountIds.push(accountId)

		await db.insert(schema.account).values({
			id: accountId,
			accountId: userId,
			providerId: "credential",
			userId: userId,
			password: hashedPassword,
			createdAt: daysAgo(30),
			updatedAt: daysAgo(30),
		})

		console.log(`  Created user: ${person.name} (${person.email})`)
	}

	// Create organization
	const orgId = id()
	await db.insert(schema.organization).values({
		id: orgId,
		name: "Acme Corp",
		slug: "acme-corp",
		createdAt: daysAgo(30),
	})
	console.log("  Created org: Acme Corp")

	// Add all users as org members (first user is owner)
	for (let i = 0; i < userIds.length; i++) {
		await db.insert(schema.member).values({
			id: id(),
			organizationId: orgId,
			userId: userIds[i],
			role: i === 0 ? "owner" : "member",
			createdAt: daysAgo(30),
		})
	}
	console.log(`  Added ${userIds.length} org members`)

	// Create teams
	const teamIds: string[] = []
	for (const teamName of TEAMS) {
		const teamId = id()
		teamIds.push(teamId)

		await db.insert(schema.team).values({
			id: teamId,
			name: teamName,
			organizationId: orgId,
			createdAt: daysAgo(30),
		})
		console.log(`  Created team: ${teamName}`)
	}

	// Assign users to teams
	// Engineering: Alex, Jamie, Sam
	// Design: Morgan, Taylor
	const teamAssignments = [
		[0, 1, 2], // Engineering
		[3, 4], // Design
	]

	for (let t = 0; t < teamIds.length; t++) {
		for (const userIdx of teamAssignments[t]) {
			await db.insert(schema.teamMember).values({
				id: id(),
				teamId: teamIds[t],
				userId: userIds[userIdx],
				createdAt: daysAgo(30),
			})
		}
		console.log(
			`  Assigned ${teamAssignments[t].length} members to ${TEAMS[t]}`,
		)
	}

	// Create standup entries for the past 14 days (weekdays only)
	let entryCount = 0
	for (let day = 14; day >= 0; day--) {
		const date = daysAgo(day)
		const dow = date.getDay()
		if (dow === 0 || dow === 6) continue // skip weekends

		const ds = dateStr(date)

		for (let u = 0; u < userIds.length; u++) {
			// ~80% chance each person posts on a given day
			if (Math.random() > 0.8) continue

			const teamId = u < 3 ? teamIds[0] : teamIds[1]

			// 1-3 completed items
			for (const item of pickN(COMPLETED_ITEMS, 1, 3)) {
				await db.insert(schema.standupEntry).values({
					userId: userIds[u],
					organizationId: orgId,
					teamId,
					date: ds,
					type: "completed",
					content: item,
					createdAt: date,
				})
				entryCount++
			}

			// 1-2 planned items
			for (const item of pickN(PLANNED_ITEMS, 1, 2)) {
				await db.insert(schema.standupEntry).values({
					userId: userIds[u],
					organizationId: orgId,
					teamId,
					date: ds,
					type: "planned",
					content: item,
					createdAt: date,
				})
				entryCount++
			}

			// ~30% chance of a blocker
			if (Math.random() < 0.3) {
				await db.insert(schema.standupEntry).values({
					userId: userIds[u],
					organizationId: orgId,
					teamId,
					date: ds,
					type: "blocker",
					content: pick(BLOCKER_ITEMS),
					createdAt: date,
				})
				entryCount++
			}
		}
	}

	console.log(`  Created ${entryCount} standup entries over ~14 days`)
	console.log("\nDone! All users have password: password123")
	console.log("Sign in with any of:")
	for (const person of PEOPLE) {
		console.log(`  ${person.email}`)
	}

	await pool.end()
	process.exit(0)
}

seed().catch(async (err) => {
	console.error("Seed failed:", err)
	await pool.end()
	process.exit(1)
})
