/**
 * Mailflare email relay with Dual Delivery:
 * 1. Delivers live email directly to Gmail via Cloudflare Email Routing forward.
 * 2. Relays payload to self-hosted server (/api/inbound or /api/public/mailflare/inbound)
 *    so in-app messages and notifications arrive in real time!
 */
type Env = {
	MAILFLARE_URL: string;
	INBOUND_WEBHOOK_SECRET?: string;
	GMAIL_FORWARD_TO?: string;
};

type Decision =
	| { action: "reject"; reason: string }
	| { action: "forward"; forwardTo: string | null; forwardHeaders?: Record<string, string> }
	| { action: "store"; forwardTo?: string | null; forwardHeaders?: Record<string, string> };

/** HMAC-SHA256 over `v2\ntimestamp\nfrom\nto\nheaders\n` + raw body; matches src/lib/email/intake-signature.ts. */
async function sign(secret: string, raw: ArrayBuffer, from: string, to: string, headers: string, timestamp: string): Promise<string> {
	const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
	const prefix = new TextEncoder().encode(`v2\n${timestamp}\n${from}\n${to}\n${headers}\n`);
	const data = new Uint8Array(prefix.byteLength + raw.byteLength);
	data.set(prefix, 0);
	data.set(new Uint8Array(raw), prefix.byteLength);
	return Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, data)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export default {
	async email(message: ForwardableEmailMessage, env: Env) {
		if (message.rawSize > 25 * 1024 * 1024) {
			message.setReject("Message rejected: raw email exceeds the 25 MiB receiving limit. Send a download link instead.");
			return;
		}

		// 1. Direct Dual-Delivery: Forward to Gmail immediately so it is NEVER lost
		const directGmail = env.GMAIL_FORWARD_TO?.trim();
		let alreadyForwardedToGmail = false;
		if (directGmail) {
			try {
				await message.forward(directGmail);
				alreadyForwardedToGmail = true;
			} catch (err) {
				console.error(`Direct forward to Gmail (${directGmail}) failed:`, err);
			}
		}

		// 2. Relay raw email to In-App Server (/api/inbound)
		const raw = await new Response(message.raw).arrayBuffer();
		const headers = JSON.stringify(Object.fromEntries(message.headers));
		const timestamp = String(Math.floor(Date.now() / 1000));
		const secret = env.INBOUND_WEBHOOK_SECRET || "default_secret";
		const signature = await sign(secret, raw, message.from, message.to, headers, timestamp);

		let decision: Decision = { action: "store" };

		try {
			const baseUrl = (env.MAILFLARE_URL || "").replace(/\/$/, "");
			const targetUrl = baseUrl.endsWith("/api/inbound") || baseUrl.endsWith("/api/public/mailflare/inbound")
				? baseUrl
				: `${baseUrl}/api/inbound`;

			const response = await fetch(targetUrl, {
				method: "POST",
				headers: {
					"Content-Type": "message/rfc822",
					"X-Mailflare-From": message.from,
					"X-Mailflare-To": message.to,
					"X-Mailflare-Headers": headers,
					"X-Mailflare-Timestamp": timestamp,
					"X-Mailflare-Signature": signature,
				},
				body: raw,
			});

			if (response.status === 413) {
				message.setReject("Message rejected: receiving server says the email is too large.");
				return;
			}

			if (response.ok) {
				decision = (await response.json()) as Decision;
			} else {
				console.warn(`Server answered ${response.status}. Message still preserved.`);
			}
		} catch (error) {
			console.error("Relay to In-App server failed:", error);
			// Do not reject the message if it was already forwarded to Gmail
			if (!alreadyForwardedToGmail) {
				message.setReject("In-app mail service is temporarily unavailable, please retry.");
				return;
			}
		}

		// 3. Handle server-requested action (if reject or secondary forward)
		if (decision.action === "reject") {
			message.setReject(decision.reason);
			return;
		}

		if (decision.forwardTo && decision.forwardTo !== directGmail) {
			try {
				await message.forward(decision.forwardTo, new Headers(decision.forwardHeaders ?? {}));
			} catch (error) {
				console.error(`Forward to ${decision.forwardTo} failed:`, error);
			}
		}
	},
} satisfies ExportedHandler<Env>;
