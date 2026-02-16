import { expect, test } from "@playwright/test"
import { signInAndOpenApp } from "./helpers/auth"

test("seeded user can sign in and access dashboard", async ({ page }) => {
	await signInAndOpenApp(page)

	await expect(page).toHaveURL(/\/app(?:\/)?$/)
	await expect(page.getByRole("heading", { name: "DASHBOARD" })).toBeVisible()
	await expect(page.getByRole("link", { name: /VIEW_ANALYTICS/ })).toBeVisible()
})
