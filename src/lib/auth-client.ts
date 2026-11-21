import { apiKeyClient } from "@better-auth/api-key/client";
import { stripeClient } from "@better-auth/stripe/client";
import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
	plugins: [
		organizationClient({
			teams: {
				enabled: true,
			},
		}),
		apiKeyClient(),
		stripeClient({
			subscription: true,
		}),
	],
});
