import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function UserNameLink({
	userId,
	name,
	className,
	uppercase = false,
}: {
	userId: string;
	name: string;
	className?: string;
	uppercase?: boolean;
}) {
	return (
		<Link
			to="/app/user/$userId"
			params={{ userId }}
			className={cn(
				"underline-offset-4 transition-colors hover:text-ds-accent hover:underline",
				className,
			)}
		>
			{uppercase ? name.toUpperCase() : name}
		</Link>
	);
}
