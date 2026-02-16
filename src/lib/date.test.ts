import { describe, expect, it } from "vitest"
import { getLocalDateString } from "./date"

describe("getLocalDateString", () => {
	it("formats a date as YYYY-MM-DD", () => {
		const date = new Date(2026, 1, 16, 13, 45, 0)
		expect(getLocalDateString(date)).toBe("2026-02-16")
	})

	it("pads month and day with leading zeros", () => {
		const date = new Date(2026, 0, 5, 1, 2, 3)
		expect(getLocalDateString(date)).toBe("2026-01-05")
	})
})
