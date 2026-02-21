import { afterEach, describe, expect, it } from "vitest";
import {
	absoluteUrl,
	buildHomeStructuredData,
	buildNoIndexMeta,
	buildOgImageUrl,
	buildPageSeo,
	SITE_NAME,
} from "./seo";

describe("seo helpers", () => {
	const originalSiteUrl = process.env.SITE_URL;
	const originalViteSiteUrl = process.env.VITE_SITE_URL;
	const originalBetterAuthUrl = process.env.BETTER_AUTH_URL;
	const originalVercelProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
	const originalVercelUrl = process.env.VERCEL_URL;

	afterEach(() => {
		if (originalSiteUrl === undefined) delete process.env.SITE_URL;
		else process.env.SITE_URL = originalSiteUrl;
		if (originalViteSiteUrl === undefined) delete process.env.VITE_SITE_URL;
		else process.env.VITE_SITE_URL = originalViteSiteUrl;
		if (originalBetterAuthUrl === undefined) delete process.env.BETTER_AUTH_URL;
		else process.env.BETTER_AUTH_URL = originalBetterAuthUrl;
		if (originalVercelProductionUrl === undefined)
			delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
		else
			process.env.VERCEL_PROJECT_PRODUCTION_URL = originalVercelProductionUrl;
		if (originalVercelUrl === undefined) delete process.env.VERCEL_URL;
		else process.env.VERCEL_URL = originalVercelUrl;
	});

	it("builds absolute urls for root and relative paths", () => {
		expect(absoluteUrl("/")).toBe("https://dailystand.dev/");
		expect(absoluteUrl("docs/rest")).toBe("https://dailystand.dev/docs/rest");
	});

	it("resolves URLs from runtime domain environment variables", () => {
		process.env.SITE_URL = "https://standup.example.com";
		delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
		delete process.env.VERCEL_URL;

		expect(absoluteUrl("/")).toBe("https://standup.example.com/");
		expect(buildOgImageUrl({ page: "home" })).toContain(
			"https://standup.example.com/api/og",
		);
	});

	it("builds OG image urls with defaults and truncation", () => {
		const url = new URL(
			buildOgImageUrl({
				title: "x".repeat(120),
				subtitle: "y".repeat(200),
			}),
		);

		expect(url.pathname).toBe("/api/og");
		expect(url.searchParams.get("page")).toBe("home");
		expect(url.searchParams.get("title")).toHaveLength(70);
		expect(url.searchParams.get("subtitle")).toHaveLength(120);
	});

	it("builds page seo with canonical link, defaults, and noindex robots", () => {
		const seo = buildPageSeo({
			title: "API Docs",
			description: "Explore the API",
			path: "/docs",
			noIndex: true,
		});

		expect(seo.canonical).toBe("https://dailystand.dev/docs");
		expect(seo.links).toEqual([
			{ rel: "canonical", href: "https://dailystand.dev/docs" },
		]);
		expect(seo.ogImage).toContain("/api/og");

		const robots = seo.meta.find((tag) => tag.name === "robots");
		expect(robots?.content).toBe("noindex, nofollow, noarchive");
		const googlebot = seo.meta.find((tag) => tag.name === "googlebot");
		expect(googlebot?.content).toBe("noindex, nofollow, noarchive");

		const ogSiteName = seo.meta.find((tag) => tag.property === "og:site_name");
		expect(ogSiteName?.content).toBe(SITE_NAME);
	});

	it("supports custom keywords and og type", () => {
		const seo = buildPageSeo({
			title: "Terms",
			description: "terms text",
			path: "/terms",
			keywords: ["one", "two"],
			ogType: "article",
		});

		const keywords = seo.meta.find((tag) => tag.name === "keywords");
		const ogType = seo.meta.find((tag) => tag.property === "og:type");
		const ogImageType = seo.meta.find(
			(tag) => tag.property === "og:image:type",
		);
		const twitterImageAlt = seo.meta.find(
			(tag) => tag.name === "twitter:image:alt",
		);
		expect(keywords?.content).toBe("one, two");
		expect(ogType?.content).toBe("article");
		expect(ogImageType?.content).toBe("image/png");
		expect(twitterImageAlt?.content).toBe("Terms preview image");
	});

	it("builds structured data graph with app, org, website and webpage", () => {
		const data = buildHomeStructuredData();
		expect(data["@context"]).toBe("https://schema.org");
		expect(data["@graph"]).toHaveLength(4);
		expect(data["@graph"][0]?.["@type"]).toBe("SoftwareApplication");
		expect(data["@graph"][1]?.["@type"]).toBe("Organization");
		expect(data["@graph"][2]?.["@type"]).toBe("WebSite");
		expect(data["@graph"][3]?.["@type"]).toBe("WebPage");
	});

	it("adds FAQ schema to home graph when faq items are provided", () => {
		const data = buildHomeStructuredData({
			faqItems: [
				{
					question: "What is DailyStand?",
					answer: "Async standup software for remote teams.",
				},
			],
		});
		expect(data["@graph"]).toHaveLength(5);
		expect(data["@graph"][4]?.["@type"]).toBe("FAQPage");
	});

	it("builds reusable noindex meta tags for private routes", () => {
		expect(buildNoIndexMeta()).toEqual([
			{ name: "robots", content: "noindex, nofollow, noarchive" },
			{ name: "googlebot", content: "noindex, nofollow, noarchive" },
		]);
	});
});
