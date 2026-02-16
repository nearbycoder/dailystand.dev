import { and, count, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { member, subscription, team, teamMember } from "@/db/schema";

export type PlanName = "free" | "pro" | "business";

export type PlanLimits = {
	teams: number;
	members: number;
	historyDays: number;
};

const PLAN_LIMITS: Record<PlanName, PlanLimits> = {
	free: {
		teams: 1,
		members: 5,
		historyDays: 7,
	},
	pro: {
		teams: -1,
		members: 15,
		historyDays: 90,
	},
	business: {
		teams: -1,
		members: -1,
		historyDays: -1,
	},
};

const ACTIVE_SUBSCRIPTION_STATUSES = new Set([
	"active",
	"trialing",
	"past_due",
	"unpaid",
]);

type SubscriptionRow = typeof subscription.$inferSelect;

type EffectiveSubscription = {
	subscription: SubscriptionRow | null;
	scope: "organization" | "user" | "none";
	plan: PlanName;
	status: string;
	referenceId: string | null;
};

export function getPlanLimits(plan: string | null | undefined): PlanLimits {
	const normalizedPlan = normalizePlanName(plan);
	return PLAN_LIMITS[normalizedPlan];
}

export function normalizeLimit(limit: number): number {
	return limit < 0 ? Number.MAX_SAFE_INTEGER : limit;
}

export function normalizePlanName(plan: string | null | undefined): PlanName {
	if (plan === "business") return "business";
	if (plan === "pro") return "pro";
	return "free";
}

function pickBestSubscription(rows: SubscriptionRow[]): SubscriptionRow | null {
	if (rows.length === 0) return null;
	const sorted = [...rows].sort(
		(a, b) => (b.periodEnd?.getTime() ?? 0) - (a.periodEnd?.getTime() ?? 0),
	);
	return (
		sorted.find((row) => ACTIVE_SUBSCRIPTION_STATUSES.has(row.status ?? "")) ??
		sorted[0] ??
		null
	);
}

export async function resolveEffectiveSubscription({
	organizationId,
	userId,
	userIds,
}: {
	organizationId: string;
	userId?: string | null;
	userIds?: string[];
}): Promise<EffectiveSubscription> {
	const resolvedUserIds = [
		...(userId ? [userId] : []),
		...(userIds ?? []),
	].filter((value, index, allValues) => allValues.indexOf(value) === index);

	const [orgSubs, userSubs] = await Promise.all([
		db.query.subscription.findMany({
			where: eq(subscription.referenceId, organizationId),
			orderBy: [desc(subscription.periodEnd)],
		}),
		resolvedUserIds.length > 0
			? db.query.subscription.findMany({
					where: inArray(subscription.referenceId, resolvedUserIds),
					orderBy: [desc(subscription.periodEnd)],
				})
			: Promise.resolve([]),
	]);

	const orgSub = pickBestSubscription(orgSubs);
	const userSub = pickBestSubscription(userSubs);
	const selectedSub = orgSub ?? userSub;

	if (!selectedSub) {
		return {
			subscription: null,
			scope: "none",
			plan: "free",
			status: "active",
			referenceId: null,
		};
	}

	return {
		subscription: selectedSub,
		scope: orgSub ? "organization" : "user",
		plan: normalizePlanName(selectedSub.plan),
		status: selectedSub.status ?? "active",
		referenceId: selectedSub.referenceId,
	};
}

export async function resolveOrganizationPlanLimits({
	organizationId,
	userId,
	userIds,
}: {
	organizationId: string;
	userId?: string | null;
	userIds?: string[];
}) {
	const _unusedUserId = userId;
	const _unusedUserIds = userIds;
	void _unusedUserId;
	void _unusedUserIds;

	const orgSubs = await db.query.subscription.findMany({
		where: eq(subscription.referenceId, organizationId),
		orderBy: [desc(subscription.periodEnd)],
	});
	const orgSub = pickBestSubscription(orgSubs);

	if (!orgSub) {
		return {
			subscription: null,
			scope: "none" as const,
			plan: "free" as const,
			status: "active",
			referenceId: null,
			limits: getPlanLimits("free"),
		};
	}

	return {
		subscription: orgSub,
		scope: "organization" as const,
		plan: normalizePlanName(orgSub.plan),
		status: orgSub.status ?? "active",
		referenceId: orgSub.referenceId,
		limits: getPlanLimits(orgSub.plan),
	};
}

export async function listOrganizationBillingUserIds(
	organizationId: string,
): Promise<string[]> {
	const orgMembers = await db.query.member.findMany({
		where: eq(member.organizationId, organizationId),
		columns: {
			userId: true,
			role: true,
		},
	});

	const privileged = orgMembers.filter((orgMember) =>
		orgMember.role
			.split(",")
			.map((part) => part.trim().toLowerCase())
			.some((role) => role === "owner" || role === "admin"),
	);

	const prioritized = privileged.length > 0 ? privileged : orgMembers;
	return prioritized.map((orgMember) => orgMember.userId);
}

export async function countOrganizationMembers(
	organizationId: string,
): Promise<number> {
	const rows = await db
		.select({ count: count() })
		.from(member)
		.where(eq(member.organizationId, organizationId));
	return rows[0]?.count ?? 0;
}

export async function countTeamMembers(
	teamId: string,
	organizationId?: string,
): Promise<number> {
	if (!organizationId) {
		const rows = await db
			.select({ count: count() })
			.from(teamMember)
			.where(eq(teamMember.teamId, teamId));
		return rows[0]?.count ?? 0;
	}

	const rows = await db
		.select({ count: count() })
		.from(teamMember)
		.innerJoin(team, eq(team.id, teamMember.teamId))
		.where(
			and(
				eq(teamMember.teamId, teamId),
				eq(team.organizationId, organizationId),
			),
		);
	return rows[0]?.count ?? 0;
}

export function getHistoryFloorDate(
	historyDays: number,
	now = new Date(),
): string | null {
	if (historyDays < 0) return null;
	const floor = new Date(now);
	floor.setHours(0, 0, 0, 0);
	floor.setDate(floor.getDate() - (historyDays - 1));
	return floor.toISOString().split("T")[0];
}

export function maxHistoryDays(
	historyDays: number,
	requestedDays: number,
): number {
	if (historyDays < 0) return requestedDays;
	return Math.max(1, Math.min(historyDays, requestedDays));
}
