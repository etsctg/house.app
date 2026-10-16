/* ============================================================================
   app.js — Core application: bootstrap, auth flow, router, navigation,
   dashboard, notices board, maintenance requests, and user profile.
   Fully bilingual (English / বাংলা) via the global t() helper from i18n.js.
   (Finance modules live in app-finance.js, reports in app-reports.js,
    admin modules in app-admin.js, inventory/assets in app-inventory.js —
    all loaded after this file.)
   ========================================================================= */

const App = {
  currentView: 'dashboard',
  settingsCache: null,

  // ---- Navigation configuration: { key, labelKey, icon, minRole, exactRoles? } --
  NAV: [
    { key: 'dashboard', labelKey: 'dashboard', minRole: 'user', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { key: 'notices', labelKey: 'notices', minRole: 'user', icon: 'M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
    { key: 'maintenance', labelKey: 'requests', minRole: 'user', icon: 'M11 4a2 2 0 114 0v1h2a2 2 0 012 2v2h-1a2 2 0 100 4h1v2a2 2 0 01-2 2h-2v-1a2 2 0 10-4 0v1H7a2 2 0 01-2-2v-2h1a2 2 0 100-4H5V7a2 2 0 012-2h2V4z' },
    { key: 'myledger', labelKey: 'myLedger', minRole: 'user', exactRoles: ['user'], icon: 'M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2' },
    { key: 'transactions', labelKey: 'incomeExpense', minRole: 'entry', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V6m0 2v8m0 0v2m0-2c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { key: 'collections', labelKey: 'collections', minRole: 'entry', icon: 'M17 9V7a4 4 0 00-8 0v2M5 9h14l1 12H4L5 9z' },
    { key: 'events', labelKey: 'eventsFunds', minRole: 'entry', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { key: 'ledger', labelKey: 'ownerLedger', minRole: 'entry', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l7-3 7 3z' },
    { key: 'inventory', labelKey: 'inventory', minRole: 'entry', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
    { key: 'reports', labelKey: 'reports', minRole: 'entry', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    { key: 'categories', labelKey: 'categories', minRole: 'manager', icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 10V5a2 2 0 012-2z' },
    { key: 'users', labelKey: 'manageUsers', minRole: 'manager', icon: 'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-2.13a4 4 0 10-4-4 4 4 0 004 4zm6 0a4 4 0 10-4-4' },
    { key: 'settings', labelKey: 'buildingSettings', minRole: 'superadmin', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
    { key: 'audit', labelKey: 'auditLog', minRole: 'superadmin', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { key: 'profile', labelKey: 'myProfile', minRole: 'user', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' }
  ],

  async init() {
    I18N.init();
    await seedDatabase();
    this.settingsCache = await db.settings.get(1);
    Utils.setCurrencySymbol(this.settingsCache.currencySymbol);
    this.applyBranding();
    SyncEngine.init();
    this.wireGlobalUI();

    if (Auth.restoreSession()) {
      const u = await db.users.get(Auth.current.id);
      if (u && u.status === 'active') {
        this.showApp();
        return;
      }
      Auth.logout();
    }
    this.showLogin();
  },

  applyBranding() {
    const s = this.settingsCache;
    document.getElementById('login-building-name').textContent = s.buildingName;
    document.getElementById('topbar-building-name').textContent = s.buildingName;
    document.title = s.buildingName + ' — Management System';
    if (s.logo) {
      const logoEl = document.getElementById('topbar-logo');
      logoEl.src = s.logo; logoEl.classList.remove('hidden');
    }
  },

  wireGlobalUI() {
    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('login-username').value.trim();
      const password = document.getElementById('login-password').value;
      const errEl = document.getElementById('login-error');
      errEl.classList.add('hidden');
      const result = await Auth.login(username, password);
      if (!result.ok) {
        errEl.textContent = result.message;
        errEl.classList.remove('hidden');
        return;
      }
      document.getElementById('login-form').reset();
      this.showApp();
    });

    document.getElementById('sidebar-toggle').addEventListener('click', () => this.toggleSidebar(true));
    document.getElementById('sidebar-backdrop').addEventListener('click', () => this.toggleSidebar(false));

    document.getElementById('user-menu-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('user-menu-dropdown').classList.toggle('hidden');
    });
    document.addEventListener('click', () => document.getElementById('user-menu-dropdown').classList.add('hidden'));

    document.getElementById('logout-btn').addEventListener('click', () => {
      Auth.logout();
      this.showLogin();
    });

    document.getElementById('manual-sync-btn').addEventListener('click', () => {
      Utils.toast(t('syncStarted'), 'info');
      SyncEngine.trigger();
    });

    document.getElementById('app-modal-close').addEventListener('click', () => this.closeModal());
    document.getElementById('app-modal').addEventListener('click', (e) => {
      if (e.target.id === 'app-modal') this.closeModal();
    });

    // Language toggle — both the topbar (in-app) and login-screen versions
    document.getElementById('lang-toggle-btn').addEventListener('click', () => I18N.toggle());
    document.getElementById('login-lang-toggle').addEventListener('click', () => I18N.toggle());

    SyncEngine.onStatusChange(() => {}); // UI already updated inside SyncEngine
  },

  toggleSidebar(open) {
    const sb = document.getElementById('sidebar');
    const bd = document.getElementById('sidebar-backdrop');
    if (open) { sb.classList.add('sidebar-open'); bd.classList.remove('hidden'); }
    else { sb.classList.remove('sidebar-open'); bd.classList.add('hidden'); }
  },

  showLogin() {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app-shell').classList.add('hidden');
  },

  async showApp() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-shell').classList.remove('hidden');
    document.getElementById('user-menu-name').textContent = Auth.current.name;
    document.getElementById('user-menu-role').textContent = Auth.roleLabel(Auth.current.role);
    document.getElementById('user-avatar').textContent = (Auth.current.name || '?').trim().charAt(0).toUpperCase();
    this.buildNav();
    this.navigateTo('dashboard');
    SyncEngine.updateStatusUI();
  },

  buildNav() {
    const visible = this.NAV.filter(n => Auth.hasRole(n.minRole) && (!n.exactRoles || n.exactRoles.includes(Auth.current.role)));
    const sideNav = document.getElementById('sidebar-nav');
    sideNav.innerHTML = visible.map(n => `
      <button data-view="${n.key}" class="nav-link w-full" id="nav-${n.key}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="${n.icon}"/></svg>
        <span>${t(n.labelKey)}</span>
      </button>`).join('');

    sideNav.querySelectorAll('[data-view]').forEach(btn => {
      btn.addEventListener('click', () => { this.navigateTo(btn.dataset.view); this.toggleSidebar(false); });
    });

    // Mobile bottom nav: first 4 items + "More" launches sidebar
    const bottomKeys = visible.slice(0, 4);
    const bottomNav = document.getElementById('mobile-bottom-nav');
    bottomNav.innerHTML = bottomKeys.map(n => `
      <button data-view="${n.key}" class="mobile-nav-btn flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-slate-500" id="mnav-${n.key}">
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="${n.icon}"/></svg>
        <span class="text-[10px] font-medium">${t(n.labelKey).split(' ')[0]}</span>
      </button>`).join('') + `
      <button id="mnav-more" class="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-slate-500">
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
        <span class="text-[10px] font-medium">${t('all')}</span>
      </button>`;
    bottomNav.querySelectorAll('[data-view]').forEach(btn => btn.addEventListener('click', () => this.navigateTo(btn.dataset.view)));
    document.getElementById('mnav-more').addEventListener('click', () => this.toggleSidebar(true));

    document.querySelectorAll('.nav-item-link').forEach(btn => {
      btn.addEventListener('click', () => this.navigateTo(btn.dataset.view));
    });

    this.markActiveNav(this.currentView);
  },

  markActiveNav(view) {
    document.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active'));
    document.getElementById('nav-' + view)?.classList.add('active');
    document.querySelectorAll('.mobile-nav-btn').forEach(b => b.classList.remove('text-brand-600'));
    document.getElementById('mnav-' + view)?.classList.add('text-brand-600');
  },

  async navigateTo(view) {
    const navItem = this.NAV.find(n => n.key === view);
    if (navItem && (!Auth.hasRole(navItem.minRole) || (navItem.exactRoles && !navItem.exactRoles.includes(Auth.current.role)))) {
      Utils.toast(t('permissionDenied'), 'error');
      return;
    }
    this.currentView = view;
    this.markActiveNav(view);
    const container = document.getElementById('view-container');
    container.innerHTML = `<div class="flex items-center justify-center py-24 text-slate-400"><svg class="animate-spin w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="10" stroke-opacity=".25"/><path d="M22 12a10 10 0 00-10-10"/></svg></div>`;

    const renderers = {
      dashboard: () => Views.renderDashboard(container),
      notices: () => Views.renderNotices(container),
      maintenance: () => Views.renderMaintenance(container),
      myledger: () => Views.renderMyLedger(container),
      transactions: () => Views.renderTransactions(container),
      collections: () => Views.renderCollections(container),
      events: () => Views.renderEvents(container),
      ledger: () => Views.renderLedger(container),
      inventory: () => Views.renderInventory(container),
      reports: () => Views.renderReports(container),
      categories: () => Views.renderCategories(container),
      users: () => Views.renderUsers(container),
      settings: () => Views.renderSettings(container),
      audit: () => Views.renderAudit(container),
      profile: () => Views.renderProfile(container)
    };
    try {
      await (renderers[view] || renderers.dashboard)();
    } catch (err) {
      console.error(err);
      container.innerHTML = `<div class="empty-state">${t('somethingWrong')}</div>`;
    }
  },

  openModal(title, bodyHTML) {
    document.getElementById('app-modal-title').textContent = title;
    document.getElementById('app-modal-body').innerHTML = bodyHTML;
    document.getElementById('app-modal').classList.remove('hidden');
  },
  closeModal() {
    document.getElementById('app-modal').classList.add('hidden');
    document.getElementById('app-modal-body').innerHTML = '';
  },

  async refreshSettingsCache() {
    this.settingsCache = await db.settings.get(1);
    Utils.setCurrencySymbol(this.settingsCache.currencySymbol);
    this.applyBranding();
  }
};

// A single shared namespace all view-render functions attach to.
// (app-finance.js, app-reports.js, app-admin.js and app-inventory.js extend this object.)
const Views = {};

/* ============================================================================
   DASHBOARD
   ========================================================================= */
Views.renderDashboard = async function (container) {
  const role = Auth.current.role;

  if (role === 'user') return Views._renderUserDashboard(container);

  const allTxns = await db.transactions.toArray();
  const now = new Date();
  const thisMonth = now.getMonth(); const thisYear = now.getFullYear();

  const monthTxns = allTxns.filter(t => { const d = new Date(t.date); return d.getMonth() === thisMonth && d.getFullYear() === thisYear; });
  const totalIncome = allTxns.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = allTxns.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  const monthIncome = monthTxns.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const monthExpense = monthTxns.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  const netBalance = totalIncome - totalExpense;

  const dues = await db.duesSchedule.toArray();
  const totalOutstanding = dues.reduce((s, d) => s + Math.max(0, d.dueAmount - d.paidAmount), 0);

  const pendingRequests = await db.requests.where('status').equals('pending').count();
  const flatsCount = await db.flats.count();
  const activeEvents = await db.events.where('status').equals('ongoing').count();

  const trendLabels = []; const trendIncome = []; const trendExpense = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(thisYear, thisMonth - i, 1);
    const label = Utils.monthName(d.getMonth() + 1).slice(0, 3) + " '" + String(d.getFullYear()).slice(2);
    trendLabels.push(label);
    const inc = allTxns.filter(t => { const td = new Date(t.date); return t.type === 'income' && td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear(); }).reduce((s, t) => s + Number(t.amount), 0);
    const exp = allTxns.filter(t => { const td = new Date(t.date); return t.type === 'expense' && td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear(); }).reduce((s, t) => s + Number(t.amount), 0);
    trendIncome.push(inc); trendExpense.push(exp);
  }

  const expByCat = {};
  monthTxns.filter(t => t.type === 'expense').forEach(t => { expByCat[t.category] = (expByCat[t.category] || 0) + Number(t.amount); });
  const catLabels = Object.keys(expByCat); const catData = Object.values(expByCat);

  const recentTxns = [...allTxns].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8);

  container.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <div>
        <h1 class="text-xl font-bold text-slate-800">${t('dashboard')}</h1>
        <p class="text-sm text-slate-500">${t('welcomeBack')}, ${Utils.escapeHTML(Auth.current.name)} — ${t('dashboardSubtitle')}</p>
      </div>
    </div>

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
      <div class="stat-card"><div class="text-xs text-slate-400 font-semibold">${t('netBalance').toUpperCase()}</div><div class="text-lg sm:text-2xl font-bold ${netBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'} mt-1">${Utils.money(netBalance)}</div></div>
      <div class="stat-card"><div class="text-xs text-slate-400 font-semibold">${t('thisMonthIncome').toUpperCase()}</div><div class="text-lg sm:text-2xl font-bold text-emerald-600 mt-1">${Utils.money(monthIncome)}</div></div>
      <div class="stat-card"><div class="text-xs text-slate-400 font-semibold">${t('thisMonthExpense').toUpperCase()}</div><div class="text-lg sm:text-2xl font-bold text-rose-600 mt-1">${Utils.money(monthExpense)}</div></div>
      <div class="stat-card"><div class="text-xs text-slate-400 font-semibold">${t('outstandingDues').toUpperCase()}</div><div class="text-lg sm:text-2xl font-bold text-amber-600 mt-1">${Utils.money(totalOutstanding)}</div></div>
    </div>

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
      <div class="stat-card flex items-center justify-between"><div><div class="text-xs text-slate-400 font-semibold">${t('totalFlats').toUpperCase()}</div><div class="text-xl font-bold mt-1">${flatsCount}</div></div></div>
      <div class="stat-card flex items-center justify-between"><div><div class="text-xs text-slate-400 font-semibold">${t('ongoingEvents').toUpperCase()}</div><div class="text-xl font-bold mt-1">${activeEvents}</div></div></div>
      <div class="stat-card flex items-center justify-between"><div><div class="text-xs text-slate-400 font-semibold">${t('pendingRequests').toUpperCase()}</div><div class="text-xl font-bold mt-1">${pendingRequests}</div></div></div>
      <div class="stat-card flex items-center justify-between"><div><div class="text-xs text-slate-400 font-semibold">${t('allTimeIncome').toUpperCase()}</div><div class="text-xl font-bold mt-1">${Utils.money(totalIncome)}</div></div></div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
      <div class="card p-4 lg:col-span-2">
        <h3 class="font-semibold text-sm text-slate-700 mb-3">${t('incomeVsExpenseTrend')}</h3>
        <div class="h-64"><canvas id="dashTrendChart"></canvas></div>
      </div>
      <div class="card p-4">
        <h3 class="font-semibold text-sm text-slate-700 mb-3">${t('expenseBreakdown')}</h3>
        <div class="h-64">${catLabels.length ? '<canvas id="dashCatChart"></canvas>' : `<div class="empty-state text-sm">${t('noExpenseRecorded')}</div>`}</div>
      </div>
    </div>

    <div class="card p-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-semibold text-sm text-slate-700">${t('recentTransactions')}</h3>
        <button data-view="transactions" class="nav-item-link text-xs text-brand-600 font-semibold hover:underline">${t('viewAll')} →</button>
      </div>
      <div class="overflow-x-auto">
        <table class="data-table">
          <thead><tr><th>${t('date')}</th><th>${t('voucher')}</th><th>${t('category')}</th><th>${t('type')}</th><th class="text-right">${t('amount')}</th></tr></thead>
          <tbody>
            ${recentTxns.length ? recentTxns.map(tx => `
              <tr>
                <td>${Utils.dateStr(tx.date)}</td>
                <td class="text-slate-400">${tx.voucherNo}</td>
                <td>${Utils.escapeHTML(tx.category)}</td>
                <td><span class="badge ${tx.type === 'income' ? 'badge-green' : 'badge-red'}">${tx.type === 'income' ? t('income') : t('expense')}</span></td>
                <td class="text-right font-semibold ${tx.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}">${tx.type === 'income' ? '+' : '-'}${Utils.money(tx.amount)}</td>
              </tr>`).join('') : `<tr><td colspan="5" class="empty-state">${t('noTransactionsYet')}</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
  container.querySelectorAll('.nav-item-link').forEach(btn => btn.addEventListener('click', () => App.navigateTo(btn.dataset.view)));

  if (typeof Chart !== 'undefined') {
    ChartsModule.incomeVsExpenseBar('dashTrendChart', trendLabels, trendIncome, trendExpense);
    if (catLabels.length) ChartsModule.categoryDoughnut('dashCatChart', catLabels, catData, ChartsModule.colorPalette(catLabels.length));
  }
};

Views._renderUserDashboard = async function (container) {
  const u = await db.users.get(Auth.current.id);
  const flat = u.flatId ? await db.flats.get(u.flatId) : null;
  const myTxns = flat ? await db.transactions.where('flatId').equals(flat.id).toArray() : [];
  const myDues = flat ? await db.duesSchedule.where('flatId').equals(flat.id).toArray() : [];
  const totalDue = myDues.reduce((s, d) => s + Number(d.dueAmount), 0);
  const totalPaid = myDues.reduce((s, d) => s + Number(d.paidAmount), 0);
  const balance = totalDue - totalPaid;
  const notices = await db.notices.orderBy('createdAt').reverse().limit(3).toArray();
  const myRequests = await db.requests.where('userId').equals(Auth.current.id).toArray();

  container.innerHTML = `
    <h1 class="text-xl font-bold text-slate-800 mb-1">${t('welcomeBack')}, ${Utils.escapeHTML(Auth.current.name)}</h1>
    <p class="text-sm text-slate-500 mb-5">${flat ? `${t('flat')} ${Utils.escapeHTML(flat.flatNo)}` : t('noFlatLinked')}</p>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
      <div class="stat-card"><div class="text-xs text-slate-400 font-semibold">${t('totalDue').toUpperCase()}</div><div class="text-xl font-bold mt-1">${Utils.money(totalDue)}</div></div>
      <div class="stat-card"><div class="text-xs text-slate-400 font-semibold">${t('totalPaid').toUpperCase()}</div><div class="text-xl font-bold text-emerald-600 mt-1">${Utils.money(totalPaid)}</div></div>
      <div class="stat-card"><div class="text-xs text-slate-400 font-semibold">${t('outstandingBalance').toUpperCase()}</div><div class="text-xl font-bold ${balance > 0 ? 'text-rose-600' : 'text-emerald-600'} mt-1">${Utils.money(balance)}</div></div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="card p-4">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-semibold text-sm text-slate-700">${t('latestNotices')}</h3>
          <button data-view="notices" class="nav-item-link text-xs text-brand-600 font-semibold hover:underline">${t('viewAll')} →</button>
        </div>
        ${notices.length ? notices.map(n => `
          <div class="border-b border-slate-100 last:border-0 py-2">
            <div class="font-medium text-sm text-slate-700">${Utils.escapeHTML(n.title)}</div>
            <div class="text-xs text-slate-400">${Utils.dateStr(n.createdAt)}</div>
          </div>`).join('') : `<div class="empty-state text-sm">${t('noNoticesYet')}</div>`}
      </div>
      <div class="card p-4">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-semibold text-sm text-slate-700">${t('myRecentPayments')}</h3>
          <button data-view="myledger" class="nav-item-link text-xs text-brand-600 font-semibold hover:underline">${t('fullHistory')} →</button>
        </div>
        ${myTxns.length ? [...myTxns].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,5).map(tx => `
          <div class="flex justify-between items-center border-b border-slate-100 last:border-0 py-2 text-sm">
            <div><div class="font-medium text-slate-700">${Utils.escapeHTML(tx.category)}</div><div class="text-xs text-slate-400">${Utils.dateStr(tx.date)}</div></div>
            <div class="font-semibold text-emerald-600">${Utils.money(tx.amount)}</div>
          </div>`).join('') : `<div class="empty-state text-sm">${t('noPaymentHistory')}</div>`}
      </div>
    </div>

    <div class="card p-4 mt-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-semibold text-sm text-slate-700">${t('myMaintenanceRequests')}</h3>
        <button data-view="maintenance" class="nav-item-link btn btn-primary btn-sm">+ ${t('newRequest')}</button>
      </div>
      ${myRequests.length ? myRequests.slice(0,5).map(r => `
        <div class="flex justify-between items-center border-b border-slate-100 last:border-0 py-2 text-sm">
          <div><div class="font-medium text-slate-700">${Utils.escapeHTML(r.subject)}</div><div class="text-xs text-slate-400">${Utils.dateStr(r.createdAt)}</div></div>
          <span class="badge ${r.status==='approved'?'badge-green':r.status==='rejected'?'badge-red':'badge-amber'}">${t(r.status)}</span>
        </div>`).join('') : `<div class="empty-state text-sm">${t('noRequestsSubmitted')}</div>`}
    </div>
  `;
  container.querySelectorAll('.nav-item-link').forEach(btn => btn.addEventListener('click', () => App.navigateTo(btn.dataset.view)));
};

/* ============================================================================
   NOTICES BOARD
   ========================================================================= */
Views.renderNotices = async function (container) {
  const notices = await db.notices.orderBy('createdAt').reverse().toArray();
  const canPost = Auth.hasRole('manager');

  container.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-xl font-bold text-slate-800">${t('buildingNotices')}</h1>
      ${canPost ? `<button id="add-notice-btn" class="btn btn-primary">+ ${t('postNotice')}</button>` : ''}
    </div>
    <div class="space-y-3" id="notices-list">
      ${notices.length ? notices.map(n => `
        <div class="card p-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="flex items-center gap-2">
                ${n.pinned ? `<span class="badge badge-amber">${t('pinned')}</span>` : ''}
                <h3 class="font-semibold text-slate-800">${Utils.escapeHTML(n.title)}</h3>
              </div>
              <p class="text-sm text-slate-600 mt-1.5 whitespace-pre-wrap">${Utils.escapeHTML(n.body)}</p>
              <div class="text-xs text-slate-400 mt-2">${t('postedBy')} ${Utils.escapeHTML(n.postedBy)} · ${Utils.dateTimeStr(n.createdAt)}</div>
            </div>
            ${canPost ? `<button data-id="${n.id}" class="del-notice-btn text-slate-300 hover:text-rose-500 shrink-0">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>` : ''}
          </div>
        </div>`).join('') : `<div class="empty-state">${t('noNoticesPosted')}</div>`}
    </div>
  `;

  if (canPost) {
    document.getElementById('add-notice-btn').addEventListener('click', () => {
      App.openModal(t('postNewNotice'), `
        <form id="notice-form" class="space-y-4">
          <div><label class="form-label">${t('title')}</label><input required id="notice-title" class="form-input" placeholder="e.g. Water supply maintenance on Sunday" /></div>
          <div><label class="form-label">${t('details')}</label><textarea required id="notice-body" rows="4" class="form-textarea"></textarea></div>
          <label class="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" id="notice-pinned" class="rounded" /> ${t('pinToTop')}</label>
          <button type="submit" class="btn btn-primary w-full justify-center">${t('postNotice')}</button>
        </form>`);
      document.getElementById('notice-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const rec = await withMeta('notices', {
          title: document.getElementById('notice-title').value.trim(),
          body: document.getElementById('notice-body').value.trim(),
          pinned: document.getElementById('notice-pinned').checked ? 1 : 0,
          postedBy: Auth.current.name,
          createdAt: nowISO()
        });
        const id = await db.notices.add(rec);
        await queueSync('notices', id, 'create', rec);
        await logAudit(Auth.current.id, 'NOTICE_POSTED', rec.title);
        Utils.toast(t('postNotice') + ' ✓');
        App.closeModal();
        App.navigateTo('notices');
      });
    });

    container.querySelectorAll('.del-notice-btn').forEach(btn => btn.addEventListener('click', async () => {
      const ok = await Utils.confirmDialog(t('deleteNoticeConfirm'));
      if (!ok) return;
      const id = Number(btn.dataset.id);
      const existing = await db.notices.get(id);
      await db.notices.delete(id);
      await queueSync('notices', id, 'delete', { uuid: existing && existing.uuid });
      await logAudit(Auth.current.id, 'NOTICE_DELETED', 'id:' + id);
      Utils.toast(t('delete') + ' ✓', 'info');
      App.navigateTo('notices');
    }));
  }
};

/* ============================================================================
   MAINTENANCE / FEEDBACK REQUESTS
   ========================================================================= */
Views.renderMaintenance = async function (container) {
  const isManager = Auth.hasRole('manager');
  const allRequests = isManager ? await db.requests.orderBy('createdAt').reverse().toArray()
                                 : await db.requests.where('userId').equals(Auth.current.id).reverse().sortBy('createdAt');

  const statusBadge = (s) => s === 'approved' ? 'badge-green' : s === 'rejected' ? 'badge-red' : 'badge-amber';

  container.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-xl font-bold text-slate-800">${isManager ? t('allRequestsTitle') : t('myRequestsTitle')}</h1>
      <button id="new-request-btn" class="btn btn-primary">+ ${t('newRequest')}</button>
    </div>
    <div class="space-y-3">
      ${allRequests.length ? allRequests.map(r => `
        <div class="card p-4">
          <div class="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <span class="badge ${r.priority === 'high' ? 'badge-red' : r.priority === 'medium' ? 'badge-amber' : 'badge-slate'}">${t(r.priority)}</span>
                <h3 class="font-semibold text-slate-800">${Utils.escapeHTML(r.subject)}</h3>
              </div>
              <p class="text-sm text-slate-600 mt-1.5">${Utils.escapeHTML(r.description)}</p>
              ${r.response ? `<div class="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mt-2 text-slate-600"><b>${t('response')}:</b> ${Utils.escapeHTML(r.response)}</div>` : ''}
              <div class="text-xs text-slate-400 mt-2">${isManager ? `${Utils.escapeHTML(r.userName)} · ` : ''}${Utils.dateTimeStr(r.createdAt)}</div>
            </div>
            <div class="flex flex-col items-end gap-2 shrink-0">
              <span class="badge ${statusBadge(r.status)}">${t(r.status)}</span>
              ${isManager && r.status === 'pending' ? `
                <div class="flex gap-1">
                  <button data-id="${r.id}" class="approve-req-btn btn btn-success btn-sm">${t('approve')}</button>
                  <button data-id="${r.id}" class="reject-req-btn btn btn-danger btn-sm">${t('reject')}</button>
                </div>` : ''}
            </div>
          </div>
        </div>`).join('') : `<div class="empty-state">${t('noRequestsFound')}</div>`}
    </div>
  `;

  document.getElementById('new-request-btn').addEventListener('click', () => {
    App.openModal(t('submitRequest'), `
      <form id="request-form" class="space-y-4">
        <div><label class="form-label">${t('subject')}</label><input required id="req-subject" class="form-input" /></div>
        <div><label class="form-label">${t('priority')}</label>
          <select id="req-priority" class="form-select"><option value="low">${t('low')}</option><option value="medium" selected>${t('medium')}</option><option value="high">${t('high')}</option></select>
        </div>
        <div><label class="form-label">${t('description')}</label><textarea required id="req-description" rows="4" class="form-textarea"></textarea></div>
        <button type="submit" class="btn btn-primary w-full justify-center">${t('submit')}</button>
      </form>`);
    document.getElementById('request-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const rec = await withMeta('requests', {
        userId: Auth.current.id, userName: Auth.current.name, flatId: Auth.current.flatId || null,
        subject: document.getElementById('req-subject').value.trim(),
        priority: document.getElementById('req-priority').value,
        description: document.getElementById('req-description').value.trim(),
        status: 'pending', response: '', createdAt: nowISO()
      });
      const id = await db.requests.add(rec);
      await queueSync('requests', id, 'create', rec);
      await logAudit(Auth.current.id, 'REQUEST_SUBMITTED', rec.subject);
      Utils.toast(t('submit') + ' ✓');
      App.closeModal();
      App.navigateTo('maintenance');
    });
  });

  if (isManager) {
    container.querySelectorAll('.approve-req-btn, .reject-req-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.dataset.id);
        const approve = btn.classList.contains('approve-req-btn');
        const response = prompt(`${approve ? t('approve') : t('reject')} — ${t('response')} (${t('optional')}):`) || '';
        const existing = await db.requests.get(id);
        const updates = await touch('requests', { status: approve ? 'approved' : 'rejected', response, uuid: existing.uuid });
        await db.requests.update(id, updates);
        await queueSync('requests', id, 'update', updates);
        await logAudit(Auth.current.id, approve ? 'REQUEST_APPROVED' : 'REQUEST_REJECTED', 'id:' + id);
        Utils.toast(`${approve ? t('approve') : t('reject')} ✓`, approve ? 'success' : 'warning');
        App.navigateTo('maintenance');
      });
    });
  }
};

/* ============================================================================
   MY LEDGER (for 'user' role — personal payment history & summary)
   ========================================================================= */
Views.renderMyLedger = async function (container) {
  const u = await db.users.get(Auth.current.id);
  const flat = u.flatId ? await db.flats.get(u.flatId) : null;

  if (!flat) {
    container.innerHTML = `<div class="empty-state">${t('noFlatContactAdmin')}</div>`;
    return;
  }

  const dues = await db.duesSchedule.where('flatId').equals(flat.id).sortBy('year');
  const txns = await db.transactions.where('flatId').equals(flat.id).reverse().sortBy('date');
  const totalDue = dues.reduce((s, d) => s + Number(d.dueAmount), 0);
  const totalPaid = dues.reduce((s, d) => s + Number(d.paidAmount), 0);

  container.innerHTML = `
    <h1 class="text-xl font-bold text-slate-800 mb-1">${t('myLedgerTitle')} — ${t('flat')} ${Utils.escapeHTML(flat.flatNo)}</h1>
    <p class="text-sm text-slate-500 mb-5">${t('ledgerStatementSubtitle')}</p>

    <div class="grid grid-cols-3 gap-3 sm:gap-4 mb-5">
      <div class="stat-card"><div class="text-xs text-slate-400 font-semibold">${t('totalDue').toUpperCase()}</div><div class="text-lg sm:text-xl font-bold mt-1">${Utils.money(totalDue)}</div></div>
      <div class="stat-card"><div class="text-xs text-slate-400 font-semibold">${t('totalPaid').toUpperCase()}</div><div class="text-lg sm:text-xl font-bold text-emerald-600 mt-1">${Utils.money(totalPaid)}</div></div>
      <div class="stat-card"><div class="text-xs text-slate-400 font-semibold">${t('balance').toUpperCase()}</div><div class="text-lg sm:text-xl font-bold ${(totalDue-totalPaid)>0?'text-rose-600':'text-emerald-600'} mt-1">${Utils.money(totalDue - totalPaid)}</div></div>
    </div>

    <div class="card p-4 mb-4">
      <h3 class="font-semibold text-sm text-slate-700 mb-3">${t('monthlyDuesSchedule')}</h3>
      <div class="overflow-x-auto">
        <table class="data-table">
          <thead><tr><th>${t('period')}</th><th class="text-right">${t('due')}</th><th class="text-right">${t('paid')}</th><th class="text-right">${t('balance')}</th><th>${t('status')}</th></tr></thead>
          <tbody>
            ${dues.length ? dues.map(d => `
              <tr>
                <td>${Utils.monthName(d.month)} ${d.year}</td>
                <td class="text-right">${Utils.money(d.dueAmount)}</td>
                <td class="text-right">${Utils.money(d.paidAmount)}</td>
                <td class="text-right font-semibold">${Utils.money(d.dueAmount - d.paidAmount)}</td>
                <td><span class="badge ${d.status==='paid'?'badge-green':d.status==='partial'?'badge-amber':'badge-red'}">${t(d.status)}</span></td>
              </tr>`).join('') : `<tr><td colspan="5" class="empty-state">${t('noDuesGenerated')}</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card p-4">
      <h3 class="font-semibold text-sm text-slate-700 mb-3">${t('paymentHistory')}</h3>
      <div class="overflow-x-auto">
        <table class="data-table">
          <thead><tr><th>${t('date')}</th><th>${t('voucher')}</th><th>${t('category')}</th><th>${t('method')}</th><th class="text-right">${t('amount')}</th></tr></thead>
          <tbody>
            ${txns.length ? txns.map(tx => `
              <tr>
                <td>${Utils.dateStr(tx.date)}</td><td class="text-slate-400">${tx.voucherNo}</td>
                <td>${Utils.escapeHTML(tx.category)}</td><td>${Utils.escapeHTML(tx.method || '-')}</td>
                <td class="text-right font-semibold text-emerald-600">${Utils.money(tx.amount)}</td>
              </tr>`).join('') : `<tr><td colspan="5" class="empty-state">${t('noPaymentsRecorded')}</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
};

/* ============================================================================
   PROFILE
   ========================================================================= */
Views.renderProfile = async function (container) {
  const u = await db.users.get(Auth.current.id);
  const flat = u.flatId ? await db.flats.get(u.flatId) : null;

  container.innerHTML = `
    <h1 class="text-xl font-bold text-slate-800 mb-5">${t('myProfile')}</h1>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="card p-5">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-14 h-14 rounded-full bg-brand-600 text-white flex items-center justify-center text-xl font-bold">${u.name.charAt(0).toUpperCase()}</div>
          <div>
            <div class="font-bold text-slate-800">${Utils.escapeHTML(u.name)}</div>
            <div class="text-xs text-slate-400">${Auth.roleLabel(u.role)}</div>
          </div>
        </div>
        <dl class="text-sm space-y-2 text-slate-600">
          <div class="flex justify-between"><dt class="text-slate-400">${t('username')}</dt><dd>${Utils.escapeHTML(u.username)}</dd></div>
          <div class="flex justify-between"><dt class="text-slate-400">${t('email')}</dt><dd>${Utils.escapeHTML(u.email || '-')}</dd></div>
          <div class="flex justify-between"><dt class="text-slate-400">${t('phone')}</dt><dd>${Utils.escapeHTML(u.phone || '-')}</dd></div>
          ${flat ? `<div class="flex justify-between"><dt class="text-slate-400">${t('flat')}</dt><dd>${Utils.escapeHTML(flat.flatNo)}</dd></div>` : ''}
          <div class="flex justify-between"><dt class="text-slate-400">${t('memberSince')}</dt><dd>${Utils.dateStr(u.createdAt)}</dd></div>
        </dl>
      </div>
      <div class="card p-5">
        <h3 class="font-semibold text-sm text-slate-700 mb-3">${t('changePassword')}</h3>
        <form id="change-password-form" class="space-y-3">
          <div><label class="form-label">${t('currentPassword')}</label><input required type="password" id="cp-current" class="form-input" /></div>
          <div><label class="form-label">${t('newPassword')}</label><input required type="password" id="cp-new" minlength="4" class="form-input" /></div>
          <div><label class="form-label">${t('confirmNewPassword')}</label><input required type="password" id="cp-confirm" minlength="4" class="form-input" /></div>
          <button type="submit" class="btn btn-primary w-full justify-center">${t('updatePassword')}</button>
        </form>
      </div>
    </div>
  `;

  document.getElementById('change-password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const cur = document.getElementById('cp-current').value;
    const next = document.getElementById('cp-new').value;
    const confirm = document.getElementById('cp-confirm').value;
    if (next !== confirm) { Utils.toast(t('passwordsMismatch'), 'error'); return; }
    const curHash = await hashPassword(u.username, cur);
    if (curHash !== u.passwordHash) { Utils.toast(t('incorrectCurrentPassword'), 'error'); return; }
    await Auth.changePassword(u.id, next);
    Utils.toast(t('updatePassword') + ' ✓');
    document.getElementById('change-password-form').reset();
  });
};

document.addEventListener('DOMContentLoaded', () => App.init());

// Register service worker for offline functionality
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW registration failed:', err));
  });
}
