import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const {
	capturedConfig,
	authVerifyApiKeyMock,
	dbMock,
	getHistoryFloorDateMock,
	maxHistoryDaysMock,
	resolveOrganizationPlanLimitsMock,
} = vi.hoisted(() => ({
	capturedConfig: {
		value: null as null | {
			server: {
				handlers: {
					GET: (ctx: { request: Request }) => Promise<Response>;
					POST: (ctx: { request: Request }) => Promise<Response>;
					OPTIONS: (ctx: { request: Request }) => Response;
				};
			};
		},
	},
	authVerifyApiKeyMock: vi.fn(),
	dbMock: {
		query: {
			user: { findFirst: vi.fn() },
			member: { findMany: vi.fn(), findFirst: vi.fn() },
			team: { findMany: vi.fn(), findFirst: vi.fn() },
			teamMember: { findMany: vi.fn(), findFirst: vi.fn() },
			standupEntry: { findMany: vi.fn(), findFirst: vi.fn() },
		},
		insert: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
	},
	getHistoryFloorDateMock: vi.fn(),
	maxHistoryDaysMock: vi.fn((max: number, requested: number) =>
		Math.min(max, requested),
	),
	resolveOrganizationPlanLimitsMock: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (config: unknown) => {
		capturedConfig.value = config as typeof capturedConfig.value;
		return {};
	},
}));

vi.mock("@/lib/auth", () => ({
	auth: {
		api: {
			verifyApiKey: authVerifyApiKeyMock,
		},
	},
}));

vi.mock("@/db", () => ({
	db: dbMock,
}));

vi.mock("@/lib/plan-limits", () => ({
	getHistoryFloorDate: getHistoryFloorDateMock,
	maxHistoryDays: maxHistoryDaysMock,
	resolveOrganizationPlanLimits: resolveOrganizationPlanLimitsMock,
}));

function handlers() {
	const routeConfig = capturedConfig.value;
	if (!routeConfig) throw new Error("Route config was not captured");
	return routeConfig.server.handlers;
}

const defaultActor = {
	id: "user_1",
	name: "Alex",
	email: "alex@dailystand.dev",
	image: null,
};

function validMembership(
	organizationId: string,
	name: string,
	slug: string,
	role: "owner" | "admin" | "member" = "member",
) {
	return {
		organizationId,
		role,
		organization: { id: organizationId, name, slug },
	};
}

function mockAuthenticatedActor(apiKey = "test-key") {
	authVerifyApiKeyMock.mockResolvedValue({
		valid: true,
		key: {
			id: "key_1",
			userId: defaultActor.id,
			name: "Primary key",
			prefix: "dsk_",
			start: "dsk_",
			expiresAt: null,
			enabled: true,
		},
	});
	dbMock.query.user.findFirst.mockResolvedValue(defaultActor);
	return apiKey;
}

