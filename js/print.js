/* ============================================================================
   print.js — Zero-cost browser-native printing for vouchers & reports
   Supports: 58mm/80mm POS thermal receipts AND standard A4 vouchers/reports.
   Uses a hidden iframe so printing never disturbs the SPA's current view.
   Prints in whichever language (English/বাংলা) is currently active — static
   labels are translated via t(); user-entered data (category names,
   descriptions, names) is printed exactly as entered.
   ========================================================================= */

const PrintModule = {
  async _getSettings() { return await db.settings.get(1); },

  async _printHTML(innerHTML, paperClass) {
    const frame = document.createElement('iframe');
    frame.style.position = 'fixed';
    frame.style.right = '0'; frame.style.bottom = '0';
    frame.style.width = '0'; frame.style.height = '0';
    frame.style.border = '0';
    document.body.appendChild(frame);

    const lang = window.I18N ? I18N.lang : 'en';
    const doc = frame.contentWindow.document;
    doc.open();
    doc.write(`<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8">
      <title>Print</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;600;700&display=swap" rel="stylesheet">
      <link rel="stylesheet" href="css/styles.css">
      <style>${lang === 'bn' ? "body, .thermal-receipt, .a4-voucher, .a4-report { font-family: 'Noto Sans Bengali', 'Inter', Arial, sans-serif; }" : ''}</style>
      </head><body class="print-root ${paperClass}">${innerHTML}</body></html>`);
    doc.close();

    frame.onload = () => {
      setTimeout(() => {
        frame.contentWindow.focus();
        frame.contentWindow.print();
        setTimeout(() => document.body.removeChild(frame), 1000);
      }, 250);
    };
  },

  async printVoucherThermal(txn, size = '80mm') {
    const settings = await this._getSettings();
    const paperClass = size === '58mm' ? 'thermal-58' : 'thermal-80';
    const isIncome = txn.type === 'income';
    const html = `
      <div class="thermal-receipt">
        ${settings.logo ? `<img src="${settings.logo}" class="thermal-logo" />` : ''}
        <div class="thermal-title">${Utils.escapeHTML(settings.buildingName)}</div>
        <div class="thermal-sub">${Utils.escapeHTML(settings.address)}</div>
        <div class="thermal-sub">${Utils.escapeHTML(settings.contact)}</div>
        <div class="thermal-divider">--------------------------------</div>
        <div class="thermal-row"><span>${t('voucherNoLabel')}:</span><span>${txn.voucherNo}</span></div>
        <div class="thermal-row"><span>${t('date')}:</span><span>${Utils.dateStr(txn.date)}</span></div>
        <div class="thermal-row"><span>${t('typeLabel')}:</span><span>${isIncome ? t('receiptIncomeLabel') : t('paymentExpenseLabel')}</span></div>
        <div class="thermal-divider">--------------------------------</div>
        <div class="thermal-row"><span>${t('category')}:</span><span>${Utils.escapeHTML(txn.category)}</span></div>
        ${txn.flatNo ? `<div class="thermal-row"><span>${t('flat')}:</span><span>${Utils.escapeHTML(txn.flatNo)}</span></div>` : ''}
        ${txn.payerOrPayee ? `<div class="thermal-row"><span>${isIncome ? t('receivedFrom') : t('paidTo')}:</span><span>${Utils.escapeHTML(txn.payerOrPayee)}</span></div>` : ''}
        <div class="thermal-row"><span>${t('method')}:</span><span>${Utils.escapeHTML(txn.method || 'Cash')}</span></div>
        <div class="thermal-divider">--------------------------------</div>
        <div class="thermal-desc">${Utils.escapeHTML(txn.description || '')}</div>
        <div class="thermal-divider">--------------------------------</div>
        <div class="thermal-amount">${t('totalLabel')}: ${Utils.money(txn.amount)}</div>
        <div class="thermal-divider">--------------------------------</div>
        <div class="thermal-sub">${t('enteredByLabel')}: ${Utils.escapeHTML(txn.createdByName || '')}</div>
        <div class="thermal-sub">${t('printedLabel')}: ${Utils.dateTimeStr(new Date())}</div>
        <div class="thermal-footer">${t('thankYouFooter')}</div>
      </div>`;
    this._printHTML(html, paperClass);
  },

  async printVoucherA4(txn) {
    const settings = await this._getSettings();
    const isIncome = txn.type === 'income';
    const html = `
      <div class="a4-voucher">
        <div class="a4-header">
          <div class="a4-header-left">
            ${settings.logo ? `<img src="${settings.logo}" class="a4-logo" />` : ''}
            <div>
              <div class="a4-building-name">${Utils.escapeHTML(settings.buildingName)}</div>
              <div class="a4-building-sub">${Utils.escapeHTML(settings.address)}</div>
              <div class="a4-building-sub">${Utils.escapeHTML(settings.contact)} ${settings.email ? ' | ' + Utils.escapeHTML(settings.email) : ''}</div>
            </div>
          </div>
          <div class="a4-header-right">
            <div class="a4-voucher-badge ${isIncome ? 'badge-income' : 'badge-expense'}">${isIncome ? t('receiptVoucherLabel') : t('paymentVoucherLabel')}</div>
            <div class="a4-voucher-no">${t('noLabelShort')}: ${txn.voucherNo}</div>
            <div class="a4-voucher-date">${t('date')}: ${Utils.dateStr(txn.date)}</div>
          </div>
        </div>
        <table class="a4-table">
          <tbody>
            <tr><th>${isIncome ? t('receivedFrom') : t('paidTo')}</th><td>${Utils.escapeHTML(txn.payerOrPayee || '-')}</td></tr>
            ${txn.flatNo ? `<tr><th>${t('flatUnitNoLabel')}</th><td>${Utils.escapeHTML(txn.flatNo)}</td></tr>` : ''}
            <tr><th>${t('category')}</th><td>${Utils.escapeHTML(txn.category)}</td></tr>
            <tr><th>${t('paymentMethodLabel')}</th><td>${Utils.escapeHTML(txn.method || 'Cash')}</td></tr>
            <tr><th>${t('description')}</th><td>${Utils.escapeHTML(txn.description || '-')}</td></tr>
            <tr><th>${t('amount')}</th><td class="a4-amount-cell">${Utils.money(txn.amount)}</td></tr>
          </tbody>
        </table>
        <div class="a4-signature-row">
          <div class="a4-sign-box"><div class="a4-sign-line"></div><div>${t('preparedByLabel')}<br>${Utils.escapeHTML(txn.createdByName || '')}</div></div>
          <div class="a4-sign-box"><div class="a4-sign-line"></div><div>${t('approvedByLabel')}</div></div>
          <div class="a4-sign-box"><div class="a4-sign-line"></div><div>${t('receiverSignatureLabel')}</div></div>
        </div>
        <div class="a4-footer-note">${t('voucherFooterNote')} ${Utils.dateTimeStr(new Date())}</div>
      </div>`;
    this._printHTML(html, 'a4-paper');
  },

  async printReport(title, subtitle, tableHTML, summaryHTML = '') {
    const settings = await this._getSettings();
    const html = `
      <div class="a4-report">
        <div class="a4-report-header">
          ${settings.logo ? `<img src="${settings.logo}" class="a4-logo" />` : ''}
          <div>
            <div class="a4-building-name">${Utils.escapeHTML(settings.buildingName)}</div>
            <div class="a4-building-sub">${Utils.escapeHTML(settings.address)}</div>
          </div>
        </div>
        <div class="a4-report-title">${Utils.escapeHTML(title)}</div>
        <div class="a4-report-subtitle">${Utils.escapeHTML(subtitle)}</div>
        ${summaryHTML}
        ${tableHTML}
        <div class="a4-footer-note">${t('generatedOnLabel')} ${Utils.dateTimeStr(new Date())}</div>
      </div>`;
    this._printHTML(html, 'a4-paper');
  }
};
