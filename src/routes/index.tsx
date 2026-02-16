import { createFileRoute, Link } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import { ThemeToggle } from "@/components/theme-toggle";
import {
	Check,
	ArrowRight,
	Terminal,
	Users,
	BarChart3,
	Clock,
	Shield,
	Zap,
	Bot,
	Github,
	Server,
} from "lucide-react";

export const Route = createFileRoute("/")({
	component: LandingPage,
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
];

const plans = [
	{
		name: "FREE",
		price: "$0",
		period: "/forever",
		features: ["1 team", "5 members", "7-day history"],
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
			"Slack integration (coming soon)",
			"Linear integration (coming soon)",
			"Priority support",
		],
	},
];

function LandingPage() {
	const { data: session } = authClient.useSession();
	const isLoggedIn = !!session?.user;

	return (
		<div className="min-h-screen bg-ds-bg text-ds-fg selection:bg-ds-selection-bg selection:text-ds-selection-fg font-mono">
			{/* Nav */}
			<header className="border-b-[3px] border-ds-border-strong p-3 sm:p-4">
				<div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
					<div className="flex items-center gap-3">
						<Terminal className="w-6 h-6 text-ds-accent" />
						<span className="text-xl font-extrabold tracking-tighter">
							DAILYSTAND
						</span>
					</div>
					<div className="ml-auto flex items-center gap-2 sm:gap-4">
						<ThemeToggle />
						{isLoggedIn ? (
							<Link to="/app">
								<button className="border-[3px] border-ds-accent bg-ds-accent px-3 py-2 text-sm font-bold tracking-wider text-ds-accent-fg transition-all duration-150 hover:bg-ds-accent-hover sm:px-6">
									DASHBOARD &rarr;
								</button>
							</Link>
						) : (
							<>
								<Link to="/auth/sign-in">
									<button className="text-sm font-bold tracking-wider text-ds-text-tertiary transition-colors hover:text-ds-fg">
										[SIGN_IN]
									</button>
								</Link>
								<Link to="/auth/sign-up">
									<button className="border-[3px] border-ds-border-strong px-3 py-2 text-sm font-bold tracking-wider transition-all duration-150 hover:bg-ds-border-strong hover:text-ds-bg sm:px-6">
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
					<p className="mt-8 max-w-xl text-base leading-relaxed font-normal text-ds-text-tertiary sm:mt-10 sm:text-lg">
						Replace awkward daily meetings with quick async updates. Keep your
						team aligned, identify blockers early, and ship faster.
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
						<Link to="/auth/sign-up" className="w-full sm:w-auto">
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
								<Link to="/auth/sign-up" className="block mt-8">
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
						<span>&copy; {new Date().getFullYear()} // ALL RIGHTS RESERVED</span>
					</div>
				</div>
			</footer>
		</div>
	);
}
