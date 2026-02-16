import { createFileRoute, Link } from "@tanstack/react-router"
import { authClient } from "@/lib/auth-client"
import { ThemeToggle } from "@/components/theme-toggle"
import {
	Check,
	ArrowRight,
	Terminal,
	Users,
	BarChart3,
	Clock,
	Shield,
	Zap,
} from "lucide-react"

export const Route = createFileRoute("/")({
	component: LandingPage,
})

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
		title: "Integrations",
		description:
			"Connect with Slack, email digests, and more on Business plans.",
	},
]

const plans = [
	{
		name: "FREE",
		price: "$0",
		period: "/forever",
		features: ["1 team", "5 members", "7-day history"],
	},
	{
		name: "PRO",
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

function LandingPage() {
	const { data: session } = authClient.useSession()
	const isLoggedIn = !!session?.user

	return (
		<div className="min-h-screen bg-ds-bg text-ds-fg selection:bg-ds-selection-bg selection:text-ds-selection-fg font-mono">
			{/* Nav */}
			<header className="border-b-[3px] border-ds-border-strong p-4">
				<div className="max-w-6xl mx-auto flex items-center justify-between">
					<div className="flex items-center gap-3">
						<Terminal className="w-6 h-6 text-ds-accent" />
						<span className="text-xl font-extrabold tracking-tighter">
							DAILYSTAND
						</span>
					</div>
					<div className="flex items-center gap-4">
						<ThemeToggle />
						{isLoggedIn ? (
							<Link to="/app">
								<button className="border-[3px] border-ds-accent bg-ds-accent text-ds-accent-fg px-6 py-2 font-bold text-sm tracking-wider hover:bg-ds-accent-hover transition-all duration-150">
									DASHBOARD &rarr;
								</button>
							</Link>
						) : (
							<>
								<Link to="/auth/sign-in">
									<button className="text-sm font-bold tracking-wider text-ds-text-tertiary hover:text-ds-fg transition-colors">
										[SIGN_IN]
									</button>
								</Link>
								<Link to="/auth/sign-up">
									<button className="border-[3px] border-ds-border-strong px-6 py-2 font-bold text-sm tracking-wider hover:bg-ds-border-strong hover:text-ds-bg transition-all duration-150">
										GET_STARTED
									</button>
								</Link>
							</>
						)}
					</div>
				</div>
			</header>

			{/* Hero */}
			<section className="py-32 px-6 border-b-[3px] border-ds-border-strong">
				<div className="max-w-5xl mx-auto">
					<div className="text-ds-accent text-sm font-bold tracking-widest mb-6">
						// ASYNC STANDUPS FOR MODERN TEAMS
					</div>
					<h1 className="text-6xl md:text-8xl lg:text-9xl font-extrabold leading-[0.85] tracking-tighter">
						KILL
						<br />
						THE
						<br />
						<span className="text-ds-accent">MEETING</span>
						<span className="animate-pulse text-ds-accent">_</span>
					</h1>
					<p className="mt-10 text-lg text-ds-text-tertiary max-w-xl leading-relaxed font-normal">
						Replace awkward daily meetings with quick async updates. Keep your
						team aligned, identify blockers early, and ship faster.
					</p>
					<div className="mt-10 flex gap-4">
						<Link to="/auth/sign-up">
							<button className="bg-ds-accent text-ds-accent-fg px-8 py-4 font-extrabold text-lg tracking-wider hover:bg-ds-accent-hover transition-colors">
								START FREE &rarr;
							</button>
						</Link>
					</div>
				</div>
			</section>

			{/* Features */}
			<section className="py-20 px-6 border-b-[3px] border-ds-border-strong">
				<div className="max-w-6xl mx-auto">
					<h2 className="text-sm font-bold tracking-widest text-ds-muted mb-12">
						// FEATURES
					</h2>
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
						{features.map((feature) => (
							<div
								key={feature.title}
								className="border-[3px] border-ds-border-strong p-6 -mt-[3px] -ml-[3px] hover:bg-ds-border-strong hover:text-ds-bg transition-all duration-150 group"
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
			<section className="py-20 px-6 border-b-[3px] border-ds-border-strong">
				<div className="max-w-5xl mx-auto">
					<h2 className="text-sm font-bold tracking-widest text-ds-muted mb-12">
						// PRICING
					</h2>
					<div className="grid grid-cols-1 md:grid-cols-3">
						{plans.map((plan) => (
							<div
								key={plan.name}
								className={`border-[3px] border-ds-border-strong -mt-[3px] -ml-[3px] p-8 flex flex-col ${
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
									<span className="text-5xl font-extrabold">{plan.price}</span>
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
			<footer className="py-8 px-6">
				<div className="max-w-6xl mx-auto flex items-center justify-between text-sm text-ds-muted">
					<div className="flex items-center gap-2 font-bold">
						<Terminal className="w-4 h-4 text-ds-accent" />
						DAILYSTAND
					</div>
					<span>&copy; {new Date().getFullYear()} // ALL RIGHTS RESERVED</span>
				</div>
			</footer>
		</div>
	)
}
