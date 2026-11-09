import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  initAuthCreds,
  BufferJSON,
  proto,
  type AuthenticationCreds,
  type AuthenticationState,
  type SignalDataTypeMap,
  type WASocket,
} from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import pino from "pino";
import prisma from "./prisma";
import { formatWhatsAppPhone } from "./whatsapp";

let sock: WASocket | null = null;
let currentQrCode: string | null = null;
let currentQrDataUrl: string | null = null;
let connectionStatus: "DISCONNECTED" | "CONNECTING" | "CONNECTED" = "DISCONNECTED";
let connectedPhoneNumber: string | null = null;
let connectedName: string | null = null;
let lastError: string | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;

/**
 * Custom PostgreSQL session store for Baileys.
 * Preserves WhatsApp credentials permanently across cloud server restarts.
 */
async function useDatabaseAuthState() {
  let creds: AuthenticationCreds;

  const existingCreds = await prisma.whatsAppSession.findUnique({
    where: { key: "creds" },
  });

  if (existingCreds) {
    try {
      creds = JSON.parse(existingCreds.data, BufferJSON.reviver);
    } catch {
      creds = initAuthCreds();
    }
  } else {
    creds = initAuthCreds();
  }

  const saveCreds = async () => {
    try {
      const serialized = JSON.stringify(creds, BufferJSON.replacer);
      await prisma.whatsAppSession.upsert({
        where: { key: "creds" },
        update: { data: serialized },
        create: { key: "creds", data: serialized },
      });
    } catch (err) {
      console.error("[baileys] Error saving creds to DB:", err);
    }
  };

  const state: AuthenticationState = {
    creds,
    keys: {
      get: async (type, ids) => {
        const data: { [key: string]: any } = {};
        try {
          const keysToFetch = ids.map((id) => `${type}-${id}`);
          const records = await prisma.whatsAppSession.findMany({
            where: { key: { in: keysToFetch } },
          });

          for (const record of records) {
            const id = record.key.slice(type.length + 1);
            let value = JSON.parse(record.data, BufferJSON.reviver);
            if (type === "app-state-sync-key" && value) {
              value = proto.Message.AppStateSyncKeyData.fromObject(value);
            }
            data[id] = value;
          }
        } catch (err) {
          console.error(`[baileys] Error reading keys (${type}) from DB:`, err);
        }
        return data;
      },
      set: async (data) => {
        const tasks: Promise<any>[] = [];
        for (const category in data) {
          for (const id in data[category as keyof SignalDataTypeMap]) {
            const value = (data[category as keyof SignalDataTypeMap] as any)[id];
            const key = `${category}-${id}`;
            if (value) {
              const serialized = JSON.stringify(value, BufferJSON.replacer);
              tasks.push(
                prisma.whatsAppSession.upsert({
                  where: { key },
                  update: { data: serialized },
                  create: { key, data: serialized },
                })
              );
            } else {
              tasks.push(
                prisma.whatsAppSession.deleteMany({
                  where: { key },
                })
              );
            }
          }
        }
        // Batch execute in chunks of 25 to respect database connection pools
        const chunkSize = 25;
        for (let i = 0; i < tasks.length; i += chunkSize) {
          await Promise.all(tasks.slice(i, i + chunkSize)).catch((err) =>
            console.error("[baileys] Error saving keys batch to DB:", err)
          );
        }
      },
    },
  };

  return { state, saveCreds };
}

/**
 * Initialize Baileys WhatsApp Cloud Client
 */
