import { createFileRoute } from "@tanstack/react-router";
import { ImageResponse } from "@vercel/og";

type OgPage = "home" | "docs" | "privacy" | "terms";

type OgTheme = {
	label: string;
	title: string;
	subtitle: string;
	background: string;
	accent: string;
	tags: string[];
};

const OG_THEMES: Record<OgPage, OgTheme> = {
	home: {
		label: "ASYNC STANDUPS",
		title: "Daily standups without meetings",
		subtitle:
			"Open source standup software for remote teams with analytics, API access, and MCP support.",
		background:
			"linear-gradient(135deg, #0b1426 0%, #10203b 35%, #0f3a2f 100%)",
		accent: "#50f0c2",
		tags: ["OPEN SOURCE", "SELF HOSTED", "MCP + AI"],
	},
	docs: {
		label: "DEVELOPER DOCS",
		title: "Public API and MCP documentation",
		subtitle:
			"Integrate standup workflows with REST endpoints, API keys, and JSON-RPC tooling.",
		background:
			"linear-gradient(135deg, #0d1117 0%, #18263b 40%, #3a1f50 100%)",
		accent: "#6bd3ff",
		tags: ["REST API", "MCP SERVER", "LIVE EXPLORER"],
	},
	privacy: {
		label: "PRIVACY",
		title: "Privacy policy for DailyStand",
		subtitle:
			"How DailyStand handles account data, standup content, and organization security.",
		background:
			"linear-gradient(135deg, #111827 0%, #1f2937 45%, #334155 100%)",
		accent: "#7dd3fc",
		tags: ["DATA HANDLING", "SECURITY", "TRUST"],
	},
	terms: {
		label: "TERMS",
		title: "Terms of service for DailyStand",
		subtitle:
			"Service terms, billing details, and platform usage expectations for teams.",
		background:
			"linear-gradient(135deg, #1f1429 0%, #2d1a3f 45%, #3b1f2a 100%)",
		accent: "#fda4af",
		tags: ["SERVICE TERMS", "BILLING", "ACCOUNT USE"],
	},
};

function sanitizeText(
	value: string | null,
	fallback: string,
	maxLength: number,
) {
	if (!value) return fallback;
	const trimmed = value.replace(/\s+/g, " ").trim();
	if (!trimmed) return fallback;
	return trimmed.slice(0, maxLength);
}

function resolvePage(value: string | null): OgPage {
	if (value === "docs" || value === "privacy" || value === "terms") {
		return value;
	}
	return "home";
}

export const Route = createFileRoute("/api/og")({
	server: {
		handlers: {
			GET: ({ request }) => {
				const url = new URL(request.url);
				const page = resolvePage(url.searchParams.get("page"));
				const theme = OG_THEMES[page];
				const title = sanitizeText(
					url.searchParams.get("title"),
					theme.title,
					72,
				);
				const subtitle = sanitizeText(
					url.searchParams.get("subtitle"),
					theme.subtitle,
					140,
				);

				return new ImageResponse(
					<div
						style={{
							height: "100%",
							width: "100%",
							display: "flex",
							position: "relative",
							overflow: "hidden",
							fontFamily:
								'"IBM Plex Mono", "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", monospace',
							background: theme.background,
							color: "#f8fbff",
							padding: "56px 62px",
							flexDirection: "column",
							justifyContent: "space-between",
						}}
					>
						<div
							style={{
								position: "absolute",
								top: "-120px",
								right: "-140px",
								width: "420px",
								height: "420px",
								borderRadius: "9999px",
								background: `${theme.accent}20`,
								border: `2px solid ${theme.accent}55`,
							}}
						/>
						<div
							style={{
								position: "absolute",
								bottom: "-70px",
								left: "-90px",
								width: "290px",
								height: "290px",
								borderRadius: "9999px",
								background: `${theme.accent}1f`,
								border: `2px solid ${theme.accent}50`,
							}}
						/>

						<div
							style={{ display: "flex", flexDirection: "column", gap: "26px" }}
						>
							<div
								style={{
									display: "inline-flex",
									alignItems: "center",
									gap: "14px",
									fontSize: 26,
									fontWeight: 800,
									letterSpacing: "0.14em",
									color: theme.accent,
								}}
							>
								<span>DAILYSTAND</span>
								<span style={{ color: "#9fb3c8" }}>//</span>
								<span>{theme.label}</span>
							</div>
							<div
								style={{
									fontSize: 70,
									lineHeight: 1.03,
									fontWeight: 900,
									letterSpacing: "-0.04em",
									maxWidth: "980px",
								}}
							>
								{title}
							</div>
							<div
								style={{
									fontSize: 28,
									lineHeight: 1.35,
									maxWidth: "900px",
									color: "#c4d4e6",
								}}
							>
								{subtitle}
							</div>
						</div>

						<div
							style={{ display: "flex", flexDirection: "column", gap: "22px" }}
						>
							<div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
								{theme.tags.map((tag) => (
									<div
										key={tag}
										style={{
											padding: "10px 16px",
											fontSize: 20,
											fontWeight: 800,
											letterSpacing: "0.08em",
											color: "#f8fbff",
											background: `${theme.accent}26`,
											border: `2px solid ${theme.accent}66`,
											borderRadius: "4px",
										}}
									>
										{tag}
									</div>
								))}
							</div>
							<div
								style={{
									fontSize: 22,
									fontWeight: 700,
									letterSpacing: "0.08em",
									color: "#9fb3c8",
								}}
							>
								dailystand.dev
							</div>
						</div>
					</div>,
					{
						width: 1200,
						height: 630,
					},
				);
			},
		},
	},
});
