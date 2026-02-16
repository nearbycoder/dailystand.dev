import type { ReactNode } from "react"

const URL_REGEX =
	/\b((?:https?:\/\/|www\.)[^\s<]+|(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(?:\/[^\s<]*)?)/gi

const SIMPLE_TRAILING_PUNCTUATION = new Set([",", ".", "!", "?", ";", ":"])

function splitTrailingPunctuation(value: string): { linkPart: string; suffix: string } {
	let end = value.length

	while (end > 0) {
		const char = value[end - 1]
		if (SIMPLE_TRAILING_PUNCTUATION.has(char)) {
			end--
			continue
		}

		if (char === ")") {
			const candidate = value.slice(0, end)
			const openParens = (candidate.match(/\(/g) ?? []).length
			const closeParens = (candidate.match(/\)/g) ?? []).length
			if (closeParens > openParens) {
				end--
				continue
			}
		}

		break
	}

	return {
		linkPart: value.slice(0, end),
		suffix: value.slice(end),
	}
}

function normalizeHref(url: string): string {
	if (url.startsWith("http://") || url.startsWith("https://")) return url
	return `https://${url}`
}

export function AutoLinkText({
	text,
	linkClassName,
}: {
	text: string
	linkClassName?: string
}) {
	const nodes: ReactNode[] = []
	let lastIndex = 0
	const resolvedLinkClassName =
		linkClassName ??
		"underline decoration-ds-accent/50 underline-offset-2 transition-colors hover:text-ds-accent hover:decoration-ds-accent"

	for (const match of text.matchAll(URL_REGEX)) {
		const rawMatch = match[0]
		const start = match.index ?? 0

		if (start > lastIndex) {
			nodes.push(text.slice(lastIndex, start))
		}

		// Don't autolink email domains (e.g. user@example.com).
		if (start > 0 && text[start - 1] === "@") {
			nodes.push(rawMatch)
			lastIndex = start + rawMatch.length
			continue
		}

		const { linkPart, suffix } = splitTrailingPunctuation(rawMatch)
		if (linkPart.length > 0) {
			nodes.push(
				<a
					key={`${start}-${linkPart}`}
					href={normalizeHref(linkPart)}
					target="_blank"
					rel="noopener noreferrer"
					className={resolvedLinkClassName}
				>
					{linkPart}
				</a>,
			)
		}
		if (suffix.length > 0) {
			nodes.push(suffix)
		}

		lastIndex = start + rawMatch.length
	}

	if (lastIndex < text.length) {
		nodes.push(text.slice(lastIndex))
	}

	return <>{nodes.length > 0 ? nodes : text}</>
}
