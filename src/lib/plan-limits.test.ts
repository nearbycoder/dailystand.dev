import { describe, expect, it, vi } from "vitest"

vi.mock("@/db", () => ({
	db: {},
}))

import {
	getHistoryFloorDate,
	getPlanLimits,
	maxHistoryDays,
	normalizeLimit,
	normalizePlanName,
} from "./plan-limits"

describe("plan limit helpers", () => {
	it("normalizes plan names and falls back to free", () => {
		expect(normalizePlanName("business")).toBe("business")
		expect(normalizePlanName("pro")).toBe("pro")
		expect(normalizePlanName("unknown")).toBe("free")
		expect(normalizePlanName(null)).toBe("free")
	})

	it("resolves plan limits by normalized plan", () => {
		expect(getPlanLimits("free")).toEqual({
			teams: 1,
			members: 5,
			historyDays: 7,
		})
		expect(getPlanLimits("pro")).toEqual({
			teams: -1,
			members: 15,
			historyDays: 90,
		})
		expect(getPlanLimits("does-not-exist")).toEqual({
			teams: 1,
			members: 5,
			historyDays: 7,
		})
	})

	it("normalizes unlimited limits", () => {
		expect(normalizeLimit(-1)).toBe(Number.MAX_SAFE_INTEGER)
		expect(normalizeLimit(5)).toBe(5)
	})

	it("computes floor date for bounded and unlimited history", () => {
		const now = new Date("2026-02-16T13:00:00.000Z")
		expect(getHistoryFloorDate(7, now)).toBe("2026-02-10")
		expect(getHistoryFloorDate(1, now)).toBe("2026-02-16")
		expect(getHistoryFloorDate(-1, now)).toBeNull()
	})

	it("caps requested history days to plan limits", () => {
		expect(maxHistoryDays(7, 30)).toBe(7)
		expect(maxHistoryDays(7, 0)).toBe(1)
		expect(maxHistoryDays(-1, 45)).toBe(45)
	})
})
