import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { capturedConfig, authGetSessionMock, authCreateApiKeyMock } = vi.hoisted(
	() => ({
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
	}),
);

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
	});

	it("returns unauthorized when there is no session", async () => {
		authGetSessionMock.mockResolvedValue(null);

		const response = await postHandler()({
			request: new Request("https://dailystand.dev/api/settings/api-keys", {
				method: "POST",
				headers: { "content-type": "application/json" },
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
		authGetSessionMock.mockResolvedValue({
			user: { id: "user_1" },
		});

		const response = await postHandler()({
			request: new Request("https://dailystand.dev/api/settings/api-keys", {
				method: "POST",
				headers: { "content-type": "application/json" },
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
		authGetSessionMock.mockResolvedValue({
			user: { id: "user_1" },
		});
		authCreateApiKeyMock.mockResolvedValue({
			id: "key_1",
			key: "ds_secret",
			name: "Integration key",
		});

		const response = await postHandler()({
			request: new Request("https://dailystand.dev/api/settings/api-keys", {
				method: "POST",
				headers: { "content-type": "application/json" },
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

	it("creates a key with member-management scope when requested", async () => {
		authGetSessionMock.mockResolvedValue({
			user: { id: "user_1" },
		});
		authCreateApiKeyMock.mockResolvedValue({
			id: "key_2",
			key: "ds_secret_2",
			name: "Owner key",
		});

		const response = await postHandler()({
			request: new Request("https://dailystand.dev/api/settings/api-keys", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					name: "Owner key",
					expiresInSeconds: 2592000,
					includeMemberManage: true,
				}),
			}),
		});

		expect(response.status).toBe(200);
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
