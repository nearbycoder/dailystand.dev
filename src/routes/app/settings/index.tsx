import { createFileRoute, Link } from "@tanstack/react-router"
import { useTRPC } from "@/integrations/trpc/react"
import { useQuery } from "@tanstack/react-query"
import { CreditCard, Users, Users2 } from "lucide-react"

export const Route = createFileRoute("/app/settings/")({
	component: SettingsIndex,
})

function SettingsIndex() {
	const trpc = useTRPC()
	const { data: org } = useQuery(trpc.org.getDetails.queryOptions())
	const { data: sub } = useQuery(trpc.org.getSubscription.queryOptions())

	return (
		<div className="p-6 max-w-3xl">
			<div className="mb-8">
				<h1 className="text-3xl font-extrabold tracking-tighter">SETTINGS</h1>
				<p className="text-ds-muted text-sm mt-1">
					// MANAGE {org?.name?.toUpperCase() ?? "YOUR ORG"}
				</p>
			</div>

			{/* Org Info */}
			<div className="border-[3px] border-ds-border p-6 mb-6">
				<h2 className="text-sm font-bold tracking-widest text-ds-muted mb-6">
					// ORGANIZATION
				</h2>
				<div className="space-y-3">
					<div className="flex justify-between items-center py-2 border-b border-ds-border">
						<span className="text-ds-muted text-sm">NAME</span>
						<span className="font-bold text-sm">{org?.name}</span>
					</div>
					<div className="flex justify-between items-center py-2 border-b border-ds-border">
						<span className="text-ds-muted text-sm">SLUG</span>
						<span className="text-ds-text-secondary text-sm">{org?.slug}</span>
					</div>
					<div className="flex justify-between items-center py-2">
						<span className="text-ds-muted text-sm">PLAN</span>
						<span className="text-ds-accent font-extrabold text-sm tracking-wider uppercase">
							{sub?.plan ?? "FREE"}
						</span>
					</div>
				</div>
			</div>

			{/* Quick Links */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-0">
				<Link to="/app/settings/billing">
					<div className="border-[3px] border-ds-border -ml-0 md:-ml-[3px] first:ml-0 p-6 hover:bg-ds-surface hover:border-ds-muted2 transition-all cursor-pointer group">
						<CreditCard className="w-6 h-6 text-ds-accent mb-3" />
						<div className="font-extrabold text-sm tracking-wider">
							BILLING
						</div>
						<div className="text-ds-muted text-xs mt-1">
							Plan &amp; payment
						</div>
					</div>
				</Link>
				<Link to="/app/settings/members">
					<div className="border-[3px] border-ds-border -ml-0 md:-ml-[3px] -mt-[3px] md:mt-0 p-6 hover:bg-ds-surface hover:border-ds-muted2 transition-all cursor-pointer group">
						<Users className="w-6 h-6 text-cyan-500 dark:text-cyan-400 mb-3" />
						<div className="font-extrabold text-sm tracking-wider">
							MEMBERS
						</div>
						<div className="text-ds-muted text-xs mt-1">
							Invite &amp; manage
						</div>
					</div>
				</Link>
				<Link to="/app/settings/teams">
					<div className="border-[3px] border-ds-border -ml-0 md:-ml-[3px] -mt-[3px] md:mt-0 p-6 hover:bg-ds-surface hover:border-ds-muted2 transition-all cursor-pointer group">
						<Users2 className="w-6 h-6 text-yellow-500 dark:text-yellow-400 mb-3" />
						<div className="font-extrabold text-sm tracking-wider">TEAMS</div>
						<div className="text-ds-muted text-xs mt-1">
							Create &amp; manage
						</div>
					</div>
				</Link>
			</div>
		</div>
	)
}
