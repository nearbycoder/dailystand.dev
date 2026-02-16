import { config } from "dotenv";

config({ path: [".env.local", ".env"] });

import { randomBytes } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
	throw new Error("DATABASE_URL is required to run db:seed");
}

const pool = new pg.Pool({ connectionString });
const db = drizzle(pool, { schema });

function id() {
	return randomBytes(16).toString("hex");
}

function daysAgo(n: number): Date {
	const d = new Date();
	d.setDate(d.getDate() - n);
	return d;
}

function daysFromNow(n: number): Date {
	const d = new Date();
	d.setDate(d.getDate() + n);
	return d;
}

function dateStr(d: Date): string {
	return d.toISOString().split("T")[0];
}

async function resetDatabase() {
	const { rows } = await pool.query<{ tablename: string }>(
		`
      select tablename
      from pg_tables
      where schemaname = 'public'
        and tablename <> '__drizzle_migrations'
    `,
	);

	if (rows.length === 0) return;

	const quotedTables = rows
		.map((row) => `"${row.tablename.replaceAll('"', '""')}"`)
		.join(", ");

	await pool.query(`TRUNCATE TABLE ${quotedTables} RESTART IDENTITY CASCADE`);
}

const PASSWORD = "password123";

type SeedPerson = {
	name: string;
	email: string;
};

const DEMO_PEOPLE: SeedPerson[] = [
	{ name: "Alex Chen", email: "alex@dailystand.dev" },
	{ name: "Jamie Rivera", email: "jamie@dailystand.dev" },
	{ name: "Sam Park", email: "sam@dailystand.dev" },
	{ name: "Morgan Lee", email: "morgan@dailystand.dev" },
	{ name: "Taylor Kim", email: "taylor@dailystand.dev" },
];

const DEMO_TEAMS = ["Engineering", "Design"];

const ENTERPRISE_TEAM_NAMES = [
	"Platform Engineering",
	"Application Engineering",
	"Product Design",
	"Quality Engineering",
	"Security & Compliance",
	"Squad Atlas",
	"Squad Beacon",
	"Squad Comet",
	"Squad Delta",
	"Squad Echo",
];

const ENTERPRISE_USER_COUNT = 100;

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
	"Stabilized distributed cache invalidation",
	"Reduced P95 latency for timeline queries",
	"Completed SOC2 evidence collection task",
	"Merged onboarding flow improvements",
	"Hardened role-based permission checks",
];

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
	"Audit service-to-service credentials",
	"Prepare quarterly dependency upgrade plan",
	"Refine multi-team standup experience",
];

const BLOCKER_ITEMS = [
	"Waiting on API key from third-party vendor",
	"Blocked by infrastructure team on VPN access",
	"Need design approval for checkout flow",
	"CI pipeline failing intermittently",
	"Waiting on legal review for ToS changes",
	"Database migration needs DBA review",
	"Staging environment is down",
	"Need access to production logs",
	"Blocked on contract review for security tooling",
	"Awaiting IAM permissions for new service account",
];

function pick<T>(arr: T[]): T {
	return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], min: number, max: number): T[] {
	const n = min + Math.floor(Math.random() * (max - min + 1));
	const shuffled = [...arr].sort(() => Math.random() - 0.5);
	return shuffled.slice(0, n);
}

function buildEnterprisePeople(count: number): SeedPerson[] {
	const firstNames = [
		"Avery",
		"Jordan",
		"Riley",
		"Parker",
		"Quinn",
		"Casey",
		"Logan",
		"Skyler",
		"Reese",
		"Dakota",
		"Emerson",
		"Rowan",
		"Phoenix",
		"Sawyer",
		"Kendall",
		"Harper",
		"Finley",
		"Cameron",
		"Charlie",
		"River",
	];
	const lastNames = [
		"Patel",
		"Nguyen",
		"Garcia",
		"Johnson",
		"Kim",
		"Singh",
		"Brown",
		"Davis",
		"Martinez",
		"Wilson",
		"Anderson",
		"Lopez",
		"Thomas",
		"Jackson",
		"Harris",
	];

	const people: SeedPerson[] = [];
	for (let i = 0; i < count; i++) {
		const first = firstNames[i % firstNames.length];
		const last =
			lastNames[Math.floor(i / firstNames.length) % lastNames.length];
		const seq = String(i + 1).padStart(3, "0");
		const localPart = `${first}.${last}.${seq}`.toLowerCase();

		people.push({
			name: `${first} ${last} ${seq}`,
			email: `${localPart}@enterprise.dailystand.dev`,
		});
	}

	return people;
}

