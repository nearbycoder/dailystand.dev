import { createFileRoute } from "@tanstack/react-router"
import { useTRPC } from "@/integrations/trpc/react"
import { useQuery } from "@tanstack/react-query"
import { authClient } from "@/lib/auth-client"
import { Check, Zap } from "lucide-react"

export const Route = createFileRoute("/app/settings/billing")({
	component: BillingPage,
})

const plans = [
	{
		name: "FREE",
		id: "free",
		price: "$0",
		period: "/forever",
		features: ["1 team", "5 members", "7-day history"],
	},
	{
		name: "PRO",
		id: "pro",
		price: "$8",
		period: "/user/mo",
		popular: true,
		features: [
			"Unlimited teams",
			"25 members",
			"90-day history",
			"Basic analytics",
		],
	},
	{
		name: "BUSINESS",
		id: "business",
		price: "$12",
		period: "/user/mo",
		features: [
			"Unlimited everything",
			"1-year history",
			"Advanced analytics",
			"Slack integration",
			"Priority support",
		],
	},
]

function BillingPage() {
	const trpc = useTRPC()
	const { data: sub } = useQuery(trpc.org.getSubscription.queryOptions())
	const currentPlan = sub?.plan ?? "free"

	const handleUpgrade = async (planName: string) => {
		if (planName === "free") return
		await authClient.subscription.upgrade({
			plan: planName,
			successUrl: window.location.href,
			cancelUrl: window.location.href,
		})
	}

	return (
		<div className="mx-auto w-full max-w-[1200px] px-4 py-5 sm:p-6">
			<div className="mb-8">
				<h1 className="text-2xl font-extrabold tracking-tighter sm:text-3xl">
					BILLING
				</h1>
				<p className="text-ds-muted text-sm mt-1">
					// MANAGE YOUR SUBSCRIPTION
				</p>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-3 gap-0">
				{plans.map((plan) => {
					const isCurrent = plan.id === currentPlan
					return (
						<div
							key={plan.id}
							className={`-mt-[3px] -ml-0 flex flex-col border-[3px] p-6 md:mt-0 md:-ml-[3px] md:p-8 first:ml-0 ${
								plan.popular
									? "bg-ds-accent text-ds-accent-fg border-ds-accent"
									: "border-ds-border"
							}`}
						>
							{plan.popular && (
								<div className="text-xs font-extrabold tracking-widest mb-4 bg-ds-bg text-ds-accent inline-block px-3 py-1 self-start">
									RECOMMENDED
								</div>
							)}
							<h3 className="text-2xl font-extrabold tracking-tighter">
								{plan.name}
							</h3>
							<div className="mt-4">
								<span className="text-4xl font-extrabold sm:text-5xl">
									{plan.price}
								</span>
								<span
									className={`text-sm ${plan.popular ? "opacity-60" : "text-ds-muted"}`}
								>
									{plan.period}
								</span>
							</div>
							<ul className="mt-8 space-y-3 flex-1">
								{plan.features.map((f) => (
									<li key={f} className="flex items-center gap-2 text-sm">
										<Check className="w-4 h-4 shrink-0" />
										{f}
									</li>
								))}
							</ul>
							<div className="mt-8">
								{isCurrent ? (
									<button
										disabled
										className={`w-full py-3 font-extrabold text-sm tracking-wider opacity-50 ${
											plan.popular
												? "bg-ds-bg text-ds-accent"
												: "border-[3px] border-ds-muted3 text-ds-muted"
										}`}
									>
										CURRENT_PLAN
									</button>
								) : plan.id === "free" ? (
									<button
										disabled
										className="w-full py-3 font-extrabold text-sm tracking-wider border-[3px] border-ds-muted3 text-ds-muted opacity-50"
									>
										DOWNGRADE
									</button>
								) : (
									<button
										onClick={() => handleUpgrade(plan.id)}
										className={`w-full py-3 font-extrabold text-sm tracking-wider transition-all duration-150 flex items-center justify-center gap-2 ${
											plan.popular
												? "bg-ds-bg text-ds-accent hover:opacity-90"
												: "border-[3px] border-ds-border-strong hover:bg-ds-border-strong hover:text-ds-bg"
										}`}
									>
										<Zap className="w-4 h-4" />
										UPGRADE
									</button>
								)}
							</div>
						</div>
					)
				})}
			</div>
		</div>
	)
}
