/* ============================================================================
   utils.js — Shared helper functions (formatting, toasts, modals, CSV export)
   ========================================================================= */

const Utils = {
  _currency: '৳',

  setCurrencySymbol(sym) { this._currency = sym || '৳'; },

  money(n) {
    const val = Number(n || 0);
    const locale = (window.I18N && I18N.lang === 'bn') ? 'bn-BD' : 'en-IN';
    return this._currency + ' ' + val.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },

  dateStr(d) {
    const dt = (d instanceof Date) ? d : new Date(d);
    const locale = (window.I18N && I18N.lang === 'bn') ? 'bn-BD' : 'en-GB';
    return dt.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
  },

  dateTimeStr(d) {
    const dt = (d instanceof Date) ? d : new Date(d);
    const locale = (window.I18N && I18N.lang === 'bn') ? 'bn-BD' : 'en-GB';
    return dt.toLocaleString(locale, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  },

  todayInputValue() {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  },

  monthName(m) {
    if (window.I18N) return t('m' + m);
    return ['January','February','March','April','May','June','July','August','September','October','November','December'][m - 1] || '';
  },

  voucherNo(prefix) {
    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${stamp}-${rand}`;
  },

  toast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const colors = {
      success: 'bg-emerald-600', error: 'bg-rose-600', info: 'bg-sky-600', warning: 'bg-amber-500'
    };
    const el = document.createElement('div');
    el.className = `toast-item ${colors[type] || colors.info} text-white px-4 py-3 rounded-lg shadow-lg mb-2 text-sm font-medium flex items-center gap-2 animate-slide-in`;
    el.innerHTML = `<span>${message}</span>`;
    container.appendChild(el);
    setTimeout(() => {
      el.classList.add('animate-fade-out');
      setTimeout(() => el.remove(), 300);
    }, 3000);
  },

  confirmDialog(message) {
    return new Promise((resolve) => {
      const modal = document.getElementById('confirm-modal');
      const msgEl = document.getElementById('confirm-modal-message');
      const yesBtn = document.getElementById('confirm-modal-yes');
      const noBtn = document.getElementById('confirm-modal-no');
      msgEl.textContent = message;
      modal.classList.remove('hidden');
      const cleanup = (result) => {
        modal.classList.add('hidden');
        yesBtn.removeEventListener('click', onYes);
        noBtn.removeEventListener('click', onNo);
        resolve(result);
      };
      const onYes = () => cleanup(true);
      const onNo = () => cleanup(false);
      yesBtn.addEventListener('click', onYes);
      noBtn.addEventListener('click', onNo);
    });
  },

  escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  },

  downloadFile(filename, content, mime = 'application/json') {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  exportCSV(filename, rows, headers) {
    const escapeCell = (v) => {
      const s = (v === null || v === undefined) ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.map(escapeCell).join(',')];
    for (const row of rows) lines.push(row.map(escapeCell).join(','));
    this.downloadFile(filename, lines.join('\n'), 'text/csv');
  },

  debounce(fn, wait = 300) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
  },

  el(html) {
    const div = document.createElement('div');
    div.innerHTML = html.trim();
    return div.firstChild;
  }
};
