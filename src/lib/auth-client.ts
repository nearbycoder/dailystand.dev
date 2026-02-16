import { createAuthClient } from "better-auth/react"
import { apiKeyClient, organizationClient } from "better-auth/client/plugins"
import { stripeClient } from "@better-auth/stripe/client"

export const authClient = createAuthClient({
	plugins: [
		organizationClient(),
		apiKeyClient(),
		stripeClient({
			subscription: true,
		}),
	],
})
