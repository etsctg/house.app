# Building Management & Accounting System (Offline-First PWA) — v4

A complete, installable Progressive Web App for managing a residential/commercial
building's accounting, collections, events, maintenance requests, residents,
property inventory, and physical assets — built to work **fully offline**
on any device, with **real-time multi-device sync** when a backend is
connected, and a full **English / বাংলা (Bangla)** language toggle.

> This folder is the frontend only. For real-time sync across multiple
> devices, deploy the companion backend in `../server/` and see
> `../server/README.md` for setup — it's a five-minute job. Without it, this
> app still works 100% offline on a single device; nothing here requires it.

## What's new in v4

- **Firebase sync (recommended):** Settings → Firebase. Real-time sync through your own Firestore project, secured by a single shared sign-in account. Setup guide: `../firebase/README.md`.
- **Bug fixes found by running the real app under test:** saving now pushes immediately (this silently did not happen before), the language switch now re-renders the menu and the open page, and Bangla number/month formatting now applies.
- Dues totals are recomputed from the receipts, so simultaneous collections can't lose a payment.
- Records created independently on each device at first start (demo users, categories, flats) are matched up instead of duplicated.
- Records that existed before sync was switched on are uploaded once (only if the backend is still empty).

## What was new in v3

- **Real-time multi-device sync.** Every record now carries a stable ID that
  survives across devices. When you connect a backend (see `../server/`),
  changes made on one phone/computer appear on every other one within a
  second or two — via Socket.IO — with a 20-second polling fallback if a
  real-time connection can't be established. The status dot in the top bar
  shows **Online · Live** when connected in real time, plain **Online** when
  syncing by polling only, and **Offline** with zero network activity when
  there's no connection at all.
- Conflict handling is last-write-wins per record, and deletes propagate
  correctly to devices that were offline when they happened.

*(v2 also added dual-language support and the Property & Asset Management
module — see below; both are unchanged in v3.)*

## Quick Start

Because this app uses a Service Worker and IndexedDB, it must be served over
HTTP(S) — opening `index.html` directly via `file://` will not register the
service worker or database reliably in all browsers.

**Option 1 — Python's built-in server (simplest):**
```bash
cd webapp
python3 -m http.server 8080
```
Then open `http://localhost:8080` in your browser.

**Option 2 — Node's `http-server` (if you have Node.js):**
```bash
npx http-server webapp -p 8080
```

**Option 3 — Deploy anywhere:** This is a 100% static site. Upload the
`webapp/` folder as-is to GitHub Pages, Netlify, Vercel, Firebase Hosting, or
any static web host / your own web server (Apache/Nginx).

