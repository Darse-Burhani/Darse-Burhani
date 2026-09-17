import { authFailureHint, digestFetch } from "./digest";
import { baseUrl, xmlTag, type HikConnection } from "./isapi";

export type DoorCommand = "open" | "close" | "alwaysOpen" | "alwaysClose";

export interface DoorStatusResult {
  doorNo: number;
  doorState: "open" | "closed" | "unknown";
  lockState: "locked" | "unlocked" | "unknown";
  magneticState?: "open" | "closed" | "unknown";
  rawStatus?: string;
}

export interface DeviceSystemStatus {
  deviceName?: string;
  model?: string;
  serialNumber?: string;
  macAddress?: string;
  firmwareVersion?: string;
  cpuUsage?: number;
  memoryUsage?: number;
  uptimeSeconds?: number;
  deviceTime?: string;
  doorStatus?: DoorStatusResult;
  userCount?: number;
  faceCount?: number;
  fingerprintCount?: number;
}

export interface DeployUserInput {
  employeeNo: string;
  name: string;
  userType?: "normal" | "visitor" | "blackList";
  gender?: "male" | "female" | "unknown";
  validFrom?: string;
  validTo?: string;
  doorRight?: string;
}

const DOOR_ACTION_MAP: Record<DoorCommand, string> = {
  open: "Door unlocked (pulse)",
  close: "Door closed",
  alwaysOpen: "Door set to Always Open (assembly mode)",
  alwaysClose: "Door secured (locked down)",
};

/**
 * Remote Control Door / Barrier
 * PUT /ISAPI/AccessControl/RemoteControl/door/<doorNo>
 */
export async function remoteControlDoor(
  c: HikConnection,
  doorNo = 1,
  command: DoorCommand = "open",
): Promise<{ success: boolean; command: DoorCommand; doorNo: number; message: string }> {
  const base = baseUrl(c);
  const url = `${base}/ISAPI/AccessControl/RemoteControl/door/${doorNo}`;

  let res = await digestFetch(`${url}?format=json`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ RemoteControlDoor: { cmd: command } }),
    username: c.username,
    password: c.password,
    timeoutMs: c.timeoutMs ?? 6000,
  });

  if (!res.ok) {
    res = await digestFetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/xml" },
      body: `<?xml version="1.0" encoding="UTF-8"?><RemoteControlDoor version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema"><cmd>${command}</cmd></RemoteControlDoor>`,
      username: c.username,
      password: c.password,
      timeoutMs: c.timeoutMs ?? 6000,
    });
  }

  if (!res.ok) {
    throw new Error(`Device rejected door command ${command} (HTTP ${res.status})${await authFailureHint(res)}`);
  }

  return {
    success: true,
    command,
    doorNo,
    message: DOOR_ACTION_MAP[command] || `Door command '${command}' executed successfully.`,
  };
}

/**
 * Query Door Real-time Status
 * GET /ISAPI/AccessControl/Door/status/<doorNo>?format=json
 */
export async function getDoorStatus(c: HikConnection, doorNo = 1): Promise<DoorStatusResult> {
  const url = `${baseUrl(c)}/ISAPI/AccessControl/Door/status/${doorNo}?format=json`;
  try {
    const res = await digestFetch(url, {
      method: "GET",
      username: c.username,
      password: c.password,
      timeoutMs: c.timeoutMs ?? 5000,
    });

    if (res.ok) {
      const text = await res.text();
      let doorState = "";
      let lockState = "";
      try {
        const json = JSON.parse(text);
        const obj = json.DoorStatus || json.doorStatus || json;
        doorState = String(obj.doorState || obj.doorLockStatus || "").toLowerCase();
        lockState = String(obj.lockState || "").toLowerCase();
      } catch {
        doorState = (xmlTag(text, "doorState") || xmlTag(text, "doorLockStatus")).toLowerCase();
        lockState = (xmlTag(text, "lockState") || (doorState.includes("unlock") ? "unlocked" : "locked")).toLowerCase();
      }

      return {
        doorNo,
        doorState: doorState.includes("open") ? "open" : doorState.includes("close") ? "closed" : "unknown",
        lockState: lockState.includes("unlock") ? "unlocked" : lockState.includes("lock") ? "locked" : "unknown",
        rawStatus: text,
      };
    }
  } catch (err) {
    console.warn(`[hikvision] getDoorStatus failed on ${c.host}:`, err);
  }

  return { doorNo, doorState: "unknown", lockState: "unknown" };
}

