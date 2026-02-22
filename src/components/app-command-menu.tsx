import { useNavigate } from "@tanstack/react-router";
import {
	BarChart3,
	BookOpenText,
	CreditCard,
	History,
	KeyRound,
	LogOut,
	Monitor,
	Moon,
	PenSquare,
	Settings,
	Shield,
	SquareTerminal,
	Sun,
	User,
	Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { useTheme } from "@/lib/theme";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "./ui/command";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "./ui/dialog";

type SessionData = NonNullable<ReturnType<typeof authClient.useSession>["data"]>;

type TeamOption = {
	id: string;
	name: string;
	members?: {
		id: string;
		name: string;
		image: string | null;
	}[];
};

type OrganizationOption = {
	id: string;
	name: string;
	slug: string;
};

type CommandSection = "Navigation" | "Teams" | "Workspace" | "Actions";

type PaletteItem = {
	id: string;
	group: CommandSection;
	label: string;
	description: string;
	keywords: string;
	icon: React.ComponentType<{ className?: string }>;
	action: () => void | Promise<void>;
};

const commandGroupOrder: CommandSection[] = [
	"Navigation",
	"Teams",
	"Workspace",
	"Actions",
];

function isMacPlatform() {
	if (typeof navigator === "undefined") return false;
	const platform = navigator.platform || navigator.userAgent;
	return /(Mac|iPhone|iPad|iPod)/i.test(platform);
}

export function AppCommandMenu({
	session,
	teams,
	organizations,
	canViewAllTeams,
	onSignOut,
}: {
	session: SessionData;
	teams: TeamOption[] | undefined;
	organizations: OrganizationOption[];
	canViewAllTeams: boolean;
	onSignOut: () => Promise<void>;
}) {
	const navigate = useNavigate();
	const { setTheme } = useTheme();
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [isMacLike, setIsMacLike] = useState(false);
	const viewerId = session.user.id;
	const activeOrganizationId = session.session.activeOrganizationId ?? "";

	useEffect(() => {
		setIsMacLike(isMacPlatform());
	}, []);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key.toLowerCase() !== "k") return;
			if (event.altKey || event.shiftKey) return;
			const expectedModifier = isMacPlatform() ? event.metaKey : event.ctrlKey;
			if (!expectedModifier) return;
			event.preventDefault();
			setOpen((current) => !current);
		};

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);

	useEffect(() => {
		if (!open) setQuery("");
	}, [open]);

	const myTeams = useMemo(() => {
		if (!teams || teams.length === 0) return [];
		return teams.filter((team) =>
			team.members?.some((member) => member.id === viewerId),
		);
	}, [teams, viewerId]);

	const otherTeams = useMemo(() => {
		if (!teams || teams.length === 0 || !canViewAllTeams) return [];
		const myTeamIds = new Set(myTeams.map((team) => team.id));
		return teams.filter((team) => !myTeamIds.has(team.id));
	}, [teams, canViewAllTeams, myTeams]);

	const items = useMemo<PaletteItem[]>(() => {
		const navigationItems: PaletteItem[] = [
			{
				id: "go-dashboard",
				group: "Navigation",
				label: "Go to Dashboard",
				description: "/app",
				keywords: "dashboard home",
				icon: SquareTerminal,
				action: () => navigate({ to: "/app" }),
			},
			{
				id: "go-standup",
				group: "Navigation",
				label: "Write Standup",
				description: "/app/standup",
				keywords: "standup update submit",
				icon: PenSquare,
				action: () => navigate({ to: "/app/standup" }),
			},
			{
				id: "go-history",
				group: "Navigation",
				label: "Open History",
				description: "/app/history",
				keywords: "history log timeline",
				icon: History,
				action: () => navigate({ to: "/app/history" }),
			},
			{
				id: "go-analytics",
				group: "Navigation",
				label: "Open Analytics",
				description: "/app/analytics",
				keywords: "analytics reports metrics",
				icon: BarChart3,
				action: () => navigate({ to: "/app/analytics" }),
			},
			{
				id: "go-profile",
				group: "Navigation",
				label: "View My Profile",
				description: "Profile page",
				keywords: "profile account user",
				icon: User,
				action: () =>
					navigate({
						to: "/app/user/$userId",
						params: { userId: session.user.id },
					}),
			},
			{
				id: "go-settings",
				group: "Navigation",
				label: "Open Settings",
				description: "/app/settings",
				keywords: "settings configuration",
				icon: Settings,
				action: () => navigate({ to: "/app/settings" }),
			},
			{
				id: "go-settings-profile",
				group: "Navigation",
				label: "Settings: Profile",
				description: "/app/settings/profile",
				keywords: "settings profile account",
				icon: User,
				action: () => navigate({ to: "/app/settings/profile" }),
			},
			{
				id: "go-settings-notifications",
				group: "Navigation",
				label: "Settings: Notifications",
				description: "/app/settings/notifications",
				keywords: "settings notifications email",
				icon: Settings,
				action: () => navigate({ to: "/app/settings/notifications" }),
			},
			{
				id: "go-settings-members",
				group: "Navigation",
				label: "Settings: Members",
				description: "/app/settings/members",
				keywords: "settings members users roles",
				icon: Users,
				action: () => navigate({ to: "/app/settings/members" }),
			},
			{
				id: "go-settings-teams",
				group: "Navigation",
				label: "Settings: Teams",
				description: "/app/settings/teams",
				keywords: "settings teams",
				icon: Users,
				action: () => navigate({ to: "/app/settings/teams" }),
			},
			{
				id: "go-settings-security",
				group: "Navigation",
				label: "Settings: Security",
				description: "/app/settings/security",
				keywords: "settings security password",
				icon: Shield,
				action: () => navigate({ to: "/app/settings/security" }),
			},
			{
				id: "go-settings-billing",
				group: "Navigation",
				label: "Settings: Billing",
				description: "/app/settings/billing",
				keywords: "settings billing subscription",
				icon: CreditCard,
				action: () => navigate({ to: "/app/settings/billing" }),
			},
			{
				id: "go-settings-api-keys",
				group: "Navigation",
				label: "Settings: API Keys",
				description: "/app/settings/api-keys",
				keywords: "settings api keys tokens",
				icon: KeyRound,
				action: () => navigate({ to: "/app/settings/api-keys" }),
			},
			{
				id: "go-settings-api-docs",
				group: "Navigation",
				label: "Settings: API Docs",
				description: "/app/settings/api-docs",
				keywords: "settings api docs documentation",
				icon: BookOpenText,
				action: () => navigate({ to: "/app/settings/api-docs" }),
			},
		];

		const teamItems: PaletteItem[] = [
			...myTeams.map((team) => ({
				id: `team-my-${team.id}`,
				group: "Teams" as const,
				label: `Open Team: ${team.name}`,
				description: "My team",
				keywords: `team ${team.name} my`,
				icon: Users,
				action: () =>
					navigate({
						to: "/app/team/$teamId",
						params: { teamId: team.id },
					}),
			})),
			...otherTeams.map((team) => ({
				id: `team-all-${team.id}`,
				group: "Teams" as const,
				label: `Open Team: ${team.name}`,
				description: "All teams",
				keywords: `team ${team.name} all`,
				icon: Users,
				action: () =>
					navigate({
						to: "/app/team/$teamId",
						params: { teamId: team.id },
					}),
			})),
		];

		const workspaceItems: PaletteItem[] = organizations
			.filter((organization) => organization.id !== activeOrganizationId)
			.map((organization) => ({
				id: `switch-workspace-${organization.id}`,
				group: "Workspace" as const,
				label: `Switch Workspace: ${organization.name}`,
				description: organization.slug,
				keywords: `workspace organization ${organization.name} ${organization.slug}`,
				icon: SquareTerminal,
				action: async () => {
					const result = await authClient.organization.setActive({
						organizationId: organization.id,
					});
					if (result?.error) {
						toast.error(result.error.message ?? "Failed to switch workspace");
						return;
					}
					window.location.reload();
				},
			}));

		const actionItems: PaletteItem[] = [
			{
				id: "theme-dark",
				group: "Actions",
				label: "Theme: Dark",
				description: "Switch UI theme",
				keywords: "theme dark mode",
				icon: Moon,
				action: () => setTheme("dark"),
			},
			{
				id: "theme-light",
				group: "Actions",
				label: "Theme: Light",
				description: "Switch UI theme",
				keywords: "theme light mode",
				icon: Sun,
				action: () => setTheme("light"),
			},
			{
				id: "theme-system",
				group: "Actions",
				label: "Theme: System",
				description: "Follow OS preference",
				keywords: "theme system",
				icon: Monitor,
				action: () => setTheme("system"),
			},
			{
				id: "sign-out",
				group: "Actions",
				label: "Sign Out",
				description: "End current session",
				keywords: "logout sign out",
				icon: LogOut,
				action: () => onSignOut(),
			},
		];

		return [
			...navigationItems,
			...teamItems,
			...workspaceItems,
			...actionItems,
		];
	}, [
		activeOrganizationId,
		myTeams,
		navigate,
		onSignOut,
		organizations,
		otherTeams,
		session.user.id,
		setTheme,
	]);

	const groupedItems = useMemo(
		() =>
			commandGroupOrder.map((group) => ({
				group,
				items: items.filter((item) => item.group === group),
			})),
		[items],
	);

	const shortcutLabel = isMacLike ? "Cmd+K" : "Ctrl+K";

	const runItem = async (item: PaletteItem) => {
		setOpen(false);
		setQuery("");
		try {
			await item.action();
		} catch {
			toast.error("Command failed");
		}
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogContent
				showCloseButton={false}
				className="max-h-[80vh] max-w-2xl border-[3px] border-ds-border-strong bg-ds-bg p-4 font-mono text-ds-fg sm:p-5"
			>
				<DialogHeader className="gap-1 text-left">
					<DialogTitle className="text-base font-extrabold tracking-wider">
						COMMAND_MENU
					</DialogTitle>
					<DialogDescription className="text-xs text-ds-muted">
						Jump anywhere or run actions quickly. Shortcut: {shortcutLabel}
					</DialogDescription>
				</DialogHeader>

				<Command
					loop
					value={query}
					onValueChange={setQuery}
					className="rounded-none border-[2px] border-ds-muted3 bg-ds-input-bg"
				>
					<CommandInput
						autoFocus
						placeholder="Type a command..."
						className="h-12 text-sm text-ds-fg placeholder:text-ds-muted2"
					/>
					<CommandList className="max-h-[56vh] border-t border-ds-muted3">
						<CommandEmpty className="px-4 py-8 text-xs font-bold tracking-widest text-ds-muted">
							NO_MATCHING_COMMANDS
						</CommandEmpty>

						{groupedItems.map((entry) => (
							<CommandGroup
								key={entry.group}
								heading={`// ${entry.group.toUpperCase()}`}
								className="[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-ds-muted2"
							>
								{entry.items.map((item) => (
									<CommandItem
										key={item.id}
										value={`${item.label} ${item.description}`}
										keywords={item.keywords.split(" ")}
										onSelect={() => void runItem(item)}
										className="gap-3 rounded-none px-3 py-2.5 data-[selected=true]:bg-ds-surface data-[selected=true]:text-ds-fg"
									>
										<item.icon className="h-4 w-4 shrink-0 text-ds-accent" />
										<div className="min-w-0 flex-1">
											<div className="truncate text-xs font-bold tracking-wide text-ds-fg">
												{item.label}
											</div>
											<div className="truncate text-[10px] font-medium tracking-wide text-ds-muted">
												{item.description}
											</div>
										</div>
									</CommandItem>
								))}
							</CommandGroup>
						))}
					</CommandList>
				</Command>
			</DialogContent>
		</Dialog>
	);
}
