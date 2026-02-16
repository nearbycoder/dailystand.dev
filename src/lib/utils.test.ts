import { describe, expect, it } from "vitest"
import { cn } from "./utils"

describe("cn", () => {
	it("merges class names and ignores falsey values", () => {
		expect(cn("px-2", false && "hidden", undefined, "py-2")).toBe("px-2 py-2")
	})

	it("deduplicates conflicting tailwind classes", () => {
		expect(cn("px-2", "px-4", "text-sm", "text-lg")).toBe("px-4 text-lg")
	})
})
