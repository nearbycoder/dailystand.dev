import { beforeAll, describe, expect, it, vi } from "vitest";

const { capturedConfig, authVerifyApiKeyMock, dbMock } = vi.hoisted(() => ({
	capturedConfig: {
		value: null as null | {
			server: {
				handlers: {
					GET: (ctx: { request: Request }) => Response;
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
	countOrganizationMembers: vi.fn(),
	countTeamMembers: vi.fn(),
	getHistoryFloorDate: vi.fn(),
	resolveOrganizationPlanLimits: vi.fn(),
}));

function handlers() {
	const routeConfig = capturedConfig.value;
	if (!routeConfig) throw new Error("Route config was not captured");
	return routeConfig.server.handlers;
}

describe("mcp api route contracts", () => {
	beforeAll(async () => {
		process.env.API_ALLOWED_ORIGINS = "https://allowed.example";
		process.env.BETTER_AUTH_URL = "https://app.example";
		await import("./mcp");
	});

	it("returns metadata from GET with allowed origin", async () => {
		const response = handlers().GET({
			request: new Request("https://dailystand.dev/api/mcp", {
				headers: { origin: "https://allowed.example" },
			}),
		});

		expect(response.status).toBe(200);
		expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
			"https://allowed.example",
		);
		await expect(response.json()).resolves.toMatchObject({
			name: "dailystand-mcp",
			transport: "JSON-RPC 2.0 over HTTP POST",
		});
	});

	it("rejects malformed JSON request bodies", async () => {
		const response = await handlers().POST({
			request: new Request("https://dailystand.dev/api/mcp", {
				method: "POST",
				headers: {
					origin: "https://allowed.example",
					"content-type": "application/json",
				},
				body: "not-json",
			}),
		});

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({
			jsonrpc: "2.0",
			error: {
				code: -32700,
			},
		});
	});

	it("rejects invalid JSON-RPC payloads", async () => {
		const response = await handlers().POST({
			request: new Request("https://dailystand.dev/api/mcp", {
				method: "POST",
				headers: {
					origin: "https://allowed.example",
					"content-type": "application/json",
				},
				body: JSON.stringify({ foo: "bar" }),
			}),
		});

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({
			jsonrpc: "2.0",
			error: {
				code: -32600,
			},
		});
	});

	it("returns rpc error envelope when tools/list is called without api key", async () => {
		const response = await handlers().POST({
			request: new Request("https://dailystand.dev/api/mcp", {
				method: "POST",
				headers: {
					origin: "https://allowed.example",
					"content-type": "application/json",
				},
				body: JSON.stringify({
					jsonrpc: "2.0",
					id: 1,
					method: "tools/list",
				}),
			}),
		});

		expect(response.status).toBe(500);
		await expect(response.json()).resolves.toMatchObject({
			jsonrpc: "2.0",
			id: 1,
			error: {
				code: -32000,
				message: "Missing API key. Use x-api-key or Authorization: Bearer.",
			},
		});
		expect(authVerifyApiKeyMock).not.toHaveBeenCalled();
	});

	it("blocks disallowed origins for preflight", async () => {
		const response = handlers().OPTIONS({
			request: new Request("https://dailystand.dev/api/mcp", {
				method: "OPTIONS",
				headers: { origin: "https://blocked.example" },
			}),
		});
		expect(response.status).toBe(403);
	});
});
