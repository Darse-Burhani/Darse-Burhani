# Hikvision → Darse Burhani Cloud — Full Connection Guide

This is the production playbook for connecting the two MinMoe terminals
(`192.168.0.4` and `192.168.0.5`) to the cloud attendance system, keeping their
clocks on Indian Standard Time, and displaying a complete Full-Strength roster
on the **Hikvision Scans** page.

---

## 1. Architecture

```
┌──────────────────────────┐   HTTPS 443 (device-initiated push)
│  MinMoe 192.168.0.4      │ ───────────────────────────────────────────┐
│  MinMoe 192.168.0.5      │                                            │
└──────────────────────────┘                                            ▼
                                              ┌──────────────────────────────────────┐
                                              │ /api/hikvision/events                │
                                              │  → biometric_scan_logs (Supabase)    │
                                              │  → processBiometricScan()            │
                                              │  → attendance records                │
                                              └──────────────────────────────────────┘
                                                                    │
                                                                    ▼
                                              ┌──────────────────────────────────────┐
                                              │ Scan-ledger reconciler (every 2 min) │
                                              │ reads any punch still pending in     │
                                              │ Supabase and applies attendance      │
                                              └──────────────────────────────────────┘
```

There is no bridge process and no LAN polling in production. The terminals push
every punch outbound to the cloud; the cloud writes it to the Supabase table
`biometric_scan_logs` and derives attendance from that ledger.

Supabase is the single source of truth:

1. **Ingestion** — the webhook stores each punch in `biometric_scan_logs` and
   applies it immediately.
2. **Reconciliation** — a background job (`startScanLedgerReconciler`, every 2
   minutes) replays any punch still marked `RECEIVED` / `POLL` / `BACKFILL` /
   `UNMATCHED` / `UNKNOWN` / `ERROR` so nothing is lost when identity mapping or
   the network was momentarily unavailable.
3. **Manual / historical** — `POST /api/admin/attendance-logs/sync-from-supabase`
   or `npm run attendance:reconcile -w server [YYYY-MM-DD]` replays the ledger
   for a given IST day. Neither touches the school LAN.

The old LAN bridge was removed; `server/src/scripts/backfill-scan-ledger.ts`
remains the only LAN-dependent helper, intended for one-off imports of punches
still sitting in terminal memory.

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

# Optional: only needed for one-off LAN imports on the school PC
HIKVISION_HOSTS="192.168.0.4,192.168.0.5"
HIKVISION_USERNAME="admin"
HIKVISION_PASSWORD="********"
```

After changing server environment variables, redeploy/restart the API.

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

This requires the API server to reach `192.168.0.x`, which the cloud normally
cannot do — on Render the button will time out, so use Option B.

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

## 4. Operating without a bridge

Nothing needs to run inside the school LAN for day-to-day attendance. Once the
HTTP Listening entry of section 3 is in place, each punch travels:

1. terminal → `https://darse-burhani-galiakot.com/api/hikvision/events`
2. webhook → `biometric_scan_logs` row (`source: PUSH`)
3. `processBiometricScan()` → AttendanceRegistry / AttendanceRecord
4. any row still pending is replayed by the ledger reconciler

Useful Supabase-side operations:

| Action | How |
| --- | --- |
| Watch raw punches | `GET /api/admin/attendance-logs/scan-ledger?date=YYYY-MM-DD` |
| Replay today's pending punches | `POST /api/admin/attendance-logs/sync-from-supabase` |
| Replay from a shell | `npm run attendance:reconcile -w server [YYYY-MM-DD]` |
| One-off LAN history import | `npx tsx server/src/scripts/backfill-scan-ledger.ts [YYYY-MM-DD]` |
| Fix a drifted terminal | **Admin → Biometric → Sync Clock** (needs LAN access) |

> If a terminal genuinely cannot reach the public webhook (no internet or
> blocked outbound HTTPS), fix that network path — a bridge is no longer part of
> the supported design. Until then, run
> `npx tsx server/src/scripts/backfill-scan-ledger.ts` from a PC on the school
> LAN afterwards to pull the punches into Supabase.

---

## 5. Time synchronization rules

The system uses one rule everywhere: **store UTC, display Asia/Kolkata**.

- Device `<localTime>` values without an offset are treated as IST wall-clock
  and parsed as `...+05:30`.
- Native terminal push timestamps without an offset are parsed by
  `parseScanTime()` as IST.
- The admin console has **Sync All Clocks (IST)** and per-device **Sync Clock**
  actions; the server also corrects drift whenever it can reach the terminal.
- Scan times in the UI are always formatted with
  `timeZone: "Asia/Kolkata"`.

If a terminal shows the wrong time:

1. Check the terminal's own NTP setting; disable public NTP if it cannot reach
   the internet.
2. Press **Sync All Clocks (IST)** from a machine that can reach
   `192.168.x.x`, or use the terminal's own web UI to set the time.
3. Verify the terminal's clock and the live scan timestamp now agree.

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
| Webhook returns `401` | Wrong/missing secret | Copy the URL from the admin console or set the same `BIOMETRIC_SECRET` on the server |
| Webhook returns `404` | Wrong path | Use exactly `/api/hikvision/events` |
| `SSL` / certificate error on the terminal | HTTPS chain not trusted | Use the public domain certificate; HTTP-only terminals need a TLS-terminating reverse proxy or tunnel |
| Punches missing from the ledger | Device cannot reach the public URL | Fix outbound HTTPS/DNS on the school network; import terminal memory with `backfill-scan-ledger.ts` meanwhile |
| Device clock keeps drifting | CMOS battery / NTP unreachable | Replace battery, disable public NTP, resync the terminal clock from the admin console |
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
