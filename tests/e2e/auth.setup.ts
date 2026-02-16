import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { test as setup } from "@playwright/test"
import { signInAndOpenApp } from "./helpers/auth"

const authFile = "playwright/.auth/user.json"

setup("authenticate for e2e storage state", async ({ page }) => {
	await signInAndOpenApp(page)
	mkdirSync(dirname(authFile), { recursive: true })
	await page.context().storageState({ path: authFile })
})
