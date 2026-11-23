# LabGrid — Campus Laboratory Resource Sharing Platform

**LabGrid** is a full-stack campus laboratory equipment, development kit, and workstation sharing platform built for **Westbridge Institute of Technology**. It streamlines equipment discovery, real-time 12-hour (`8:00 AM – 9:00 PM`) scheduling, multi-lab project access proposals, and AI-assisted conflict arbitration across distinct **Student** and **Faculty** portals.

## Key Capabilities

- **Dual Role Interfaces (Zero-Login Exploration + Instant Role Switching)**
  - **Student Research Portal (Teal Grading)**: Natural-language AI equipment discovery, `Equipment / Development Kit / Workstation` filtering, live 12-hour availability strip, 1-click booking templates, 0ms instant overlap resolution (`Use Open`), multi-lab project access requests, and self-service conflict rescheduling.
  - **Faculty Governance Console (Indigo Grading)**: Real-time view of all student slot submissions, batch and per-request approvals, Gemini AI deadline-fair conflict arbitration, instrument inventory & maintenance management, and cross-department utilization optimization telemetry.
- **12-Hour Academic Time Standard**: All timetables, booking selectors, AI slot recommendations, conflict clusters, and CSV exports operate on `8:00 AM – 9:00 PM` 12-hour `AM/PM` formatting.
- **AI Advisor & Arbitration (`@google/genai`)**: Server-proxied Gemini endpoints (`/api/ai/discover`, `/api/ai/recommend-slot`, `/api/ai/resolve-conflict`, `/api/ai/review-project`) with schema validation, output clamping, sliding-window rate limiting, and 2-minute TTL caching.
- **Dual Persistence & Static Fallback**: Syncs with Cloud Firestore + Google Campus SSO when authenticated, persists to Express `.data/` storage in full-stack mode, and falls back to `localStorage` seamlessly on static deployments (e.g., GitHub Pages).

## Architecture Overview

- `src/lib/scheduling.ts` — Pure `O(E + B)` scheduling engine (`isBookingOverlap`, `findConflictClusters`, `buildScheduleLookup`, `findNextOpenSlot`, `computeNextOpenByEquipment`, `computeUtilizationInsights`).
- `src/hooks/useLabWorkspace.ts` — Centralized state, Firestore real-time synchronization, and student/faculty actions.
- `src/components/` — Lazy-loaded student and faculty views with WCAG-friendly keyboard navigation, `aria-live` status updates, and responsive mobile/desktop layouts.
- `server.ts` — Express API (`createLabGridApp`) with payload sanitization, security headers, rate limiting, response caching, and Vite middleware.

## Verification & Commands

```bash
npm install
npm test        # Runs Vitest unit, API integration, and React Testing Library suites
npm run lint    # Runs strict TypeScript typechecking (tsc --noEmit)
npm run build   # Builds optimized production chunks into dist/
npm run dev     # Starts Express + Vite dev server on http://localhost:3000
```
