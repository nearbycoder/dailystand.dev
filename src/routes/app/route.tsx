import { useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	Outlet,
	useNavigate,
} from "@tanstack/react-router";
import {
	BarChart3,
	ChevronDown,
	History,
	LayoutDashboard,
	LogOut,
	Menu,
	PenSquare,
	Plus,
	Settings,
	Terminal,
	Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppCommandMenu } from "@/components/app-command-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTRPC } from "@/integrations/trpc/react";
import { authClient } from "@/lib/auth-client";
import { buildNoIndexMeta } from "@/lib/seo";

export const Route = createFileRoute("/app")({
	component: AppLayout,
	head: () => ({ meta: buildNoIndexMeta() }),
});

function AppLayout() {
	const { data: session, isPending } = authClient.useSession();
	const navigate = useNavigate();
	const [isHydrated, setIsHydrated] = useState(false);
	const shouldRedirectToSignIn = isHydrated && !isPending && !session?.user;

	useEffect(() => {
		setIsHydrated(true);
	}, []);

	useEffect(() => {
		if (!shouldRedirectToSignIn) return;
		void navigate({
			to: "/auth/sign-in",
			search: { invitationId: undefined, email: undefined },
		});
	}, [navigate, shouldRedirectToSignIn]);

	if (!isHydrated || isPending || shouldRedirectToSignIn) {
		return (
			<div className="min-h-screen bg-ds-bg text-ds-fg font-mono flex items-center justify-center">
				<span className="text-ds-accent animate-pulse">LOADING...</span>
			</div>
		);
	}

	if (!session?.user) {
		return (
			<div className="min-h-screen bg-ds-bg text-ds-fg font-mono flex items-center justify-center">
				<span className="text-ds-accent animate-pulse">LOADING...</span>
			</div>
		);
	}

	const activeOrgId = session.session.activeOrganizationId;

	if (!activeOrgId) {
		return <OrgSetup />;
	}

	return <AppShell session={session} />;
}

function OrgSetup() {
	const [orgName, setOrgName] = useState("");
	const [orgSlug, setOrgSlug] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const { data: orgs } = authClient.useListOrganizations();
	const organizations = orgs ?? [];
	const hasOrganizations = organizations.length > 0;

	const handleCreate = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setError("");

		const result = await authClient.organization.create({
			name: orgName,
			slug: orgSlug || orgName.toLowerCase().replace(/\s+/g, "-"),
		});

		if (result.error) {
			setError(result.error.message ?? "Failed to create organization");
			setLoading(false);
			return;
		}

		await authClient.organization.setActive({
			organizationId: result.data.id,
		});
		window.location.reload();
	};

	const handleSelect = async (orgId: string) => {
		await authClient.organization.setActive({ organizationId: orgId });
		window.location.reload();
	};

	return (
		<div className="min-h-screen bg-ds-bg text-ds-fg selection:bg-ds-selection-bg selection:text-ds-selection-fg font-mono flex items-start justify-center p-4 py-6 sm:items-center sm:p-6">
			<div className="w-full max-w-md">
				<div className="mb-6 flex items-center gap-3 sm:mb-10">
					<Terminal className="w-6 h-6 text-ds-accent" />
					<span className="text-xl font-extrabold tracking-tighter">
						DAILYSTAND
					</span>
				</div>

				<div className="border-[3px] border-ds-border-strong p-4 sm:p-8">
					<h1 className="mb-2 text-2xl font-extrabold tracking-tighter">
						{hasOrganizations ? "SELECT_ORG" : "CREATE_ORG"}
					</h1>
					<p className="mb-6 text-sm text-ds-muted">// set up your workspace</p>

					{hasOrganizations && (
						<div className="mb-6 space-y-2">
							<div className="max-h-[42vh] space-y-2 overflow-y-auto pr-1">
								{organizations.map((org) => (
									<button
										key={org.id}
										onClick={() => handleSelect(org.id)}
										className="flex w-full items-center gap-3 border-[3px] border-ds-muted3 p-3 text-left transition-all hover:border-ds-accent hover:bg-ds-accent/5 sm:p-3.5"
									>
										<div className="flex h-8 w-8 shrink-0 items-center justify-center bg-ds-accent text-sm font-extrabold text-ds-accent-fg">
											{org.name.charAt(0)}
										</div>
										<div className="min-w-0">
											<div className="truncate text-sm font-bold">
												{org.name}
											</div>
											<div className="truncate text-xs text-ds-muted">
												{org.slug}
											</div>
										</div>
									</button>
								))}
							</div>
							<div className="text-center text-ds-muted2 text-xs font-bold tracking-widest py-4">
								// OR CREATE NEW
							</div>
						</div>
					)}

					<form onSubmit={handleCreate} className="space-y-4 sm:space-y-6">
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
									setOrgName(e.target.value);
									setOrgSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"));
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
	);
}

