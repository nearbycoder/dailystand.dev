import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const {
	capturedConfig,
	authVerifyApiKeyMock,
	dbMock,
	countOrganizationMembersMock,
	countTeamMembersMock,
	getHistoryFloorDateMock,
	resolveOrganizationPlanLimitsMock,
} = vi.hoisted(() => ({
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
	countOrganizationMembersMock: vi.fn(),
	countTeamMembersMock: vi.fn(),
	getHistoryFloorDateMock: vi.fn(),
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
	countOrganizationMembers: countOrganizationMembersMock,
	countTeamMembers: countTeamMembersMock,
	getHistoryFloorDate: getHistoryFloorDateMock,
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
		},
	});
	dbMock.query.user.findFirst.mockResolvedValue(defaultActor);
	return apiKey;
}

describe("mcp api route contracts", () => {
	beforeAll(async () => {
		process.env.API_ALLOWED_ORIGINS = "https://allowed.example";
		process.env.BETTER_AUTH_URL = "https://app.example";
		await import("./mcp");
	});

	beforeEach(() => {
		vi.clearAllMocks();
		getHistoryFloorDateMock.mockReturnValue(undefined);
		resolveOrganizationPlanLimitsMock.mockResolvedValue({
			limits: {
				historyDays: 90,
				members: 15,
			},
		});
		countOrganizationMembersMock.mockResolvedValue(1);
		countTeamMembersMock.mockResolvedValue(1);
		const deleteWhere = vi.fn().mockResolvedValue(undefined);
		dbMock.delete.mockReturnValue({ where: deleteWhere });
		const insertValues = vi.fn().mockResolvedValue(undefined);
		dbMock.insert.mockReturnValue({ values: insertValues });
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

	it("returns CORS headers for allowed preflight requests", () => {
		const response = handlers().OPTIONS({
			request: new Request("https://dailystand.dev/api/mcp", {
				method: "OPTIONS",
				headers: { origin: "https://allowed.example" },
			}),
		});

		expect(response.status).toBe(204);
		expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
			"https://allowed.example",
		);
		expect(response.headers.get("Access-Control-Allow-Methods")).toContain(
			"POST",
		);
	});

	it("returns initialize handshake response", async () => {
		const response = await handlers().POST({
			request: new Request("https://dailystand.dev/api/mcp", {
				method: "POST",
				headers: {
					origin: "https://allowed.example",
					"content-type": "application/json",
				},
				body: JSON.stringify({
					jsonrpc: "2.0",
					id: "init-1",
					method: "initialize",
				}),
			}),
		});

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({
			jsonrpc: "2.0",
			id: "init-1",
			result: {
				protocolVersion: "2024-11-05",
				serverInfo: {
					name: "dailystand-mcp",
				},
			},
		});
	});

	it("returns 204 for notifications/initialized notifications", async () => {
		const response = await handlers().POST({
			request: new Request("https://dailystand.dev/api/mcp", {
				method: "POST",
				headers: {
					origin: "https://allowed.example",
					"content-type": "application/json",
				},
				body: JSON.stringify({
					jsonrpc: "2.0",
					method: "notifications/initialized",
				}),
			}),
		});

		expect(response.status).toBe(204);
		expect(await response.text()).toBe("");
	});

	it("returns tool list for authorized requests", async () => {
		mockAuthenticatedActor();

		const response = await handlers().POST({
			request: new Request("https://dailystand.dev/api/mcp", {
				method: "POST",
				headers: {
					origin: "https://allowed.example",
					"content-type": "application/json",
					"x-api-key": "test-key",
				},
				body: JSON.stringify({
					jsonrpc: "2.0",
					id: 11,
					method: "tools/list",
				}),
			}),
		});

		expect(response.status).toBe(200);
		const payload = await response.json();
		expect(payload).toMatchObject({
			jsonrpc: "2.0",
			id: 11,
			result: {
				tools: expect.any(Array),
			},
		});
		const toolNames = payload.result.tools.map(
			(tool: { name: string }) => tool.name,
		);
		expect(toolNames).toEqual(
			expect.arrayContaining([
				"list_organizations",
				"list_teams",
				"list_my_teams",
				"list_org_members",
				"add_organization_member",
				"assign_user_to_team",
				"remove_user_from_team",
				"submit_my_standup",
				"get_my_standup",
				"get_my_standup_history",
				"get_team_standup_day",
				"get_team_standup_history",
			]),
		);
		expect(toolNames).toHaveLength(12);
	});

	it("validates tools/call params shape", async () => {
		const response = await handlers().POST({
			request: new Request("https://dailystand.dev/api/mcp", {
				method: "POST",
				headers: {
					origin: "https://allowed.example",
					"content-type": "application/json",
				},
				body: JSON.stringify({
					jsonrpc: "2.0",
					id: 12,
					method: "tools/call",
					params: {},
				}),
			}),
		});

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({
			jsonrpc: "2.0",
			id: 12,
			error: {
				code: -32602,
			},
		});
	});

	it("returns tool-level error result for unknown tools", async () => {
		const response = await handlers().POST({
			request: new Request("https://dailystand.dev/api/mcp", {
				method: "POST",
				headers: {
					origin: "https://allowed.example",
					"content-type": "application/json",
				},
				body: JSON.stringify({
					jsonrpc: "2.0",
					id: 13,
					method: "tools/call",
					params: {
						name: "unknown_tool",
						arguments: {},
					},
				}),
			}),
		});

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({
			jsonrpc: "2.0",
			id: 13,
			result: {
				isError: true,
				structuredContent: {
					code: "TOOL_NOT_FOUND",
					status: 404,
				},
			},
		});
	});

	it("executes list_organizations and returns structuredContent", async () => {
		mockAuthenticatedActor();
		dbMock.query.member.findMany.mockResolvedValue([
			validMembership("org_1", "Acme", "acme", "owner"),
		]);

		const response = await handlers().POST({
			request: new Request("https://dailystand.dev/api/mcp", {
				method: "POST",
				headers: {
					origin: "https://allowed.example",
					"content-type": "application/json",
					"x-api-key": "test-key",
				},
				body: JSON.stringify({
					jsonrpc: "2.0",
					id: 14,
					method: "tools/call",
					params: {
						name: "list_organizations",
						arguments: {},
					},
				}),
			}),
		});

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({
			jsonrpc: "2.0",
			id: 14,
			result: {
				structuredContent: {
					user: { id: defaultActor.id },
					organizations: [{ id: "org_1", role: "owner" }],
				},
			},
		});
	});

	it("returns owner-required error for member-management tools", async () => {
		mockAuthenticatedActor();
		dbMock.query.member.findMany.mockResolvedValue([
			validMembership("org_1", "Acme", "acme", "member"),
		]);
		dbMock.query.member.findFirst.mockResolvedValue({
			role: "member",
		});

		const response = await handlers().POST({
			request: new Request("https://dailystand.dev/api/mcp", {
				method: "POST",
				headers: {
					origin: "https://allowed.example",
					"content-type": "application/json",
					"x-api-key": "test-key",
				},
				body: JSON.stringify({
					jsonrpc: "2.0",
					id: 15,
					method: "tools/call",
					params: {
						name: "add_organization_member",
						arguments: {
							email: "new@dailystand.dev",
						},
					},
				}),
			}),
		});

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({
			jsonrpc: "2.0",
			id: 15,
			result: {
				isError: true,
				structuredContent: {
					code: "OWNER_REQUIRED",
					status: 403,
				},
			},
		});
	});
});
