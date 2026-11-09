# Design System: Darse Burhani Taste Standard
**Skill Integration:** stitch-design-taste & impeccable
**Surface Mode:** Operate (Institutional Portal with High-Craft Mobile UX)

---

## Configuration — Dial Settings

| Dial | Level | Description |
|------|-------|-------------|
| **Creativity** | `7` | Balanced institutional dignity with distinctive Fatimi heritage, custom gold geometry, and refined micro-typography. |
| **Density** | `5` | Daily App Balanced: clear hierarchy, comfortable breathing room on mobile, data-dense where needed without feeling cluttered. |
| **Variance** | `7` | Dynamic module layouts, responsive asymmetric cards, edge-to-edge scroll ribbons, and sculpted bottom navigation docks. |
| **Motion Intent** | `6` | Fluid spring physics (`stiffness: 100, damping: 20`), tactile push feedback on touch, and smooth slide-up bottom sheets. |

---

## 1. Visual Theme & Atmosphere
A prestigious, calm, and scholarly interface honoring Fatimi educational architecture. The atmosphere is warm, bright, and legible — 70% warm cream canvas (`#FAF7F0`) and pure white card surfaces (`#FFFFFF`), 20% deep espresso typography (`#221C12` and `#18181B`) for razor-sharp readability, and 10% burnished antique gold accents (`#C59B27` and `#F3B833`) providing the singular institutional highlight.

On mobile, the interface behaves like an award-winning native app: zero horizontal jitter, minimum 44px touch targets, thumb-friendly bottom navigation, smooth slide-out drawers, and generous bottom clearance preventing interface occlusion.

---

## 2. Color Palette & Functional Roles
- **Canvas Cream** (`#FAF7F0`) — Primary background canvas across portals. Warm, organic, never clinical blue-white.
- **Pure Surface** (`#FFFFFF`) — Card, panel, and dialog surface fill.
- **Subtle Elevation** (`#F4EFE5`) — Secondary elevated modules, filter chips, and pill containers.
- **Espresso Ink** (`#221C12`) — Primary text and heading color. Deep, high-contrast, never pure black (`#000000`).
- **Warm Charcoal** (`#18181B`) — Desktop sidebar, mobile bottom dock, and slide-in drawer canvas.
- **Muted Earth** (`#6B5F4B`) — Secondary descriptions, captions, and table column headers.
- **Whisper Border** (`rgba(221, 213, 196, 0.6)`) — 1px structural hairline borders.
- **Antique Brand Gold** (`#F3B833` / `#C59B27`) — Singular accent color for active indicators, primary CTAs, and brand badges.
- **Emerald Telemetry** (`#10B981`) — Biometric online status, active device pulses, and success confirmations.

### Banned Colors
- AI purple/violet neon glows — strictly forbidden.
- Pure black (`#000000`) — forbidden; use Espresso `#221C12` or Charcoal `#18181B`.
- Oversaturated accents above 80% saturation.
- Neon outer halos or decorative glass blur overlays.

---

## 3. Typographic Architecture
- **Display & Section Titles:** `Outfit`, `Geist`, or Apple System SF Pro Display — Track-tight (`-0.02em`), leading-tight (`1.15`), weight-driven hierarchy (`font-bold`, `700–800`).
- **Body & Content:** Warm sans-serif — Relaxed leading (`1.55–1.65`), neutral secondary color (`#6B5F4B`), minimum 14px on body, minimum 16px on mobile form inputs to eliminate iOS Safari auto-zoom.
- **Arabic Inscriptions:** `Al-Kanz` font stack for Quranic verses, dua scripts, and Fatimi titles.
- **Data & Timestamps:** Monospace (`font-mono`, `ui-monospace`) for live biometric clocks, attendance codes, and period timings.
- **Banned:** `Inter` for premium creative surfaces; generic system serifs (`Times New Roman`, `Georgia`) in dashboard tables.

---

## 4. Component Stylings
- **Mobile App Bar:** 60px height, frosted white backdrop (`bg-white/95 backdrop-blur-xl`), clear left drawer trigger, centered or left-aligned section title with micro role pill, and 44px right action buttons (Search, Notifications, Profile).
- **Mobile Bottom Navigation Dock:** Ergonomically anchored bottom bar with native `safe-area-bottom` handling. Five distinct thumb targets: Home, Primary Hub, Center Quick Action, Secondary Hub, and All Modules. Tactile gold center orb with spring physics.
- **Main Content clearance:** Mandatory `pb-28 sm:pb-32 lg:pb-8` on main container to prevent bottom dock from ever obscuring forms, buttons, or table rows.
- **Buttons:** Flat tactile surfaces with `active:scale-95` push feedback. Primary: antique gold with dark charcoal text. Secondary: white surface with whisper border. No outer neon glows.
- **Cards:** Rounded corners (`rounded-2xl` / `rounded-3xl`), pure white fill, whisper border (`1px solid rgba(221, 213, 196, 0.6)`), soft ambient shadow (`0 4px 20px -2px rgba(34, 28, 18, 0.05)`).
- **Tables on Mobile:** Wrapped in `.mobile-table-container` with smooth kinetic horizontal scrolling (`-webkit-overflow-scrolling: touch`), sticky header row, and clear visual scroll indicators.
- **Drawers & Sheets:** Native sliding transitions. Left slide-in for navigation drawer; bottom slide-up for Quick Action Center and Profile Sheet.

---

## 5. Layout & Responsive Principles
- **Strict Mobile Collapse (< 768px):** All multi-column grids collapse to a clean single column.
- **Zero Horizontal Overflow:** Page-level horizontal scroll is a critical defect. All viewports (360px, 375px, 390px, 414px) must fit cleanly within 100vw.
- **Viewport Height:** Full-height containers must use `min-h-[100dvh]` to avoid mobile address bar jumps.
- **Touch Target Floor:** All interactive elements must satisfy the 44px x 44px tap target guideline.

---

## 6. Motion & Interaction
- **Spring Physics:** `stiffness: 100, damping: 20` for micro-interactions and sheet reveals.
- **Hardware Acceleration:** Animations confined strictly to `transform` and `opacity`.
- **Active State Tactility:** Subtle `-1px` translate or `scale(0.95)` on touch down.

---

## 7. Anti-Patterns (Banned AI Habits)
- No emojis used as icons — authored SVG icons from Lucide only.
- No nested cards inside cards inside cards.
- No floating docks covering up form buttons or footer content.
- No centered hero sections on high-density operational pages.
- No neon glows, purple gradients, or oversaturated borders.
- No double modal overlays (e.g. mobile popover + bottom sheet firing simultaneously).