async function createUsersWithCredentialAccounts(
	people: SeedPerson[],
	hashedPassword: string,
	createdAt: Date,
	logEvery = 1,
): Promise<string[]> {
	const userIds: string[] = [];

	for (let i = 0; i < people.length; i++) {
		const person = people[i];
		const userId = id();
		userIds.push(userId);

		await db.insert(schema.user).values({
			id: userId,
			name: person.name,
			email: person.email,
			emailVerified: true,
			createdAt,
			updatedAt: createdAt,
		});

		await db.insert(schema.account).values({
			id: id(),
			accountId: userId,
			providerId: "credential",
			userId,
			password: hashedPassword,
			createdAt,
			updatedAt: createdAt,
		});

		if (i % logEvery === 0 || i === people.length - 1) {
			console.log(`  Created user ${i + 1}/${people.length}: ${person.email}`);
		}
	}

	return userIds;
}

async function createOrganizationWithMembers({
	name,
	slug,
	memberUserIds,
	createdAt,
}: {
	name: string;
	slug: string;
	memberUserIds: string[];
	createdAt: Date;
}): Promise<string> {
	const orgId = id();
	await db.insert(schema.organization).values({
		id: orgId,
		name,
		slug,
		createdAt,
	});

	for (let i = 0; i < memberUserIds.length; i++) {
		await db.insert(schema.member).values({
			id: id(),
			organizationId: orgId,
			userId: memberUserIds[i],
			role: i === 0 ? "owner" : "member",
			createdAt,
		});
	}

	console.log(`  Created org: ${name}`);
	console.log(`  Added ${memberUserIds.length} org members`);

	return orgId;
}

async function createTeams(
	orgId: string,
	teamNames: string[],
	createdAt: Date,
): Promise<string[]> {
	const teamIds: string[] = [];

	for (const teamName of teamNames) {
		const teamId = id();
		teamIds.push(teamId);
		await db.insert(schema.team).values({
			id: teamId,
			name: teamName,
			organizationId: orgId,
			createdAt,
		});
	}

	console.log(`  Created ${teamIds.length} teams`);
	return teamIds;
}

async function seedDemoOrg(hashedPassword: string) {
	console.log("\nSeeding demo org...");

	const createdAt = daysAgo(30);
	const userIds = await createUsersWithCredentialAccounts(
		DEMO_PEOPLE,
		hashedPassword,
		createdAt,
		1,
	);

	const orgId = await createOrganizationWithMembers({
		name: "Acme Corp",
		slug: "acme-corp",
		memberUserIds: userIds,
		createdAt,
	});

	const teamIds = await createTeams(orgId, DEMO_TEAMS, createdAt);

	const teamAssignments = [
		[0, 1, 2], // Engineering
		[3, 4], // Design
	];

	for (let t = 0; t < teamIds.length; t++) {
		for (const userIdx of teamAssignments[t]) {
			await db.insert(schema.teamMember).values({
				id: id(),
				teamId: teamIds[t],
				userId: userIds[userIdx],
				createdAt,
			});
		}
		console.log(
			`  Assigned ${teamAssignments[t].length} members to ${DEMO_TEAMS[t]}`,
		);
	}

	let entryCount = 0;
	for (let day = 14; day >= 0; day--) {
		const date = daysAgo(day);
		const dow = date.getDay();
		if (dow === 0 || dow === 6) continue;

		const ds = dateStr(date);
		for (let u = 0; u < userIds.length; u++) {
			if (Math.random() > 0.8) continue;
			const teamId = u < 3 ? teamIds[0] : teamIds[1];

			for (const item of pickN(COMPLETED_ITEMS, 1, 3)) {
				await db.insert(schema.standupEntry).values({
					userId: userIds[u],
					organizationId: orgId,
					teamId,
					date: ds,
					type: "completed",
					content: item,
					createdAt: date,
				});
				entryCount++;
			}

			for (const item of pickN(PLANNED_ITEMS, 1, 2)) {
				await db.insert(schema.standupEntry).values({
					userId: userIds[u],
					organizationId: orgId,
					teamId,
					date: ds,
					type: "planned",
					content: item,
					createdAt: date,
				});
				entryCount++;
			}

			if (Math.random() < 0.3) {
				await db.insert(schema.standupEntry).values({
					userId: userIds[u],
					organizationId: orgId,
					teamId,
					date: ds,
					type: "blocker",
					content: pick(BLOCKER_ITEMS),
					createdAt: date,
				});
				entryCount++;
			}
		}
	}

	console.log(`  Created ${entryCount} demo standup entries`);
	return { orgId, userIds };
}

