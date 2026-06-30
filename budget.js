// budget.js — Budget calculations and transaction management

const Budget = {
    /**
     * Add a new transaction
     */
    addTransaction(data, txData) {
        const tx = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2),
            type: txData.type || 'expense',
            category: txData.category,
            amount: txData.amount,
            note: txData.note || '',
            date: txData.date || new Date().toISOString().slice(0, 10)
        };
        data.transactions.unshift(tx);
        Storage.save(data);
        return tx;
    },

    /**
     * Update a transaction
     */
    updateTransaction(data, id, updates) {
        const idx = data.transactions.findIndex(t => t.id === id);
        if (idx === -1) return false;
        data.transactions[idx] = { ...data.transactions[idx], ...updates };
        Storage.save(data);
        return true;
    },

    /**
     * Delete a transaction
     */
    deleteTransaction(data, id) {
        data.transactions = data.transactions.filter(t => t.id !== id);
        Storage.save(data);
    },

    /**
     * Get category stats for the current cycle.
     * 
     * frequency: 'daily' → budget split evenly across both cycles, spread per day
     * frequency: 'once'  → full budget assigned to payCycle ('A' or 'B'), $0 in other cycle
     *
     * payCycle: 'A' = paid on payday1 cycle, 'B' = paid on payday2 cycle
     */
    getCategoryStats(data, cycleStart, cycleEnd, currentCycleLabel) {
        const cycleTxns = Cycle.getTransactionsForCycle(data.transactions, cycleStart, cycleEnd);
        const spending = Cycle.getSpendingByCategory(cycleTxns);

        // Calculate days in this cycle and days elapsed
        const today = new Date();
        const todayClean = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const startClean = new Date(cycleStart.getFullYear(), cycleStart.getMonth(), cycleStart.getDate());
        const endClean = new Date(cycleEnd.getFullYear(), cycleEnd.getMonth(), cycleEnd.getDate());
        const totalCycleDays = Math.round((endClean - startClean) / 86400000) + 1;
        const daysElapsed = Math.max(1, Math.floor((todayClean - startClean) / 86400000) + 1);

        const stats = {};

        Object.entries(data.budgets).forEach(([key, budget]) => {
            const freq = budget.frequency || 'daily';
            const spent = spending[key] || 0;

            let cycleBudget, dailyRate, mustRemain, diff, isPaid;

            if (freq === 'once') {
                // One-time: full budget goes to assigned cycle, $0 in the other
                const assignedCycle = budget.payCycle || 'A';
                const isThisCycle = (assignedCycle === currentCycleLabel);
                cycleBudget = isThisCycle ? budget.budget : 0;
                dailyRate = 0;
                isPaid = spent >= cycleBudget && cycleBudget > 0;

                if (!isThisCycle) {
                    // Not this cycle's responsibility
                    mustRemain = 0;
                    diff = 0;
                } else {
                    mustRemain = isPaid ? 0 : cycleBudget;
                    diff = (cycleBudget - spent) - mustRemain;
                }
            } else {
                // Daily: split evenly across 2 cycles
                cycleBudget = budget.budget / 2;
                dailyRate = cycleBudget / totalCycleDays;
                mustRemain = cycleBudget - (dailyRate * daysElapsed);
                diff = (cycleBudget - spent) - mustRemain;
                isPaid = false;
            }

            const remaining = cycleBudget - spent;
            const pct = cycleBudget > 0 ? (spent / cycleBudget) * 100 : 0;

            stats[key] = {
                ...budget,
                frequency: freq,
                payCycle: budget.payCycle || null,
                currentCycleLabel,
                cycleBudget,        // budget for THIS cycle
                dailyRate,          // planned daily spending (0 for 'once')
                spent,              // actual spent this cycle
                remaining,          // actual remaining (cycleBudget - spent)
                mustRemain,         // what SHOULD remain by today
                diff,               // remaining vs mustRemain (+ = good, - = overspent)
                isPaid,
                isActiveCycle: freq !== 'once' || (budget.payCycle === currentCycleLabel),
                pct: Math.min(pct, 100),
                over: remaining < 0,
                status: pct >= 100 ? 'danger' : pct >= 80 ? 'warning' : 'success'
            };
        });

        return stats;
    },

    /**
     * Get overall must-remain summary for the hero section
     */
    getMustRemainInfo(data, catStats) {
        const settings = data.settings;
        const totalMonthlyBudget = Object.values(data.budgets).reduce((sum, b) => sum + b.budget, 0);
        const totalMonthlyIncome = settings.monthlyIncome;

        const totalMustRemain = Object.values(catStats).reduce((s, c) => s + c.mustRemain, 0);
        const totalActualRemaining = Object.values(catStats).reduce((s, c) => s + c.remaining, 0);
        const totalDiff = totalActualRemaining - totalMustRemain;

        return {
            totalMonthlyBudget,
            totalMonthlyIncome,
            totalMustRemain,         // what should remain across all categories
            totalActualRemaining,    // what actually remains
            totalDiff,               // + under budget, - overspent
            isOver: totalDiff < 0
        };
    },

    /**
     * Convert USD <-> KHR
     */
    convertCurrency(amount, from, to, rate) {
        if (from === to) return amount;
        if (from === 'USD' && to === 'KHR') return amount * rate;
        if (from === 'KHR' && to === 'USD') return amount / rate;
        return amount;
    },

    /**
     * Get last N transactions
     */
    getRecentTransactions(data, n = 10) {
        return [...data.transactions].slice(0, n);
    },

    /**
     * Get monthly spending for the last 6 months
     */
    getMonthlyReport(data) {
        const monthly = Cycle.getMonthlySpending(data.transactions);
        const result = [];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            result.push({
                label: d.toLocaleString('en', { month: 'short', year: '2-digit' }),
                amount: monthly[k] || 0
            });
        }
        return result;
    }
};
