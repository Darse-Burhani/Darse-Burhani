/**
 * SMS service for sending text message reminders.
 * Currently supports Twilio. Can be extended for other providers.
 */

export interface SendSmsOptions {
  to: string;
  message: string;
}

/**
 * Send an SMS message using Twilio.
 * Returns true if the message was sent successfully, false otherwise.
 * Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER env vars.
 */
export async function sendSms(options: SendSmsOptions): Promise<boolean> {
  const { to, message } = options;

  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
    console.warn("Twilio not configured — SMS not sent");
    return false;
  }

  try {
    // Use fetch directly to avoid requiring the twilio SDK
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    // Format phone number: remove any non-digit characters, ensure it starts with +
    const formattedTo = to.startsWith("+") ? to : `+${to.replace(/\D/g, "")}`;

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: formattedTo,
          From: fromNumber,
          Body: message,
        }),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Twilio SMS failed for ${to}:`, errorBody);
      return false;
    }

    console.log(`SMS sent successfully to ${to}`);
    return true;
  } catch (error) {
    console.error("SMS send error:", error instanceof Error ? error.message : error);
    return false;
  }
}
