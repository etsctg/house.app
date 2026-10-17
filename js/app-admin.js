/* ============================================================================
   app-admin.js — Category management, User management (RBAC), Building
   Settings (profile, logo, backup/restore, data reset), Audit Log viewer.
   Fully bilingual via the global t() helper.
   ========================================================================= */

/* ============================================================================
   CATEGORIES (Manager+)
   ========================================================================= */
Views.renderCategories = async function (container) {
  const categories = await db.categories.toArray();
  const income = categories.filter(c => c.type === 'income');
  const expense = categories.filter(c => c.type === 'expense');

  container.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-xl font-bold text-slate-800">${t('incomeExpenseCategories')}</h1>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="card p-4">
        <div class="flex justify-between items-center mb-3">
          <h3 class="font-semibold text-sm text-slate-700">${t('incomeCategories')}</h3>
          <button data-type="income" class="add-cat-btn btn btn-success btn-sm">+ ${t('add')}</button>
        </div>
        <div class="space-y-1" id="income-cat-list">
          ${income.length ? income.map(c => `
            <div class="flex justify-between items-center px-3 py-2 rounded-lg hover:bg-slate-50">
              <span class="text-sm">${Utils.escapeHTML(c.name)}</span>
              <button data-id="${c.id}" class="del-cat-btn text-slate-300 hover:text-rose-500">✕</button>
            </div>`).join('') : `<div class="empty-state text-sm">${t('noIncomeCategories')}</div>`}
        </div>
      </div>
      <div class="card p-4">
        <div class="flex justify-between items-center mb-3">
          <h3 class="font-semibold text-sm text-slate-700">${t('expenseCategories')}</h3>
          <button data-type="expense" class="add-cat-btn btn btn-danger btn-sm">+ ${t('add')}</button>
        </div>
        <div class="space-y-1" id="expense-cat-list">
          ${expense.length ? expense.map(c => `
            <div class="flex justify-between items-center px-3 py-2 rounded-lg hover:bg-slate-50">
              <span class="text-sm">${Utils.escapeHTML(c.name)}</span>
              <button data-id="${c.id}" class="del-cat-btn text-slate-300 hover:text-rose-500">✕</button>
            </div>`).join('') : `<div class="empty-state text-sm">${t('noExpenseCategories')}</div>`}
        </div>
      </div>
    </div>
  `;

  container.querySelectorAll('.add-cat-btn').forEach(btn => btn.addEventListener('click', () => {
    const type = btn.dataset.type;
    App.openModal(`${t('addCategory')} — ${type === 'income' ? t('income') : t('expense')}`, `
      <form id="cat-form" class="space-y-4">
        <div><label class="form-label">${t('categoryName')}</label><input required id="cat-name" class="form-input" /></div>
        <button type="submit" class="btn btn-primary w-full justify-center">${t('addCategory')}</button>
      </form>`);
    document.getElementById('cat-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const rec = await withMeta('categories', { type, name: document.getElementById('cat-name').value.trim() });
      const id = await db.categories.add(rec);
      await queueSync('categories', id, 'create', rec);
      await logAudit(Auth.current.id, 'CATEGORY_ADDED', `${type}: ${rec.name}`);
      Utils.toast(t('addCategory') + ' ✓');
      App.closeModal();
      App.navigateTo('categories');
    });
  }));

  container.querySelectorAll('.del-cat-btn').forEach(btn => btn.addEventListener('click', async () => {
    const ok = await Utils.confirmDialog(t('deleteCategoryConfirm'));
    if (!ok) return;
    const id = Number(btn.dataset.id);
    const existing = await db.categories.get(id);
    await db.categories.delete(id);
    await queueSync('categories', id, 'delete', { uuid: existing && existing.uuid });
    await logAudit(Auth.current.id, 'CATEGORY_DELETED', 'id:' + id);
    Utils.toast(t('delete') + ' ✓', 'info');
    App.navigateTo('categories');
  }));
};

/* ============================================================================
   USER MANAGEMENT (Manager+; role-tier restrictions enforced)
   ========================================================================= */
Views.renderUsers = async function (container) {
  const users = await db.users.orderBy('createdAt').reverse().toArray();
  const currentIsSuperAdmin = Auth.isExactly('superadmin');

  const manageableUsers = currentIsSuperAdmin ? users : users.filter(u => ['user', 'entry'].includes(u.role));

  container.innerHTML = `
    <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
      <h1 class="text-xl font-bold text-slate-800">${t('manageUsers')}</h1>
      <button id="add-user-btn" class="btn btn-primary">+ ${t('addUser')}</button>
    </div>
    <div class="card p-0 overflow-hidden"><div class="overflow-x-auto">
      <table class="data-table">
        <thead><tr><th>${t('name')}</th><th>${t('username')}</th><th>${t('role')}</th><th>${t('flat')}</th><th>${t('status')}</th><th>${t('actions')}</th></tr></thead>
        <tbody>
          ${manageableUsers.length ? (await Promise.all(manageableUsers.map(async u => {
            const flat = u.flatId ? await db.flats.get(u.flatId) : null;
            const canEdit = currentIsSuperAdmin || ['user', 'entry'].includes(u.role);
            return `
            <tr>
              <td class="font-medium">${Utils.escapeHTML(u.name)}</td>
              <td class="text-slate-400">${Utils.escapeHTML(u.username)}</td>
              <td><span class="badge badge-blue">${Auth.roleLabel(u.role)}</span></td>
              <td>${flat ? Utils.escapeHTML(flat.flatNo) : '-'}</td>
              <td><span class="badge ${u.status === 'active' ? 'badge-green' : 'badge-red'}">${t(u.status)}</span></td>
              <td>
                <div class="flex gap-1 flex-wrap">
                  ${canEdit ? `<button data-id="${u.id}" class="edit-user-btn btn btn-secondary btn-sm">${t('edit')}</button>` : ''}
                  ${canEdit ? `<button data-id="${u.id}" class="reset-pw-btn btn btn-secondary btn-sm">${t('resetPw')}</button>` : ''}
                  ${canEdit && u.id !== Auth.current.id ? `<button data-id="${u.id}" data-status="${u.status}" class="toggle-status-btn btn ${u.status === 'active' ? 'btn-danger' : 'btn-success'} btn-sm">${u.status === 'active' ? t('disable') : t('enable')}</button>` : ''}
                </div>
              </td>
            </tr>`;
          }))).join('') : `<tr><td colspan="6" class="empty-state">${t('noUsersFound')}</td></tr>`}
        </tbody>
      </table>
    </div></div>
  `;

  const flats = await db.flats.toArray();

  const roleOptions = () => {
    const opts = currentIsSuperAdmin
      ? [['user','roleUser'],['entry','roleEntry'],['manager','roleManager'],['superadmin','roleSuperadmin']]
      : [['user','roleUser'],['entry','roleEntry']];
    return opts.map(([v,k]) => `<option value="${v}">${t(k)}</option>`).join('');
  };

  document.getElementById('add-user-btn').addEventListener('click', () => {
    App.openModal(t('addNewUser'), `
      <form id="user-form" class="space-y-3">
        <div><label class="form-label">${t('fullName')}</label><input required id="u-name" class="form-input" /></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="form-label">${t('username')}</label><input required id="u-username" class="form-input" /></div>
          <div><label class="form-label">${t('tempPassword')}</label><input required id="u-password" type="text" class="form-input" /></div>
        </div>
        <div><label class="form-label">${t('role')}</label><select id="u-role" class="form-select">${roleOptions()}</select></div>
        <div id="u-flat-wrap"><label class="form-label">${t('linkToFlat')}</label><select id="u-flat" class="form-select"><option value="">${t('none')}</option>${flats.map(f => `<option value="${f.id}">${Utils.escapeHTML(f.flatNo)}</option>`).join('')}</select></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="form-label">${t('phone')}</label><input id="u-phone" class="form-input" /></div>
          <div><label class="form-label">${t('email')}</label><input type="email" id="u-email" class="form-input" /></div>
        </div>
        <button type="submit" class="btn btn-primary w-full justify-center">${t('createUser')}</button>
      </form>`);
    document.getElementById('user-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('u-username').value.trim();
      const existing = await db.users.where('username').equalsIgnoreCase(username).first();
      if (existing) { Utils.toast(t('usernameExists'), 'error'); return; }
      const passwordHash = await hashPassword(username, document.getElementById('u-password').value);
      const rec = await withMeta('users', {
        name: document.getElementById('u-name').value.trim(), username, passwordHash,
        role: document.getElementById('u-role').value,
        flatId: document.getElementById('u-flat').value || null,
        phone: document.getElementById('u-phone').value.trim(),
        email: document.getElementById('u-email').value.trim(),
        status: 'active', createdAt: nowISO()
      });
      const id = await db.users.add(rec);
      await queueSync('users', id, 'create', rec);
      await logAudit(Auth.current.id, 'USER_CREATED', `${rec.username} (${rec.role})`);
      Utils.toast(t('createUser') + ' ✓');
      App.closeModal();
      App.navigateTo('users');
    });
  });

  container.querySelectorAll('.edit-user-btn').forEach(btn => btn.addEventListener('click', async () => {
    const u = await db.users.get(Number(btn.dataset.id));
    App.openModal(t('editUser'), `
      <form id="edit-user-form" class="space-y-3">
        <div><label class="form-label">${t('fullName')}</label><input required id="eu-name" class="form-input" value="${Utils.escapeHTML(u.name)}" /></div>
        <div><label class="form-label">${t('role')}</label><select id="eu-role" class="form-select">${roleOptions()}</select></div>
        <div><label class="form-label">${t('linkToFlat')}</label><select id="eu-flat" class="form-select"><option value="">${t('none')}</option>${flats.map(f => `<option value="${f.id}" ${u.flatId==f.id?'selected':''}>${Utils.escapeHTML(f.flatNo)}</option>`).join('')}</select></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="form-label">${t('phone')}</label><input id="eu-phone" class="form-input" value="${Utils.escapeHTML(u.phone||'')}" /></div>
          <div><label class="form-label">${t('email')}</label><input type="email" id="eu-email" class="form-input" value="${Utils.escapeHTML(u.email||'')}" /></div>
        </div>
        <button type="submit" class="btn btn-primary w-full justify-center">${t('saveChanges')}</button>
      </form>`);
    document.getElementById('eu-role').value = u.role;
    document.getElementById('edit-user-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const updates = await touch('users', {
        name: document.getElementById('eu-name').value.trim(),
        role: document.getElementById('eu-role').value,
        flatId: document.getElementById('eu-flat').value || null,
        phone: document.getElementById('eu-phone').value.trim(),
        email: document.getElementById('eu-email').value.trim(),
        uuid: u.uuid
      });
      await db.users.update(u.id, updates);
      await queueSync('users', u.id, 'update', updates);
      await logAudit(Auth.current.id, 'USER_UPDATED', u.username);
      Utils.toast(t('saveChanges') + ' ✓');
      App.closeModal();
      App.navigateTo('users');
    });
  }));

  container.querySelectorAll('.reset-pw-btn').forEach(btn => btn.addEventListener('click', async () => {
    const u = await db.users.get(Number(btn.dataset.id));
    App.openModal(`${t('resetPassword')} — ${u.username}`, `
      <form id="reset-pw-form" class="space-y-3">
        <div><label class="form-label">${t('newPasswordLabel')}</label><input required id="rp-new" minlength="4" class="form-input" /></div>
        <button type="submit" class="btn btn-primary w-full justify-center">${t('resetPassword')}</button>
      </form>`);
    document.getElementById('reset-pw-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await Auth.changePassword(u.id, document.getElementById('rp-new').value);
      Utils.toast(t('resetPassword') + ' ✓');
      App.closeModal();
    });
  }));

  container.querySelectorAll('.toggle-status-btn').forEach(btn => btn.addEventListener('click', async () => {
    const id = Number(btn.dataset.id);
    const newStatus = btn.dataset.status === 'active' ? 'disabled' : 'active';
    const ok = await Utils.confirmDialog(`${newStatus === 'disabled' ? t('disable') : t('enable')}?`);
    if (!ok) return;
    const existing = await db.users.get(id);
    const updates = await touch('users', { status: newStatus, uuid: existing.uuid });
    await db.users.update(id, updates);
    await queueSync('users', id, 'update', updates);
    await logAudit(Auth.current.id, 'USER_STATUS_CHANGED', `id:${id} -> ${newStatus}`);
    Utils.toast(t('saveChanges') + ' ✓');
    App.navigateTo('users');
  }));
};

/* ============================================================================
   BUILDING SETTINGS (Super Admin only)
   ========================================================================= */
Views.renderSettings = async function (container) {
  const s = await db.settings.get(1);

  container.innerHTML = `
    <h1 class="text-xl font-bold text-slate-800 mb-4">${t('buildingSettings')}</h1>
    <div class="border-b border-slate-200 flex gap-1 mb-5 overflow-x-auto" id="settings-tabs">
      <button data-tab="profile" class="tab-btn active">${t('buildingProfile')}</button>
      <button data-tab="firebase" class="tab-btn">${t('firebaseTab')}</button>
      <button data-tab="sync" class="tab-btn">${t('syncApi')}</button>
      <button data-tab="backup" class="tab-btn">${t('backupRestore')}</button>
      <button data-tab="danger" class="tab-btn">${t('dataManagement')}</button>
    </div>
    <div id="settings-body"></div>
  `;

  const renderProfileTab = () => {
    document.getElementById('settings-body').innerHTML = `
      <div class="card p-5 max-w-xl">
        <form id="profile-form" class="space-y-4">
          <div class="flex items-center gap-4">
            <img id="logo-preview" src="${s.logo || 'icons/icon-192.png'}" class="w-16 h-16 rounded-xl object-cover border border-slate-200" />
            <div>
              <label class="form-label mb-1">${t('buildingLogo')}</label>
              <input type="file" accept="image/*" id="logo-upload" class="text-xs" />
            </div>
          </div>
          <div><label class="form-label">${t('buildingProjectName')}</label><input required id="s-name" class="form-input" value="${Utils.escapeHTML(s.buildingName)}" /></div>
          <div><label class="form-label">${t('address')}</label><textarea id="s-address" rows="2" class="form-textarea">${Utils.escapeHTML(s.address)}</textarea></div>
          <div class="grid grid-cols-2 gap-3">
            <div><label class="form-label">${t('contactPhone')}</label><input id="s-contact" class="form-input" value="${Utils.escapeHTML(s.contact)}" /></div>
            <div><label class="form-label">${t('email')}</label><input type="email" id="s-email" class="form-input" value="${Utils.escapeHTML(s.email || '')}" /></div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div><label class="form-label">${t('currencyCode')}</label><input id="s-currency" class="form-input" value="${Utils.escapeHTML(s.currency)}" /></div>
            <div><label class="form-label">${t('currencySymbol')}</label><input id="s-symbol" class="form-input" value="${Utils.escapeHTML(s.currencySymbol)}" /></div>
          </div>
          <button type="submit" class="btn btn-primary w-full justify-center">${t('saveBuildingProfile')}</button>
        </form>
      </div>`;

    let newLogoBase64 = null;
    document.getElementById('logo-upload').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => { newLogoBase64 = reader.result; document.getElementById('logo-preview').src = newLogoBase64; };
      reader.readAsDataURL(file);
    });

    document.getElementById('profile-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const existing = await db.settings.get(1);
      const updates = await touch('settings', {
        buildingName: document.getElementById('s-name').value.trim(),
        address: document.getElementById('s-address').value.trim(),
        contact: document.getElementById('s-contact').value.trim(),
        email: document.getElementById('s-email').value.trim(),
        currency: document.getElementById('s-currency').value.trim(),
        currencySymbol: document.getElementById('s-symbol').value.trim(),
        uuid: existing.uuid
      });
      if (newLogoBase64) updates.logo = newLogoBase64;
      await db.settings.update(1, updates);
      await queueSync('settings', 1, 'update', updates);
      await logAudit(Auth.current.id, 'BUILDING_SETTINGS_UPDATED', 'Profile updated');
      await App.refreshSettingsCache();
      Utils.toast(t('saveBuildingProfile') + ' ✓');
      App.navigateTo('settings');
    });
  };

  const renderFirebaseTab = () => {
    const cfg = FirebaseSync._cfg(s);
    document.getElementById('settings-body').innerHTML = `
      <div class="card p-5 max-w-xl">
        <p class="text-sm text-slate-500 mb-4">${t('firebaseDesc')}</p>
        ${cfg ? `<div class="mb-4 text-sm bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-3 py-2">✓ ${t('firebaseConnected')}: <b>${Utils.escapeHTML(cfg.projectId)}</b>${s.firebaseEmail ? ' · ' + Utils.escapeHTML(s.firebaseEmail) : ''}</div>` : ''}
        <form id="firebase-form" class="space-y-4">
          <div><label class="form-label">${t('firebaseConfigLabel')}</label>
            <textarea id="fb-config" rows="7" class="form-textarea font-mono text-xs" placeholder='const firebaseConfig = {\n  apiKey: "...",\n  authDomain: "...",\n  projectId: "...",\n  storageBucket: "...",\n  messagingSenderId: "...",\n  appId: "..."\n};'>${cfg ? Utils.escapeHTML(JSON.stringify(cfg, null, 2)) : ''}</textarea></div>
          <div><label class="form-label">${t('firebaseEmail')}</label><input id="fb-email" type="email" required class="form-input" autocomplete="off" value="${Utils.escapeHTML(s.firebaseEmail || '')}" /></div>
          <div><label class="form-label">${t('firebasePassword')}</label><input id="fb-password" type="password" required class="form-input" autocomplete="new-password" /></div>
          <button type="submit" id="fb-submit" class="btn btn-primary w-full justify-center">${t('connectFirebase')}</button>
        </form>
        ${cfg ? `<button id="fb-disconnect" class="btn btn-danger w-full justify-center mt-3">${t('disconnectFirebase')}</button>` : ''}
      </div>`;

    document.getElementById('firebase-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('fb-submit');
      btn.disabled = true;
      try {
        const newCfg = FirebaseSync.parseConfig(document.getElementById('fb-config').value);
        const email = document.getElementById('fb-email').value.trim();
        await FirebaseSync.signIn(newCfg, email, document.getElementById('fb-password').value);
        await db.settings.update(1, { firebaseConfig: JSON.stringify(newCfg), firebaseEmail: email });
        await logAudit(Auth.current.id, 'FIREBASE_CONNECTED', newCfg.projectId);
        Utils.toast(t('firebaseSignedIn'));
        await SyncEngine.reconnect();
        App.navigateTo('settings');
      } catch (err) {
        if (err.message === 'PROJECT_CHANGED') {
          await db.settings.update(1, { firebaseConfig: JSON.stringify(FirebaseSync.parseConfig(document.getElementById('fb-config').value)), firebaseEmail: document.getElementById('fb-email').value.trim() });
          Utils.toast(t('firebaseReload'), 'info');
          setTimeout(() => location.reload(), 1200);
          return;
        }
        Utils.toast((err.code ? err.code + ' — ' : '') + err.message, 'error');
      } finally { btn.disabled = false; }
    });

    const dc = document.getElementById('fb-disconnect');
    if (dc) dc.addEventListener('click', async () => {
      await FirebaseSync.signOut();
      await db.settings.update(1, { firebaseConfig: '', firebaseEmail: '' });
      await logAudit(Auth.current.id, 'FIREBASE_DISCONNECTED', '');
      SyncEngine.needsFirebaseLogin = false;
      SyncEngine.updateStatusUI();
      App.navigateTo('settings');
    });
  };

  const renderSyncTab = () => {
    document.getElementById('settings-body').innerHTML = `
      <div class="card p-5 max-w-xl">
        <p class="text-sm text-slate-500 mb-4">${t('syncApiDesc')}</p>
        <form id="sync-form" class="space-y-4">
          <div><label class="form-label">${t('apiEndpointUrl')}</label><input id="s-endpoint" class="form-input" placeholder="https://your-api.example.com" value="${Utils.escapeHTML(s.apiEndpoint || '')}" /></div>
          <div><label class="form-label">${t('apiKeyOptional')}</label><input id="s-apikey" class="form-input" value="${Utils.escapeHTML(s.apiKey || '')}" /></div>
          <button type="submit" class="btn btn-primary w-full justify-center">${t('saveSyncSettings')}</button>
        </form>
      </div>`;
    document.getElementById('sync-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const updates = { apiEndpoint: document.getElementById('s-endpoint').value.trim(), apiKey: document.getElementById('s-apikey').value.trim() };
      await db.settings.update(1, updates);
      await logAudit(Auth.current.id, 'SYNC_SETTINGS_UPDATED', updates.apiEndpoint || '(cleared)');
      Utils.toast(t('saveSyncSettings') + ' ✓');
      await SyncEngine.reconnect();
    });
  };

  const renderBackupTab = () => {
    document.getElementById('settings-body').innerHTML = `
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-3xl">
        <div class="card p-5">
          <h3 class="font-semibold text-slate-800 mb-2">${t('exportBackup')}</h3>
          <p class="text-sm text-slate-500 mb-4">${t('exportBackupDesc')}</p>
          <button id="export-backup-btn" class="btn btn-primary w-full justify-center">⬇ ${t('downloadBackupJson')}</button>
          ${s.lastBackup ? `<p class="text-xs text-slate-400 mt-2">${t('lastBackup')}: ${Utils.dateTimeStr(s.lastBackup)}</p>` : ''}
        </div>
        <div class="card p-5">
          <h3 class="font-semibold text-slate-800 mb-2">${t('restoreFromBackup')}</h3>
          <p class="text-sm text-slate-500 mb-4">${t('restoreDesc')}</p>
          <input type="file" id="restore-file-input" accept=".json" class="form-input mb-3" />
          <button id="restore-backup-btn" class="btn btn-danger w-full justify-center">⬆ ${t('restoreFromFile')}</button>
        </div>
      </div>`;

    document.getElementById('export-backup-btn').addEventListener('click', async () => {
      const json = await SyncEngine.exportBackupJSON();
      Utils.downloadFile(`bms-backup-${Utils.todayInputValue()}.json`, json);
      await db.settings.update(1, { lastBackup: nowISO() });
      await logAudit(Auth.current.id, 'BACKUP_EXPORTED', '');
      Utils.toast(t('exportBackup') + ' ✓');
    });

    document.getElementById('restore-backup-btn').addEventListener('click', async () => {
      const fileInput = document.getElementById('restore-file-input');
      if (!fileInput.files[0]) { Utils.toast(t('chooseFileFirst'), 'error'); return; }
      const ok = await Utils.confirmDialog(t('restoreDesc'));
      if (!ok) return;
      const text = await fileInput.files[0].text();
      try {
        await SyncEngine.importBackupJSON(text);
        await logAudit(Auth.current.id, 'BACKUP_RESTORED', '');
        Utils.toast(t('restoreFromBackup') + ' ✓');
        setTimeout(() => location.reload(), 1200);
      } catch (err) {
        Utils.toast(t('invalidBackupFile') + ': ' + err.message, 'error');
      }
    });
  };

  const renderDangerTab = () => {
    document.getElementById('settings-body').innerHTML = `
      <div class="card p-5 max-w-xl border-rose-200">
        <h3 class="font-semibold text-rose-700 mb-2">⚠ ${t('dangerZone')}</h3>
        <p class="text-sm text-slate-500 mb-4">${t('dangerZoneDesc')}</p>
        <button id="factory-reset-btn" class="btn btn-danger">${t('fullDataReset')}</button>
      </div>`;
    document.getElementById('factory-reset-btn').addEventListener('click', async () => {
      const ok = await Utils.confirmDialog(t('dangerZoneDesc'));
      if (!ok) return;
      const ok2 = await Utils.confirmDialog(t('areYouSure'));
      if (!ok2) return;
      await db.transactions.clear();
      await db.duesSchedule.clear();
      await db.events.clear();
      await db.requests.clear();
      await db.notices.clear();
      await db.auditLogs.clear();
      await db.syncQueue.clear();
      await db.flats.clear();
      await db.assets.clear();
      await db.maintenanceLogs.clear();
      SyncEngine.resetAllCursors();
      const allUsers = await db.users.toArray();
      for (const u of allUsers) { if (u.id !== Auth.current.id) await db.users.delete(u.id); }
      Utils.toast(t('fullDataReset') + ' ✓', 'warning');
      setTimeout(() => location.reload(), 1200);
    });
  };

  const tabs = { profile: renderProfileTab, firebase: renderFirebaseTab, sync: renderSyncTab, backup: renderBackupTab, danger: renderDangerTab };
  document.querySelectorAll('#settings-tabs .tab-btn').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('#settings-tabs .tab-btn').forEach(b => b.classList.toggle('active', b === btn));
    tabs[btn.dataset.tab]();
  }));
  renderProfileTab();
};

/* ============================================================================
   AUDIT LOG (Super Admin only)
   ========================================================================= */
Views.renderAudit = async function (container) {
  const logs = await db.auditLogs.orderBy('timestamp').reverse().limit(500).toArray();
  const users = await db.users.toArray();
  const userMap = Object.fromEntries(users.map(u => [u.id, u.name]));

  container.innerHTML = `
    <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
      <h1 class="text-xl font-bold text-slate-800">${t('systemAuditLog')}</h1>
      <input id="audit-search" placeholder="${t('searchActions')}" class="form-input max-w-xs" />
    </div>
    <div class="card p-0 overflow-hidden"><div class="overflow-x-auto">
      <table class="data-table">
        <thead><tr><th>${t('timestamp')}</th><th>${t('user')}</th><th>${t('actions')}</th><th>${t('details')}</th></tr></thead>
        <tbody id="audit-tbody">
          ${logs.map(l => `<tr><td class="whitespace-nowrap">${Utils.dateTimeStr(l.timestamp)}</td><td>${Utils.escapeHTML(userMap[l.userId] || 'System')}</td><td><span class="badge badge-slate">${l.action}</span></td><td class="text-slate-500">${Utils.escapeHTML(l.details)}</td></tr>`).join('') || `<tr><td colspan="4" class="empty-state">${t('noAuditRecords')}</td></tr>`}
        </tbody>
      </table>
    </div></div>
  `;

  document.getElementById('audit-search').addEventListener('input', Utils.debounce((e) => {
    const q = e.target.value.toLowerCase();
    const filtered = logs.filter(l => (l.action + l.details + (userMap[l.userId] || '')).toLowerCase().includes(q));
    document.getElementById('audit-tbody').innerHTML = filtered.map(l => `<tr><td class="whitespace-nowrap">${Utils.dateTimeStr(l.timestamp)}</td><td>${Utils.escapeHTML(userMap[l.userId] || 'System')}</td><td><span class="badge badge-slate">${l.action}</span></td><td class="text-slate-500">${Utils.escapeHTML(l.details)}</td></tr>`).join('') || `<tr><td colspan="4" class="empty-state">${t('noMatchingRecords')}</td></tr>`;
  }, 250));
};
