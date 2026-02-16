import { expect, test } from "@playwright/test"

test("landing page and docs quickstart are reachable", async ({ page }) => {
	await page.goto("/")

	await expect(page.getByText("OPEN_SOURCE // SELF_HOSTED")).toBeVisible()
	await expect(
		page.getByText("MCP_SUPPORT // AI CAN GENERATE ALL OF YOUR DAILY_STANDS"),
	).toBeVisible()

	await page.getByRole("button", { name: "[DOCS]" }).click()
	await expect(page).toHaveURL(/\/docs/)
	await expect(
		page.getByRole("heading", { name: "PUBLIC API + MCP DOCUMENTATION" }),
	).toBeVisible()
})
