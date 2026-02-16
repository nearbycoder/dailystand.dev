import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useTRPC } from "@/integrations/trpc/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState, useEffect, useRef, useCallback } from "react"
import {
	CheckCircle2,
	Target,
	AlertTriangle,
	Plus,
	X,
	Save,
} from "lucide-react"

export const Route = createFileRoute("/app/standup")({
	component: StandupForm,
})

function StandupForm() {
	const trpc = useTRPC()
	const navigate = useNavigate()
	const queryClient = useQueryClient()
	const today = new Date().toISOString().split("T")[0]

	const { data: existing } = useQuery(trpc.standups.getMyToday.queryOptions())

	const [completed, setCompleted] = useState<string[]>([""])
	const [planned, setPlanned] = useState<string[]>([""])
	const [blockers, setBlockers] = useState<string[]>([""])

	useEffect(() => {
		if (existing && existing.length > 0) {
			const c = existing
				.filter((e) => e.type === "completed")
				.map((e) => e.content)
			const p = existing
				.filter((e) => e.type === "planned")
				.map((e) => e.content)
			const b = existing
				.filter((e) => e.type === "blocker")
				.map((e) => e.content)
			if (c.length > 0) setCompleted(c)
			if (p.length > 0) setPlanned(p)
			if (b.length > 0) setBlockers(b)
		}
	}, [existing])

	const upsert = useMutation(
		trpc.standups.upsert.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries()
				navigate({ to: "/app" })
			},
		}),
	)

	const doSubmit = () => {
		const entries = [
			...completed
				.filter((s) => s.trim())
				.map((content) => ({ type: "completed" as const, content })),
			...planned
				.filter((s) => s.trim())
				.map((content) => ({ type: "planned" as const, content })),
			...blockers
				.filter((s) => s.trim())
				.map((content) => ({ type: "blocker" as const, content })),
		]
		if (entries.length === 0) return
		upsert.mutate({ date: today, entries })
	}

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault()
		doSubmit()
	}

	// Cmd/Ctrl+Enter to submit from anywhere in the form
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault()
				doSubmit()
			}
		}
		document.addEventListener("keydown", handler)
		return () => document.removeEventListener("keydown", handler)
	})

	return (
		<div className="p-6 max-w-2xl">
			<div className="mb-8">
				<h1 className="text-3xl font-extrabold tracking-tighter">STANDUP</h1>
				<p className="text-ds-muted text-sm mt-1">
					//{" "}
					{new Date()
						.toLocaleDateString("en-US", {
							weekday: "long",
							month: "long",
							day: "numeric",
						})
						.toUpperCase()}
				</p>
			</div>

			<form onSubmit={handleSubmit} className="space-y-0">
				<EntrySection
					icon={<CheckCircle2 className="w-4 h-4 text-lime-500 dark:text-lime-400" />}
					title="COMPLETED"
					color="lime"
					items={completed}
					onChange={setCompleted}
					placeholder="Finished the API integration..."
				/>
				<EntrySection
					icon={<Target className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />}
					title="PLANNED"
					color="cyan"
					items={planned}
					onChange={setPlanned}
					placeholder="Start building the dashboard..."
				/>
				<EntrySection
					icon={<AlertTriangle className="w-4 h-4 text-red-500 dark:text-red-400" />}
					title="BLOCKERS"
					color="red"
					items={blockers}
					onChange={setBlockers}
					placeholder="Waiting on design review..."
				/>

				<button
					type="submit"
					disabled={upsert.isPending}
					className="w-full bg-ds-accent text-ds-accent-fg py-4 font-extrabold text-sm tracking-wider hover:bg-ds-accent-hover transition-colors disabled:opacity-50 flex items-center justify-center gap-3 mt-6"
				>
					<Save className="w-4 h-4" />
					{upsert.isPending
						? "SAVING..."
						: existing && existing.length > 0
							? "UPDATE_STANDUP"
							: "SUBMIT_STANDUP"}
					<kbd className="text-[10px] font-bold bg-ds-accent-fg/15 px-2 py-0.5 rounded-sm">
						{navigator?.platform?.includes("Mac") ? "⌘" : "Ctrl"}+Enter
					</kbd>
				</button>
			</form>
		</div>
	)
}

