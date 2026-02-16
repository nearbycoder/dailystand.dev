import { createFileRoute, Link } from "@tanstack/react-router"
import { useTRPC } from "@/integrations/trpc/react"
import { useQuery } from "@tanstack/react-query"
import {
	PenSquare,
	CheckCircle2,
	Target,
	AlertTriangle,
	ArrowRight,
} from "lucide-react"

export const Route = createFileRoute("/app/")({
	component: Dashboard,
})

function Dashboard() {
	const trpc = useTRPC()
	const today = new Date().toISOString().split("T")[0]
	const { data: standups, isLoading } = useQuery(
		trpc.standups.getByDate.queryOptions({ date: today }),
	)
	const { data: hasSubmitted } = useQuery(
		trpc.standups.hasSubmittedToday.queryOptions(),
	)

	const formattedDate = new Date().toLocaleDateString("en-US", {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
	})

	return (
		<div className="p-6 max-w-4xl">
			{/* Header */}
			<div className="mb-8">
				<h1 className="text-3xl font-extrabold tracking-tighter">DASHBOARD</h1>
				<p className="text-ds-muted text-sm mt-1">
					// {formattedDate.toUpperCase()}
				</p>
			</div>

			{/* CTA Banner */}
			{!hasSubmitted && (
				<div className="border-[3px] border-ds-accent bg-ds-accent/5 p-6 mb-8 flex items-center justify-between">
					<div className="flex items-center gap-4">
						<div className="w-10 h-10 bg-ds-accent text-ds-accent-fg flex items-center justify-center">
							<PenSquare className="w-5 h-5" />
						</div>
						<div>
							<h3 className="font-extrabold text-sm tracking-wider">
								STANDUP_PENDING
							</h3>
							<p className="text-ds-muted text-xs mt-1">
								You haven't submitted your standup today.
							</p>
						</div>
					</div>
					<Link to="/app/standup">
						<button className="bg-ds-accent text-ds-accent-fg px-6 py-2.5 font-extrabold text-sm tracking-wider hover:bg-ds-accent-hover transition-colors flex items-center gap-2">
							SUBMIT
							<ArrowRight className="w-4 h-4" />
						</button>
					</Link>
				</div>
			)}

			{/* Today's Standups */}
			<div>
				<h2 className="text-sm font-bold tracking-widest text-ds-muted mb-6">
					// TODAY'S STANDUPS
				</h2>
				{isLoading ? (
					<div className="space-y-4">
						{[1, 2, 3].map((i) => (
							<div
								key={i}
								className="border-[3px] border-ds-border p-6 h-32 animate-pulse"
							/>
						))}
					</div>
				) : standups && standups.length > 0 ? (
					<div className="space-y-0">
						{standups.map((standup) => (
							<StandupCard key={standup.user.id} standup={standup} />
						))}
					</div>
				) : (
					<div className="border-[3px] border-ds-border p-12 text-center">
						<p className="text-ds-muted text-sm">
							NO_STANDUPS_YET // Be the first to submit.
						</p>
					</div>
				)}
			</div>
		</div>
	)
}

function StandupCard({
	standup,
}: {
	standup: {
		user: { id: string; name: string; image: string | null }
		completed: string[]
		planned: string[]
		blockers: string[]
	}
}) {
	return (
		<div className="border-[3px] border-ds-border -mt-[3px] p-6 hover:border-ds-muted2 transition-colors group">
			<div className="flex items-center gap-3 mb-4">
				<div className="w-8 h-8 bg-ds-accent text-ds-accent-fg flex items-center justify-center font-extrabold text-xs">
					{standup.user.name
						.split(" ")
						.map((n) => n[0])
						.join("")
						.toUpperCase()}
				</div>
				<span className="font-extrabold text-sm tracking-wider">
					{standup.user.name.toUpperCase()}
				</span>
			</div>

			<div className="space-y-4 pl-11">
				{standup.completed.length > 0 && (
					<div>
						<div className="flex items-center gap-2 mb-2">
							<CheckCircle2 className="w-4 h-4 text-lime-500 dark:text-lime-400" />
							<span className="text-xs font-bold tracking-widest text-lime-600 dark:text-lime-400">
								COMPLETED
							</span>
						</div>
						<ul className="space-y-1">
							{standup.completed.map((item, i) => (
								<li key={i} className="text-sm text-ds-text-secondary pl-6">
									&gt; {item}
								</li>
							))}
						</ul>
					</div>
				)}
				{standup.planned.length > 0 && (
					<div>
						<div className="flex items-center gap-2 mb-2">
							<Target className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
							<span className="text-xs font-bold tracking-widest text-cyan-600 dark:text-cyan-400">
								PLANNED
							</span>
						</div>
						<ul className="space-y-1">
							{standup.planned.map((item, i) => (
								<li key={i} className="text-sm text-ds-text-secondary pl-6">
									&gt; {item}
								</li>
							))}
						</ul>
					</div>
				)}
				{standup.blockers.length > 0 && (
					<div>
						<div className="flex items-center gap-2 mb-2">
							<AlertTriangle className="w-4 h-4 text-red-500 dark:text-red-400" />
							<span className="text-xs font-bold tracking-widest text-red-500 dark:text-red-400">
								BLOCKERS
							</span>
						</div>
						<ul className="space-y-1">
							{standup.blockers.map((item, i) => (
								<li key={i} className="text-sm text-ds-text-secondary pl-6">
									! {item}
								</li>
							))}
						</ul>
					</div>
				)}
			</div>
		</div>
	)
}
