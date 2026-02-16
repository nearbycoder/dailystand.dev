import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, FileText, Terminal } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/terms")({
	component: TermsPage,
	head: () => ({
		meta: [
			{
				title: "DAILYSTAND // Terms of Service",
			},
		],
	}),
});

const sections = [
	{
		title: "ACCEPTANCE_OF_TERMS",
		body: "By using DailyStand, you agree to these Terms and our Privacy Policy. If you do not agree, do not use the service.",
	},
	{
		title: "ACCOUNTS_AND_ORGANIZATIONS",
		body: "You are responsible for account security and for activity under your organization. Owners and admins are responsible for seat/member administration.",
	},
	{
		title: "ACCEPTABLE_USE",
		body: "You may not use the service for unlawful activity, abuse, unauthorized access attempts, or activity that degrades platform availability.",
	},
	{
		title: "PLANS_AND_BILLING",
		body: "Paid plans renew automatically unless canceled. Feature and usage limits depend on your active plan. Refunds and billing disputes are handled per applicable law and processor terms.",
	},
	{
		title: "TERMINATION",
		body: "We may suspend or terminate accounts for material violations of these Terms. You may stop using the service at any time and request deletion.",
	},
	{
		title: "DISCLAIMERS_AND_LIMITATION",
		body: "The service is provided as-is and as-available. To the extent permitted by law, DailyStand is not liable for indirect, incidental, or consequential damages.",
	},
	{
		title: "CONTACT",
		body: "Questions about these Terms can be sent to legal@dailystand.dev.",
	},
];

function TermsPage() {
	return (
		<div className="min-h-screen bg-ds-bg text-ds-fg selection:bg-ds-selection-bg selection:text-ds-selection-fg font-mono">
			<header className="border-b-[3px] border-ds-border-strong p-3 sm:p-4">
				<div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
					<div className="flex items-center gap-3">
						<Terminal className="w-6 h-6 text-ds-accent" />
						<span className="text-xl font-extrabold tracking-tighter">
							DAILYSTAND
						</span>
					</div>
					<div className="ml-auto flex items-center gap-3">
						<ThemeToggle />
						<Link
							to="/"
							className="inline-flex items-center gap-2 border-[3px] border-ds-border-strong px-3 py-2 text-xs font-extrabold tracking-wider transition-colors hover:bg-ds-border-strong hover:text-ds-bg sm:px-4"
						>
							<ArrowLeft className="h-4 w-4" />
							BACK_HOME
						</Link>
					</div>
				</div>
			</header>

			<main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
				<div className="border-[3px] border-ds-accent bg-ds-accent/10 p-5 sm:p-7">
					<div className="mb-3 flex items-center gap-2 text-ds-accent">
						<FileText className="h-4 w-4" />
						<span className="text-xs font-bold tracking-[0.2em]">
							{"// LEGAL"}
						</span>
					</div>
					<h1 className="text-3xl font-extrabold tracking-tighter sm:text-5xl">
						TERMS_OF_SERVICE
					</h1>
					<p className="mt-3 text-sm text-ds-text-tertiary sm:text-base">
						The rules and responsibilities for using DailyStand.
					</p>
					<p className="mt-4 text-xs font-bold tracking-widest text-ds-muted">
						LAST_UPDATED: FEBRUARY 16, 2026
					</p>
				</div>

				<div className="mt-8 space-y-0">
					{sections.map((section) => (
						<section
							key={section.title}
							className="-mt-[3px] border-[3px] border-ds-border-strong p-5 sm:p-6"
						>
							<h2 className="text-sm font-extrabold tracking-wider text-ds-accent sm:text-base">
								{section.title}
							</h2>
							<p className="mt-3 text-sm leading-relaxed text-ds-text-tertiary sm:text-base">
								{section.body}
							</p>
						</section>
					))}
				</div>
			</main>
		</div>
	);
}
