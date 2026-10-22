# Hikvision → Darse Burhani Cloud — Full Connection Guide

This is the production playbook for connecting the two MinMoe terminals
(`192.168.0.4` and `192.168.0.5`) to the cloud attendance system, keeping their
clocks on Indian Standard Time, and displaying a complete Full-Strength roster
on the **Hikvision Scans** page.

---

## 1. Architecture

```
┌──────────────────────────┐        HTTPS 443 (device-initiated push)
│  MinMoe 192.168.0.4      │ ─────────────────────────────────────────────┐
│  MinMoe 192.168.0.5      │                                              │
└────────────┬─────────────┘                                              ▼
             │ ISAPI (LAN)                              ┌─────────────────────────────────┐
             │                                          │  https://darse-burhani-galiakot │
             ▼                                          │  .com/api/hikvision/events      │
┌──────────────────────────┐   same webhook (backup)     │                                 │
│ School PC bridge         │ ──────────────────────────▶ │  Express webhook handler        │
│ scripts/hikvision-       │                            │  → processBiometricScan()       │
│ cloud-bridge.mjs         │                            │  → PostgreSQL attendance records │
│ • 4s LAN poller          │                            └─────────────────────────────────┘
│ • AlertStream listener   │                                              │
│ • IST clock correction   │                                              ▼
└──────────────────────────┘                            ┌─────────────────────────────────┐
                                                        │ Admin → Hikvision Scans         │
                                                        │ Full Strength / Present /       │
                                                        │ Absent / Medical / Leave        │
                                                        └─────────────────────────────────┘
```

Two independent ingestion paths are intentional:

1. **Device → cloud webhook** — instant, no school PC required. This is the
   primary path.
2. **School-PC bridge** — polls the same terminals over the LAN every 4 seconds,
   replays anything the webhook missed, and keeps the terminal clocks accurate.
   This is the reliability layer.

Even if the school PC is off, path 1 continues to record punches. Even if the
public webhook is temporarily unreachable, path 2 keeps a local copy and retries.

---

## 2. Current production values

| Setting | Value |
| --- | --- |
| Public webhook | `https://darse-burhani-galiakot.com/api/hikvision/events` |
| Shared secret | `BIOMETRIC_SECRET` in the server environment; when empty the code falls back to `DARSEBURHANI5253` |
| Terminals | `192.168.0.4:80`, `192.168.0.5:80` (HTTP/ISAPI on the LAN) |
| Timezone | `Asia/Kolkata` (IST, UTC+05:30) |
| Scan window | `Tilawat al Dua` 07:00–12:30 |
| Scheduler | `POST`/`PUT` webhook, XML or JSON multipart, auto-detected |

> The admin console shows the exact webhook URL to copy under
> **Admin → Biometric → Hikvision → Cloud Connection**. Always use that value;
> it is generated from `HIKVISION_PUSH_URL` so the cloud and bridge can never
> diverge.

### Environment variables

```env
# The URL terminals must reach from the school network (HTTPS).
HIKVISION_PUSH_URL="https://darse-burhani-galiakot.com/api/hikvision/events"

# Shared secret. If empty, DARSEBURHANI5253 is used as a fallback.
BIOMETRIC_SECRET="change-me-to-a-long-random-value"

# Optional bridge overrides
HIKVISION_HOSTS="192.168.0.4,192.168.0.5"
HIKVISION_USERNAME="admin"
HIKVISION_PASSWORD="********"
BRIDGE_STATUS_PORT="8099"
```

After changing server environment variables, redeploy/restart the API and the
bridge.

---

## 3. Configure the terminals (one time)

There are two ways to register the cloud webhook on a MinMoe terminal.

### Option A — from the admin console (recommended, terminal must be reachable)

1. Open **Admin → Biometric**.
2. In the device list, press **Push Webhook** on each terminal.
3. The server writes an `HttpHostNotification` entry with:
   - protocol `HTTPS`
   - port `443`
   - path `/api/hikvision/events`
   - format `XML`
4. Confirm the toast reports success.

This requires the API server to reach `192.168.0.x`. On Render this is only
possible through the local bridge; if the button times out, use Option B.

### Option B — on the terminal web UI

For **each** terminal (`http://192.168.0.4`, `http://192.168.0.5`):

1. **Configuration → Network → Advanced → HTTP Listening**.
2. Enable **HTTP Listening** / **Alarm Server**.
3. Set:
   - Protocol: `HTTPS`
   - Host / Address: `darse-burhani-galiakot.com`
   - Port: `443`
   - URL / Path: `/api/hikvision/events`
   - Format: `XML`
   - Authentication: `None`
4. Save and reboot the terminal if prompted.
5. Test with the terminal's **Test** button — the cloud should answer `200`.

The secret is accepted as either:

- header `x-biometric-secret: <secret>`, or
- query parameter `?secret=<secret>`, or
- HTTP Basic auth whose password equals the secret.

The webhook route is also a safe `GET` health probe, so opening the URL in a
browser returns a JSON acknowledgement instead of an error.

