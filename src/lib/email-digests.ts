import { render } from "@react-email/render";
import { and, desc, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import { StandupDigestEmail } from "@/emails/standup-digest-email";
import { db } from "@/db";
import {
	emailDigestPreference,
	member,
	standupEntry,
	teamMember,
} from "@/db/schema";
import { isResendConfigured, sendResendEmailMessage } from "@/lib/email";
import { resolveOrganizationPlanLimits } from "@/lib/plan-limits";

export type DigestCadence = "daily" | "weekly";

export type DigestWorkflowResult = {
	cadence: DigestCadence;
	attempted: number;
	sent: number;
	skipped: number;
	errors: Array<{
		userId: string;
		organizationId: string;
		message: string;
	}>;
};

function normalizeTimeZone(timeZone: string | null | undefined): string {
	const candidate = (timeZone ?? "").trim();
	if (!candidate) return "UTC";
	try {
		new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(new Date());
		return candidate;
	} catch {
		return "UTC";
	}
}

function toLocalDateKey(date: Date, timeZone: string): string {
	const formatter = new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});
	return formatter.format(date);
}

function dateKeyMinusDays(dateKey: string, days: number): string {
	const cursor = new Date(`${dateKey}T00:00:00.000Z`);
	cursor.setUTCDate(cursor.getUTCDate() - days);
	return cursor.toISOString().slice(0, 10);
}

function weekKeyFromDateKey(dateKey: string): string {
	const cursor = new Date(`${dateKey}T00:00:00.000Z`);
	const dayIndex = (cursor.getUTCDay() + 6) % 7;
	cursor.setUTCDate(cursor.getUTCDate() - dayIndex);
	return cursor.toISOString().slice(0, 10);
}

