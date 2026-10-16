# BMS Sync Server

A tiny, dependency-light Node.js backend that gives the Building Management
& Accounting System PWA **real-time, multi-device data sync**. Every device
running the app pushes its offline changes here; the server merges them and
instantly broadcasts the update to every other connected device over
Socket.IO. No database server to install — everything is stored in one JSON
file on disk.

You only need this if you want the same data to appear across multiple
phones/computers. Without it, the app works perfectly well fully offline on
a single device — this server is purely additive.

## 1. Run it locally (to test before deploying)

```bash
cd server
npm install
cp .env.example .env
# open .env and set API_KEY to something long and random
npm start
```

You should see:
```
✅ BMS Sync Server listening on port 4000
   Health check: http://localhost:4000/health
```
Visit `http://localhost:4000/health` in a browser — you should see `{"ok":true,...}`.

## 2. Deploy it somewhere reachable from the internet

Pick any one of these (all have a free tier that's plenty for one building):

### Option A — Render.com (easiest)
1. Push this `server/` folder to a GitHub repo (or a repo containing it).
2. On [render.com](https://render.com) → **New +** → **Web Service** → connect your repo.
3. Root directory: `server` (if it's part of a bigger repo).
4. Build command: `npm install` · Start command: `npm start`.
5. Add an environment variable `API_KEY` = (your long random secret).
6. **Important:** Render's free-tier disk is ephemeral — add a **Persistent
   Disk** (Render dashboard → your service → Disks) mounted at, say,
   `/data`, and set the `DATA_FILE` environment variable to `/data/data.json`
   so your synced data survives restarts/redeploys.
7. Deploy. Render gives you a URL like `https://your-app.onrender.com`.

### Option B — Railway.app
1. [railway.app](https://railway.app) → New Project → Deploy from GitHub repo.
2. Set the root/service directory to `server`.
3. Add variable `API_KEY`. Railway's default volume persists between deploys
   on paid plans; on the free tier, treat it the same as Render above.
4. Deploy — you'll get a URL like `https://your-app.up.railway.app`.

### Option C — Fly.io / any VPS with Node.js + pm2
1. Copy the `server/` folder to your machine/VPS.
2. `npm install --production`
3. Set environment variables (`API_KEY`, `PORT`, `DATA_FILE`) either via
   your shell, a `.env` file, or your platform's config.
4. Run persistently with a process manager, e.g.:
   ```bash
   npm install -g pm2
   pm2 start server.js --name bms-sync
   pm2 save
   ```
5. Put a reverse proxy (Nginx/Caddy) in front with HTTPS if you're using a
   custom domain — Socket.IO works over both `ws://` and `wss://`.

## 3. Connect the web app to it

1. Open the Building Management app → log in as **Super Admin**.
2. Go to **Building Settings → Sync/API**.
3. **API Endpoint URL:** the URL from step 2 (e.g. `https://your-app.onrender.com`) — no trailing slash needed, but it's fine either way.
4. **API Key:** the exact same value you set as `API_KEY` on the server.
5. Save. The app will immediately do a full push + pull and connect over
   Socket.IO. The status dot in the top bar turns green with a "Live" label
   when the real-time connection is active (it falls back to polling every
   20 seconds automatically if Socket.IO can't connect — data still syncs,
   just not instantly).
6. Repeat steps 1–4 on every other device/browser that should share this
   building's data. All of them must use the **same** endpoint + API key.

## How it works (for the curious)

- Every record in the app (users, flats, transactions, categories, events,
  requests, notices, assets, maintenance logs, audit log entries, building
  settings) carries a globally-unique `uuid` and an `updatedAt` timestamp.
- When you're online, local changes are pushed in the background to
  `POST /api/push`. The server merges each one into its JSON store —
  **last-write-wins** per `uuid`, so if two people edit the same record
  while both offline, whichever synced most recently (by timestamp) wins;
  nothing crashes or duplicates.
- The server then broadcasts a lightweight `changed` event over Socket.IO to
  every connected device, which immediately calls `GET /api/pull?since=...`
  to fetch just what's new and merge it into its own local IndexedDB.
- If a device is offline for a while, it simply catches up in one pull as
  soon as it reconnects — nothing is lost.
- Deleting a record pushes a "tombstone" so other devices know to remove
  their local copy too, even if they were offline when the delete happened.

## Security notes

- **Always set `API_KEY` in production.** Without it, anyone with your
  server's URL can read and write your building's data (the server prints a
  loud warning on startup if you forget).
- Passwords are stored as salted SHA-256 hashes (never plain text) — see the
  main app's README for more detail on this trade-off.
- This server does not itself terminate HTTPS. If you deploy on your own
  VPS rather than a managed platform, put it behind a reverse proxy
  (Nginx/Caddy) with a TLS certificate (e.g. via Let's Encrypt) so both the
  REST calls and the Socket.IO connection are encrypted in transit.
- CORS is currently wide open (`origin: '*'`) so the app works no matter
  where you host the frontend. If you want to lock it down to your specific
  frontend domain, edit the `cors()` and `Server(..., { cors: ... })` calls
  near the top of `server.js`.
