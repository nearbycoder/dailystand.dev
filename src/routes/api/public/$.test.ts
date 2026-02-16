import { beforeAll, describe, expect, it, vi } from "vitest";

const { capturedConfig, authVerifyApiKeyMock, dbMock } = vi.hoisted(() => ({
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
	getHistoryFloorDate: vi.fn(),
	maxHistoryDays: vi.fn((max: number, requested: number) =>
		Math.min(max, requested),
	),
	resolveOrganizationPlanLimits: vi.fn(),
}));

function handlers() {
	const routeConfig = capturedConfig.value;
	if (!routeConfig) throw new Error("Route config was not captured");
	return routeConfig.server.handlers;
}

describe("public api route contracts", () => {
	beforeAll(async () => {
		process.env.API_ALLOWED_ORIGINS = "https://allowed.example";
		process.env.BETTER_AUTH_URL = "https://app.example";
		await import("./$");
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
});
