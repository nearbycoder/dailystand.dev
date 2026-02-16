export type RestEndpointDoc = {
	id: string;
	label: string;
	method: "GET" | "POST";
	path: string;
	scope: string;
	description: string;
	queryHint?: string;
	bodyExample?: string;
	responseExample?: string;
};

export type McpMethodDoc = {
	id: string;
	label: string;
	method: "initialize" | "tools/list" | "tools/call";
	description: string;
	notes: string[];
	payloadExample: string;
};

export type McpToolDoc = {
	name: string;
	requiredScope: string;
	access: "member" | "owner_or_admin";
	description: string;
};

export const REST_ENDPOINTS: RestEndpointDoc[] = [
	{
		id: "docs",
		label: "API Root",
		method: "GET",
		path: "/api/public/v1",
		scope: "dailystand.profile:read",
		description: "API version, auth model, scopes, and endpoint catalog.",
	},
	{
		id: "me",
		label: "Get Current User Context",
		method: "GET",
		path: "/api/public/v1/me",
		scope: "dailystand.profile:read",
		description:
			"Returns actor profile, API key metadata, and organization memberships.",
	},
	{
		id: "teams",
		label: "List Organization Teams",
		method: "GET",
		path: "/api/public/v1/teams",
		scope: "dailystand.teams:read",
		description:
			"List teams for an organization with isMember and memberCount fields.",
		queryHint: "orgId=<optional>",
	},
	{
		id: "my-teams",
		label: "List My Teams",
		method: "GET",
		path: "/api/public/v1/teams/mine",
		scope: "dailystand.teams:read",
		description:
			"Returns only teams the token owner belongs to in the selected organization.",
		queryHint: "orgId=<optional>",
	},
	{
		id: "standups-day",
		label: "Get Team Standups (Day)",
		method: "GET",
		path: "/api/public/v1/standups/day",
		scope: "dailystand.standups:read",
		description:
			"Read standups for one day; optional team scope includes global entries fallback.",
		queryHint: "date=2026-02-16&orgId=<optional>&teamId=<optional>",
	},
	{
		id: "standups-history",
		label: "Get Team Standups (History)",
		method: "GET",
		path: "/api/public/v1/standups/history",
		scope: "dailystand.standups:read",
		description:
			"Read historical standups by date range with optional team scope.",
		queryHint:
			"startDate=2026-02-01&endDate=2026-02-16&orgId=<optional>&teamId=<optional>",
	},
	{
		id: "standups-upsert",
		label: "Submit Standup",
		method: "POST",
		path: "/api/public/v1/standups",
		scope: "dailystand.standups:write",
		description:
			"Create or replace your standup for a date/team scope. Empty entries clears that scope for the day.",
		bodyExample: JSON.stringify(
			{
				orgId: "ORG_ID",
				date: "2026-02-16",
				teamId: "TEAM_ID",
				entries: [
					{ type: "completed", content: "Shipped mobile timeline fix" },
					{ type: "planned", content: "Review team analytics outliers" },
					{ type: "blocker", content: "Waiting on staging access" },
				],
			},
			null,
			2,
		),
	},
	{
		id: "analytics",
		label: "Get Analytics",
		method: "GET",
		path: "/api/public/v1/analytics",
		scope: "dailystand.analytics:read",
		description:
			"Aggregated stats for standups across selected range and optional team.",
		queryHint: "rangeDays=30&orgId=<optional>&teamId=<optional>",
	},
];

export const MCP_METHODS: McpMethodDoc[] = [
	{
		id: "initialize",
		label: "Initialize Session",
		method: "initialize",
		description: "Start MCP handshake and get protocol capabilities.",
		notes: [
			"Call this first.",
			"Response includes protocolVersion and serverInfo.",
		],
		payloadExample: JSON.stringify(
			{
				jsonrpc: "2.0",
				id: 1,
				method: "initialize",
				params: {},
			},
			null,
			2,
		),
	},
	{
		id: "tools-list",
		label: "List Tools",
		method: "tools/list",
		description: "Return tools available for the current API key permissions.",
		notes: [
			"Requires dailystand.profile:read permission.",
			"Use this to discover allowed tool names and schemas.",
		],
		payloadExample: JSON.stringify(
			{
				jsonrpc: "2.0",
				id: 2,
				method: "tools/list",
				params: {},
			},
			null,
			2,
		),
	},
	{
		id: "tools-call",
		label: "Call Tool",
		method: "tools/call",
		description: "Execute one MCP tool with validated arguments.",
		notes: [
			"Tool availability depends on API key scopes and role.",
			"Response uses MCP tool result envelope with content + structuredContent.",
		],
		payloadExample: JSON.stringify(
			{
				jsonrpc: "2.0",
				id: 3,
				method: "tools/call",
				params: {
					name: "submit_my_standup",
					arguments: {
						orgId: "ORG_ID",
						teamId: "TEAM_ID",
						date: "2026-02-16",
						entries: [
							{ type: "completed", content: "Finished request explorer page" },
							{ type: "planned", content: "Add API docs examples" },
						],
					},
				},
			},
			null,
			2,
		),
	},
];

export const MCP_TOOLS: McpToolDoc[] = [
	{
		name: "list_organizations",
		requiredScope: "dailystand.profile:read",
		access: "member",
		description: "List organizations for the API key user.",
	},
	{
		name: "list_teams",
		requiredScope: "dailystand.teams:read",
		access: "member",
		description: "List all teams in an organization with membership status.",
	},
	{
		name: "list_my_teams",
		requiredScope: "dailystand.teams:read",
		access: "member",
		description: "List only teams the API key user belongs to.",
	},
	{
		name: "list_org_members",
		requiredScope: "dailystand.members:manage",
		access: "owner_or_admin",
		description: "List organization members with roles.",
	},
	{
		name: "add_organization_member",
		requiredScope: "dailystand.members:manage",
		access: "owner_or_admin",
		description: "Invite/add an organization member (owner/admin only).",
	},
	{
		name: "assign_user_to_team",
		requiredScope: "dailystand.members:manage",
		access: "owner_or_admin",
		description: "Assign a user to team (owner/admin only).",
	},
	{
		name: "remove_user_from_team",
		requiredScope: "dailystand.members:manage",
		access: "owner_or_admin",
		description: "Remove a user from a team (owner/admin only).",
	},
	{
		name: "submit_my_standup",
		requiredScope: "dailystand.standups:write",
		access: "member",
		description: "Submit current user's standup for date/team scope.",
	},
	{
		name: "get_my_standup",
		requiredScope: "dailystand.standups:read",
		access: "member",
		description: "Get current user's standup for one date/team.",
	},
	{
		name: "get_my_standup_history",
		requiredScope: "dailystand.standups:read",
		access: "member",
		description: "Get current user's standup history for date ranges.",
	},
	{
		name: "get_team_standup_day",
		requiredScope: "dailystand.standups:read",
		access: "member",
		description: "Get one team's standups for a single day.",
	},
	{
		name: "get_team_standup_history",
		requiredScope: "dailystand.standups:read",
		access: "member",
		description: "Get one team's standup history with limits.",
	},
];
