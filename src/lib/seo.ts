export const SITE_NAME = "DailyStand";
export const SITE_URL = "https://dailystand.dev";

export const KEYWORD_CLUSTERS = {
	core: [
		"async standup software",
		"daily standup software",
		"standup automation",
		"remote team standup tool",
		"engineering team status updates",
	],
	platform: [
		"open source standup tool",
		"self hosted standup app",
		"developer standup platform",
		"async scrum updates",
	],
	apiAndAi: [
		"standup API",
		"MCP standup tools",
		"AI standup generator",
		"standup analytics dashboard",
	],
} as const;

export const PRIMARY_KEYWORDS = [
	...KEYWORD_CLUSTERS.core,
	...KEYWORD_CLUSTERS.platform,
	...KEYWORD_CLUSTERS.apiAndAi,
];

type OgPage = "home" | "docs" | "privacy" | "terms";

type SeoOptions = {
	title: string;
	description: string;
	path: string;
	keywords?: string[];
	ogPage?: OgPage;
	ogType?: "website" | "article";
	noIndex?: boolean;
};

export type FaqStructuredDataItem = {
	question: string;
	answer: string;
};

type MetaTag = {
	title?: string;
	name?: string;
	property?: string;
	content?: string;
};

const INDEX_ROBOTS = "index, follow, max-image-preview:large";
const NOINDEX_ROBOTS = "noindex, nofollow, noarchive";

function normalizePath(path: string): string {
	if (!path || path === "/") return "/";
	return path.startsWith("/") ? path : `/${path}`;
}

function normalizeOrigin(value: string | undefined): string | null {
	if (!value) return null;
	const trimmed = value.trim();
	if (!trimmed) return null;
	const candidate = /^https?:\/\//i.test(trimmed)
		? trimmed
		: `https://${trimmed}`;
	try {
		return new URL(candidate).origin;
	} catch {
		return null;
	}
}

function isLocalDevelopmentOrigin(origin: string): boolean {
	try {
		const hostname = new URL(origin).hostname.toLowerCase();
		return hostname === "localhost" || hostname === "127.0.0.1";
	} catch {
		return false;
	}
}

function resolveSiteUrl(): string {
	const processEnv = typeof process !== "undefined" ? process.env : undefined;
	const configured =
		normalizeOrigin(processEnv?.SITE_URL) ??
		normalizeOrigin(processEnv?.VITE_SITE_URL) ??
		normalizeOrigin(processEnv?.BETTER_AUTH_URL);
	if (configured) return configured;

	const vercelDomain =
		normalizeOrigin(processEnv?.VERCEL_PROJECT_PRODUCTION_URL) ??
		normalizeOrigin(processEnv?.VERCEL_URL);
	if (vercelDomain) return vercelDomain;

	if (typeof window !== "undefined") {
		const browserOrigin = normalizeOrigin(window.location.origin);
		if (browserOrigin && !isLocalDevelopmentOrigin(browserOrigin)) {
			return browserOrigin;
		}
	}

	return SITE_URL;
}

export function absoluteUrl(path: string): string {
	return new URL(normalizePath(path), resolveSiteUrl()).toString();
}

export function buildOgImageUrl(options: {
	page?: OgPage;
	title?: string;
	subtitle?: string;
}): string {
	const url = new URL("/api/og", resolveSiteUrl());
	url.searchParams.set("page", options.page ?? "home");
	if (options.title) {
		url.searchParams.set("title", options.title.slice(0, 70));
	}
	if (options.subtitle) {
		url.searchParams.set("subtitle", options.subtitle.slice(0, 120));
	}
	return url.toString();
}

export function buildPageSeo(options: SeoOptions): {
	canonical: string;
	ogImage: string;
	links: Array<{ rel: string; href: string }>;
	meta: MetaTag[];
} {
	const canonical = absoluteUrl(options.path);
	const ogImage = buildOgImageUrl({
		page: options.ogPage,
		title: options.title,
		subtitle: options.description,
	});
	const keywords = (options.keywords ?? PRIMARY_KEYWORDS).join(", ");
	const robots = options.noIndex ? NOINDEX_ROBOTS : INDEX_ROBOTS;

	return {
		canonical,
		ogImage,
		links: [{ rel: "canonical", href: canonical }],
		meta: [
			{ title: options.title },
			{ name: "description", content: options.description },
			{ name: "keywords", content: keywords },
			{ name: "robots", content: robots },
			{ name: "googlebot", content: robots },
			{ property: "og:site_name", content: SITE_NAME },
			{ property: "og:locale", content: "en_US" },
			{ property: "og:type", content: options.ogType ?? "website" },
			{ property: "og:title", content: options.title },
			{ property: "og:description", content: options.description },
			{ property: "og:url", content: canonical },
			{ property: "og:image", content: ogImage },
			{ property: "og:image:type", content: "image/png" },
			{ property: "og:image:width", content: "1400" },
			{ property: "og:image:height", content: "735" },
			{
				property: "og:image:alt",
				content: `${options.title} preview image`,
			},
			{ name: "twitter:card", content: "summary_large_image" },
			{ name: "twitter:title", content: options.title },
			{ name: "twitter:description", content: options.description },
			{ name: "twitter:image", content: ogImage },
			{
				name: "twitter:image:alt",
				content: `${options.title} preview image`,
			},
		],
	};
}

export function buildNoIndexMeta(): MetaTag[] {
	return [
		{ name: "robots", content: NOINDEX_ROBOTS },
		{ name: "googlebot", content: NOINDEX_ROBOTS },
	];
}

function buildFaqPageEntity(items: FaqStructuredDataItem[]) {
	return {
		"@type": "FAQPage",
		mainEntity: items.map((item) => ({
			"@type": "Question",
			name: item.question,
			acceptedAnswer: {
				"@type": "Answer",
				text: item.answer,
			},
		})),
	};
}

export function buildHomeStructuredData(options?: {
	faqItems?: FaqStructuredDataItem[];
}) {
	const graph: Array<Record<string, unknown>> = [
		{
			"@type": "SoftwareApplication",
			name: SITE_NAME,
			applicationCategory: "BusinessApplication",
			operatingSystem: "Web",
			description:
				"Async standup software for engineering teams with open source self-hosted deployment, API access, and MCP tooling.",
			url: absoluteUrl("/"),
			offers: {
				"@type": "AggregateOffer",
				lowPrice: "0",
				highPrice: "65",
				priceCurrency: "USD",
			},
		},
		{
			"@type": "Organization",
			name: SITE_NAME,
			url: absoluteUrl("/"),
			logo: absoluteUrl("/logo512.png"),
		},
		{
			"@type": "WebSite",
			name: SITE_NAME,
			url: absoluteUrl("/"),
			inLanguage: "en-US",
		},
		{
			"@type": "WebPage",
			name: "Async Standup Software for Remote Teams",
			url: absoluteUrl("/"),
			isPartOf: {
				"@type": "WebSite",
				name: SITE_NAME,
				url: absoluteUrl("/"),
			},
			description:
				"Open source async standup software for remote engineering teams with analytics, API access, and MCP automation.",
		},
	];

	if (options?.faqItems?.length) {
		graph.push(buildFaqPageEntity(options.faqItems));
	}

	return {
		"@context": "https://schema.org",
		"@graph": graph,
	};
}
