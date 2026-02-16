import { betterAuth } from "better-auth"
import { apiKey, organization } from "better-auth/plugins"
import { stripe } from "@better-auth/stripe"
import Stripe from "stripe"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { tanstackStartCookies } from "better-auth/tanstack-start"
import { db } from "@/db"

const stripeEnabled = !!process.env.STRIPE_SECRET_KEY

const stripePlugin = stripeEnabled
	? stripe({
			stripe: new Stripe(process.env.STRIPE_SECRET_KEY!),
			subscription: {
				enabled: true,
				plans: [
					{
						name: "free",
						limits: {
							teams: 1,
							members: 5,
							historyDays: 7,
						},
					},
					{
						name: "pro",
						priceId: process.env.STRIPE_PRO_PRICE_ID || "price_pro",
						limits: {
							teams: -1,
							members: 25,
							historyDays: 90,
						},
					},
					{
						name: "business",
						priceId:
							process.env.STRIPE_BUSINESS_PRICE_ID || "price_business",
						limits: {
							teams: -1,
							members: -1,
							historyDays: 365,
						},
					},
				],
			},
		})
	: null

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "pg",
	}),
	emailAndPassword: {
		enabled: true,
	},
	plugins: [
		tanstackStartCookies(),
		organization({
			teams: {
				enabled: true,
			},
		}),
		apiKey({
			defaultPrefix: "ds_",
			requireName: true,
			enableMetadata: true,
			keyExpiration: {
				defaultExpiresIn: null,
				minExpiresIn: 1,
				maxExpiresIn: 365,
			},
			rateLimit: {
				enabled: true,
				timeWindow: 60_000,
				maxRequests: 600,
			},
			permissions: {
				defaultPermissions: {
					dailystand: [
						"profile:read",
						"teams:read",
						"members:manage",
						"standups:read",
						"standups:write",
						"analytics:read",
					],
				},
			},
		}),
		...(stripePlugin ? [stripePlugin] : []),
	],
})