/**
 * Remote Device Reboot
 * PUT /ISAPI/System/reboot
 */
export async function rebootDevice(c: HikConnection): Promise<{ success: boolean; message: string }> {
  const res = await digestFetch(`${baseUrl(c)}/ISAPI/System/reboot`, {
    method: "PUT",
    username: c.username,
    password: c.password,
    timeoutMs: c.timeoutMs ?? 8000,
  });

  if (!res.ok) {
    throw new Error(`Device rejected reboot command (HTTP ${res.status})${await authFailureHint(res)}`);
  }

  return { success: true, message: "Reboot command sent. Device will restart in 10-20 seconds." };
}

const SNAPSHOT_CALLS: Array<{ path: string; method: "GET" | "POST" | "PUT"; body?: string; ct?: string }> = [
  { path: "/ISAPI/Streaming/channels/101/picture", method: "GET" },
  { path: "/ISAPI/Streaming/channels/1/picture", method: "GET" },
  { path: "/ISAPI/Streaming/channels/102/picture", method: "GET" },
  { path: "/ISAPI/Streaming/channels/101/picture?videoType=jpeg", method: "GET" },
  { path: "/ISAPI/Streaming/channels/1/picture?videoType=jpeg", method: "GET" },
  { path: "/ISAPI/Streaming/channels/201/picture", method: "GET" },
  { path: "/ISAPI/Streaming/channels/2/picture", method: "GET" },
  { path: "/ISAPI/System/Video/inputs/channels/1/capture", method: "GET" },
  { path: "/ISAPI/System/Video/inputs/channels/1/capture/preview", method: "GET" },
  { path: "/ISAPI/ContentMgmt/Image/channels/1", method: "GET" },
  { path: "/ISAPI/AccessControl/CaptureFaceData?format=json", method: "PUT", body: JSON.stringify({ CaptureFaceData: { captureType: "face" } }), ct: "application/json" },
  { path: "/ISAPI/AccessControl/CaptureFaceData?format=json", method: "POST", body: JSON.stringify({ CaptureFaceData: { captureType: "face" } }), ct: "application/json" },
  { path: "/ISAPI/AccessControl/CaptureFaceData", method: "GET" },
  { path: "/ISAPI/AccessControl/CaptureFaceData?format=json", method: "GET" },
  { path: "/ISAPI/AccessControl/FaceCapture/Capture", method: "GET" },
  { path: "/ISAPI/AccessControl/SnapCameraPic", method: "GET" },
  { path: "/ISAPI/AccessControl/SnapShot", method: "GET" },
];

/**
 * Fetch Device Snapshot / Live Frame
 */
export async function getDeviceSnapshot(c: HikConnection): Promise<{ contentType: string; data: Buffer }> {
  const base = baseUrl(c);
  for (const ep of SNAPSHOT_CALLS) {
    try {
      const res = await digestFetch(`${base}${ep.path}`, {
        method: ep.method,
        headers: ep.ct ? { "Content-Type": ep.ct } : undefined,
        body: ep.body,
        username: c.username,
        password: c.password,
        timeoutMs: c.timeoutMs ?? 5000,
      });

      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        const contentType = res.headers.get("content-type") || "image/jpeg";

        // 1. Direct JPEG check (Magic bytes FF D8)
        if (buffer.length > 500 && buffer[0] === 0xff && buffer[1] === 0xd8) {
          return { contentType: "image/jpeg", data: buffer };
        }

        // 2. Base64 embedded in XML/JSON
        const text = buffer.toString("utf8");
        const match =
          text.match(/<(?:faceData|picture)>([\s\S]*?)<\/(?:faceData|picture)>/i) ||
          text.match(/"(?:faceData|picture)"\s*:\s*"([^"]+)"/i);

        if (match?.[1]) {
          const decoded = Buffer.from(match[1].replace(/\s+/g, ""), "base64");
          if (decoded.length > 200) return { contentType: "image/jpeg", data: decoded };
        }

        if (buffer.length > 500 && contentType.startsWith("image/")) {
          return { contentType, data: buffer };
        }
      }
    } catch {}
  }

  throw new Error("Unable to capture snapshot from terminal camera (endpoint not supported or camera busy)");
}

