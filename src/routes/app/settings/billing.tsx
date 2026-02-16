import { createFileRoute } from "@tanstack/react-router";
import { useTRPC } from "@/integrations/trpc/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { Check, RotateCcw, Settings2, TriangleAlert, Zap } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/app/settings/billing")({
	component: BillingPage,
});

const plans = [
	{
		name: "FREE",
		id: "free",
		price: "$0",
		period: "/forever",
		features: ["1 team", "5 members", "7-day history", "MCP support"],
	},
	{
		name: "PRO",
		id: "pro",
		price: "$16",
		period: "/mo",
		popular: true,
		features: [
			"Unlimited teams",
			"15 members",
			"90-day history",
			"Basic analytics",
			"MCP support",
		],
	},
	{
		name: "BUSINESS",
		id: "business",
		price: "$65",
		period: "/mo",
		features: [
			"Unlimited teams",
			"Unlimited members",
			"Unlimited history",
			"Advanced analytics",
			"MCP support",
			"Slack integration",
			"Priority support",
		],
	},
];

const planRank: Record<string, number> = {
	free: 0,
	pro: 1,
	business: 2,
};

function BillingPage() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const subQuery = trpc.org.getSubscription.queryOptions();
	const { data: sub } = useQuery(subQuery);
	const { data: myMembership } = useQuery(
		trpc.org.getMyMembership.queryOptions(),
	);
	const canManageOrganization = myMembership?.canManageOrganization ?? false;
	const currentPlan = sub?.plan ?? "free";
	const [busyAction, setBusyAction] = useState<string | null>(null);

	if (!canManageOrganization) {
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
				<div className="border-[3px] border-ds-border p-6 text-sm text-ds-muted">
					MEMBER_ACCESS // Billing is managed by organization owners/admins.
				</div>
			</div>
		);
	}

	const getReferenceParams = () => {
		if (sub?.scope === "organization" && sub.referenceId) {
			return {
				customerType: "organization" as const,
				referenceId: sub.referenceId,
			};
		}
		return {};
	};

	const runAction = async (key: string, fn: () => Promise<unknown>) => {
		setBusyAction(key);
		try {
			await fn();
		} catch (error) {
			const message = error instanceof Error ? error.message : "Action failed";
			toast.error(message);
		} finally {
			setBusyAction(null);
		}
	};

	const handleUpgrade = async (planName: string) => {
		if (planName === "free") return;
		await runAction(`upgrade:${planName}`, () =>
			authClient.subscription.upgrade({
				plan: planName,
				successUrl: window.location.href,
				cancelUrl: window.location.href,
				...getReferenceParams(),
			}),
		);
	};

	const handleManagePortal = async () => {
		await runAction("portal", () =>
			authClient.subscription.billingPortal({
				returnUrl: window.location.href,
				...getReferenceParams(),
			}),
		);
	};

	const handleCancel = async () => {
		await runAction("cancel", () =>
			authClient.subscription.cancel({
				returnUrl: window.location.href,
				...getReferenceParams(),
			}),
		);
	};

	const handleRestore = async () => {
		await runAction("restore", () =>
			authClient.subscription.restore({
				...getReferenceParams(),
			}),
		);
		await queryClient.invalidateQueries({ queryKey: subQuery.queryKey });
		toast.success("Subscription restored");
	};

	const isPaidPlan = currentPlan !== "free";
	const hasPendingCancel = !!sub?.cancelAtPeriodEnd;
	const isOrgScoped = sub?.scope === "organization";

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

			{isPaidPlan && (
				<div className="mb-6 border-[3px] border-ds-border p-4 sm:p-5">
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<div className="font-extrabold tracking-wider text-sm">
								CURRENT_SUBSCRIPTION: {String(currentPlan).toUpperCase()}
							</div>
							<div className="text-ds-muted text-xs mt-1">
								{isOrgScoped ? "ORG_SCOPED" : "USER_SCOPED"}
								{sub?.periodEnd
									? ` // PERIOD_END: ${new Date(sub.periodEnd).toLocaleString()}`
									: ""}
							</div>
							{hasPendingCancel && (
								<div className="mt-2 inline-flex items-center gap-2 text-xs font-bold tracking-wider text-red-500">
									<TriangleAlert className="h-3.5 w-3.5" />
									CANCELS_AT_PERIOD_END
								</div>
							)}
						</div>
						<div className="flex flex-wrap items-center gap-2">
							<button
								onClick={handleManagePortal}
								disabled={busyAction !== null}
								className="border-[3px] border-ds-border px-3 py-2 text-xs font-extrabold tracking-wider hover:bg-ds-surface disabled:opacity-50"
							>
								<Settings2 className="mr-2 inline h-3.5 w-3.5" />
								MANAGE_IN_STRIPE
							</button>
							{hasPendingCancel ? (
								<button
									onClick={handleRestore}
									disabled={busyAction !== null}
									className="border-[3px] border-ds-accent px-3 py-2 text-xs font-extrabold tracking-wider text-ds-accent hover:bg-ds-accent hover:text-ds-accent-fg disabled:opacity-50"
								>
									<RotateCcw className="mr-2 inline h-3.5 w-3.5" />
									RESTORE
								</button>
							) : (
								<button
									onClick={handleCancel}
									disabled={busyAction !== null}
									className="border-[3px] border-red-500 px-3 py-2 text-xs font-extrabold tracking-wider text-red-500 hover:bg-red-500 hover:text-black disabled:opacity-50"
								>
									CANCEL_PLAN
								</button>
							)}
						</div>
					</div>
				</div>
			)}

			<div className="grid grid-cols-1 md:grid-cols-3 gap-0">
				{plans.map((plan) => {
					const isCurrent = plan.id === currentPlan;
					const upgradeKey = `upgrade:${plan.id}`;
					const currentRank = planRank[currentPlan] ?? 0;
					const targetRank = planRank[plan.id] ?? 0;
					const isDowngrade = targetRank < currentRank;
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
										disabled={busyAction !== null}
										className={`w-full py-3 font-extrabold text-sm tracking-wider transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-50 ${
											plan.popular
												? "bg-ds-bg text-ds-accent hover:opacity-90"
												: "border-[3px] border-ds-border-strong hover:bg-ds-border-strong hover:text-ds-bg"
										}`}
									>
										<Zap className="w-4 h-4" />
										{busyAction === upgradeKey
											? isDowngrade
												? "DOWNGRADING..."
												: "UPGRADING..."
											: isDowngrade
												? "DOWNGRADE"
												: "UPGRADE"}
									</button>
								)}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
