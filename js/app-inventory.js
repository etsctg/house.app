/* ============================================================================
   app-inventory.js — Property & Asset Management
   ----------------------------------------------------------------------------
   Two tabs:
   1. Flats Inventory — full unit registry (flat no, floor, size, status,
      owner/tenant, contact info) with add/edit (Manager+).
   2. Asset Tracker — physical building assets (lift, generator, pumps,
      CCTV, solar panels, fire extinguishers, furniture, lights, etc.) with
      serial/model no., purchase date, warranty, condition, cost, location,
      plus a maintenance/service log per asset (cost, technician, next due).
   Asset purchase costs feed into the Assets & Liabilities report
   (see app-reports.js renderBalanceReport). Fully bilingual.
   ========================================================================= */

const CONDITION_KEYS = { good: 'good', 'needs-repair': 'needsRepair', damaged: 'damaged' };
const CONDITION_BADGE = { good: 'badge-green', 'needs-repair': 'badge-amber', damaged: 'badge-red' };
const FLAT_STATUS_KEYS = { 'owner-occupied': 'ownerOccupied', rented: 'rented', vacant: 'vacant' };
const FLAT_STATUS_BADGE = { 'owner-occupied': 'badge-green', rented: 'badge-blue', vacant: 'badge-slate' };

Views.renderInventory = async function (container) {
  container.innerHTML = `
    <h1 class="text-xl font-bold text-slate-800 mb-4">${t('propertyAssets')}</h1>
    <div class="border-b border-slate-200 flex gap-1 mb-5 overflow-x-auto" id="inv-tabs">
      <button data-tab="flats" class="tab-btn active">${t('flatsInventory')}</button>
      <button data-tab="assets" class="tab-btn">${t('assetTracker')}</button>
    </div>
    <div id="inv-body"></div>
  `;

  const tabs = { flats: renderFlatsInventoryTab, assets: renderAssetTrackerTab };
  const body = document.getElementById('inv-body');
  const activate = (tab) => {
    document.querySelectorAll('#inv-tabs .tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    tabs[tab](body);
  };
  document.querySelectorAll('#inv-tabs .tab-btn').forEach(btn => btn.addEventListener('click', () => activate(btn.dataset.tab)));
  activate('flats');
};

/* ============================================================================
   TAB 1 — FLATS INVENTORY
   ========================================================================= */
async function renderFlatsInventoryTab(body) {
  const canEdit = Auth.hasRole('manager');
  const flats = await db.flats.orderBy('flatNo').toArray();

  body.innerHTML = `
    <div class="flex justify-end mb-3">
      ${canEdit ? `<button id="add-flat-inv-btn" class="btn btn-primary">+ ${t('addFlat')}</button>` : ''}
    </div>
    <div class="card p-0 overflow-hidden"><div class="overflow-x-auto">
      <table class="data-table">
        <thead><tr>
          <th>${t('flat')}</th><th>${t('floor')}</th><th>${t('sizeSqft')}</th><th>${t('status')}</th>
          <th>${t('ownerName')}</th><th>${t('tenantName')}</th><th>${t('contactInfo')}</th>
          ${canEdit ? `<th>${t('actions')}</th>` : ''}
        </tr></thead>
        <tbody id="flats-inv-tbody">
          ${flats.length ? flats.map(f => `
            <tr>
              <td class="font-medium">${Utils.escapeHTML(f.flatNo)}</td>
              <td>${Utils.escapeHTML(f.floor || '-')}</td>
              <td>${f.sizeSqft ? Utils.escapeHTML(String(f.sizeSqft)) : '-'}</td>
              <td><span class="badge ${FLAT_STATUS_BADGE[f.status] || 'badge-slate'}">${t(FLAT_STATUS_KEYS[f.status] || f.status)}</span></td>
              <td>${Utils.escapeHTML(f.ownerName || '-')}</td>
              <td>${Utils.escapeHTML(f.tenantName || '-')}</td>
              <td>${Utils.escapeHTML(f.phone || '-')}</td>
              ${canEdit ? `<td><button data-id="${f.id}" class="edit-flat-inv-btn btn btn-secondary btn-sm">${t('edit')}</button></td>` : ''}
            </tr>`).join('') : `<tr><td colspan="8" class="empty-state">${t('noFlatsRegistered')}</td></tr>`}
        </tbody>
      </table>
    </div></div>
  `;

  if (!canEdit) return;

  const openFlatForm = (flat) => {
    const isEdit = !!flat;
    App.openModal(isEdit ? `${t('edit')} — ${flat.flatNo}` : t('addNewFlat'), `
      <form id="flat-inv-form" class="space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <div><label class="form-label">${t('flatUnitNo')}</label><input required id="fi-no" class="form-input" value="${isEdit ? Utils.escapeHTML(flat.flatNo) : ''}" /></div>
          <div><label class="form-label">${t('floor')}</label><input id="fi-floor" class="form-input" value="${isEdit ? Utils.escapeHTML(flat.floor || '') : ''}" placeholder="e.g. 3rd Floor" /></div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="form-label">${t('sizeSqft')}</label><input type="number" min="0" id="fi-size" class="form-input" value="${isEdit ? (flat.sizeSqft || '') : ''}" /></div>
          <div><label class="form-label">${t('monthlyFee')}</label><input required type="number" min="0" step="0.01" id="fi-fee" class="form-input" value="${isEdit ? flat.maintenanceFee : ''}" /></div>
        </div>
        <div><label class="form-label">${t('ownerName')}</label><input required id="fi-owner" class="form-input" value="${isEdit ? Utils.escapeHTML(flat.ownerName) : ''}" /></div>
        <div><label class="form-label">${t('tenantName')}</label><input id="fi-tenant" class="form-input" value="${isEdit ? Utils.escapeHTML(flat.tenantName || '') : ''}" /></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="form-label">${t('phone')}</label><input id="fi-phone" class="form-input" value="${isEdit ? Utils.escapeHTML(flat.phone || '') : ''}" /></div>
          <div><label class="form-label">${t('email')}</label><input type="email" id="fi-email" class="form-input" value="${isEdit ? Utils.escapeHTML(flat.email || '') : ''}" /></div>
        </div>
        <div><label class="form-label">${t('status')}</label>
          <select id="fi-status" class="form-select">
            <option value="owner-occupied">${t('ownerOccupied')}</option>
            <option value="rented">${t('rented')}</option>
            <option value="vacant">${t('vacant')}</option>
          </select>
        </div>
        <button type="submit" class="btn btn-primary w-full justify-center">${t('save')}</button>
      </form>`);
    if (isEdit) document.getElementById('fi-status').value = flat.status;

    document.getElementById('flat-inv-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        flatNo: document.getElementById('fi-no').value.trim(),
        floor: document.getElementById('fi-floor').value.trim(),
        sizeSqft: document.getElementById('fi-size').value ? Number(document.getElementById('fi-size').value) : '',
        maintenanceFee: Number(document.getElementById('fi-fee').value),
        ownerName: document.getElementById('fi-owner').value.trim(),
        tenantName: document.getElementById('fi-tenant').value.trim(),
        phone: document.getElementById('fi-phone').value.trim(),
        email: document.getElementById('fi-email').value.trim(),
        status: document.getElementById('fi-status').value
      };
      if (isEdit) {
        const updates = await touch('flats', { ...data, uuid: flat.uuid });
        await db.flats.update(flat.id, updates);
        await queueSync('flats', flat.id, 'update', updates);
        await logAudit(Auth.current.id, 'FLAT_UPDATED', data.flatNo);
      } else {
        const rec = await withMeta('flats', data);
        const id = await db.flats.add(rec);
        await queueSync('flats', id, 'create', rec);
        await logAudit(Auth.current.id, 'FLAT_ADDED', data.flatNo);
      }
      Utils.toast(t('save') + ' ✓');
      App.closeModal();
      App.navigateTo('inventory');
    });
  };

  document.getElementById('add-flat-inv-btn').addEventListener('click', () => openFlatForm(null));
  body.querySelectorAll('.edit-flat-inv-btn').forEach(btn => btn.addEventListener('click', async () => {
    const flat = await db.flats.get(Number(btn.dataset.id));
    openFlatForm(flat);
  }));
}