Once loaded once while online, install it as an app ("Add to Home Screen" on
mobile, or the install icon in your browser's address bar on desktop) and it
will continue to work with **no internet connection**.

> **Upgrading from v1/v2?** Just point the new files at the same
> browser/device — Dexie automatically upgrades the existing database in
> place (adds `uuid`/`updatedAt` to every record, plus the `assets` /
> `maintenanceLogs` tables from v2) without touching any existing users,
> transactions, or history.

## Demo Login Accounts

| Role | Username | Password |
|---|---|---|
| Super Admin | `admin` | `admin123` |
| Manager / Admin | `manager` | `manager123` |
| Entry User (Staff) | `entry` | `entry123` |

There is no default "Resident/User" account — create one from **Manage Users**
(as Manager or Super Admin) and link it to a flat so the resident can see their
own ledger, dues, and notices.

## Turning on real-time multi-device sync

1. Deploy the backend in `../server/` (takes about 5 minutes — see its
   README for step-by-step instructions for Render, Railway, or your own
   server).
2. In the app, log in as **Super Admin** → **Building Settings → Sync/API**.
3. Enter the backend's URL and the API key you set for it. Save.
4. Repeat on every device that should share this building's data.

That's it — from then on, every device pushes and pulls automatically.

## Architecture

- **Frontend:** Vanilla JavaScript SPA (no build step, no framework) + Tailwind
  CSS (CDN, cached offline by the service worker after first load) + Chart.js
  for analytics.
- **i18n:** A lightweight dictionary-based translation engine (`js/i18n.js`)
  exposes a global `t(key)` helper used throughout every view. Switching
  language re-renders the current view and nav in place — no page reload
  needed.
- **Local Database:** IndexedDB via Dexie.js — stores users, flats, categories,
  transactions, dues schedules, events, maintenance requests, notices, audit
  logs, building assets, asset service logs, and app settings entirely
  on-device. Every record carries a stable `uuid` + `updatedAt` for sync.
  Schema is versioned (`db.version(3)...upgrade()`), so existing installs
  migrate automatically.
- **Offline Support:** `sw.js` (Service Worker) precaches the entire app shell
  and CDN libraries (including the Bangla web font and the Socket.IO client)
  on first load. After that, the app boots and runs with zero network
  requests. The service worker deliberately never caches `/api/*` calls, so
  sync always talks to the live server.
- **Sync Engine (`js/sync.js`):** watches `navigator.onLine`/`offline`
  events, connects to the backend over Socket.IO for instant push
  notifications, and falls back to polling every 20 seconds. Every local
  write is queued in an outbox (`syncQueue` table) with a `uuid`; queued
  items are pushed to `POST {endpoint}/api/push`, and new data is pulled
  from `GET {endpoint}/api/pull?since=...` and merged by uuid
  (last-write-wins). If no endpoint is configured, none of this runs and the
  app is 100% local.
- **Backup/Restore:** Full JSON export/import is available under
  **Settings → Backup & Restore** (Super Admin), independent of any backend.

## File Structure

```
webapp/
├── index.html                # SPA shell — all views render into #view-container
├── manifest.json              # PWA manifest (installability)
├── sw.js                       # Service worker (offline caching, v3 cache; never caches /api/*)
├── css/
│   └── styles.css             # Custom styles + print stylesheets (58/80mm thermal + A4)
├── js/
│   ├── i18n.js                  # English/Bangla dictionary + t() helper + language toggle
│   ├── db.js                   # Dexie/IndexedDB schema (v3: uuid/updatedAt + FK-uuid resolution)
│   ├── auth.js                 # Login/session + 4-tier RBAC helpers
│   ├── sync.js                 # Real push/pull sync engine + Socket.IO real-time channel
│   ├── utils.js                 # Formatting (locale-aware), toasts, modals, CSV export
│   ├── charts.js                # Chart.js wrappers (bar/doughnut/line), bilingual legends
│   ├── print.js                  # Thermal (58/80mm) + A4 voucher/report printing, bilingual
│   ├── app.js                    # Core: bootstrap, router, nav, dashboard, notices, requests, profile
│   ├── app-finance.js            # Income/Expense, Collections, Events, Owner Ledger
│   ├── app-reports.js            # Cashbook, P&L, Balance Overview (+ assets), Event Summary
│   ├── app-admin.js              # Categories, User management, Building settings, Audit log
│   └── app-inventory.js          # Flats Inventory + Building Asset Tracker
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

## Role-Based Access Control (4 Tiers)

1. **User (Resident/Tenant/Owner)** — Dashboard, Notices, My Ledger, My
   Requests, Profile.
2. **Entry User (Staff/Accountant)** — Everything above **plus**
   Income/Expense entry, Collections, Events, Owner Ledger (all flats),
   Property & Assets (view + log service), Reports, and printing/voucher
   generation.
3. **Manager / Admin** — Everything above **plus** Category management, User
   management for Residents & Entry Users, full Flats/Asset add-edit-delete,
   and approving/rejecting maintenance requests.
4. **Super Admin** — Full control: manage all users including Managers,
   Building Settings (name/address/logo/currency), Sync/API configuration,
   Backup & Restore, full data reset, and the System Audit Log.

## Notes on Security

Passwords are hashed client-side (SHA-256, salted with username). When you
connect the backend server for multi-device sync, these hashes (never plain
passwords) are stored there too, so the same login works everywhere — see
`../server/README.md` for how to secure that server (API key, HTTPS,
persistent storage). Without a backend, the app is fully offline/local-only
and appropriate for a trusted building committee's own device(s).