/**
 * Fetch Audio Prompt Volume
 * GET /ISAPI/System/Audio/AudioOut/channels/1?format=json
 */
export async function getAudioVolume(c: HikConnection): Promise<{ volume: number }> {
  try {
    const res = await digestFetch(`${baseUrl(c)}/ISAPI/System/Audio/AudioOut/channels/1?format=json`, {
      method: "GET",
      username: c.username,
      password: c.password,
      timeoutMs: 4000,
    });

    if (res.ok) {
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        return { volume: Number(json.AudioOut?.audioOutVolume ?? json.audioOutVolume ?? 50) };
      } catch {
        const vol = xmlTag(text, "audioOutVolume");
        if (vol) return { volume: Number(vol) };
      }
    }
  } catch {}

  return { volume: 50 };
}

/**
 * Set Audio Prompt Volume (0 - 100)
 * PUT /ISAPI/System/Audio/AudioOut/channels/1
 */
export async function setAudioVolume(c: HikConnection, volume: number): Promise<{ success: boolean; volume: number }> {
  const base = baseUrl(c);
  const safeVol = Math.max(0, Math.min(100, Math.round(volume)));
  const url = `${base}/ISAPI/System/Audio/AudioOut/channels/1`;

  let res = await digestFetch(`${url}?format=json`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ AudioOut: { audioOutVolume: safeVol } }),
    username: c.username,
    password: c.password,
    timeoutMs: 5000,
  });

  if (!res.ok) {
    res = await digestFetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/xml" },
      body: `<?xml version="1.0" encoding="UTF-8"?><AudioOut version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema"><audioOutVolume>${safeVol}</audioOutVolume></AudioOut>`,
      username: c.username,
      password: c.password,
      timeoutMs: 5000,
    });

    if (!res.ok) {
      throw new Error(`Device rejected volume update (HTTP ${res.status})`);
    }
  }

  return { success: true, volume: safeVol };
}

const VOICE_MAP: Record<string, string> = {
  pleaseScanFace: "pleaseSwipeCard",
  welcome: "welcome",
  accessGranted: "authenticatedPass",
  scanAgain: "authenticationFailed",
  maintainQueue: "pleaseWait",
  goodMorning: "welcome",
  goodEvening: "welcome",
  registrationRequired: "illegalCard",
};

/**
 * Play Audio / Voice Prompt on Terminal Speaker
 */
export async function playVoicePrompt(
  c: HikConnection,
  promptType = "pleaseScanFace",
  customText?: string,
): Promise<{ success: boolean; message: string }> {
  const base = baseUrl(c);
  const isapiVoice = VOICE_MAP[promptType] || "pleaseSwipeCard";
  const endpoints = [
    { url: `${base}/ISAPI/AccessControl/voicePlay?format=json`, ct: "application/json", body: JSON.stringify({ VoicePlay: { voiceType: isapiVoice } }) },
    { url: `${base}/ISAPI/AccessControl/voicePlay`, ct: "application/xml", body: `<?xml version="1.0" encoding="UTF-8"?><VoicePlay version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema"><voiceType>${isapiVoice}</voiceType></VoicePlay>` },
    { url: `${base}/ISAPI/System/Audio/AudioOut/channels/1/broadcast`, ct: "application/json", body: JSON.stringify({ audioType: isapiVoice, text: customText || "" }) },
  ];

  for (const ep of endpoints) {
    try {
      const res = await digestFetch(ep.url, {
        method: "POST",
        headers: { "Content-Type": ep.ct },
        body: ep.body,
        username: c.username,
        password: c.password,
        timeoutMs: 4000,
      });

      if (res.ok) {
        return { success: true, message: `Voice prompt '${promptType}' played on ${c.host}` };
      }
    } catch {}
  }

  return { success: true, message: `Voice prompt signal sent to ${c.host}` };
}

/**
 * Deploy / Push User to Device
 */
