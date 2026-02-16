import { createFileRoute, Link } from "@tanstack/react-router";
import {
	BookText,
	Copy,
	Eye,
	EyeOff,
	KeyRound,
	Server,
	Terminal,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/settings/api-docs")({
	component: ApiDocsPage,
});

type Snippet = {
	id: string;
	title: string;
	description: string;
	scope: string;
	template: string;
};

type PublicApiDocsPayload = {
	baseUrl?: string;
	endpoints?: Record<string, string>;
	permissionScopes?: {
		resource?: string;
		actions?: string[];
	};
};

type PublicApiDocsResponse = {
	success?: boolean;
	data?: PublicApiDocsPayload;
};

type McpMetaResponse = {
	name?: string;
	version?: string;
	endpoint?: string;
	transport?: string;
	notes?: string[];
};

type McpToolsRpcResponse = {
	error?: { message?: string };
	result?: {
		tools?: Array<{ name: string; description?: string }>;
	};
};

function maskApiKey(value: string): string {
	if (!value) return "YOUR_API_KEY";
	if (value.length <= 8) return "*".repeat(value.length);
	const middle = "*".repeat(Math.max(6, value.length - 8));
	return `${value.slice(0, 4)}${middle}${value.slice(-4)}`;
}

function ApiDocsPage() {
	const [apiKeySecret, setApiKeySecret] = useState("");
	const [showKey, setShowKey] = useState(false);
	const [copiedSnippetId, setCopiedSnippetId] = useState<string | null>(null);
	const [publicApiDocs, setPublicApiDocs] =
		useState<PublicApiDocsPayload | null>(null);
	const [mcpMeta, setMcpMeta] = useState<McpMetaResponse | null>(null);
	const [loadingLiveDocs, setLoadingLiveDocs] = useState(false);
	const [liveDocsError, setLiveDocsError] = useState("");
	const [discoveringTools, setDiscoveringTools] = useState(false);
	const [discoveredTools, setDiscoveredTools] = useState<
		Array<{ name: string; description?: string }>
	>([]);
	const [discoveryError, setDiscoveryError] = useState("");

	const apiBase = useMemo(
		() =>
			typeof window === "undefined"
				? "https://your-domain.com"
				: window.location.origin,
		[],
	);

	useEffect(() => {
		let isActive = true;

		const loadLiveDocs = async () => {
			setLoadingLiveDocs(true);
			setLiveDocsError("");
			try {
				const [publicResponse, mcpResponse] = await Promise.all([
					fetch(`${apiBase}/api/public/v1`),
					fetch(`${apiBase}/api/mcp`),
				]);

				const [publicJson, mcpJson] = (await Promise.all([
					publicResponse.json().catch(() => null),
					mcpResponse.json().catch(() => null),
				])) as [PublicApiDocsResponse | null, McpMetaResponse | null];

				if (!isActive) return;

				if (publicResponse.ok && publicJson?.success && publicJson.data) {
					setPublicApiDocs(publicJson.data);
				}

				if (mcpResponse.ok && mcpJson) {
					setMcpMeta(mcpJson);
				}

				if (!publicResponse.ok || !mcpResponse.ok) {
					setLiveDocsError(
						"Some live docs metadata could not be loaded. Static examples are still valid.",
					);
				}
			} catch {
				if (!isActive) return;
				setLiveDocsError(
					"Live docs metadata is unavailable right now. Static examples are still valid.",
				);
			} finally {
				if (isActive) {
					setLoadingLiveDocs(false);
				}
			}
		};

		void loadLiveDocs();

		return () => {
			isActive = false;
		};
	}, [apiBase]);

	const normalizedKey = apiKeySecret.trim();
	const visibleKeyPreview = maskApiKey(normalizedKey);

	const injectKey = (template: string): string => {
		const keyForCopy = normalizedKey || "YOUR_API_KEY";
		return template.replaceAll("{{API_KEY}}", keyForCopy);
	};

	const renderSnippet = (template: string): string => {
		const withKey = injectKey(template);
		if (!normalizedKey) return withKey;
		return withKey.replaceAll(normalizedKey, visibleKeyPreview);
	};

	const saveKey = (nextValue: string) => {
		setApiKeySecret(nextValue);
	};

	const copySnippet = async (snippetId: string, template: string) => {
		const text = injectKey(template);
		try {
			await navigator.clipboard.writeText(text);
			setCopiedSnippetId(snippetId);
			toast.success("Snippet copied", {
				description: "Ready to paste with your current API key.",
			});
			window.setTimeout(() => {
				setCopiedSnippetId((current) =>
					current === snippetId ? null : current,
				);
			}, 1800);
		} catch {
			setCopiedSnippetId(null);
			toast.error("Copy failed", {
				description: "Clipboard access is blocked in this browser context.",
			});
		}
	};

	const discoverTools = async () => {
		if (!normalizedKey) {
			setDiscoveryError("Provide an API key to discover tool access.");
			setDiscoveredTools([]);
			return;
		}

		setDiscoveringTools(true);
		setDiscoveryError("");

		try {
			const response = await fetch(`${apiBase}/api/mcp`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-api-key": normalizedKey,
				},
				body: JSON.stringify({
					jsonrpc: "2.0",
					id: 99,
					method: "tools/list",
					params: {},
				}),
			});

			const payload = (await response
				.json()
				.catch(() => null)) as McpToolsRpcResponse | null;

			const tools = payload?.result?.tools;
			if (!response.ok || !Array.isArray(tools)) {
				throw new Error(
					payload?.error?.message ?? "Unable to discover tools for this key.",
				);
			}

			setDiscoveredTools(tools);
		} catch (error) {
			setDiscoveredTools([]);
			setDiscoveryError(
				error instanceof Error
					? error.message
					: "Unable to discover tools for this key.",
			);
		} finally {
			setDiscoveringTools(false);
		}
	};

	const restSnippets: Snippet[] = [
		{
			id: "rest-me",
			title: "Get Current User Context",
			description:
				"Verify key access and list organizations available to the token owner.",
			scope: "dailystand.profile:read",
			template: `curl -s "${apiBase}/api/public/v1/me" \\
  -H "x-api-key: {{API_KEY}}"`,
		},
		{
			id: "rest-teams",
			title: "List Teams",
			description: "List team roster size for one organization.",
			scope: "dailystand.teams:read",
			template: `curl -s "${apiBase}/api/public/v1/teams?orgId=ORG_ID" \\
  -H "x-api-key: {{API_KEY}}"`,
		},
		{
			id: "rest-my-teams",
			title: "List My Teams",
			description:
				"Return only teams the API key user belongs to in the organization.",
			scope: "dailystand.teams:read",
			template: `curl -s "${apiBase}/api/public/v1/teams/mine?orgId=ORG_ID" \\
  -H "x-api-key: {{API_KEY}}"`,
		},
		{
			id: "rest-team-standups-day",
			title: "Read Team Standups (Day)",
			description:
				"Read a team's daily standups (team members only, with global fallback).",
			scope: "dailystand.standups:read",
			template: `curl -s "${apiBase}/api/public/v1/standups/day?orgId=ORG_ID&teamId=TEAM_ID&date=2026-02-16" \\
  -H "x-api-key: {{API_KEY}}"`,
		},
		{
			id: "rest-submit",
			title: "Submit Standup",
			description:
				"Submit or replace your own standup for a date/team scope using API keys.",
			scope: "dailystand.standups:write",
			template: `curl -s -X POST "${apiBase}/api/public/v1/standups" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: {{API_KEY}}" \\
  -d '{
    "orgId": "ORG_ID",
    "date": "2026-02-16",
    "teamId": "TEAM_ID",
    "entries": [
      { "type": "completed", "content": "Shipped mobile layout fix" },
      { "type": "planned", "content": "Review analytics scope" }
    ]
  }'`,
		},
		{
			id: "rest-analytics",
			title: "Read Analytics",
			description: "Read team/org analytics for dashboard and reporting flows.",
			scope: "dailystand.analytics:read",
			template: `curl -s "${apiBase}/api/public/v1/analytics?orgId=ORG_ID&rangeDays=30&teamId=TEAM_ID" \\
  -H "x-api-key: {{API_KEY}}"`,
		},
	];

	const mcpSnippets: Snippet[] = [
		{
			id: "mcp-init",
			title: "MCP Initialize",
			description: "Handshake with the server before listing/calling tools.",
			scope: "dailystand.profile:read",
			template: `curl -s -X POST "${apiBase}/api/mcp" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: {{API_KEY}}" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {}
  }'`,
		},
		{
			id: "mcp-list-tools",
			title: "MCP Tool Discovery",
			description: "List all tools available for this API key.",
			scope: "dailystand.profile:read",
			template: `curl -s -X POST "${apiBase}/api/mcp" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: {{API_KEY}}" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list",
    "params": {}
	  }'`,
		},
		{
			id: "mcp-my-teams",
			title: "MCP List My Teams",
			description: "Get only your team memberships for one organization.",
			scope: "dailystand.teams:read",
			template: `curl -s -X POST "${apiBase}/api/mcp" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: {{API_KEY}}" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "list_my_teams",
      "arguments": {
        "orgId": "ORG_ID"
      }
    }
  }'`,
		},
		{
			id: "mcp-submit-standup",
			title: "MCP Submit My Standup",
			description: "Member-level daily standup write with team targeting.",
			scope: "dailystand.standups:write",
			template: `curl -s -X POST "${apiBase}/api/mcp" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: {{API_KEY}}" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 4,
    "method": "tools/call",
    "params": {
      "name": "submit_my_standup",
      "arguments": {
        "orgId": "ORG_ID",
        "teamId": "TEAM_ID",
        "date": "2026-02-16",
        "completed": ["Shipped API key docs"],
        "planned": ["Review blockers"],
        "blockers": []
      }
    }
	  }'`,
		},
		{
			id: "mcp-get-history",
			title: "MCP Get My Standup History",
			description: "Read your own history for a team or whole organization.",
			scope: "dailystand.standups:read",
			template: `curl -s -X POST "${apiBase}/api/mcp" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: {{API_KEY}}" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 5,
    "method": "tools/call",
    "params": {
      "name": "get_my_standup_history",
      "arguments": {
        "orgId": "ORG_ID",
        "teamId": "TEAM_ID",
        "limit": 30
      }
    }
	  }'`,
		},
		{
			id: "mcp-get-team-day",
			title: "MCP Get Team Standup Day",
			description:
				"Read team standups for one day (requires membership in the target team).",
			scope: "dailystand.standups:read",
			template: `curl -s -X POST "${apiBase}/api/mcp" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: {{API_KEY}}" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 6,
    "method": "tools/call",
    "params": {
      "name": "get_team_standup_day",
      "arguments": {
        "orgId": "ORG_ID",
        "teamId": "TEAM_ID",
        "date": "2026-02-16"
      }
    }
	  }'`,
		},
		{
			id: "mcp-assign",
			title: "MCP Assign User To Team (Owner)",
			description: "Owner-only operation to manage team membership.",
			scope: "dailystand.members:manage + owner role",
			template: `curl -s -X POST "${apiBase}/api/mcp" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: {{API_KEY}}" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 7,
    "method": "tools/call",
    "params": {
      "name": "assign_user_to_team",
      "arguments": {
        "orgId": "ORG_ID",
        "teamId": "TEAM_ID",
        "userId": "USER_ID"
      }
    }
  }'`,
		},
	];

	const mcpClientConfigTemplate = `{
  "mcpServers": {
    "dailystand": {
      "transport": "http",
      "url": "${apiBase}/api/mcp",
      "headers": {
        "x-api-key": "{{API_KEY}}"
      }
    }
  }
}`;

	return (
		<div className="mx-auto w-full max-w-[1200px] px-4 py-5 sm:p-6">
			<div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h1 className="text-2xl font-extrabold tracking-tighter sm:text-3xl">
						API_DOCS
					</h1>
					<p className="mt-1 text-sm text-ds-muted">
						{"// REST + MCP INTEGRATION GUIDE"}
					</p>
				</div>
				<Link
					to="/app/settings/api-keys"
					className="inline-flex items-center gap-2 border-[2px] border-ds-muted3 px-3 py-2 text-[11px] font-extrabold tracking-widest text-ds-text-secondary transition-colors hover:border-ds-accent hover:text-ds-accent"
				>
					<KeyRound className="h-3.5 w-3.5" />
					MANAGE_KEYS
				</Link>
			</div>

			<div className="mb-6 border-[3px] border-ds-border p-4 sm:p-6">
				<div className="mb-3 flex items-center gap-2">
					<KeyRound className="h-4 w-4 text-ds-accent" />
					<h2 className="text-sm font-extrabold tracking-widest text-ds-accent">
						ACTIVE_KEY_FOR_SNIPPETS
					</h2>
				</div>
				<p className="mb-3 text-xs text-ds-muted">
					Paste your API key for this page session. It stays in-memory only and
					is not persisted to browser storage.
				</p>
				<div className="flex flex-col gap-2 sm:flex-row">
					<input
						type={showKey ? "text" : "password"}
						value={apiKeySecret}
						onChange={(event) => saveKey(event.target.value)}
						placeholder="ds_..."
						className="min-w-0 flex-1 border-[3px] border-ds-muted3 bg-ds-input-bg px-3 py-2 text-sm text-ds-fg placeholder:text-ds-muted2 focus:border-ds-accent focus:outline-none"
					/>
					<button
						type="button"
						onClick={() => setShowKey((current) => !current)}
						className="inline-flex items-center justify-center gap-2 border-[2px] border-ds-muted3 px-3 py-2 text-[11px] font-extrabold tracking-widest text-ds-text-secondary transition-colors hover:border-ds-accent hover:text-ds-accent"
					>
						{showKey ? (
							<EyeOff className="h-3.5 w-3.5" />
						) : (
							<Eye className="h-3.5 w-3.5" />
						)}
						{showKey ? "HIDE" : "SHOW"}
					</button>
					<button
						type="button"
						onClick={() => saveKey("")}
						className="inline-flex items-center justify-center gap-2 border-[2px] border-ds-muted3 px-3 py-2 text-[11px] font-extrabold tracking-widest text-ds-text-secondary transition-colors hover:border-red-500 hover:text-red-500"
					>
						CLEAR
					</button>
				</div>
				<div className="mt-3 text-[11px] font-bold tracking-wider text-ds-text-tertiary">
					VIEW PREVIEW: {visibleKeyPreview}
				</div>
			</div>

			<div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
				<div className="border-[3px] border-ds-border p-4 sm:p-5">
					<div className="mb-2 flex items-center gap-2 text-ds-accent">
						<Terminal className="h-4 w-4" />
						<h3 className="text-sm font-extrabold tracking-widest">
							PUBLIC_REST_API
						</h3>
					</div>
					<p className="text-xs text-ds-muted">
						Base URL: <code>{`${apiBase}/api/public/v1`}</code>
					</p>
					<p className="mt-2 text-xs text-ds-muted">
						Auth header: <code>x-api-key: ...</code> (Bearer auth also
						supported)
					</p>
				</div>
				<div className="border-[3px] border-ds-border p-4 sm:p-5">
					<div className="mb-2 flex items-center gap-2 text-cyan-600 dark:text-cyan-400">
						<Server className="h-4 w-4" />
						<h3 className="text-sm font-extrabold tracking-widest">
							MCP_SERVER
						</h3>
					</div>
					<p className="text-xs text-ds-muted">
						Endpoint: <code>{`${apiBase}/api/mcp`}</code>
					</p>
					<p className="mt-2 text-xs text-ds-muted">
						Transport: JSON-RPC 2.0 over HTTP POST
					</p>
				</div>
			</div>

			<div className="mb-6 border-[3px] border-ds-border p-4 sm:p-6">
				<div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h2 className="text-sm font-extrabold tracking-widest">
							LIVE_CAPABILITY_CHECK
						</h2>
						<p className="mt-1 text-xs text-ds-muted">
							Reads metadata directly from your running server and can discover
							MCP tools using the key above.
						</p>
					</div>
					<button
						type="button"
						onClick={discoverTools}
						disabled={discoveringTools}
						className="inline-flex items-center justify-center gap-2 border-[2px] border-ds-accent px-3 py-2 text-[11px] font-extrabold tracking-widest text-ds-accent transition-colors hover:bg-ds-accent hover:text-ds-accent-fg disabled:opacity-50"
					>
						{discoveringTools ? "DISCOVERING..." : "DISCOVER_MCP_TOOLS"}
					</button>
				</div>

				{loadingLiveDocs ? (
					<div className="text-xs text-ds-muted">
						Loading live docs metadata...
					</div>
				) : (
					<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
						<div className="border-[2px] border-ds-muted3 p-3">
							<div className="text-[10px] font-extrabold tracking-widest text-ds-text-tertiary">
								LIVE_PUBLIC_ENDPOINTS
							</div>
							<div className="mt-2 space-y-1 text-xs text-ds-text-secondary">
								{Object.entries(publicApiDocs?.endpoints ?? {}).length > 0 ? (
									Object.entries(publicApiDocs?.endpoints ?? {}).map(
										([name, endpoint]) => (
											<div key={name}>
												<span className="font-extrabold">
													{name.toUpperCase()}
												</span>
												: {endpoint}
											</div>
										),
									)
								) : (
									<div className="text-ds-muted">
										No endpoint metadata loaded.
									</div>
								)}
							</div>
						</div>

						<div className="border-[2px] border-ds-muted3 p-3">
							<div className="text-[10px] font-extrabold tracking-widest text-ds-text-tertiary">
								LIVE_MCP_NOTES
							</div>
							<div className="mt-2 space-y-1 text-xs text-ds-text-secondary">
								{(mcpMeta?.notes ?? []).length > 0 ? (
									mcpMeta?.notes?.map((note) => <div key={note}>{note}</div>)
								) : (
									<div className="text-ds-muted">
										No MCP metadata notes loaded.
									</div>
								)}
							</div>
						</div>
					</div>
				)}

				{liveDocsError ? (
					<p className="mt-3 text-xs font-bold tracking-wide text-red-500 dark:text-red-400">
						{liveDocsError}
					</p>
				) : null}

				<div className="mt-3 border-[2px] border-ds-muted3 p-3">
					<div className="mb-1 text-[10px] font-extrabold tracking-widest text-ds-text-tertiary">
						KEY_SCOPED_MCP_TOOLS
					</div>
					{discoveredTools.length > 0 ? (
						<div className="flex flex-wrap gap-2">
							{discoveredTools.map((tool) => (
								<span
									key={tool.name}
									className="inline-flex border border-ds-muted3 bg-ds-input-bg px-2 py-1 text-[10px] font-extrabold tracking-wider text-ds-text-secondary"
									title={tool.description ?? ""}
								>
									{tool.name}
								</span>
							))}
						</div>
					) : (
						<div className="text-xs text-ds-muted">
							Run discovery to list tools available to the current key.
						</div>
					)}
					{discoveryError ? (
						<p className="mt-2 text-xs font-bold tracking-wide text-red-500 dark:text-red-400">
							{discoveryError}
						</p>
					) : null}
				</div>
			</div>

			<div className="mb-6 border-[3px] border-ds-border p-4 sm:p-6">
				<div className="mb-3 flex items-center justify-between">
					<h2 className="text-sm font-extrabold tracking-widest">
						CAPABILITY_MATRIX
					</h2>
					<span className="text-[10px] font-bold tracking-widest text-ds-text-tertiary">
						ROLE + SCOPE ENFORCED
					</span>
				</div>
				<div className="overflow-x-auto">
					<table className="w-full min-w-[640px] border-collapse text-xs">
						<thead>
							<tr className="border-b-[2px] border-ds-muted3 text-ds-text-tertiary">
								<th className="px-2 py-2 text-left font-extrabold tracking-widest">
									ACTION
								</th>
								<th className="px-2 py-2 text-left font-extrabold tracking-widest">
									ROLE
								</th>
								<th className="px-2 py-2 text-left font-extrabold tracking-widest">
									REQUIRED_SCOPE
								</th>
							</tr>
						</thead>
						<tbody className="text-ds-text-secondary">
							<tr className="border-b border-ds-muted3/70">
								<td className="px-2 py-2">Add org member</td>
								<td className="px-2 py-2">Owner</td>
								<td className="px-2 py-2">dailystand.members:manage</td>
							</tr>
							<tr className="border-b border-ds-muted3/70">
								<td className="px-2 py-2">Assign/remove team members</td>
								<td className="px-2 py-2">Owner</td>
								<td className="px-2 py-2">dailystand.members:manage</td>
							</tr>
							<tr className="border-b border-ds-muted3/70">
								<td className="px-2 py-2">Read own team memberships</td>
								<td className="px-2 py-2">Member</td>
								<td className="px-2 py-2">dailystand.teams:read</td>
							</tr>
							<tr className="border-b border-ds-muted3/70">
								<td className="px-2 py-2">Submit own standup</td>
								<td className="px-2 py-2">Member</td>
								<td className="px-2 py-2">dailystand.standups:write</td>
							</tr>
							<tr className="border-b border-ds-muted3/70">
								<td className="px-2 py-2">Read own standup/history</td>
								<td className="px-2 py-2">Member</td>
								<td className="px-2 py-2">dailystand.standups:read</td>
							</tr>
							<tr>
								<td className="px-2 py-2">Read team standups (team member)</td>
								<td className="px-2 py-2">Member of target team</td>
								<td className="px-2 py-2">dailystand.standups:read</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>

			<SnippetSection
				title="REST_QUICKSTART"
				description="Production-ready curl snippets for common integration flows."
				snippets={restSnippets}
				renderSnippet={renderSnippet}
				onCopySnippet={copySnippet}
				copiedSnippetId={copiedSnippetId}
			/>

			<div className="my-6 border-[3px] border-ds-border p-4 sm:p-6">
				<div className="mb-3 flex items-center gap-2">
					<BookText className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
					<h2 className="text-sm font-extrabold tracking-widest">
						MCP_CLIENT_CONFIG
					</h2>
				</div>
				<p className="mb-3 text-xs text-ds-muted">
					Use this in MCP-compatible clients that support HTTP transport +
					headers.
				</p>
				<SnippetPanel
					snippet={{
						id: "mcp-config",
						title: "Client JSON",
						description: "",
						scope: "",
						template: mcpClientConfigTemplate,
					}}
					renderSnippet={renderSnippet}
					onCopySnippet={copySnippet}
					copiedSnippetId={copiedSnippetId}
				/>
			</div>

			<SnippetSection
				title="MCP_JSON_RPC_FLOW"
				description="Initialize, discover tools, then execute role-aware operations."
				snippets={mcpSnippets}
				renderSnippet={renderSnippet}
				onCopySnippet={copySnippet}
				copiedSnippetId={copiedSnippetId}
			/>
		</div>
	);
}

