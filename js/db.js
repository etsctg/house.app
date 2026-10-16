/* ============================================================================
   db.js — IndexedDB layer (Dexie.js)
   Defines all local tables used by the Building Management & Accounting
   System. This is the single source of truth on the device; the sync
   engine (sync.js) reconciles this data with a remote backend (server/) in
   real time via push + pull + a Socket.IO "something changed" signal, when
   a backend is configured under Settings > Sync/API.
   ========================================================================= */

const db = new Dexie('BuildingManagementDB');

// ---- Schema definition (v1 — original) -------------------------------------
db.version(1).stores({
  users: '++id, &username, role, status, flatId, createdAt',
  flats: '++id, &flatNo, ownerName, tenantName, status',
  categories: '++id, type, name',
  transactions: '++id, uuid, type, category, flatId, eventId, date, voucherNo, createdBy, synced, createdAt',
  duesSchedule: '++id, flatId, month, year, dueAmount, paidAmount, status',
  events: '++id, name, status, startDate, endDate',
  requests: '++id, userId, flatId, status, priority, createdAt',
  auditLogs: '++id, userId, action, timestamp',
  notices: '++id, title, postedBy, pinned, createdAt',
  settings: '++id',
  syncQueue: '++id, table, recordId, operation, synced, timestamp'
});

// ---- Schema definition (v2 — Property & Asset Management module) ----------
db.version(2).stores({
  users: '++id, &username, role, status, flatId, createdAt',
  flats: '++id, &flatNo, ownerName, tenantName, status, floor',
  categories: '++id, type, name',
  transactions: '++id, uuid, type, category, flatId, eventId, date, voucherNo, createdBy, synced, createdAt',
  duesSchedule: '++id, flatId, month, year, dueAmount, paidAmount, status',
  events: '++id, name, status, startDate, endDate',
  requests: '++id, userId, flatId, status, priority, createdAt',
  auditLogs: '++id, userId, action, timestamp',
  notices: '++id, title, postedBy, pinned, createdAt',
  settings: '++id',
  syncQueue: '++id, table, recordId, operation, synced, timestamp',
  assets: '++id, name, category, condition, purchaseDate, warrantyExpiry',
  maintenanceLogs: '++id, assetId, serviceDate, cost'
}).upgrade(async (tx) => {
  await tx.table('flats').toCollection().modify(f => {
    if (f.floor === undefined) f.floor = '';
    if (f.sizeSqft === undefined) f.sizeSqft = '';
  });
});

// ---- Schema definition (v3 — real multi-device sync) -----------------------
// Every syncable table gains a globally-unique `uuid` (stable across devices,
// unlike the local auto-increment `id`) and an `updatedAt` timestamp used for
// last-write-wins conflict resolution when merging changes pulled from the
// backend server. `syncQueue` gains a `uuid` index too, so the push loop in
// sync.js can look records up quickly.
db.version(3).stores({
  users: '++id, &username, role, status, flatId, createdAt, uuid, updatedAt',
  flats: '++id, &flatNo, ownerName, tenantName, status, floor, uuid, updatedAt',
  categories: '++id, type, name, uuid, updatedAt',
  transactions: '++id, uuid, type, category, flatId, eventId, date, voucherNo, createdBy, synced, createdAt, updatedAt',
  duesSchedule: '++id, flatId, month, year, dueAmount, paidAmount, status, uuid, updatedAt',
  events: '++id, name, status, startDate, endDate, uuid, updatedAt',
  requests: '++id, userId, flatId, status, priority, createdAt, uuid, updatedAt',
  auditLogs: '++id, userId, action, timestamp, uuid, updatedAt',
  notices: '++id, title, postedBy, pinned, createdAt, uuid, updatedAt',
  settings: '++id, uuid, updatedAt',
  syncQueue: '++id, table, recordId, uuid, operation, synced, timestamp',
  assets: '++id, name, category, condition, purchaseDate, warrantyExpiry, uuid, updatedAt',
  maintenanceLogs: '++id, assetId, serviceDate, cost, uuid, updatedAt'
}).upgrade(async (tx) => {
  // Backfill uuid + updatedAt on every existing row so older (v1/v2) installs
  // can start syncing with a backend immediately after upgrading.
  const tables = ['users', 'flats', 'categories', 'transactions', 'duesSchedule', 'events', 'requests', 'auditLogs', 'notices', 'settings', 'assets', 'maintenanceLogs'];
  for (const name of tables) {
    await tx.table(name).toCollection().modify(rec => {
      if (!rec.uuid) rec.uuid = genUUID();
      if (!rec.updatedAt) rec.updatedAt = rec.createdAt || rec.timestamp || nowISO();
    });
  }
});

