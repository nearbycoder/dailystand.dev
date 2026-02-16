import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { posthogConstructorMock } = vi.hoisted(() => ({
	posthogConstructorMock: vi.fn(() => ({ shutdownAsync: vi.fn() })),
}));

vi.mock("posthog-node", () => ({
	PostHog: posthogConstructorMock,
}));

const originalProcessEnvKey = process.env.VITE_PUBLIC_POSTHOG_KEY;
const originalProcessEnvHost = process.env.VITE_PUBLIC_POSTHOG_HOST;
const originalImportMetaKey = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;
const originalImportMetaHost = import.meta.env.VITE_PUBLIC_POSTHOG_HOST;

function setImportMetaEnvValue(name: string, value: string | undefined) {
	const env = import.meta.env as Record<string, string | undefined>;
	if (value === undefined) {
		delete env[name];
		return;
	}
	env[name] = value;
}

function restoreEnv() {
	if (originalProcessEnvKey === undefined) {
		delete process.env.VITE_PUBLIC_POSTHOG_KEY;
	} else {
		process.env.VITE_PUBLIC_POSTHOG_KEY = originalProcessEnvKey;
	}

	if (originalProcessEnvHost === undefined) {
		delete process.env.VITE_PUBLIC_POSTHOG_HOST;
	} else {
		process.env.VITE_PUBLIC_POSTHOG_HOST = originalProcessEnvHost;
	}

	setImportMetaEnvValue("VITE_PUBLIC_POSTHOG_KEY", originalImportMetaKey);
	setImportMetaEnvValue("VITE_PUBLIC_POSTHOG_HOST", originalImportMetaHost);
}

describe("posthog server client", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
		restoreEnv();
	});

	afterAll(() => {
		restoreEnv();
	});

	it("returns null when no PostHog key is configured", async () => {
		delete process.env.VITE_PUBLIC_POSTHOG_KEY;
		setImportMetaEnvValue("VITE_PUBLIC_POSTHOG_KEY", undefined);

		const { getPostHogClient } = await import("./posthog-server");
		expect(getPostHogClient()).toBeNull();
		expect(posthogConstructorMock).not.toHaveBeenCalled();
	});

	it("creates and memoizes a client when configuration is present", async () => {
		process.env.VITE_PUBLIC_POSTHOG_KEY = "configured_key_123";
		process.env.VITE_PUBLIC_POSTHOG_HOST = "https://configured-host.example";
		setImportMetaEnvValue("VITE_PUBLIC_POSTHOG_KEY", "configured_key_123");
		setImportMetaEnvValue("VITE_PUBLIC_POSTHOG_HOST", "https://configured-host.example");

		const { getPostHogClient } = await import("./posthog-server");
		const clientA = getPostHogClient();
		const clientB = getPostHogClient();

		expect(clientA).not.toBeNull();
		expect(clientA).toBe(clientB);
		expect(posthogConstructorMock).toHaveBeenCalledTimes(1);
		expect(posthogConstructorMock).toHaveBeenCalledWith("configured_key_123", {
			host: "https://configured-host.example",
			flushAt: 1,
			flushInterval: 0,
		});
	});

	it("falls back to import.meta env when process env is missing", async () => {
		delete process.env.VITE_PUBLIC_POSTHOG_KEY;
		delete process.env.VITE_PUBLIC_POSTHOG_HOST;
		setImportMetaEnvValue("VITE_PUBLIC_POSTHOG_KEY", "meta_key_321");
		setImportMetaEnvValue("VITE_PUBLIC_POSTHOG_HOST", "https://meta-host.example");

		const { getPostHogClient } = await import("./posthog-server");
		const client = getPostHogClient();

		expect(client).not.toBeNull();
		expect(posthogConstructorMock).toHaveBeenCalledTimes(1);
		expect(posthogConstructorMock).toHaveBeenCalledWith("meta_key_321", {
			host: "https://meta-host.example",
			flushAt: 1,
			flushInterval: 0,
		});
	});
});