export async function deployUserToDevice(
  c: HikConnection,
  user: DeployUserInput,
): Promise<{ success: boolean; employeeNo: string; message: string }> {
  const base = baseUrl(c);
  const now = new Date();
  const validFrom = user.validFrom || `${now.getFullYear()}-01-01T00:00:00`;
  const validTo = user.validTo || `${now.getFullYear() + 5}-12-31T23:59:59`;
  const userType = user.userType || "normal";
  const doorRight = user.doorRight || "1";

  const payload = JSON.stringify({
    UserInfo: {
      employeeNo: user.employeeNo,
      name: user.name,
      userType,
      closeDelayEnabled: false,
      Valid: { enable: true, beginTime: validFrom, endTime: validTo, timeType: "local" },
      belongGroup: "1",
      password: "",
      doorRight,
      RightPlan: [{ doorNo: 1, planTemplateNo: "1" }],
      maxOpenDoorTime: 0,
      openDoorTime: 0,
      roomNumber: 0,
      floorNumber: 0,
    },
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<UserInfo version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
  <employeeNo>${user.employeeNo}</employeeNo>
  <name>${user.name}</name>
  <userType>${userType}</userType>
  <Valid>
    <enable>true</enable>
    <beginTime>${validFrom}</beginTime>
    <endTime>${validTo}</endTime>
    <timeType>local</timeType>
  </Valid>
  <doorRight>${doorRight}</doorRight>
  <RightPlan><doorNo>1</doorNo><planTemplateNo>1</planTemplateNo></RightPlan>
</UserInfo>`;

  const attempts = [
    { url: `${base}/ISAPI/AccessControl/UserInfo/Record?format=json`, method: "PUT", ct: "application/json", body: payload },
    { url: `${base}/ISAPI/AccessControl/UserInfo/SetUp?format=json`, method: "POST", ct: "application/json", body: payload },
    { url: `${base}/ISAPI/AccessControl/UserInfo/Record`, method: "PUT", ct: "application/xml", body: xml },
  ];

  let lastRes: Response | null = null;
  for (const att of attempts) {
    const res = await digestFetch(att.url, {
      method: att.method,
      headers: { "Content-Type": att.ct },
      body: att.body,
      username: c.username,
      password: c.password,
      timeoutMs: 8000,
    });
    if (res.ok) {
      return { success: true, employeeNo: user.employeeNo, message: `User ${user.name} (${user.employeeNo}) deployed to terminal successfully.` };
    }
    lastRes = res;
  }

  throw new Error(`Device rejected user provisioning for ${user.employeeNo} (HTTP ${lastRes?.status ?? "unknown"})${lastRes ? await authFailureHint(lastRes) : ""}`);
}

/**
 * Delete User from Device
 * PUT /ISAPI/AccessControl/UserInfo/Delete
 */
export async function deleteUserFromDevice(
  c: HikConnection,
  employeeNo: string,
): Promise<{ success: boolean; employeeNo: string; message: string }> {
  const base = baseUrl(c);
  const jsonBody = JSON.stringify({ UserInfoDelCond: { EmployeeNoList: [{ employeeNo }] } });
  const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><UserInfoDelCond version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema"><EmployeeNoList><employeeNo>${employeeNo}</employeeNo></EmployeeNoList></UserInfoDelCond>`;

  let res = await digestFetch(`${base}/ISAPI/AccessControl/UserInfo/Delete?format=json`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: jsonBody,
    username: c.username,
    password: c.password,
    timeoutMs: 8000,
  });

  if (!res.ok) {
    res = await digestFetch(`${base}/ISAPI/AccessControl/UserInfo/Delete`, {
      method: "PUT",
      headers: { "Content-Type": "application/xml" },
      body: xmlBody,
      username: c.username,
      password: c.password,
      timeoutMs: 8000,
    });
  }

  if (!res.ok) {
    throw new Error(`Device rejected deleting user ${employeeNo} (HTTP ${res.status})${await authFailureHint(res)}`);
  }

  return { success: true, employeeNo, message: `User ${employeeNo} removed from terminal.` };
}

/**
 * Deploy / Push Face Image to Device
 */
export async function deployFaceToDevice(
  c: HikConnection,
  employeeNo: string,
  imageBuffer: Buffer,
): Promise<{ success: boolean; employeeNo: string; message: string }> {
  const base = baseUrl(c);
  const boundary = `----WebKitFormBoundary${Math.random().toString(36).slice(2)}`;
  const faceDataJson = JSON.stringify({ faceLibType: "blackFD", FDID: "1", FPID: employeeNo });

  const multipartBody = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="FaceDataRecord"; filename="faceData.json"\r\nContent-Type: application/json\r\n\r\n${faceDataJson}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="img"; filename="face.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
    imageBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const endpoints = [
    `${base}/ISAPI/Intelligent/FDLib/FaceDataRecord?format=json`,
    `${base}/ISAPI/AccessControl/FDLib/FaceDataRecord?format=json`,
    `${base}/ISAPI/AccessControl/UserInfo/FaceData?format=json`,
  ];

  let lastError = "";
  for (const url of endpoints) {
    try {
      const res = await digestFetch(url, {
        method: "POST",
        headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
        body: multipartBody,
        username: c.username,
        password: c.password,
        timeoutMs: 12000,
      });

      if (res.ok) {
        return { success: true, employeeNo, message: `Face photo for ${employeeNo} deployed to terminal successfully.` };
      }
      lastError = `HTTP ${res.status}`;
    } catch (e: any) {
      lastError = e?.message || String(e);
    }
  }

  throw new Error(`Failed to deploy face to terminal: ${lastError}`);
}

/**
 * Assign / Deploy RFID Card to User on Device
 */
export async function deployCardToDevice(
  c: HikConnection,
  employeeNo: string,
  cardNo: string,
): Promise<{ success: boolean; employeeNo: string; cardNo: string; message: string }> {
  const base = baseUrl(c);
  const body = JSON.stringify({ CardInfo: { employeeNo, cardNo: cardNo.trim(), cardType: "normalCard", leaderCard: "0" } });

  let res = await digestFetch(`${base}/ISAPI/AccessControl/CardInfo/Record?format=json`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body,
    username: c.username,
    password: c.password,
    timeoutMs: 8000,
  });

  if (!res.ok) {
    res = await digestFetch(`${base}/ISAPI/AccessControl/CardInfo/SetUp?format=json`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      username: c.username,
      password: c.password,
      timeoutMs: 8000,
    });
  }

  if (!res.ok) {
    throw new Error(`Device rejected card assignment (HTTP ${res.status})${await authFailureHint(res)}`);
  }

  return { success: true, employeeNo, cardNo, message: `Card ${cardNo} assigned to ${employeeNo} on device successfully.` };
}

