import { createFileRoute } from "@tanstack/react-router"
import { useTRPC } from "@/integrations/trpc/react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { authClient } from "@/lib/auth-client"
import { useMemo, useState } from "react"
import {
	ChevronDown,
	Plus,
	Users2,
	UserMinus,
	UserPlus,
	Pencil,
	Trash2,
} from "lucide-react"

export const Route = createFileRoute("/app/settings/teams")({
	component: TeamsPage,
})

type TeamListItem = {
	id: string
	name: string
	memberCount: number
	members: { id: string; name: string; image: string | null }[]
}

type OrganizationMember = {
	id: string
	name: string
	email: string
	image: string | null
	role: string
}

function TeamsPage() {
	const trpc = useTRPC()
	const queryClient = useQueryClient()
	const { data: teams, isLoading } = useQuery(trpc.teams.list.queryOptions())
	const { data: myMembership } = useQuery(
		trpc.org.getMyMembership.queryOptions(),
	)
	const { data: organizationMembers } = useQuery(
		trpc.org.listMembers.queryOptions(),
	)
	const canManageTeams = myMembership?.canManageOrganization ?? false
	const [name, setName] = useState("")
	const [creating, setCreating] = useState(false)
	const [error, setError] = useState("")

	const handleCreate = async (e: React.FormEvent) => {
		e.preventDefault()
		setCreating(true)
		setError("")

		const result = await authClient.organization.createTeam({ name })

		if (result.error) {
			setError(result.error.message ?? "Failed to create team")
		} else {
			setName("")
			queryClient.invalidateQueries()
		}
		setCreating(false)
	}

	const organizationMembersMap = useMemo(
		() => new Map((organizationMembers ?? []).map((m) => [m.id, m])),
		[organizationMembers],
	)

	const refreshData = async () => {
		await queryClient.invalidateQueries()
	}

	return (
		<div className="mx-auto w-full max-w-[1200px] px-4 py-5 sm:p-6">
			<div className="mb-8">
				<h1 className="text-2xl font-extrabold tracking-tighter sm:text-3xl">
					TEAMS
				</h1>
				<p className="text-ds-muted text-sm mt-1">
					{canManageTeams
						? "// CREATE AND MANAGE TEAMS"
						: "// VIEW TEAM ROSTERS"}
				</p>
			</div>

			{canManageTeams ? (
				<div className="mb-6 border-[3px] border-ds-border p-4 sm:p-6">
					<div className="flex items-center gap-2 mb-4">
						<Users2 className="w-4 h-4 text-ds-accent" />
						<span className="text-sm font-extrabold tracking-widest text-ds-accent">
							CREATE_TEAM
						</span>
					</div>
					<form
						onSubmit={handleCreate}
						className="flex flex-col gap-3 sm:flex-row"
					>
						<input
							placeholder="Engineering, Design, Marketing..."
							value={name}
							onChange={(e) => setName(e.target.value)}
							required
							className="min-w-0 flex-1 bg-ds-input-bg border-[3px] border-ds-muted3 px-4 py-2.5 text-ds-fg font-mono text-sm transition-colors placeholder:text-ds-muted2 focus:border-ds-accent focus:outline-none"
						/>
						<button
							type="submit"
							disabled={creating}
							className="flex w-full shrink-0 items-center justify-center gap-2 bg-ds-accent px-6 py-2.5 text-sm font-extrabold tracking-wider text-ds-accent-fg transition-colors hover:bg-ds-accent-hover disabled:opacity-50 sm:w-auto"
						>
							<Plus className="w-4 h-4" />
							{creating ? "CREATING..." : "CREATE"}
						</button>
					</form>
					{error && (
						<p className="mt-2 text-red-400 text-sm font-bold">
							ERROR: {error}
						</p>
					)}
				</div>
			) : (
				<div className="mb-6 border-[3px] border-ds-border p-4 text-xs font-bold tracking-wider text-ds-muted sm:p-6">
					MEMBER_ACCESS // Team changes are restricted to owners/admins.
				</div>
			)}

			{/* Teams List */}
			{isLoading ? (
				<div className="space-y-4">
					{[1, 2].map((i) => (
						<div
							key={i}
							className="border-[3px] border-ds-border p-6 h-20 animate-pulse"
						/>
					))}
				</div>
				) : teams && teams.length > 0 ? (
					<div className="space-y-0">
						{teams.map((team) => (
							<TeamCard
								key={team.id}
								team={team}
								canManage={canManageTeams}
								organizationMembers={organizationMembers ?? []}
								organizationMembersMap={organizationMembersMap}
								onChanged={refreshData}
							/>
						))}
					</div>
				) : (
					<div className="border-[3px] border-ds-border p-8 text-center sm:p-12">
						<p className="text-ds-muted text-sm">
							{canManageTeams
								? "NO_TEAMS // Create your first team above."
								: "NO_TEAMS // No teams available in this organization yet."}
						</p>
					</div>
				)}
			</div>
		)
}

