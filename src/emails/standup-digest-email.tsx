import {
	Body,
	Container,
	Head,
	Heading,
	Html,
	Preview,
	Section,
	Text,
} from "@react-email/components";

type DigestTypeCounts = {
	completed: number;
	planned: number;
	blockers: number;
};

type DigestTeamStat = {
	teamName: string;
	total: number;
	counts: DigestTypeCounts;
};

type DigestContributor = {
	name: string;
	total: number;
};

type DigestHighlight = {
	content: string;
	authorName: string;
	teamName: string;
	date: string;
};

export type StandupDigestEmailProps = {
	recipientName: string;
	organizationName: string;
	cadence: "daily" | "weekly";
	periodLabel: string;
	totalEntries: number;
	activeContributors: number;
	counts: DigestTypeCounts;
	teamStats: DigestTeamStat[];
	topContributors: DigestContributor[];
	highlights: DigestHighlight[];
};

const rootStyle = {
	backgroundColor: "#080a0a",
	color: "#f8f8f5",
	fontFamily:
		"ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace",
	margin: 0,
	padding: "28px 0",
};

const containerStyle = {
	backgroundColor: "#0b0f0f",
	border: "3px solid #31353d",
	margin: "0 auto",
	maxWidth: "680px",
	padding: "28px",
};

const subtleStyle = {
	color: "#9ca3af",
	fontSize: "12px",
	letterSpacing: "0.09em",
	margin: 0,
	textTransform: "uppercase" as const,
};

const headingStyle = {
	color: "#f8f8f5",
	fontSize: "30px",
	fontWeight: 900,
	letterSpacing: "-0.03em",
	lineHeight: "36px",
	margin: "10px 0 8px",
};

const metricContainerStyle = {
	display: "grid",
	gap: "8px",
	gridTemplateColumns: "1fr 1fr",
	margin: "18px 0 18px",
};

const metricStyle = {
	backgroundColor: "#0f1316",
	border: "2px solid #31353d",
	padding: "12px",
};

const metricValueStyle = {
	color: "#f8f8f5",
	fontSize: "24px",
	fontWeight: 800,
	letterSpacing: "-0.02em",
	lineHeight: "28px",
	margin: "4px 0 0",
};

const metricLabelStyle = {
	color: "#9ca3af",
	fontSize: "10px",
	fontWeight: 700,
	letterSpacing: "0.1em",
	margin: 0,
	textTransform: "uppercase" as const,
};

const sectionHeaderStyle = {
	color: "#98e726",
	fontSize: "13px",
	fontWeight: 900,
	letterSpacing: "0.1em",
	margin: "18px 0 8px",
	textTransform: "uppercase" as const,
};

const panelStyle = {
	backgroundColor: "#0f1316",
	border: "2px solid #31353d",
	marginBottom: "8px",
	padding: "10px 12px",
};

const panelValueStyle = {
	color: "#f8f8f5",
	fontSize: "13px",
	fontWeight: 700,
	letterSpacing: "0.02em",
	lineHeight: "20px",
	margin: 0,
};

const panelMetaStyle = {
	color: "#9ca3af",
	fontSize: "11px",
	margin: "4px 0 0",
};

export function StandupDigestEmail({
	recipientName,
	organizationName,
	cadence,
	periodLabel,
	totalEntries,
	activeContributors,
	counts,
	teamStats,
	topContributors,
	highlights,
}: StandupDigestEmailProps) {
	const cadenceLabel = cadence === "daily" ? "Daily" : "Weekly";
	const previewText = `${cadenceLabel} digest for ${organizationName} • ${periodLabel}`;

	return (
		<Html>
			<Head />
			<Preview>{previewText}</Preview>
			<Body style={rootStyle}>
				<Container style={containerStyle}>
					<Text style={subtleStyle}>// {cadenceLabel.toUpperCase()}_DIGEST</Text>
					<Heading style={headingStyle}>STANDUP_REPORT</Heading>
					<Text style={{ ...subtleStyle, marginTop: "2px" }}>
						{organizationName.toUpperCase()} // {periodLabel}
					</Text>
					<Text style={{ color: "#d1d5db", fontSize: "14px", margin: "14px 0 0" }}>
						Hi {recipientName}, here is your {cadenceLabel.toLowerCase()} team
						activity summary.
					</Text>

					<Section style={metricContainerStyle}>
						<div style={metricStyle}>
							<Text style={metricLabelStyle}>TOTAL_ENTRIES</Text>
							<Text style={metricValueStyle}>{totalEntries}</Text>
						</div>
						<div style={metricStyle}>
							<Text style={metricLabelStyle}>ACTIVE_CONTRIBUTORS</Text>
							<Text style={metricValueStyle}>{activeContributors}</Text>
						</div>
						<div style={metricStyle}>
							<Text style={metricLabelStyle}>COMPLETED</Text>
							<Text style={metricValueStyle}>{counts.completed}</Text>
						</div>
						<div style={metricStyle}>
							<Text style={metricLabelStyle}>PLANNED / BLOCKERS</Text>
							<Text style={metricValueStyle}>
								{counts.planned} / {counts.blockers}
							</Text>
						</div>
					</Section>

					{teamStats.length > 0 && (
						<Section>
							<Text style={sectionHeaderStyle}>Team Breakdown</Text>
							{teamStats.map((teamStat) => (
								<div key={teamStat.teamName} style={panelStyle}>
									<Text style={panelValueStyle}>
										{teamStat.teamName} • {teamStat.total} entries
									</Text>
									<Text style={panelMetaStyle}>
										DONE {teamStat.counts.completed} • PLAN {teamStat.counts.planned} •
										BLOCK {teamStat.counts.blockers}
									</Text>
								</div>
							))}
						</Section>
					)}

					{topContributors.length > 0 && (
						<Section>
							<Text style={sectionHeaderStyle}>Top Contributors</Text>
							{topContributors.map((contributor) => (
								<div key={contributor.name} style={panelStyle}>
									<Text style={panelValueStyle}>
										{contributor.name} • {contributor.total} entries
									</Text>
								</div>
							))}
						</Section>
					)}

					{highlights.length > 0 && (
						<Section>
							<Text style={sectionHeaderStyle}>Recent Blockers</Text>
							{highlights.map((item, index) => (
								<div key={`${item.authorName}-${item.date}-${index}`} style={panelStyle}>
									<Text style={panelValueStyle}>{item.content}</Text>
									<Text style={panelMetaStyle}>
										{item.authorName} • {item.teamName} • {item.date}
									</Text>
								</div>
							))}
						</Section>
					)}

					<Text style={{ ...subtleStyle, marginTop: "18px" }}>
						Manage notifications in app settings.
					</Text>
				</Container>
			</Body>
		</Html>
	);
}
