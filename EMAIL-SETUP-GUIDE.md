# Leave Email Setup — Full Guide

Parent leave submissions notify the administration by **in-app notification** (works automatically)
and by **email**. This guide gets the email part working in production.

---

## Why email needs an external provider

The app is hosted on **Render's free plan**, which blocks **all outbound SMTP ports (25, 465, 587)**
since September 2025. That means the Gmail SMTP account (`admin.galiakot@darseburhani.org` app
password) works on your local machine but **can never send from Render** — the connection just
times out.

The fix (already deployed): leave emails are sent over **HTTPS (port 443)** through an email API
provider. Two providers are wired in, and **whichever API key you add first is used automatically**:

| Priority | Provider | Env variable | Free quota |
| --- | --- | --- | --- |
| 1st | Resend | `RESEND_API_KEY` | 3,000 emails/month (~100/day) |
| 2nd | Brevo | `BREVO_API_KEY` | 300 emails/day (~9,000/month) |
| 3rd | Gmail SMTP (fallback) | `LEAVE_SMTP_PASS` | Works locally only; blocked on Render |

You only need **one** of the two API keys. Brevo is the easiest to set up.

---

## Option A — Brevo (recommended, easiest)

1. **Create a free account**
   - Go to <https://app.brevo.com> → Sign up (no credit card needed).
   - Use your own email for the Brevo login; the *sender* address is configured in the next step.

2. **Verify the sender address**
   - In Brevo: **Senders, Domains & Dedicated IPs → Senders → Add a sender**.
   - Name: `Darse Burhani Galiakot` — Email: `admin.galiakot@darseburhani.org`.
   - Brevo emails a **confirmation link** to that mailbox. Open the mailbox (it arrives through your
     existing mailflare inbox / admin mail panel) and click the link.
   - No DNS changes are required for this step.

3. **Create an API key**
   - In Brevo: **SMTP & API → API Keys → Generate a new API key**.
   - Name it `darse-burhani-portal`. Copy the key (starts with `xkeysib-`) — it is shown only once.

4. **Add the key to Render**
   - Go to <https://dashboard.render.com> → open the **darse-burhani** service →
     **Environment** tab → **Add environment variable**:
     - Key: `BREVO_API_KEY`
     - Value: the `xkeysib-...` key from step 3
   - Click **Save changes**. Render redeploys automatically (takes a few minutes).

5. **Verify in the app**
   - Open the portal → **Admin → Leave** page.
   - The **Leave Email Service** card at the top should show:
     - Chip **Brevo** with a green dot
     - Connectivity message gone (previously it showed "SMTP connection timed out")
   - Click **Send Test Email** → within a minute the test mail should arrive in
     `admin.galiakot@darseburhani.org`.
   - Submit a real leave from the **Parent portal** — the admin mailbox receives the full
     application email, and the in-app notification bell shows the alert.

---

## Option B — Resend

1. **Create a free account**
   - Go to <https://resend.com> → Sign up (free plan: 3,000 emails/month).

2. **Verify the domain (best deliverability)**
   - In Resend: **Domains → Add domain** → `darseburhani.org`.
   - Resend shows 3–4 DNS records (SPF, DKIM, DMARC). Add them where the domain's DNS is managed
     (Cloudflare, if that is where `darseburhani.org` lives).
   - Wait until the domain shows **Verified** (usually minutes, can take up to an hour).

3. **Create an API key**
   - In Resend: **API Keys → Create API key**. Copy the key (starts with `re_`).

4. **Add the key to Render** — same as step 4 in Option A, but with the variable name
   `RESEND_API_KEY`.

5. **Verify in the app** — same as step 5 in Option A, except the **Resend** chip lights up green.

> Note: until the domain is verified, Resend only allows sending *to your own account email*.
> Domain verification is effectively required for parent-mailbox delivery.

---

## Troubleshooting

The **Leave Email Service** card on the Admin → Leave page reports every failure with its exact
reason. Common cases:

| Message on the card / test result | Meaning & fix |
| --- | --- |
| `SMTP connection timed out after 3000ms` | No API key configured yet, so it is testing the blocked SMTP route. Add `BREVO_API_KEY` or `RESEND_API_KEY`. |
| `Brevo API 401: Key not found` / `Resend API 401` | The API key in Render is wrong or was regenerated — copy a fresh key into Render. |
| `Brevo API 401: sender email not verified` (or similar) | Finish step A-2: click the confirmation link Brevo emailed to the admin mailbox. |
| `Resend API 403: You can only send testing emails to your own email` | The `darseburhani.org` domain is not yet verified in Resend — complete Option B step 2. |
| Test says "dispatched" but no mail arrives | Check the admin mailbox's **spam** folder once; if it lands in spam repeatedly, add the provider's SPF/DKIM DNS records (Brevo shows them under *Senders & Domains*). |
| Nothing configured at all | Set one of the env variables on Render (steps above). |

---

## Notes & limits

- **In-app notifications do not depend on email** — the bell alerts, banner, and chime always work.
- Emails are sent for: new leave applications (to all active admin addresses + the designated
  admin mailbox), approval/reduction decisions (to parents), receipts (to parents), and manual
  parent notices from the leave page.
- Free-tier limits are per calendar day (Brevo) or month (Resend); leave volume at the madrasa
  is far below both. The email service card shows which provider is live at any time.
- Keep the existing `LEAVE_SMTP_*` variables on Render — they act as a harmless local/SSH fallback
  and preserve the current status display.
- If you ever upgrade Render beyond the free plan, raw Gmail SMTP unblocks automatically and the
  existing SMTP fallback starts working again — no code change needed.
