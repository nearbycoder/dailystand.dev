import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DocsKeyProvider, useDocsKey } from "./docs-key-context"

function Harness() {
	const { apiKey, setApiKey } = useDocsKey()
	return (
		<div>
			<span data-testid="api-key">{apiKey}</span>
			<button type="button" onClick={() => setApiKey("ds_test_key_123")}>
				set-key
			</button>
		</div>
	)
}

describe("DocsKeyProvider", () => {
	beforeEach(() => {
		window.sessionStorage.clear()
	})

	it("loads key from sessionStorage on mount", () => {
		window.sessionStorage.setItem("ds_docs_api_key", "ds_seeded_key")
		render(
			<DocsKeyProvider>
				<Harness />
			</DocsKeyProvider>,
		)

		expect(screen.getByTestId("api-key")).toHaveTextContent("ds_seeded_key")
	})

	it("persists key updates to sessionStorage", () => {
		render(
			<DocsKeyProvider>
				<Harness />
			</DocsKeyProvider>,
		)

		fireEvent.click(screen.getByRole("button", { name: "set-key" }))
		expect(screen.getByTestId("api-key")).toHaveTextContent("ds_test_key_123")
		expect(window.sessionStorage.getItem("ds_docs_api_key")).toBe(
			"ds_test_key_123",
		)
	})

	it("throws when hook is used outside provider", () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
		expect(() => render(<Harness />)).toThrow(
			"useDocsKey must be used within DocsKeyProvider",
		)
		errorSpy.mockRestore()
	})
})
