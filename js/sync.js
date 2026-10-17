/* ============================================================================
   sync.js — Offline/Online detection + real multi-device sync engine
   ----------------------------------------------------------------------------
   How it works with a backend configured (Settings > Sync/API):
   1. Every local write is queued into db.syncQueue (via queueSync() in db.js)
      with a stable `uuid` + `updatedAt` on the record.
   2. PUSH: queued items are POSTed to {endpoint}/api/push in small batches.
      The server merges them into its own store (last-write-wins per uuid)
      and broadcasts a "changed" event over Socket.IO to every connected
      device for that building.
   3. REAL-TIME: this device also connects to the same backend over
      Socket.IO. When it receives a "changed" event (from any other device,
      or its own push), it calls PULL.
   4. PULL: fetches every record whose `updatedAt` is newer than the last
      successful pull (GET {endpoint}/api/pull?since=...) and merges each
      one into the matching local Dexie table by `uuid` (last-write-wins).
   5. A 20s fallback timer also triggers push+pull while online, so sync
      keeps working even if the Socket.IO connection drops or a browser
      blocks websockets.
   FIREBASE MODE (Settings > Firebase) replaces steps 2-4: records live in a
   single Firestore collection ("records") and every device listens to it in
   real time (see firebase-sync.js). Push, conflict rules and local storage
   are otherwise identical.
   Without a backend configured, none of the above runs — the app stays
   100% local, exactly as before. Nothing here is required for the app to
   function offline.
   ========================================================================= */

const SYNCABLE_TABLES = ['users', 'flats', 'categories', 'transactions', 'duesSchedule', 'events', 'requests', 'auditLogs', 'notices', 'settings', 'assets', 'maintenanceLogs'];
const LAST_PULL_KEY = 'bms_last_pull_at';

