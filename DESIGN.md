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
- **Warm Amber / Gold Telemetry** (`#F3B833` / `#D97706`) — Biometric online status, active device pulses, and success confirmations (0% green rule).

### Banned Colors
- Green / emerald tones — strictly forbidden per brand guidelines.
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
- **Mobile Bottom Navigation Dock:** Ergonomically anchored bottom bar with native `safe-area-bottom` handling. Four distinct thumb targets: Home, Primary Hub, Timetable, and All Modules. Tactile gold active indicator pill with spring physics.
- **Main Content clearance:** Mandatory `pb-28 sm:pb-32 lg:pb-8` on main container to prevent bottom dock from ever obscuring forms, buttons, or table rows.
- **Buttons:** Flat tactile surfaces with `active:scale-95` push feedback. Primary: antique gold with dark charcoal text. Secondary: white surface with whisper border. No outer neon glows.
- **Cards:** Rounded corners (`rounded-2xl` / `rounded-3xl`), pure white fill, whisper border (`1px solid rgba(221, 213, 196, 0.6)`), soft ambient shadow (`0 4px 20px -2px rgba(34, 28, 18, 0.05)`).
- **Tables on Mobile:** Wrapped in `.mobile-table-scroll` with smooth kinetic horizontal scrolling (`-webkit-overflow-scrolling: touch`), sticky header row, and clear visual scroll indicators.
- **Drawers & Sheets:** Native sliding transitions. Left slide-in for navigation drawer; bottom slide-up for Quick Action Center and Profile Sheet.

---

## 5. Screen Auto-Sizing & Multi-Device Breakpoint Matrix (Google Stitch Blueprint)

| Device Class | Viewport Range | Screen Layout Behavior | Navigation & Touch Target |
|--------------|----------------|------------------------|---------------------------|
| **Compact Handset** (e.g. iPhone SE, Flip outer screen) | `320px - 375px` | 1-column strictly stacked; 10px-12px padding; compact cards; badges truncate or hide on narrow text. | Compact 40-44px targets; 4-item bottom dock with `px-1.5` padding; slide-in drawer for full module access. |
| **Standard Smartphone** (e.g. iPhone 14/15/16, Galaxy S24) | `376px - 430px` | 1-column stack; 14px-16px padding; generous breathing room; card elevation; quick action pills. | Full 48px touch targets; thumb-reach floating bottom dock; dynamic island / notch safe-area handling. |
| **Foldables & Large Mobile** (e.g. Galaxy Z Fold inner, iPhone Pro Max) | `431px - 768px` | Adaptive 2-column card grid; metrics side-by-side; expanded horizontal horizon ribbon. | Centered bottom dock (`max-w-md`); easy single-hand reach; smooth orientation resize transitions. |
| **Tablet / iPad** (e.g. iPad 10th Gen, iPad Air / Pro) | `769px - 1023px` | 2-to-3 column bento grid; centered content container (`max-w-5xl mx-auto`); dual-pane master-detail view. | Top app bar with tablet status indicators; expanded action bar; persistent side drawer option. |
| **Desktop / Kiosk** (e.g. Laptops, iMac, TV dashboards) | `1024px+` | Full Fatimi desktop layout; fixed 64px/256px collapsible gold-accented sidebar; multi-column tables. | Full desktop navigation accordions; keyboard shortcuts (`Cmd+K`); hover states enabled. |

### Universal Mobile PWA Rules:
- **Zero Horizontal Overflow:** Page-level horizontal scroll is a critical defect. All viewports must fit cleanly within 100vw (`overflow-x: hidden`).
- **Dynamic Viewport Height:** Full-height containers must use `min-h-[100dvh]` to eliminate mobile browser URL bar jumps.
- **Safe Area Insets:** All fixed elements use `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` to avoid notch / home indicator collisions.
- **Instant Touch:** All buttons and interactive elements use `touch-action: manipulation` to remove the 300ms tap delay.
- **iOS Font Zoom Guard:** All form inputs enforce `font-size: 16px` on screens `< 768px` to stop iOS Safari automatic zoom on focus.

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

