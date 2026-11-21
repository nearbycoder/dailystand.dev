import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AutoLinkText } from "./auto-link-text";

describe("AutoLinkText", () => {
	it("autolinks fully-qualified URLs", () => {
		render(<AutoLinkText text="visit https://example.com for docs" />);
		const link = screen.getByRole("link", { name: "https://example.com" });
		expect(link).toHaveAttribute("href", "https://example.com");
		expect(link).toHaveAttribute("target", "_blank");
	});

	it("autolinks bare domains with https prefix", () => {
		render(<AutoLinkText text="check x.com now" />);
		const link = screen.getByRole("link", { name: "x.com" });
		expect(link).toHaveAttribute("href", "https://x.com");
	});

	it("keeps trailing punctuation outside the link", () => {
		const { container } = render(
			<AutoLinkText text="read x.com, then move on." />,
		);
		const link = screen.getByRole("link", { name: "x.com" });
		expect(link).toHaveAttribute("href", "https://x.com");
		expect(container).toHaveTextContent("x.com, then");
	});

	it("does not autolink domain fragments in email addresses", () => {
		render(<AutoLinkText text="contact me at dev@example.com" />);
		expect(screen.queryByRole("link")).not.toBeInTheDocument();
	});

	it("handles uppercase HTTP/HTTPS protocols without double-prefixing", () => {
		render(<AutoLinkText text="Check HTTPS://EXAMPLE.COM/docs now" />);
		const link = screen.getByRole("link", {
			name: "HTTPS://EXAMPLE.COM/docs",
		});
		expect(link).toHaveAttribute("href", "HTTPS://EXAMPLE.COM/docs");
	});

	it("handles long adversarial dotted inputs in linear time", () => {
		const adversarial = `${"a.".repeat(5000)}!`;
		const start = performance.now();
		render(<AutoLinkText text={adversarial} />);
		const elapsedMs = performance.now() - start;
		expect(elapsedMs).toBeLessThan(250);
	});
});
