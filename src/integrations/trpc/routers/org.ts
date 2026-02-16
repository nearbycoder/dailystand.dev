import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { emailDigestPreference, member, organization } from "@/db/schema";
import { resolveOrganizationPlanLimits } from "@/lib/plan-limits";
import { orgProcedure, protectedProcedure } from "../init";

function canManageOrganizationRole(role: string) {
	return role
		.split(",")
		.map((part) => part.trim().toLowerCase())
		.some((part) => part === "owner" || part === "admin");
}

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
				cancelAt: null,
				periodEnd: null,
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
			canManageOrganization: canManageOrganizationRole(m.role),
			name: m.user.name,
			email: m.user.email,
			image: m.user.image,
		}));
	}),

	listMyMemberships: protectedProcedure.query(async ({ ctx }) => {
		const memberships = await db.query.member.findMany({
			where: eq(member.userId, ctx.session.user.id),
			with: {
				organization: {
					columns: { id: true, name: true, slug: true },
				},
			},
		});

		return memberships.map((membership) => ({
			memberId: membership.id,
			organizationId: membership.organizationId,
			role: membership.role,
			canManageOrganization: canManageOrganizationRole(membership.role),
			organization: membership.organization,
		}));
	}),

	getMyMembership: orgProcedure.query(async ({ ctx }) => {
		const currentMembership = await db.query.member.findFirst({
			where: and(
				eq(member.organizationId, ctx.organizationId),
				eq(member.userId, ctx.session.user.id),
			),
			columns: { id: true, role: true },
		});

		if (!currentMembership) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: "You are not a member of the active organization.",
			});
		}

		return {
			memberId: currentMembership.id,
			role: currentMembership.role,
			canManageOrganization: canManageOrganizationRole(currentMembership.role),
		};
	}),

	getEmailDigestPreference: orgProcedure.query(async ({ ctx }) => {
		const [preference, subscription] = await Promise.all([
			db.query.emailDigestPreference.findFirst({
				where: and(
					eq(emailDigestPreference.organizationId, ctx.organizationId),
					eq(emailDigestPreference.userId, ctx.session.user.id),
				),
			}),
			resolveOrganizationPlanLimits({
				organizationId: ctx.organizationId,
				userId: ctx.session.user.id,
			}),
		]);

		const plan = subscription.plan;
		const isDailyAllowed = plan !== "free";
		const requestedCadence = preference?.cadence ?? "weekly";
		const effectiveCadence = isDailyAllowed ? requestedCadence : "weekly";

		return {
			enabled: preference?.enabled ?? false,
			cadence: effectiveCadence,
			timezone: preference?.timezone ?? "UTC",
			isDailyAllowed,
			plan,
		};
	}),

	updateEmailDigestPreference: orgProcedure
		.input(
			z.object({
				enabled: z.boolean(),
				cadence: z.enum(["weekly", "daily"]),
				timezone: z.string().min(1).max(100),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const subscription = await resolveOrganizationPlanLimits({
				organizationId: ctx.organizationId,
				userId: ctx.session.user.id,
			});

			if (subscription.plan === "free" && input.cadence === "daily") {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Daily email notifications require a paid plan.",
				});
			}

			const timezone = input.timezone.trim() || "UTC";
			const now = new Date();
			const existing = await db.query.emailDigestPreference.findFirst({
				where: and(
					eq(emailDigestPreference.organizationId, ctx.organizationId),
					eq(emailDigestPreference.userId, ctx.session.user.id),
				),
			});

			if (existing) {
				await db
					.update(emailDigestPreference)
					.set({
						enabled: input.enabled,
						cadence: input.cadence,
						timezone,
						updatedAt: now,
					})
					.where(eq(emailDigestPreference.id, existing.id));
			} else {
				await db.insert(emailDigestPreference).values({
					userId: ctx.session.user.id,
					organizationId: ctx.organizationId,
					enabled: input.enabled,
					cadence: input.cadence,
					timezone,
					createdAt: now,
					updatedAt: now,
				});
			}

			return {
				enabled: input.enabled,
				cadence: input.cadence,
				timezone,
				plan: subscription.plan,
			};
		}),
};