/* ============================================================================
   TAB 2 — ASSET TRACKER
   ========================================================================= */
async function renderAssetTrackerTab(body) {
  const canEdit = Auth.hasRole('manager');
  const assets = await db.assets.orderBy('name').toArray();
  const today = Utils.todayInputValue();

  const totalValue = assets.reduce((s, a) => s + Number(a.purchaseCost || 0), 0);
  const needingAttention = assets.filter(a => a.condition !== 'good').length;

  body.innerHTML = `
    <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
      <div class="stat-card"><div class="text-xs text-slate-400 font-semibold">${t('totalAssetValue').toUpperCase()}</div><div class="text-lg font-bold mt-1">${Utils.money(totalValue)}</div></div>
      <div class="stat-card"><div class="text-xs text-slate-400 font-semibold">${t('assetTracker').toUpperCase()}</div><div class="text-lg font-bold mt-1">${assets.length}</div></div>
      <div class="stat-card"><div class="text-xs text-slate-400 font-semibold">${t('assetsNeedingAttention').toUpperCase()}</div><div class="text-lg font-bold ${needingAttention ? 'text-rose-600' : ''} mt-1">${needingAttention}</div></div>
    </div>
    <div class="flex justify-end mb-3">
      ${canEdit ? `<button id="add-asset-btn" class="btn btn-primary">+ ${t('recordAsset')}</button>` : ''}
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" id="assets-grid">
      ${assets.length ? assets.map(a => {
        const warrantyExpired = a.warrantyExpiry && a.warrantyExpiry < today;
        return `
        <div class="card p-4">
          <div class="flex justify-between items-start mb-1">
            <h3 class="font-bold text-slate-800">${Utils.escapeHTML(a.name)}</h3>
            <span class="badge ${CONDITION_BADGE[a.condition] || 'badge-slate'}">${t(CONDITION_KEYS[a.condition] || a.condition)}</span>
          </div>
          <div class="text-xs text-slate-400 mb-3">${Utils.escapeHTML(a.category)} ${a.serialNo ? '· ' + Utils.escapeHTML(a.serialNo) : ''}</div>
          <div class="space-y-1.5 text-sm">
            <div class="flex justify-between"><span class="text-slate-500">${t('purchaseCost')}</span><span class="font-medium">${Utils.money(a.purchaseCost)}</span></div>
            <div class="flex justify-between"><span class="text-slate-500">${t('purchaseDate')}</span><span class="font-medium">${a.purchaseDate ? Utils.dateStr(a.purchaseDate) : '-'}</span></div>
            <div class="flex justify-between"><span class="text-slate-500">${t('warrantyExpiry')}</span><span class="font-medium ${warrantyExpired ? 'text-rose-600' : 'text-emerald-600'}">${a.warrantyExpiry ? Utils.dateStr(a.warrantyExpiry) : '-'} ${a.warrantyExpiry ? (warrantyExpired ? `(${t('warrantyExpired')})` : '') : ''}</span></div>
            <div class="flex justify-between"><span class="text-slate-500">${t('location')}</span><span class="font-medium">${Utils.escapeHTML(a.location || '-')}</span></div>
          </div>
          <div class="flex gap-2 mt-3">
            <button data-id="${a.id}" class="view-asset-btn btn btn-secondary btn-sm flex-1 justify-center">${t('maintenanceHistory')}</button>
            ${canEdit ? `<button data-id="${a.id}" class="edit-asset-btn btn btn-secondary btn-sm">${t('edit')}</button>` : ''}
            ${canEdit ? `<button data-id="${a.id}" class="del-asset-btn btn btn-danger btn-sm">✕</button>` : ''}
          </div>
        </div>`;
      }).join('') : `<div class="col-span-full empty-state">${t('noAssetsYet')}</div>`}
    </div>
  `;

  const conditionOptionsHTML = (selected) => `
    <option value="good" ${selected==='good'?'selected':''}>${t('good')}</option>
    <option value="needs-repair" ${selected==='needs-repair'?'selected':''}>${t('needsRepair')}</option>
    <option value="damaged" ${selected==='damaged'?'selected':''}>${t('damaged')}</option>`;

  const openAssetForm = (asset) => {
    const isEdit = !!asset;
    App.openModal(isEdit ? t('editAsset') : t('addNewAsset'), `
      <form id="asset-form" class="space-y-3">
        <div><label class="form-label">${t('assetName')}</label><input required id="a-name" class="form-input" value="${isEdit ? Utils.escapeHTML(asset.name) : ''}" placeholder="e.g. Passenger Lift" /></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="form-label">${t('assetCategory')}</label><input required id="a-category" class="form-input" value="${isEdit ? Utils.escapeHTML(asset.category) : ''}" placeholder="e.g. Lift/Elevator, Generator, CCTV" /></div>
          <div><label class="form-label">${t('serialModelNo')}</label><input id="a-serial" class="form-input" value="${isEdit ? Utils.escapeHTML(asset.serialNo || '') : ''}" /></div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="form-label">${t('purchaseDate')}</label><input type="date" id="a-purchase-date" class="form-input" value="${isEdit ? (asset.purchaseDate || '') : ''}" /></div>
          <div><label class="form-label">${t('warrantyExpiry')}</label><input type="date" id="a-warranty" class="form-input" value="${isEdit ? (asset.warrantyExpiry || '') : ''}" /></div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="form-label">${t('purchaseCost')}</label><input required type="number" min="0" step="0.01" id="a-cost" class="form-input" value="${isEdit ? asset.purchaseCost : ''}" /></div>
          <div><label class="form-label">${t('condition')}</label><select id="a-condition" class="form-select">${conditionOptionsHTML(isEdit ? asset.condition : 'good')}</select></div>
        </div>
        <div><label class="form-label">${t('location')}</label><input id="a-location" class="form-input" value="${isEdit ? Utils.escapeHTML(asset.location || '') : ''}" placeholder="e.g. Basement, Main Lobby" /></div>
        <button type="submit" class="btn btn-primary w-full justify-center">${t('saveAsset')}</button>
      </form>`);

    document.getElementById('asset-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        name: document.getElementById('a-name').value.trim(),
        category: document.getElementById('a-category').value.trim(),
        serialNo: document.getElementById('a-serial').value.trim(),
        purchaseDate: document.getElementById('a-purchase-date').value || '',
        warrantyExpiry: document.getElementById('a-warranty').value || '',
        purchaseCost: Number(document.getElementById('a-cost').value),
        condition: document.getElementById('a-condition').value,
        location: document.getElementById('a-location').value.trim()
      };
      if (isEdit) {
        const updates = await touch('assets', { ...data, uuid: asset.uuid });
        await db.assets.update(asset.id, updates);
        await queueSync('assets', asset.id, 'update', updates);
        await logAudit(Auth.current.id, 'ASSET_UPDATED', data.name);
      } else {
        const rec = await withMeta('assets', data);
        const id = await db.assets.add(rec);
        await queueSync('assets', id, 'create', rec);
        await logAudit(Auth.current.id, 'ASSET_ADDED', data.name);
      }
      Utils.toast(t('saveAsset') + ' ✓');
      App.closeModal();
      App.navigateTo('inventory');
    });
  };

  if (canEdit) {
    document.getElementById('add-asset-btn').addEventListener('click', () => openAssetForm(null));
    body.querySelectorAll('.edit-asset-btn').forEach(btn => btn.addEventListener('click', async () => {
      const asset = await db.assets.get(Number(btn.dataset.id));
      openAssetForm(asset);
    }));
    body.querySelectorAll('.del-asset-btn').forEach(btn => btn.addEventListener('click', async () => {
      const ok = await Utils.confirmDialog(t('deleteAssetConfirm'));
      if (!ok) return;
      const id = Number(btn.dataset.id);
      const existingAsset = await db.assets.get(id);
      const logs = await db.maintenanceLogs.where('assetId').equals(id).toArray();
      for (const l of logs) { await queueSync('maintenanceLogs', l.id, 'delete', { uuid: l.uuid }); }
      await db.maintenanceLogs.bulkDelete(logs.map(l => l.id));
      await db.assets.delete(id);
      await queueSync('assets', id, 'delete', { uuid: existingAsset && existingAsset.uuid });
      await logAudit(Auth.current.id, 'ASSET_DELETED', 'id:' + id);
      Utils.toast(t('delete') + ' ✓', 'info');
      App.navigateTo('inventory');
    }));
  }

  body.querySelectorAll('.view-asset-btn').forEach(btn => btn.addEventListener('click', async () => {
    const asset = await db.assets.get(Number(btn.dataset.id));
    openAssetMaintenanceModal(asset, canEdit);
  }));
}