/**
 * Query Comprehensive Hardware & System Status
 */
export async function getDeviceSystemStatus(c: HikConnection): Promise<DeviceSystemStatus> {
  const base = baseUrl(c);
  const result: DeviceSystemStatus = {};

  const fetchXml = async (path: string) => {
    try {
      const res = await digestFetch(`${base}${path}`, {
        method: "GET",
        username: c.username,
        password: c.password,
        timeoutMs: 5000,
      });
      return res.ok ? await res.text() : "";
    } catch {
      return "";
    }
  };

  const [infoXml, statusXml, door] = await Promise.all([
    fetchXml("/ISAPI/System/deviceInfo"),
    fetchXml("/ISAPI/System/status"),
    getDoorStatus(c, 1).catch(() => undefined),
  ]);

  if (infoXml) {
    result.deviceName = xmlTag(infoXml, "deviceName") || undefined;
    result.model = xmlTag(infoXml, "model") || undefined;
    result.serialNumber = xmlTag(infoXml, "serialNumber") || undefined;
    result.macAddress = xmlTag(infoXml, "macAddress") || undefined;
    result.firmwareVersion = xmlTag(infoXml, "firmwareVersion") || undefined;
  }

  if (statusXml) {
    const cpu = xmlTag(statusXml, "cpuUtilization");
    const mem = xmlTag(statusXml, "memoryUtilization");
    const uptime = xmlTag(statusXml, "deviceUpTime");
    if (cpu) result.cpuUsage = Number(cpu);
    if (mem) result.memoryUsage = Number(mem);
    if (uptime) result.uptimeSeconds = Number(uptime);
  }

  if (door) result.doorStatus = door;
  return result;
}
