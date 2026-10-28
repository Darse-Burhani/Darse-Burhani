import webpush from "web-push";
import prisma from "./prisma";

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
  requireInteraction?: boolean;
}

let configured: boolean | null = null;

function ensureConfigured(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    configured = false;
    console.warn("[push] VAPID keys are not configured - web push disabled.");
    return false;
  }
  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:admin.galiakot@darseburhani.org",
      publicKey,
      privateKey
    );
    configured = true;
  } catch (err) {
    configured = false;
    console.error("[push] Failed to configure VAPID:", err);
  }
  return configured;
}

export function isPushConfigured(): boolean {
  return ensureConfigured();
}

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

async function deliver(subscription: {
  endpoint: string;
  p256dh: string;
  auth: string;
}, payload: PushPayload): Promise<"ok" | "gone" | "error"> {
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
      { TTL: 3600, urgency: "high" }
    );
    return "ok";
  } catch (err: any) {
    const status = err?.statusCode;
    if (status === 404 || status === 410) return "gone";
    console.error(`[push] Delivery failed (${status || "unknown"}):`, err?.message || err);
    return "error";
  }
}

/** Sends a browser push notification to every device registered by the user. */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!ensureConfigured()) return 0;
  try {
    const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
    if (subscriptions.length === 0) return 0;

    let delivered = 0;
    for (const subscription of subscriptions) {
      const result = await deliver(subscription, payload);
      if (result === "ok") delivered += 1;
      if (result === "gone") {
        await prisma.pushSubscription.delete({ where: { id: subscription.id } }).catch(() => {});
      }
    }
    return delivered;
  } catch (err) {
    console.error("[push] sendPushToUser error:", err);
    return 0;
  }
}

/** Sends a browser push notification to several users in parallel. */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<number> {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (unique.length === 0) return 0;
  const results = await Promise.all(unique.map((id) => sendPushToUser(id, payload)));
  return results.reduce((sum, n) => sum + n, 0);
}
