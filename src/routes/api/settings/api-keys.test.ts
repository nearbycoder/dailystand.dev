import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { capturedConfig, authGetSessionMock, authCreateApiKeyMock, dbMock } =
	vi.hoisted(() => ({
		capturedConfig: {
			value: null as null | {
				server: {
					handlers: {
						POST: (ctx: { request: Request }) => Promise<Response>;
					};
				};
			},
		},
		authGetSessionMock: vi.fn(),
		authCreateApiKeyMock: vi.fn(),
		dbMock: {
			query: {
				member: {
					findFirst: vi.fn(),
				},
			},
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
			getSession: authGetSessionMock,
			createApiKey: authCreateApiKeyMock,
		},
	},
}));

vi.mock("@/db", () => ({
	db: dbMock,
}));

function postHandler() {
	const routeConfig = capturedConfig.value;
	if (!routeConfig) throw new Error("Route config was not captured");
	return routeConfig.server.handlers.POST;
}

describe("api settings api key creation route", () => {
	beforeAll(async () => {
		await import("./api-keys");
	});

	beforeEach(() => {
		vi.clearAllMocks();
		authGetSessionMock.mockResolvedValue({
			user: { id: "user_1" },
			session: { activeOrganizationId: "org_1" },
		});
	});

	it("rejects untrusted origins", async () => {
		const response = await postHandler()({
			request: new Request("https://dailystand.dev/api/settings/api-keys", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					origin: "https://attacker.example",
				},
				body: JSON.stringify({
					name: "Integration key",
					expiresInSeconds: 7776000,
					includeMemberManage: false,
				}),
			}),
		});

		expect(response.status).toBe(403);
		await expect(response.json()).resolves.toMatchObject({
			success: false,
			error: "Untrusted origin.",
		});
		expect(authGetSessionMock).not.toHaveBeenCalled();
	});

	it("rejects non-json content-type", async () => {
		const response = await postHandler()({
			request: new Request("https://dailystand.dev/api/settings/api-keys", {
				method: "POST",
				headers: {
					"content-type": "text/plain",
					origin: "https://dailystand.dev",
				},
				body: "name=integration",
			}),
		});

		expect(response.status).toBe(415);
		await expect(response.json()).resolves.toMatchObject({
			success: false,
			error: "Content-Type must be application/json.",
		});
		expect(authGetSessionMock).not.toHaveBeenCalled();
	});

	it("returns unauthorized when there is no session", async () => {
		authGetSessionMock.mockResolvedValue(null);

		const response = await postHandler()({
			request: new Request("https://dailystand.dev/api/settings/api-keys", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					origin: "https://dailystand.dev",
				},
				body: JSON.stringify({
					name: "Integration key",
					expiresInSeconds: 7776000,
					includeMemberManage: false,
				}),
			}),
		});

		expect(response.status).toBe(401);
		await expect(response.json()).resolves.toMatchObject({
			success: false,
		});
		expect(authCreateApiKeyMock).not.toHaveBeenCalled();
	});

	it("returns bad request for invalid payload", async () => {
		const response = await postHandler()({
			request: new Request("https://dailystand.dev/api/settings/api-keys", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					origin: "https://dailystand.dev",
				},
				body: JSON.stringify({
					name: "",
					expiresInSeconds: 7776000,
					includeMemberManage: false,
				}),
			}),
		});

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({
			success: false,
			error: "Invalid API key create payload.",
		});
		expect(authCreateApiKeyMock).not.toHaveBeenCalled();
	});

	it("creates a key with default scopes", async () => {
		authCreateApiKeyMock.mockResolvedValue({
			id: "key_1",
			key: "ds_secret",
			name: "Integration key",
		});

		const response = await postHandler()({
			request: new Request("https://dailystand.dev/api/settings/api-keys", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					origin: "https://dailystand.dev",
				},
				body: JSON.stringify({
					name: "Integration key",
					expiresInSeconds: 7776000,
					includeMemberManage: false,
				}),
			}),
		});

		expect(response.status).toBe(200);
		expect(authCreateApiKeyMock).toHaveBeenCalledWith({
			body: {
				userId: "user_1",
				name: "Integration key",
				expiresIn: 7776000,
				metadata: {
					source: "settings.api-keys",
				},
				permissions: {
					dailystand: [
						"profile:read",
						"teams:read",
						"standups:read",
						"standups:write",
						"analytics:read",
					],
				},
			},
		});
		await expect(response.json()).resolves.toMatchObject({
			success: true,
			data: {
				id: "key_1",
			},
		});
	});

	it("rejects member-management scope when caller is not owner", async () => {
		dbMock.query.member.findFirst.mockResolvedValue({
			role: "admin",
		});

		const response = await postHandler()({
			request: new Request("https://dailystand.dev/api/settings/api-keys", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					origin: "https://dailystand.dev",
				},
				body: JSON.stringify({
					name: "Owner key",
					expiresInSeconds: 2592000,
					includeMemberManage: true,
				}),
			}),
		});

		expect(response.status).toBe(403);
		await expect(response.json()).resolves.toMatchObject({
			success: false,
			error:
				"Only organization owners can create API keys with member-management scope.",
		});
		expect(authCreateApiKeyMock).not.toHaveBeenCalled();
	});

	it("creates a key with member-management scope when caller is owner", async () => {
		dbMock.query.member.findFirst.mockResolvedValue({
			role: "owner",
		});
		authCreateApiKeyMock.mockResolvedValue({
			id: "key_2",
			key: "ds_secret_2",
			name: "Owner key",
		});

		const response = await postHandler()({
			request: new Request("https://dailystand.dev/api/settings/api-keys", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					origin: "https://dailystand.dev",
				},
				body: JSON.stringify({
					name: "Owner key",
					expiresInSeconds: 2592000,
					includeMemberManage: true,
				}),
			}),
		});

		expect(response.status).toBe(200);
		expect(dbMock.query.member.findFirst).toHaveBeenCalledTimes(1);
		expect(authCreateApiKeyMock).toHaveBeenCalledWith({
			body: {
				userId: "user_1",
				name: "Owner key",
				expiresIn: 2592000,
				metadata: {
					source: "settings.api-keys",
				},
				permissions: {
					dailystand: [
						"profile:read",
						"teams:read",
						"standups:read",
						"standups:write",
						"analytics:read",
						"members:manage",
					],
				},
			},
		});
		await expect(response.json()).resolves.toMatchObject({
			success: true,
			data: {
				id: "key_2",
			},
		});
	});
});
