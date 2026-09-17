"use strict";

const { EventEmitter } = require("events");

const NET_SDK_MAX_DEV_ADDRESS_LEN = 129; // sDeviceAddress
const NAME_LEN = 64;
const PASSWD_LEN = 64;
const NET_SDK_MAX_SERIALNO_LEN = 48;

const OFFSET = {
  sDeviceAddress: 0,
  byUseTransport: NET_SDK_MAX_DEV_ADDRESS_LEN,
  wPort: NET_SDK_MAX_DEV_ADDRESS_LEN + 1,
  sUserName: NET_SDK_MAX_DEV_ADDRESS_LEN + 1 + 2,
  sPassword: NET_SDK_MAX_DEV_ADDRESS_LEN + 1 + 2 + NAME_LEN,
  byLoginMode: NET_SDK_MAX_DEV_ADDRESS_LEN + 1 + 2 + NAME_LEN + PASSWD_LEN + NET_SDK_MAX_SERIALNO_LEN,
};

function writeCString(buf, offset, str, maxLen) {
  const bytes = Buffer.from(str, "ascii");
  const n = Math.min(bytes.length, maxLen - 1);
  bytes.copy(buf, offset, 0, n);
  buf.fill(0, offset + n, offset + maxLen);
}

function nonZeroSlice(buf) {
  let end = buf.length;
  while (end > 0 && buf[end - 1] === 0) end--;
  return buf.subarray(0, end);
}

/**
 * Hardware driver binding to HCNetSDK.dll / libHCNetSDK.so via koffi.
 *
 * The bridge only trusts a DLL when every required symbol resolves. Any
 * missing symbol disables the hardware path (the caller falls back to the
 * simulator) so a mismatched SDK bundle can never crash the bridge.
 */
class HardwareDriver extends EventEmitter {
  constructor(options = {}) {
    super();
    this.mode = "hardware";
    this.model = "DS-K1F820-F";
    this.options = options;
    this.koffi = null;
    this.lib = null;
    this.userID = null;
    this.loggedIn = false;
    this.captureTimer = null;
  }

  getInfo() {
    return { mode: this.mode, model: this.model, fingerprintID: 1, quality: 0 };
  }

  /** Returns { ok, reason }. Throws nothing. */
  async init() {
    try {
      const koffi = require("koffi");
      const loaded = koffi.load(this.options.dllPath || "HCNetSDK");
      this.koffi = koffi;
      this.lib = typeof loaded === "function" ? loaded : await loaded;

      const BOOL = koffi.types.int32;
      const LONG = koffi.types.int32;

      this.lib.func("int32 NET_DVR_Init()");
      this.lib.func("int32 NET_DVR_Cleanup()");
      this.lib.func(`${BOOL} NET_DVR_Logout(${LONG} lUserID)`);
      this.lib.func(`${BOOL} NET_DVR_Login_V40(void *pLoginInfo, void *lpUserID)`);

      const optional = [
        "NET_DVR_StartFingerPrintCapture",
        "NET_DVR_StopFingerPrintCapture",
        "NET_DVR_GetFingerPrintInfo",
        "NET_DVR_CaptureFingerPrint",
      ];
      const captures = optional.filter((name) => typeof this.lib[name] === "function");
      this.captureSymbols = captures;

      if (!this.lib.NET_DVR_Init()) {
        return { ok: false, reason: "NET_DVR_Init() returned false" };
      }
      return { ok: true, reason: "HCNetSDK loaded", captures };
    } catch (error) {
      return { ok: false, reason: error && error.message ? error.message : String(error) };
    }
  }

  async dispose() {
    if (this.captureTimer) clearInterval(this.captureTimer);
    if (this.loggedIn && this.lib && typeof this.lib.NET_DVR_Logout === "function") {
      try {
        this.lib.NET_DVR_Logout(this.userID);
      } catch {
        // ignore
      }
    }
    if (this.lib && typeof this.lib.NET_DVR_Cleanup === "function") {
      try {
        this.lib.NET_DVR_Cleanup();
      } catch {
        // ignore
      }
    }
    this.loggedIn = false;
    this.userID = null;
    this.lib = null;
  }

