import { eq } from "drizzle-orm";
import { db } from "@/db";
import { member, organization } from "@/db/schema";
import { resolveOrganizationPlanLimits } from "@/lib/plan-limits";
import { orgProcedure } from "../init";

export const orgRouter = {
	getDetails: orgProcedure.query(async ({ ctx }) => {
		const org = await db.query.organization.findFirst({
			where: eq(organization.id, ctx.organizationId),
		});
		return org ?? null;
	}),

	getSubscription: orgProcedure.query(async ({ ctx }) => {
		const resolved = await resolveOrganizationPlanLimits({
			organizationId: ctx.organizationId,
			userId: ctx.session.user.id,
		});

		if (!resolved.subscription) {
			return {
				plan: resolved.plan,
				status: resolved.status,
				limits: resolved.limits,
				scope: resolved.scope,
				referenceId: resolved.referenceId,
				cancelAt: null as Date | null,
				periodEnd: null as Date | null,
				cancelAtPeriodEnd: false,
			};
		}

		return {
			plan: resolved.plan,
			status: resolved.status,
			limits: resolved.limits,
			periodEnd: resolved.subscription.periodEnd,
			cancelAtPeriodEnd: resolved.subscription.cancelAtPeriodEnd ?? false,
			cancelAt: resolved.subscription.cancelAt,
			scope: resolved.scope,
			referenceId: resolved.referenceId,
		};
	}),

	listMembers: orgProcedure.query(async ({ ctx }) => {
		const members = await db.query.member.findMany({
			where: eq(member.organizationId, ctx.organizationId),
			with: {
				user: {
					columns: { id: true, name: true, email: true, image: true },
				},
			},
		});
		return members.map((m) => ({
			memberId: m.id,
			userId: m.user.id,
			id: m.user.id,
			role: m.role,
			name: m.user.name,
			email: m.user.email,
			image: m.user.image,
		}));
	}),
};
