import { expect, type Page } from "@playwright/test"

const E2E_USER_EMAIL = process.env.E2E_USER_EMAIL ?? "alex@dailystand.dev"
const E2E_USER_PASSWORD = process.env.E2E_USER_PASSWORD ?? "password123"
const FALLBACK_E2E_EMAILS = [
	"jamie@dailystand.dev",
	"sam@dailystand.dev",
	"morgan@dailystand.dev",
	"taylor@dailystand.dev",
	"priya@dailystand.dev",
]

export async function signInAndOpenApp(page: Page) {
	await page.goto("/app")
	await page.waitForLoadState("networkidle")

	const onSignInPage =
		/\/auth\/sign-in/.test(page.url()) ||
		(await page
			.getByRole("heading", { name: "SIGN_IN" })
			.isVisible()
			.catch(() => false))

	if (onSignInPage) {
		await expect(page.getByRole("heading", { name: "SIGN_IN" })).toBeVisible()

		const passwordInput = page.locator('input[type="password"]').first()
		const errorBanner = page.getByText(/^ERROR:/).first()
		const candidateEmails = [E2E_USER_EMAIL, ...FALLBACK_E2E_EMAILS]

		let signedIn = false
		let lastError = ""

		for (const candidateEmail of candidateEmails) {
			const emailInput = page.getByPlaceholder("you@company.com")
			await emailInput.fill(candidateEmail)
			await expect(emailInput).toHaveValue(candidateEmail)
			await passwordInput.fill(E2E_USER_PASSWORD)
			await expect(passwordInput).toHaveValue(E2E_USER_PASSWORD)
			await page.getByRole("button", { name: /SIGN_IN/ }).click()

			const outcome = await Promise.race([
				page
					.waitForURL(/\/app(?:\/|\?|$)/, { timeout: 8_000 })
					.then(() => "app" as const)
					.catch(() => null),
				errorBanner
					.waitFor({ state: "visible", timeout: 8_000 })
					.then(() => "error" as const)
					.catch(() => null),
			])

			if (outcome === "app") {
				signedIn = true
				break
			}

			if (outcome === "error") {
				lastError = (await errorBanner.textContent()) ?? "Sign in failed"
				if (/too many requests/i.test(lastError)) {
					continue
				}
				throw new Error(`Sign in failed for ${candidateEmail}: ${lastError}`)
			}
		}

		if (!signedIn) {
			throw new Error(
				`Unable to sign in with seeded users. Last auth error: ${lastError || "none"}`,
			)
		}
	}

	await page.waitForLoadState("networkidle")

	const selectOrgHeading = page.getByRole("heading", { name: "SELECT_ORG" })
	const onSelectOrgScreen = await selectOrgHeading
		.waitFor({ state: "visible", timeout: 3_000 })
		.then(() => true)
		.catch(() => false)
	if (onSelectOrgScreen) {
		const orgButton = page
			.getByRole("button")
			.filter({ hasText: /acme corp|acme-corp/i })
			.first()
		await expect(orgButton).toBeVisible()
		await orgButton.click()
		await page.waitForLoadState("networkidle")
		await expect(selectOrgHeading).not.toBeVisible({ timeout: 10_000 })
	}
}
