// cycle.js — Pay cycle logic

const Cycle = {
    /**
     * Get current pay cycle based on today's date and settings.
     *
     * Cycle A: payday1.day  →  (payday2.day - 1)    e.g. 5th  → 14th
     * Cycle B: payday2.day  →  (payday1.day - 1)    e.g. 15th →  4th (crosses month)
     *
     * Both payday days are fully configurable via settings.
     */
    getCurrent(settings, transactions = []) {
        const today = new Date();
        const day = today.getDate();
        const month = today.getMonth();
        const year = today.getFullYear();
        const p1 = settings.payday1.day;   // default 5
        const p2 = settings.payday2.day;   // default 15

        let cycleStart, cycleEnd, nextPayday, income, cycleLabel;

        if (day >= p1 && day < p2) {
            // ── Cycle A: p1 → (p2-1), same month ──
            cycleStart = new Date(year, month, p1);
            cycleEnd = new Date(year, month, p2 - 1);
            nextPayday = new Date(year, month, p2);
            income = settings.payday1.amount;
            cycleLabel = 'A';
        } else {
            // ── Cycle B: p2 → (p1-1 next month), crosses month boundary ──
            if (day >= p2) {
                cycleStart = new Date(year, month, p2);
                cycleEnd = new Date(year, month + 1, p1 - 1);
                nextPayday = new Date(year, month + 1, p1);
            } else {
                // early in month (days 1 → p1-1)
                cycleStart = new Date(year, month - 1, p2);
                cycleEnd = new Date(year, month, p1 - 1);
                nextPayday = new Date(year, month, p1);
            }
            income = settings.payday2.amount;
            cycleLabel = 'B';
        }

        const daysUntilPayday = Math.max(0, Math.ceil((nextPayday - today) / 86400000));
        const totalDays = Math.round((cycleEnd - cycleStart) / 86400000) + 1;

        // Dynamic Calculations
        const cycleTxns = this.getTransactionsForCycle(transactions, cycleStart, cycleEnd);
        const cycleSpent = cycleTxns.filter(t => t.type !== 'income').reduce((s, t) => s + t.amount, 0);
        const cycleAddedIncome = cycleTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
        
        const totalIncome = income + cycleAddedIncome;
        const remaining = totalIncome - cycleSpent;
        const safeDaily = daysUntilPayday > 0 ? Math.max(0, remaining / daysUntilPayday) : 0;

        return { 
            cycleStart, 
            cycleEnd, 
            nextPayday, 
            baseIncome: income, 
            addedIncome: cycleAddedIncome,
            income: totalIncome, 
            spent: cycleSpent,
            remaining,
            daysUntilPayday, 
            totalDays,
            cycleLabel,
            safeDaily
        };
    },

    /**
     * Filter transactions that fall within the current cycle
     */
    getTransactionsForCycle(transactions, cycleStart, cycleEnd) {
        return transactions.filter(tx => {
            const d = new Date(tx.date);
            // zero out time for comparison
            const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            const s = new Date(cycleStart.getFullYear(), cycleStart.getMonth(), cycleStart.getDate());
            const e = new Date(cycleEnd.getFullYear(), cycleEnd.getMonth(), cycleEnd.getDate());
            return day >= s && day <= e;
        });
    },

    /**
     * Format a date range label like "5 Jun → 14 Jun"
     */
    formatCycleLabel(start, end) {
        const fmt = d => `${d.getDate()} ${d.toLocaleString('en', { month: 'short' })}`;
        return `${fmt(start)} → ${fmt(end)}`;
    },

    /**
     * Get spending per category within the given cycle transactions
     */
    getSpendingByCategory(cycleTxns) {
        const map = {};
        cycleTxns.forEach(tx => {
            if (tx.type === 'income') return;
            if (!map[tx.category]) map[tx.category] = 0;
            map[tx.category] += tx.amount;
        });
        return map;
    },

    /**
     * Get monthly spending summary (all transactions grouped by month)
     */
    getMonthlySpending(transactions) {
        const map = {};
        transactions.forEach(tx => {
            if (tx.type === 'income') return;
            const d = new Date(tx.date);
            const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!map[k]) map[k] = 0;
            map[k] += tx.amount;
        });
        return map;
    }
};