// ---- Password hashing (client-side SHA-256, salted with username) --------
// NOTE: This is a lightweight, dependency-free hashing scheme suitable for
// an offline-first local app. If/when this app is connected to the backend
// server (see /server), authentication should ideally be re-verified there;
// the client-side hash is used for offline login on this device.
async function hashPassword(username, plain) {
  const enc = new TextEncoder();
  const data = enc.encode(`bms::${username.toLowerCase()}::${plain}`);
  const hashBuf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function genUUID() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function nowISO() { return new Date().toISOString(); }

// ---- Sync metadata helpers --------------------------------------------------
// Every record that should sync across devices carries a stable `uuid` and an
// `updatedAt` stamp. Foreign keys (flatId, eventId, assetId, userId, ...) are
// LOCAL auto-increment numbers that mean nothing on another device, so for
// every such field we also stamp a companion `xxxUuid` field pointing at the
// referenced record's stable uuid. When a change is pulled on another device,
// that companion uuid is resolved back into whatever local id it has there
// (see SyncEngine._applyRemoteChange in sync.js).
const FK_MAP = {
  users: [['flatId', 'flatUuid', 'flats']],
  transactions: [['flatId', 'flatUuid', 'flats'], ['eventId', 'eventUuid', 'events'], ['duesId', 'duesUuid', 'duesSchedule'], ['createdBy', 'createdByUuid', 'users']],
  duesSchedule: [['flatId', 'flatUuid', 'flats']],
  requests: [['userId', 'userUuid', 'users'], ['flatId', 'flatUuid', 'flats']],
  auditLogs: [['userId', 'userUuid', 'users']],
  maintenanceLogs: [['assetId', 'assetUuid', 'assets']]
};

async function stampForeignUuids(tableName, rec) {
  const map = FK_MAP[tableName];
  if (!map) return rec;
  const out = { ...rec };
  for (const [idField, uuidField, targetTable] of map) {
    const localId = out[idField];
    if (localId !== undefined && localId !== null && localId !== '') {
      const target = await db[targetTable].get(Number(localId));
      out[uuidField] = target ? target.uuid : (out[uuidField] || null);
    } else {
      out[uuidField] = null;
    }
  }
  return out;
}

async function withMeta(tableName, rec) {
  const stamped = { ...rec, uuid: rec.uuid || genUUID(), updatedAt: nowISO() };
  return await stampForeignUuids(tableName, stamped);
}
async function touch(tableName, rec) {
  const stamped = { ...rec, updatedAt: nowISO() };
  return await stampForeignUuids(tableName, stamped);
}

// ---- Audit logging helper --------------------------------------------------
async function logAudit(userId, action, details = '') {
  const rec = await withMeta('auditLogs', { userId: userId || null, action, details, timestamp: nowISO() });
  const id = await db.auditLogs.add(rec);
  if (window.queueSync) await queueSync('auditLogs', id, 'create', rec);
}

// ---- Sync queue helper: called by every write operation in the app -------
// `payload` must always carry a `uuid` (and, for create/update, `updatedAt`)
// so the backend and other devices can merge it correctly. See sync.js for
// how queued items are pushed, and how remote changes are pulled back in.
async function queueSync(table, recordId, operation, payload) {
  await db.syncQueue.add({
    table, recordId, uuid: payload && payload.uuid, operation,
    payload: JSON.stringify(payload),
    synced: 0, timestamp: nowISO()
  });
  if (navigator.onLine && window.SyncEngine) {
    window.SyncEngine.push();
  }
}

// ---- Seed data (first run only) -------------------------------------------
async function seedDatabase() {
  const settingsCount = await db.settings.count();
  if (settingsCount === 0) {
    await db.settings.add(await withMeta('settings', {
      id: 1,
      buildingName: 'Green View Apartments',
      address: '123 Lakeview Road, Dhaka',
      contact: '+880 1700-000000',
      email: 'admin@greenview.example',
      logo: '',
      currency: 'BDT',
      currencySymbol: '৳',
      apiEndpoint: '',
      apiKey: '',
      lastBackup: null
    }));
  }

  const userCount = await db.users.count();
  if (userCount === 0) {
    const pass = await hashPassword('admin', 'admin123');
    await db.users.add(await withMeta('users', {
      username: 'admin', passwordHash: pass, name: 'Super Administrator', role: 'superadmin',
      email: 'admin@building.local', phone: '', flatId: null, status: 'active', createdAt: nowISO()
    }));

    const managerPass = await hashPassword('manager', 'manager123');
    await db.users.add(await withMeta('users', {
      username: 'manager', passwordHash: managerPass, name: 'Building Manager', role: 'manager',
      email: 'manager@building.local', phone: '', flatId: null, status: 'active', createdAt: nowISO()
    }));

    const entryPass = await hashPassword('entry', 'entry123');
    await db.users.add(await withMeta('users', {
      username: 'entry', passwordHash: entryPass, name: 'Accounts Staff', role: 'entry',
      email: 'entry@building.local', phone: '', flatId: null, status: 'active', createdAt: nowISO()
    }));
  }

  const catCount = await db.categories.count();
  if (catCount === 0) {
    const incomeCats = ['Maintenance Fee', 'Rent Collection', 'Parking Fee', 'Event Fund', 'Interest Income', 'Miscellaneous Income'];
    const expenseCats = ['Electricity Bill', 'Water Bill', 'Security Staff Salary', 'Cleaning & Sanitation', 'Repairs & Maintenance', 'Generator Fuel', 'Lift Maintenance', 'Office Supplies', 'Miscellaneous Expense'];
    for (const c of incomeCats) await db.categories.add(await withMeta('categories', { type: 'income', name: c }));
    for (const c of expenseCats) await db.categories.add(await withMeta('categories', { type: 'expense', name: c }));
  }

  const noticeCount = await db.notices.count();
  if (noticeCount === 0) {
    await db.notices.add(await withMeta('notices', {
      title: 'Welcome to the Building Management System',
      body: 'This board will be used for all building-wide announcements, maintenance schedules, and important notices. Please check back regularly.',
      postedBy: 'Super Administrator', pinned: 1, createdAt: nowISO()
    }));
  }

  const flatCount = await db.flats.count();
  if (flatCount === 0) {
    const demoFlats = [
      { flatNo: 'A-101', floor: '1st Floor', sizeSqft: 1250, ownerName: 'Mr. Karim Ahmed', tenantName: '', phone: '01711000001', email: '', maintenanceFee: 3500, status: 'owner-occupied' },
      { flatNo: 'A-102', floor: '1st Floor', sizeSqft: 1250, ownerName: 'Mrs. Fatima Begum', tenantName: 'Mr. Salim Reza', phone: '01711000002', email: '', maintenanceFee: 3500, status: 'rented' },
      { flatNo: 'B-201', floor: '2nd Floor', sizeSqft: 1450, ownerName: 'Mr. Jahangir Alam', tenantName: '', phone: '01711000003', email: '', maintenanceFee: 4000, status: 'owner-occupied' },
      { flatNo: 'B-202', floor: '2nd Floor', sizeSqft: 1450, ownerName: 'Ms. Nasrin Sultana', tenantName: '', phone: '01711000004', email: '', maintenanceFee: 4000, status: 'vacant' }
    ];
    for (const f of demoFlats) await db.flats.add(await withMeta('flats', f));
  }

  const assetCount = await db.assets.count();
  if (assetCount === 0) {
    const demoAssets = [
      { name: 'Passenger Lift (Lift-1)', category: 'Lift/Elevator', serialNo: 'OTIS-LX-4471', purchaseDate: '2019-03-10', warrantyExpiry: '2024-03-10', condition: 'good', purchaseCost: 850000, location: 'Main Lobby' },
      { name: 'Standby Generator 15kVA', category: 'Generator', serialNo: 'GEN-15KVA-2201', purchaseDate: '2020-06-15', warrantyExpiry: '2023-06-15', condition: 'good', purchaseCost: 420000, location: 'Basement' },
      { name: 'Submersible Water Pump', category: 'Water Pump', serialNo: 'WP-SUB-8890', purchaseDate: '2021-01-20', warrantyExpiry: '2023-01-20', condition: 'needs-repair', purchaseCost: 65000, location: 'Underground Reservoir' },
      { name: 'CCTV Camera System (8ch)', category: 'CCTV Cameras', serialNo: 'CCTV-HK-3391', purchaseDate: '2022-05-05', warrantyExpiry: '2025-05-05', condition: 'good', purchaseCost: 95000, location: 'Main Gate & Corridors' },
      { name: 'Fire Extinguisher (ABC 6kg)', category: 'Fire Extinguisher', serialNo: 'FE-ABC-0012', purchaseDate: '2023-02-01', warrantyExpiry: '2025-02-01', condition: 'good', purchaseCost: 3500, location: 'Each Floor Corridor' }
    ];
    for (const a of demoAssets) await db.assets.add(await withMeta('assets', a));
  }
}

db.on('populate', () => { /* handled by seedDatabase() call at startup */ });
