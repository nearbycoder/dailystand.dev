import { act, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { useIsMobile } from "./use-mobile"

function HookHarness() {
	const isMobile = useIsMobile()
	return <div data-testid="is-mobile">{String(isMobile)}</div>
}

describe("useIsMobile", () => {
	it("returns false for desktop widths", () => {
		Object.defineProperty(window, "innerWidth", {
			value: 1024,
			configurable: true,
		})

		render(<HookHarness />)
		expect(screen.getByTestId("is-mobile")).toHaveTextContent("false")
	})

	it("updates when media query change listener fires", () => {
		const listeners = new Set<EventListenerOrEventListenerObject>()
		window.matchMedia = ((query: string): MediaQueryList => {
			return {
				matches: window.innerWidth < 768,
				media: query,
				onchange: null,
				addListener: () => {},
				removeListener: () => {},
				addEventListener: (
					_event: string,
					listener: EventListenerOrEventListenerObject,
				) => {
					listeners.add(listener)
				},
				removeEventListener: (
					_event: string,
					listener: EventListenerOrEventListenerObject,
				) => {
					listeners.delete(listener)
				},
				dispatchEvent: () => true,
			} as MediaQueryList
		}) as typeof window.matchMedia

		Object.defineProperty(window, "innerWidth", {
			value: 900,
			configurable: true,
		})

		render(<HookHarness />)
		expect(screen.getByTestId("is-mobile")).toHaveTextContent("false")

		Object.defineProperty(window, "innerWidth", {
			value: 500,
			configurable: true,
		})

		act(() => {
			const changeEvent = new Event("change")
			for (const listener of listeners) {
				if (typeof listener === "function") {
					listener(changeEvent)
					continue
				}
				listener.handleEvent(changeEvent)
			}
		})

		expect(screen.getByTestId("is-mobile")).toHaveTextContent("true")
	})
})
