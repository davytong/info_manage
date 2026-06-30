// app.js — Main application controller

const App = {
    data: null,
    charts: {},
    editingTxId: null,
    _warnedCats: new Set(), // track per-session budget warnings
    txLimit: 10,

    initTheme() {
        const theme = localStorage.getItem('app_theme') || 'light';
        if (theme === 'dark') {
            document.body.classList.add('dark-mode');
            const toggleIcon = document.querySelector('#btnThemeToggle i');
            if (toggleIcon) {
                toggleIcon.className = 'fa-solid fa-sun';
            }
        }
    },

    toggleTheme() {
        const isDark = document.body.classList.toggle('dark-mode');
        localStorage.setItem('app_theme', isDark ? 'dark' : 'light');
        const toggleIcon = document.querySelector('#btnThemeToggle i');
        if (toggleIcon) {
            toggleIcon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
        }
        const cycleInfo = Cycle.getCurrent(this.data.settings, this.data.transactions);
        const catStats = Budget.getCategoryStats(this.data, cycleInfo.cycleStart, cycleInfo.cycleEnd, cycleInfo.cycleLabel);
        this.renderCharts(catStats);
    },

    init() {
        this.initTheme();
        this.txLimit = 10;
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
        const cycleInfo = Cycle.getCurrent(settings, transactions);
        const cycleSpent = cycleInfo.spent;
        const catStats = Budget.getCategoryStats(this.data, cycleInfo.cycleStart, cycleInfo.cycleEnd, cycleInfo.cycleLabel);
        const mustRemainInfo = Budget.getMustRemainInfo(this.data, catStats);

        document.getElementById('heroSection').innerHTML = UI.renderHero(settings, cycleInfo, cycleSpent, mustRemainInfo);

        const catGrid = document.getElementById('catGrid');
        catGrid.innerHTML = Object.keys(budgets).map(k => UI.renderCategoryCard(k, catStats)).join('') + UI.renderAddCategoryCard();

        this.renderQuickButtons();
        this.renderTransactions();
        setTimeout(() => UI.animateProgressBars(), 100);
        this.renderCharts(catStats);
        // keep expense modal category list in sync
        UI.rebuildCatSelect(budgets);
        UI.rebuildTxFilterCatSelect(budgets);
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
        const searchInput = document.getElementById('txSearchInput');
        const catFilter = document.getElementById('txFilterCategory');
        const typeFilter = document.getElementById('txFilterType');

        const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const catVal = catFilter ? catFilter.value : 'all';
        const typeVal = typeFilter ? typeFilter.value : 'all';

        // Filter transactions
        let filtered = this.data.transactions;

        if (query) {
            filtered = filtered.filter(tx => 
                (tx.note && tx.note.toLowerCase().includes(query)) ||
                (tx.category && tx.category.toLowerCase().includes(query))
            );
        }

        if (catVal !== 'all') {
            filtered = filtered.filter(tx => tx.category === catVal);
        }

        if (typeVal !== 'all') {
            filtered = filtered.filter(tx => tx.type === typeVal);
        }

        const el = document.getElementById('recentTxns');
        if (filtered.length === 0) {
            el.innerHTML = `<div class="empty-state"><i class="fa-solid fa-receipt"></i><p>No matching transactions found</p></div>`;
            document.getElementById('loadMoreSection').style.display = 'none';
            return;
        }

        // Paginate
        const paginated = filtered.slice(0, this.txLimit);
        el.innerHTML = paginated.map(tx => UI.renderTransaction(tx, this.data.budgets)).join('');

        // Handle load more visibility
        const loadMore = document.getElementById('loadMoreSection');
        if (loadMore) {
            loadMore.style.display = filtered.length > this.txLimit ? 'block' : 'none';
        }
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
        const isDark = document.body.classList.contains('dark-mode');
        const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : '#f3f4f6';
        const tickColor = isDark ? '#94a3b8' : '#6b7280';
        
        this.charts.bar = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: monthly.map(m => m.label),
                datasets: [{
                    label: 'Spending',
                    data: monthly.map(m => m.amount),
                    backgroundColor: isDark ? 'rgba(13,148,136,0.85)' : 'rgba(13,148,136,0.7)',
                    borderRadius: 8,
                    borderSkipped: false
                }]
            },
            options: {
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { color: tickColor } },
                    y: { grid: { color: gridColor }, ticks: { color: tickColor, callback: v => '$' + v } }
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
        UI.toast(`+$${amount.toFixed(2)} logged for ${this.data.budgets[catKey].label}`);
        this.render();
        this._postSaveNotify(tx);
    },

    _syncModalType() {
        const isIncome = document.querySelector('input[name="txType"]:checked').value === 'income';
        const catGroup = document.getElementById('modalCatGroup');
        if (catGroup) {
            catGroup.style.display = isIncome ? 'none' : 'block';
        }
        const modalTitle = document.getElementById('expenseModal').querySelector('.modal-title');
        if (modalTitle) {
            if (this.editingTxId) {
                modalTitle.innerHTML = isIncome 
                    ? '<i class="fa-solid fa-pen-to-square me-1"></i> Edit Income' 
                    : '<i class="fa-solid fa-pen-to-square me-1"></i> Edit Expense';
            } else {
                modalTitle.innerHTML = isIncome 
                    ? '<i class="fa-solid fa-plus me-1"></i> Add Income' 
                    : '<i class="fa-solid fa-plus me-1"></i> Add Expense';
            }
        }
    },

    openQuickAdd(catKey) {
        const cat = this.data.budgets[catKey];
        this.editingTxId = null;
        document.getElementById('expenseForm').reset();
        document.getElementById('expenseDate').value = new Date().toISOString().slice(0, 10);
        document.getElementById('txTypeExpense').checked = true;
        this._syncModalType();
        document.getElementById('modalCatSelect').value = catKey;
        document.getElementById('expenseModal').querySelector('.modal-title').innerHTML =
            `<span style="display:inline-flex; align-items:center; justify-content:center; margin-right:6px;">${UI.renderIconHTML(cat.icon)}</span> Add for ${cat.label}`;
        new bootstrap.Modal(document.getElementById('expenseModal')).show();
    },

    /* ─────────────── ADD / EDIT EXPENSE ─────────────── */
    openAddExpense() {
        this.editingTxId = null;
        document.getElementById('expenseForm').reset();
        document.getElementById('expenseDate').value = new Date().toISOString().slice(0, 10);
        document.getElementById('txTypeExpense').checked = true;
        this._syncModalType();
        new bootstrap.Modal(document.getElementById('expenseModal')).show();
    },

    editTransaction(id) {
        const tx = this.data.transactions.find(t => t.id === id);
        if (!tx) return;
        this.editingTxId = id;
        document.getElementById('expenseForm').reset();
        const isIncome = tx.type === 'income';
        document.getElementById(isIncome ? 'txTypeIncome' : 'txTypeExpense').checked = true;
        this._syncModalType();
        if (!isIncome) {
            document.getElementById('modalCatSelect').value = tx.category;
        }
        document.getElementById('expenseAmount').value = tx.amount;
        document.getElementById('expenseNote').value = tx.note;
        document.getElementById('expenseDate').value = tx.date;
        document.getElementById('expenseCurrency').value = 'USD';
        new bootstrap.Modal(document.getElementById('expenseModal')).show();
    },

    saveExpense() {
        const isIncome = document.querySelector('input[name="txType"]:checked').value === 'income';
        const catKey = isIncome ? 'income' : document.getElementById('modalCatSelect').value;
        const rawAmt = parseFloat(document.getElementById('expenseAmount').value);
        const currency = document.getElementById('expenseCurrency').value;
        const note = document.getElementById('expenseNote').value.trim();
        const date = document.getElementById('expenseDate').value;

        if ((!isIncome && !catKey) || isNaN(rawAmt) || rawAmt <= 0) {
            UI.alert({
                title: 'Invalid input',
                html: isIncome ? 'Please enter a valid amount.' : 'Please select a category and enter a valid amount.',
                icon: 'error'
            });
            return;
        }

        const amount = currency === 'KHR'
            ? Budget.convertCurrency(rawAmt, 'KHR', 'USD', this.data.settings.exchangeRate)
            : rawAmt;

        bootstrap.Modal.getInstance(document.getElementById('expenseModal')).hide();

        const type = isIncome ? 'income' : 'expense';

        if (this.editingTxId) {
            Budget.updateTransaction(this.data, this.editingTxId, { type, category: catKey, amount, note, date });
            UI.toast('Transaction updated', 'info');
            this.render();
        } else {
            const tx = Budget.addTransaction(this.data, { type, category: catKey, amount, note, date });
            UI.toast(isIncome ? 'Income saved' : `${this.data.budgets[catKey]?.label || 'Expense'} saved`);
            this.render();
            this._postSaveNotify(tx);
        }
    },
    deleteTransaction(id) {
        const tx = this.data.transactions.find(t => t.id === id);
        const cat = tx ? (this.data.budgets[tx.category] || { icon: 'fa-solid fa-receipt', label: tx.category }) : { icon: 'fa-solid fa-receipt', label: '' };
        UI.confirm({
            title: 'Delete transaction?',
            html: `<div style="font-size:1.6rem; display:inline-flex; align-items:center; justify-content:center; width:3rem; height:3rem; background:${tx.type === 'income' ? 'rgba(0,200,83,0.15)' : 'rgba(255,82,82,0.15)'}; color:${tx.type === 'income' ? 'var(--success)' : 'var(--danger)'}; border-radius:50%; margin-bottom:12px;">${UI.renderIconHTML(cat.icon)}</div><br><strong>${cat.label}</strong> — $${tx ? tx.amount.toFixed(2) : ''}`,
            icon: 'warning',
            confirmText: 'Yes, delete',
            cancelText: 'Cancel'
        }).then(confirmed => {
            if (!confirmed) return;
            Budget.deleteTransaction(this.data, id);
            UI.toast('Transaction deleted', 'warning');
            this.render();
        });
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

        const cycleInfo = Cycle.getCurrent(this.data.settings, this.data.transactions);
        const catStats = Budget.getCategoryStats(this.data, cycleInfo.cycleStart, cycleInfo.cycleEnd, cycleInfo.cycleLabel);

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
            ? '<i class="fa-solid fa-bell"></i><span class="d-none d-sm-inline ms-1">ON</span>'
            : '<i class="fa-solid fa-bell-slash"></i><span class="d-none d-sm-inline ms-1">OFF</span>';
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

    /* ─────────────── EDIT CATEGORY ─────────────── */

    // Predefined Font Awesome icon list for the picker
    _catIcons: [
        'fa-solid fa-utensils', 'fa-solid fa-pizza-slice', 'fa-solid fa-mug-hot', 'fa-solid fa-cart-shopping',
        'fa-solid fa-gas-pump', 'fa-solid fa-car', 'fa-solid fa-motorcycle', 'fa-solid fa-bus',
        'fa-solid fa-house', 'fa-solid fa-wrench', 'fa-solid fa-plug', 'fa-solid fa-couch',
        'fa-solid fa-user-group', 'fa-solid fa-baby', 'fa-solid fa-graduation-cap', 'fa-solid fa-gift',
        'fa-solid fa-shield-halved', 'fa-solid fa-heart-pulse', 'fa-solid fa-pills', 'fa-solid fa-stethoscope',
        'fa-solid fa-user', 'fa-solid fa-dumbbell', 'fa-solid fa-spa', 'fa-solid fa-scissors',
        'fa-solid fa-square-parking', 'fa-solid fa-road', 'fa-solid fa-coins', 'fa-solid fa-wallet',
        'fa-solid fa-mobile-screen-button', 'fa-solid fa-laptop', 'fa-solid fa-gamepad', 'fa-solid fa-camera',
        'fa-solid fa-leaf', 'fa-solid fa-wine-glass', 'fa-solid fa-music', 'fa-solid fa-clapperboard',
        'fa-solid fa-book', 'fa-solid fa-umbrella-beach', 'fa-solid fa-briefcase', 'fa-solid fa-bullseye'
    ],

    openEditCategory(key) {
        const cat = this.data.budgets[key];
        if (!cat) return;

        // Build icon grid HTML
        const iconGrid = this._catIcons.map(iconClass =>
            `<button type="button" class="emoji-btn${cat.icon === iconClass ? ' active' : ''}"
                     onclick="App._pickIcon(this,'${iconClass}')">${UI.renderIconHTML(iconClass)}</button>`
        ).join('');

        // Build color swatch grid HTML
        const colors = [
            '#ff6b35', '#ff9800', '#ffc107', '#00c853',
            '#4caf50', '#2196f3', '#00bcd4', '#9c27b0',
            '#e91e63', '#f44336', '#3f51b5', '#009688',
            '#795548', '#607d8b', '#667eea', '#764ba2'
        ];
        const colorGrid = colors.map(c =>
            `<button type="button" class="color-swatch${cat.color === c ? ' active' : ''}"
                     style="background:${c}"
                     onclick="App._pickColor(this,'${c}')"></button>`
        ).join('');

        Swal.fire({
            title: `<span style="font-size:1.5rem; display:inline-flex; align-items:center; justify-content:center;">${UI.renderIconHTML(cat.icon)}</span>&nbsp;&nbsp;Edit Category`,
            html: `
              <div class="cat-edit-form">
                <div class="cef-group">
                  <label class="cef-label">Category Name</label>
                  <input id="cef-label" class="cef-input" type="text" value="${cat.label}" maxlength="24" placeholder="Name" />
                </div>
                <div class="cef-group">
                  <label class="cef-label">Monthly Budget (USD) — does NOT reset per cycle</label>
                  <input id="cef-budget" class="cef-input" type="number" value="${cat.budget}" min="0" step="1" placeholder="0" />
                </div>
                <div class="cef-group">
                  <label class="cef-label">Spending Type</label>
                  <select id="cef-frequency" class="cef-input">
                    <option value="daily" ${(cat.frequency || 'daily') === 'daily' ? 'selected' : ''}>Daily (spread across days)</option>
                    <option value="once" ${cat.frequency === 'once' ? 'selected' : ''}>One-time (paid once per month)</option>
                  </select>
                </div>
                <div class="cef-group" id="cef-paycycle-group" style="display:${cat.frequency === 'once' ? 'block' : 'none'}">
                  <label class="cef-label">Pay on which cycle?</label>
                  <select id="cef-paycycle" class="cef-input">
                    <option value="A" ${(cat.payCycle || 'A') === 'A' ? 'selected' : ''}>Cycle A (Payday 1)</option>
                    <option value="B" ${cat.payCycle === 'B' ? 'selected' : ''}>Cycle B (Payday 2)</option>
                  </select>
                </div>
                <div class="cef-group">
                  <label class="cef-label">Icon</label>
                  <div id="cef-icon-display" class="cef-icon-display" style="background:${cat.color}22;color:${cat.color}; display:inline-flex; align-items:center; justify-content:center;">${UI.renderIconHTML(cat.icon)}</div>
                  <div class="emoji-grid">${iconGrid}</div>
                </div>
                <div class="cef-group">
                  <label class="cef-label">Color</label>
                  <div class="color-grid">${colorGrid}</div>
                </div>
              </div>`,
            showCancelButton: true,
            showDenyButton: true,
            confirmButtonText: 'Save Category',
            denyButtonText: 'Delete Category',
            cancelButtonText: 'Cancel',
            customClass: {
                popup: 'swal-popup swal-cat-edit-popup',
                confirmButton: 'swal-confirm-btn',
                denyButton: 'swal-confirm-btn swal-confirm-danger',
                cancelButton: 'swal-cancel-btn',
                htmlContainer: 'swal-cat-edit-html'
            },
            buttonsStyling: false,
            reverseButtons: true,
            didOpen: () => {
                // store working values on the Swal popup element
                const popup = Swal.getPopup();
                popup._editKey = key;
                popup._editIcon = cat.icon;
                popup._editColor = cat.color;
                // Toggle payCycle visibility when frequency changes
                document.getElementById('cef-frequency').addEventListener('change', (e) => {
                    document.getElementById('cef-paycycle-group').style.display =
                        e.target.value === 'once' ? 'block' : 'none';
                });
            },
            preConfirm: () => {
                const popup = Swal.getPopup();
                const label = document.getElementById('cef-label').value.trim();
                const budget = parseFloat(document.getElementById('cef-budget').value);
                const frequency = document.getElementById('cef-frequency').value;
                const payCycle = document.getElementById('cef-paycycle').value;
                if (!label) { Swal.showValidationMessage('Name cannot be empty'); return false; }
                if (isNaN(budget) || budget < 0) { Swal.showValidationMessage('Enter a valid budget amount'); return false; }
                return { label, budget, frequency, payCycle, icon: popup._editIcon, color: popup._editColor };
            }
        }).then(result => {
            if (result.isDenied) {
                this.deleteCategory(key);
                return;
            }
            if (!result.isConfirmed) return;
            const { label, budget, frequency, payCycle, icon, color } = result.value;
            this.data.budgets[key] = { ...this.data.budgets[key], label, budget, frequency, payCycle, icon, color };
            Storage.save(this.data);
            UI.toast(`${label} updated`, 'success');
            this.render();
        });
    },

    deleteCategory(key) {
        const cat = this.data.budgets[key];
        if (!cat) return;
        UI.confirm({
            title: 'Delete Category?',
            html: `Are you sure you want to delete <strong>${cat.label}</strong>?<br><br><small style="color:var(--muted)">Existing transactions will remain, but the category card will be removed.</small>`,
            icon: 'warning',
            confirmText: 'Yes, delete',
            cancelText: 'Cancel'
        }).then(confirmed => {
            if (!confirmed) return;
            delete this.data.budgets[key];
            Storage.save(this.data);
            UI.toast(`${cat.label} deleted`, 'warning');
            this.render();
        });
    },

    openAddCategory() {
        const defaultIcon = 'fa-solid fa-folder-open';
        const defaultColor = '#667eea';

        // Build icon grid HTML
        const iconGrid = this._catIcons.map(iconClass =>
            `<button type="button" class="emoji-btn${defaultIcon === iconClass ? ' active' : ''}"
                     onclick="App._pickIcon(this,'${iconClass}')">${UI.renderIconHTML(iconClass)}</button>`
        ).join('');

        // Build color swatch grid HTML
        const colors = [
            '#ff6b35', '#ff9800', '#ffc107', '#00c853',
            '#4caf50', '#2196f3', '#00bcd4', '#9c27b0',
            '#e91e63', '#f44336', '#3f51b5', '#009688',
            '#795548', '#607d8b', '#667eea', '#764ba2'
        ];
        const colorGrid = colors.map(c =>
            `<button type="button" class="color-swatch${defaultColor === c ? ' active' : ''}"
                     style="background:${c}"
                     onclick="App._pickColor(this,'${c}')"></button>`
        ).join('');

        Swal.fire({
            title: `✚ Add Custom Category`,
            html: `
              <div class="cat-edit-form">
                <div class="cef-group">
                  <label class="cef-label">Category Name</label>
                  <input id="cef-label" class="cef-input" type="text" value="" maxlength="24" placeholder="e.g. Shopping, Bills" />
                </div>
                <div class="cef-group">
                  <label class="cef-label">Monthly Budget (USD) — does NOT reset per cycle</label>
                  <input id="cef-budget" class="cef-input" type="number" value="50" min="0" step="1" placeholder="50" />
                </div>
                <div class="cef-group">
                  <label class="cef-label">Spending Type</label>
                  <select id="cef-frequency" class="cef-input">
                    <option value="daily" selected>Daily (spread across days)</option>
                    <option value="once">One-time (paid once per month)</option>
                  </select>
                </div>
                <div class="cef-group" id="cef-paycycle-group" style="display:none">
                  <label class="cef-label">Pay on which cycle?</label>
                  <select id="cef-paycycle" class="cef-input">
                    <option value="A" selected>Cycle A (Payday 1)</option>
                    <option value="B">Cycle B (Payday 2)</option>
                  </select>
                </div>
                <div class="cef-group">
                  <label class="cef-label">Icon</label>
                  <div id="cef-icon-display" class="cef-icon-display" style="background:${defaultColor}22;color:${defaultColor}; display:inline-flex; align-items:center; justify-content:center;">${UI.renderIconHTML(defaultIcon)}</div>
                  <div class="emoji-grid">${iconGrid}</div>
                </div>
                <div class="cef-group">
                  <label class="cef-label">Color</label>
                  <div class="color-grid">${colorGrid}</div>
                </div>
              </div>`,
            showCancelButton: true,
            confirmButtonText: 'Add Category',
            cancelButtonText: 'Cancel',
            customClass: {
                popup: 'swal-popup swal-cat-edit-popup',
                confirmButton: 'swal-confirm-btn',
                cancelButton: 'swal-cancel-btn',
                htmlContainer: 'swal-cat-edit-html'
            },
            buttonsStyling: false,
            reverseButtons: true,
            didOpen: () => {
                const popup = Swal.getPopup();
                popup._editIcon = defaultIcon;
                popup._editColor = defaultColor;
                // Toggle payCycle visibility when frequency changes
                document.getElementById('cef-frequency').addEventListener('change', (e) => {
                    document.getElementById('cef-paycycle-group').style.display =
                        e.target.value === 'once' ? 'block' : 'none';
                });
            },
            preConfirm: () => {
                const popup = Swal.getPopup();
                const label = document.getElementById('cef-label').value.trim();
                const budget = parseFloat(document.getElementById('cef-budget').value);
                const frequency = document.getElementById('cef-frequency').value;
                const payCycle = document.getElementById('cef-paycycle').value;
                if (!label) { Swal.showValidationMessage('Name cannot be empty'); return false; }
                if (isNaN(budget) || budget < 0) { Swal.showValidationMessage('Enter a valid budget amount'); return false; }

                const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '_');
                if (this.data.budgets[key]) {
                    Swal.showValidationMessage('A category with a similar name already exists');
                    return false;
                }
                return { key, label, budget, frequency, payCycle, icon: popup._editIcon, color: popup._editColor };
            }
        }).then(result => {
            if (!result.isConfirmed) return;
            const { key, label, budget, frequency, payCycle, icon, color } = result.value;
            this.data.budgets[key] = { label, budget, frequency, payCycle, icon, color };
            Storage.save(this.data);
            UI.toast(`${label} added`, 'success');
            this.render();
        });
    },

    // Called by icon buttons inside the Swal popup
    _pickIcon(btn, iconClass) {
        const popup = Swal.getPopup();
        popup._editIcon = iconClass;
        popup.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        // update icon display
        const disp = document.getElementById('cef-icon-display');
        if (disp) disp.innerHTML = UI.renderIconHTML(iconClass);
        // update Swal title icon
        const title = Swal.getTitle();
        if (title) {
            const span = title.querySelector('span');
            if (span) span.innerHTML = UI.renderIconHTML(iconClass);
        }
    },

    // Called by color swatches inside the Swal popup
    _pickColor(btn, color) {
        const popup = Swal.getPopup();
        popup._editColor = color;
        popup.querySelectorAll('.color-swatch').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        // update icon display background
        const disp = document.getElementById('cef-icon-display');
        if (disp) {
            disp.style.background = color + '22';
            disp.style.color = color;
        }
    },

    /* ─────────────── SETTINGS ─────────────── */
    openSettings() {
        const s = this.data.settings;
        document.getElementById('settingName').value = s.name;
        document.getElementById('settingIncome').value = s.monthlyIncome;
        document.getElementById('settingPayday1Day').value = s.payday1.day;
        document.getElementById('settingPayday1Amount').value = s.payday1.amount;
        document.getElementById('settingPayday2Day').value = s.payday2.day;
        document.getElementById('settingPayday2Amount').value = s.payday2.amount;
        document.getElementById('settingRate').value = s.exchangeRate;
        document.getElementById('settingChatId').value = TG.getChatId() || '';
        document.getElementById('settingNotify').checked = TG.isEnabled();
        this._updateCyclePreview();
        new bootstrap.Modal(document.getElementById('settingsModal')).show();
    },

    saveSettings() {
        const s = this.data.settings;
        const p1 = parseInt(document.getElementById('settingPayday1Day').value) || 5;
        const p2 = parseInt(document.getElementById('settingPayday2Day').value) || 15;

        // Validate: p1 and p2 must be different, 1–28
        if (p1 === p2 || p1 < 1 || p1 > 28 || p2 < 1 || p2 > 28) {
            UI.alert({ title: 'Invalid days', html: 'Payday days must be between 1–28 and different.', icon: 'error' });
            return;
        }
        if (p1 >= p2) {
            UI.alert({ title: 'Invalid order', html: 'Payday 1 day must be <strong>before</strong> Payday 2 day.', icon: 'error' });
            return;
        }

        s.name = document.getElementById('settingName').value.trim() || 'User';
        s.monthlyIncome = parseFloat(document.getElementById('settingIncome').value) || 320;
        s.payday1.day = p1;
        s.payday1.amount = parseFloat(document.getElementById('settingPayday1Amount').value) || 160;
        s.payday2.day = p2;
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

    /* Live cycle preview inside settings modal */
    _updateCyclePreview() {
        const p1 = parseInt(document.getElementById('settingPayday1Day').value) || 5;
        const p2 = parseInt(document.getElementById('settingPayday2Day').value) || 15;
        const el = document.getElementById('cyclePreview');
        if (!el) return;
        if (p1 >= p2 || p1 < 1 || p1 > 28 || p2 < 1 || p2 > 28) {
            el.textContent = '⚠️ Payday 1 must be before Payday 2 (1–28)';
            el.style.color = 'var(--danger)';
        } else {
            el.innerHTML =
                `<span class="cycle-pill">Cycle A</span> ${this._ordinal(p1)} → ${this._ordinal(p2 - 1)}&nbsp;&nbsp;` +
                `<span class="cycle-pill cycle-pill-b">Cycle B</span> ${this._ordinal(p2)} → ${this._ordinal(p1 - 1)} <em>(next month)</em>`;
            el.style.color = 'var(--text)';
        }
    },

    _ordinal(n) {
        const s = ['th', 'st', 'nd', 'rd'];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    },

    /* ─────────────── REPORTS ─────────────── */
    openReports() {
        new bootstrap.Modal(document.getElementById('reportsModal')).show();
        setTimeout(() => this.renderReportCharts(), 300);
    },

    renderReportCharts() {
        const cycleInfo = Cycle.getCurrent(this.data.settings, this.data.transactions);
        const catStats = Budget.getCategoryStats(this.data, cycleInfo.cycleStart, cycleInfo.cycleEnd, cycleInfo.cycleLabel);
        const rDonut = document.getElementById('reportDonut');
        const rBar = document.getElementById('reportBar');
        if (this.charts.rDonut) this.charts.rDonut.destroy();
        if (this.charts.rBar) this.charts.rBar.destroy();

        const labels = Object.values(catStats).map(s => s.label);
        const values = Object.values(catStats).map(s => s.spent);
        const colors = Object.values(catStats).map(s => s.color);

        const isDark = document.body.classList.contains('dark-mode');
        const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : '#f3f4f6';
        const tickColor = isDark ? '#94a3b8' : '#6b7280';
        const legendColor = isDark ? '#f8fafc' : '#1f2937';

        this.charts.rDonut = new Chart(rDonut, {
            type: 'doughnut',
            data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 0 }] },
            options: { cutout: '65%', plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 }, color: legendColor } } } }
        });

        const monthly = Budget.getMonthlyReport(this.data);
        this.charts.rBar = new Chart(rBar, {
            type: 'bar',
            data: {
                labels: monthly.map(m => m.label),
                datasets: [{ label: 'Monthly Spending', data: monthly.map(m => m.amount), backgroundColor: 'rgba(13,148,136,0.75)', borderRadius: 8, borderSkipped: false }]
            },
            options: {
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { color: tickColor } },
                    y: { grid: { color: gridColor }, ticks: { color: tickColor, callback: v => '$' + v } }
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

        // Theme Toggle
        document.getElementById('btnThemeToggle').addEventListener('click', () => this.toggleTheme());

        // Modal type switches (Expense / Income)
        document.querySelectorAll('input[name="txType"]').forEach(r => {
            r.addEventListener('change', () => this._syncModalType());
        });

        // Search & Filter input events
        document.getElementById('txSearchInput').addEventListener('input', () => {
            this.txLimit = 10;
            this.renderTransactions();
        });
        document.getElementById('txFilterCategory').addEventListener('change', () => {
            this.txLimit = 10;
            this.renderTransactions();
        });
        document.getElementById('txFilterType').addEventListener('change', () => {
            this.txLimit = 10;
            this.renderTransactions();
        });

        // Load More button click
        document.getElementById('btnLoadMore').addEventListener('click', () => {
            this.txLimit += 10;
            this.renderTransactions();
        });

        document.getElementById('expenseCurrency').addEventListener('change', e => {
            document.getElementById('amountCurrencyLabel').textContent =
                e.target.value === 'KHR' ? '(KHR ÷ 4000 = USD)' : '(USD)';
        });

        // Live cycle preview when payday days change
        ['settingPayday1Day', 'settingPayday2Day'].forEach(id => {
            document.getElementById(id).addEventListener('input', () => this._updateCyclePreview());
        });
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
