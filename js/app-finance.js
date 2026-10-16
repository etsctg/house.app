/* ============================================================================
   app-finance.js — Income/Expense Transactions, Flat Collections,
   Event Fund Management, and Owner/Shareholder Ledger.
   Fully bilingual via the global t() helper.
   ========================================================================= */

/* ---------------------------------------------------------------------------
   Shared: create a transaction record (used by transactions + collections)
   ------------------------------------------------------------------------ */
async function createTransaction(data) {
  const rec = await withMeta('transactions', {
    uuid: genUUID(),
    type: data.type,
    category: data.category,
    amount: Number(data.amount),
    date: data.date,
    description: data.description || '',
    method: data.method || 'Cash',
    payerOrPayee: data.payerOrPayee || '',
    flatId: data.flatId || null,
    flatNo: data.flatNo || '',
    eventId: data.eventId || null,
    duesId: data.duesId || null,
    voucherNo: Utils.voucherNo(data.type === 'income' ? 'RCT' : 'PAY'),
    createdBy: Auth.current.id,
    createdByName: Auth.current.name,
    synced: 0,
    createdAt: nowISO()
  });
  const id = await db.transactions.add(rec);
  rec.id = id;
  await queueSync('transactions', id, 'create', rec);
  await logAudit(Auth.current.id, data.type === 'income' ? 'INCOME_RECORDED' : 'EXPENSE_RECORDED', `${rec.voucherNo} — ${Utils.money(rec.amount)} (${rec.category})`);
  return rec;
}

const METHOD_KEYS = ['cash', 'bankTransfer', 'mobileBanking', 'cheque', 'card'];
const METHOD_VALUES = ['Cash', 'Bank Transfer', 'Mobile Banking', 'Cheque', 'Card'];
function methodOptionsHTML(selected) {
  return METHOD_VALUES.map((v, i) => `<option value="${v}" ${v === selected ? 'selected' : ''}>${t(METHOD_KEYS[i])}</option>`).join('');
}

/* ============================================================================
   TRANSACTIONS (Income & Expense entry + ledger list)
   ========================================================================= */
