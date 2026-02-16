import {
	createFileRoute,
	Link,
	Outlet,
	useNavigate,
} from "@tanstack/react-router"
import { authClient } from "@/lib/auth-client"
import { useState } from "react"
import {
	LayoutDashboard,
	PenSquare,
	Users,
	History,
	Settings,
	LogOut,
	Plus,
	Terminal,
} from "lucide-react"
import { useTRPC } from "@/integrations/trpc/react"
import { useQuery } from "@tanstack/react-query"
import { ThemeToggle } from "@/components/theme-toggle"

export const Route = createFileRoute("/app")({
	component: AppLayout,
})

function AppLayout() {
	const { data: session, isPending } = authClient.useSession()
	const navigate = useNavigate()

	if (isPending) {
		return (
			<div className="min-h-screen bg-ds-bg text-ds-fg font-mono flex items-center justify-center">
				<span className="text-ds-accent animate-pulse">LOADING...</span>
			</div>
		)
	}

	if (!session?.user) {
		navigate({ to: "/auth/sign-in" })
		return null
	}

	const activeOrgId = session.session.activeOrganizationId

	if (!activeOrgId) {
		return <OrgSetup />
	}

	return <AppShell session={session} />
}

function OrgSetup() {
	const [orgName, setOrgName] = useState("")
	const [orgSlug, setOrgSlug] = useState("")
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState("")
	const { data: orgs } = authClient.useListOrganizations()

	const handleCreate = async (e: React.FormEvent) => {
		e.preventDefault()
		setLoading(true)
		setError("")

		const result = await authClient.organization.create({
			name: orgName,
			slug: orgSlug || orgName.toLowerCase().replace(/\s+/g, "-"),
		})

		if (result.error) {
			setError(result.error.message ?? "Failed to create organization")
			setLoading(false)
			return
		}

		await authClient.organization.setActive({
			organizationId: result.data.id,
		})
		window.location.reload()
	}

	const handleSelect = async (orgId: string) => {
		await authClient.organization.setActive({ organizationId: orgId })
		window.location.reload()
	}

	return (
		<div className="min-h-screen bg-ds-bg text-ds-fg selection:bg-ds-selection-bg selection:text-ds-selection-fg font-mono flex items-center justify-center p-6">
			<div className="w-full max-w-md">
				<div className="flex items-center gap-3 mb-10">
					<Terminal className="w-6 h-6 text-ds-accent" />
					<span className="text-xl font-extrabold tracking-tighter">
						DAILYSTAND
					</span>
				</div>

				<div className="border-[3px] border-ds-border-strong p-8">
					<h1 className="text-2xl font-extrabold tracking-tighter mb-2">
						{orgs && orgs.length > 0 ? "SELECT_ORG" : "CREATE_ORG"}
					</h1>
					<p className="text-sm text-ds-muted mb-8">
						// set up your workspace
					</p>

					{orgs && orgs.length > 0 && (
						<div className="space-y-2 mb-8">
							{orgs.map((org) => (
								<button
									key={org.id}
									onClick={() => handleSelect(org.id)}
									className="w-full flex items-center gap-3 p-3 border-[3px] border-ds-muted3 hover:border-ds-accent hover:bg-ds-accent/5 transition-all text-left"
								>
									<div className="w-8 h-8 bg-ds-accent text-ds-accent-fg flex items-center justify-center font-extrabold text-sm">
										{org.name.charAt(0)}
									</div>
									<div>
										<div className="font-bold text-sm">{org.name}</div>
										<div className="text-ds-muted text-xs">{org.slug}</div>
									</div>
								</button>
							))}
							<div className="text-center text-ds-muted2 text-xs font-bold tracking-widest py-4">
								// OR CREATE NEW
							</div>
						</div>
					)}

					<form onSubmit={handleCreate} className="space-y-6">
						{error && (
							<div className="border-[3px] border-red-500 bg-red-500/10 p-3 text-red-400 text-sm font-bold">
								ERROR: {error}
							</div>
						)}
						<div>
							<label className="block text-xs font-bold tracking-widest text-ds-text-tertiary mb-2">
								ORG_NAME
							</label>
							<input
								placeholder="Acme Corp"
								value={orgName}
								onChange={(e) => {
									setOrgName(e.target.value)
									setOrgSlug(
										e.target.value.toLowerCase().replace(/\s+/g, "-"),
									)
								}}
								required
								className="w-full bg-ds-input-bg border-[3px] border-ds-muted3 px-4 py-3 text-ds-fg font-mono text-sm focus:border-ds-accent focus:outline-none transition-colors placeholder:text-ds-muted2"
							/>
						</div>
						<div>
							<label className="block text-xs font-bold tracking-widest text-ds-text-tertiary mb-2">
								SLUG
							</label>
							<input
								placeholder="acme-corp"
								value={orgSlug}
								onChange={(e) => setOrgSlug(e.target.value)}
								required
								className="w-full bg-ds-input-bg border-[3px] border-ds-muted3 px-4 py-3 text-ds-fg font-mono text-sm focus:border-ds-accent focus:outline-none transition-colors placeholder:text-ds-muted2"
							/>
						</div>
						<button
							type="submit"
							disabled={loading}
							className="w-full bg-ds-accent text-ds-accent-fg py-3 font-extrabold text-sm tracking-wider hover:bg-ds-accent-hover transition-colors disabled:opacity-50"
						>
							<Plus className="w-4 h-4 inline mr-2" />
							{loading ? "CREATING..." : "CREATE_ORG"}
						</button>
					</form>
				</div>
			</div>
		</div>
	)
}

