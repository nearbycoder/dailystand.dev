import "dotenv/config";
import { runDigestWorkflow } from "@/lib/email-digests";

async function main() {
	const cadence = process.argv[2];

	if (cadence === "daily") {
		const daily = await runDigestWorkflow("daily");
		console.log(JSON.stringify({ daily }, null, 2));
		return;
	}

	if (cadence === "weekly") {
		const weekly = await runDigestWorkflow("weekly");
		console.log(JSON.stringify({ weekly }, null, 2));
		return;
	}

	const [daily, weekly] = await Promise.all([
		runDigestWorkflow("daily"),
		runDigestWorkflow("weekly"),
	]);
	console.log(JSON.stringify({ daily, weekly }, null, 2));
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