Views.renderTransactions = async function (container) {
  const categories = await db.categories.toArray();
  const flats = await db.flats.toArray();
  const events = await db.events.toArray();

  container.innerHTML = `
    <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
      <h1 class="text-xl font-bold text-slate-800">${t('incomeExpense')}</h1>
      <div class="flex gap-2">
        <button id="add-income-btn" class="btn btn-success">+ ${t('addIncome')}</button>
        <button id="add-expense-btn" class="btn btn-danger">+ ${t('addExpense')}</button>
      </div>
    </div>

    <div class="card p-3 mb-4 flex flex-wrap gap-2 items-end">
      <div><label class="form-label">${t('type')}</label><select id="f-type" class="form-select"><option value="">${t('all')}</option><option value="income">${t('income')}</option><option value="expense">${t('expense')}</option></select></div>
      <div><label class="form-label">${t('category')}</label><select id="f-category" class="form-select"><option value="">${t('all')}</option>${categories.map(c => `<option value="${Utils.escapeHTML(c.name)}">${Utils.escapeHTML(c.name)}</option>`).join('')}</select></div>
      <div><label class="form-label">${t('from')}</label><input type="date" id="f-from" class="form-input" /></div>
      <div><label class="form-label">${t('to')}</label><input type="date" id="f-to" class="form-input" /></div>
      <div><label class="form-label">${t('search')}</label><input type="text" id="f-search" placeholder="${t('voucher')}..." class="form-input" /></div>
      <button id="f-apply" class="btn btn-secondary">${t('filter')}</button>
      <button id="f-export" class="btn btn-secondary ml-auto">⬇ ${t('exportCsv')}</button>
    </div>

    <div class="card p-0 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="data-table" id="txn-table">
          <thead><tr><th>${t('date')}</th><th>${t('voucher')}</th><th>${t('type')}</th><th>${t('category')}</th><th>${t('flatOrEvent')}</th><th>${t('method')}</th><th class="text-right">${t('amount')}</th><th>${t('print')}</th></tr></thead>
          <tbody id="txn-tbody"></tbody>
        </table>
      </div>
    </div>
  `;

  const loadRows = async () => {
    let txns = await db.transactions.orderBy('date').reverse().toArray();
    const type = document.getElementById('f-type').value;
    const cat = document.getElementById('f-category').value;
    const from = document.getElementById('f-from').value;
    const to = document.getElementById('f-to').value;
    const search = document.getElementById('f-search').value.toLowerCase();
    if (type) txns = txns.filter(t => t.type === type);
    if (cat) txns = txns.filter(t => t.category === cat);
    if (from) txns = txns.filter(t => t.date >= from);
    if (to) txns = txns.filter(t => t.date <= to);
    if (search) txns = txns.filter(t => (t.voucherNo + t.description + (t.payerOrPayee||'')).toLowerCase().includes(search));

    const tbody = document.getElementById('txn-tbody');
    tbody.innerHTML = txns.length ? txns.map(tx => `
      <tr>
        <td>${Utils.dateStr(tx.date)}</td>
        <td class="text-slate-400">${tx.voucherNo}</td>
        <td><span class="badge ${tx.type === 'income' ? 'badge-green' : 'badge-red'}">${tx.type === 'income' ? t('income') : t('expense')}</span></td>
        <td>${Utils.escapeHTML(tx.category)}</td>
        <td>${Utils.escapeHTML(tx.flatNo || (tx.eventId ? '(event)' : '-'))}</td>
        <td>${Utils.escapeHTML(tx.method)}</td>
        <td class="text-right font-semibold ${tx.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}">${Utils.money(tx.amount)}</td>
        <td>
          <div class="flex gap-1">
            <button data-id="${tx.id}" class="print-thermal-btn btn btn-secondary btn-sm" title="${t('printThermalReceipt')}">🧾</button>
            <button data-id="${tx.id}" class="print-a4-btn btn btn-secondary btn-sm" title="A4">📄</button>
            ${Auth.hasRole('manager') ? `<button data-id="${tx.id}" class="del-txn-btn btn btn-danger btn-sm" title="${t('delete')}">✕</button>` : ''}
          </div>
        </td>
      </tr>`).join('') : `<tr><td colspan="8" class="empty-state">${t('noTxnMatch')}</td></tr>`;

    tbody.querySelectorAll('.print-thermal-btn').forEach(b => b.addEventListener('click', async () => {
      const tx = await db.transactions.get(Number(b.dataset.id));
      openThermalSizeChooser(tx);
    }));
    tbody.querySelectorAll('.print-a4-btn').forEach(b => b.addEventListener('click', async () => {
      const tx = await db.transactions.get(Number(b.dataset.id));
      PrintModule.printVoucherA4(tx);
    }));
    tbody.querySelectorAll('.del-txn-btn').forEach(b => b.addEventListener('click', async () => {
      const ok = await Utils.confirmDialog(t('deleteTxnConfirm'));
      if (!ok) return;
      const id = Number(b.dataset.id);
      const existing = await db.transactions.get(id);
      await db.transactions.delete(id);
      await queueSync('transactions', id, 'delete', { uuid: existing && existing.uuid });
      await logAudit(Auth.current.id, 'TRANSACTION_DELETED', 'id:' + id);
      Utils.toast(t('delete') + ' ✓', 'info');
      loadRows();
    }));

    return txns;
  };

  document.getElementById('f-apply').addEventListener('click', loadRows);
  document.getElementById('f-export').addEventListener('click', async () => {
    const txns = await loadRows();
    Utils.exportCSV('transactions.csv', txns.map(tx => [tx.date, tx.voucherNo, tx.type, tx.category, tx.flatNo || '', tx.method, tx.amount, tx.description]),
      ['Date', 'Voucher', 'Type', 'Category', 'Flat', 'Method', 'Amount', 'Description']);
  });

  document.getElementById('add-income-btn').addEventListener('click', () => openTransactionForm('income', categories, flats, events, loadRows));
  document.getElementById('add-expense-btn').addEventListener('click', () => openTransactionForm('expense', categories, flats, events, loadRows));

  await loadRows();
};

function openThermalSizeChooser(txn) {
  App.openModal(t('printThermalReceipt'), `
    <p class="text-sm text-slate-600 mb-4">${t('choosePaperSize')}</p>
    <div class="flex gap-3">
      <button id="thermal-58-btn" class="btn btn-secondary flex-1 justify-center">58mm</button>
      <button id="thermal-80-btn" class="btn btn-primary flex-1 justify-center">80mm</button>
    </div>`);
  document.getElementById('thermal-58-btn').addEventListener('click', () => { PrintModule.printVoucherThermal(txn, '58mm'); App.closeModal(); });
  document.getElementById('thermal-80-btn').addEventListener('click', () => { PrintModule.printVoucherThermal(txn, '80mm'); App.closeModal(); });
}

