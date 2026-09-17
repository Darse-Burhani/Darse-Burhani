import { Router } from "express";
import { requireRole } from "../middleware";
import prisma from "../lib/prisma";
import { toConnection, toDeviceDto } from "../lib/hikvision";
import {
  addFingerprint,
  getFingerprints,
  deleteFingerprint,
} from "../lib/hikvision/fingerprint";

const router = Router();

async function resolveDevice(deviceId?: string) {
  if (deviceId) {
    const device = await prisma.biometricDevice.findUnique({ where: { id: deviceId } });
    if (!device) throw new Error("Device not found");
    return device;
  }
  if (process.env.HIKVISION_ENROLL_DEVICE_ID) {
    const device = await prisma.biometricDevice.findUnique({
      where: { id: process.env.HIKVISION_ENROLL_DEVICE_ID },
    });
    if (device) return device;
  }
  const device = await prisma.biometricDevice.findFirst({
    where: { enabled: true },
    orderBy: { createdAt: "asc" },
  });
  if (!device) throw new Error("No Hikvision terminal configured. Add a device in Admin → Biometric first.");
  return device;
}

/**
 * Sync the talabat's local record to the employee number used on the
 * terminal, so incoming terminal events (employeeNoString) resolve back to
 * them even if a previously-registered hash changes.
 */
async function syncEmployeeToStudent(employeeNo: string) {
  const updated = await prisma.studentProfile.updateMany({
    where: {
      OR: [
        { its: employeeNo },
        { studentId: employeeNo },
        { darsId: employeeNo },
        { trNo: employeeNo },
        { biometricHash: employeeNo },
      ],
    },
    data: { biometricHash: employeeNo },
  });
  return updated.count;
}

// POST /api/members/add-fingerprint
// Body: { employeeNo, fingerData, fingerPrintID?, fingerType?, deviceId? }
router.post("/add-fingerprint", requireRole("ADMIN"), async (req, res) => {
  try {
    const { employeeNo, fingerData, fingerPrintID, fingerType, deviceId } =
      req.body as Record<string, any>;

    if (typeof employeeNo !== "string" || !employeeNo.trim()) {
      return res.status(400).json({ success: false, error: "employeeNo is required" });
    }
    if (typeof fingerData !== "string" || !fingerData.trim()) {
      return res.status(400).json({ success: false, error: "fingerData (base64 template) is required" });
    }
    if (!/^[A-Za-z0-9+/=]+$/.test(fingerData.trim()) || fingerData.trim().length < 64) {
      return res.status(400).json({ success: false, error: "fingerData must be a valid base64 fingerprint template" });
    }

    const device = await resolveDevice(deviceId);
    const result = await addFingerprint(toConnection(device), {
      employeeNo: employeeNo.trim(),
      fingerData: fingerData.trim(),
      fingerPrintID: Number(fingerPrintID) || 1,
      fingerType: typeof fingerType === "string" ? fingerType : "normal",
    });

    const linkedStudents = await syncEmployeeToStudent(employeeNo.trim());

    await prisma.biometricDevice.update({
      where: { id: device.id },
      data: { status: "ONLINE", lastError: null, lastSeenAt: new Date() },
    });

    return res.json({
      success: true,
      data: {
        employeeNo: employeeNo.trim(),
        fingerPrintID: Number(fingerPrintID) || 1,
        device: toDeviceDto(device),
        result,
        attendance: { linkedStudents, matchedBy: linkedStudents ? "studentId/darsId/trNo" : "none" },
      },
    });
  } catch (error: any) {
    console.error("Members add-fingerprint error:", error);
    const message = error?.message ?? "Failed to enroll fingerprint";
    if (message.startsWith("No Hikvision terminal")) {
      return res.status(400).json({ success: false, error: message });
    }
    if (message === "Device not found") {
      return res.status(404).json({ success: false, error: message });
    }
    if (/Hikvision error|rejected fingerprint|HTTP \d+/.test(message)) {
      return res.status(502).json({ success: false, error: `Terminal error: ${message}` });
    }
    return res.status(500).json({ success: false, error: message });
  }
});

// GET /api/members/fingerprints?deviceId=&employeeNo=
router.get("/fingerprints", requireRole("ADMIN"), async (req, res) => {
  try {
    const device = await resolveDevice(req.query.deviceId as string | undefined);
    const fingerprints = await getFingerprints(
      toConnection(device),
      (req.query.employeeNo as string) || undefined,
    );
    return res.json({ success: true, data: { device: toDeviceDto(device), fingerprints } });
  } catch (error: any) {
    console.error("Members list-fingerprints error:", error);
    return res.status(500).json({ success: false, error: error?.message ?? "Failed to list fingerprints" });
  }
});

// DELETE /api/members/fingerprints
// Body: { employeeNo, fingerPrintID, deviceId? }
router.delete("/fingerprints", requireRole("ADMIN"), async (req, res) => {
  try {
    const { employeeNo, fingerPrintID, deviceId } = req.body as Record<string, any>;
    if (typeof employeeNo !== "string" || !employeeNo.trim()) {
      return res.status(400).json({ success: false, error: "employeeNo is required" });
    }
    const device = await resolveDevice(deviceId);
    const result = await deleteFingerprint(
      toConnection(device),
      employeeNo.trim(),
      Number(fingerPrintID) || 1,
    );
    return res.json({ success: true, data: { employeeNo: employeeNo.trim(), result } });
  } catch (error: any) {
    console.error("Members delete-fingerprint error:", error);
    return res.status(500).json({ success: false, error: error?.message ?? "Failed to delete fingerprint" });
  }
});

export default router;