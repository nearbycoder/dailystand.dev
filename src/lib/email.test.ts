import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

type EmailModule = typeof import("./email")

async function loadEmailModule(env: Partial<Record<string, string>>) {
	vi.resetModules()
	for (const [key, value] of Object.entries(env)) {
		if (value === undefined) {
			delete process.env[key]
		} else {
			process.env[key] = value
		}
	}
	return import("./email") as Promise<EmailModule>
}

describe("email helpers", () => {
	const originalResendApiKey = process.env.RESEND_API_KEY
	const originalFromEmail = process.env.RESEND_FROM_EMAIL
	const originalBetterAuthUrl = process.env.BETTER_AUTH_URL
	const originalDryRunEmails = process.env.DRY_RUN_EMAILS
	const originalNodeEnv = process.env.NODE_ENV

	beforeEach(() => {
		vi.restoreAllMocks()
	})

	afterEach(() => {
		if (originalResendApiKey === undefined) {
			delete process.env.RESEND_API_KEY
		} else {
			process.env.RESEND_API_KEY = originalResendApiKey
		}
		if (originalFromEmail === undefined) {
			delete process.env.RESEND_FROM_EMAIL
		} else {
			process.env.RESEND_FROM_EMAIL = originalFromEmail
		}
		if (originalBetterAuthUrl === undefined) {
			delete process.env.BETTER_AUTH_URL
		} else {
			process.env.BETTER_AUTH_URL = originalBetterAuthUrl
		}
		if (originalDryRunEmails === undefined) {
			delete process.env.DRY_RUN_EMAILS
		} else {
			process.env.DRY_RUN_EMAILS = originalDryRunEmails
		}
		if (originalNodeEnv === undefined) {
			delete process.env.NODE_ENV
		} else {
			process.env.NODE_ENV = originalNodeEnv
		}
	})

	it("reports resend as unconfigured when api key is missing", async () => {
		const email = await loadEmailModule({
			RESEND_API_KEY: undefined,
			RESEND_FROM_EMAIL: "DailyStand <no-reply@dailystand.dev>",
			DRY_RUN_EMAILS: "false",
			NODE_ENV: "test",
		})
		expect(email.isResendConfigured()).toBe(false)
	})

	it("defaults to dry run mode in development", async () => {
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {})
		const fetchMock = vi.fn()
		vi.stubGlobal("fetch", fetchMock)

		const email = await loadEmailModule({
			RESEND_API_KEY: undefined,
			RESEND_FROM_EMAIL: "DailyStand <no-reply@dailystand.dev>",
			DRY_RUN_EMAILS: undefined,
			NODE_ENV: "development",
		})

		expect(email.isEmailDryRunEnabled()).toBe(true)
		expect(email.isResendConfigured()).toBe(true)

		await email.sendResendEmailMessage({
			to: "test@example.com",
			subject: "Hello",
			html: "<p>hello</p>",
			text: "hello",
		})

		expect(fetchMock).not.toHaveBeenCalled()
		expect(infoSpy).toHaveBeenCalled()
	})

	it("sends resend message with expected payload", async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
		})
		vi.stubGlobal("fetch", fetchMock)

		const email = await loadEmailModule({
			RESEND_API_KEY: "rs_test_key",
			RESEND_FROM_EMAIL: "DailyStand <no-reply@dailystand.dev>",
			DRY_RUN_EMAILS: "false",
			NODE_ENV: "test",
		})

		await email.sendResendEmailMessage({
			to: "test@example.com",
			subject: "Hello",
			html: "<p>hello</p>",
			text: "hello",
		})

		expect(fetchMock).toHaveBeenCalledTimes(1)
		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.resend.com/emails",
			expect.objectContaining({
				method: "POST",
				headers: expect.objectContaining({
					Authorization: "Bearer rs_test_key",
				}),
			}),
		)
	})

	it("throws when resend returns a failed response", async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: false,
			status: 400,
			text: async () => "bad request",
		})
		vi.stubGlobal("fetch", fetchMock)

		const email = await loadEmailModule({
			RESEND_API_KEY: "rs_test_key",
			RESEND_FROM_EMAIL: "DailyStand <no-reply@dailystand.dev>",
			DRY_RUN_EMAILS: "false",
			NODE_ENV: "test",
		})

		await expect(
			email.sendResendEmailMessage({
				to: "test@example.com",
				subject: "Hello",
				html: "<p>hello</p>",
				text: "hello",
			}),
		).rejects.toThrow("Resend email failed (400): bad request")
	})

	it("skips invite email when resend is not configured", async () => {
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {})
		const fetchMock = vi.fn()
		vi.stubGlobal("fetch", fetchMock)

		const email = await loadEmailModule({
			RESEND_API_KEY: undefined,
			RESEND_FROM_EMAIL: "DailyStand <no-reply@dailystand.dev>",
			BETTER_AUTH_URL: "https://dailystand.dev",
			DRY_RUN_EMAILS: "false",
			NODE_ENV: "test",
		})

		await email.sendInviteEmail({
			invitationId: "invite_123",
			to: "dev@example.com",
			organizationName: "DailyStand",
			inviterName: "Alex",
			role: "member",
		})

		expect(fetchMock).not.toHaveBeenCalled()
		expect(infoSpy).toHaveBeenCalled()
	})

	it("sends password reset email with configured resend", async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
		})
		vi.stubGlobal("fetch", fetchMock)

		const email = await loadEmailModule({
			RESEND_API_KEY: "rs_test_key",
			RESEND_FROM_EMAIL: "DailyStand <no-reply@dailystand.dev>",
			DRY_RUN_EMAILS: "false",
			NODE_ENV: "test",
		})

		await email.sendPasswordResetEmail({
			to: "dev@example.com",
			userName: "Sam",
			resetUrl: "https://dailystand.dev/auth/reset-password?token=abc",
		})

		expect(fetchMock).toHaveBeenCalledTimes(1)
		const payload = JSON.parse(fetchMock.mock.calls[0][1].body as string)
		expect(payload.subject).toBe("Reset your DailyStand password")
		expect(payload.text).toContain("Hi Sam,")
		expect(payload.text).toContain(
			"https://dailystand.dev/auth/reset-password?token=abc",
		)
	})
})