function openTransactionForm(type, categories, flats, events, onDone) {
  const cats = categories.filter(c => c.type === type);
  App.openModal(type === 'income' ? t('recordNewIncome') : t('recordNewExpense'), `
    <form id="txn-form" class="space-y-4">
      <div class="grid grid-cols-2 gap-3">
        <div><label class="form-label">${t('date')}</label><input required type="date" id="t-date" value="${Utils.todayInputValue()}" class="form-input" /></div>
        <div><label class="form-label">${t('amount')}</label><input required type="number" min="0.01" step="0.01" id="t-amount" class="form-input" placeholder="0.00" /></div>
      </div>
      <div><label class="form-label">${t('category')}</label>
        <select required id="t-category" class="form-select">
          <option value="">${t('category')}</option>
          ${cats.map(c => `<option value="${Utils.escapeHTML(c.name)}">${Utils.escapeHTML(c.name)}</option>`).join('')}
        </select>
      </div>
      <div><label class="form-label">${type === 'income' ? t('receivedFrom') : t('paidTo')}</label><input id="t-payer" class="form-input" placeholder="${t('optional')}" /></div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="form-label">${t('relatedFlatOptional')}</label>
          <select id="t-flat" class="form-select"><option value="">${t('none')}</option>${flats.map(f => `<option value="${f.id}">${Utils.escapeHTML(f.flatNo)}</option>`).join('')}</select>
        </div>
        <div><label class="form-label">${t('relatedEventOptional')}</label>
          <select id="t-event" class="form-select"><option value="">${t('none')}</option>${events.map(ev => `<option value="${ev.id}">${Utils.escapeHTML(ev.name)}</option>`).join('')}</select>
        </div>
      </div>
      <div><label class="form-label">${t('method')}</label>
        <select id="t-method" class="form-select">${methodOptionsHTML('Cash')}</select>
      </div>
      <div><label class="form-label">${t('description')}</label><textarea id="t-description" rows="2" class="form-textarea" placeholder="${t('notes')}"></textarea></div>
      <button type="submit" class="btn ${type === 'income' ? 'btn-success' : 'btn-danger'} w-full justify-center">${type === 'income' ? t('saveIncome') : t('saveExpense')}</button>
    </form>`);

  document.getElementById('txn-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const flatId = document.getElementById('t-flat').value;
    const flat = flatId ? flats.find(f => f.id == flatId) : null;
    const rec = await createTransaction({
      type, category: document.getElementById('t-category').value,
      amount: document.getElementById('t-amount').value,
      date: document.getElementById('t-date').value,
      description: document.getElementById('t-description').value.trim(),
      payerOrPayee: document.getElementById('t-payer').value.trim(),
      method: document.getElementById('t-method').value,
      flatId: flatId || null, flatNo: flat ? flat.flatNo : '',
      eventId: document.getElementById('t-event').value || null
    });
    Utils.toast(`${type === 'income' ? t('income') : t('expense')} — ${rec.voucherNo} ✓`);
    App.closeModal();
    if (onDone) onDone();
  });
}

/* ============================================================================
   COLLECTIONS — Flat maintenance/rent dues generation & collection
   ========================================================================= */
