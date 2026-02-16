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
import { sendInviteEmail, sendPasswordResetEmail } from "@/lib/email";
import {
	countOrganizationMembers,
	countTeamMembers,
	listOrganizationBillingUserIds,
	normalizeLimit,
	resolveOrganizationPlanLimits,
} from "@/lib/plan-limits";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const resetPasswordTokenExpiresInSeconds = (() => {
	const value = Number(process.env.RESET_PASSWORD_TOKEN_EXPIRES_IN ?? "3600");
	if (!Number.isFinite(value) || value <= 0) return 3600;
	return Math.floor(value);
})();

function parseBooleanEnv(value: string | undefined): boolean | null {
	if (!value) return null;
	const normalized = value.trim().toLowerCase();
	if (["1", "true", "yes", "on"].includes(normalized)) return true;
	if (["0", "false", "no", "off"].includes(normalized)) return false;
	return null;
}

function parsePositiveIntegerEnv(
	value: string | undefined,
	fallback: number,
): number {
	if (!value) return fallback;
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
	return Math.floor(parsed);
}

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

const betterAuthRateLimitEnabled =
	parseBooleanEnv(process.env.BETTER_AUTH_RATE_LIMIT_ENABLED) ?? true;
const betterAuthRateLimitWindowSeconds = parsePositiveIntegerEnv(
	process.env.BETTER_AUTH_RATE_LIMIT_WINDOW,
	60,
);
const betterAuthRateLimitMax = parsePositiveIntegerEnv(
	process.env.BETTER_AUTH_RATE_LIMIT_MAX,
	100,
);

const apiKeyRateLimitEnabled =
	parseBooleanEnv(process.env.API_KEY_RATE_LIMIT_ENABLED) ?? true;
const apiKeyRateLimitWindowMs = parsePositiveIntegerEnv(
	process.env.API_KEY_RATE_LIMIT_WINDOW_MS,
	60_000,
);
const apiKeyRateLimitMaxRequests = parsePositiveIntegerEnv(
	process.env.API_KEY_RATE_LIMIT_MAX_REQUESTS,
	120,
);

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

function canManageOrganizationRole(role: string) {
	return role
		.split(",")
		.map((part) => part.trim().toLowerCase())
		.some((part) => part === "owner" || part === "admin");
}

async function assertCanInviteOrganizationMembers(
	organizationId: string,
	inviterUserId: string,
) {
	const inviterMembership = await db.query.member.findFirst({
		where: and(
			eq(member.organizationId, organizationId),
			eq(member.userId, inviterUserId),
		),
		columns: { role: true },
	});
	if (
		!inviterMembership ||
		!canManageOrganizationRole(inviterMembership.role)
	) {
		throw new APIError("FORBIDDEN", {
			message: "Only owners/admins can invite members.",
		});
	}
}

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "pg",
	}),
	trustedOrigins,
	rateLimit: {
		enabled: betterAuthRateLimitEnabled,
		window: betterAuthRateLimitWindowSeconds,
		max: betterAuthRateLimitMax,
	},
	emailAndPassword: {
		enabled: true,
		resetPasswordTokenExpiresIn: resetPasswordTokenExpiresInSeconds,
		sendResetPassword: async ({ user, url }) => {
			try {
				await sendPasswordResetEmail({
					to: user.email,
					userName: user.name,
					resetUrl: url,
				});
			} catch (error) {
				console.error("[AUTH] Failed to send reset password email", error);
				console.info(
					`[AUTH] Password reset requested for ${user.email}. Email provider unavailable.`,
				);
			}
		},
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
			sendInvitationEmail: async (data, request) => {
				try {
					await sendInviteEmail({
						invitationId: data.id,
						to: data.email,
						organizationName: data.organization.name,
						inviterName: data.inviter.user.name ?? data.inviter.user.email,
						role: data.role,
						request,
					});
				} catch (error) {
					console.error("[AUTH] Failed to send invitation email", error);
					console.info(
						`[AUTH] Invite created for ${data.email}. Invitation ID: ${data.id}`,
					);
				}
			},
			organizationHooks: {
				beforeCreateInvitation: async ({ invitation, inviter }) => {
					await assertCanInviteOrganizationMembers(
						invitation.organizationId,
						inviter.id,
					);
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
				enabled: apiKeyRateLimitEnabled,
				timeWindow: apiKeyRateLimitWindowMs,
				maxRequests: apiKeyRateLimitMaxRequests,
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
