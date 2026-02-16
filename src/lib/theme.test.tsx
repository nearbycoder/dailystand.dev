import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider, useTheme } from "./theme";

function ThemeHarness() {
	const { theme, resolved, setTheme } = useTheme();
	return (
		<div>
			<div data-testid="theme">{theme}</div>
			<div data-testid="resolved">{resolved}</div>
			<button type="button" onClick={() => setTheme("dark")}>
				to-dark
			</button>
		</div>
	);
}

describe("ThemeProvider", () => {
	afterEach(() => {
		window.localStorage.clear();
		document.documentElement.classList.remove("dark", "light");
	});

	it("initializes from localStorage and applies class", async () => {
		window.localStorage.setItem("ds-theme", "light");

		render(
			<ThemeProvider>
				<ThemeHarness />
			</ThemeProvider>,
		);

		await waitFor(() => {
			expect(screen.getByTestId("theme")).toHaveTextContent("light");
			expect(screen.getByTestId("resolved")).toHaveTextContent("light");
			expect(document.documentElement).toHaveClass("light");
		});
	});

	it("updates theme, resolved mode, and storage when setTheme is called", async () => {
		render(
			<ThemeProvider>
				<ThemeHarness />
			</ThemeProvider>,
		);

		await waitFor(() => {
			expect(screen.getByTestId("resolved")).toHaveTextContent("light");
		});

		fireEvent.click(screen.getByRole("button", { name: "to-dark" }));

		await waitFor(() => {
			expect(screen.getByTestId("theme")).toHaveTextContent("dark");
			expect(screen.getByTestId("resolved")).toHaveTextContent("dark");
			expect(document.documentElement).toHaveClass("dark");
			expect(window.localStorage.getItem("ds-theme")).toBe("dark");
		});
	});

	it("resolves system mode from matchMedia", async () => {
		const matchMediaSpy = vi
			.spyOn(window, "matchMedia")
			.mockImplementation((query: string) => ({
				matches: true,
				media: query,
				onchange: null,
				addListener: vi.fn(),
				removeListener: vi.fn(),
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
				dispatchEvent: vi.fn(),
			}));

		window.localStorage.setItem("ds-theme", "system");
		render(
			<ThemeProvider>
				<ThemeHarness />
			</ThemeProvider>,
		);

		await waitFor(() => {
			expect(screen.getByTestId("theme")).toHaveTextContent("system");
			expect(screen.getByTestId("resolved")).toHaveTextContent("dark");
			expect(document.documentElement).toHaveClass("dark");
		});

		matchMediaSpy.mockRestore();
	});
});
