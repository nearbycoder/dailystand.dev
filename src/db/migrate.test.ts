import path from "node:path";
import { describe, expect, it } from "vitest";
import {
	LEGACY_BASELINE_TAGS,
	readLegacyBaselineEntries,
	shouldBaselineLegacyPushDb,
} from "./migrate";

describe("startup database migration helpers", () => {
	it("baselines legacy db:push databases only when all pre-0004 markers exist", () => {
		expect(
			shouldBaselineLegacyPushDb({
				hasStandupEntryTable: true,
				hasApiKeyTable: true,
				hasStandupShareExpiresAtColumn: true,
				hasUserBioColumn: true,
			}),
		).toBe(true);

		expect(
			shouldBaselineLegacyPushDb({
				hasStandupEntryTable: false,
				hasApiKeyTable: false,
				hasStandupShareExpiresAtColumn: false,
				hasUserBioColumn: false,
			}),
		).toBe(false);

		expect(
			shouldBaselineLegacyPushDb({
				hasStandupEntryTable: true,
				hasApiKeyTable: true,
				hasStandupShareExpiresAtColumn: true,
				hasUserBioColumn: false,
			}),
		).toBe(false);
	});

	it("reads exact legacy baseline hashes and timestamps from drizzle journal without 0004", () => {
		const entries = readLegacyBaselineEntries(
			path.resolve(process.cwd(), "drizzle"),
		);
		expect(entries.map((entry) => entry.tag)).toEqual(
			Array.from(LEGACY_BASELINE_TAGS),
		);
		for (const entry of entries) {
			expect(entry.hash).toMatch(/^[a-f0-9]{64}$/);
			expect(entry.createdAt).toBeGreaterThan(0);
			expect(entry.createdAt).toBeLessThan(1795190400000);
		}
	});
});
