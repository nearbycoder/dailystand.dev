import { defineConfig, devices } from "@playwright/test"

const baseURL =
	process.env.PLAYWRIGHT_BASE_URL ??
	process.env.BETTER_AUTH_URL ??
	"http://127.0.0.1:3000"

export default defineConfig({
	testDir: "./tests/e2e",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: process.env.CI
		? [["github"], ["html", { open: "never" }]]
		: [["list"], ["html", { open: "never" }]],
	use: {
		baseURL,
		trace: "on-first-retry",
		screenshot: "only-on-failure",
		video: "retain-on-failure",
	},
	webServer: {
		command: "bun run build && bun run start",
		env: {
			...process.env,
			BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? baseURL,
			BETTER_AUTH_SECRET:
				process.env.BETTER_AUTH_SECRET ?? "playwright-local-secret",
			BETTER_AUTH_TRUSTED_ORIGINS:
				process.env.BETTER_AUTH_TRUSTED_ORIGINS ??
				"http://127.0.0.1:3000,http://localhost:3000",
		},
		url: baseURL,
		reuseExistingServer: !process.env.CI,
		timeout: 180_000,
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
})
