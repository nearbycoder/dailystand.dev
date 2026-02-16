import { expect, test, type Page } from "@playwright/test"
import { signInAndOpenApp } from "./helpers/auth"

async function expectNoHorizontalPageOverflow(page: Page) {
	const hasOverflow = await page.evaluate(() => {
		const width = window.innerWidth
		const rootWidth = document.documentElement.scrollWidth
		const bodyWidth = document.body.scrollWidth
		return rootWidth > width + 2 || bodyWidth > width + 2
	})

	expect(hasOverflow).toBe(false)
}

test.describe("mobile docs pass", () => {
	test("public docs routes render on mobile without page overflow", async ({
		page,
	}) => {
		await page.goto("/docs")
		await expect(
			page.getByRole("heading", { name: "PUBLIC API + MCP DOCUMENTATION" }),
		).toBeVisible()
		await expectNoHorizontalPageOverflow(page)

		await page.goto("/docs/rest")
		await expect(
			page.getByRole("heading", { name: "ENDPOINT REFERENCE" }),
		).toBeVisible()
		await expectNoHorizontalPageOverflow(page)

		await page.goto("/docs/mcp")
		await expect(
			page.getByRole("heading", { name: "JSON-RPC TOOLING FOR AGENTS" }),
		).toBeVisible()
		await expectNoHorizontalPageOverflow(page)

		await page.goto("/docs/explorer")
		await expect(
			page.getByRole("heading", { name: "TEST CALLS DIRECTLY FROM DOCS" }),
		).toBeVisible()
		await expect(page.getByRole("button", { name: "SEND_REST" })).toBeVisible()
		await expect(page.getByRole("button", { name: "MCP" })).toBeVisible()
		await expectNoHorizontalPageOverflow(page)
	})

	test("authenticated API docs route is usable on mobile", async ({ page }) => {
		await signInAndOpenApp(page)
		await page.goto("/app/settings/api-docs")
		const selectOrgHeading = page.getByRole("heading", { name: "SELECT_ORG" })
		if (await selectOrgHeading.isVisible().catch(() => false)) {
			const orgButton = page
				.getByRole("button")
				.filter({ hasText: /acme corp|acme-corp/i })
				.first()
			await orgButton.click()
			await page.waitForLoadState("networkidle")
			await page.goto("/app/settings/api-docs")
		}

		await expect(page.getByRole("heading", { name: "API_DOCS" })).toBeVisible()
		await expect(
			page.getByRole("heading", { name: "CAPABILITY_MATRIX" }),
		).toBeVisible()
		await expect(
			page.getByRole("heading", { name: "MCP_JSON_RPC_FLOW" }),
		).toBeVisible()
		await expectNoHorizontalPageOverflow(page)
	})
})