function AppShell({
	session,
}: {
	session: NonNullable<ReturnType<typeof authClient.useSession>["data"]>;
}) {
	const navigate = useNavigate();
	const trpc = useTRPC();
	const { data: teams } = useQuery(trpc.teams.list.queryOptions());
	const { data: orgMembers } = useQuery(trpc.org.listMembers.queryOptions());
	const { data: organizationsData } = authClient.useListOrganizations();
	const [mobileNavOpen, setMobileNavOpen] = useState(false);
	const viewerId = session.user.id;
	const organizations = organizationsData ?? [];

	const canViewAllTeams = useMemo(() => {
		const currentMember = (orgMembers ?? []).find(
			(member) => member.userId === viewerId,
		);
		if (!currentMember?.role) return false;
		const roleParts = currentMember.role
			.split(",")
			.map((part) => part.trim().toLowerCase())
			.filter(Boolean);
		return roleParts.includes("owner") || roleParts.includes("admin");
	}, [orgMembers, viewerId]);

	const handleSignOut = async () => {
		await authClient.signOut();
		navigate({ to: "/" });
	};

	const closeMobileNav = () => setMobileNavOpen(false);

	return (
		<div className="min-h-screen bg-ds-bg text-ds-fg selection:bg-ds-selection-bg selection:text-ds-selection-fg font-mono md:flex md:h-svh md:overflow-hidden">
			<AppCommandMenu
				session={session}
				organizations={organizations}
				teams={teams}
				canViewAllTeams={canViewAllTeams}
				onSignOut={handleSignOut}
			/>

			{/* Sidebar */}
			<aside className="hidden w-56 shrink-0 flex-col border-r-[3px] border-ds-border-strong md:flex md:h-svh md:max-h-svh md:overflow-hidden">
				<SidebarContent
					session={session}
					organizations={organizations}
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
								organizations={organizations}
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
	);
}

