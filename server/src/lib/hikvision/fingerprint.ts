import { authFailureHint, digestFetch } from "./digest";
import type { HikConnection } from "./isapi";

export interface FingerprintEnrollInput {
  employeeNo: string;
  fingerData: string; // base64 ISO/ANSI template captured from the USB reader
  fingerPrintID?: number;
  fingerType?: string;
  enableCardReader?: number[];
}

export interface HikFingerprintResponse {
  statusCode?: string | number;
  subStatusCode?: string;
  errorCode?: string | number;
  errorMsg?: string;
}

function baseUrl(c: HikConnection): string {
  return `${c.useHttps ? "https" : "http"}://${c.host}:${c.port}`;
}

/** Normalise the device's ISAPI JSON response and throw when it errored. */
function parseResponse(json: any): HikFingerprintResponse {
  const envelope = json?.FingerPrintCfg ?? json;
  const code = Number(envelope?.errorCode ?? json?.errorCode ?? "0");
  if (code !== 0) {
    throw new Error(
      `Hikvision error ${code}: ${(envelope?.errorMsg ?? json?.errorMsg ?? "Unknown error").replace(/<[^>]+>/g, "")}`,
    );
  }
  return { ...envelope, errorCode: code } as HikFingerprintResponse;
}

async function bodyFor(input: FingerprintEnrollInput): Promise<string> {
  return JSON.stringify({
    FingerPrintCfg: {
      employeeNo: input.employeeNo,
      enableCardReader: input.enableCardReader ?? [1],
      fingerPrintID: input.fingerPrintID ?? 1,
      fingerType: input.fingerType ?? "normal",
      fingerData: input.fingerData,
    },
  });
}

/**
 * Push a captured fingerprint template to an access-control terminal
 * (e.g. DS-K1T341CMF) via ISAPI. Try PUT (the standard Cfg verb) first,
 * falling back to POST for firmwares that reject PUT on this resource.
 */
export async function addFingerprint(
  conn: HikConnection,
  input: FingerprintEnrollInput,
): Promise<HikFingerprintResponse> {
  const url = `${baseUrl(conn)}/ISAPI/AccessControl/UserInfo/Fingerprint/Cfg?format=json`;
  const req: RequestInit = {
    headers: { "Content-Type": "application/json" },
    body: await bodyFor(input),
  };

  let res = await digestFetch(url, {
    method: "PUT",
    ...req,
    username: conn.username,
    password: conn.password,
    timeoutMs: conn.timeoutMs ?? 8000,
  });
  if (res.status === 405 || res.status === 400 || res.status === 403) {
    res = await digestFetch(url, {
      method: "POST",
      ...req,
      username: conn.username,
      password: conn.password,
      timeoutMs: conn.timeoutMs ?? 8000,
    });
  }
  if (!res.ok) {
    throw new Error(`Terminal rejected fingerprint (HTTP ${res.status})${await authFailureHint(res)}`);
  }

  let json: any;
  try {
    json = await res.json();
  } catch {
    json = {};
  }
  return parseResponse(json);
}

/** List fingerprints enrolled on a terminal (optionally for one employee). */
export async function getFingerprints(
  conn: HikConnection,
  employeeNo?: string,
): Promise<{ employeeNo: string; fingers: { fingerPrintID: number; fingerType: string }[] }[]> {
  const path = employeeNo
    ? `/ISAPI/AccessControl/UserInfo/Fingerprint/Cfg/${encodeURIComponent(employeeNo)}?format=json`
    : "/ISAPI/AccessControl/UserInfo/Fingerprint/Cfg?format=json";
  const res = await digestFetch(`${baseUrl(conn)}${path}`, {
    method: "GET",
    username: conn.username,
    password: conn.password,
    timeoutMs: conn.timeoutMs ?? 8000,
  });
  if (!res.ok) {
    if (res.status === 404) return [];
    throw new Error(`Failed to list fingerprints (HTTP ${res.status})${await authFailureHint(res)}`);
  }
  try {
    const json: any = await res.json();
    const owner = json?.FingerprintInfoList?.FingerprintInfo ?? json?.FingerPrintCfgList?.FingerPrintCfg ?? [];
    const list = Array.isArray(owner) ? owner : owner ? [owner] : [];
    return list
      .filter((u: any) => u?.employeeNo)
      .map((u: any) => ({
        employeeNo: String(u.employeeNo),
        fingers: Array.isArray(u.fingerPrintID) ? u.fingerPrintID.map((id: any) => ({ fingerPrintID: Number(id), fingerType: "normal" })) : [],
      }));
  } catch {
    return [];
  }
}

/** Delete one fingerprint from the terminal. */
export async function deleteFingerprint(
  conn: HikConnection,
  employeeNo: string,
  fingerPrintID: number,
): Promise<HikFingerprintResponse> {
  const url = `${baseUrl(conn)}/ISAPI/AccessControl/UserInfo/Fingerprint/Cfg/${encodeURIComponent(employeeNo)}/${fingerPrintID}?format=json`;
  const res = await digestFetch(url, {
    method: "DELETE",
    username: conn.username,
    password: conn.password,
    timeoutMs: conn.timeoutMs ?? 8000,
  });
  if (!res.ok) {
    throw new Error(`Failed to delete fingerprint (HTTP ${res.status})${await authFailureHint(res)}`);
  }
  let json: any;
  try {
    json = await res.json();
  } catch {
    json = {};
  }
  return parseResponse(json);
}