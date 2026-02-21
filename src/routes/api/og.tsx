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

const OG_WIDTH = 1400;
const OG_HEIGHT = 735;
const SITE_MONO_FONT = '"DS Mono", ui-monospace';
const OG_FONT_REGULAR_URL =
	"https://cdn.jsdelivr.net/npm/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff";
const OG_FONT_BOLD_URL =
	"https://cdn.jsdelivr.net/npm/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-700-normal.woff";

const ogMonoRegularPromise = fetch(OG_FONT_REGULAR_URL)
	.then((response) => {
		if (!response.ok)
			throw new Error(`Font request failed: ${response.status}`);
		return response.arrayBuffer();
	})
	.catch(() => null);

const ogMonoBoldPromise = fetch(OG_FONT_BOLD_URL)
	.then((response) => {
		if (!response.ok)
			throw new Error(`Font request failed: ${response.status}`);
		return response.arrayBuffer();
	})
	.catch(() => null);

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

function renderHomeOg(_title: string, subtitle: string, theme: OgTheme) {
	const accent = theme.accent;
	const meetingAccent = "#a3e635";
	const cleanSubtitle = subtitle.replace(/[,\s]+$/g, "");
	const summary =
		cleanSubtitle.length > 136
			? `${cleanSubtitle.slice(0, 133).trimEnd()}...`
			: cleanSubtitle;
	const featureCards = [
		{
			title: "DAILY STANDUPS",
			description: "Quick updates on done, next, and blockers.",
		},
		{
			title: "TEAM VISIBILITY",
			description: "Know what everyone is working on without meetings.",
		},
		{
			title: "ANALYTICS",
			description: "Track delivery velocity and recurring blockers.",
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
						"linear-gradient(120deg, rgba(163, 230, 53, 0.12) 0%, rgba(0, 0, 0, 0) 45%), radial-gradient(circle at 88% 12%, rgba(163, 230, 53, 0.1) 0%, rgba(0, 0, 0, 0) 34%)",
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
						padding: "18px 34px",
						borderBottom: "2px solid #2d2d2d",
					}}
				>
					<div
						style={{
							display: "flex",
							fontWeight: 800,
							letterSpacing: "0.12em",
							color: accent,
							fontSize: 20,
						}}
					>
						{"// ASYNC STANDUPS"}
					</div>
					<div
						style={{
							display: "flex",
							gap: "8px",
							fontSize: 14,
							fontWeight: 700,
							letterSpacing: "0.08em",
							color: "#d4d4d8",
						}}
					>
						{["OPEN SOURCE", "SELF HOSTED"].map((item) => (
							<span
								key={item}
								style={{
									padding: "4px 8px",
									border: "1px solid #3f3f46",
									background: "#050505",
								}}
							>
								{item}
							</span>
						))}
					</div>
				</div>

				<div
					style={{
						display: "flex",
						flexDirection: "column",
						gap: "12px",
						padding: "24px 34px 20px",
						flex: 1,
					}}
				>
					<div
						style={{
							display: "flex",
							flexDirection: "column",
							gap: "10px",
						}}
					>
						<div
							style={{
								display: "flex",
								alignItems: "baseline",
								fontSize: 96,
								fontWeight: 900,
								lineHeight: 0.9,
								letterSpacing: "-0.05em",
								color: "#f5f5f5",
								maxWidth: "1220px",
								flexWrap: "wrap",
							}}
						>
							<span>KILL</span>
							<span style={{ marginLeft: "8px" }}>THE</span>
							<span style={{ color: meetingAccent, marginLeft: "18px" }}>
								MEETING
							</span>
							<span style={{ color: meetingAccent, marginLeft: "4px" }}>_</span>
						</div>
						<div
							style={{
								display: "flex",
								fontSize: 25,
								maxWidth: "1080px",
								lineHeight: 1.28,
								fontWeight: 800,
								color: "#d4d4d8",
							}}
						>
							{summary}
						</div>
					</div>

					<div
						style={{
							display: "flex",
							gap: "0",
							flexWrap: "wrap",
						}}
					>
						{featureCards.map((item) => (
							<div
								key={item.title}
								style={{
									display: "flex",
									flexDirection: "column",
									width: "50%",
									boxSizing: "border-box",
									padding: "14px 16px",
									gap: "8px",
									background: "#050505",
									border: "2px solid #ffffff",
								}}
							>
								<div
									style={{
										display: "flex",
										alignItems: "center",
										gap: "8px",
										fontSize: 20,
										fontWeight: 800,
										letterSpacing: "0.04em",
										color: "#f4f4f5",
									}}
								>
									<span style={{ color: accent }}>{">"}</span>
									<span>{item.title}</span>
								</div>
								<div
									style={{
										display: "flex",
										fontSize: 17,
										fontWeight: 800,
										lineHeight: 1.3,
										color: "#d4d4d8",
									}}
								>
									{item.description}
								</div>
							</div>
						))}
					</div>

					<div
						style={{
							marginTop: "auto",
							display: "flex",
							alignItems: "center",
							justifyContent: "space-between",
							paddingTop: "10px",
							borderTop: "2px solid #27272a",
						}}
					>
						<div
							style={{
								display: "flex",
								gap: "9px",
							}}
						>
							{["REST API", "MCP + AI", "ANALYTICS"].map((item) => (
								<span
									key={item}
									style={{
										display: "flex",
										padding: "5px 9px",
										border: "1px solid #3f3f46",
										fontSize: 14,
										fontWeight: 700,
										letterSpacing: "0.08em",
										color: "#d4d4d8",
									}}
								>
									{item}
								</span>
							))}
						</div>
						<div
							style={{
								display: "flex",
								fontSize: 15,
								fontWeight: 800,
								letterSpacing: "0.08em",
								color: "#a1a1aa",
							}}
						>
							dailystand.dev
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
			GET: async ({ request }) => {
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
				const [monoRegular, monoBold] = await Promise.all([
					ogMonoRegularPromise,
					ogMonoBoldPromise,
				]);
				const fonts = [];
				if (monoRegular) {
					fonts.push({
						name: "DS Mono",
						data: monoRegular,
						style: "normal" as const,
						weight: 400 as const,
					});
				}
				if (monoBold) {
					fonts.push({
						name: "DS Mono",
						data: monoBold,
						style: "normal" as const,
						weight: 700 as const,
					});
				}

				return new ImageResponse(imageMarkup, {
					width: OG_WIDTH,
					height: OG_HEIGHT,
					fonts: fonts.length ? fonts : undefined,
				});
			},
		},
	},
});