function SidebarContent({
	session,
	organizations,
	teams,
	viewerId,
	canViewAllTeams,
	onSignOut,
	onNavigate,
}: {
	session: NonNullable<ReturnType<typeof authClient.useSession>["data"]>;
	organizations: {
		id: string;
		name: string;
		slug: string;
	}[];
	teams:
		| {
				id: string;
				name: string;
				members?: {
					id: string;
					name: string;
					image: string | null;
				}[];
		  }[]
		| undefined;
	viewerId: string;
	canViewAllTeams: boolean;
	onSignOut: () => Promise<void>;
	onNavigate?: () => void;
}) {
	const activeOrganizationId = session.session.activeOrganizationId ?? "";
	const [switchingOrgId, setSwitchingOrgId] = useState<string | null>(null);
	const [workspaceError, setWorkspaceError] = useState("");
	const [createOrgOpen, setCreateOrgOpen] = useState(false);
	const [newOrgName, setNewOrgName] = useState("");
	const [newOrgSlug, setNewOrgSlug] = useState("");
	const [createOrgError, setCreateOrgError] = useState("");
	const [creatingOrg, setCreatingOrg] = useState(false);
	const activeOrganization = useMemo(
		() =>
			organizations.find(
				(organization) => organization.id === activeOrganizationId,
			) ?? null,
		[organizations, activeOrganizationId],
	);

	const switchOrganization = async (organizationId: string) => {
		if (!organizationId || organizationId === activeOrganizationId) return;
		setWorkspaceError("");
		setSwitchingOrgId(organizationId);
		const result = await authClient.organization.setActive({ organizationId });
		if (result?.error) {
			setWorkspaceError(
				result.error.message ?? "Failed to switch organization.",
			);
			setSwitchingOrgId(null);
			return;
		}
		onNavigate?.();
		window.location.reload();
	};

	const createOrganization = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!newOrgName.trim()) return;
		setCreateOrgError("");
		setCreatingOrg(true);
		const result = await authClient.organization.create({
			name: newOrgName.trim(),
			slug: (newOrgSlug.trim() || newOrgName.trim())
				.toLowerCase()
				.replace(/\s+/g, "-"),
		});
		if (result.error) {
			setCreateOrgError(
				result.error.message ?? "Failed to create organization.",
			);
			setCreatingOrg(false);
			return;
		}
		const activateResult = await authClient.organization.setActive({
			organizationId: result.data.id,
		});
		if (activateResult?.error) {
			setCreateOrgError(
				activateResult.error.message ?? "Failed to activate organization.",
			);
			setCreatingOrg(false);
			return;
		}
		onNavigate?.();
		window.location.reload();
	};

	const myTeams = useMemo(() => {
		if (!teams || teams.length === 0) return [];
		return teams.filter((team) =>
			team.members?.some((member) => member.id === viewerId),
		);
	}, [teams, viewerId]);
	const otherTeams = useMemo(() => {
		if (!teams || teams.length === 0) return [];
		const myTeamIds = new Set(myTeams.map((team) => team.id));
		return teams.filter((team) => !myTeamIds.has(team.id));
	}, [teams, myTeams]);

	return (
		<TooltipProvider delayDuration={1000} skipDelayDuration={5000}>
			<div className="flex h-full min-h-0 flex-col">
				<div className="border-b-[3px] border-ds-border-strong p-4">
					<Link
						to="/app"
						className="flex items-center gap-2"
						onClick={onNavigate}
					>
						<Terminal className="h-5 w-5 text-ds-accent" />
						<span className="font-extrabold tracking-tighter">DAILYSTAND</span>
					</Link>
				</div>

				<div className="border-b-[3px] border-ds-border-strong p-3">
					<div className="mb-2 text-[10px] font-bold tracking-widest text-ds-muted2">
						// WORKSPACE
					</div>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<button
								type="button"
								disabled={switchingOrgId !== null || creatingOrg}
								className="flex w-full items-center justify-between gap-2 border-[2px] border-ds-muted3 bg-ds-input-bg px-2.5 py-1.5 text-xs font-bold text-ds-fg transition-colors hover:border-ds-accent focus:border-ds-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
							>
								<span className="truncate">
									{activeOrganization?.name ?? "CURRENT_ORG"}
								</span>
								<ChevronDown className="h-3.5 w-3.5 shrink-0 text-ds-text-tertiary" />
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							align="start"
							sideOffset={6}
							className="w-[220px] border-[2px] border-ds-muted3 bg-ds-bg p-1"
						>
							{organizations.length > 0 ? (
								organizations.map((organization) => (
									<DropdownMenuItem
										key={organization.id}
										disabled={
											switchingOrgId !== null ||
											creatingOrg ||
											organization.id === activeOrganizationId
										}
										onSelect={() => void switchOrganization(organization.id)}
										className="cursor-pointer rounded-none px-2 py-1.5 font-mono text-xs font-bold tracking-wider text-ds-text-secondary hover:bg-ds-surface hover:text-ds-fg"
									>
										<span className="min-w-0 flex-1 truncate">
											{organization.name}
										</span>
										{organization.id === activeOrganizationId ? (
											<span className="text-[9px] font-extrabold tracking-widest text-ds-accent">
												ACTIVE
											</span>
										) : null}
									</DropdownMenuItem>
								))
							) : (
								<div className="px-2 py-1.5 text-[10px] font-bold tracking-widest text-ds-muted">
									NO_ORGANIZATIONS
								</div>
							)}
							<DropdownMenuSeparator className="my-1 bg-ds-muted3" />
							<DropdownMenuItem
								disabled={switchingOrgId !== null || creatingOrg}
								onSelect={() => {
									setCreateOrgError("");
									setNewOrgName("");
									setNewOrgSlug("");
									setCreateOrgOpen(true);
								}}
								className="cursor-pointer rounded-none px-2 py-1.5 font-mono text-xs font-extrabold tracking-wider text-ds-accent hover:bg-ds-surface hover:text-ds-accent"
							>
								<Plus className="h-3 w-3" />
								CREATE_NEW_ORG
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
					<div className="mt-2 flex items-center justify-between gap-2">
						{switchingOrgId ? (
							<span className="text-[10px] font-bold tracking-widest text-ds-muted">
								SWITCHING...
							</span>
						) : null}
					</div>
					{workspaceError ? (
						<div className="mt-2 border-[2px] border-red-500/70 bg-red-500/10 px-2 py-1 text-[10px] font-bold tracking-widest text-red-400">
							{workspaceError}
						</div>
					) : null}
				</div>

				<Dialog open={createOrgOpen} onOpenChange={setCreateOrgOpen}>
					<DialogContent className="border-[3px] border-ds-border-strong bg-ds-bg p-5 font-mono text-ds-fg sm:max-w-md">
						<DialogHeader>
							<DialogTitle className="text-base font-extrabold tracking-wider">
								CREATE_NEW_ORGANIZATION
							</DialogTitle>
							<DialogDescription className="text-xs text-ds-muted">
								Start a separate workspace with its own free plan and billing.
							</DialogDescription>
						</DialogHeader>
						<form onSubmit={createOrganization} className="space-y-3">
							<input
								value={newOrgName}
								onChange={(event) => {
									setNewOrgName(event.target.value);
									setNewOrgSlug(
										event.target.value.toLowerCase().replace(/\s+/g, "-"),
									);
								}}
								placeholder="Organization name"
								required
								className="w-full border-[2px] border-ds-muted3 bg-ds-input-bg px-2.5 py-2 text-sm text-ds-fg focus:border-ds-accent focus:outline-none"
							/>
							<input
								value={newOrgSlug}
								onChange={(event) => setNewOrgSlug(event.target.value)}
								placeholder="organization-slug"
								required
								className="w-full border-[2px] border-ds-muted3 bg-ds-input-bg px-2.5 py-2 text-sm text-ds-fg focus:border-ds-accent focus:outline-none"
							/>
							{createOrgError ? (
								<div className="border-[2px] border-red-500/70 bg-red-500/10 px-2 py-1 text-[10px] font-bold tracking-widest text-red-400">
									{createOrgError}
								</div>
							) : null}
							<div className="flex items-center justify-end gap-2">
								<button
									type="button"
									onClick={() => setCreateOrgOpen(false)}
									disabled={creatingOrg}
									className="border-[2px] border-ds-muted3 px-3 py-1.5 text-[10px] font-extrabold tracking-widest text-ds-text-tertiary transition-colors hover:border-ds-accent hover:text-ds-accent disabled:cursor-not-allowed disabled:opacity-60"
								>
									CANCEL
								</button>
								<button
									type="submit"
									disabled={creatingOrg}
									className="bg-ds-accent px-3 py-1.5 text-[10px] font-extrabold tracking-widest text-ds-accent-fg transition-colors hover:bg-ds-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
								>
									{creatingOrg ? "CREATING..." : "CREATE_ORG"}
								</button>
							</div>
						</form>
					</DialogContent>
				</Dialog>

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
							<Link
								to="/app/user/$userId"
								params={{ userId: session.user.id }}
								onClick={onNavigate}
								className="block truncate text-xs font-bold underline-offset-4 transition-colors hover:text-ds-accent hover:underline"
							>
								{session.user.name}
							</Link>
							<div className="truncate text-[10px] text-ds-muted">
								{session.user.email}
							</div>
						</div>
					</div>
					<button
						onClick={async () => {
							onNavigate?.();
							await onSignOut();
						}}
						className="flex w-full items-center gap-2 px-2 py-1.5 text-xs font-bold text-ds-muted transition-colors hover:text-red-400"
					>
						<LogOut className="h-3 w-3" />
						[SIGN_OUT]
					</button>
				</div>
			</div>
		</TooltipProvider>
	);
}

