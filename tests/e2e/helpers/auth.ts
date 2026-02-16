import { expect, type Page } from "@playwright/test"

const E2E_USER_EMAIL = process.env.E2E_USER_EMAIL ?? "alex@dailystand.dev"
const E2E_USER_PASSWORD = process.env.E2E_USER_PASSWORD ?? "password123"

export async function signInAndOpenApp(page: Page) {
	await page.goto("/auth/sign-in")
	await expect(page.getByRole("heading", { name: "SIGN_IN" })).toBeVisible()

	await page.getByPlaceholder("you@company.com").fill(E2E_USER_EMAIL)
	await page.locator('input[type="password"]').first().fill(E2E_USER_PASSWORD)
	await page.getByRole("button", { name: /SIGN_IN/ }).click()

	await page.waitForURL(/\/app(?:\/)?/)
	await page.waitForLoadState("networkidle")

	const orgButton = page.locator("button").filter({ hasText: /acme-corp/i }).first()
	if (await orgButton.isVisible().catch(() => false)) {
		await expect(orgButton).toBeVisible()
		await orgButton.click()
		await page.waitForLoadState("networkidle")
	}
}