describe("public api route contracts", () => {
	beforeAll(async () => {
		process.env.API_ALLOWED_ORIGINS = "https://allowed.example";
		process.env.BETTER_AUTH_URL = "https://app.example";
		await import("./$");
	});

	beforeEach(() => {
		vi.clearAllMocks();
		getHistoryFloorDateMock.mockReturnValue(undefined);
		resolveOrganizationPlanLimitsMock.mockResolvedValue({
			limits: {
				historyDays: 90,
			},
		});
		const deleteWhere = vi.fn().mockResolvedValue(undefined);
		dbMock.delete.mockReturnValue({ where: deleteWhere });
		const insertValues = vi.fn().mockResolvedValue(undefined);
		dbMock.insert.mockReturnValue({ values: insertValues });
	});

	it("rejects disallowed CORS origins", async () => {
		const response = await handlers().GET({
			request: new Request("https://dailystand.dev/api/public/v1", {
				headers: { origin: "https://blocked.example" },
			}),
		});
		expect(response.status).toBe(403);
	});

	it("returns docs payload for API root with allowed origin", async () => {
		const response = await handlers().GET({
			request: new Request("https://dailystand.dev/api/public/v1", {
				headers: { origin: "https://allowed.example" },
			}),
		});

		expect(response.status).toBe(200);
		expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
			"https://allowed.example",
		);
			await expect(response.json()).resolves.toMatchObject({
				success: true,
				data: {
					version: "v1",
					authentication: {
						type: "apiKey",
					},
					endpoints: {
						me: "GET /api/public/v1/me",
						teams: expect.any(String),
						myTeams: expect.any(String),
						standupsDay: expect.any(String),
						standupsHistory: expect.any(String),
						standupsUpsert: expect.any(String),
						analytics: expect.any(String),
					},
				},
			});
		});

	it("returns 404 for unknown API versions", async () => {
		const response = await handlers().GET({
			request: new Request("https://dailystand.dev/api/public/v2/me", {
				headers: { origin: "https://allowed.example" },
			}),
		});

		expect(response.status).toBe(404);
		await expect(response.json()).resolves.toMatchObject({
			success: false,
			error: {
				code: "NOT_FOUND",
			},
		});
	});

	it("returns missing api key error on protected endpoints", async () => {
		const response = await handlers().GET({
			request: new Request("https://dailystand.dev/api/public/v1/me", {
				headers: { origin: "https://allowed.example" },
			}),
		});

		expect(response.status).toBe(401);
		await expect(response.json()).resolves.toMatchObject({
			success: false,
			error: {
				code: "MISSING_API_KEY",
			},
		});
		expect(authVerifyApiKeyMock).not.toHaveBeenCalled();
	});

	it("returns CORS headers for allowed preflight requests", () => {
		const response = handlers().OPTIONS({
			request: new Request("https://dailystand.dev/api/public/v1/me", {
				method: "OPTIONS",
				headers: { origin: "https://allowed.example" },
			}),
		});

		expect(response.status).toBe(204);
		expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
			"https://allowed.example",
		);
		expect(response.headers.get("Access-Control-Allow-Methods")).toContain(
			"OPTIONS",
		);
	});

	it("accepts bearer auth and returns profile memberships", async () => {
		mockAuthenticatedActor("bearer-key");
		dbMock.query.member.findMany.mockResolvedValue([
			validMembership("org_1", "Acme", "acme", "owner"),
		]);

		const response = await handlers().GET({
			request: new Request("https://dailystand.dev/api/public/v1/me", {
				headers: {
					origin: "https://allowed.example",
					authorization: "Bearer bearer-key",
				},
			}),
		});

		expect(response.status).toBe(200);
		expect(authVerifyApiKeyMock).toHaveBeenCalledWith({
			body: {
				key: "bearer-key",
				permissions: {
					dailystand: ["profile:read"],
				},
			},
		});
		await expect(response.json()).resolves.toMatchObject({
			success: true,
			data: {
				user: {
					id: defaultActor.id,
				},
				organizations: [
					{
						id: "org_1",
						role: "owner",
					},
				],
			},
		});
	});

	it("requires orgId for users with multi-org membership on org-scoped endpoints", async () => {
		mockAuthenticatedActor();
		dbMock.query.member.findMany.mockResolvedValue([
			validMembership("org_1", "Acme", "acme"),
			validMembership("org_2", "Beta", "beta"),
		]);

		const response = await handlers().GET({
			request: new Request("https://dailystand.dev/api/public/v1/teams", {
				headers: {
					origin: "https://allowed.example",
					"x-api-key": "test-key",
				},
			}),
		});

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({
			success: false,
			error: {
				code: "ORG_REQUIRED",
			},
		});
		expect(dbMock.query.team.findMany).not.toHaveBeenCalled();
	});

	it("returns teams scoped to the requested orgId", async () => {
		mockAuthenticatedActor();
		dbMock.query.member.findMany.mockResolvedValue([
			validMembership("org_1", "Acme", "acme"),
			validMembership("org_2", "Beta", "beta"),
		]);
		dbMock.query.team.findMany.mockResolvedValue([
			{
				id: "team_1",
				name: "Engineering",
				createdAt: new Date("2026-01-01"),
				teamMembers: [{ userId: defaultActor.id }, { userId: "user_2" }],
			},
			{
				id: "team_2",
				name: "Design",
				createdAt: new Date("2026-01-02"),
				teamMembers: [{ userId: "user_3" }],
			},
		]);

		const response = await handlers().GET({
			request: new Request(
				"https://dailystand.dev/api/public/v1/teams?orgId=org_2",
				{
					headers: {
						origin: "https://allowed.example",
						"x-api-key": "test-key",
					},
				},
			),
		});

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({
			success: true,
			data: {
				organization: {
					id: "org_2",
				},
				teams: [
					{
						id: "team_1",
						isMember: true,
						memberCount: 2,
					},
					{
						id: "team_2",
						isMember: false,
						memberCount: 1,
					},
				],
			},
		});
	});

	it("rejects invalid analytics rangeDays values", async () => {
		mockAuthenticatedActor();
		dbMock.query.member.findMany.mockResolvedValue([
			validMembership("org_1", "Acme", "acme"),
		]);

		const response = await handlers().GET({
			request: new Request(
				"https://dailystand.dev/api/public/v1/analytics?rangeDays=15",
				{
					headers: {
						origin: "https://allowed.example",
						"x-api-key": "test-key",
					},
				},
			),
		});

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({
			success: false,
			error: {
				code: "INVALID_RANGE",
			},
		});
	});

	it("blocks team-scoped standup reads for users not in the team", async () => {
		mockAuthenticatedActor();
		dbMock.query.member.findMany.mockResolvedValue([
			validMembership("org_1", "Acme", "acme"),
		]);
		dbMock.query.team.findFirst.mockResolvedValue({
			id: "team_1",
			name: "Engineering",
			organizationId: "org_1",
		});
		dbMock.query.teamMember.findFirst.mockResolvedValue(null);

		const response = await handlers().GET({
			request: new Request(
				"https://dailystand.dev/api/public/v1/standups/day?date=2026-02-10&teamId=team_1",
				{
					headers: {
						origin: "https://allowed.example",
						"x-api-key": "test-key",
					},
				},
			),
		});

		expect(response.status).toBe(403);
		await expect(response.json()).resolves.toMatchObject({
			success: false,
			error: {
				code: "TEAM_READ_FORBIDDEN",
			},
		});
	});
});