---

## 4. Run the school-PC bridge 24/7

On the Windows PC inside the school LAN:

```powershell
npm install
npm run hikvision:bridge
```

Or double-click `scripts/start-hikvision-cloud-bridge.bat` / the silent VBS
launcher. For an always-on setup, register the VBS or batch file in **Task
Scheduler** with:

- Trigger: *At startup*
- Run whether user is logged on or not
- Restart on failure: every 1 minute

Bridge health:

```text
http://localhost:8099/api/status
```

It reports uptime, total punches, webhook successes, direct-DB fallbacks, and
the monitored terminals.

The bridge automatically:

- derives the cloud target from `HIKVISION_PUSH_URL`;
- polls each terminal every 4 seconds for missed scans;
- listens to the real-time alert stream;
- reads each terminal clock, computes drift with round-trip compensation, and
  rewrites the clock to IST when drift exceeds **45 seconds**;
- never uses the PC's local timezone — all clock values are generated with
  `Intl.DateTimeFormat("Asia/Kolkata")`.

---

## 5. Time synchronization rules

The system uses one rule everywhere: **store UTC, display Asia/Kolkata**.

- Device `<localTime>` values without an offset are treated as IST wall-clock
  and parsed as `...+05:30`.
- Native terminal push timestamps without an offset are parsed by
  `parseScanTime()` as IST.
- The server rewrites a drifting terminal on every poll cycle when needed.
- The bridge rewrites a drifting terminal on startup immediately and re-checks
  every 30 seconds.
- The admin console has **Sync All Clocks (IST)** and per-device **Sync Clock**
  actions.
- Scan times in the UI are always formatted with
  `timeZone: "Asia/Kolkata"`.

If a terminal shows the wrong time:

1. Check the terminal's own NTP setting; disable public NTP if it cannot reach
   the internet.
2. Press **Sync All Clocks (IST)**.
3. Start the bridge so it can reach the private `192.168.x.x` address from the
   school LAN.
4. Verify the terminal's clock and the live scan timestamp now agree.

---

## 6. Verify end-to-end

1. Open **Admin → Hikvision Scans**.
2. Confirm **Full Strength** shows the enrolled students + faculty for the
   selected audience.
3. Ask one person to scan at a terminal.
4. Within a few seconds:
   - the **Scanned** count increases,
   - that person moves from **Absent** to **Present** or **Late**,
   - the timestamp matches IST to the second.
5. The KPI cards must satisfy:

   ```text
   Full Strength = Present + Late + Absent + Medical + On Leave
   ```

   (`Absent` includes members who have not scanned and have no approved
   medical/leave exemption.)
6. Use the status chips to drill into **Present**, **Late**, **Absent**,
   **Medical**, and **On Leave**.
7. Press **Poll Scans Now** to force a manual pull from the terminals.

---

## 7. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Webhook returns `401` | Wrong/missing secret | Copy the URL from the admin console or set the same `BIOMETRIC_SECRET` on the server and bridge |
| Webhook returns `404` | Wrong path | Use exactly `/api/hikvision/events` |
| `SSL` / certificate error on the terminal | HTTPS chain not trusted | Use the public domain certificate; HTTP-only terminals need a TLS-terminating reverse proxy or tunnel |
| Scans appear only while the bridge runs | Device cannot reach the public URL | Fix outbound HTTPS/DNS on the school network, or keep the bridge running 24/7 |
| Device clock keeps drifting | CMOS battery / NTP unreachable | Replace battery, disable public NTP, keep the bridge clock sync running |
| Teacher scans show as `Unmatched` | `employeeNoString` not linked to a profile | Set the teacher's ITS / biometric ID to the exact number enrolled on the terminal |
| Duplicate scans | Multiple ingestion paths | Harmless — serial/rapid-read deduplication suppresses repeats within the window |
| Full Strength seems high | All active faculty are counted | Filter by grade/audience, or deactivate staff who should not be in the attendance roster |

---

## 8. Teacher accounts created from the PDF

The official `public/Teacher.pdf` timetable is the source of truth for the 12
scheduled teachers and their 240 periods. The two manually created accounts are
linked:

| Teacher | Login | Periods |
| --- | --- | --- |
| Burhanddin Sir Kundli | `burhanuddin.kundli@darseburhani.com` | **28** |
| Mustafa Tailor | `mustafa.tailor@mahadalzahra.com` (ITS `40444603`) | **14** |

Run the audit at any time:

```powershell
npx tsx scratch/audit-timetable.ts
```

Force a full re-sync from the PDF if the timetable ever drifts:

```powershell
npx tsx scripts/force-sync-exact-pdf-timetable.ts
```

> **Biometric matching note:** Mustafa Tailor has ITS `40444603`, which the
> terminal can use as the employee number. Burhanddin Sir Kundli's profile has
> no ITS yet; enroll him on the terminal with employee number
> `EMP-BURHANDDIN` or add his ITS in **Admin → Faculty** so scans resolve to his
> teacher profile instead of the unmatched queue.
