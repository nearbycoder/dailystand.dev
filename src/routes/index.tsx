import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowRight,
	BarChart3,
	Bot,
	Check,
	Clock,
	FileText,
	Github,
	Server,
	Shield,
	Terminal,
	Users,
	Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { authClient } from "@/lib/auth-client";
import {
	buildHomeStructuredData,
	buildPageSeo,
	KEYWORD_CLUSTERS,
} from "@/lib/seo";

const homeSeo = buildPageSeo({
	title: "Async Standup Software for Remote Teams | DailyStand",
	description:
		"DailyStand is open source async standup software for remote engineering teams. Replace daily meetings with fast updates, analytics, API access, and MCP automation.",
	path: "/",
	keywords: [
		...KEYWORD_CLUSTERS.core,
		...KEYWORD_CLUSTERS.platform,
		...KEYWORD_CLUSTERS.apiAndAi,
		"async scrum standup",
		"daily scrum software",
	],
	ogPage: "home",
});

const homeStructuredData = buildHomeStructuredData();

export const Route = createFileRoute("/")({
	component: LandingPage,
	head: () => ({
		meta: homeSeo.meta,
		links: homeSeo.links,
	}),
});

const features = [
	{
		icon: <Clock className="w-5 h-5" />,
		title: "Daily Standups",
		description:
			"Quick daily updates — what you did, what you're doing, and what's blocking you.",
	},
	{
		icon: <Users className="w-5 h-5" />,
		title: "Team Visibility",
		description:
			"See what everyone on your team is working on. Stay aligned without meetings.",
	},
	{
		icon: <BarChart3 className="w-5 h-5" />,
		title: "Analytics",
		description:
			"Track team velocity and identify recurring blockers over time.",
	},
	{
		icon: <Zap className="w-5 h-5" />,
		title: "Lightning Fast",
		description:
			"Submit your standup in under 60 seconds. No friction, no excuses.",
	},
	{
		icon: <Shield className="w-5 h-5" />,
		title: "Secure by Default",
		description:
			"Your data stays private. Organization-level access control built in.",
	},
	{
		icon: <ArrowRight className="w-5 h-5" />,
		title: "Integrations (Coming Soon)",
		description:
			"Slack, Linear, and email digests are coming soon for Business plans.",
	},
	{
		icon: <Bot className="w-5 h-5" />,
		title: "MCP + AI Standups",
		description:
			"Use MCP tools with AI to generate and submit your daily standups automatically.",
	},
	{
		icon: <FileText className="w-5 h-5" />,
		title: "Markdown + CSV Exports",
		description:
			"Export standup history and analytics as Markdown for sharing or CSV for deeper analysis.",
	},
];

const plans = [
	{
		name: "FREE",
		price: "$0",
		period: "/forever",
		features: ["1 team", "5 members", "7-day history", "MCP support"],
	},
	{
		name: "PRO",
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
		price: "$65",
		period: "/mo",
		features: [
			"Unlimited teams",
			"Unlimited members",
			"Unlimited history",
			"Advanced analytics",
			"MCP support",
			"Slack integration (coming soon)",
			"Linear integration (coming soon)",
			"Priority support",
		],
	},
];

const seoUseCases = [
	{
		title: "ASYNC STANDUP SOFTWARE FOR REMOTE TEAMS",
		body: "Collect daily updates across time zones without forcing everyone into the same meeting slot.",
	},
	{
		title: "OPEN SOURCE STANDUP TOOL FOR ENGINEERING ORGS",
		body: "Use DailyStand as an open source standup tool you can run in your own infrastructure.",
	},
	{
		title: "SELF HOSTED STANDUP APP WITH API CONTROL",
		body: "Ship with secure API keys, automation workflows, and MCP integrations under your control.",
	},
];

const seoFaqItems = [
	{
		question: "What is async standup software?",
		answer:
			"Async standup software replaces live daily standup meetings with quick written updates so teams stay aligned without losing focus time.",
	},
	{
		question: "Is DailyStand an open source standup tool?",
		answer:
			"Yes. DailyStand is open source and supports self-hosted deployment so engineering teams can keep full control over data and operations.",
	},
	{
		question: "Can DailyStand automate standups with AI?",
		answer:
			"Yes. DailyStand supports MCP workflows so teams can use AI tools to draft or submit standup updates from existing context.",
	},
	{
		question: "How does DailyStand help Scrum or Agile teams?",
		answer:
			"It keeps daily standup structure (completed, planned, blockers) while reducing meeting overhead and improving team visibility.",
	},
];

