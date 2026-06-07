// cycle.js — Pay cycle logic

const Cycle = {
    /**
     * Get current pay cycle based on today's date and settings.
     * Cycle A: 5th → 14th  (payday on 5th, income $160)
     * Cycle B: 15th → 4th  (payday on 15th, income $160)
     */
    getCurrent(settings) {
        const today = new Date();
        const day = today.getDate();
        const month = today.getMonth();
        const year = today.getFullYear();
        const p1 = settings.payday1.day;  // 5
        const p2 = settings.payday2.day;  // 15

        let cycleStart, cycleEnd, nextPayday, income;

        if (day >= p1 && day < p2) {
            // Cycle A: 5th → 14th
            cycleStart = new Date(year, month, p1);
            cycleEnd = new Date(year, month, p2 - 1);
            nextPayday = new Date(year, month, p2);
            income = settings.payday1.amount;
        } else {
            // Cycle B: 15th → 4th of next month
            if (day >= p2) {
                // in same month from 15th onwards
                cycleStart = new Date(year, month, p2);
                cycleEnd = new Date(year, month + 1, p1 - 1);
                nextPayday = new Date(year, month + 1, p1);
            } else {
                // in next month, days 1–4
                cycleStart = new Date(year, month - 1, p2);
                cycleEnd = new Date(year, month, p1 - 1);
                nextPayday = new Date(year, month, p1);
            }
            income = settings.payday2.amount;
        }

        const daysUntilPayday = Math.max(0, Math.ceil((nextPayday - today) / 86400000));
        const totalDays = Math.round((cycleEnd - cycleStart) / 86400000) + 1;

        return { cycleStart, cycleEnd, nextPayday, income, daysUntilPayday, totalDays };
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
            const d = new Date(tx.date);
            const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!map[k]) map[k] = 0;
            map[k] += tx.amount;
        });
        return map;
    }
};
