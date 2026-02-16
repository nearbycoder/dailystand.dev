import { orgProcedure } from "../init"
import { db } from "@/db"
import { organization, member, subscription } from "@/db/schema"
import { eq } from "drizzle-orm"

export const orgRouter = {
	getDetails: orgProcedure.query(async ({ ctx }) => {
		const org = await db.query.organization.findFirst({
			where: eq(organization.id, ctx.organizationId),
		})
		return org ?? null
	}),

	getSubscription: orgProcedure.query(async ({ ctx }) => {
		const sub = await db.query.subscription.findFirst({
			where: eq(subscription.referenceId, ctx.organizationId),
		})
		// No subscription record = free tier
		if (!sub) {
			return {
				plan: "free" as const,
				status: "active" as const,
				limits: { teams: 1, members: 5, historyDays: 7 },
			}
		}
		const limits =
			sub.plan === "business"
				? { teams: -1, members: -1, historyDays: 365 }
				: sub.plan === "pro"
					? { teams: -1, members: 25, historyDays: 90 }
					: { teams: 1, members: 5, historyDays: 7 }

		return {
			plan: sub.plan,
			status: sub.status,
			limits,
			periodEnd: sub.periodEnd,
			cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
		}
	}),

	listMembers: orgProcedure.query(async ({ ctx }) => {
		const members = await db.query.member.findMany({
			where: eq(member.organizationId, ctx.organizationId),
			with: {
				user: {
					columns: { id: true, name: true, email: true, image: true },
				},
			},
		})
		return members.map((m) => ({
			id: m.id,
			role: m.role,
			...m.user,
		}))
	}),
}
