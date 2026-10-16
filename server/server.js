/* ============================================================================
   server.js — Real-time multi-device sync backend for the Building
   Management & Accounting System PWA.
   ----------------------------------------------------------------------------
   Protocol (matches js/sync.js in the web app):

   POST /api/push   { changes: [ { table, uuid, operation, data, updatedAt } ] }
     -> Merges each change into the JSON store (last-write-wins per uuid),
        persists to disk, and broadcasts a "changed" event to every
        connected device over Socket.IO.

   GET  /api/pull?since=<ISO timestamp>
     -> Returns every record (across all tables) whose updatedAt is newer
        than `since`, as full current-state objects: { serverTime, changes }

   Both endpoints require `Authorization: Bearer <API_KEY>` when API_KEY is
   set in the environment (strongly recommended — see .env.example).
   Socket.IO clients authenticate the same way via the connection handshake
   (`socket.handshake.auth.apiKey`).

   Storage: a single JSON file on disk (see DATA_FILE below). This keeps the
   backend dependency-free (no database server to install/manage) and is
   perfectly adequate for a single building's data — a few thousand
   transactions/users/etc. is a tiny amount of JSON. If you outgrow this,
   swap the tiny `Store` class below for a real database without touching
   any of the route/socket logic.
   ========================================================================= */

const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

// Minimal built-in .env loader (avoids adding a "dotenv" dependency just for
// this). Most hosting platforms (Render, Railway, Fly.io, ...) let you set
// environment variables directly in their dashboard instead — this is only
// needed for local development via `node server.js`.
(function loadDotEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (process.env[key] === undefined) process.env[key] = value;
  }
})();

const PORT = process.env.PORT || 4000;
const API_KEY = process.env.API_KEY || '';
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data.json');

if (!API_KEY) {
  console.warn('\n⚠️  WARNING: No API_KEY set in the environment.');
  console.warn('   The sync API is running WITHOUT authentication — anyone with the URL');
  console.warn('   can read/write your building\'s data. Set API_KEY before going to production.\n');
}

/* ---------------------------------------------------------------------------
   Tiny JSON-file store: { [table]: { [uuid]: { data, updatedAt, deleted } } }
   ------------------------------------------------------------------------ */
class Store {
  constructor(file) {
    this.file = file;
    this.data = {};
    this.load();
  }
  load() {
    try {
      if (fs.existsSync(this.file)) {
        this.data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      }
    } catch (e) {
      console.error('Failed to load data file, starting fresh:', e.message);
      this.data = {};
    }
  }
  save() {
    // Fire-and-forget async write; fine at this scale (small JSON file).
    fs.writeFile(this.file, JSON.stringify(this.data), (err) => {
      if (err) console.error('Failed to persist data file:', err.message);
    });
  }
  table(name) {
    if (!this.data[name]) this.data[name] = {};
    return this.data[name];
  }
  applyChange({ table, uuid, operation, data, updatedAt }) {
    if (!table || !uuid || !updatedAt) return false;
    const t = this.table(table);
    const prev = t[uuid];

    if (operation === 'delete') {
      if (!prev || new Date(updatedAt) >= new Date(prev.updatedAt)) {
        t[uuid] = { data: {}, updatedAt, deleted: true };
        return true;
      }
      return false;
    }

    // create / update: shallow-merge onto whatever we already have so a
    // partial update payload doesn't wipe out fields it didn't touch.
    if (!prev || new Date(updatedAt) >= new Date(prev.updatedAt)) {
      const prevData = prev && !prev.deleted ? prev.data : {};
      t[uuid] = { data: { ...prevData, ...(data || {}), uuid }, updatedAt, deleted: false };
      return true;
    }
    return false;
  }
  changesSince(sinceISO) {
    const since = new Date(sinceISO || '1970-01-01T00:00:00.000Z');
    const out = [];
    for (const table of Object.keys(this.data)) {
      for (const uuid of Object.keys(this.data[table])) {
        const entry = this.data[table][uuid];
        if (new Date(entry.updatedAt) > since) {
          out.push({ table, uuid, data: entry.data, updatedAt: entry.updatedAt, deleted: !!entry.deleted });
        }
      }
    }
    return out;
  }
}

const store = new Store(DATA_FILE);

/* ---------------------------------------------------------------------------
   Express app + Socket.IO
   ------------------------------------------------------------------------ */
const app = express();
app.use(cors());
app.use(express.json({ limit: '15mb' })); // generous limit — building logos are base64-encoded images

function checkAuth(req, res, next) {
  if (!API_KEY) return next(); // no key configured — open mode (see warning above)
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (token !== API_KEY) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

app.get('/', (req, res) => {
  res.type('text/plain').send(
    'Building Management System — Sync Server is running.\n' +
    'Endpoints: POST /api/push, GET /api/pull?since=<ISO>, GET /health\n'
  );
});

app.get('/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.post('/api/push', checkAuth, (req, res) => {
  const changes = Array.isArray(req.body.changes) ? req.body.changes : [];
  let applied = 0;
  for (const change of changes) {
    if (store.applyChange(change)) applied++;
  }
  if (applied > 0) {
    store.save();
    io.emit('changed', { count: applied, at: new Date().toISOString() });
  }
  res.json({ ok: true, applied, serverTime: new Date().toISOString() });
});

app.get('/api/pull', checkAuth, (req, res) => {
  const since = req.query.since;
  const changes = store.changesSince(since);
  res.json({ serverTime: new Date().toISOString(), changes });
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

io.use((socket, next) => {
  if (!API_KEY) return next();
  const key = socket.handshake.auth && socket.handshake.auth.apiKey;
  if (key === API_KEY) return next();
  next(new Error('Unauthorized'));
});

io.on('connection', (socket) => {
  console.log(`Device connected: ${socket.id} (${io.engine.clientsCount} online)`);
  socket.on('disconnect', () => {
    console.log(`Device disconnected: ${socket.id} (${io.engine.clientsCount} online)`);
  });
});

server.listen(PORT, () => {
  console.log(`\n✅ BMS Sync Server listening on port ${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`   Data file:    ${DATA_FILE}`);
  console.log(API_KEY ? '   Auth:         API key required\n' : '   Auth:         DISABLED (no API_KEY set)\n');
});
