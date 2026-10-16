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
      const label = online ? (window.I18N ? t('online') : 'Online') : (window.I18N ? t('offline') : 'Offline');
      text.textContent = (online && this.socketConnected) ? `${label} · ${window.I18N ? t('liveSync') : 'Live'}` : label;
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
    if (!settings || !settings.apiEndpoint || !navigator.onLine) { await this.updateStatusUI(); return; }
    if (this.syncing) return;

    this.syncing = true;
    await this.updateStatusUI();
    try {
      const pendingItems = await db.syncQueue.where('synced').equals(0).toArray();
      if (pendingItems.length) {
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
  },

  /* ---- PULL: fetch remote changes and merge them into local Dexie ------ */
  async pull() {
    const settings = await db.settings.get(1);
    if (!settings || !settings.apiEndpoint || !navigator.onLine) return;

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
      for (const change of changes) {
        await this._applyRemoteChange(change);
      }
      if (body.serverTime) this.setLastPullAt(body.serverTime);
      await App?.refreshSettingsCache?.();
      if (changes.length && window.App && Auth.isLoggedIn()) {
        // Re-render the current screen so newly-merged data shows immediately.
        App.navigateTo(App.currentView);
      }
    } catch (e) {
      console.warn('Pull failed (will retry):', e);
    }
  },

  async _applyRemoteChange(change) {
    const { table, uuid, data, updatedAt, deleted } = change;
    if (!SYNCABLE_TABLES.includes(table) || !uuid) return;
    const dexieTable = db[table];
    if (!dexieTable) return;

    try {
      const existing = await dexieTable.where('uuid').equals(uuid).first();

      if (deleted) {
        if (existing) await dexieTable.delete(existing.id);
        return;
      }

      const { id: _ignoredLocalId, ...fields } = data || {};

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
        }
      } else {
        await dexieTable.add({ ...fields, uuid, updatedAt });
      }
    } catch (e) {
      console.warn(`Could not apply remote change for ${table}/${uuid}:`, e);
    }
  },

  /* ---- Socket.IO real-time channel -------------------------------------- */
  async connectSocket() {
    if (typeof io === 'undefined') return; // socket.io-client not loaded (offline first visit) — REST polling still covers sync
    const settings = await db.settings.get(1);
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
    this.socketConnected = false;
  },

  // Called after the user changes the Sync/API settings so the new
  // endpoint takes effect immediately (fresh pull cursor + reconnect).
  async reconnect() {
    this.resetPullCursor();
    this.disconnectSocket();
    await this.connectSocket();
    await this.trigger();
  },

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
    const tables = SYNCABLE_TABLES.map(name => db[name]);
    await db.transaction('rw', tables, async () => {
      for (const name of SYNCABLE_TABLES) {
        if (d[name]) { await db[name].clear(); await db[name].bulkAdd(d[name]); }
      }
    });
    return true;
  }
};
