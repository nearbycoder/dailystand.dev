import { expect, test } from "@playwright/test"
import { signInAndOpenApp } from "./helpers/auth"

test("standup submission redirects to history", async ({ page }) => {
	await signInAndOpenApp(page)
	await page.goto("/app/standup")

	await expect(page.getByRole("heading", { name: "STANDUP" })).toBeVisible()

	const suffix = Date.now().toString()
	await page
		.getByPlaceholder("Finished the API integration...")
		.first()
		.fill(`E2E completed task ${suffix}`)
	await page
		.getByPlaceholder("Start building the dashboard...")
		.first()
		.fill(`E2E planned task ${suffix}`)
	await page
		.getByPlaceholder("Waiting on design review...")
		.first()
		.fill(`E2E blocker task ${suffix}`)

	await page.getByRole("button", { name: /(SUBMIT|UPDATE)_/ }).click()

	await expect(page).toHaveURL(/\/app\/history/)
	await expect(page.getByRole("heading", { name: "HISTORY" })).toBeVisible()
})
