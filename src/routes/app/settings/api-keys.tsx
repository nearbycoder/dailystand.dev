import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	BookText,
	ChevronDown,
	Copy,
	KeyRound,
	Server,
	ShieldCheck,
	Trash2,
} from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/app/settings/api-keys")({
	component: ApiKeysPage,
});

type ApiKeyRecord = {
	id: string;
	name: string | null;
	start: string | null;
	prefix: string | null;
	enabled: boolean;
	createdAt: string | Date;
	expiresAt: string | Date | null;
	permissions: Record<string, string[]> | null;
};

type CreatedApiKeyRecord = ApiKeyRecord & {
	key: string;
};

const EXPIRATION_OPTIONS = [
	{ value: "7", label: "7 days" },
	{ value: "30", label: "30 days" },
	{ value: "90", label: "90 days" },
	{ value: "180", label: "180 days" },
	{ value: "365", label: "365 days" },
	{ value: "never", label: "Never expires" },
] as const;
const API_SCOPE_BASE = [
	"profile:read",
	"teams:read",
	"standups:read",
	"standups:write",
	"analytics:read",
] as const;
const API_SCOPE_MEMBER_MANAGE = "members:manage";

type ExpirationOptionValue = (typeof EXPIRATION_OPTIONS)[number]["value"];

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isPermissionsMap(
	value: unknown,
): value is Record<string, string[]> | null {
	if (value === null) return true;
	if (!isRecord(value)) return false;
	return Object.values(value).every(
		(actions) =>
			Array.isArray(actions) &&
			actions.every((action) => typeof action === "string"),
	);
}

function isApiKeyRecord(value: unknown): value is ApiKeyRecord {
	if (!isRecord(value)) return false;
	return (
		typeof value.id === "string" &&
		(typeof value.name === "string" || value.name === null) &&
		(typeof value.start === "string" || value.start === null) &&
		(typeof value.prefix === "string" || value.prefix === null) &&
		typeof value.enabled === "boolean" &&
		(typeof value.createdAt === "string" || value.createdAt instanceof Date) &&
		(typeof value.expiresAt === "string" ||
			value.expiresAt instanceof Date ||
			value.expiresAt === null) &&
		isPermissionsMap(value.permissions)
	);
}

function isCreatedApiKeyRecord(value: unknown): value is CreatedApiKeyRecord {
	if (!isRecord(value)) return false;
	const key = value["key"];
	return isApiKeyRecord(value) && typeof key === "string" && key.length > 0;
}

function isExpirationOptionValue(value: string): value is ExpirationOptionValue {
	return EXPIRATION_OPTIONS.some((option) => option.value === value);
}

function formatDateTime(value: string | Date | null | undefined): string {
	if (!value) return "Never";
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return "Unknown";
	return date.toLocaleString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}

function summarizePermissions(
	permissions: Record<string, string[]> | null,
): string {
	if (!permissions) return "NO_SCOPES";
	const scopes = Object.entries(permissions).flatMap(([resource, actions]) =>
		actions.map((action) => `${resource}.${action}`),
	);
	if (scopes.length === 0) return "NO_SCOPES";
	return scopes.slice(0, 3).join(", ").toUpperCase();
}

