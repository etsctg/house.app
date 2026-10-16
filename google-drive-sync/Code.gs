/**
 * Building Management System — Google Drive Sync (Google Apps Script)
 * -------------------------------------------------------------------
 * Stores all synced data in ONE JSON file in your Google Drive
 * ("BMS_Sync_Data.json") and speaks the same push/pull protocol as the
 * web app's sync engine.
 *
 * SETUP: see README.md in this folder. In short:
 *   1. Paste this file into a new Apps Script project.
 *   2. Change API_KEY below to your own long random secret.
 *   3. Run the `setup` function once (grants Drive permission).
 *   4. Deploy > New deployment > Web app
 *        Execute as: Me      Who has access: Anyone
 *   5. Paste the /exec URL and the same API key into the app:
 *        Building Settings > Sync/API.
 *   NOTE: after ANY later edit of this code you must create a NEW
 *   deployment version (Deploy > Manage deployments > Edit > New version),
 *   otherwise the /exec URL keeps running the old code.
 */

// >>> CHANGE THIS to your own secret. It must match the "API Key" field in the app.
var API_KEY = 'CHANGE_ME_TO_A_LONG_RANDOM_SECRET';
var FILE_NAME = 'BMS_Sync_Data.json';

/* ---------- storage: one JSON file in Drive ---------- */
function getFile_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('FILE_ID');
  if (id) {
    try { return DriveApp.getFileById(id); } catch (e) { /* file gone, fall through */ }
  }
  var files = DriveApp.getFilesByName(FILE_NAME);
  if (files.hasNext()) {
    var existing = files.next();
    props.setProperty('FILE_ID', existing.getId());
    return existing;
  }
  var created = DriveApp.createFile(FILE_NAME, '{}', 'application/json');
  props.setProperty('FILE_ID', created.getId());
  return created;
}

function load_() {
  try {
    var text = getFile_().getBlob().getDataAsString();
    return text ? JSON.parse(text) : {};
  } catch (e) {
    return {};
  }
}

function save_(data) {
  getFile_().setContent(JSON.stringify(data));
}

/* ---------- merge logic (same rules as server/server.js) ---------- */
function applyChange_(data, change) {
  if (!change || !change.table || !change.uuid || !change.updatedAt) return false;
  if (!data[change.table]) data[change.table] = {};
  var t = data[change.table];
  var prev = t[change.uuid];
  var newer = !prev || new Date(change.updatedAt) >= new Date(prev.updatedAt);
  if (!newer) return false;

  if (change.operation === 'delete') {
    t[change.uuid] = { data: {}, updatedAt: change.updatedAt, deleted: true };
    return true;
  }
  var prevData = (prev && !prev.deleted) ? prev.data : {};
  var merged = {};
  var k;
  for (k in prevData) merged[k] = prevData[k];
  var incoming = change.data || {};
  for (k in incoming) merged[k] = incoming[k];
  merged.uuid = change.uuid;
  t[change.uuid] = { data: merged, updatedAt: change.updatedAt, deleted: false };
  return true;
}

function changesSince_(data, sinceISO) {
  var since = new Date(sinceISO || '1970-01-01T00:00:00.000Z');
  var out = [];
  Object.keys(data).forEach(function (table) {
    Object.keys(data[table]).forEach(function (uuid) {
      var entry = data[table][uuid];
      if (new Date(entry.updatedAt) > since) {
        out.push({ table: table, uuid: uuid, data: entry.data, updatedAt: entry.updatedAt, deleted: !!entry.deleted });
      }
    });
  });
  return out;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- web app entry points ---------- */
// GET  ?action=ping                          -> health check (no key needed)
// GET  ?action=pull&since=<ISO>&key=<KEY>    -> changes newer than `since`
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (!p.action || p.action === 'ping') {
    return json_({ ok: true, message: 'BMS Drive sync is running', time: new Date().toISOString() });
  }
  if (API_KEY && p.key !== API_KEY) return json_({ ok: false, error: 'Unauthorized' });
  if (p.action === 'pull') {
    return json_({ ok: true, serverTime: new Date().toISOString(), changes: changesSince_(load_(), p.since) });
  }
  return json_({ ok: false, error: 'Unknown action' });
}

// POST body (text/plain JSON): { action:'push', key:'<KEY>', changes:[...] }
function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'Bad JSON' }); }
  if (API_KEY && body.key !== API_KEY) return json_({ ok: false, error: 'Unauthorized' });
  if (body.action !== 'push') return json_({ ok: false, error: 'Unknown action' });

  var lock = LockService.getScriptLock();
  lock.waitLock(25000); // two devices pushing at once must not overwrite each other
  try {
    var data = load_();
    var applied = 0;
    (body.changes || []).forEach(function (c) { if (applyChange_(data, c)) applied++; });
    if (applied > 0) save_(data);
    return json_({ ok: true, applied: applied, serverTime: new Date().toISOString() });
  } finally {
    lock.releaseLock();
  }
}

/** Run this ONCE from the editor: it creates the Drive file and triggers the permission prompt. */
function setup() {
  var f = getFile_();
  Logger.log('Drive file ready: ' + f.getUrl());
}
