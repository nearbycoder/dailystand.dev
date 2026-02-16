import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Save, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/integrations/trpc/react";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/app/settings/profile")({
	component: ProfileSettingsPage,
});

const BIO_MAX_LENGTH = 500;

function ProfileSettingsPage() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const { data: session } = authClient.useSession();
	const userId = session?.user?.id;

	const profileQuery = useQuery({
		...trpc.profile.getUserProfile.queryOptions({
			userId: userId ?? "",
			limit: 1,
		}),
		enabled: Boolean(userId),
	});

	const updateBio = useMutation(
		trpc.profile.updateMyBio.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries();
				toast.success("Profile updated");
			},
			onError: (error) => {
				toast.error("Failed to update profile", {
					description:
						error instanceof Error ? error.message : "Unexpected server error.",
				});
			},
		}),
	);

	const [bio, setBio] = useState("");

	useEffect(() => {
		setBio(profileQuery.data?.user.bio ?? "");
	}, [profileQuery.data?.user.bio]);

	const bioLength = useMemo(() => bio.length, [bio]);
	const isSaving = updateBio.isPending;
	const isUnchanged = (profileQuery.data?.user.bio ?? "") === bio;

	const save = async () => {
		await updateBio.mutateAsync({
			bio,
		});
	};

	return (
		<div className="mx-auto w-full max-w-[1200px] px-4 py-5 sm:p-6">
			{userId ? (
				<Link
					to="/app/user/$userId"
					params={{ userId }}
					className="mb-4 inline-flex items-center gap-2 border-[2px] border-ds-muted3 px-3 py-1.5 text-[10px] font-extrabold tracking-widest text-ds-text-tertiary transition-colors hover:border-ds-accent hover:text-ds-accent"
				>
					<ArrowLeft className="h-3.5 w-3.5" />
					BACK_TO_PROFILE
				</Link>
			) : null}

			<div className="mb-8">
				<h1 className="text-2xl font-extrabold tracking-tighter sm:text-3xl">
					PROFILE
				</h1>
				<p className="mt-1 text-sm text-ds-muted">// EDIT YOUR PUBLIC BIO</p>
			</div>

			<div className="border-[3px] border-ds-border p-4 sm:p-6">
				<div className="mb-4 flex items-center gap-2">
					<UserRound className="h-4 w-4 text-ds-accent" />
					<span className="text-sm font-extrabold tracking-widest text-ds-accent">
						PROFILE_BIO
					</span>
				</div>

				{profileQuery.isLoading ? (
					<div className="h-24 animate-pulse bg-ds-surface" />
				) : (
					<div className="space-y-4">
						<div>
							<label
								htmlFor="profile-bio"
								className="mb-2 block text-xs font-bold tracking-widest text-ds-text-tertiary"
							>
								BIO
							</label>
							<textarea
								id="profile-bio"
								value={bio}
								onChange={(event) =>
									setBio(event.target.value.slice(0, BIO_MAX_LENGTH))
								}
								placeholder="Tell your team what you focus on..."
								rows={7}
								maxLength={BIO_MAX_LENGTH}
								className="w-full resize-y border-[3px] border-ds-muted3 bg-ds-input-bg px-4 py-3 text-sm text-ds-fg focus:border-ds-accent focus:outline-none placeholder:text-ds-muted2"
							/>
							<div className="mt-2 text-right text-[10px] font-bold tracking-widest text-ds-text-tertiary">
								{bioLength}/{BIO_MAX_LENGTH}
							</div>
						</div>

						<button
							type="button"
							onClick={() => void save()}
							disabled={isSaving || isUnchanged}
							className="inline-flex items-center justify-center gap-2 bg-ds-accent px-6 py-2.5 text-sm font-extrabold tracking-wider text-ds-accent-fg transition-colors hover:bg-ds-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
						>
							<Save className="h-4 w-4" />
							{isSaving ? "SAVING..." : "SAVE_BIO"}
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
