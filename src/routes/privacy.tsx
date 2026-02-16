import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Shield, Terminal } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/privacy")({
	component: PrivacyPage,
	head: () => ({
		meta: [
			{
				title: "DAILYSTAND // Privacy Policy",
			},
		],
	}),
});

const sections = [
	{
		title: "INFORMATION_WE_COLLECT",
		body: "We collect account details (name, email), organization/team membership, standup entries, and usage metadata required to operate and secure the service.",
	},
	{
		title: "HOW_WE_USE_DATA",
		body: "Data is used to provide core collaboration features, analytics, authentication, billing, and abuse prevention. We do not sell your personal data.",
	},
	{
		title: "DATA_SHARING",
		body: "We share data only with processors needed to run the platform (for example authentication, hosting, and billing infrastructure) under contractual protections.",
	},
	{
		title: "DATA_RETENTION",
		body: "Retention follows your subscription limits and account lifecycle. Deleted organizations and accounts are removed from active systems and then from backups on a rolling schedule.",
	},
	{
		title: "SECURITY",
		body: "We apply access controls, encryption in transit, and least-privilege service configuration. No method of transmission or storage is completely risk free.",
	},
	{
		title: "YOUR_CHOICES",
		body: "You can update organization membership, revoke API keys, and request account deletion. For privacy requests, contact privacy@dailystand.dev.",
	},
];

function PrivacyPage() {
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
						<Shield className="h-4 w-4" />
						<span className="text-xs font-bold tracking-[0.2em]">
							{"// LEGAL"}
						</span>
					</div>
					<h1 className="text-3xl font-extrabold tracking-tighter sm:text-5xl">
						PRIVACY_POLICY
					</h1>
					<p className="mt-3 text-sm text-ds-text-tertiary sm:text-base">
						How we collect, use, and protect your information.
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
