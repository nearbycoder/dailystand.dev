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
		title: "KILL THE MEETING",
		subtitle:
			"DailyStand is async standup software built for remote engineering teams. Replace awkward daily meetings with quick updates and early blocker visibility.",
		background:
			"linear-gradient(135deg, #0b1426 0%, #10203b 35%, #0f3a2f 100%)",
		accent: "#a3e635",
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

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const SITE_MONO_FONT = "ui-monospace";

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

function normalizeHomeTitle(value: string): string {
	return value
		.replace(/\s*\|\s*DailyStand$/i, "")
		.trim()
		.slice(0, 56);
}

function renderHomeOg(title: string, subtitle: string, theme: OgTheme) {
	const accent = theme.accent;
	const headline = normalizeHomeTitle(title).toUpperCase();
	const headlineHasMeeting = headline.includes("MEETING");
	const headlineParts = headlineHasMeeting ? headline.split("MEETING") : null;
	const featureCards = [
		{
			title: "DAILY STANDUPS",
			description: "Quick updates on done, next, and blockers.",
		},
		{
			title: "TEAM VISIBILITY",
			description: "See what everyone is working on without meetings.",
		},
		{
			title: "ANALYTICS",
			description: "Track delivery velocity and recurring blockers.",
		},
		{
			title: "LIGHTNING FAST",
			description: "Submit standups in under 60 seconds.",
		},
		{
			title: "SECURE BY DEFAULT",
			description: "Org-level access control and private team data.",
		},
		{
			title: "MCP + AI STANDUPS",
			description: "Generate and submit updates with MCP workflows.",
		},
	];
	return (
		<div
			style={{
				height: "100%",
				width: "100%",
				display: "flex",
				position: "relative",
				overflow: "hidden",
				fontFamily: SITE_MONO_FONT,
				background: "#000000",
				color: "#ffffff",
			}}
		>
			<div
				style={{
					position: "absolute",
					inset: 0,
					backgroundImage:
						"linear-gradient(90deg, rgba(161, 161, 170, 0.08) 1px, transparent 1px), linear-gradient(180deg, rgba(161, 161, 170, 0.06) 1px, transparent 1px)",
					backgroundSize: "54px 54px",
					opacity: 0.18,
				}}
			/>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					height: "100%",
					width: "100%",
					position: "relative",
					zIndex: 1,
				}}
			>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						padding: "14px 28px",
						borderBottom: "3px solid #ffffff",
					}}
				>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: "10px",
							fontSize: 38,
							fontWeight: 800,
							letterSpacing: "-0.01em",
						}}
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="24"
							height="24"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
							style={{ color: accent, width: "32px", height: "32px" }}
						>
							<title>Terminal logo</title>
							<path d="M12 19h8" />
							<path d="m4 17 6-6-6-6" />
						</svg>
						<span>DAILYSTAND</span>
					</div>
					<div
						style={{
							display: "flex",
							fontSize: 26,
							fontWeight: 700,
							letterSpacing: "0.12em",
							color: accent,
						}}
					>
						{"// FEATURES"}
					</div>
				</div>

				<div
					style={{
						display: "flex",
						flexDirection: "column",
						gap: "12px",
						padding: "18px 20px 20px",
						flex: 1,
						justifyContent: "space-between",
					}}
				>
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							gap: "20px",
						}}
					>
						<div
							style={{
								display: "flex",
								fontSize: 14,
								fontWeight: 700,
								letterSpacing: "0.14em",
								color: accent,
							}}
						>
							{"// ASYNC STANDUPS FOR MODERN TEAMS"}
						</div>
						<div
							style={{
								display: "flex",
								fontSize: 16,
								fontWeight: 800,
								lineHeight: 1.3,
								color: "#d4d4d8",
								maxWidth: "520px",
							}}
						>
							{subtitle}
						</div>
					</div>
					<div
						style={{
							display: "flex",
							fontSize: 94,
							fontWeight: 800,
							lineHeight: 0.82,
							letterSpacing: "-0.055em",
							color: "#f5f5f5",
						}}
					>
						{headlineHasMeeting && headlineParts ? (
							<>
								<span>{headlineParts[0]}</span>
								<span style={{ color: accent }}>MEETING</span>
								<span>{headlineParts[1]}</span>
							</>
						) : (
							headline
						)}
						<span style={{ color: accent }}>_</span>
					</div>
					<div
						style={{
							display: "flex",
							flexWrap: "wrap",
							border: "3px solid #ffffff",
							background: "#000000",
						}}
					>
						{featureCards.map((item, index) => {
							const isRightEdge = index % 3 === 2;
							const isBottomRow = index >= 3;
							return (
								<div
									key={item.title}
									style={{
										display: "flex",
										flexDirection: "column",
										width: "33.333%",
										minHeight: "96px",
										padding: "12px 14px",
										gap: "8px",
										borderRight: isRightEdge ? "0" : "3px solid #ffffff",
										borderBottom: isBottomRow ? "0" : "3px solid #ffffff",
										background: index === 5 ? "#0e1800" : "#000000",
									}}
								>
									<div
										style={{
											display: "flex",
											alignItems: "center",
											gap: "8px",
											fontSize: 14,
											fontWeight: 700,
											letterSpacing: "0.09em",
											color: "#f4f4f5",
										}}
									>
										<span style={{ color: accent }}>{">"}</span>
										<span>{item.title}</span>
									</div>
									<div
										style={{
											display: "flex",
											fontSize: 12,
											fontWeight: 800,
											lineHeight: 1.35,
											color: "#d4d4d8",
										}}
									>
										{item.description}
									</div>
								</div>
							);
						})}
					</div>
					<div
						style={{
							display: "flex",
							gap: "10px",
							flexWrap: "wrap",
						}}
					>
						{[
							"MCP_SUPPORT // AI AUTOMATION",
							"OPEN_SOURCE // SELF_HOSTED",
							"REST_API + MCP_SERVER",
						].map((item, index) => (
							<div
								key={item}
								style={{
									display: "flex",
									padding: "6px 10px",
									border:
										index === 0 ? `2px solid ${accent}` : "2px solid #ffffff",
									background: index === 0 ? "#101d00" : "#050505",
									color: index === 0 ? accent : "#f4f4f5",
									fontSize: 13,
									fontWeight: 800,
									letterSpacing: "0.08em",
								}}
							>
								{item}
							</div>
						))}
					</div>
					<div
						style={{
							display: "flex",
							width: "100%",
							alignItems: "center",
							justifyContent: "space-between",
							fontSize: 14,
							letterSpacing: "0.08em",
							color: "#a1a1aa",
						}}
					>
						<span>dailystand.dev</span>
						<div
							style={{
								display: "flex",
								color: "#d4d4d8",
							}}
						>
							{"Built for distributed engineering teams"}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

function renderDefaultOg(title: string, subtitle: string, theme: OgTheme) {
	return (
		<div
			style={{
				height: "100%",
				width: "100%",
				display: "flex",
				position: "relative",
				overflow: "hidden",
				fontFamily: SITE_MONO_FONT,
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

			<div style={{ display: "flex", flexDirection: "column", gap: "26px" }}>
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
					<span style={{ color: "#9fb3c8" }}>{"//"}</span>
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

			<div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
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
		</div>
	);
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
				const imageMarkup =
					page === "home"
						? renderHomeOg(title, subtitle, theme)
						: renderDefaultOg(title, subtitle, theme);

				return new ImageResponse(imageMarkup, {
					width: OG_WIDTH,
					height: OG_HEIGHT,
				});
			},
		},
	},
});
