type EmailPayload = {
	to: string;
	subject: string;
	html: string;
	text: string;
};

type InviteEmailPayload = {
	invitationId: string;
	to: string;
	organizationName: string;
	inviterName: string;
	role: string;
	request?: Request;
};

type PasswordResetEmailPayload = {
	to: string;
	userName?: string | null;
	resetUrl: string;
};

const resendApiKey = process.env.RESEND_API_KEY;
const resendFromEmail =
	process.env.RESEND_FROM_EMAIL ?? "DailyStand <no-reply@dailystand.dev>";

export function isResendConfigured() {
	return Boolean(resendApiKey && resendFromEmail);
}

function resolveAppBaseUrl(request?: Request): string {
	const configured = process.env.BETTER_AUTH_URL;
	if (configured) return configured;
	if (request) return new URL(request.url).origin;
	return "http://localhost:3000";
}

export async function sendResendEmailMessage(payload: EmailPayload) {
	if (!isResendConfigured()) {
		throw new Error("RESEND is not configured.");
	}

	const response = await fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${resendApiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			from: resendFromEmail,
			to: [payload.to],
			subject: payload.subject,
			html: payload.html,
			text: payload.text,
		}),
	});

	if (!response.ok) {
		const details = await response.text();
		throw new Error(`Resend email failed (${response.status}): ${details}`);
	}
}

export async function sendInviteEmail(payload: InviteEmailPayload) {
	const inviteUrl = new URL("/auth/sign-in", resolveAppBaseUrl(payload.request));
	inviteUrl.searchParams.set("invitationId", payload.invitationId);
	inviteUrl.searchParams.set("email", payload.to);

	if (!isResendConfigured()) {
		console.info(`[AUTH] Invite email not sent (RESEND not configured).`, {
			recipient: payload.to,
			organization: payload.organizationName,
		});
		return;
	}

	const subject = `You're invited to join ${payload.organizationName} on DailyStand`;
	const text = [
		`You were invited to join ${payload.organizationName} on DailyStand as ${payload.role}.`,
		`Invited by: ${payload.inviterName}`,
		`Accept invite: ${inviteUrl.toString()}`,
	].join("\n");
	const html = [
		`<p>You were invited to join <strong>${payload.organizationName}</strong> on DailyStand as <strong>${payload.role}</strong>.</p>`,
		`<p>Invited by: <strong>${payload.inviterName}</strong></p>`,
		`<p><a href="${inviteUrl.toString()}">Accept invitation</a></p>`,
	].join("");

	await sendResendEmailMessage({
		to: payload.to,
		subject,
		text,
		html,
	});
}

export async function sendPasswordResetEmail(
	payload: PasswordResetEmailPayload,
) {
	if (!isResendConfigured()) {
		console.info(`[AUTH] Password reset email not sent (RESEND not configured).`, {
			recipient: payload.to,
		});
		return;
	}

	const greeting = payload.userName?.trim()
		? `Hi ${payload.userName},`
		: "Hi there,";

	const subject = "Reset your DailyStand password";
	const text = [
		greeting,
		"",
		"Use this link to reset your password:",
		payload.resetUrl,
	].join("\n");
	const html = [
		`<p>${greeting}</p>`,
		"<p>Use this link to reset your password:</p>",
		`<p><a href="${payload.resetUrl}">Reset password</a></p>`,
	].join("");

	await sendResendEmailMessage({
		to: payload.to,
		subject,
		text,
		html,
	});
}
