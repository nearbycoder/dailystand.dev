import { stripe } from "@better-auth/stripe";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { apiKey, organization } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { APIError } from "better-call";
import { and, eq } from "drizzle-orm";
import Stripe from "stripe";
import { db } from "@/db";
import { member } from "@/db/schema";
import {
	countOrganizationMembers,
	countTeamMembers,
	listOrganizationBillingUserIds,
	normalizeLimit,
	resolveOrganizationPlanLimits,
} from "@/lib/plan-limits";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

function parseCsvEnv(value?: string): string[] {
	return (value ?? "")
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
}

const trustedOrigins = Array.from(
	new Set([
		...parseCsvEnv(process.env.BETTER_AUTH_URL),
		...parseCsvEnv(process.env.BETTER_AUTH_TRUSTED_ORIGINS),
	]),
);

const defaultApiKeyPermissions = [
	"profile:read",
	"teams:read",
	"standups:read",
	"standups:write",
	"analytics:read",
] as const;

const stripePlugin =
	stripeSecretKey && stripeWebhookSecret
		? stripe({
				stripeClient: new Stripe(stripeSecretKey),
				stripeWebhookSecret,
				subscription: {
					enabled: true,
					authorizeReference: async ({ user, referenceId }) => {
						const membership = await db.query.member.findFirst({
							where: and(
								eq(member.organizationId, referenceId),
								eq(member.userId, user.id),
							),
							columns: {
								role: true,
							},
						});
						if (!membership) return false;
						const normalizedRoles = membership.role
							.split(",")
							.map((role) => role.trim().toLowerCase());
						return (
							normalizedRoles.includes("owner") ||
							normalizedRoles.includes("admin")
						);
					},
					plans: [
						{
							name: "free",
							limits: {
								teams: 1,
								members: 5,
								historyDays: 7,
							},
						},
						{
							name: "pro",
							priceId: process.env.STRIPE_PRO_PRICE_ID || "price_pro",
							limits: {
								teams: -1,
								members: 15,
								historyDays: 90,
							},
						},
						{
							name: "business",
							priceId: process.env.STRIPE_BUSINESS_PRICE_ID || "price_business",
							limits: {
								teams: -1,
								members: -1,
								historyDays: -1,
							},
						},
					],
				},
			})
		: null;

async function resolveOrgPlanLimitsForAuth(
	organizationId: string,
	userId?: string,
) {
	const fallbackUserIds = userId
		? undefined
		: await listOrganizationBillingUserIds(organizationId);

	return resolveOrganizationPlanLimits({
		organizationId,
		userId,
		userIds: fallbackUserIds,
	});
}

async function assertOrganizationMemberLimit(
	organizationId: string,
	userIdForScope?: string,
) {
	const resolved = await resolveOrgPlanLimitsForAuth(
		organizationId,
		userIdForScope,
	);
	if (resolved.limits.members < 0) return;

	const existingMemberCount = await countOrganizationMembers(organizationId);
	if (existingMemberCount >= resolved.limits.members) {
		throw new APIError("FORBIDDEN", {
			message: `Plan member limit reached (${resolved.limits.members}).`,
		});
	}
}

async function assertTeamMemberLimit(
	teamId: string,
	organizationId: string,
	userIdForScope?: string,
) {
	const resolved = await resolveOrgPlanLimitsForAuth(
		organizationId,
		userIdForScope,
	);
	if (resolved.limits.members < 0) return;

	const existingTeamMemberCount = await countTeamMembers(
		teamId,
		organizationId,
	);
	if (existingTeamMemberCount >= resolved.limits.members) {
		throw new APIError("FORBIDDEN", {
			message: `Team member limit reached (${resolved.limits.members}).`,
		});
	}
}

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "pg",
	}),
	trustedOrigins,
	emailAndPassword: {
		enabled: true,
	},
	plugins: [
		tanstackStartCookies(),
		organization({
			membershipLimit: Number.MAX_SAFE_INTEGER,
			teams: {
				enabled: true,
				maximumTeams: async ({ organizationId, session }) => {
					const resolved = await resolveOrgPlanLimitsForAuth(
						organizationId,
						session?.user.id,
					);
					return normalizeLimit(resolved.limits.teams);
				},
				maximumMembersPerTeam: async ({ organizationId, session }) => {
					const resolved = await resolveOrgPlanLimitsForAuth(
						organizationId,
						session.user.id,
					);
					if (resolved.limits.members < 0) return Number.MAX_SAFE_INTEGER;
					return resolved.limits.members;
				},
			},
			organizationHooks: {
				beforeCreateInvitation: async ({ invitation, inviter }) => {
					await assertOrganizationMemberLimit(
						invitation.organizationId,
						inviter.id,
					);
				},
				beforeAcceptInvitation: async ({ invitation }) => {
					await assertOrganizationMemberLimit(invitation.organizationId);
				},
				beforeAddMember: async ({ member: incomingMember }) => {
					await assertOrganizationMemberLimit(incomingMember.organizationId);
				},
				beforeAddTeamMember: async ({ teamMember, organization }) => {
					await assertTeamMemberLimit(teamMember.teamId, organization.id);
				},
			},
		}),
		apiKey({
			defaultPrefix: "ds_",
			requireName: true,
			enableMetadata: true,
			keyExpiration: {
				defaultExpiresIn: 90,
				minExpiresIn: 1,
				maxExpiresIn: 365,
			},
			rateLimit: {
				enabled: true,
				timeWindow: 60_000,
				maxRequests: 600,
			},
			permissions: {
				defaultPermissions: {
					dailystand: [...defaultApiKeyPermissions],
				},
			},
		}),
		...(stripePlugin ? [stripePlugin] : []),
	],
});
