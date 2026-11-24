import "../env";
import prisma from "../lib/prisma";
import { sendLeaveEmailDetailed } from "../lib/email";
import { sendBaileysMessage, getBaileysStatus } from "../lib/whatsapp-baileys";
import { formatWhatsAppPhone } from "../lib/whatsapp";

async function shootDemoToTeacher(employeeId: string) {
  console.log(`\n======================================================`);
  console.log(`Preparing demo shoot for Employee ID: ${employeeId}...`);

  const teacher = await prisma.teacherProfile.findFirst({
    where: { OR: [{ employeeId }, { id: employeeId }] },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });

  if (!teacher) {
    console.error(`Teacher with ID ${employeeId} not found!`);
    return null;
  }

  const teacherName = `${teacher.user.firstName || ""} ${teacher.user.lastName || ""}`.trim();
  const primaryEmail = teacher.tEmail || teacher.user.email;
  const secondaryEmail = teacher.user.email !== primaryEmail ? teacher.user.email : undefined;
  const teacherPhone = teacher.mobile;

  console.log(`Target Faculty: ${teacherName}`);
  console.log(`Emails: ${primaryEmail}${secondaryEmail ? ` (CC: ${secondaryEmail})` : ''}`);
  console.log(`Mobile/WhatsApp: ${teacherPhone}`);

  // 1. Email dispatch from admin.galiakot@darseburhani.org
  const emailSubject = `Attendance Notification - ${teacherName}`;
  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: auto; padding: 28px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; color: #1e293b;">
      <h2 style="color: #991b1b; margin-top: 0; margin-bottom: 16px; font-size: 20px; font-weight: bold; border-bottom: 2px solid #fecaca; padding-bottom: 8px;">Attendance Notification</h2>
      <p style="font-size: 15px; margin-bottom: 12px; color: #334155;">Salaam-e-Jameel,</p>
      <p style="font-size: 16px; font-weight: bold; margin-bottom: 16px; color: #0f172a;">${teacherName}</p>
      <p style="font-size: 14px; line-height: 1.6; margin-bottom: 16px; color: #1e293b;">
        You have been marked <strong>ABSENT</strong> for today, as you have not completed your attendance scanning.
      </p>
      <p style="font-size: 14px; line-height: 1.6; margin-bottom: 16px; color: #334155;">
        In case of any discrepancy or concern regarding your attendance status, kindly contact Maktab Tanzeem immediately for necessary clarification.
      </p>
      <p style="font-size: 14px; line-height: 1.6; margin-bottom: 24px; color: #b91c1c; font-weight: 600;">
        Strict compliance with the attendance scanning procedure is expected henceforth.
      </p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="font-size: 14px; font-weight: bold; margin: 0; color: #0f172a;">Maktab Tanzeem</p>
      <p style="font-size: 13px; color: #64748b; margin: 2px 0 0 0;">Darse Burhani - Galiakot</p>
      <p style="font-size: 11px; color: #94a3b8; margin-top: 8px;">admin.galiakot@darseburhani.org</p>
    </div>
  `;

  console.log(`Shooting email via Google Apps Script HTTPS relay...`);
  const emailRes = await sendLeaveEmailDetailed({
    to: primaryEmail,
    subject: emailSubject,
    html: emailHtml,
    from: `"Maktab Tanzeem, Darse Burhani" <admin.galiakot@darseburhani.org>`,
    transactional: true,
  });

  console.log(`Email result:`, JSON.stringify(emailRes));

  // 2. WhatsApp dispatch
  const cleanPhone = teacherPhone ? formatWhatsAppPhone(teacherPhone) : null;
  const whatsAppMessage = [
    `*Attendance Notification*`,
    ``,
    `Salaam-e-Jameel,`,
    `*${teacherName}*`,
    `You have been marked *ABSENT* for today, as you have not completed your attendance scanning.`,
    ``,
    `In case of any discrepancy or concern regarding your attendance status, kindly contact Maktab Tanzeem immediately for necessary clarification.`,
    ``,
    `Strict compliance with the attendance scanning procedure is expected henceforth.`,
    ``,
    `*Maktab Tanzeem*`,
    `*Darse Burhani - Galiakot*`,
  ].join("\n");

  let whatsAppSent = false;
  let whatsAppError: string | undefined;
  let whatsAppUrl: string | null = null;

  if (cleanPhone) {
    whatsAppUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsAppMessage)}`;
    console.log(`WhatsApp Link generated: ${whatsAppUrl}`);

    const baileys = getBaileysStatus();
    console.log(`Baileys gateway status:`, baileys.status);
    if (baileys.isConnected) {
      try {
        const bRes = await sendBaileysMessage(cleanPhone, whatsAppMessage);
        whatsAppSent = bRes.success;
        if (!bRes.success) whatsAppError = bRes.error;
        console.log(`Baileys dispatch result:`, bRes);
      } catch (err: any) {
        whatsAppError = err?.message;
        console.error(`Baileys error:`, err);
      }
    } else {
      whatsAppError = "Baileys cloud session is offline";
      console.log(`Notice: Baileys is offline, direct wa.me link is active.`);
    }
  }

  // Also record a notification in DB for traceability
  await prisma.notification.create({
    data: {
      userId: teacher.user.id,
      title: "Attendance Notification",
      body: `You have been marked ABSENT for today, as you have not completed your attendance scanning.`,
      type: "ATTENDANCE_ABSENT",
      actionUrl: "/portal/faculty",
    },
  }).catch((e) => console.warn("Failed to create notification row:", e?.message));

  return {
    teacherName,
    emailSent: emailRes.success,
    emailError: emailRes.error,
    messageId: emailRes.messageId,
    whatsAppSent,
    whatsAppError,
    whatsAppUrl,
    phone: cleanPhone,
  };
}

async function main() {
  console.log("=== STARTING DEMO ABSENT NOTIFICATION DISPATCH ===");

  // 1. Shaikh Qutbuddin Ezzy (Employee ID: 20359538)
  const qutbResult = await shootDemoToTeacher("20359538");

  // 2. Hatim Mithaiwala (Employee ID: 50463544)
  const hatimResult = await shootDemoToTeacher("50463544");

  console.log("\n=== FINAL DEMO SUMMARY ===");
  console.log("Shaikh Qutbuddin:", JSON.stringify(qutbResult, null, 2));
  console.log("Hatim Mithaiwala:", JSON.stringify(hatimResult, null, 2));
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
