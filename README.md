# Building Management & Accounting System — v3.1

This package has two parts:

```
Building_Management_App_v3/
├── webapp/     ← The PWA itself. Deploy this as a static site (or just run
│                 it locally). Works fully offline on its own.
├── server/     ← Optional Node backend for real-time multi-device sync.
├── google-drive-sync/ ← Optional alternative: Google Apps Script backend that
│                 stores the synced data in your Google Drive (no server,
│                 ~1 minute sync delay). Use ONE of server/ or this.
└── generate_zip.py
```

## Which do I need?

- **Just want to use it on one device (phone or laptop), fully offline?**
  You only need `webapp/`. See `webapp/README.md` — takes under a minute to
  get running.
- **Want every staff member/resident's device to see the same live data?**
  Deploy `server/` too (about 5 minutes on a free host like Render or
  Railway — see `server/README.md`), then point the app at it from
  **Building Settings → Sync/API** inside the app.

Both directions are documented in detail in each folder's own README —
start there. This top-level file is just the map.

## What's inside, at a glance

- **Offline-first PWA**: IndexedDB (Dexie.js) local database, Service
  Worker caching, installable on desktop and mobile.
- **4-tier role-based access control**: Resident/Owner, Entry User (Staff),
  Manager/Admin, Super Admin.
- **Full accounting suite**: income/expense tracking, flat/owner
  collections & dues, event fund management, owner ledgers, Cashbook,
  Income vs Expense, Assets & Liabilities, and Event Summary reports —
  all printable (58mm/80mm thermal POS or A4) and CSV-exportable.
- **Property & Asset Management**: flats inventory (floor, size, status,
  owner/tenant, contact) and a building asset tracker (lifts, generators,
  pumps, CCTV, etc.) with warranty tracking and maintenance/service logs.
- **Dual-language UI**: full English / বাংলা toggle, saved per device.
- **Real-time multi-device sync** (v3, optional): connect the bundled
  backend and every device stays in sync within a second or two, with
  automatic offline queueing and last-write-wins conflict resolution.

## Packaging

`generate_zip.py` bundles both folders (plus this README) into a single
downloadable ZIP. Run it after making any changes:

```bash
python3 generate_zip.py
```
