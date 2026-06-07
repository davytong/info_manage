// telegram.js — Telegram Bot notifications + Web App bridge

const TG = {
    TOKEN: '8867936853:AAGxjIxuJDIPoac-JfqDTS7DfiJUZ1KVQQk',
    BOT_NAME: '@infomanage_bot',
    CHAT_KEY: 'tg_chat_id',
    NOTIFY_KEY: 'tg_notify_enabled',

    /* ── Chat ID ── */
    getChatId() { return localStorage.getItem(this.CHAT_KEY); },
    setChatId(id) { localStorage.setItem(this.CHAT_KEY, id); },

    /* ── Notifications toggle ── */
    isEnabled() { return localStorage.getItem(this.NOTIFY_KEY) !== 'false'; },
    setEnabled(bool) { localStorage.setItem(this.NOTIFY_KEY, bool ? 'true' : 'false'); },

    /* ── Telegram Web App detection ── */
    isTelegramWebApp() {
        return !!(window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData);
    },

    getTelegramUser() {
        if (!this.isTelegramWebApp()) return null;
        return window.Telegram.WebApp.initDataUnsafe?.user || null;
    },

    /* ── Raw send ── */
    async send(chatId, text, extra = {}) {
        if (!chatId) return { ok: false, error: 'no_chat_id' };
        try {
            const res = await fetch(
                `https://api.telegram.org/bot${this.TOKEN}/sendMessage`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown', ...extra })
                }
            );
            return await res.json();
        } catch (e) {
            return { ok: false, error: e.message };
        }
    },

    /* ── Notify: expense added ── */
    async notifyExpenseAdded(tx, budgets, catStats) {
        if (!this.isEnabled()) return;
        const chatId = this.getChatId();
        if (!chatId) return;

        const cat = budgets[tx.category] || { icon: '💸', label: tx.category };
        const stat = catStats[tx.category];
        const status = stat ? this._statusEmoji(stat.pct) : '';
        const warn = stat && stat.pct >= 80
            ? `\n⚠️ *Warning:* ${cat.label} is at *${stat.pct.toFixed(0)}%* of budget!`
            : '';
        const remaining = stat ? `$${stat.remaining.toFixed(2)} left` : '';

        const msg =
            `${cat.icon} *Expense Logged*\n` +
            `━━━━━━━━━━━━━━━\n` +
            `📂 Category: ${cat.label}\n` +
            `💵 Amount: *$${tx.amount.toFixed(2)}*\n` +
            `📝 Note: ${tx.note || '—'}\n` +
            `📅 Date: ${tx.date}\n` +
            `${status} Budget: ${stat ? stat.pct.toFixed(0) + '%' : '?'} used — ${remaining}` +
            warn;

        await this.send(chatId, msg);
    },

    /* ── Notify: budget warning (80% / 100%) ── */
    async notifyBudgetWarning(catKey, cat, stat) {
        if (!this.isEnabled()) return;
        const chatId = this.getChatId();
        if (!chatId) return;

        const emoji = stat.pct >= 100 ? '🔴' : '🟠';
        const title = stat.pct >= 100 ? 'BUDGET EXCEEDED' : 'Budget Warning';
        const msg =
            `${emoji} *${title}*\n` +
            `━━━━━━━━━━━━━━━\n` +
            `${cat.icon} ${cat.label}\n` +
            `Spent: *$${stat.spent.toFixed(2)}* / $${stat.budget}\n` +
            `${stat.pct >= 100 ? '❌ Over by $' + Math.abs(stat.remaining).toFixed(2) : '⚠️ ' + stat.pct.toFixed(0) + '% used'}`;

        await this.send(chatId, msg);
    },

    /* ── Notify: daily summary ── */
    async notifyDailySummary(data) {
        const chatId = this.getChatId();
        if (!chatId) return;

        const cycleInfo = Cycle.getCurrent(data.settings);
        const cycleTxns = Cycle.getTransactionsForCycle(data.transactions, cycleInfo.cycleStart, cycleInfo.cycleEnd);
        const cycleSpent = cycleTxns.reduce((s, t) => s + t.amount, 0);
        const remaining = cycleInfo.income - cycleSpent;
        const safeDaily = cycleInfo.daysUntilPayday > 0 ? Math.max(0, remaining / cycleInfo.daysUntilPayday) : 0;
        const cycleLabel = Cycle.formatCycleLabel(cycleInfo.cycleStart, cycleInfo.cycleEnd);

        const catStats = Budget.getCategoryStats(data, cycleInfo.cycleStart, cycleInfo.cycleEnd);
        const catLines = Object.entries(catStats)
            .filter(([, s]) => s.spent > 0)
            .map(([, s]) => `${this._statusEmoji(s.pct)} ${s.icon} ${s.label}: $${s.spent.toFixed(2)}/$${s.budget}`)
            .join('\n') || '  No spending yet';

        const safeColor = safeDaily < 5 ? '🔴' : safeDaily < 10 ? '🟠' : '🟢';

        const msg =
            `📊 *Daily Budget Summary*\n` +
            `👤 ${data.settings.name} | ${cycleLabel}\n` +
            `━━━━━━━━━━━━━━━━━━━\n` +
            `💵 Income:    $${cycleInfo.income.toFixed(2)}\n` +
            `💸 Spent:     $${cycleSpent.toFixed(2)}\n` +
            `✅ Remaining: $${remaining.toFixed(2)}\n` +
            `📆 Days left: ${cycleInfo.daysUntilPayday}\n` +
            `${safeColor} Safe/day:  *$${safeDaily.toFixed(2)}*\n` +
            `━━━━━━━━━━━━━━━━━━━\n` +
            `*Categories:*\n${catLines}`;

        return await this.send(chatId, msg);
    },

    /* ── Notify: full report (manual share) ── */
    async notifyFullReport(data) {
        const chatId = this.getChatId();
        if (!chatId) return { ok: false };
        return await this.notifyDailySummary(data);
    },

    /* ── Status emoji helper ── */
    _statusEmoji(pct) {
        if (pct >= 100) return '🔴';
        if (pct >= 80) return '🟠';
        return '🟢';
    },

    /* ── Setup: ask for chat ID if missing ── */
    async ensureChatId() {
        let id = this.getChatId();
        if (id) return id;

        // Try Telegram Web App user
        if (this.isTelegramWebApp()) {
            const user = this.getTelegramUser();
            if (user?.id) {
                this.setChatId(String(user.id));
                return String(user.id);
            }
        }

        id = prompt(
            `📲 Enter your Telegram Chat ID to enable notifications.\n\n` +
            `To get it:\n1. Open Telegram\n2. Send /start to ${this.BOT_NAME}\n3. Visit:\nhttps://api.telegram.org/bot${this.TOKEN}/getUpdates\n4. Look for "chat":{"id": YOUR_ID}`
        );
        if (id) {
            this.setChatId(id.trim());
            // Send a welcome message
            await this.send(id.trim(),
                `✅ *Budget notifications enabled\\!*\n\nHi ${localStorage.getItem('budget_app_v2') ? JSON.parse(localStorage.getItem('budget_app_v2')).settings?.name || 'Davy' : 'Davy'} 👋\nYou'll receive alerts every time you log an expense.`,
                { parse_mode: 'Markdown' }
            );
            return id.trim();
        }
        return null;
    },

    /* ── Schedule daily summary (once per day at 9 PM) ── */
    scheduleDailySummary(data) {
        const DAILY_KEY = 'tg_last_daily';
        const last = localStorage.getItem(DAILY_KEY);
        const today = new Date().toISOString().slice(0, 10);
        const hour = new Date().getHours();

        if (last === today) return;  // already sent today
        if (hour < 21) return;  // not 9 PM yet

        localStorage.setItem(DAILY_KEY, today);
        this.notifyDailySummary(data);
    }
};