async function openAssetMaintenanceModal(asset, canEdit) {
  const logs = await db.maintenanceLogs.where('assetId').equals(asset.id).reverse().sortBy('serviceDate');

  const renderLogsHTML = (list) => list.length ? `
    <div class="overflow-x-auto mt-3">
      <table class="data-table">
        <thead><tr><th>${t('serviceDate')}</th><th>${t('description')}</th><th class="text-right">${t('repairCost')}</th><th>${t('technicianName')}</th><th>${t('technicianContact')}</th><th>${t('nextServiceDate')}</th></tr></thead>
        <tbody>${list.map(l => `<tr><td>${Utils.dateStr(l.serviceDate)}</td><td>${Utils.escapeHTML(l.description || '-')}</td><td class="text-right">${Utils.money(l.cost)}</td><td>${Utils.escapeHTML(l.technicianName || '-')}</td><td>${Utils.escapeHTML(l.technicianContact || '-')}</td><td>${l.nextServiceDate ? Utils.dateStr(l.nextServiceDate) : '-'}</td></tr>`).join('')}</tbody>
      </table>
    </div>` : `<div class="empty-state text-sm">${t('noServiceLogs')}</div>`;

  App.openModal(`${t('maintenanceHistory')} — ${asset.name}`, `
    <div id="maint-log-list">${renderLogsHTML(logs)}</div>
    ${canEdit ? `<button id="log-service-btn" class="btn btn-primary w-full justify-center mt-4">+ ${t('logService')}</button>` : ''}
  `);

  if (!canEdit) return;

  document.getElementById('log-service-btn').addEventListener('click', () => {
    App.openModal(t('logMaintenanceService'), `
      <form id="service-log-form" class="space-y-3">
        <div><label class="form-label">${t('serviceDate')}</label><input required type="date" id="sl-date" value="${Utils.todayInputValue()}" class="form-input" /></div>
        <div><label class="form-label">${t('description')}</label><textarea id="sl-desc" rows="2" class="form-textarea"></textarea></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="form-label">${t('repairCost')}</label><input required type="number" min="0" step="0.01" id="sl-cost" class="form-input" value="0" /></div>
          <div><label class="form-label">${t('nextServiceDate')}</label><input type="date" id="sl-next" class="form-input" /></div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="form-label">${t('technicianName')}</label><input id="sl-tech" class="form-input" /></div>
          <div><label class="form-label">${t('technicianContact')}</label><input id="sl-tech-contact" class="form-input" /></div>
        </div>
        <button type="submit" class="btn btn-primary w-full justify-center">${t('saveServiceLog')}</button>
      </form>`);

    document.getElementById('service-log-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const rec = await withMeta('maintenanceLogs', {
        assetId: asset.id,
        serviceDate: document.getElementById('sl-date').value,
        description: document.getElementById('sl-desc').value.trim(),
        cost: Number(document.getElementById('sl-cost').value) || 0,
        technicianName: document.getElementById('sl-tech').value.trim(),
        technicianContact: document.getElementById('sl-tech-contact').value.trim(),
        nextServiceDate: document.getElementById('sl-next').value || ''
      });
      const id = await db.maintenanceLogs.add(rec);
      await queueSync('maintenanceLogs', id, 'create', rec);

      // Optionally record the repair cost as a building expense so it flows
      // into the accounting reports too (only when a technician cost > 0).
      if (rec.cost > 0) {
        await createTransaction({
          type: 'expense', category: 'Repairs & Maintenance', amount: rec.cost,
          date: rec.serviceDate, description: `${asset.name} — ${rec.description || t('logService')}`,
          payerOrPayee: rec.technicianName, method: 'Cash'
        });
      }

      await logAudit(Auth.current.id, 'ASSET_SERVICE_LOGGED', `${asset.name} — ${Utils.money(rec.cost)}`);
      Utils.toast(t('saveServiceLog') + ' ✓');
      App.closeModal();
      App.navigateTo('inventory');
    });
  });
}