  login() {
    if (this.loggedIn) return true;
    const buf = Buffer.alloc(1024, 0);
    writeCString(buf, OFFSET.sDeviceAddress, this.options.deviceAddress || "USB1", NET_SDK_MAX_DEV_ADDRESS_LEN);
    buf.writeUInt16LE(this.options.port || 0, OFFSET.wPort);
    writeCString(buf, OFFSET.sUserName, this.options.username || "admin", NAME_LEN);
    writeCString(buf, OFFSET.sPassword, this.options.password || "", PASSWD_LEN);
    buf.writeUInt8(this.options.useTransport || 0, OFFSET.byUseTransport);

    const userIDBuf = Buffer.alloc(4, 0);
    const ok = this.lib.NET_DVR_Login_V40(buf, userIDBuf);
    if (!ok) return false;
    this.userID = userIDBuf.readInt32LE(0);
    this.loggedIn = true;
    return true;
  }

  /**
   * Capture a template (middleware scans, then a base64 payload is emitted).
   * Strategy:
   *   1. start + poll `NET_DVR_GetFingerPrintInfo` until a template arrives,
   *   2. otherwise a single `NET_DVR_CaptureFingerPrint` tick.
   */
  startEnrollment(fingerID = 1) {
    if (!this.lib) {
      this.emit("error", "HCNetSDK is not initialised");
      return;
    }
    if (!this.login()) {
      this.emit("error", "Failed to log in to the USB reader");
      return;
    }

    this.emit("status", "Place your finger on the reader…");

    const hasStart = typeof this.lib.NET_DVR_StartFingerPrintCapture === "function";
    const hasGet = typeof this.lib.NET_DVR_GetFingerPrintInfo === "function";
    const hasCapture = typeof this.lib.NET_DVR_CaptureFingerPrint === "function";

    const stop = () => {
      if (this.captureTimer) clearInterval(this.captureTimer);
      this.captureTimer = null;
      if (typeof this.lib.NET_DVR_StopFingerPrintCapture === "function") {
        try {
          this.lib.NET_DVR_StopFingerPrintCapture(this.userID, fingerID);
        } catch {
          // ignore
        }
      }
    };

    if (hasStart && hasGet) {
      try {
        this.lib.NET_DVR_StartFingerPrintCapture(this.userID, fingerID);
      } catch (error) {
        this.emit("error", `NET_DVR_StartFingerPrintCapture failed: ${error && error.message ? error.message : error}`);
        return;
      }
      const started = Date.now();
      const timeoutMs = this.options.timeoutMs || 20000;
      this.captureTimer = setInterval(() => {
        const out = Buffer.alloc(1024, 0);
        let ok = false;
        try {
          ok = Boolean(this.lib.NET_DVR_GetFingerPrintInfo(this.userID, out, out.length));
        } catch {
          ok = false;
        }
        if (ok) {
          stop();
          this.emit("status", "Finger detected — compiling template…");
          const payload = nonZeroSlice(out);
          if (payload.length > 16) {
            this.emit("template", { fingerID, templateData: payload.toString("base64"), quality: 100 });
          } else {
            this.emit("error", "Captured fingerprint data is too small");
          }
          return;
        }
        if (Date.now() - started > timeoutMs) {
          stop();
          this.emit("error", "Capture timed out — no finger detected");
        }
      }, 400);
      return;
    }

    if (hasCapture) {
      const out = Buffer.alloc(1024, 0);
      let ran = false;
      try {
        ran = Boolean(this.lib.NET_DVR_CaptureFingerPrint(this.userID, fingerID, out, out.length));
      } catch (error) {
        this.emit("error", `NET_DVR_CaptureFingerPrint failed: ${error && error.message ? error.message : error}`);
        return;
      }
      this.emit("status", "Finger detected — compiling template…");
      const payload = nonZeroSlice(out);
      if (ran && payload.length > 16) {
        this.emit("template", { fingerID, templateData: payload.toString("base64"), quality: 100 });
      } else {
        this.emit("error", "Fingerprint capture returned no template");
      }
      return;
    }

    this.emit(
      "error",
      "HCNetSDK fingerprint-capture functions are missing. " +
        "Bind NET_DVR_StartFingerPrintCapture/NET_DVR_GetFingerPrintInfo in bridge/src/driver.js " +
        "(or run with SIMULATE_USB=1 for simulation mode).",
    );
  }

  cancel() {
    if (this.captureTimer) {
      clearInterval(this.captureTimer);
      this.captureTimer = null;
    }
    this.emit("cancelled");
  }
}

module.exports = { HardwareDriver };