async function seedEnterpriseOrg(hashedPassword: string) {
	console.log("\nSeeding enterprise org...");

	const people = buildEnterprisePeople(ENTERPRISE_USER_COUNT);
	const createdAt = daysAgo(20);
	const userIds = await createUsersWithCredentialAccounts(
		people,
		hashedPassword,
		createdAt,
		10,
	);

	const orgId = await createOrganizationWithMembers({
		name: "Northstar Enterprise",
		slug: "northstar-enterprise",
		memberUserIds: userIds,
		createdAt,
	});

	await db.insert(schema.subscription).values({
		id: id(),
		plan: "business",
		referenceId: orgId,
		status: "active",
		seats: ENTERPRISE_USER_COUNT,
		periodStart: daysAgo(2),
		periodEnd: daysFromNow(28),
	});
	console.log("  Added business subscription for enterprise org");

	const teamIds = await createTeams(orgId, ENTERPRISE_TEAM_NAMES, createdAt);

	const userTeams = new Map<string, string[]>();
	for (let i = 0; i < userIds.length; i++) {
		const userId = userIds[i];
		const disciplineTeamIdx = i % 5;
		const squadTeamIdx = 5 + (Math.floor(i / 5) % 5);

		const memberships = new Set<string>([
			teamIds[disciplineTeamIdx],
			teamIds[squadTeamIdx],
		]);

		if (i % 10 === 0) memberships.add(teamIds[4]);
		if (i % 12 === 0) memberships.add(teamIds[5 + ((squadTeamIdx - 4) % 5)]);

		const membershipList = Array.from(memberships);
		userTeams.set(userId, membershipList);

		for (const teamId of membershipList) {
			await db.insert(schema.teamMember).values({
				id: id(),
				teamId,
				userId,
				createdAt,
			});
		}
	}

	for (let t = 0; t < teamIds.length; t++) {
		const memberCount = Array.from(userTeams.values()).filter((memberships) =>
			memberships.includes(teamIds[t]),
		).length;
		console.log(`  Team ${ENTERPRISE_TEAM_NAMES[t]} members: ${memberCount}`);
	}

	let entryCount = 0;
	for (let day = 21; day >= 0; day--) {
		const date = daysAgo(day);
		const dow = date.getDay();
		if (dow === 0 || dow === 6) continue;

		const ds = dateStr(date);
		for (const userId of userIds) {
			if (Math.random() > 0.7) continue;
			const memberships = userTeams.get(userId) ?? [];
			if (memberships.length === 0) continue;

			const teamsToPost = [memberships[0]];
			if (memberships.length > 1 && Math.random() < 0.5) {
				teamsToPost.push(memberships[1]);
			}
			if (memberships.length > 2 && Math.random() < 0.2) {
				teamsToPost.push(memberships[2]);
			}

			for (const teamId of teamsToPost) {
				for (const item of pickN(COMPLETED_ITEMS, 1, 3)) {
					await db.insert(schema.standupEntry).values({
						userId,
						organizationId: orgId,
						teamId,
						date: ds,
						type: "completed",
						content: item,
						createdAt: date,
					});
					entryCount++;
				}

				for (const item of pickN(PLANNED_ITEMS, 1, 2)) {
					await db.insert(schema.standupEntry).values({
						userId,
						organizationId: orgId,
						teamId,
						date: ds,
						type: "planned",
						content: item,
						createdAt: date,
					});
					entryCount++;
				}

				if (Math.random() < 0.25) {
					await db.insert(schema.standupEntry).values({
						userId,
						organizationId: orgId,
						teamId,
						date: ds,
						type: "blocker",
						content: pick(BLOCKER_ITEMS),
						createdAt: date,
					});
					entryCount++;
				}
			}
		}
	}

	console.log(`  Created ${entryCount} enterprise standup entries`);
	return { orgId, userIds, people };
}

async function seed() {
	console.log("Seeding database...");
	console.log("Resetting database tables...");
	await resetDatabase();
	console.log("Database reset complete.");

	const hashedPassword = await hashPassword(PASSWORD);

	const demo = await seedDemoOrg(hashedPassword);
	const enterprise = await seedEnterpriseOrg(hashedPassword);

	console.log("\nDone! All users have password: password123");
	console.log("\nDemo org sign-ins:");
	for (const person of DEMO_PEOPLE) {
		console.log(`  ${person.email}`);
	}

	console.log("\nEnterprise org sample sign-ins:");
	for (const person of enterprise.people.slice(0, 10)) {
		console.log(`  ${person.email}`);
	}

	console.log(
		`\nCreated ${demo.userIds.length + enterprise.userIds.length} total users`,
	);

	await pool.end();
	process.exit(0);
}

seed().catch(async (err) => {
	console.error("Seed failed:", err);
	await pool.end();
	process.exit(1);
});