type StaticNavTarget =
	| "/app"
	| "/app/analytics"
	| "/app/standup"
	| "/app/history"
	| "/app/settings";

type TeamNavTarget = "/app/team/$teamId";

type NavLinkProps =
	| {
			to: StaticNavTarget;
			params?: undefined;
			icon: React.ComponentType<{ className?: string }>;
			label: string;
			exact?: boolean;
			onNavigate?: () => void;
	  }
	| {
			to: TeamNavTarget;
			params: { teamId: string };
			icon: React.ComponentType<{ className?: string }>;
			label: string;
			exact?: boolean;
			onNavigate?: () => void;
	  };

function NavLink({
	to,
	params,
	icon: Icon,
	label,
	exact,
	onNavigate,
}: NavLinkProps) {
	const baseClassName =
		"flex items-center gap-3 px-4 py-2.5 text-xs font-bold tracking-wider text-ds-text-tertiary transition-all hover:bg-ds-surface hover:text-ds-fg";
	const activeClassName =
		"flex items-center gap-3 border-l-[3px] border-ds-accent bg-ds-accent/5 px-4 py-2.5 text-xs font-bold tracking-wider text-ds-accent";

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
				<NavLabelWithTooltip label={label} />
			</Link>
		);
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
			<NavLabelWithTooltip label={label} />
		</Link>
	);
}

