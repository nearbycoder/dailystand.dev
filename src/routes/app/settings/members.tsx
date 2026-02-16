import { createFileRoute } from "@tanstack/react-router"
import { useTRPC } from "@/integrations/trpc/react"
import { useQuery } from "@tanstack/react-query"
import { authClient } from "@/lib/auth-client"
import { useState } from "react"
import { UserPlus, Mail } from "lucide-react"

export const Route = createFileRoute("/app/settings/members")({
	component: MembersPage,
})

function MembersPage() {
	const trpc = useTRPC()
	const { data: members, isLoading } = useQuery(
		trpc.org.listMembers.queryOptions(),
	)
	const [email, setEmail] = useState("")
	const [inviting, setInviting] = useState(false)
	const [inviteError, setInviteError] = useState("")
	const [inviteSuccess, setInviteSuccess] = useState("")

	const handleInvite = async (e: React.FormEvent) => {
		e.preventDefault()
		setInviting(true)
		setInviteError("")
		setInviteSuccess("")

		const result = await authClient.organization.inviteMember({
			email,
			role: "member",
		})

		if (result.error) {
			setInviteError(result.error.message ?? "Failed to invite")
		} else {
			setInviteSuccess(`Invitation sent to ${email}`)
			setEmail("")
		}
		setInviting(false)
	}

	return (
		<div className="p-6 max-w-3xl">
			<div className="mb-8">
				<h1 className="text-3xl font-extrabold tracking-tighter">MEMBERS</h1>
				<p className="text-ds-muted text-sm mt-1">
					// INVITE AND MANAGE TEAM MEMBERS
				</p>
			</div>

			{/* Invite */}
			<div className="border-[3px] border-ds-border p-6 mb-6">
				<div className="flex items-center gap-2 mb-4">
					<UserPlus className="w-4 h-4 text-ds-accent" />
					<span className="text-sm font-extrabold tracking-widest text-ds-accent">
						INVITE_MEMBER
					</span>
				</div>
				<form onSubmit={handleInvite} className="flex gap-3">
					<input
						type="email"
						placeholder="colleague@company.com"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						required
						className="flex-1 bg-ds-input-bg border-[3px] border-ds-muted3 px-4 py-2.5 text-ds-fg font-mono text-sm focus:border-ds-accent focus:outline-none transition-colors placeholder:text-ds-muted2"
					/>
					<button
						type="submit"
						disabled={inviting}
						className="bg-ds-accent text-ds-accent-fg px-6 py-2.5 font-extrabold text-sm tracking-wider hover:bg-ds-accent-hover transition-colors disabled:opacity-50 flex items-center gap-2 shrink-0"
					>
						<Mail className="w-4 h-4" />
						{inviting ? "SENDING..." : "INVITE"}
					</button>
				</form>
				{inviteError && (
					<p className="mt-2 text-red-400 text-sm font-bold">
						ERROR: {inviteError}
					</p>
				)}
				{inviteSuccess && (
					<p className="mt-2 text-ds-accent text-sm font-bold">
						SUCCESS: {inviteSuccess}
					</p>
				)}
			</div>

			{/* Members List */}
			<div className="border-[3px] border-ds-border">
				<div className="p-4 border-b-[3px] border-ds-border">
					<span className="text-sm font-bold tracking-widest text-ds-muted">
						// CURRENT MEMBERS ({members?.length ?? 0})
					</span>
				</div>
				{isLoading ? (
					<div className="p-6">
						{[1, 2, 3].map((i) => (
							<div
								key={i}
								className="h-10 bg-ds-surface mb-2 animate-pulse"
							/>
						))}
					</div>
				) : members && members.length > 0 ? (
					<div>
						{members.map((member) => (
							<div
								key={member.id}
								className="flex items-center justify-between p-4 border-b border-ds-border last:border-b-0 hover:bg-ds-surface/50 transition-colors"
							>
								<div className="flex items-center gap-3">
									<div className="w-7 h-7 bg-ds-accent text-ds-accent-fg flex items-center justify-center font-extrabold text-[10px]">
										{member.name
											.split(" ")
											.map((n) => n[0])
											.join("")
											.toUpperCase()}
									</div>
									<div>
										<div className="text-sm font-bold">{member.name}</div>
										<div className="text-xs text-ds-muted">{member.email}</div>
									</div>
								</div>
								<span className="text-xs font-bold tracking-widest text-ds-muted uppercase">
									{member.role}
								</span>
							</div>
						))}
					</div>
				) : (
					<div className="p-6 text-center text-ds-muted text-sm">
						NO_MEMBERS
					</div>
				)}
			</div>
		</div>
	)
}