function EntrySection({
	icon,
	title,
	color,
	items,
	onChange,
	placeholder,
}: {
	icon: React.ReactNode
	title: string
	color: string
	items: string[]
	onChange: (items: string[]) => void
	placeholder: string
}) {
	const inputRefs = useRef<(HTMLInputElement | null)[]>([])

	const focusItem = useCallback((index: number) => {
		requestAnimationFrame(() => {
			inputRefs.current[index]?.focus()
		})
	}, [])

	const addItem = (afterIndex?: number) => {
		const insertAt = afterIndex !== undefined ? afterIndex + 1 : items.length
		const newItems = [...items]
		newItems.splice(insertAt, 0, "")
		onChange(newItems)
		focusItem(insertAt)
	}

	const removeItem = (index: number) => {
		if (items.length <= 1) {
			onChange([""])
			focusItem(0)
			return
		}
		onChange(items.filter((_, i) => i !== index))
		focusItem(Math.max(0, index - 1))
	}

	const updateItem = (index: number, value: string) => {
		const newItems = [...items]
		newItems[index] = value
		onChange(newItems)
	}

	const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
		if (e.key === "Enter") {
			e.preventDefault()
			addItem(index)
		} else if (
			e.key === "Backspace" &&
			items[index] === "" &&
			items.length > 1
		) {
			e.preventDefault()
			removeItem(index)
		} else if (e.key === "ArrowDown") {
			e.preventDefault()
			if (index < items.length - 1) focusItem(index + 1)
		} else if (e.key === "ArrowUp") {
			e.preventDefault()
			if (index > 0) focusItem(index - 1)
		}
	}

	const colorClasses: Record<string, string> = {
		lime: "text-lime-600 dark:text-lime-400",
		cyan: "text-cyan-600 dark:text-cyan-400",
		red: "text-red-500 dark:text-red-400",
	}

	return (
		<div className="border-[3px] border-ds-border -mt-[3px] p-6">
			<div className="flex items-center gap-2 mb-4">
				{icon}
				<span
					className={`text-xs font-extrabold tracking-widest ${colorClasses[color] ?? ""}`}
				>
					{title}
				</span>
				<span className="text-[10px] text-ds-muted3 ml-auto font-bold tracking-wider">
					ENTER=NEW / BKSP=DEL / ↑↓=NAV
				</span>
			</div>
			<div className="space-y-2">
				{items.map((item, index) => (
					<div key={index} className="flex items-center gap-2 group">
						<span className="text-ds-muted2 text-sm font-mono">&gt;</span>
						<input
							ref={(el) => { inputRefs.current[index] = el }}
							value={item}
							onChange={(e) => updateItem(index, e.target.value)}
							onKeyDown={(e) => handleKeyDown(e, index)}
							placeholder={index === 0 ? placeholder : "..."}
							className="flex-1 bg-ds-input-bg border-[3px] border-ds-border px-3 py-2 text-ds-fg font-mono text-sm focus:border-ds-accent focus:outline-none transition-colors placeholder:text-ds-muted3"
						/>
						<button
							type="button"
							tabIndex={-1}
							onClick={() => removeItem(index)}
							className="p-1 text-ds-muted2 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
						>
							<X className="w-4 h-4" />
						</button>
					</div>
				))}
				<button
					type="button"
					onClick={() => addItem()}
					className="flex items-center gap-2 text-xs font-bold text-ds-muted hover:text-ds-accent transition-colors pt-1"
				>
					<Plus className="w-3 h-3" />
					ADD_ITEM
				</button>
			</div>
		</div>
	)
}