function formatDateLabel(dateKey: string): string {
	const date = new Date(`${dateKey}T00:00:00.000Z`);
	return date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

function summarizeCadenceWindow(
	cadence: DigestCadence,
	now: Date,
	timeZone: string,
): { startDate: string; endDate: string; periodLabel: string } {
	const todayKey = toLocalDateKey(now, timeZone);
	const endDate = dateKeyMinusDays(todayKey, 1);
	if (cadence === "daily") {
		return {
			startDate: endDate,
			endDate,
			periodLabel: formatDateLabel(endDate),
		};
	}
	const startDate = dateKeyMinusDays(endDate, 6);
	return {
		startDate,
		endDate,
		periodLabel: `${formatDateLabel(startDate)} - ${formatDateLabel(endDate)}`,
	};
}

function hasAlreadySentForCurrentWindow(
	cadence: DigestCadence,
	lastSentAt: Date | null,
	now: Date,
	timeZone: string,
): boolean {
	if (!lastSentAt) return false;
	const currentDateKey = toLocalDateKey(now, timeZone);
	const lastSentDateKey = toLocalDateKey(lastSentAt, timeZone);
	if (cadence === "daily") {
		return currentDateKey === lastSentDateKey;
	}
	return weekKeyFromDateKey(currentDateKey) === weekKeyFromDateKey(lastSentDateKey);
}

function buildPlainTextDigest(input: {
	organizationName: string;
	cadence: DigestCadence;
	periodLabel: string;
	totalEntries: number;
	counts: { completed: number; planned: number; blockers: number };
	activeContributors: number;
}) {
	const cadenceLabel = input.cadence === "daily" ? "Daily" : "Weekly";
	return [
		`${cadenceLabel} Standup Digest`,
		`${input.organizationName} • ${input.periodLabel}`,
		"",
		`Total entries: ${input.totalEntries}`,
		`Contributors: ${input.activeContributors}`,
		`Completed: ${input.counts.completed}`,
		`Planned: ${input.counts.planned}`,
		`Blockers: ${input.counts.blockers}`,
	].join("\n");
}

export async function runDigestWorkflow(
	cadence: DigestCadence,
	now = new Date(),
): Promise<DigestWorkflowResult> {
	const result: DigestWorkflowResult = {
		cadence,
		attempted: 0,
		sent: 0,
		skipped: 0,
		errors: [],
	};

	if (!isResendConfigured()) {
		console.info(
			`[DIGEST] Skipping ${cadence} workflow because Resend is not configured.`,
		);
		return result;
	}

	const preferences = await db.query.emailDigestPreference.findMany({
		where: eq(emailDigestPreference.enabled, true),
		with: {
			user: {
				columns: { id: true, name: true, email: true },
			},
			organization: {
				columns: { id: true, name: true },
			},
		},
	});

	for (const preference of preferences) {
		result.attempted += 1;
		const timeZone = normalizeTimeZone(preference.timezone);

		try {
			const membership = await db.query.member.findFirst({
				where: and(
					eq(member.userId, preference.userId),
					eq(member.organizationId, preference.organizationId),
				),
				columns: { id: true },
			});
			if (!membership) {
				result.skipped += 1;
				continue;
			}

			const plan = await resolveOrganizationPlanLimits({
				organizationId: preference.organizationId,
				userId: preference.userId,
			});
			const effectiveCadence: DigestCadence =
				plan.plan === "free" ? "weekly" : preference.cadence;
			if (effectiveCadence !== cadence) {
				result.skipped += 1;
				continue;
			}

			const lastSentAt =
				cadence === "daily"
					? preference.lastDailySentAt
					: preference.lastWeeklySentAt;
			if (hasAlreadySentForCurrentWindow(cadence, lastSentAt, now, timeZone)) {
				result.skipped += 1;
				continue;
			}

			const { startDate, endDate, periodLabel } = summarizeCadenceWindow(
				cadence,
				now,
				timeZone,
			);

			const memberships = await db.query.teamMember.findMany({
				where: eq(teamMember.userId, preference.userId),
				columns: { teamId: true },
				with: {
					team: {
						columns: { id: true, name: true, organizationId: true },
					},
				},
			});

			const teamIds = memberships
				.filter((row) => row.team.organizationId === preference.organizationId)
				.map((row) => row.teamId);

			const scopeCondition =
				teamIds.length > 0
					? or(inArray(standupEntry.teamId, teamIds), isNull(standupEntry.teamId))
					: isNull(standupEntry.teamId);

			const entries = await db.query.standupEntry.findMany({
				where: and(
					eq(standupEntry.organizationId, preference.organizationId),
					gte(standupEntry.date, startDate),
					lte(standupEntry.date, endDate),
					scopeCondition,
				),
				columns: {
					id: true,
					date: true,
					type: true,
					content: true,
					userId: true,
					teamId: true,
				},
				with: {
					user: {
						columns: { name: true },
					},
					team: {
						columns: { name: true },
					},
				},
				orderBy: [desc(standupEntry.date), desc(standupEntry.id)],
			});

			if (entries.length === 0) {
				result.skipped += 1;
				continue;
			}

			const counts = { completed: 0, planned: 0, blockers: 0 };
			const contributorSet = new Set<string>();
			const contributorMap = new Map<string, number>();
			const teamMap = new Map<
				string,
				{
					teamName: string;
					total: number;
					counts: { completed: number; planned: number; blockers: number };
				}
			>();

			for (const entry of entries) {
				if (entry.type === "completed") counts.completed += 1;
				else if (entry.type === "planned") counts.planned += 1;
				else counts.blockers += 1;

				contributorSet.add(entry.userId);
				const authorName = entry.user?.name ?? "Unknown";
				contributorMap.set(
					authorName,
					(contributorMap.get(authorName) ?? 0) + 1,
				);

				const teamName = entry.team?.name ?? "ORG_SCOPE";
				const teamStats = teamMap.get(teamName) ?? {
					teamName,
					total: 0,
					counts: { completed: 0, planned: 0, blockers: 0 },
				};
				teamStats.total += 1;
				if (entry.type === "completed") teamStats.counts.completed += 1;
				else if (entry.type === "planned") teamStats.counts.planned += 1;
				else teamStats.counts.blockers += 1;
				teamMap.set(teamName, teamStats);
			}

			const topContributors = Array.from(contributorMap.entries())
				.map(([name, total]) => ({ name, total }))
				.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
				.slice(0, 5);

			const teamStats = Array.from(teamMap.values()).sort(
				(a, b) => b.total - a.total || a.teamName.localeCompare(b.teamName),
			);

			const highlights = entries
				.filter((entry) => entry.type === "blocker")
				.slice(0, 5)
				.map((entry) => ({
					content: entry.content,
					authorName: entry.user?.name ?? "Unknown",
					teamName: entry.team?.name ?? "ORG_SCOPE",
					date: entry.date,
				}));

			const html = await render(
				StandupDigestEmail({
					recipientName: preference.user.name,
					organizationName: preference.organization.name,
					cadence,
					periodLabel,
					totalEntries: entries.length,
					activeContributors: contributorSet.size,
					counts,
					teamStats,
					topContributors,
					highlights,
				}),
			);

			const text = buildPlainTextDigest({
				organizationName: preference.organization.name,
				cadence,
				periodLabel,
				totalEntries: entries.length,
				counts,
				activeContributors: contributorSet.size,
			});

			const cadenceLabel = cadence === "daily" ? "Daily" : "Weekly";
			await sendResendEmailMessage({
				to: preference.user.email,
				subject: `[DailyStand] ${cadenceLabel} digest • ${preference.organization.name}`,
				html,
				text,
			});

			await db
				.update(emailDigestPreference)
				.set(
					cadence === "daily"
						? { lastDailySentAt: now }
						: { lastWeeklySentAt: now },
				)
				.where(eq(emailDigestPreference.id, preference.id));

			result.sent += 1;
		} catch (error) {
			result.errors.push({
				userId: preference.userId,
				organizationId: preference.organizationId,
				message: error instanceof Error ? error.message : "Unknown digest error",
			});
		}
	}

	return result;
}