export async function initWhatsAppBaileys(): Promise<void> {
  if (sock && connectionStatus === "CONNECTED") {
    return;
  }

  connectionStatus = "CONNECTING";
  lastError = null;

  try {
    const { state, saveCreds } = await useDatabaseAuthState();
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307] as [number, number, number] }));

    sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: "silent" }) as any,
      printQRInTerminal: false,
      defaultQueryTimeoutMs: 60_000,
      syncFullHistory: false,
      browser: ["Darse Burhani", "Desktop", "1.0.0"],
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        currentQrCode = qr;
        try {
          currentQrDataUrl = await QRCode.toDataURL(qr, {
            margin: 2,
            width: 320,
            color: {
              dark: "#064e3b",
              light: "#ffffff",
            },
          });
        } catch {
          currentQrDataUrl = null;
        }
      }

      if (connection === "open") {
        connectionStatus = "CONNECTED";
        currentQrCode = null;
        currentQrDataUrl = null;
        lastError = null;

        const user = sock?.user;
        connectedPhoneNumber = user?.id ? user.id.split(":")[0].replace(/[^0-9]/g, "") : null;
        connectedName = user?.name || "Darse Burhani Administration";

        console.log(`[baileys] ✓ WhatsApp Connected Successfully to +${connectedPhoneNumber} (${connectedName})`);
      }

      if (connection === "close") {
        connectionStatus = "DISCONNECTED";
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        console.warn(`[baileys] Connection closed. Reason code: ${statusCode}, shouldReconnect: ${shouldReconnect}`);

        if (statusCode === DisconnectReason.loggedOut) {
          // Admin unlinked from phone settings, clear DB credentials
          await prisma.whatsAppSession.deleteMany({});
          connectedPhoneNumber = null;
          connectedName = null;
        }

        if (shouldReconnect) {
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(() => {
            initWhatsAppBaileys().catch((e) => console.error("[baileys] Reconnect failed:", e));
          }, 5000);
        }
      }
    });
  } catch (err: any) {
    connectionStatus = "DISCONNECTED";
    lastError = err?.message || String(err);
    console.error("[baileys] Initialization error:", err);
  }
}

/**
 * Send WhatsApp text notification to target phone
 */
export async function sendBaileysMessage(
  rawPhone: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  const cleanPhone = formatWhatsAppPhone(rawPhone);
  if (!cleanPhone) {
    return { success: false, error: `Invalid recipient phone: ${rawPhone}` };
  }

  if (!sock || connectionStatus !== "CONNECTED") {
    return {
      success: false,
      error: "WhatsApp cloud service is not connected. Please scan the QR code in /admin/whatsapp.",
    };
  }

  const jid = `${cleanPhone}@s.whatsapp.net`;

  try {
    await sock.sendMessage(jid, { text: message });
    return { success: true };
  } catch (err: any) {
    console.error(`[baileys] Failed to send message to ${jid}:`, err);
    return { success: false, error: err?.message || "Failed to deliver WhatsApp message" };
  }
}

/**
 * Get current live connection status
 */
export function getBaileysStatus() {
  return {
    isConnected: connectionStatus === "CONNECTED",
    status: connectionStatus,
    phone: connectedPhoneNumber,
    name: connectedName,
    qrCode: currentQrCode,
    qrDataUrl: currentQrDataUrl,
    error: lastError,
  };
}

/**
 * Update WhatsApp Account Display / Profile Name
 */
export async function updateBaileysProfileName(
  name: string
): Promise<{ success: boolean; error?: string }> {
  if (!sock || connectionStatus !== "CONNECTED") {
    return { success: false, error: "WhatsApp is not connected" };
  }
  try {
    const trimmed = name.trim();
    if (!trimmed) {
      return { success: false, error: "Display name cannot be empty" };
    }
    await sock.updateProfileName(trimmed);
    connectedName = trimmed;
    console.log(`[baileys] ✓ Updated WhatsApp profile display name to: "${trimmed}"`);
    return { success: true };
  } catch (err: any) {
    console.error("[baileys] Error updating profile name:", err);
    return {
      success: false,
      error: err?.message || "Failed to update profile name on WhatsApp",
    };
  }
}

/**
 * Disconnect & Logout
 */
export async function logoutBaileys(): Promise<void> {
  try {
    if (sock) {
      await sock.logout();
      sock = null;
    }
  } catch {
    // Ignore
  } finally {
    await prisma.whatsAppSession.deleteMany({});
    connectionStatus = "DISCONNECTED";
    connectedPhoneNumber = null;
    connectedName = null;
    currentQrCode = null;
    currentQrDataUrl = null;
    initWhatsAppBaileys().catch(() => {});
  }
}

