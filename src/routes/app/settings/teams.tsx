import { createFileRoute } from "@tanstack/react-router"
import { useTRPC } from "@/integrations/trpc/react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { authClient } from "@/lib/auth-client"
import { useState } from "react"
import { Plus, Users2 } from "lucide-react"

export const Route = createFileRoute("/app/settings/teams")({
	component: TeamsPage,
})

function TeamsPage() {
	const trpc = useTRPC()
	const queryClient = useQueryClient()
	const { data: teams, isLoading } = useQuery(trpc.teams.list.queryOptions())
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

	return (
		<div className="p-6 max-w-3xl">
			<div className="mb-8">
				<h1 className="text-3xl font-extrabold tracking-tighter">TEAMS</h1>
				<p className="text-ds-muted text-sm mt-1">
					// CREATE AND MANAGE TEAMS
				</p>
			</div>

			{/* Create Team */}
			<div className="border-[3px] border-ds-border p-6 mb-6">
				<div className="flex items-center gap-2 mb-4">
					<Users2 className="w-4 h-4 text-ds-accent" />
					<span className="text-sm font-extrabold tracking-widest text-ds-accent">
						CREATE_TEAM
					</span>
				</div>
				<form onSubmit={handleCreate} className="flex gap-3">
					<input
						placeholder="Engineering, Design, Marketing..."
						value={name}
						onChange={(e) => setName(e.target.value)}
						required
						className="flex-1 bg-ds-input-bg border-[3px] border-ds-muted3 px-4 py-2.5 text-ds-fg font-mono text-sm focus:border-ds-accent focus:outline-none transition-colors placeholder:text-ds-muted2"
					/>
					<button
						type="submit"
						disabled={creating}
						className="bg-ds-accent text-ds-accent-fg px-6 py-2.5 font-extrabold text-sm tracking-wider hover:bg-ds-accent-hover transition-colors disabled:opacity-50 flex items-center gap-2 shrink-0"
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
						<div
							key={team.id}
							className="border-[3px] border-ds-border -mt-[3px] p-6 hover:border-ds-muted2 transition-colors"
						>
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-3">
									<div className="w-10 h-10 bg-ds-accent text-ds-accent-fg flex items-center justify-center font-extrabold">
										{team.name.charAt(0).toUpperCase()}
									</div>
									<div>
										<div className="font-extrabold text-sm tracking-wider">
											{team.name.toUpperCase()}
										</div>
										<div className="text-ds-muted text-xs">
											{team.memberCount}{" "}
											{team.memberCount === 1 ? "member" : "members"}
										</div>
									</div>
								</div>
								<div className="flex -space-x-1">
									{team.members.slice(0, 5).map((member) => (
										<div
											key={member.id}
											className="w-7 h-7 bg-ds-surface2 border-2 border-ds-bg flex items-center justify-center text-[10px] font-bold text-ds-text-tertiary"
										>
											{member.name.charAt(0).toUpperCase()}
										</div>
									))}
									{team.memberCount > 5 && (
										<div className="w-7 h-7 bg-ds-surface2 border-2 border-ds-bg flex items-center justify-center text-[10px] font-bold text-ds-muted">
											+{team.memberCount - 5}
										</div>
									)}
								</div>
							</div>
						</div>
					))}
				</div>
			) : (
				<div className="border-[3px] border-ds-border p-12 text-center">
					<p className="text-ds-muted text-sm">
						NO_TEAMS // Create your first team above.
					</p>
				</div>
			)}
		</div>
	)
}