const SyncEngine = {
  syncing: false,
  interval: null,
  listeners: [],
  socket: null,
  socketConnected: false,
  lastError: null,
  needsFirebaseLogin: false,

  init() {
    window.addEventListener('online', () => { this.updateStatusUI(); this.trigger(); this.connectSocket(); });
    window.addEventListener('offline', () => { this.updateStatusUI(); this.disconnectSocket(); });
    // Fallback timer. In Google Apps Script (Drive) mode every poll costs
    // script runtime quota, so we poll only every ~60s there and skip it
    // while the tab is hidden; a tab regaining focus syncs immediately.
    this.interval = setInterval(async () => {
      if (!navigator.onLine) return;
      const s = await db.settings.get(1);
      if (s && this._isAppsScript(s)) {
        this._tick = (this._tick || 0) + 1;
        if (this._tick % 3 !== 0 || document.hidden) return;
      }
      this.trigger();
    }, 20000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && navigator.onLine) this.trigger();
    });
    this.connectSocket();
    this.updateStatusUI();
  },

  onStatusChange(cb) { this.listeners.push(cb); },

  getLastPullAt() { return localStorage.getItem(LAST_PULL_KEY) || '1970-01-01T00:00:00.000Z'; },
  setLastPullAt(iso) { localStorage.setItem(LAST_PULL_KEY, iso); },
  resetPullCursor() { localStorage.removeItem(LAST_PULL_KEY); },

  async updateStatusUI() {
    const pending = await db.syncQueue.where('synced').equals(0).count();
    const online = navigator.onLine;
    this.listeners.forEach(cb => cb({ online, pending, syncing: this.syncing, realtime: this.socketConnected }));
    const dot = document.getElementById('net-status-dot');
    const text = document.getElementById('net-status-text');
    const badge = document.getElementById('sync-pending-badge');
    if (dot && text) {
      dot.className = 'inline-block w-2.5 h-2.5 rounded-full ' + (online ? (this.socketConnected ? 'bg-emerald-500' : 'bg-amber-500') : 'bg-rose-500');
      const label = online ? ((typeof I18N !== 'undefined') ? t('online') : 'Online') : ((typeof I18N !== 'undefined') ? t('offline') : 'Offline');
      text.textContent = (online && this.socketConnected) ? `${label} · ${(typeof I18N !== 'undefined') ? t('liveSync') : 'Live'}` : label;
      if (online && this.needsFirebaseLogin) text.textContent = (typeof I18N !== 'undefined') ? t('firebaseLoginNeeded') : 'Sign in to Firebase';
    }
    if (badge) {
      if (pending > 0) { badge.classList.remove('hidden'); badge.textContent = pending; }
      else { badge.classList.add('hidden'); }
    }
  },

  // Convenience used by the manual "sync now" button and by settings save:
  // pushes anything queued locally, then pulls anything new from the server.
  async trigger() {
    await this.push();
    await this.pull();
  },

  /* ---- PUSH: send queued local changes to the backend ------------------ */
  async push() {
    const settings = await db.settings.get(1);
    if (!settings || !this._hasBackend(settings) || !navigator.onLine) { await this.updateStatusUI(); return; }
    if (this.syncing) return;

    this.syncing = true;
    let pushedSome = false;
    await this.updateStatusUI();
    try {
      const pendingItems = await db.syncQueue.where('synced').equals(0).toArray();
      if (this._isFirebase(settings)) {
        FirebaseSync.ensureListening();
        const r = await FirebaseSync.pushQueue();
        pushedSome = r.pushed > 0;
      } else if (pendingItems.length) {
        const changes = pendingItems.map(item => ({
          table: item.table,
          uuid: item.uuid,
          operation: item.operation,
          data: JSON.parse(item.payload),
          updatedAt: (JSON.parse(item.payload) || {}).updatedAt || item.timestamp
        })).filter(c => c.uuid); // skip malformed/legacy queue entries with no uuid

        let res;
        if (this._isAppsScript(settings)) {
          // Apps Script web apps can't answer CORS preflight requests, so we
          // send a "simple" POST: text/plain body, no custom headers. The API
          // key travels inside the body instead of an Authorization header.
          res = await fetch(this._asUrl(settings), {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'push', key: settings.apiKey || '', changes })
          });
        } else {
          res = await fetch(this._url(settings, '/api/push'), {
            method: 'POST',
            headers: this._headers(settings),
            body: JSON.stringify({ changes })
          });
        }
        let ok = res.ok;
        try {
          const body = await res.clone().json();
          if (body && body.ok === false) { ok = false; this.lastError = body.error || 'Sync rejected'; console.warn('Sync server said:', this.lastError); }
        } catch (e) { if (this._isAppsScript(settings)) ok = false; }
        if (ok) {
          this.lastError = null;
          await db.syncQueue.bulkPut(pendingItems.map(i => ({ ...i, synced: 1 })));
          pushedSome = true;
        }
      }
      // Purge fully-synced rows older than 7 days to keep syncQueue lean
      const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      const stale = await db.syncQueue.where('synced').equals(1).and(r => r.timestamp < weekAgo).toArray();
      if (stale.length) await db.syncQueue.bulkDelete(stale.map(s => s.id));
    } catch (e) {
      console.warn('Push failed (will retry):', e);
    } finally {
      this.syncing = false;
      await this.updateStatusUI();
    }
    // In Drive (Apps Script) mode there is no live socket, so right after a
    // successful save we also fetch whatever other devices have saved.
    if (pushedSome && this._isAppsScript(settings)) await this.pull();
  },

  /* ---- PULL: fetch remote changes and merge them into local Dexie ------ */
  async pull() {
    const settings = await db.settings.get(1);
    if (!settings || !settings.apiEndpoint || !navigator.onLine) return;
    if (this._isFirebase(settings)) return; // Firebase delivers changes live through its own listener

    try {
      const since = this.getLastPullAt();
      let res;
      if (this._isAppsScript(settings)) {
        res = await fetch(this._asUrl(settings, { action: 'pull', since, key: settings.apiKey || '' }));
      } else {
        res = await fetch(this._url(settings, `/api/pull?since=${encodeURIComponent(since)}`), {
          headers: this._headers(settings)
        });
      }
      if (!res.ok) return;
      const body = await res.json();
      if (body && body.ok === false) { this.lastError = body.error || 'Sync rejected'; console.warn('Sync server said:', this.lastError); return; }
      const changes = body.changes || [];
      let applied = 0; const tables = new Set();
      for (const change of changes) {
        if (await this._applyRemoteChange(change)) { applied++; tables.add(change.table); }
      }
      if (body.serverTime) this.setLastPullAt(body.serverTime);
      await this._afterRemoteApply(applied, tables);
    } catch (e) {
      console.warn('Pull failed (will retry):', e);
    }
  },

  // Records that every device creates on its own at first start (demo users,
  // categories, flats...) get DIFFERENT uuids per device. When the same
  // record arrives from the backend, "adopt" its uuid onto the local twin
  // (matched by natural key) instead of creating a duplicate.
  NATURAL_KEYS: { users: ['username'], flats: ['flatNo'], categories: ['type', 'name'], assets: ['serialNo'], notices: ['title', 'body'], settings: [] },

  async _findLocalTwin(table, fields) {
    const keys = this.NATURAL_KEYS[table];
    if (!keys) return null;
    const dexieTable = db[table];
    if (table === 'settings') return await dexieTable.toCollection().first();
    if (!keys.every(k => fields[k] !== undefined && fields[k] !== '' && fields[k] !== null)) return null;
    return await dexieTable.filter(r => keys.every(k => r[k] === fields[k])).first();
  },

  // Returns true only if something in the local database actually changed.
  async _applyRemoteChange(change) {
    const { table, uuid, data, updatedAt, deleted } = change;
    if (!SYNCABLE_TABLES.includes(table) || !uuid) return false;
    const dexieTable = db[table];
    if (!dexieTable) return false;

    try {
      const existing = await dexieTable.where('uuid').equals(uuid).first();

      if (deleted) {
        if (existing) { await dexieTable.delete(existing.id); return true; }
        return false;
      }

      const { id: _ignoredLocalId, ...fields } = data || {};
      if (table === 'settings') ['apiEndpoint', 'apiKey', 'firebaseConfig', 'firebaseEmail', 'lastBackup'].forEach(k => delete fields[k]);

      // Foreign keys (flatId, eventId, assetId, userId, ...) are local
      // auto-increment numbers on the SENDING device and mean nothing here.
      // Each carries a companion `xxxUuid` field (see FK_MAP in db.js) —
      // resolve those back into whatever local id they have on THIS device.
      const map = FK_MAP[table];
      if (map) {
        for (const [idField, uuidField, targetTable] of map) {
          if (fields[uuidField] !== undefined) {
            if (fields[uuidField]) {
              const targetLocal = await db[targetTable].where('uuid').equals(fields[uuidField]).first();
              fields[idField] = targetLocal ? targetLocal.id : null;
            } else {
              fields[idField] = null;
            }
          }
        }
      }

      if (existing) {
        // Last-write-wins: only apply if the remote copy is actually newer.
        if (!existing.updatedAt || new Date(updatedAt) > new Date(existing.updatedAt)) {
          await dexieTable.update(existing.id, { ...fields, uuid, updatedAt });
          return true;
        }
        return false;
      }

      const twin = await this._findLocalTwin(table, fields);
      if (twin) {
        await dexieTable.update(twin.id, { ...fields, uuid, updatedAt });
        return true;
      }
      try {
        await dexieTable.add({ ...fields, uuid, updatedAt });
        return true;
      } catch (e) {
        if (e && e.name === 'ConstraintError') {
          console.warn(`Skipped ${table}/${uuid}: duplicate of an existing record`, e);
          return false;
        }
        throw e;
      }
    } catch (e) {
      console.warn(`Could not apply remote change for ${table}/${uuid}:`, e);
      return false;
    }
  },

  // After a batch of remote changes: fix links that arrived before their
  // target, re-total dues from the actual payments, and refresh the screen.
  async _afterRemoteApply(applied, tables) {
    if (!applied) return;
    await this.resolveDanglingFKs();
    if (tables.has('transactions') || tables.has('duesSchedule')) await this.recomputeDues();
    try { await App.refreshSettingsCache(); } catch (e) {}
    if ((typeof App !== 'undefined') && Auth.isLoggedIn()) App.navigateTo(App.currentView);
  },

  async resolveDanglingFKs() {
    for (const table of Object.keys(FK_MAP)) {
      for (const [idField, uuidField, targetTable] of FK_MAP[table]) {
        const rows = await db[table].filter(r => r[uuidField] && (r[idField] === null || r[idField] === undefined)).toArray();
        for (const r of rows) {
          const target = await db[targetTable].where('uuid').equals(r[uuidField]).first();
          if (target) await db[table].update(r.id, { [idField]: target.id });
        }
      }
    }
  },

  // "Paid so far" on a due is the SUM of the receipts linked to it. Two
  // people collecting on the same due at once each write their own receipt,
  // so recomputing from receipts (instead of trusting one device's running
  // number) cannot lose a payment.
  async recomputeDues() {
    const dues = await db.duesSchedule.toArray();
    const incomes = await db.transactions.where('type').equals('income').toArray();
    const paidBy = {};
    for (const tx of incomes) if (tx.duesId) paidBy[tx.duesId] = (paidBy[tx.duesId] || 0) + Number(tx.amount || 0);
    for (const d of dues) {
      if (paidBy[d.id] === undefined) continue;
      const paid = paidBy[d.id];
      const status = paid >= Number(d.dueAmount) - 0.001 ? 'paid' : (paid > 0 ? 'partial' : 'pending');
      if (Math.abs(paid - Number(d.paidAmount || 0)) > 0.001 || status !== d.status) {
        const updates = await touch('duesSchedule', { paidAmount: paid, status, uuid: d.uuid });
        await db.duesSchedule.update(d.id, updates);
        await queueSync('duesSchedule', d.id, 'update', updates);
      }
    }
  },

  /* ---- shared helpers used by the Firebase backend ---------------------- */
  PRIVATE_SETTINGS_FIELDS: ['apiEndpoint', 'apiKey', 'firebaseConfig', 'firebaseEmail', 'lastBackup'],

  // Strip device-local fields (local numeric id, sync credentials) and
  // anything Firestore cannot store (undefined, > ~1 MB logo).
  cleanPayload(table, payload) {
    const d = JSON.parse(JSON.stringify(payload || {}));
    delete d.id;
    if (table === 'settings') this.PRIVATE_SETTINGS_FIELDS.forEach(k => delete d[k]);
    if (d.logo && JSON.stringify(d).length > 900000) delete d.logo;
    return d;
  },

  // Fold queued items per record (oldest first) so a create followed by
  // three edits becomes ONE write instead of four.
  compact(items) {
    const map = new Map();
    for (const it of items.slice().sort((a, b) => a.id - b.id)) {
      if (!it.uuid) continue;
      const payload = JSON.parse(it.payload) || {};
      const key = it.table + '__' + it.uuid;
      let e = map.get(key);
      const stamp = payload.updatedAt || it.timestamp;
      if (!e) { e = { key, table: it.table, uuid: it.uuid, operation: it.operation, data: {}, updatedAt: stamp, ids: [] }; map.set(key, e); }
      e.ids.push(it.id);
      if (it.operation === 'delete') { e.operation = 'delete'; e.data = {}; }
      else if (e.operation !== 'delete') {
        if (e.operation !== 'create') e.operation = it.operation;
        e.data = { ...e.data, ...this.cleanPayload(it.table, payload) };
      }
      if (new Date(stamp) > new Date(e.updatedAt)) e.updatedAt = stamp;
    }
    return [...map.values()];
  },

  /* ---- Upload records that existed BEFORE sync was switched on ---------- */
  // Writes made while sync was off are already in the queue. Records from
  // older app versions and the first-run demo data are not, so queue them
  // once — but only if the backend is still empty. A device JOINING a
  // building that already has data must adopt it, not upload a second copy.
  async queueAllLocal(backendId, settings) {
    const key = 'bms_seeded_' + backendId;
    if (localStorage.getItem(key)) return 0;
    let hasData;
    try { hasData = await this._backendHasData(settings); } catch (e) { console.warn('Could not check backend; will retry later:', e); return 0; }
    if (hasData) { localStorage.setItem(key, 'joined'); return 0; }

    // Parents before children so links resolve in the order records arrive.
    const order = ['settings', 'flats', 'users', 'categories', 'events', 'assets', 'duesSchedule', 'transactions', 'requests', 'notices', 'maintenanceLogs', 'auditLogs'];
    let n = 0;
    for (const table of order) {
      const rows = await db[table].toArray();
      for (const r of rows) {
        if (!r.uuid) continue;
        const rec = this.cleanPayload(table, FK_MAP[table] ? await stampForeignUuids(table, r) : r);
        await db.syncQueue.add({ table, recordId: r.id, uuid: r.uuid, operation: 'create', payload: JSON.stringify(rec), synced: 0, timestamp: nowISO() });
        n++;
      }
    }
    localStorage.setItem(key, 'uploaded');
    return n;
  },

  async _backendHasData(settings) {
    if (this._isFirebase(settings)) {
      const snap = await FirebaseSync.fdb.collection('records').limit(1).get();
      return !snap.empty;
    }
    const since = '1970-01-01T00:00:00.000Z';
    const res = this._isAppsScript(settings)
      ? await fetch(this._asUrl(settings, { action: 'pull', since, key: settings.apiKey || '' }))
      : await fetch(this._url(settings, `/api/pull?since=${encodeURIComponent(since)}`), { headers: this._headers(settings) });
    const body = await res.json();
    if (!res.ok || body.ok === false) throw new Error(body.error || ('HTTP ' + res.status));
    return (body.changes || []).length > 0;
  },

  resetAllCursors() {
    Object.keys(localStorage).filter(k => k === LAST_PULL_KEY || k.startsWith('bms_fb_cursor_') || k.startsWith('bms_seeded_'))
      .forEach(k => localStorage.removeItem(k));
  },

  /* ---- Socket.IO real-time channel -------------------------------------- */
  async connectSocket() {
    const settings = await db.settings.get(1);
    if (settings && this._isFirebase(settings) && navigator.onLine) { await FirebaseSync.start(settings); return; }
    if (typeof io === 'undefined') return; // socket.io-client not loaded (offline first visit) — REST polling still covers sync
    if (!settings || !settings.apiEndpoint || !navigator.onLine) return;
    if (this._isAppsScript(settings)) return; // Google Apps Script has no websockets — polling handles sync
    this.disconnectSocket();

    try {
      this.socket = io(settings.apiEndpoint, {
        auth: { apiKey: settings.apiKey || '' },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 2000
      });
      this.socket.on('connect', () => { this.socketConnected = true; this.updateStatusUI(); this.pull(); });
      this.socket.on('disconnect', () => { this.socketConnected = false; this.updateStatusUI(); });
      this.socket.on('changed', () => { this.pull(); });
    } catch (e) {
      console.warn('Socket connection failed, falling back to polling only:', e);
    }
  },

  disconnectSocket() {
    if (this.socket) { try { this.socket.disconnect(); } catch (e) {} this.socket = null; }
    if ((typeof FirebaseSync !== 'undefined')) FirebaseSync.stop();
    this.socketConnected = false;
  },

  // Called after the user changes the Sync/API settings so the new
  // endpoint takes effect immediately (fresh pull cursor + reconnect).
  async reconnect() {
    this.resetPullCursor();
    this.disconnectSocket();
    const s = await db.settings.get(1);
    if (s && this._hasBackend(s)) {
      const id = this._isFirebase(s) ? 'fb:' + ((FirebaseSync._cfg(s) || {}).projectId || '') : s.apiEndpoint;
      // The Firebase listener (started below) needs the sign-in to be live first.
      if (this._isFirebase(s)) await FirebaseSync.waitForAuth();
      const n = await this.queueAllLocal(id, s);
      if (n) console.info(`Queued ${n} existing records for first upload`);
    }
    await this.connectSocket();
    await this.trigger();
  },

  _isFirebase(settings) { return !!(settings && settings.firebaseConfig && (typeof FirebaseSync !== 'undefined')); },
  _hasBackend(settings) { return !!(settings && (settings.apiEndpoint || this._isFirebase(settings))); },
  _isAppsScript(settings) { return /script\.google(usercontent)?\.com\/macros\//.test(settings.apiEndpoint || ''); },
  _asUrl(settings, params) {
    const base = settings.apiEndpoint.trim();
    if (!params) return base;
    return base + (base.includes('?') ? '&' : '?') + Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  },
  _url(settings, path) { return settings.apiEndpoint.replace(/\/$/, '') + path; },
  _headers(settings) {
    return {
      'Content-Type': 'application/json',
      ...(settings.apiKey ? { 'Authorization': `Bearer ${settings.apiKey}` } : {})
    };
  },

  /* ---- Local JSON backup / restore (independent of any backend) -------- */
  async exportBackupJSON() {
    const data = {};
    for (const table of [...SYNCABLE_TABLES]) {
      data[table] = await db[table].toArray();
    }
    return JSON.stringify({ exportedAt: nowISO(), version: 3, data }, null, 2);
  },

  async importBackupJSON(jsonText) {
    const parsed = JSON.parse(jsonText);
    if (!parsed.data) throw new Error('Invalid backup file format.');
    const d = parsed.data;
    this.resetAllCursors(); // a restored backup must be re-compared with the backend from scratch
    const tables = SYNCABLE_TABLES.map(name => db[name]);
    await db.transaction('rw', tables, async () => {
      for (const name of SYNCABLE_TABLES) {
        if (d[name]) { await db[name].clear(); await db[name].bulkAdd(d[name]); }
      }
    });
    return true;
  }
};
