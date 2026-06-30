// telegram.js — Telegram Bot notifications + Web App bridge

const TG = {
    TOKEN: '8867936853:AAGxjIxuJDIPoac-JfqDTS7DfiJUZ1KVQQk',
    BOT_NAME: '@infomanage_bot',
    CHAT_KEY: 'tg_chat_id',
    NOTIFY_KEY: 'tg_notify_enabled',

    _getIconEmoji(iconStr) {
        if (!iconStr) return '💸';
        if (!iconStr.startsWith('fa-') && !iconStr.includes(' ')) return iconStr;
        const map = {
            'fa-utensils': '🍔', 'fa-pizza-slice': '🍕', 'fa-mug-hot': '☕', 'fa-cart-shopping': '🛒',
            'fa-gas-pump': '⛽', 'fa-car': '🚗', 'fa-motorcycle': '🏍️', 'fa-bus': '🚌',
            'fa-house': '🏠', 'fa-wrench': '🔧', 'fa-plug': '🔌', 'fa-couch': '🛋️',
            'fa-user-group': '👨‍👩‍👧', 'fa-baby': '👶', 'fa-graduation-cap': '🎓', 'fa-gift': '🎁',
            'fa-shield-halved': '🛡️', 'fa-heart-pulse': '❤️', 'fa-pills': '💊', 'fa-stethoscope': '🩺',
            'fa-user': '👤', 'fa-dumbbell': '🏋️', 'fa-spa': '💆', 'fa-scissors': '✂️',
            'fa-square-parking': '🅿️', 'fa-road': '🚧', 'fa-coins': '🪙', 'fa-wallet': '💰',
            'fa-mobile-screen-button': '📱', 'fa-laptop': '💻', 'fa-gamepad': '🎮', 'fa-camera': '📷',
            'fa-leaf': '🌿', 'fa-wine-glass': '🍷', 'fa-music': '🎵', 'fa-clapperboard': '🎬',
            'fa-book': '📚', 'fa-umbrella-beach': '🏖️', 'fa-briefcase': '💼', 'fa-bullseye': '🎯',
            'fa-folder-open': '📂', 'fa-receipt': '💸'
        };
        for (const [k, v] of Object.entries(map)) {
            if (iconStr.includes(k)) return v;
        }
        return '💸';
    },

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

    /* ── Notify: transaction added ── */
    async notifyExpenseAdded(tx, budgets, catStats) {
        if (!this.isEnabled()) return;
        const chatId = this.getChatId();
        if (!chatId) return;

        const isInc = tx.type === 'income';
        if (isInc) {
            const msg =
                `💰 *Income Logged*\n` +
                `━━━━━━━━━━━━━━━\n` +
                `💵 Amount: *+$${tx.amount.toFixed(2)}*\n` +
                `📝 Source: ${tx.note || '—'}\n` +
                `📅 Date: ${tx.date}`;
            await this.send(chatId, msg);
            return;
        }

        const cat = budgets[tx.category] || { icon: '💸', label: tx.category };
        const stat = catStats[tx.category];
        const status = stat ? this._statusEmoji(stat.pct) : '';
        const warn = stat && stat.pct >= 80
            ? `\n⚠️ *Warning:* ${cat.label} is at *${stat.pct.toFixed(0)}%* of budget!`
            : '';
        const remaining = stat ? `$${stat.remaining.toFixed(2)} left` : '';

        const msg =
            `${this._getIconEmoji(cat.icon)} *Expense Logged*\n` +
            `━━━━━━━━━━━━━━━\n` +
            `📂 Category: ${cat.label}\n` +
            `💵 Amount: *-$${tx.amount.toFixed(2)}*\n` +
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
            `${this._getIconEmoji(cat.icon)} ${cat.label}\n` +
            `Spent: *$${stat.spent.toFixed(2)}* / $${stat.budget}\n` +
            `${stat.pct >= 100 ? '❌ Over by $' + Math.abs(stat.remaining).toFixed(2) : '⚠️ ' + stat.pct.toFixed(0) + '% used'}`;

        await this.send(chatId, msg);
    },

    /* ── Notify: daily summary ── */
    async notifyDailySummary(data) {
        const chatId = this.getChatId();
        if (!chatId) return;

        const cycleInfo = Cycle.getCurrent(data.settings, data.transactions);
        const cycleSpent = cycleInfo.spent;
        const remaining = cycleInfo.remaining;
        const safeDaily = cycleInfo.safeDaily;
        const cycleLabel = Cycle.formatCycleLabel(cycleInfo.cycleStart, cycleInfo.cycleEnd);

        const catStats = Budget.getCategoryStats(data, cycleInfo.cycleStart, cycleInfo.cycleEnd, cycleInfo.cycleLabel);
        const catLines = Object.entries(catStats)
            .filter(([, s]) => s.spent > 0)
            .map(([, s]) => `${this._statusEmoji(s.pct)} ${this._getIconEmoji(s.icon)} ${s.label}: $${s.spent.toFixed(2)}/$${s.budget}`)
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

        // Try Telegram Web App user first (auto, no prompt needed)
        if (this.isTelegramWebApp()) {
            const user = this.getTelegramUser();
            if (user?.id) {
                this.setChatId(String(user.id));
                return String(user.id);
            }
        }

        // SweetAlert2 input dialog
        id = await UI.prompt({
            title: '📲 Connect Telegram',
            html: `Enter your <strong>Chat ID</strong> to enable expense notifications.<br><br>
                         <div style="background:#f4f7ff;border-radius:10px;padding:10px 12px;font-size:.8rem;color:#374151;text-align:left;line-height:1.7">
                           1. Open Telegram → send <code style="background:#e5e7eb;padding:1px 5px;border-radius:4px">/start</code> to <strong>@infomanage_bot</strong><br>
                           2. <a href="https://api.telegram.org/bot${this.TOKEN}/getUpdates" target="_blank" style="color:#667eea;font-weight:600">Click here to get your ID ↗</a><br>
                           3. Look for <code style="background:#e5e7eb;padding:1px 5px;border-radius:4px">"chat":{"id": <em>YOUR_ID</em>}</code>
                         </div>`,
            placeholder: 'e.g. 1386198449',
            inputType: 'text',
            confirmText: 'Connect 🔗',
            cancelText: 'Later',
            validator: v => (v && v.trim()) ? null : 'Please enter your Chat ID'
        });

        if (id) {
            id = id.trim();
            this.setChatId(id);
            const name = (() => {
                try { return JSON.parse(localStorage.getItem('budget_app_v2'))?.settings?.name || 'Davy'; }
                catch { return 'Davy'; }
            })();
            await this.send(id,
                `✅ *Budget notifications enabled\\!*\n\nHi ${name} 👋\nYou'll receive a Telegram alert every time you log an expense.`
            );
            return id;
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
