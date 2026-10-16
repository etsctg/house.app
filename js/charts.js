/* ============================================================================
   charts.js — Chart.js wrappers for financial analytics/dashboards
   ========================================================================= */

const ChartsModule = {
  instances: {},

  destroy(id) {
    if (this.instances[id]) { this.instances[id].destroy(); delete this.instances[id]; }
  },

  incomeVsExpenseBar(canvasId, labels, incomeData, expenseData) {
    this.destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    const incomeLabel = (typeof t === 'function') ? t('income') : 'Income';
    const expenseLabel = (typeof t === 'function') ? t('expense') : 'Expense';
    this.instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: incomeLabel, data: incomeData, backgroundColor: '#10b981', borderRadius: 6 },
          { label: expenseLabel, data: expenseData, backgroundColor: '#f43f5e', borderRadius: 6 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
        scales: { y: { beginAtZero: true, ticks: { callback: v => Utils.money(v) } } }
      }
    });
  },

  categoryDoughnut(canvasId, labels, data, colors) {
    this.destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    this.instances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } } } }
    });
  },

  balanceTrendLine(canvasId, labels, data) {
    this.destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    const label = (typeof t === 'function') ? t('netBalance') : 'Net Balance';
    this.instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label, data, borderColor: '#2f6fab', backgroundColor: 'rgba(47,111,171,0.12)',
          fill: true, tension: 0.35, pointRadius: 3
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { ticks: { callback: v => Utils.money(v) } } }
      }
    });
  },

  colorPalette(n) {
    const base = ['#2f6fab','#10b981','#f59e0b','#f43f5e','#8b5cf6','#06b6d4','#ec4899','#84cc16','#f97316','#6366f1'];
    const out = [];
    for (let i = 0; i < n; i++) out.push(base[i % base.length]);
    return out;
  }
};