function TeamCard({
	team,
	canManage,
	organizationMembers,
	organizationMembersMap,
	onChanged,
}: {
	team: TeamListItem
	canManage: boolean
	organizationMembers: OrganizationMember[]
	organizationMembersMap: Map<string, OrganizationMember>
	onChanged: () => Promise<void>
}) {
	const [expanded, setExpanded] = useState(false)
	const [draftName, setDraftName] = useState(team.name)
	const [selectedUserId, setSelectedUserId] = useState("")
	const [busyAction, setBusyAction] = useState<string | null>(null)
	const [actionError, setActionError] = useState("")

	const teamMemberIds = useMemo(
		() => new Set(team.members.map((member) => member.id)),
		[team.members],
	)

	const availableMembers = useMemo(
		() =>
			organizationMembers.filter((member) => !teamMemberIds.has(member.id)),
		[organizationMembers, teamMemberIds],
	)

	const runAction = async (action: string, fn: () => Promise<boolean>) => {
		setActionError("")
		setBusyAction(action)
		try {
			const didChange = await fn()
			if (didChange) {
				await onChanged()
			}
		} catch {
			// Action errors are handled with in-panel messages.
		} finally {
			setBusyAction(null)
		}
	}

	const handleRename = async () => {
		if (!canManage) return
		const nextName = draftName.trim()
		if (!nextName || nextName === team.name) return
		await runAction("rename", async () => {
			const result = await authClient.organization.updateTeam({
				teamId: team.id,
				data: { name: nextName },
			})
			if (result.error) {
				setActionError(result.error.message ?? "Failed to rename team")
				return false
			}
			setDraftName(nextName)
			return true
		})
	}

	const handleAddMember = async () => {
		if (!canManage) return
		if (!selectedUserId) return
		await runAction(`add:${selectedUserId}`, async () => {
			const result = await authClient.organization.addTeamMember({
				teamId: team.id,
				userId: selectedUserId,
			})
			if (result.error) {
				setActionError(result.error.message ?? "Failed to add member")
				return false
			}
			setSelectedUserId("")
			return true
		})
	}

	const handleRemoveMember = async (userId: string) => {
		if (!canManage) return
		await runAction(`remove:${userId}`, async () => {
			const result = await authClient.organization.removeTeamMember({
				teamId: team.id,
				userId,
			})
			if (result.error) {
				setActionError(result.error.message ?? "Failed to remove member")
				return false
			}
			return true
		})
	}

	const handleDeleteTeam = async () => {
		if (!canManage) return
		const shouldDelete = window.confirm(
			`Delete team "${team.name}"? This removes team assignments.`,
		)
		if (!shouldDelete) return

		await runAction("delete", async () => {
			const result = await authClient.organization.removeTeam({
				teamId: team.id,
			})
			if (result.error) {
				setActionError(result.error.message ?? "Failed to delete team")
				return false
			}
			return true
		})
	}

	return (
		<div className="-mt-[3px] border-[3px] border-ds-border p-4 transition-colors hover:border-ds-muted2 sm:p-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-center gap-3">
					<div className="flex h-10 w-10 items-center justify-center bg-ds-accent font-extrabold text-ds-accent-fg">
						{team.name.charAt(0).toUpperCase()}
					</div>
					<div>
						<div className="text-sm font-extrabold tracking-wider">
							{team.name.toUpperCase()}
						</div>
						<div className="text-xs text-ds-muted">
							{team.memberCount} {team.memberCount === 1 ? "member" : "members"}
						</div>
					</div>
				</div>

				<div className="flex flex-wrap items-center gap-2 sm:justify-end">
					<div className="flex flex-wrap gap-1 sm:-space-x-1 sm:gap-0">
						{team.members.slice(0, 5).map((member) => (
							<div
								key={member.id}
								className="flex h-7 w-7 items-center justify-center border-2 border-ds-bg bg-ds-surface2 text-[10px] font-bold text-ds-text-tertiary"
								title={member.name}
							>
								{member.name.charAt(0).toUpperCase()}
							</div>
						))}
						{team.memberCount > 5 && (
							<div className="flex h-7 w-7 items-center justify-center border-2 border-ds-bg bg-ds-surface2 text-[10px] font-bold text-ds-muted">
								+{team.memberCount - 5}
							</div>
						)}
					</div>
					<button
						type="button"
						onClick={() => setExpanded((prev) => !prev)}
						className="border-[2px] border-ds-muted3 px-3 py-1.5 text-[10px] font-extrabold tracking-widest text-ds-text-tertiary transition-colors hover:border-ds-accent hover:text-ds-accent"
					>
						{expanded
							? canManage
								? "HIDE_MANAGE"
								: "HIDE_MEMBERS"
							: canManage
								? "MANAGE_TEAM"
								: "VIEW_MEMBERS"}
					</button>
				</div>
			</div>

			{expanded && (
				<div className="mt-4 space-y-4 border-t-[2px] border-ds-border pt-4">
					{canManage && (
						<>
							<div>
								<div className="mb-2 text-[10px] font-bold tracking-widest text-ds-muted2">
									// TEAM NAME
								</div>
								<div className="flex flex-col gap-2 sm:flex-row">
									<input
										value={draftName}
										onChange={(e) => setDraftName(e.target.value)}
										className="min-w-0 flex-1 border-[3px] border-ds-muted3 bg-ds-input-bg px-3 py-2 text-sm text-ds-fg focus:border-ds-accent focus:outline-none"
									/>
									<button
										type="button"
										onClick={handleRename}
										disabled={
											busyAction !== null ||
											!draftName.trim() ||
											draftName.trim() === team.name
										}
										className="flex w-full items-center justify-center gap-2 border-[3px] border-ds-border-strong px-4 py-2 text-xs font-extrabold tracking-wider transition-colors hover:bg-ds-border-strong hover:text-ds-bg disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
									>
										<Pencil className="h-3.5 w-3.5" />
										SAVE_NAME
									</button>
								</div>
							</div>

							<div>
								<div className="mb-2 text-[10px] font-bold tracking-widest text-ds-muted2">
									// ADD MEMBER
								</div>
								<div className="flex flex-col gap-2 sm:flex-row">
									<div className="relative min-w-0 flex-1">
										<select
											value={selectedUserId}
											onChange={(e) => setSelectedUserId(e.target.value)}
											className="w-full appearance-none border-[3px] border-ds-muted3 bg-ds-input-bg px-3 py-2 pr-10 text-sm text-ds-fg focus:border-ds-accent focus:outline-none"
										>
											<option value="">Select organization member...</option>
											{availableMembers.map((member) => (
												<option key={member.id} value={member.id}>
													{member.name} ({member.email})
												</option>
											))}
										</select>
										<span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-ds-text-tertiary">
											<ChevronDown className="h-4 w-4" />
										</span>
									</div>
									<button
										type="button"
										onClick={handleAddMember}
										disabled={!selectedUserId || busyAction !== null}
										className="flex w-full items-center justify-center gap-2 bg-ds-accent px-4 py-2 text-xs font-extrabold tracking-wider text-ds-accent-fg transition-colors hover:bg-ds-accent-hover disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
									>
										<UserPlus className="h-3.5 w-3.5" />
										ADD
									</button>
								</div>
								{availableMembers.length === 0 && (
									<p className="mt-2 text-xs text-ds-muted">
										All organization members are already on this team.
									</p>
								)}
							</div>
						</>
					)}

					<div>
						<div className="mb-2 text-[10px] font-bold tracking-widest text-ds-muted2">
							// TEAM MEMBERS ({team.memberCount})
						</div>
						{team.members.length > 0 ? (
							<div className="space-y-2">
								{team.members.map((member) => {
									const memberDetails = organizationMembersMap.get(member.id)
									return (
										<div
											key={member.id}
											className="flex items-center justify-between border-[2px] border-ds-border px-3 py-2"
										>
											<div className="min-w-0">
												<div className="truncate text-sm font-bold">
													{member.name}
												</div>
												<div className="truncate text-xs text-ds-muted">
													{memberDetails?.email ?? "No email"}
												</div>
											</div>
											{canManage && (
												<button
													type="button"
													onClick={() => handleRemoveMember(member.id)}
													disabled={busyAction !== null}
													className="ml-3 flex shrink-0 items-center gap-1.5 px-2 py-1 text-[10px] font-extrabold tracking-widest text-red-500 transition-colors hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
												>
													<UserMinus className="h-3 w-3" />
													REMOVE
												</button>
											)}
										</div>
									)
								})}
							</div>
						) : (
							<div className="border-[2px] border-ds-border px-3 py-4 text-xs text-ds-muted">
								NO_MEMBERS // Add someone to start using this team.
							</div>
						)}
					</div>

					{canManage && (
						<div className="border-t-[2px] border-ds-border pt-3">
							<button
								type="button"
								onClick={handleDeleteTeam}
								disabled={busyAction !== null}
								className="flex items-center gap-2 px-0 py-1 text-xs font-extrabold tracking-wider text-red-500 transition-colors hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
							>
								<Trash2 className="h-3.5 w-3.5" />
								DELETE_TEAM
							</button>
						</div>
					)}

					{actionError && (
						<div className="border-[2px] border-red-500 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-400">
							ERROR: {actionError}
						</div>
					)}
				</div>
			)}
		</div>
	)
}