function NavLabelWithTooltip({ label }: { label: string }) {
	const labelRef = useRef<HTMLSpanElement>(null);
	const [isTruncated, setIsTruncated] = useState(false);

	const checkTruncation = () => {
		const labelElement = labelRef.current;
		if (!labelElement) {
			setIsTruncated(false);
			return;
		}
		setIsTruncated(labelElement.scrollWidth > labelElement.clientWidth + 1);
	};

	useEffect(() => {
		if (label.length === 0) {
			setIsTruncated(false);
			return;
		}

		checkTruncation();

		if (typeof ResizeObserver !== "undefined") {
			const labelElement = labelRef.current;
			if (!labelElement) return;
			const observer = new ResizeObserver(checkTruncation);
			observer.observe(labelElement);
			return () => observer.disconnect();
		}

		window.addEventListener("resize", checkTruncation);
		return () => window.removeEventListener("resize", checkTruncation);
	}, [label]);

	useEffect(() => {
		if (typeof document === "undefined" || !document.fonts) return;
		void document.fonts.ready.then(() => {
			checkTruncation();
		});
	}, []);

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<span
					ref={labelRef}
					className="min-w-0 flex-1 truncate"
					onPointerEnter={checkTruncation}
				>
					{label}
				</span>
			</TooltipTrigger>
			{isTruncated ? (
				<TooltipContent
					side="right"
					align="start"
					sideOffset={12}
					className="[&>svg]:hidden rounded-md border border-ds-border bg-ds-surface/98 px-2.5 py-1 font-mono text-[11px] font-bold tracking-wider text-ds-fg shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur-[1px]"
				>
					{label}
				</TooltipContent>
			) : null}
		</Tooltip>
	);
}