Views.renderCollections = async function (container) {
  const now = new Date();
  container.innerHTML = `
    <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
      <h1 class="text-xl font-bold text-slate-800">${t('flatCollectionsDues')}</h1>
      <div class="flex gap-2 items-end flex-wrap">
        <div><label class="form-label">${t('month')}</label>
          <select id="col-month" class="form-select">${Array.from({length:12},(_,i)=>`<option value="${i+1}" ${i+1===now.getMonth()+1?'selected':''}>${Utils.monthName(i+1)}</option>`).join('')}</select>
        </div>
        <div><label class="form-label">${t('year')}</label><input type="number" id="col-year" value="${now.getFullYear()}" class="form-input w-24" /></div>
        <button id="generate-dues-btn" class="btn btn-primary">${t('generateDues')}</button>
      </div>
    </div>
    <div class="card p-0 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="data-table">
          <thead><tr><th>${t('flat')}</th><th>${t('owner')}</th><th class="text-right">${t('due')}</th><th class="text-right">${t('paid')}</th><th class="text-right">${t('balance')}</th><th>${t('status')}</th><th>${t('action')}</th></tr></thead>
          <tbody id="col-tbody"></tbody>
        </table>
      </div>
    </div>
  `;

  const loadRows = async () => {
    const month = Number(document.getElementById('col-month').value);
    const year = Number(document.getElementById('col-year').value);
    const flats = await db.flats.toArray();
    const duesAll = await db.duesSchedule.toArray();
    const duesFiltered = duesAll.filter(d => d.month === month && d.year === year);
    const tbody = document.getElementById('col-tbody');

    if (!duesFiltered.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-state">${t('noDuesForPeriod')}</td></tr>`;
      return;
    }

    tbody.innerHTML = duesFiltered.map(d => {
      const flat = flats.find(f => f.id === d.flatId);
      const balance = d.dueAmount - d.paidAmount;
      return `
      <tr>
        <td class="font-medium">${flat ? Utils.escapeHTML(flat.flatNo) : '—'}</td>
        <td>${flat ? Utils.escapeHTML(flat.ownerName) : '—'}</td>
        <td class="text-right">${Utils.money(d.dueAmount)}</td>
        <td class="text-right">${Utils.money(d.paidAmount)}</td>
        <td class="text-right font-semibold">${Utils.money(balance)}</td>
        <td><span class="badge ${d.status === 'paid' ? 'badge-green' : d.status === 'partial' ? 'badge-amber' : 'badge-red'}">${t(d.status)}</span></td>
        <td>${balance > 0 ? `<button data-id="${d.id}" class="collect-btn btn btn-success btn-sm">${t('collect')}</button>` : `<span class="text-emerald-600 text-xs font-semibold">✓ ${t('settled')}</span>`}</td>
      </tr>`;
    }).join('');

    tbody.querySelectorAll('.collect-btn').forEach(btn => btn.addEventListener('click', async () => {
      const due = duesFiltered.find(d => d.id === Number(btn.dataset.id));
      const flat = flats.find(f => f.id === due.flatId);
      openCollectPaymentModal(due, flat, loadRows);
    }));
  };

  document.getElementById('generate-dues-btn').addEventListener('click', async () => {
    const month = Number(document.getElementById('col-month').value);
    const year = Number(document.getElementById('col-year').value);
    const flats = await db.flats.toArray();
    const existing = await db.duesSchedule.toArray();
    let created = 0;
    for (const f of flats) {
      const already = existing.some(d => d.flatId === f.id && d.month === month && d.year === year);
      if (already) continue;
      const rec = await withMeta('duesSchedule', { flatId: f.id, month, year, dueAmount: Number(f.maintenanceFee) || 0, paidAmount: 0, status: 'pending' });
      const id = await db.duesSchedule.add(rec);
      await queueSync('duesSchedule', id, 'create', rec);
      created++;
    }
    await logAudit(Auth.current.id, 'DUES_GENERATED', `${Utils.monthName(month)} ${year} — ${created} flats`);
    Utils.toast(created > 0 ? `${t('generateDues')} ✓ (${created})` : t('noDuesForPeriod'), created > 0 ? 'success' : 'info');
    loadRows();
  });

  await loadRows();
};

