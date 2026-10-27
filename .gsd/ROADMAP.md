---
milestone: Tilawat Dua
version: 1.0.0
updated: 2026-10-27T18:36:00+05:30
---

# Roadmap: Tilawat Dua Feature

> **Current Phase:** Complete
> **Status:** verified

## Must-Haves (from SPEC)
- [x] Schema: TilawatDua Prisma model & database synchronization
- [x] Backend: Express endpoints for upload, CRUD, assignment, and daily fetch
- [x] Permissions: Teacher portal assignment and access normalization
- [x] Admin: Daily Tilawat Dua upload, assignment, and management interface
- [x] Viewer: High-fidelity PDF Viewer with dedicated "Projector View" (fullscreen, controls, zoom, contrast)
- [x] Faculty & Talabat: Portal integration with dashboard widgets & dedicated pages
- [x] Responsive validation across projector, laptop, and mobile devices

---

## Phases

### Phase 1: Database Model, PDF Storage & Express API
**Status:** ✅ Complete
**Objective:** Add Prisma model `TilawatDua`, run schema push, implement secure PDF upload with magic bytes, and create CRUD + audience assignment API endpoints.

### Phase 2: Permissions & Teacher Portal Assignments
**Status:** ✅ Complete
**Objective:** Add `tilawat-dua` to teacher portal assignments, portal access context, and navigation layouts.

### Phase 3: Projector View & Dynamic PDF Viewer Component
**Status:** ✅ Complete
**Objective:** Build high-performance `TilawatDuaViewer` supporting canvas/PDF.js and native fallback, projector presentation mode, auto-hiding glass controls, zoom, page flip, and themes (Cream, Dark, High-Contrast).

### Phase 4: Admin Management Interface
**Status:** ✅ Complete
**Objective:** Build `/admin/tilawat-dua` management hub with drag-and-drop upload, audience targeting (All, Faculty, Talabat, Marhala, Class), status toggles, preview, and projector launch.

### Phase 5: Faculty & Talabat Portal Integration
**Status:** ✅ Complete
**Objective:** Add Tilawat Dua display to Talabat (`/talabat/tilawat-dua`) and Faculty/Teacher (`/teacher/tilawat-dua`, `/faculty/tilawat-dua`), plus dashboard widgets.

### Phase 6: Verification & Empirical Proof
**Status:** ✅ Complete
**Objective:** Build verification, API curl proofs, browser verification on projector, laptop, and mobile screens.
