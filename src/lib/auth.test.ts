import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

type BetterAuthConfigLike = {
	rateLimit?: {
		enabled: boolean;
		window: number;
		max: number;
	};
};

type ApiKeyPluginOptionsLike = {
	rateLimit?: {
		enabled: boolean;
		timeWindow: number;
		maxRequests: number;
	};
};

const {
	betterAuthMock,
	apiKeyMock,
	organizationMock,
	tanstackStartCookiesMock,
	drizzleAdapterMock,
	stripePluginMock,
} = vi.hoisted(() => ({
	betterAuthMock: vi.fn((config: BetterAuthConfigLike) => ({
		_tag: "better-auth",
		config,
	})),
	apiKeyMock: vi.fn((config: ApiKeyPluginOptionsLike) => ({
		_tag: "api-key-plugin",
		config,
	})),
	organizationMock: vi.fn((config: unknown) => ({
		_tag: "organization-plugin",
		config,
	})),
	tanstackStartCookiesMock: vi.fn(() => ({ _tag: "cookies-plugin" })),
	drizzleAdapterMock: vi.fn(() => ({ _tag: "drizzle-adapter" })),
	stripePluginMock: vi.fn(() => ({ _tag: "stripe-plugin" })),
}));

vi.mock("better-auth", () => ({
	betterAuth: betterAuthMock,
}));

vi.mock("better-auth/adapters/drizzle", () => ({
	drizzleAdapter: drizzleAdapterMock,
}));

vi.mock("better-auth/plugins", () => ({
	apiKey: apiKeyMock,
	organization: organizationMock,
}));

vi.mock("better-auth/tanstack-start", () => ({
	tanstackStartCookies: tanstackStartCookiesMock,
}));

vi.mock("@better-auth/stripe", () => ({
	stripe: stripePluginMock,
}));

vi.mock("@/db", () => ({
	db: {},
}));

vi.mock("@/db/schema", () => ({
	member: {},
}));

vi.mock("@/lib/email", () => ({
	sendInviteEmail: vi.fn(),
	sendPasswordResetEmail: vi.fn(),
}));

vi.mock("@/lib/plan-limits", () => ({
	countOrganizationMembers: vi.fn(),
	countTeamMembers: vi.fn(),
	listOrganizationBillingUserIds: vi.fn(),
	normalizeLimit: vi.fn((value: number) => value),
	resolveOrganizationPlanLimits: vi.fn(),
}));

const originalEnv = { ...process.env };

function restoreEnv() {
	for (const key of Object.keys(process.env)) {
		if (!(key in originalEnv)) {
			delete process.env[key];
		}
	}
	for (const [key, value] of Object.entries(originalEnv)) {
		process.env[key] = value;
	}
}

describe("auth rate limit configuration", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
		restoreEnv();
	});

	afterAll(() => {
		restoreEnv();
	});

	it("uses sane default rate limits when env vars are not set", async () => {
		delete process.env.BETTER_AUTH_RATE_LIMIT_ENABLED;
		delete process.env.BETTER_AUTH_RATE_LIMIT_WINDOW;
		delete process.env.BETTER_AUTH_RATE_LIMIT_MAX;
		delete process.env.API_KEY_RATE_LIMIT_ENABLED;
		delete process.env.API_KEY_RATE_LIMIT_WINDOW_MS;
		delete process.env.API_KEY_RATE_LIMIT_MAX_REQUESTS;

		await import("./auth");

		expect(betterAuthMock).toHaveBeenCalledTimes(1);
		const betterAuthConfig = betterAuthMock.mock.calls[0]?.[0] as
			| BetterAuthConfigLike
			| undefined;
		if (!betterAuthConfig) {
			throw new Error("Expected betterAuth to be called with config");
		}
		expect(betterAuthConfig.rateLimit).toEqual({
			enabled: true,
			window: 60,
			max: 100,
		});

		expect(apiKeyMock).toHaveBeenCalledTimes(1);
		const apiKeyConfig = apiKeyMock.mock.calls[0]?.[0] as
			| ApiKeyPluginOptionsLike
			| undefined;
		if (!apiKeyConfig) {
			throw new Error("Expected apiKey plugin to be configured");
		}
		expect(apiKeyConfig.rateLimit).toEqual({
			enabled: true,
			timeWindow: 60_000,
			maxRequests: 120,
		});
	});

	it("respects environment overrides for both Better Auth and API key limits", async () => {
		process.env.BETTER_AUTH_RATE_LIMIT_ENABLED = "false";
		process.env.BETTER_AUTH_RATE_LIMIT_WINDOW = "180";
		process.env.BETTER_AUTH_RATE_LIMIT_MAX = "250";
		process.env.API_KEY_RATE_LIMIT_ENABLED = "false";
		process.env.API_KEY_RATE_LIMIT_WINDOW_MS = "45000";
		process.env.API_KEY_RATE_LIMIT_MAX_REQUESTS = "40";

		await import("./auth");

		const betterAuthConfig = betterAuthMock.mock.calls[0]?.[0] as
			| BetterAuthConfigLike
			| undefined;
		if (!betterAuthConfig) {
			throw new Error("Expected betterAuth to be called with config");
		}
		expect(betterAuthConfig.rateLimit).toEqual({
			enabled: false,
			window: 180,
			max: 250,
		});

		const apiKeyConfig = apiKeyMock.mock.calls[0]?.[0] as
			| ApiKeyPluginOptionsLike
			| undefined;
		if (!apiKeyConfig) {
			throw new Error("Expected apiKey plugin to be configured");
		}
		expect(apiKeyConfig.rateLimit).toEqual({
			enabled: false,
			timeWindow: 45_000,
			maxRequests: 40,
		});
	});

	it("falls back to defaults for invalid numeric env values", async () => {
		process.env.BETTER_AUTH_RATE_LIMIT_WINDOW = "-1";
		process.env.BETTER_AUTH_RATE_LIMIT_MAX = "not-a-number";
		process.env.API_KEY_RATE_LIMIT_WINDOW_MS = "0";
		process.env.API_KEY_RATE_LIMIT_MAX_REQUESTS = "NaN";

		await import("./auth");

		const betterAuthConfig = betterAuthMock.mock.calls[0]?.[0] as
			| BetterAuthConfigLike
			| undefined;
		if (!betterAuthConfig) {
			throw new Error("Expected betterAuth to be called with config");
		}
		expect(betterAuthConfig.rateLimit).toEqual({
			enabled: true,
			window: 60,
			max: 100,
		});

		const apiKeyConfig = apiKeyMock.mock.calls[0]?.[0] as
			| ApiKeyPluginOptionsLike
			| undefined;
		if (!apiKeyConfig) {
			throw new Error("Expected apiKey plugin to be configured");
		}
		expect(apiKeyConfig.rateLimit).toEqual({
			enabled: true,
			timeWindow: 60_000,
			maxRequests: 120,
		});
	});
});