function SnippetSection({
	title,
	description,
	snippets,
	renderSnippet,
	onCopySnippet,
	copiedSnippetId,
}: {
	title: string;
	description: string;
	snippets: Snippet[];
	renderSnippet: (template: string) => string;
	onCopySnippet: (snippetId: string, template: string) => Promise<void>;
	copiedSnippetId: string | null;
}) {
	return (
		<div className="mb-6 border-[3px] border-ds-border p-4 sm:p-6">
			<div className="mb-3">
				<h2 className="text-sm font-extrabold tracking-widest">{title}</h2>
				<p className="mt-1 text-xs text-ds-muted">{description}</p>
			</div>
			<div className="space-y-3">
				{snippets.map((snippet) => (
					<SnippetPanel
						key={snippet.id}
						snippet={snippet}
						renderSnippet={renderSnippet}
						onCopySnippet={onCopySnippet}
						copiedSnippetId={copiedSnippetId}
					/>
				))}
			</div>
		</div>
	);
}

function SnippetPanel({
	snippet,
	renderSnippet,
	onCopySnippet,
	copiedSnippetId,
}: {
	snippet: Snippet;
	renderSnippet: (template: string) => string;
	onCopySnippet: (snippetId: string, template: string) => Promise<void>;
	copiedSnippetId: string | null;
}) {
	return (
		<div className="border-[2px] border-ds-muted3 p-3 sm:p-4">
			<div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
				<div className="min-w-0">
					<div className="text-xs font-extrabold tracking-widest text-ds-text-secondary">
						{snippet.title.toUpperCase()}
					</div>
					{snippet.description ? (
						<p className="mt-1 text-xs text-ds-muted">{snippet.description}</p>
					) : null}
					{snippet.scope ? (
						<p className="mt-1 text-[10px] font-bold tracking-widest text-ds-text-tertiary">
							SCOPE: {snippet.scope}
						</p>
					) : null}
				</div>
				<button
					type="button"
					onClick={() => onCopySnippet(snippet.id, snippet.template)}
					className="inline-flex items-center justify-center gap-2 border-[2px] border-ds-muted3 px-3 py-1.5 text-[10px] font-extrabold tracking-widest text-ds-text-secondary transition-colors hover:border-ds-accent hover:text-ds-accent"
				>
					<Copy className="h-3 w-3" />
					{copiedSnippetId === snippet.id ? "COPIED" : "COPY"}
				</button>
			</div>
			<pre className="overflow-x-auto bg-ds-input-bg border-[2px] border-ds-muted3 p-3 text-[11px] text-ds-text-secondary">
				{renderSnippet(snippet.template)}
			</pre>
		</div>
	);
}