function openCollectPaymentModal(due, flat, onDone) {
  const balance = due.dueAmount - due.paidAmount;
  App.openModal(`${t('collectPayment')} — ${t('flat')} ${flat ? flat.flatNo : ''}`, `
    <form id="collect-form" class="space-y-4">
      <div class="bg-slate-50 rounded-lg p-3 text-sm flex justify-between">
        <span class="text-slate-500">${t('outstandingBalanceLabel')}</span><span class="font-bold text-rose-600">${Utils.money(balance)}</span>
      </div>
      <div><label class="form-label">${t('amountReceived')}</label><input required type="number" min="0.01" max="${balance}" step="0.01" id="c-amount" value="${balance}" class="form-input" /></div>
      <div><label class="form-label">${t('date')}</label><input required type="date" id="c-date" value="${Utils.todayInputValue()}" class="form-input" /></div>
      <div><label class="form-label">${t('method')}</label>
        <select id="c-method" class="form-select">${methodOptionsHTML('Cash')}</select>
      </div>
      <div><label class="form-label">${t('notes')} (${t('optional')})</label><input id="c-note" class="form-input" /></div>
      <button type="submit" class="btn btn-success w-full justify-center">${t('confirmCollection')}</button>
    </form>`);

  document.getElementById('collect-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = Number(document.getElementById('c-amount').value);
    if (amount <= 0 || amount > balance + 0.001) { Utils.toast(t('invalidAmount'), 'error'); return; }

    const rec = await createTransaction({
      type: 'income', category: 'Maintenance Fee', amount,
      date: document.getElementById('c-date').value,
      description: document.getElementById('c-note').value.trim() || `${Utils.monthName(due.month)} ${due.year}`,
      payerOrPayee: flat ? flat.ownerName : '',
      method: document.getElementById('c-method').value,
      flatId: due.flatId, flatNo: flat ? flat.flatNo : '', duesId: due.id
    });

    const newPaid = due.paidAmount + amount;
    const newStatus = newPaid >= due.dueAmount ? 'paid' : 'partial';
    const updates = await touch('duesSchedule', { paidAmount: newPaid, status: newStatus, uuid: due.uuid });
    await db.duesSchedule.update(due.id, updates);
    await queueSync('duesSchedule', due.id, 'update', updates);

    Utils.toast(`${t('collectPayment')} — ${rec.voucherNo} ✓`);
    App.closeModal();
    if (onDone) onDone();
  });
}

/* ============================================================================
   EVENTS — Budget, collections, expenses, surplus/deficit
   ========================================================================= */
