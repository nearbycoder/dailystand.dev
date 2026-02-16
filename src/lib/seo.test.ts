import { describe, expect, it } from "vitest";
import {
	absoluteUrl,
	buildHomeStructuredData,
	buildOgImageUrl,
	buildPageSeo,
	SITE_NAME,
} from "./seo";

describe("seo helpers", () => {
	it("builds absolute urls for root and relative paths", () => {
		expect(absoluteUrl("/")).toBe("https://dailystand.dev/");
		expect(absoluteUrl("docs/rest")).toBe("https://dailystand.dev/docs/rest");
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
		expect(robots?.content).toBe("noindex, nofollow");

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
		expect(keywords?.content).toBe("one, two");
		expect(ogType?.content).toBe("article");
	});

	it("builds structured data graph with app and organization records", () => {
		const data = buildHomeStructuredData();
		expect(data["@context"]).toBe("https://schema.org");
		expect(data["@graph"]).toHaveLength(2);
		expect(data["@graph"][0]?.["@type"]).toBe("SoftwareApplication");
		expect(data["@graph"][1]?.["@type"]).toBe("Organization");
	});
});