function ApiKeysPage() {
	const queryClient = useQueryClient();
	const [name, setName] = useState("Integration key");
	const [expiresInOption, setExpiresInOption] =
		useState<ExpirationOptionValue>("90");
	const [includeMemberManage, setIncludeMemberManage] = useState(false);
	const [createError, setCreateError] = useState("");
	const [newKeyValue, setNewKeyValue] = useState<string | null>(null);

	const apiBase = useMemo(
		() =>
			typeof window === "undefined"
				? "https://your-domain.com"
				: window.location.origin,
		[],
	);
	const mcpQuickInstallSnippet = useMemo(
		() => `{
  "mcpServers": {
    "dailystand": {
      "url": "${apiBase}/api/mcp",
      "headers": {
        "x-api-key": "YOUR_API_KEY"
      }
    }
  }
}`,
		[apiBase],
	);

	const apiKeysQuery = useQuery({
		queryKey: ["settings", "api-keys"],
		queryFn: async () => {
			const result = await authClient.apiKey.list();
			if (result.error) {
				throw new Error(result.error.message ?? "Failed to load API keys.");
			}
			const records = Array.isArray(result.data) ? result.data : [];
			return records.filter(isApiKeyRecord);
		},
	});

	const createMutation = useMutation({
		mutationFn: async (input: {
			name: string;
			expiresInSeconds: number | null;
			includeMemberManage: boolean;
		}) => {
			const permissions = {
				dailystand: input.includeMemberManage
					? [...API_SCOPE_BASE, API_SCOPE_MEMBER_MANAGE]
					: [...API_SCOPE_BASE],
			};
			const result = await authClient.apiKey.create({
				name: input.name,
				expiresIn: input.expiresInSeconds,
				metadata: {
					source: "settings.api-keys",
				},
				permissions,
			});
			if (result.error || !result.data) {
				throw new Error(result.error?.message ?? "Failed to create API key.");
			}
			if (!isCreatedApiKeyRecord(result.data)) {
				throw new Error("API key response did not match expected shape.");
			}
			return result.data;
		},
		onSuccess: (created) => {
			setCreateError("");
			setNewKeyValue(created.key);
			void queryClient.invalidateQueries({
				queryKey: ["settings", "api-keys"],
			});
		},
		onError: (error) => {
			setCreateError(error.message);
		},
	});

	const revokeMutation = useMutation({
		mutationFn: async (keyId: string) => {
			const result = await authClient.apiKey.delete({
				keyId,
			});
			if (result.error || !result.data?.success) {
				throw new Error(result.error?.message ?? "Failed to revoke API key.");
			}
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: ["settings", "api-keys"],
			});
		},
	});

	const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const cleanName = name.trim();
		if (!cleanName) {
			setCreateError("Key name is required.");
			return;
		}
		const expiresInSeconds =
			expiresInOption === "never"
				? null
				: Number(expiresInOption) * 24 * 60 * 60;
		await createMutation.mutateAsync({
			name: cleanName,
			expiresInSeconds,
			includeMemberManage,
		});
	};

	const copyToClipboard = async (value: string) => {
		try {
			await navigator.clipboard.writeText(value);
			toast.success("API key copied", {
				description: "Token copied to clipboard.",
			});
		} catch {
			toast.error("Copy failed", {
				description: "Clipboard access is blocked in this browser context.",
			});
		}
	};

	return (
		<div className="mx-auto w-full max-w-[1200px] px-4 py-5 sm:p-6">
			<div className="mb-8">
				<h1 className="text-2xl font-extrabold tracking-tighter sm:text-3xl">
					API_KEYS
				</h1>
				<p className="mt-1 text-sm text-ds-muted">
					{"// CREATE TOKENS FOR EXTERNAL INTEGRATIONS"}
				</p>
			</div>

			<div className="mb-6 border-[3px] border-ds-border p-4 sm:p-6">
				<div className="mb-4 flex items-center gap-2">
					<KeyRound className="h-4 w-4 text-ds-accent" />
					<span className="text-sm font-extrabold tracking-widest text-ds-accent">
						CREATE_API_KEY
					</span>
				</div>
				<form
					onSubmit={handleCreate}
					className="grid grid-cols-1 gap-3 md:grid-cols-5"
				>
					<input
						value={name}
						onChange={(event) => setName(event.target.value)}
						placeholder="CI token"
						className="md:col-span-3 min-w-0 border-[3px] border-ds-muted3 bg-ds-input-bg px-4 py-2.5 text-sm text-ds-fg placeholder:text-ds-muted2 focus:border-ds-accent focus:outline-none"
					/>
					<div className="relative min-w-0">
							<select
								value={expiresInOption}
								onChange={(event) => {
									const nextValue = event.target.value;
									if (isExpirationOptionValue(nextValue)) {
										setExpiresInOption(nextValue);
									}
								}}
								className="w-full appearance-none border-[3px] border-ds-muted3 bg-ds-input-bg px-4 py-2.5 pr-10 text-sm text-ds-fg focus:border-ds-accent focus:outline-none"
							>
							{EXPIRATION_OPTIONS.map((option) => (
								<option key={option.value} value={option.value}>
									{option.label.toUpperCase()}
								</option>
							))}
						</select>
						<span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-ds-text-tertiary">
							<ChevronDown className="h-4 w-4" />
						</span>
					</div>
					<button
						type="submit"
						disabled={createMutation.isPending}
						className="flex items-center justify-center gap-2 bg-ds-accent px-4 py-2.5 text-xs font-extrabold tracking-wider text-ds-accent-fg transition-colors hover:bg-ds-accent-hover disabled:opacity-50"
					>
						<ShieldCheck className="h-3.5 w-3.5" />
						{createMutation.isPending ? "CREATING..." : "CREATE"}
					</button>
				</form>
				<p className="mt-2 text-xs text-ds-muted">
					Default scope includes profile, teams, standups, and analytics access.
				</p>
				<label className="mt-2 flex items-center gap-2 text-xs font-bold tracking-wider text-ds-text-tertiary">
					<input
						type="checkbox"
						checked={includeMemberManage}
						onChange={(event) => setIncludeMemberManage(event.target.checked)}
						className="h-3.5 w-3.5 accent-ds-accent"
					/>
					INCLUDE_OWNER_MEMBER_MANAGEMENT_SCOPE
				</label>
				{createError && (
					<p className="mt-2 text-sm font-bold text-red-500 dark:text-red-400">
						ERROR: {createError}
					</p>
				)}
			</div>

			{newKeyValue && (
				<div className="mb-6 border-[3px] border-ds-accent bg-ds-accent/5 p-4 sm:p-5">
					<div className="mb-2 text-xs font-extrabold tracking-widest text-ds-accent">
						KEY_CREATED_COPY_NOW
					</div>
					<p className="mb-3 text-xs text-ds-muted">
						The full value is shown only once. Store it securely.
					</p>
					<div className="flex flex-col gap-2 sm:flex-row">
						<code className="min-w-0 flex-1 overflow-x-auto border-[2px] border-ds-muted3 bg-ds-input-bg px-3 py-2 text-xs">
							{newKeyValue}
						</code>
						<button
							type="button"
							onClick={() => copyToClipboard(newKeyValue)}
							className="flex items-center justify-center gap-2 border-[2px] border-ds-accent px-3 py-2 text-xs font-extrabold tracking-wider text-ds-accent transition-colors hover:bg-ds-accent hover:text-ds-accent-fg"
						>
							<Copy className="h-3.5 w-3.5" />
							COPY
						</button>
						<Link
							to="/app/settings/api-docs"
							className="flex items-center justify-center gap-2 border-[2px] border-ds-muted3 px-3 py-2 text-xs font-extrabold tracking-wider text-ds-text-secondary transition-colors hover:border-cyan-500 hover:text-cyan-500 dark:hover:text-cyan-400"
						>
							<BookText className="h-3.5 w-3.5" />
							OPEN_DOCS
						</Link>
					</div>
					<pre className="mt-3 overflow-x-auto border-[2px] border-ds-muted3 bg-ds-surface px-3 py-2 text-[11px] text-ds-text-secondary">
						{`curl -H "x-api-key: ${newKeyValue}" \\
  "${apiBase}/api/public/v1/me"`}
					</pre>
				</div>
			)}

			<div className="mb-6 border-[3px] border-ds-border p-4 sm:p-6">
				<div className="mb-2 text-sm font-extrabold tracking-widest text-ds-text-secondary">
					PUBLIC_API_BASE
				</div>
				<code className="block overflow-x-auto border-[2px] border-ds-muted3 bg-ds-input-bg px-3 py-2 text-xs">
					{`${apiBase}/api/public/v1`}
				</code>
			</div>

			<div className="mb-6 border-[3px] border-ds-border p-4 sm:p-6">
				<div className="mb-3 flex flex-wrap items-center justify-between gap-2">
					<div className="flex items-center gap-2">
						<Server className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
						<span className="text-sm font-extrabold tracking-widest text-cyan-600 dark:text-cyan-400">
							MCP_QUICK_INSTALL
						</span>
					</div>
					<button
						type="button"
						onClick={() => copyToClipboard(mcpQuickInstallSnippet)}
						className="inline-flex items-center justify-center gap-2 border-[2px] border-cyan-600 px-3 py-1.5 text-[10px] font-extrabold tracking-widest text-cyan-600 transition-colors hover:bg-cyan-600 hover:text-black dark:border-cyan-400 dark:text-cyan-400 dark:hover:bg-cyan-400"
					>
						<Copy className="h-3 w-3" />
						COPY_MCP_CONFIG
					</button>
				</div>
				<p className="mb-3 text-xs text-ds-muted">
					Paste into your MCP client config, then replace{" "}
					<code>YOUR_API_KEY</code> with a token from above.
				</p>
				<pre className="overflow-x-auto border-[2px] border-ds-muted3 bg-ds-surface px-3 py-2 text-[11px] text-ds-text-secondary">
					{mcpQuickInstallSnippet}
				</pre>
			</div>

			<div className="border-[3px] border-ds-border p-4 sm:p-6">
				<div className="mb-3 flex items-center justify-between">
					<h2 className="text-sm font-extrabold tracking-widest">
						ACTIVE_KEYS
					</h2>
					<span className="text-[10px] font-bold tracking-widest text-ds-text-tertiary">
						{apiKeysQuery.data?.length ?? 0} TOTAL
					</span>
				</div>

				{apiKeysQuery.isLoading ? (
					<div className="space-y-2">
						{[1, 2, 3].map((row) => (
							<div
								key={row}
								className="h-20 animate-pulse border-[2px] border-ds-muted3 bg-ds-surface/20"
							/>
						))}
					</div>
				) : apiKeysQuery.data && apiKeysQuery.data.length > 0 ? (
					<div className="space-y-2">
						{apiKeysQuery.data.map((apiKey) => (
							<div
								key={apiKey.id}
								className="border-[2px] border-ds-muted3 p-3"
							>
								<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
									<div className="min-w-0">
										<div className="truncate text-sm font-extrabold tracking-wide">
											{(apiKey.name ?? "UNNAMED").toUpperCase()}
										</div>
										<p className="mt-1 text-[11px] text-ds-text-tertiary">
											{(
												apiKey.start ?? `${apiKey.prefix ?? "ds_"}***`
											).toUpperCase()}
										</p>
									</div>
									<button
										type="button"
										onClick={() => revokeMutation.mutate(apiKey.id)}
										disabled={revokeMutation.isPending}
										className="inline-flex items-center justify-center gap-1 border-[2px] border-red-500 px-3 py-1.5 text-[10px] font-extrabold tracking-widest text-red-500 transition-colors hover:bg-red-500 hover:text-white disabled:opacity-50"
									>
										<Trash2 className="h-3 w-3" />
										REVOKE
									</button>
								</div>
								<div className="mt-3 grid grid-cols-1 gap-2 text-[10px] font-bold tracking-widest text-ds-text-tertiary sm:grid-cols-3">
									<div>
										CREATED: {formatDateTime(apiKey.createdAt).toUpperCase()}
									</div>
									<div>
										EXPIRES: {formatDateTime(apiKey.expiresAt).toUpperCase()}
									</div>
									<div>SCOPES: {summarizePermissions(apiKey.permissions)}</div>
								</div>
							</div>
						))}
					</div>
				) : (
					<p className="text-sm text-ds-muted">No API keys yet.</p>
				)}
			</div>
		</div>
	);
}