Views.renderEvents = async function (container) {
  const events = await db.events.orderBy('startDate').reverse().toArray();
  const allTxns = await db.transactions.toArray();

  const summarize = (eventId) => {
    const income = allTxns.filter(t => t.eventId == eventId && t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = allTxns.filter(t => t.eventId == eventId && t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return { income, expense, net: income - expense };
  };

  container.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-xl font-bold text-slate-800">${t('eventsFundManagement')}</h1>
      <button id="add-event-btn" class="btn btn-primary">+ ${t('newEvent')}</button>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" id="events-grid">
      ${events.length ? events.map(ev => {
        const s = summarize(ev.id);
        return `
        <div class="card p-4">
          <div class="flex justify-between items-start mb-2">
            <h3 class="font-bold text-slate-800">${Utils.escapeHTML(ev.name)}</h3>
            <span class="badge ${ev.status === 'ongoing' ? 'badge-blue' : ev.status === 'completed' ? 'badge-green' : 'badge-slate'}">${t(ev.status)}</span>
          </div>
          <div class="text-xs text-slate-400 mb-3">${Utils.dateStr(ev.startDate)} ${ev.endDate ? '→ ' + Utils.dateStr(ev.endDate) : ''}</div>
          <div class="space-y-1.5 text-sm">
            <div class="flex justify-between"><span class="text-slate-500">${t('budget')}</span><span class="font-medium">${Utils.money(ev.budget)}</span></div>
            <div class="flex justify-between"><span class="text-slate-500">${t('collected')}</span><span class="font-medium text-emerald-600">${Utils.money(s.income)}</span></div>
            <div class="flex justify-between"><span class="text-slate-500">${t('spent')}</span><span class="font-medium text-rose-600">${Utils.money(s.expense)}</span></div>
            <div class="flex justify-between border-t border-slate-100 pt-1.5"><span class="text-slate-600 font-semibold">${s.net >= 0 ? t('surplus') : t('deficit')}</span><span class="font-bold ${s.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}">${Utils.money(Math.abs(s.net))}</span></div>
          </div>
          <div class="flex gap-2 mt-3">
            <button data-id="${ev.id}" class="ev-txn-income-btn btn btn-success btn-sm flex-1 justify-center">+ ${t('collect')}</button>
            <button data-id="${ev.id}" class="ev-txn-expense-btn btn btn-danger btn-sm flex-1 justify-center">+ ${t('spent')}</button>
          </div>
        </div>`;
      }).join('') : `<div class="col-span-full empty-state">${t('noEventsYet')}</div>`}
    </div>
  `;

  document.getElementById('add-event-btn').addEventListener('click', () => {
    App.openModal(t('createNewEvent'), `
      <form id="event-form" class="space-y-4">
        <div><label class="form-label">${t('eventName')}</label><input required id="ev-name" class="form-input" /></div>
        <div><label class="form-label">${t('budget')}</label><input required type="number" min="0" step="0.01" id="ev-budget" class="form-input" /></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="form-label">${t('startDate')}</label><input required type="date" id="ev-start" value="${Utils.todayInputValue()}" class="form-input" /></div>
          <div><label class="form-label">${t('endDate')}</label><input type="date" id="ev-end" class="form-input" /></div>
        </div>
        <div><label class="form-label">${t('status')}</label><select id="ev-status" class="form-select"><option value="ongoing">${t('ongoing')}</option><option value="planned">${t('planned')}</option><option value="completed">${t('completed')}</option></select></div>
        <button type="submit" class="btn btn-primary w-full justify-center">${t('createEvent')}</button>
      </form>`);
    document.getElementById('event-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const rec = await withMeta('events', {
        name: document.getElementById('ev-name').value.trim(),
        budget: Number(document.getElementById('ev-budget').value),
        startDate: document.getElementById('ev-start').value,
        endDate: document.getElementById('ev-end').value || null,
        status: document.getElementById('ev-status').value
      });
      const id = await db.events.add(rec);
      await queueSync('events', id, 'create', rec);
      await logAudit(Auth.current.id, 'EVENT_CREATED', rec.name);
      Utils.toast(t('createEvent') + ' ✓');
      App.closeModal();
      App.navigateTo('events');
    });
  });

  const categories = await db.categories.toArray();
  const flats = await db.flats.toArray();
  container.querySelectorAll('.ev-txn-income-btn').forEach(b => b.addEventListener('click', () => openTransactionForm('income', categories, flats, events, () => App.navigateTo('events'))));
  container.querySelectorAll('.ev-txn-expense-btn').forEach(b => b.addEventListener('click', () => openTransactionForm('expense', categories, flats, events, () => App.navigateTo('events'))));
};

/* ============================================================================
   OWNER / SHAREHOLDER LEDGER (Manager+ view of any flat)
   ========================================================================= */
Views.renderLedger = async function (container) {
  const flats = await db.flats.orderBy('flatNo').toArray();

  container.innerHTML = `
    <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
      <h1 class="text-xl font-bold text-slate-800">${t('ownerShareholderLedger')}</h1>
      ${Auth.hasRole('manager') ? `<button data-view="inventory" class="nav-item-link btn btn-secondary btn-sm">${t('inventory')} →</button>` : ''}
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="card p-3 lg:col-span-1 max-h-[70vh] overflow-y-auto">
        <div class="text-xs font-semibold text-slate-400 mb-2 px-1">${t('selectAFlat').toUpperCase()}</div>
        <div id="flat-list" class="space-y-1">
          ${flats.map(f => `<button data-id="${f.id}" class="flat-select-btn w-full text-left px-3 py-2.5 rounded-lg hover:bg-slate-50 border border-transparent flex justify-between items-center">
            <span><span class="font-semibold text-slate-700">${Utils.escapeHTML(f.flatNo)}</span><br/><span class="text-xs text-slate-400">${Utils.escapeHTML(f.ownerName)}</span></span>
            <span class="badge ${f.status === 'vacant' ? 'badge-slate' : f.status === 'rented' ? 'badge-blue' : 'badge-green'}">${t(f.status === 'owner-occupied' ? 'ownerOccupied' : f.status)}</span>
          </button>`).join('') || `<div class="empty-state text-sm">${t('noFlatsRegistered')}</div>`}
        </div>
      </div>
      <div class="lg:col-span-2" id="ledger-detail">
        <div class="empty-state">${t('selectFlatPrompt')}</div>
      </div>
    </div>
  `;

  container.querySelectorAll('.nav-item-link').forEach(btn => btn.addEventListener('click', () => App.navigateTo(btn.dataset.view)));

  container.querySelectorAll('.flat-select-btn').forEach(btn => btn.addEventListener('click', async () => {
    container.querySelectorAll('.flat-select-btn').forEach(b => b.classList.remove('bg-brand-50', 'border-brand-200'));
    btn.classList.add('bg-brand-50', 'border-brand-200');
    const flatId = Number(btn.dataset.id);
    await renderLedgerDetail(flatId);
  }));
};

async function renderLedgerDetail(flatId) {
  const flat = await db.flats.get(flatId);
  const dues = await db.duesSchedule.where('flatId').equals(flatId).sortBy('year');
  const txns = await db.transactions.where('flatId').equals(flatId).reverse().sortBy('date');
  const totalDue = dues.reduce((s, d) => s + d.dueAmount, 0);
  const totalPaid = dues.reduce((s, d) => s + d.paidAmount, 0);
  const detail = document.getElementById('ledger-detail');

  detail.innerHTML = `
    <div class="card p-4 mb-4">
      <div class="flex justify-between items-start flex-wrap gap-2">
        <div>
          <h2 class="text-lg font-bold text-slate-800">${t('flat')} ${Utils.escapeHTML(flat.flatNo)}</h2>
          <p class="text-sm text-slate-500">${t('owner')}: ${Utils.escapeHTML(flat.ownerName)} ${flat.tenantName ? '· ' + Utils.escapeHTML(flat.tenantName) : ''}</p>
        </div>
        <button id="print-ledger-btn" class="btn btn-secondary btn-sm">🖨 ${t('printStatement')}</button>
      </div>
      <div class="grid grid-cols-3 gap-3 mt-4">
        <div class="bg-slate-50 rounded-lg p-3 text-center"><div class="text-xs text-slate-400">${t('totalDue')}</div><div class="font-bold">${Utils.money(totalDue)}</div></div>
        <div class="bg-slate-50 rounded-lg p-3 text-center"><div class="text-xs text-slate-400">${t('totalPaid')}</div><div class="font-bold text-emerald-600">${Utils.money(totalPaid)}</div></div>
        <div class="bg-slate-50 rounded-lg p-3 text-center"><div class="text-xs text-slate-400">${t('balance')}</div><div class="font-bold ${(totalDue-totalPaid)>0?'text-rose-600':'text-emerald-600'}">${Utils.money(totalDue - totalPaid)}</div></div>
      </div>
    </div>
    <div class="card p-4">
      <h3 class="font-semibold text-sm text-slate-700 mb-3">${t('paymentTransactions')}</h3>
      <div class="overflow-x-auto">
        <table class="data-table">
          <thead><tr><th>${t('date')}</th><th>${t('voucher')}</th><th>${t('category')}</th><th class="text-right">${t('amount')}</th></tr></thead>
          <tbody>
            ${txns.length ? txns.map(tx => `<tr><td>${Utils.dateStr(tx.date)}</td><td class="text-slate-400">${tx.voucherNo}</td><td>${Utils.escapeHTML(tx.category)}</td><td class="text-right font-semibold text-emerald-600">${Utils.money(tx.amount)}</td></tr>`).join('') : `<tr><td colspan="4" class="empty-state">${t('noPaymentsRecorded')}</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('print-ledger-btn').addEventListener('click', () => {
    const rows = dues.map(d => `<tr><td>${Utils.monthName(d.month)} ${d.year}</td><td class="text-right">${Utils.money(d.dueAmount)}</td><td class="text-right">${Utils.money(d.paidAmount)}</td><td class="text-right">${Utils.money(d.dueAmount - d.paidAmount)}</td><td>${t(d.status)}</td></tr>`).join('');
    const tableHTML = `<table class="data-table"><thead><tr><th>${t('period')}</th><th class="text-right">${t('due')}</th><th class="text-right">${t('paid')}</th><th class="text-right">${t('balance')}</th><th>${t('status')}</th></tr></thead><tbody>${rows || `<tr><td colspan="5">${t('noDuesGenerated')}</td></tr>`}</tbody></table>`;
    const summaryHTML = `<div class="a4-report-summary">
      <div class="sum-box">${t('totalDue')}<b>${Utils.money(totalDue)}</b></div>
      <div class="sum-box">${t('totalPaid')}<b>${Utils.money(totalPaid)}</b></div>
      <div class="sum-box">${t('balance')}<b>${Utils.money(totalDue - totalPaid)}</b></div>
    </div>`;
    PrintModule.printReport(`${t('ownerShareholderLedger')} — ${t('flat')} ${flat.flatNo}`, `${t('owner')}: ${flat.ownerName}`, tableHTML, summaryHTML);
  });
}
