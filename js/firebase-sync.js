/* ============================================================================
   firebase-sync.js — Firestore as the sync backend (real-time)
   ----------------------------------------------------------------------------
   Data model: ONE Firestore collection called "records". Each document is one
   app record:   id = "<table>__<uuid>"
     { table, uuid, data:{...fields}, updatedAt:"ISO (device clock)",
       deleted:boolean, serverAt:<Firestore server timestamp> }

   - PUSH   : queued local changes are folded per record and written inside a
              transaction that applies last-write-wins on `updatedAt`.
   - LIVE   : one onSnapshot listener on `serverAt > cursor`. It delivers only
              what changed since this device last looked, so reads stay small.
              (Cursors use the SERVER's clock, so a change made offline last
              week and pushed today still reaches every device.)
   - AUTH   : one shared Email/Password account for the building. The password
              is typed once in Settings and is NOT stored by the app; the
              Firebase SDK keeps the signed-in session on the device.
   Everything else (local IndexedDB, merge rules, FK resolution) lives in
   sync.js and is shared with the other backends.
   ========================================================================= */

const FirebaseSync = {
  app: null, fdb: null, auth: null, projectId: null,
  started: false, unsubAuth: null, unsubListen: null,
  _chain: Promise.resolve(),

  /* ---- config helpers ---------------------------------------------------- */
  // Accepts what the Firebase console shows ("const firebaseConfig = { ... };")
  // or plain JSON, and returns a clean object — or throws a readable error.
  parseConfig(text) {
    const cfg = {};
    const re = /["']?([A-Za-z]\w*)["']?\s*:\s*["']([^"']*)["']/g;
    let m;
    while ((m = re.exec(text || ''))) cfg[m[1]] = m[2];
    const missing = ['apiKey', 'projectId', 'appId'].filter(k => !cfg[k]);
    if (missing.length) throw new Error('Config is missing: ' + missing.join(', '));
    return cfg;
  },

  _cfg(settings) { try { return JSON.parse(settings.firebaseConfig); } catch (e) { return null; } },
  _cursorKey() { return 'bms_fb_cursor_' + this.projectId; },

  _ensureApp(cfg) {
    if (typeof firebase === 'undefined') throw new Error('Firebase library not loaded — open the app once while online.');
    if (this.app && this.app.options.projectId !== cfg.projectId) throw new Error('PROJECT_CHANGED');
    if (!this.app) {
      this.app = firebase.apps.length ? firebase.app() : firebase.initializeApp(cfg);
      this.fdb = firebase.firestore();
      this.auth = firebase.auth();
    }
    this.projectId = cfg.projectId;
  },

  /* ---- sign in / out ----------------------------------------------------- */
  async signIn(cfg, email, password) {
    this._ensureApp(cfg);
    const cred = await this.auth.signInWithEmailAndPassword(email, password);
    return cred.user;
  },

  async signOut() {
    this.stop();
    if (this.auth) { try { await this.auth.signOut(); } catch (e) {} }
  },

  // Resolves once the SDK has restored (or failed to restore) the saved session.
  waitForAuth() {
    if (!this.auth) return Promise.resolve(null);
    return new Promise(resolve => {
      const off = this.auth.onAuthStateChanged(u => { off(); resolve(u); });
    });
  },

  /* ---- live listener ------------------------------------------------------ */
  async start(settings) {
    const cfg = this._cfg(settings);
    if (!cfg || typeof firebase === 'undefined') return;
    try { this._ensureApp(cfg); } catch (e) { console.warn(e.message); return; }
    if (this.started) return;
    this.started = true;
    this.unsubAuth = this.auth.onAuthStateChanged(user => {
      if (user) {
        SyncEngine.needsFirebaseLogin = false;
        this._listen();
      } else {
        this._unlisten();
        SyncEngine.needsFirebaseLogin = true;
        SyncEngine.socketConnected = false;
      }
      SyncEngine.updateStatusUI();
    });
  },

  stop() {
    if (this.unsubAuth) { this.unsubAuth(); this.unsubAuth = null; }
    this._unlisten();
    this.started = false;
    if ((typeof SyncEngine !== 'undefined')) SyncEngine.socketConnected = false;
  },

  ensureListening() {
    if (this.started && this.auth && this.auth.currentUser && !this.unsubListen) this._listen();
  },

  _listen() {
    if (this.unsubListen) return;
    // 2s overlap: re-reading a record is harmless (merge is idempotent),
    // missing one is not.
    const cursor = Math.max(0, Number(localStorage.getItem(this._cursorKey()) || 0) - 2000);
    const q = this.fdb.collection('records')
      .where('serverAt', '>', firebase.firestore.Timestamp.fromMillis(cursor))
      .orderBy('serverAt');
    this.unsubListen = q.onSnapshot(
      snap => { this._chain = this._chain.then(() => this._onSnapshot(snap)).catch(e => console.warn('Snapshot handling failed:', e)); },
      err => {
        console.warn('Firestore listener error:', err);
        this._noteError(err);
        SyncEngine.socketConnected = false;
        this._unlisten();
        SyncEngine.updateStatusUI();
      }
    );
  },

  _unlisten() {
    if (this.unsubListen) { try { this.unsubListen(); } catch (e) {} this.unsubListen = null; }
  },

  async _onSnapshot(snap) {
    let applied = 0;
    const tables = new Set();
    let maxMs = Number(localStorage.getItem(this._cursorKey()) || 0);
    for (const ch of snap.docChanges()) {
      if (ch.type === 'removed') continue;
      const d = ch.doc;
      if (d.metadata.hasPendingWrites) continue;
      const v = d.data();
      if (!v || !v.table || !v.serverAt) continue;
      const changed = await SyncEngine._applyRemoteChange({ table: v.table, uuid: v.uuid, data: v.data, updatedAt: v.updatedAt, deleted: !!v.deleted });
      if (changed) { applied++; tables.add(v.table); }
      maxMs = Math.max(maxMs, v.serverAt.toMillis());
    }
    localStorage.setItem(this._cursorKey(), String(maxMs));
    SyncEngine.socketConnected = !snap.metadata.fromCache;
    SyncEngine.lastError = null;
    await SyncEngine._afterRemoteApply(applied, tables);
    SyncEngine.updateStatusUI();
  },

  /* ---- push ---------------------------------------------------------------- */
  // Pure: given one folded change and the document currently in Firestore
  // (or null), return the document to write — or null to skip (the stored
  // copy is newer).
  buildDoc(change, prev) {
    if (prev && prev.updatedAt && new Date(prev.updatedAt) > new Date(change.updatedAt)) return null;
    if (change.operation === 'delete') {
      return { table: change.table, uuid: change.uuid, data: {}, updatedAt: change.updatedAt, deleted: true };
    }
    const base = prev && !prev.deleted ? prev.data : {};
    return { table: change.table, uuid: change.uuid, data: { ...base, ...change.data, uuid: change.uuid }, updatedAt: change.updatedAt, deleted: false };
  },

  async _writeDoc(change) {
    const ref = this.fdb.collection('records').doc(change.key);
    await this.fdb.runTransaction(async tx => {
      const snap = await tx.get(ref);
      const doc = this.buildDoc(change, snap.exists ? snap.data() : null);
      if (!doc) return;
      doc.serverAt = firebase.firestore.FieldValue.serverTimestamp();
      tx.set(ref, doc);
    });
  },

  async pushQueue() {
    if (!this.auth || !this.auth.currentUser || !navigator.onLine) return { pushed: 0 };
    const pending = await db.syncQueue.where('synced').equals(0).toArray();
    const legacy = pending.filter(i => !i.uuid); // pre-v3 queue rows can never be merged — drop them
    if (legacy.length) await db.syncQueue.bulkPut(legacy.map(i => ({ ...i, synced: 1 })));
    const docs = SyncEngine.compact(pending.filter(i => i.uuid));
    let pushed = 0;
    // 5 different records at a time; the SAME record is never written twice concurrently.
    for (let i = 0; i < docs.length; i += 5) {
      const chunk = docs.slice(i, i + 5);
      const results = await Promise.allSettled(chunk.map(d => this._writeDoc(d)));
      const okIds = [];
      let failed = false;
      results.forEach((r, idx) => {
        if (r.status === 'fulfilled') { okIds.push(...chunk[idx].ids); pushed++; }
        else { failed = true; this._noteError(r.reason); }
      });
      if (okIds.length) await db.syncQueue.where('id').anyOf(okIds).modify({ synced: 1 });
      if (failed) break; // keep the rest queued; the next cycle retries
    }
    return { pushed };
  },

  _noteError(err) {
    const code = (err && (err.code || err.message)) || String(err);
    SyncEngine.lastError = code;
    if (String(code).includes('permission-denied') && !this._warnedDenied) {
      this._warnedDenied = true;
      if ((typeof Utils !== 'undefined') && (typeof I18N !== 'undefined')) Utils.toast(t('firebasePermissionDenied'), 'error');
    }
  }
};