function AppShell({
	session,
}: { session: NonNullable<ReturnType<typeof authClient.useSession>["data"]> }) {
	const navigate = useNavigate()
	const trpc = useTRPC()
	const { data: teams } = useQuery(trpc.teams.list.queryOptions())

	const handleSignOut = async () => {
		await authClient.signOut()
		navigate({ to: "/" })
	}

	return (
		<div className="min-h-screen bg-ds-bg text-ds-fg selection:bg-ds-selection-bg selection:text-ds-selection-fg font-mono flex">
			{/* Sidebar */}
			<aside className="w-56 border-r-[3px] border-ds-border-strong flex flex-col shrink-0">
				{/* Logo */}
				<div className="p-4 border-b-[3px] border-ds-border-strong">
					<Link to="/app" className="flex items-center gap-2">
						<Terminal className="w-5 h-5 text-ds-accent" />
						<span className="font-extrabold tracking-tighter">DAILYSTAND</span>
					</Link>
				</div>

				{/* Nav */}
				<nav className="flex-1 py-2">
					<NavLink to="/app" icon={LayoutDashboard} label="DASHBOARD" exact />
					<NavLink to="/app/standup" icon={PenSquare} label="STANDUP" />
					<NavLink to="/app/history" icon={History} label="HISTORY" />

					{teams && teams.length > 0 && (
						<>
							<div className="px-4 py-3 text-xs font-bold text-ds-muted2 tracking-widest">
								// TEAMS
							</div>
							{teams.map((team) => (
								<NavLink
									key={team.id}
									to="/app/team/$teamId"
									params={{ teamId: team.id }}
									icon={Users}
									label={team.name.toUpperCase()}
								/>
							))}
						</>
					)}

					<div className="px-4 py-3 text-xs font-bold text-ds-muted2 tracking-widest">
						// CONFIG
					</div>
					<NavLink to="/app/settings" icon={Settings} label="SETTINGS" />
				</nav>

				{/* Theme + User */}
				<div className="border-t-[3px] border-ds-border-strong p-3 space-y-3">
					<ThemeToggle />
					<div className="flex items-center gap-2">
						<div className="w-7 h-7 bg-ds-accent text-ds-accent-fg flex items-center justify-center font-extrabold text-xs">
							{session.user.name?.charAt(0).toUpperCase() ?? "U"}
						</div>
						<div className="flex-1 min-w-0">
							<div className="text-xs font-bold truncate">
								{session.user.name}
							</div>
							<div className="text-[10px] text-ds-muted truncate">
								{session.user.email}
							</div>
						</div>
					</div>
					<button
						onClick={handleSignOut}
						className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-bold text-ds-muted hover:text-red-400 transition-colors"
					>
						<LogOut className="w-3 h-3" />
						[SIGN_OUT]
					</button>
				</div>
			</aside>

			{/* Main */}
			<main className="flex-1 overflow-auto">
				<Outlet />
			</main>
		</div>
	)
}

function NavLink({
	to,
	params,
	icon: Icon,
	label,
	exact,
}: {
	to: string
	params?: Record<string, string>
	icon: React.ComponentType<{ className?: string }>
	label: string
	exact?: boolean
}) {
	return (
		<Link
			to={to}
			params={params as any}
			activeOptions={{ exact }}
			className="flex items-center gap-3 px-4 py-2.5 text-xs font-bold tracking-wider text-ds-text-tertiary hover:text-ds-fg hover:bg-ds-surface transition-all"
			activeProps={{
				className:
					"flex items-center gap-3 px-4 py-2.5 text-xs font-bold tracking-wider text-ds-accent bg-ds-accent/5 border-l-[3px] border-ds-accent",
			}}
		>
			<Icon className="w-4 h-4" />
			{label}
		</Link>
	)
}
