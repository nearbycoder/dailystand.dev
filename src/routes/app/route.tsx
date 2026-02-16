import {
	createFileRoute,
	Link,
	Outlet,
	useNavigate,
} from "@tanstack/react-router"
import { authClient } from "@/lib/auth-client"
import { useMemo, useState } from "react"
import {
	LayoutDashboard,
	BarChart3,
	PenSquare,
	Users,
	History,
	Settings,
	LogOut,
	Plus,
	Terminal,
	Menu,
} from "lucide-react"
import { useTRPC } from "@/integrations/trpc/react"
import { useQuery } from "@tanstack/react-query"
import { ThemeToggle } from "@/components/theme-toggle"
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet"

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
		navigate({
			to: "/auth/sign-in",
			search: { invitationId: undefined, email: undefined },
		})
		return null
	}

	const activeOrgId = session.session.activeOrganizationId

	if (!activeOrgId) {
		return <OrgSetup />
	}

	return <AppShell session={session} />
}

function OrgSetup() {
	const trpc = useTRPC()
	const [orgName, setOrgName] = useState("")
	const [orgSlug, setOrgSlug] = useState("")
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState("")
	const { data: orgs } = authClient.useListOrganizations()
	const { data: memberships } = useQuery(
		trpc.org.listMyMemberships.queryOptions(),
	)
	const organizations = orgs ?? []
	const hasOrganizations = organizations.length > 0
	const canCreateOrganization =
		(memberships?.length ?? 0) === 0 ||
		(memberships ?? []).some((membership) => membership.canManageOrganization)

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
		<div className="min-h-screen bg-ds-bg text-ds-fg selection:bg-ds-selection-bg selection:text-ds-selection-fg font-mono flex items-center justify-center p-4 sm:p-6">
			<div className="w-full max-w-md">
				<div className="mb-8 flex items-center gap-3 sm:mb-10">
					<Terminal className="w-6 h-6 text-ds-accent" />
					<span className="text-xl font-extrabold tracking-tighter">
						DAILYSTAND
					</span>
				</div>

				<div className="border-[3px] border-ds-border-strong p-6 sm:p-8">
					<h1 className="mb-2 text-2xl font-extrabold tracking-tighter">
						{hasOrganizations ? "SELECT_ORG" : "CREATE_ORG"}
					</h1>
					<p className="mb-8 text-sm text-ds-muted">
						// set up your workspace
					</p>

					{hasOrganizations && (
						<div className="space-y-2 mb-8">
							{organizations.map((org) => (
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
							{canCreateOrganization ? (
								<div className="text-center text-ds-muted2 text-xs font-bold tracking-widest py-4">
									// OR CREATE NEW
								</div>
							) : (
								<div className="text-center text-ds-muted2 text-xs font-bold tracking-widest py-4">
									// MEMBER_ACCESS: CONTACT OWNER/ADMIN TO CREATE ORGS
								</div>
							)}
						</div>
					)}

					{canCreateOrganization ? (
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
					) : null}
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
	const { data: orgMembers } = useQuery(trpc.org.listMembers.queryOptions())
	const [mobileNavOpen, setMobileNavOpen] = useState(false)
	const viewerId = session.user.id

	const canViewAllTeams = useMemo(() => {
		const currentMember = (orgMembers ?? []).find(
			(member) => member.userId === viewerId,
		)
		if (!currentMember?.role) return false
		const roleParts = currentMember.role
			.split(",")
			.map((part) => part.trim().toLowerCase())
			.filter(Boolean)
		return roleParts.includes("owner") || roleParts.includes("admin")
	}, [orgMembers, viewerId])

	const handleSignOut = async () => {
		await authClient.signOut()
		navigate({ to: "/" })
	}

	const closeMobileNav = () => setMobileNavOpen(false)

	return (
		<div className="min-h-screen bg-ds-bg text-ds-fg selection:bg-ds-selection-bg selection:text-ds-selection-fg font-mono md:flex md:h-svh md:overflow-hidden">
			{/* Sidebar */}
			<aside className="hidden w-56 shrink-0 flex-col border-r-[3px] border-ds-border-strong md:flex md:h-svh md:max-h-svh md:overflow-hidden">
				<SidebarContent
					session={session}
					teams={teams}
					viewerId={viewerId}
					canViewAllTeams={canViewAllTeams}
					onSignOut={handleSignOut}
				/>
			</aside>

			<div className="flex min-w-0 flex-1 flex-col md:min-h-0">
				<header className="sticky top-0 z-30 flex items-center justify-between border-b-[3px] border-ds-border-strong bg-ds-bg px-4 py-3 md:hidden">
					<button
						type="button"
						onClick={() => setMobileNavOpen(true)}
						className="flex items-center gap-2 border-[3px] border-ds-border px-2.5 py-1.5 text-xs font-extrabold tracking-widest text-ds-fg transition-colors hover:border-ds-accent hover:text-ds-accent"
					>
						<Menu className="h-4 w-4" />
						MENU
					</button>
					<Link to="/app" className="flex items-center gap-2">
						<Terminal className="w-5 h-5 text-ds-accent" />
						<span className="font-extrabold tracking-tighter">DAILYSTAND</span>
					</Link>
				</header>

				<Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
					<SheetContent
						side="left"
						showCloseButton={false}
						className="w-[85vw] max-w-xs border-r-[3px] border-ds-border-strong bg-ds-bg p-0 text-ds-fg"
					>
						<SheetHeader className="sr-only">
							<SheetTitle>Navigation</SheetTitle>
							<SheetDescription>Primary app navigation</SheetDescription>
						</SheetHeader>
						<div className="flex h-full flex-col">
							<SidebarContent
								session={session}
								teams={teams}
								viewerId={viewerId}
								canViewAllTeams={canViewAllTeams}
								onSignOut={handleSignOut}
								onNavigate={closeMobileNav}
							/>
						</div>
					</SheetContent>
				</Sheet>

				{/* Main */}
				<main className="min-h-0 min-w-0 flex-1 overflow-auto">
					<Outlet />
				</main>
			</div>
		</div>
	)
}

function SidebarContent({
	session,
	teams,
	viewerId,
	canViewAllTeams,
	onSignOut,
	onNavigate,
}: {
	session: NonNullable<ReturnType<typeof authClient.useSession>["data"]>
	teams:
		| {
				id: string
				name: string
				members?: {
					id: string
					name: string
					image: string | null
				}[]
		  }[]
		| undefined
	viewerId: string
	canViewAllTeams: boolean
	onSignOut: () => Promise<void>
	onNavigate?: () => void
}) {
	const myTeams = useMemo(() => {
		if (!teams || teams.length === 0) return []
		return teams.filter((team) =>
			team.members?.some((member) => member.id === viewerId),
		)
	}, [teams, viewerId])
	const otherTeams = useMemo(() => {
		if (!teams || teams.length === 0) return []
		const myTeamIds = new Set(myTeams.map((team) => team.id))
		return teams.filter((team) => !myTeamIds.has(team.id))
	}, [teams, myTeams])

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="border-b-[3px] border-ds-border-strong p-4">
				<Link to="/app" className="flex items-center gap-2" onClick={onNavigate}>
					<Terminal className="h-5 w-5 text-ds-accent" />
					<span className="font-extrabold tracking-tighter">DAILYSTAND</span>
				</Link>
			</div>

			<nav className="min-h-0 flex-1 overflow-y-auto py-2">
				<NavLink
					to="/app"
					icon={LayoutDashboard}
					label="DASHBOARD"
					exact
					onNavigate={onNavigate}
				/>
				<NavLink
					to="/app/analytics"
					icon={BarChart3}
					label="ANALYTICS"
					onNavigate={onNavigate}
				/>
				<NavLink
					to="/app/standup"
					icon={PenSquare}
					label="STANDUP"
					onNavigate={onNavigate}
				/>
				<NavLink
					to="/app/history"
					icon={History}
					label="HISTORY"
					onNavigate={onNavigate}
				/>

				{myTeams.length > 0 && (
					<>
						<div className="px-4 py-3 text-xs font-bold tracking-widest text-ds-muted2">
							// MY_TEAMS
						</div>
						{myTeams.map((team) => (
							<NavLink
								key={`my-${team.id}`}
								to="/app/team/$teamId"
								params={{ teamId: team.id }}
								icon={Users}
								label={team.name.toUpperCase()}
								onNavigate={onNavigate}
							/>
						))}
					</>
				)}
					{canViewAllTeams && otherTeams.length > 0 && (
						<>
							<div className="px-4 py-3 text-xs font-bold tracking-widest text-ds-muted2">
								// ALL_TEAMS
							</div>
							{otherTeams.map((team) => (
								<NavLink
									key={`all-${team.id}`}
									to="/app/team/$teamId"
								params={{ teamId: team.id }}
								icon={Users}
								label={team.name.toUpperCase()}
								onNavigate={onNavigate}
							/>
						))}
					</>
				)}

				<div className="px-4 py-3 text-xs font-bold tracking-widest text-ds-muted2">
					// CONFIG
				</div>
				<NavLink
					to="/app/settings"
					icon={Settings}
					label="SETTINGS"
					onNavigate={onNavigate}
				/>
			</nav>

			<div className="shrink-0 space-y-3 border-t-[3px] border-ds-border-strong p-3">
				<ThemeToggle />
				<div className="flex items-center gap-2">
					<div className="flex h-7 w-7 items-center justify-center bg-ds-accent text-xs font-extrabold text-ds-accent-fg">
						{session.user.name?.charAt(0).toUpperCase() ?? "U"}
					</div>
					<div className="min-w-0 flex-1">
						<div className="truncate text-xs font-bold">{session.user.name}</div>
						<div className="truncate text-[10px] text-ds-muted">
							{session.user.email}
						</div>
					</div>
				</div>
				<button
					onClick={async () => {
						onNavigate?.()
						await onSignOut()
					}}
					className="flex w-full items-center gap-2 px-2 py-1.5 text-xs font-bold text-ds-muted transition-colors hover:text-red-400"
				>
					<LogOut className="h-3 w-3" />
					[SIGN_OUT]
				</button>
			</div>
		</div>
	)
}

type StaticNavTarget =
	| "/app"
	| "/app/analytics"
	| "/app/standup"
	| "/app/history"
	| "/app/settings"

type TeamNavTarget = "/app/team/$teamId"

type NavLinkProps =
	| {
			to: StaticNavTarget
			params?: undefined
			icon: React.ComponentType<{ className?: string }>
			label: string
			exact?: boolean
			onNavigate?: () => void
	  }
	| {
			to: TeamNavTarget
			params: { teamId: string }
			icon: React.ComponentType<{ className?: string }>
			label: string
			exact?: boolean
			onNavigate?: () => void
	  }

function NavLink({ to, params, icon: Icon, label, exact, onNavigate }: NavLinkProps) {
	const baseClassName =
		"flex items-center gap-3 px-4 py-2.5 text-xs font-bold tracking-wider text-ds-text-tertiary transition-all hover:bg-ds-surface hover:text-ds-fg"
	const activeClassName =
		"flex items-center gap-3 border-l-[3px] border-ds-accent bg-ds-accent/5 px-4 py-2.5 text-xs font-bold tracking-wider text-ds-accent"

	if (to === "/app/team/$teamId") {
		return (
			<Link
				to={to}
				params={params}
				activeOptions={{ exact }}
				onClick={onNavigate}
				className={baseClassName}
				activeProps={{
					className: activeClassName,
				}}
			>
				<Icon className="w-4 h-4" />
				<span className="truncate">{label}</span>
			</Link>
		)
	}

	return (
		<Link
			to={to}
			activeOptions={{ exact }}
			onClick={onNavigate}
			className={baseClassName}
			activeProps={{
				className: activeClassName,
			}}
		>
			<Icon className="w-4 h-4" />
			<span className="truncate">{label}</span>
		</Link>
	)
}