function LandingPage() {
	const { data: session } = authClient.useSession();
	const [isHydrated, setIsHydrated] = useState(false);
	useEffect(() => {
		setIsHydrated(true);
	}, []);
	const isLoggedIn = isHydrated && !!session?.user;

	return (
		<div className="min-h-screen bg-ds-bg text-ds-fg selection:bg-ds-selection-bg selection:text-ds-selection-fg font-mono">
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{
					__html: JSON.stringify(homeStructuredData),
				}}
			/>
			{/* Nav */}
				<header className="border-b-[3px] border-ds-border-strong p-3 sm:p-4">
					<div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<div className="flex items-center justify-between gap-3">
							<Terminal className="w-6 h-6 text-ds-accent" />
							<span className="text-xl font-extrabold tracking-tighter">
								DAILYSTAND
							</span>
							<div className="ml-auto sm:hidden">
								<ThemeToggle />
							</div>
						</div>
						<div className="flex flex-wrap items-center gap-2 sm:ml-auto sm:flex-nowrap sm:gap-4">
							<div className="hidden sm:block">
								<ThemeToggle />
							</div>
							<Link to="/docs">
								<button className="whitespace-nowrap text-sm font-bold tracking-wider text-ds-text-tertiary transition-colors hover:text-ds-accent">
									[DOCS]
								</button>
							</Link>
							{isLoggedIn ? (
								<Link to="/app">
									<button className="w-full whitespace-nowrap border-[3px] border-ds-accent bg-ds-accent px-3 py-2 text-sm font-bold tracking-wider text-ds-accent-fg transition-all duration-150 hover:bg-ds-accent-hover sm:w-auto sm:px-6">
										DASHBOARD &rarr;
									</button>
								</Link>
							) : (
								<>
								<Link
									to="/auth/sign-in"
									search={{ invitationId: undefined, email: undefined }}
								>
										<button className="whitespace-nowrap text-sm font-bold tracking-wider text-ds-text-tertiary transition-colors hover:text-ds-fg">
											[SIGN_IN]
										</button>
									</Link>
									<Link
										to="/auth/sign-up"
										search={{ invitationId: undefined, email: undefined }}
									>
										<button className="w-full whitespace-nowrap border-[3px] border-ds-border-strong px-3 py-2 text-sm font-bold tracking-wider transition-all duration-150 hover:bg-ds-border-strong hover:text-ds-bg sm:w-auto sm:px-6">
											GET_STARTED
										</button>
									</Link>
								</>
							)}
					</div>
				</div>
			</header>

			{/* Hero */}
			<section className="border-b-[3px] border-ds-border-strong px-4 py-16 sm:px-6 sm:py-24 md:py-32">
				<div className="max-w-5xl mx-auto">
					<div className="text-ds-accent text-sm font-bold tracking-widest mb-6">
						// ASYNC STANDUPS FOR MODERN TEAMS
					</div>
					<h1 className="text-5xl font-extrabold leading-[0.85] tracking-tighter sm:text-7xl md:text-8xl lg:text-9xl">
						KILL
						<br />
						THE
						<br />
						<span className="text-ds-accent">MEETING</span>
						<span className="animate-pulse text-ds-accent">_</span>
					</h1>
					<blockquote className="mt-8 max-w-4xl border-[3px] border-ds-accent bg-ds-accent/12 p-5 shadow-[0_0_0_3px_var(--ds-border-strong)] sm:mt-10 sm:p-7">
						<div className="mb-3 text-xs font-bold tracking-[0.22em] text-ds-accent">
							// THINK_DIFFERENT
						</div>
						<p className="text-lg font-extrabold leading-snug tracking-tight text-ds-fg sm:text-2xl">
							&quot;The ones who see things differently... they push the human
							race forward. The people who are crazy enough to think they can
							change the world are the ones who do.&quot;
						</p>
						<p className="mt-3 text-[10px] font-bold tracking-widest text-ds-muted sm:text-xs">
							// APPLE AD (1997)
						</p>
					</blockquote>
					<p className="mt-8 max-w-3xl text-base leading-relaxed font-normal text-ds-text-tertiary sm:mt-10 sm:text-lg">
						DailyStand is async standup software built for remote engineering
						teams. Replace awkward daily meetings with quick updates, track
						blockers early, and use standup analytics to keep delivery moving.
					</p>
					<div className="mt-6 inline-flex items-center gap-2 border-[3px] border-ds-accent bg-ds-accent/10 px-4 py-2 text-xs font-extrabold tracking-widest text-ds-accent sm:text-sm">
						<Bot className="h-4 w-4" />
						MCP_SUPPORT // AI CAN GENERATE ALL OF YOUR DAILY_STANDS
					</div>
					<div className="mt-4 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
						<div className="inline-flex items-center gap-2 border-[3px] border-ds-border-strong bg-ds-surface px-4 py-2 text-xs font-extrabold tracking-widest text-ds-fg sm:text-sm">
							<Server className="h-4 w-4 text-ds-accent" />
							OPEN_SOURCE // SELF_HOSTED
						</div>
						<a
							href="https://github.com/nearbycoder/dailystand.dev"
							target="_blank"
							rel="noreferrer"
							className="inline-flex items-center justify-center gap-2 border-[3px] border-ds-border-strong px-4 py-2 text-xs font-extrabold tracking-widest text-ds-text-tertiary transition-colors hover:border-ds-accent hover:text-ds-accent sm:text-sm"
						>
							<Github className="h-4 w-4" />
							VIEW_ON_GITHUB
						</a>
					</div>
					<div className="mt-8 flex w-full gap-4 sm:mt-10 sm:w-auto">
						<Link
							to="/auth/sign-up"
							search={{ invitationId: undefined, email: undefined }}
							className="w-full sm:w-auto"
						>
							<button className="w-full bg-ds-accent px-8 py-4 text-base font-extrabold tracking-wider text-ds-accent-fg transition-colors hover:bg-ds-accent-hover sm:w-auto sm:text-lg">
								START FREE &rarr;
							</button>
						</Link>
					</div>
				</div>
			</section>

			{/* Features */}
			<section className="border-b-[3px] border-ds-border-strong px-4 py-16 sm:px-6 sm:py-20">
				<div className="max-w-6xl mx-auto">
					<h2 className="text-sm font-bold tracking-widest text-ds-muted mb-12">
						// FEATURES
					</h2>
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
						{features.map((feature) => (
							<div
								key={feature.title}
								className="-mt-[3px] border-[3px] border-ds-border-strong p-5 transition-all duration-150 group hover:bg-ds-border-strong hover:text-ds-bg sm:p-6"
							>
								<div className="flex items-center gap-3 mb-4">
									<span className="text-ds-accent group-hover:text-ds-bg transition-colors">
										{feature.icon}
									</span>
									<h3 className="font-extrabold text-sm tracking-wider uppercase">
										{feature.title}
									</h3>
								</div>
								<p className="text-sm text-ds-text-tertiary group-hover:text-ds-bg/70 leading-relaxed">
									{feature.description}
								</p>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* Pricing */}
			<section className="border-b-[3px] border-ds-border-strong px-4 py-16 sm:px-6 sm:py-20">
				<div className="max-w-5xl mx-auto">
					<h2 className="text-sm font-bold tracking-widest text-ds-muted mb-12">
						// PRICING
					</h2>
					<div className="grid grid-cols-1 md:grid-cols-3">
						{plans.map((plan) => (
							<div
								key={plan.name}
								className={`-mt-[3px] flex flex-col border-[3px] border-ds-border-strong p-6 sm:p-8 ${
									plan.popular ? "bg-ds-accent text-ds-accent-fg" : ""
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
								<Link
									to="/auth/sign-up"
									search={{ invitationId: undefined, email: undefined }}
									className="block mt-8"
								>
									<button
										className={`w-full py-3 font-extrabold text-sm tracking-wider transition-all duration-150 ${
											plan.popular
												? "bg-ds-bg text-ds-accent hover:opacity-90"
												: "border-[3px] border-ds-border-strong hover:bg-ds-border-strong hover:text-ds-bg"
										}`}
									>
										GET_STARTED
									</button>
								</Link>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* SEO Use Cases */}
			<section className="border-b-[3px] border-ds-border-strong px-4 py-16 sm:px-6 sm:py-20">
				<div className="mx-auto max-w-6xl">
					<h2 className="mb-4 text-sm font-bold tracking-widest text-ds-muted">
						// WHY TEAMS CHOOSE ASYNC STANDUP SOFTWARE
					</h2>
					<p className="mb-10 max-w-4xl text-sm leading-relaxed text-ds-text-tertiary sm:text-base">
						DailyStand is built to rank for practical buyer intent: async
						standup software, open source standup tool, and self hosted standup
						app. Each workflow is designed for engineering managers and
						individual contributors who need faster daily coordination.
					</p>
					<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
						{seoUseCases.map((item) => (
							<div
								key={item.title}
								className="-mt-[3px] min-w-0 border-[3px] border-ds-border-strong p-5 sm:p-6"
							>
								<h3 className="text-[11px] leading-snug font-extrabold tracking-[0.08em] text-ds-accent [overflow-wrap:anywhere] sm:text-xs sm:tracking-[0.1em]">
									{item.title}
								</h3>
								<p className="mt-3 text-sm leading-relaxed text-ds-text-tertiary">
									{item.body}
								</p>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* Automation Workflows */}
			<section className="border-b-[3px] border-ds-border-strong px-4 py-16 sm:px-6 sm:py-20">
				<div className="mx-auto max-w-6xl">
					<h2 className="mb-4 text-sm font-bold tracking-widest text-ds-muted">
						// STANDUP AUTOMATION + API WORKFLOWS
					</h2>
					<p className="max-w-4xl text-sm leading-relaxed text-ds-text-tertiary sm:text-base">
						If you are evaluating standup automation tools, DailyStand gives you
						a public standup API and MCP server so your team can automate
						updates, exports, and reporting from existing engineering systems.
					</p>
					<div className="mt-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
						<div className="-mt-[3px] min-w-0 border-[3px] border-ds-border-strong p-5 sm:p-6">
							<h3 className="text-[11px] leading-snug font-extrabold tracking-[0.08em] text-ds-accent sm:text-xs sm:tracking-[0.1em]">
								01 // API-DRIVEN STANDUPS
							</h3>
							<p className="mt-3 text-sm leading-relaxed text-ds-text-tertiary">
								Submit standups and query history from your internal scripts or
								platform automation jobs.
							</p>
						</div>
						<div className="-mt-[3px] min-w-0 border-[3px] border-ds-border-strong p-5 sm:p-6">
							<h3 className="text-[11px] leading-snug font-extrabold tracking-[0.08em] text-ds-accent sm:text-xs sm:tracking-[0.1em]">
								02 // MCP + AGENT TOOLS
							</h3>
							<p className="mt-3 text-sm leading-relaxed text-ds-text-tertiary">
								Connect MCP clients to list teams, fetch blockers, and generate
								AI-assisted standup updates.
							</p>
						</div>
						<div className="-mt-[3px] min-w-0 border-[3px] border-ds-border-strong p-5 sm:p-6">
							<h3 className="text-[11px] leading-snug font-extrabold tracking-[0.08em] text-ds-accent sm:text-xs sm:tracking-[0.1em]">
								03 // EXPORT + ANALYTICS
							</h3>
							<p className="mt-3 text-sm leading-relaxed text-ds-text-tertiary">
								Track delivery velocity and export standup analytics as markdown
								or CSV for reporting and planning.
							</p>
						</div>
					</div>
					<div className="mt-8 flex flex-col gap-3 sm:flex-row">
						<Link
							to="/docs"
							className="inline-flex w-full items-center justify-center border-[3px] border-ds-border-strong px-5 py-3 text-xs font-extrabold tracking-widest text-ds-text-tertiary transition-colors hover:border-ds-accent hover:text-ds-accent sm:w-auto sm:text-sm"
						>
							READ API + MCP DOCS
						</Link>
						<Link
							to="/auth/sign-up"
							search={{ invitationId: undefined, email: undefined }}
							className="inline-flex w-full items-center justify-center border-[3px] border-ds-accent bg-ds-accent px-5 py-3 text-xs font-extrabold tracking-widest text-ds-accent-fg transition-colors hover:bg-ds-accent-hover sm:w-auto sm:text-sm"
						>
							START FREE
						</Link>
					</div>
				</div>
			</section>

			{/* SEO FAQ */}
			<section className="border-b-[3px] border-ds-border-strong px-4 py-16 sm:px-6 sm:py-20">
				<div className="mx-auto max-w-6xl">
					<h2 className="mb-4 text-sm font-bold tracking-widest text-ds-muted">
						// FAQ
					</h2>
					<p className="mb-10 max-w-4xl text-sm leading-relaxed text-ds-text-tertiary sm:text-base">
						Common questions from teams looking for daily standup software and
						async Scrum tooling.
					</p>
					<div className="space-y-0">
						{seoFaqItems.map((item) => (
							<section
								key={item.question}
								className="-mt-[3px] border-[3px] border-ds-border-strong p-5 sm:p-6"
							>
								<h3 className="text-sm font-extrabold tracking-wider text-ds-accent sm:text-base">
									{item.question}
								</h3>
								<p className="mt-3 text-sm leading-relaxed text-ds-text-tertiary sm:text-base">
									{item.answer}
								</p>
							</section>
						))}
					</div>
				</div>
			</section>

			{/* Footer */}
			<footer className="px-4 py-8 sm:px-6">
				<div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-3 text-sm text-ds-muted sm:flex-row sm:items-center">
					<div className="flex items-center gap-2 font-bold">
						<Terminal className="w-4 h-4 text-ds-accent" />
						DAILYSTAND
					</div>
					<div className="flex flex-wrap items-center gap-3">
						<Link
							to="/privacy"
							className="font-bold tracking-wider text-ds-muted transition-colors hover:text-ds-accent"
						>
							PRIVACY
						</Link>
						<span className="text-ds-muted2">/</span>
						<Link
							to="/terms"
							className="font-bold tracking-wider text-ds-muted transition-colors hover:text-ds-accent"
						>
							TERMS
						</Link>
						<span className="text-ds-muted2 hidden sm:inline">|</span>
						<span>
							&copy; {new Date().getFullYear()} // ALL RIGHTS RESERVED
						</span>
					</div>
				</div>
			</footer>
		</div>
	);
}
