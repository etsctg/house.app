/* ============================================================================
   app-reports.js — Accounting Reports:
   Cashbook/Daybook, Income vs Expense (P&L), Assets & Liabilities Overview
   (now including logged Building Assets at cost), Event-wise Financial
   Summary. All printable (A4) and CSV-exportable. Fully bilingual.
   ========================================================================= */

Views.renderReports = async function (container) {
  container.innerHTML = `
    <h1 class="text-xl font-bold text-slate-800 mb-4">${t('accountingReports')}</h1>
    <div class="border-b border-slate-200 flex gap-1 mb-5 overflow-x-auto" id="report-tabs">
      <button data-tab="cashbook" class="tab-btn active">${t('cashbookDaybook')}</button>
      <button data-tab="pnl" class="tab-btn">${t('incomeVsExpense')}</button>
      <button data-tab="balance" class="tab-btn">${t('assetsLiabilities')}</button>
      <button data-tab="eventsummary" class="tab-btn">${t('eventSummary')}</button>
    </div>
    <div id="report-body"></div>
  `;

  const tabs = { cashbook: renderCashbookReport, pnl: renderPnLReport, balance: renderBalanceReport, eventsummary: renderEventSummaryReport };
  const body = document.getElementById('report-body');

  const activate = (tab) => {
    document.querySelectorAll('#report-tabs .tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    tabs[tab](body);
  };

  document.querySelectorAll('#report-tabs .tab-btn').forEach(btn => btn.addEventListener('click', () => activate(btn.dataset.tab)));
  activate('cashbook');
};

/* ---------------------------------------------------------------------------
   CASHBOOK / DAYBOOK
   ------------------------------------------------------------------------ */
async function renderCashbookReport(body) {
  const today = Utils.todayInputValue();
  const monthStart = today.slice(0, 8) + '01';
  body.innerHTML = `
    <div class="card p-3 mb-4 flex flex-wrap gap-2 items-end">
      <div><label class="form-label">${t('from')}</label><input type="date" id="cb-from" value="${monthStart}" class="form-input" /></div>
      <div><label class="form-label">${t('to')}</label><input type="date" id="cb-to" value="${today}" class="form-input" /></div>
      <button id="cb-run" class="btn btn-primary">${t('runReport')}</button>
      <button id="cb-print" class="btn btn-secondary ml-auto">🖨 ${t('print')}</button>
      <button id="cb-csv" class="btn btn-secondary">⬇ ${t('exportCsv')}</button>
    </div>
    <div id="cb-result"></div>
  `;

  let lastRows = [];
  const run = async () => {
    const from = document.getElementById('cb-from').value;
    const to = document.getElementById('cb-to').value;
    let txns = await db.transactions.orderBy('date').toArray();
    txns = txns.filter(tx => tx.date >= from && tx.date <= to);

    let running = 0;
    const rows = txns.map(tx => {
      running += tx.type === 'income' ? tx.amount : -tx.amount;
      return { ...tx, running };
    });
    lastRows = rows;
    const totalIn = txns.filter(tx => tx.type === 'income').reduce((s, tx) => s + tx.amount, 0);
    const totalOut = txns.filter(tx => tx.type === 'expense').reduce((s, tx) => s + tx.amount, 0);

    document.getElementById('cb-result').innerHTML = `
      <div class="grid grid-cols-3 gap-3 mb-4">
        <div class="stat-card"><div class="text-xs text-slate-400 font-semibold">${t('totalReceipts').toUpperCase()}</div><div class="text-lg font-bold text-emerald-600 mt-1">${Utils.money(totalIn)}</div></div>
        <div class="stat-card"><div class="text-xs text-slate-400 font-semibold">${t('totalPayments').toUpperCase()}</div><div class="text-lg font-bold text-rose-600 mt-1">${Utils.money(totalOut)}</div></div>
        <div class="stat-card"><div class="text-xs text-slate-400 font-semibold">${t('closingBalance').toUpperCase()}</div><div class="text-lg font-bold mt-1">${Utils.money(totalIn - totalOut)}</div></div>
      </div>
      <div class="card p-0 overflow-hidden"><div class="overflow-x-auto"><table class="data-table">
        <thead><tr><th>${t('date')}</th><th>${t('voucher')}</th><th>${t('particulars')}</th><th class="text-right">${t('receiptIn')}</th><th class="text-right">${t('paymentOut')}</th><th class="text-right">${t('balance')}</th></tr></thead>
        <tbody>${rows.length ? rows.map(r => `
          <tr>
            <td>${Utils.dateStr(r.date)}</td><td class="text-slate-400">${r.voucherNo}</td><td>${Utils.escapeHTML(r.category)}</td>
            <td class="text-right text-emerald-600">${r.type === 'income' ? Utils.money(r.amount) : ''}</td>
            <td class="text-right text-rose-600">${r.type === 'expense' ? Utils.money(r.amount) : ''}</td>
            <td class="text-right font-semibold">${Utils.money(r.running)}</td>
          </tr>`).join('') : `<tr><td colspan="6" class="empty-state">${t('noTxnInRange')}</td></tr>`}
        </tbody>
      </table></div></div>
    `;
  };

  document.getElementById('cb-run').addEventListener('click', run);
  document.getElementById('cb-print').addEventListener('click', async () => {
    await run();
    const from = document.getElementById('cb-from').value, to = document.getElementById('cb-to').value;
    const totalIn = lastRows.filter(tx => tx.type === 'income').reduce((s, tx) => s + tx.amount, 0);
    const totalOut = lastRows.filter(tx => tx.type === 'expense').reduce((s, tx) => s + tx.amount, 0);
    const tableHTML = `<table class="data-table"><thead><tr><th>${t('date')}</th><th>${t('voucher')}</th><th>${t('particulars')}</th><th class="text-right">${t('receiptIn')}</th><th class="text-right">${t('paymentOut')}</th><th class="text-right">${t('balance')}</th></tr></thead><tbody>${lastRows.map(r => `<tr><td>${Utils.dateStr(r.date)}</td><td>${r.voucherNo}</td><td>${Utils.escapeHTML(r.category)}</td><td class="text-right">${r.type === 'income' ? Utils.money(r.amount) : ''}</td><td class="text-right">${r.type === 'expense' ? Utils.money(r.amount) : ''}</td><td class="text-right">${Utils.money(r.running)}</td></tr>`).join('')}</tbody></table>`;
    const summaryHTML = `<div class="a4-report-summary"><div class="sum-box">${t('totalReceipts')}<b>${Utils.money(totalIn)}</b></div><div class="sum-box">${t('totalPayments')}<b>${Utils.money(totalOut)}</b></div><div class="sum-box">${t('closingBalance')}<b>${Utils.money(totalIn - totalOut)}</b></div></div>`;
    PrintModule.printReport(t('cashbookDaybook'), `${Utils.dateStr(from)} — ${Utils.dateStr(to)}`, tableHTML, summaryHTML);
  });
  document.getElementById('cb-csv').addEventListener('click', async () => {
    await run();
    Utils.exportCSV('cashbook.csv', lastRows.map(r => [r.date, r.voucherNo, r.category, r.type === 'income' ? r.amount : '', r.type === 'expense' ? r.amount : '', r.running]),
      ['Date', 'Voucher', 'Particulars', 'Receipt', 'Payment', 'Balance']);
  });

  await run();
}

/* ---------------------------------------------------------------------------
   INCOME VS EXPENSE (Profit & Loss)
   ------------------------------------------------------------------------ */
async function renderPnLReport(body) {
  const now = new Date();
  body.innerHTML = `
    <div class="card p-3 mb-4 flex flex-wrap gap-2 items-end">
      <div><label class="form-label">${t('month')}</label><select id="pnl-month" class="form-select">${Array.from({length:12},(_,i)=>`<option value="${i+1}" ${i+1===now.getMonth()+1?'selected':''}>${Utils.monthName(i+1)}</option>`).join('')}</select></div>
      <div><label class="form-label">${t('year')}</label><input type="number" id="pnl-year" value="${now.getFullYear()}" class="form-input w-24" /></div>
      <button id="pnl-run" class="btn btn-primary">${t('runReport')}</button>
      <button id="pnl-print" class="btn btn-secondary ml-auto">🖨 ${t('print')}</button>
    </div>
    <div id="pnl-result"></div>
  `;

  let lastData = null;
  const run = async () => {
    const month = Number(document.getElementById('pnl-month').value);
    const year = Number(document.getElementById('pnl-year').value);
    const txns = (await db.transactions.toArray()).filter(tx => { const d = new Date(tx.date); return d.getMonth() + 1 === month && d.getFullYear() === year; });
    const incomeByCat = {}, expenseByCat = {};
    txns.forEach(tx => {
      const bucket = tx.type === 'income' ? incomeByCat : expenseByCat;
      bucket[tx.category] = (bucket[tx.category] || 0) + tx.amount;
    });
    const totalIncome = Object.values(incomeByCat).reduce((a, b) => a + b, 0);
    const totalExpense = Object.values(expenseByCat).reduce((a, b) => a + b, 0);
    lastData = { month, year, incomeByCat, expenseByCat, totalIncome, totalExpense };

    document.getElementById('pnl-result').innerHTML = `
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div class="stat-card"><div class="text-xs text-slate-400 font-semibold">${t('totalIncome').toUpperCase()}</div><div class="text-lg font-bold text-emerald-600 mt-1">${Utils.money(totalIncome)}</div></div>
        <div class="stat-card"><div class="text-xs text-slate-400 font-semibold">${t('totalExpense').toUpperCase()}</div><div class="text-lg font-bold text-rose-600 mt-1">${Utils.money(totalExpense)}</div></div>
        <div class="stat-card"><div class="text-xs text-slate-400 font-semibold">${totalIncome-totalExpense>=0?t('netProfit'):t('netLoss')}</div><div class="text-lg font-bold mt-1">${Utils.money(Math.abs(totalIncome-totalExpense))}</div></div>
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="card p-4">
          <h3 class="font-semibold text-sm text-slate-700 mb-3">${t('incomeByCategory')}</h3>
          <table class="data-table"><tbody>${Object.entries(incomeByCat).length ? Object.entries(incomeByCat).map(([c,a]) => `<tr><td>${Utils.escapeHTML(c)}</td><td class="text-right font-semibold text-emerald-600">${Utils.money(a)}</td></tr>`).join('') : `<tr><td class="empty-state">${t('noIncomeRecorded')}</td></tr>`}</tbody></table>
        </div>
        <div class="card p-4">
          <h3 class="font-semibold text-sm text-slate-700 mb-3">${t('expenseByCategory')}</h3>
          <table class="data-table"><tbody>${Object.entries(expenseByCat).length ? Object.entries(expenseByCat).map(([c,a]) => `<tr><td>${Utils.escapeHTML(c)}</td><td class="text-right font-semibold text-rose-600">${Utils.money(a)}</td></tr>`).join('') : `<tr><td class="empty-state">${t('noExpenseRecorded')}</td></tr>`}</tbody></table>
        </div>
      </div>
      <div class="card p-4 mt-4"><div class="h-72"><canvas id="pnlChart"></canvas></div></div>
    `;
    const allCats = [...new Set([...Object.keys(incomeByCat), ...Object.keys(expenseByCat)])];
    if (typeof Chart !== 'undefined' && allCats.length) {
      ChartsModule.incomeVsExpenseBar('pnlChart', allCats, allCats.map(c => incomeByCat[c] || 0), allCats.map(c => expenseByCat[c] || 0));
    }
  };

  document.getElementById('pnl-run').addEventListener('click', run);
  document.getElementById('pnl-print').addEventListener('click', async () => {
    await run();
    const { month, year, incomeByCat, expenseByCat, totalIncome, totalExpense } = lastData;
    const tableHTML = `
      <table class="data-table"><thead><tr><th>${t('category')}</th><th class="text-right">${t('income')}</th><th class="text-right">${t('expense')}</th></tr></thead>
        <tbody>
          ${[...new Set([...Object.keys(incomeByCat), ...Object.keys(expenseByCat)])].map(c => `<tr><td>${Utils.escapeHTML(c)}</td><td class="text-right">${incomeByCat[c] ? Utils.money(incomeByCat[c]) : ''}</td><td class="text-right">${expenseByCat[c] ? Utils.money(expenseByCat[c]) : ''}</td></tr>`).join('')}
          <tr><td class="font-bold">TOTAL</td><td class="text-right font-bold">${Utils.money(totalIncome)}</td><td class="text-right font-bold">${Utils.money(totalExpense)}</td></tr>
        </tbody></table>`;
    const summaryHTML = `<div class="a4-report-summary"><div class="sum-box">${t('totalIncome')}<b>${Utils.money(totalIncome)}</b></div><div class="sum-box">${t('totalExpense')}<b>${Utils.money(totalExpense)}</b></div><div class="sum-box">${totalIncome-totalExpense>=0?t('netProfit'):t('netLoss')}<b>${Utils.money(Math.abs(totalIncome-totalExpense))}</b></div></div>`;
    PrintModule.printReport(t('incomeVsExpense'), `${Utils.monthName(month)} ${year}`, tableHTML, summaryHTML);
  });

  await run();
}

/* ---------------------------------------------------------------------------
   ASSETS & LIABILITIES (simplified balance overview — now includes
   logged Building Assets at purchase cost)
   ------------------------------------------------------------------------ */
async function renderBalanceReport(body) {
  const txns = await db.transactions.toArray();
  const totalIncome = txns.filter(tx => tx.type === 'income').reduce((s, tx) => s + tx.amount, 0);
  const totalExpense = txns.filter(tx => tx.type === 'expense').reduce((s, tx) => s + tx.amount, 0);
  const cashInHand = totalIncome - totalExpense;

  const dues = await db.duesSchedule.toArray();
  const receivable = dues.reduce((s, d) => s + Math.max(0, d.dueAmount - d.paidAmount), 0);

  const assets = await db.assets.toArray();
  const assetValue = assets.reduce((s, a) => s + Number(a.purchaseCost || 0), 0);

  const totalAssets = cashInHand + receivable + assetValue;

  body.innerHTML = `
    <div class="flex justify-end mb-3"><button id="bal-print" class="btn btn-secondary">🖨 ${t('print')}</button></div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="card p-5">
        <h3 class="font-bold text-slate-800 mb-3">${t('assets')}</h3>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between border-b border-slate-100 pb-2"><span class="text-slate-500">${t('cashBankBalance')}</span><span class="font-semibold">${Utils.money(cashInHand)}</span></div>
          <div class="flex justify-between border-b border-slate-100 pb-2"><span class="text-slate-500">${t('outstandingDuesReceivable')}</span><span class="font-semibold">${Utils.money(receivable)}</span></div>
          <div class="flex justify-between border-b border-slate-100 pb-2"><span class="text-slate-500">${t('buildingAssetsAtCost')} <span class="text-xs text-slate-400">(${assets.length})</span></span><span class="font-semibold">${Utils.money(assetValue)}</span></div>
          <div class="flex justify-between pt-1"><span class="font-bold text-slate-700">${t('totalAssets')}</span><span class="font-bold text-brand-700">${Utils.money(totalAssets)}</span></div>
        </div>
      </div>
      <div class="card p-5">
        <h3 class="font-bold text-slate-800 mb-3">${t('liabilitiesEquity')}</h3>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between border-b border-slate-100 pb-2"><span class="text-slate-500">${t('knownLiabilities')}</span><span class="font-semibold">${Utils.money(0)}</span></div>
          <div class="flex justify-between pt-1"><span class="font-bold text-slate-700">${t('buildingFundEquity')}</span><span class="font-bold text-brand-700">${Utils.money(totalAssets)}</span></div>
        </div>
        <p class="text-xs text-slate-400 mt-4">${t('balanceOverviewNote')}</p>
      </div>
    </div>
  `;

  document.getElementById('bal-print').addEventListener('click', () => {
    const tableHTML = `
      <table class="data-table">
        <thead><tr><th>${t('assets')}</th><th class="text-right">${t('amount')}</th></tr></thead>
        <tbody>
          <tr><td>${t('cashBankBalance')}</td><td class="text-right">${Utils.money(cashInHand)}</td></tr>
          <tr><td>${t('outstandingDuesReceivable')}</td><td class="text-right">${Utils.money(receivable)}</td></tr>
          <tr><td>${t('buildingAssetsAtCost')} (${assets.length})</td><td class="text-right">${Utils.money(assetValue)}</td></tr>
          <tr><td class="font-bold">${t('totalAssets')}</td><td class="text-right font-bold">${Utils.money(totalAssets)}</td></tr>
        </tbody>
      </table>`;
    PrintModule.printReport(t('assetsLiabilities'), Utils.dateStr(new Date()), tableHTML);
  });
}

/* ---------------------------------------------------------------------------
   EVENT-WISE FINANCIAL SUMMARY
   ------------------------------------------------------------------------ */
async function renderEventSummaryReport(body) {
  const events = await db.events.toArray();
  const txns = await db.transactions.toArray();

  const rows = events.map(ev => {
    const income = txns.filter(tx => tx.eventId == ev.id && tx.type === 'income').reduce((s, tx) => s + tx.amount, 0);
    const expense = txns.filter(tx => tx.eventId == ev.id && tx.type === 'expense').reduce((s, tx) => s + tx.amount, 0);
    return { ...ev, income, expense, net: income - expense };
  });

  body.innerHTML = `
    <div class="flex justify-end mb-3"><button id="ev-print" class="btn btn-secondary">🖨 ${t('print')}</button></div>
    <div class="card p-0 overflow-hidden"><div class="overflow-x-auto">
      <table class="data-table">
        <thead><tr><th>${t('eventName')}</th><th>${t('status')}</th><th class="text-right">${t('budget')}</th><th class="text-right">${t('collected')}</th><th class="text-right">${t('spent')}</th><th class="text-right">${t('surplus')} / ${t('deficit')}</th></tr></thead>
        <tbody>
          ${rows.length ? rows.map(r => `
            <tr>
              <td class="font-medium">${Utils.escapeHTML(r.name)}</td>
              <td><span class="badge ${r.status === 'ongoing' ? 'badge-blue' : r.status === 'completed' ? 'badge-green' : 'badge-slate'}">${t(r.status)}</span></td>
              <td class="text-right">${Utils.money(r.budget)}</td>
              <td class="text-right text-emerald-600">${Utils.money(r.income)}</td>
              <td class="text-right text-rose-600">${Utils.money(r.expense)}</td>
              <td class="text-right font-bold ${r.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}">${r.net >= 0 ? '+' : '-'}${Utils.money(Math.abs(r.net))}</td>
            </tr>`).join('') : `<tr><td colspan="6" class="empty-state">${t('noEventsFound')}</td></tr>`}
        </tbody>
      </table>
    </div></div>
  `;

  document.getElementById('ev-print').addEventListener('click', () => {
    const tableHTML = `<table class="data-table"><thead><tr><th>${t('eventName')}</th><th>${t('status')}</th><th class="text-right">${t('budget')}</th><th class="text-right">${t('collected')}</th><th class="text-right">${t('spent')}</th><th class="text-right">${t('surplus')}/${t('deficit')}</th></tr></thead><tbody>${rows.map(r => `<tr><td>${Utils.escapeHTML(r.name)}</td><td>${t(r.status)}</td><td class="text-right">${Utils.money(r.budget)}</td><td class="text-right">${Utils.money(r.income)}</td><td class="text-right">${Utils.money(r.expense)}</td><td class="text-right">${Utils.money(r.net)}</td></tr>`).join('')}</tbody></table>`;
    PrintModule.printReport(t('eventSummary'), Utils.dateStr(new Date()), tableHTML);
  });
}
