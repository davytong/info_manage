// app.js — Main application controller

const App = {
    data: null,
    charts: {},
    editingTxId: null,
    _warnedCats: new Set(), // track per-session budget warnings

    init() {
        this.data = Storage.load();
        this.render();
        this.bindGlobalEvents();
        TG.scheduleDailySummary(this.data);
        this._syncNotifyToggle();
        if (TG.isTelegramWebApp()) {
            window.Telegram.WebApp.ready();
            window.Telegram.WebApp.expand();
        }
    },

    /* ─────────────── RENDER ─────────────── */
    render() {
        const { settings, budgets, transactions } = this.data;
        const cycleInfo = Cycle.getCurrent(settings);
        const cycleTxns = Cycle.getTransactionsForCycle(transactions, cycleInfo.cycleStart, cycleInfo.cycleEnd);
        const cycleSpent = cycleTxns.reduce((s, t) => s + t.amount, 0);
        const catStats = Budget.getCategoryStats(this.data, cycleInfo.cycleStart, cycleInfo.cycleEnd);

        document.getElementById('heroSection').innerHTML = UI.renderHero(settings, cycleInfo, cycleSpent);

        const catGrid = document.getElementById('catGrid');
        catGrid.innerHTML = Object.keys(budgets).map(k => UI.renderCategoryCard(k, catStats)).join('');

        this.renderQuickButtons();
        this.renderTransactions();
        setTimeout(() => UI.animateProgressBars(), 100);
        this.renderCharts(catStats);
    },

    renderQuickButtons() {
        const { budgets } = this.data;
        const quickDefs = [
            { cat: 'food', amount: 5 },
            { cat: 'food', amount: 10 },
            { cat: 'gasoline', amount: 5 },
            { cat: 'parking', amount: 1 },
            { cat: 'vehicle', amount: 5 },
            { cat: 'personal', amount: 2 },
        ];
        document.getElementById('quickButtons').innerHTML =
            quickDefs.map(q => UI.renderQuickBtn(q.cat, budgets[q.cat], q.amount)).join('');
    },

    renderTransactions() {
        const recent = Budget.getRecentTransactions(this.data, 10);
        const el = document.getElementById('recentTxns');
        if (recent.length === 0) {
            el.innerHTML = `<div class="empty-state"><i class="fa-solid fa-receipt"></i><p>No transactions yet</p></div>`;
            return;
        }
        el.innerHTML = recent.map(tx => UI.renderTransaction(tx, this.data.budgets)).join('');
    },

    renderCharts(catStats) {
        this.renderDonutChart(catStats);
        this.renderBarChart();
    },

    renderDonutChart(catStats) {
        const ctx = document.getElementById('donutChart');
        if (!ctx) return;
        if (this.charts.donut) this.charts.donut.destroy();
        const labels = Object.values(catStats).map(s => s.label);
        const values = Object.values(catStats).map(s => s.spent);
        const colors = Object.values(catStats).map(s => s.color);
        this.charts.donut = new Chart(ctx, {
            type: 'doughnut',
            data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 0, hoverOffset: 8 }] },
            options: {
                cutout: '70%',
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: c => ` $${c.parsed.toFixed(2)}` } }
                },
                animation: { animateRotate: true, duration: 800 }
            }
        });
    },

    renderBarChart() {
        const ctx = document.getElementById('barChart');
        if (!ctx) return;
        if (this.charts.bar) this.charts.bar.destroy();
        const monthly = Budget.getMonthlyReport(this.data);
        this.charts.bar = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: monthly.map(m => m.label),
                datasets: [{
                    label: 'Spending',
                    data: monthly.map(m => m.amount),
                    backgroundColor: 'rgba(102,126,234,0.7)',
                    borderRadius: 8,
                    borderSkipped: false
                }]
            },
            options: {
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#6b7280' } },
                    y: { grid: { color: '#f3f4f6' }, ticks: { color: '#6b7280', callback: v => '$' + v } }
                },
                animation: { duration: 800 }
            }
        });
    },

    /* ─────────────── QUICK ADD ─────────────── */
    quickAdd(catKey, amount) {
        const tx = Budget.addTransaction(this.data, {
            category: catKey,
            amount,
            note: 'Quick add',
            date: new Date().toISOString().slice(0, 10)
        });
        UI.toast(`${this.data.budgets[catKey].icon} +$${amount} added`);
        this.render();
        this._postSaveNotify(tx);
    },

    openQuickAdd(catKey) {
        const cat = this.data.budgets[catKey];
        this.editingTxId = null;
        document.getElementById('expenseForm').reset();
        document.getElementById('expenseDate').value = new Date().toISOString().slice(0, 10);
        document.getElementById('modalCatSelect').value = catKey;
        document.getElementById('expenseModal').querySelector('.modal-title').innerHTML = `${cat.icon} ${cat.label}`;
        new bootstrap.Modal(document.getElementById('expenseModal')).show();
    },

    /* ─────────────── ADD / EDIT EXPENSE ─────────────── */
    openAddExpense() {
        this.editingTxId = null;
        document.getElementById('expenseForm').reset();
        document.getElementById('expenseDate').value = new Date().toISOString().slice(0, 10);
        document.getElementById('expenseModal').querySelector('.modal-title').innerHTML = '✚ Add Expense';
        new bootstrap.Modal(document.getElementById('expenseModal')).show();
    },

    editTransaction(id) {
        const tx = this.data.transactions.find(t => t.id === id);
        if (!tx) return;
        this.editingTxId = id;
        const cat = this.data.budgets[tx.category];
        document.getElementById('expenseModal').querySelector('.modal-title').innerHTML =
            `✏️ Edit — ${cat ? cat.icon + ' ' + cat.label : tx.category}`;
        document.getElementById('modalCatSelect').value = tx.category;
        document.getElementById('expenseAmount').value = tx.amount;
        document.getElementById('expenseNote').value = tx.note;
        document.getElementById('expenseDate').value = tx.date;
        document.getElementById('expenseCurrency').value = 'USD';
        new bootstrap.Modal(document.getElementById('expenseModal')).show();
    },

    saveExpense() {
        const catKey = document.getElementById('modalCatSelect').value;
        const rawAmt = parseFloat(document.getElementById('expenseAmount').value);
        const currency = document.getElementById('expenseCurrency').value;
        const note = document.getElementById('expenseNote').value.trim();
        const date = document.getElementById('expenseDate').value;

        if (!catKey || isNaN(rawAmt) || rawAmt <= 0) {
            UI.toast('Please fill in valid fields', 'error'); return;
        }

        const amount = currency === 'KHR'
            ? Budget.convertCurrency(rawAmt, 'KHR', 'USD', this.data.settings.exchangeRate)
            : rawAmt;

        bootstrap.Modal.getInstance(document.getElementById('expenseModal')).hide();

        if (this.editingTxId) {
            Budget.updateTransaction(this.data, this.editingTxId, { category: catKey, amount, note, date });
            UI.toast('Transaction updated', 'info');
            this.render();
        } else {
            const tx = Budget.addTransaction(this.data, { category: catKey, amount, note, date });
            UI.toast(`${this.data.budgets[catKey].icon} Expense saved`);
            this.render();
            this._postSaveNotify(tx);
        }
    },

    deleteTransaction(id) {
        if (!confirm('Delete this transaction?')) return;
        Budget.deleteTransaction(this.data, id);
        UI.toast('Transaction deleted', 'warning');
        this.render();
    },

    /* ─────────────── TELEGRAM NOTIFICATIONS ─────────────── */
    async _postSaveNotify(tx) {
        if (!TG.isEnabled()) return;
        let chatId = TG.getChatId();
        // Auto-capture chat ID if inside Telegram Web App
        if (!chatId && TG.isTelegramWebApp()) {
            const user = TG.getTelegramUser();
            if (user?.id) { TG.setChatId(String(user.id)); chatId = String(user.id); }
        }
        if (!chatId) return; // not set up yet — don't auto-prompt, let user do it manually

        const cycleInfo = Cycle.getCurrent(this.data.settings);
        const catStats = Budget.getCategoryStats(this.data, cycleInfo.cycleStart, cycleInfo.cycleEnd);

        // Send expense alert
        await TG.notifyExpenseAdded(tx, this.data.budgets, catStats);

        // Send budget limit warning (once per threshold per session)
        const stat = catStats[tx.category];
        if (stat) {
            const k80 = tx.category + '_80';
            const k100 = tx.category + '_100';
            if (stat.pct >= 100 && !this._warnedCats.has(k100)) {
                this._warnedCats.add(k100);
                await TG.notifyBudgetWarning(tx.category, this.data.budgets[tx.category], stat);
            } else if (stat.pct >= 80 && !this._warnedCats.has(k80)) {
                this._warnedCats.add(k80);
                await TG.notifyBudgetWarning(tx.category, this.data.budgets[tx.category], stat);
            }
        }
    },

    _syncNotifyToggle() {
        const btn = document.getElementById('btnNotifyToggle');
        if (!btn) return;
        const on = TG.isEnabled();
        btn.innerHTML = on
            ? '<i class="fa-solid fa-bell me-1"></i>ON'
            : '<i class="fa-solid fa-bell-slash me-1"></i>OFF';
        btn.title = on ? 'Notifications ON — click to disable' : 'Notifications OFF — click to enable';
        btn.style.background = on
            ? 'linear-gradient(135deg,#00c853,#00897b)'
            : 'rgba(255,255,255,0.18)';
    },

    toggleNotify() {
        TG.setEnabled(!TG.isEnabled());
        this._syncNotifyToggle();
        UI.toast(TG.isEnabled() ? '🔔 Notifications ON' : '🔕 Notifications OFF',
            TG.isEnabled() ? 'success' : 'warning');
    },

    async setupTelegram() {
        const id = await TG.ensureChatId();
        if (id) {
            UI.toast('✅ Telegram connected!', 'success');
            this._syncNotifyToggle();
        }
    },

    async sendToTelegram() {
        let chatId = TG.getChatId();
        if (!chatId) {
            chatId = await TG.ensureChatId();
            if (!chatId) return;
        }
        const result = await TG.notifyFullReport(this.data);
        if (result && result.ok) UI.toast('📤 Report sent to Telegram');
        else UI.toast('Telegram error — check Chat ID', 'error');
    },

    /* ─────────────── SETTINGS ─────────────── */
    openSettings() {
        const s = this.data.settings;
        document.getElementById('settingName').value = s.name;
        document.getElementById('settingIncome').value = s.monthlyIncome;
        document.getElementById('settingPayday1Amount').value = s.payday1.amount;
        document.getElementById('settingPayday2Amount').value = s.payday2.amount;
        document.getElementById('settingRate').value = s.exchangeRate;
        const chatId = TG.getChatId();
        document.getElementById('settingChatId').value = chatId || '';
        document.getElementById('settingNotify').checked = TG.isEnabled();
        new bootstrap.Modal(document.getElementById('settingsModal')).show();
    },

    saveSettings() {
        const s = this.data.settings;
        s.name = document.getElementById('settingName').value.trim() || 'User';
        s.monthlyIncome = parseFloat(document.getElementById('settingIncome').value) || 320;
        s.payday1.amount = parseFloat(document.getElementById('settingPayday1Amount').value) || 160;
        s.payday2.amount = parseFloat(document.getElementById('settingPayday2Amount').value) || 160;
        s.exchangeRate = parseFloat(document.getElementById('settingRate').value) || 4000;

        const chatId = document.getElementById('settingChatId').value.trim();
        if (chatId) TG.setChatId(chatId);
        TG.setEnabled(document.getElementById('settingNotify').checked);

        Storage.save(this.data);
        bootstrap.Modal.getInstance(document.getElementById('settingsModal')).hide();
        UI.toast('Settings saved');
        this._syncNotifyToggle();
        this.render();
    },

    /* ─────────────── REPORTS ─────────────── */
    openReports() {
        new bootstrap.Modal(document.getElementById('reportsModal')).show();
        setTimeout(() => this.renderReportCharts(), 300);
    },

    renderReportCharts() {
        const cycleInfo = Cycle.getCurrent(this.data.settings);
        const catStats = Budget.getCategoryStats(this.data, cycleInfo.cycleStart, cycleInfo.cycleEnd);
        const rDonut = document.getElementById('reportDonut');
        const rBar = document.getElementById('reportBar');
        if (this.charts.rDonut) this.charts.rDonut.destroy();
        if (this.charts.rBar) this.charts.rBar.destroy();

        const labels = Object.values(catStats).map(s => s.label);
        const values = Object.values(catStats).map(s => s.spent);
        const colors = Object.values(catStats).map(s => s.color);

        this.charts.rDonut = new Chart(rDonut, {
            type: 'doughnut',
            data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 0 }] },
            options: { cutout: '65%', plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } } } }
        });

        const monthly = Budget.getMonthlyReport(this.data);
        this.charts.rBar = new Chart(rBar, {
            type: 'bar',
            data: {
                labels: monthly.map(m => m.label),
                datasets: [{ label: 'Monthly Spending', data: monthly.map(m => m.amount), backgroundColor: 'rgba(102,126,234,0.75)', borderRadius: 8, borderSkipped: false }]
            },
            options: {
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false } },
                    y: { ticks: { callback: v => '$' + v } }
                }
            }
        });
    },

    /* ─────────────── BACKUP ─────────────── */
    exportData() { Storage.exportJSON(); UI.toast('Backup exported'); },
    importData() { document.getElementById('importFile').click(); },
    handleImport(e) {
        const file = e.target.files[0];
        if (!file) return;
        Storage.importJSON(file, ok => {
            if (ok) { this.data = Storage.load(); this.render(); UI.toast('Data imported'); }
            else { UI.toast('Import failed — invalid file', 'error'); }
            e.target.value = '';
        });
    },

    /* ─────────────── EVENTS ─────────────── */
    bindGlobalEvents() {
        document.getElementById('fabAdd').addEventListener('click', () => this.openAddExpense());
        document.getElementById('btnSaveExpense').addEventListener('click', () => this.saveExpense());
        document.getElementById('btnOpenSettings').addEventListener('click', () => this.openSettings());
        document.getElementById('btnSaveSettings').addEventListener('click', () => this.saveSettings());
        document.getElementById('btnOpenReports').addEventListener('click', () => this.openReports());
        document.getElementById('btnExport').addEventListener('click', () => this.exportData());
        document.getElementById('btnImport').addEventListener('click', () => this.importData());
        document.getElementById('importFile').addEventListener('change', e => this.handleImport(e));
        document.getElementById('btnTelegram').addEventListener('click', () => this.sendToTelegram());
        document.getElementById('btnNotifyToggle').addEventListener('click', () => this.toggleNotify());
        document.getElementById('btnSetupTg').addEventListener('click', () => this.setupTelegram());

        document.getElementById('expenseCurrency').addEventListener('change', e => {
            document.getElementById('amountCurrencyLabel').textContent =
                e.target.value === 'KHR' ? '(KHR ÷ 4000 = USD)' : '(USD)';
        });
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
