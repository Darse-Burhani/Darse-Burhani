# SPEC.md — Tilawat Dua Feature Specification

> **Status**: `FINALIZED`
>
> Feature specification for Daily Tilawat Dua PDF management, dynamic portal display, audience assignments, and multi-device Projector view.

## Vision
The "Tilawat Dua" feature allows Darse Burhani administrators and designated faculty to upload daily Tilawat Dua PDFs, assign them dynamically to specific target audiences (All, Faculty, Talabat, specific Marhala, or specific Classes), and display them in high fidelity across all portals (Admin, Faculty/Teacher, and Talabat). It features a dedicated "Projector View" designed for crisp, distraction-free classroom presentation on overhead projectors, smart boards, laptops, and mobile devices.

## Goals
1. **Admin Management & Assignment** — Upload daily Tilawat Dua PDF documents, set title/date/description, configure target assignments (All, Faculty, Talabat, Marhalas, Classes), set active status, and mark daily defaults. Allow delegating Tilawat Dua permissions to teachers via portal assignments.
2. **Dynamic Portal Display** — Seamless dynamic loading of active/today's Tilawat Dua in Admin, Teacher/Faculty, and Talabat portals with date-picker archive navigation and dashboard quick-launch widgets.
3. **Dedicated Projector Mode** — A presentation-grade Projector View with one-click fullscreen launch, auto-hiding glass controls, page transitions, zoom controls, theatre/contrast modes (Cream, Pure Dark, High Contrast, Original), and full keyboard/touch navigation.
4. **Cross-Device Excellence** — Flawless responsive rendering tailored for Projectors (16:9 / 4:3), Laptops, Tablets, and Mobile phones with touch gestures.

## Non-Goals (Out of Scope)
- Automatic OCR or speech recognition of Arabic text.
- Live collaborative annotation/drawing on PDFs during projection (can be considered in future iterations).

## Constraints
- File storage in server public/uploads directory with strict `%PDF` magic-byte verification.
- Safe PostgreSQL database schema push via `scripts/prisma-safe.mjs`.
- High rendering performance without UI jank or memory leaks.

## Success Criteria
- [x] Prisma model `TilawatDua` created and database synchronized.
- [x] Backend API endpoints for upload, CRUD, assignment, and daily fetching.
- [x] Admin management dashboard with drag-and-drop PDF upload and audience targeting.
- [x] Teacher portal assignment and permission integration.
- [x] Talabat and Faculty portals with dedicated Tilawat Dua pages and dashboard widgets.
- [x] Projector View with fullscreen toggle, slide navigation, zoom, and contrast modes.
- [x] Full responsive design verified across projector, laptop, and mobile viewports.

---

*Last updated: 2026-10-27*
