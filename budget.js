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
     * Get category stats for the current cycle
     */
    getCategoryStats(data, cycleStart, cycleEnd) {
        const cycleTxns = Cycle.getTransactionsForCycle(data.transactions, cycleStart, cycleEnd);
        const spending = Cycle.getSpendingByCategory(cycleTxns);
        const stats = {};

        Object.entries(data.budgets).forEach(([key, budget]) => {
            const spent = spending[key] || 0;
            const remaining = budget.budget - spent;
            const pct = budget.budget > 0 ? (spent / budget.budget) * 100 : 0;
            stats[key] = {
                ...budget,
                spent,
                remaining,
                pct: Math.min(pct, 100),
                over: remaining < 0,
                status: pct >= 100 ? 'danger' : pct >= 80 ? 'warning' : 'success'
            };
        });

        return stats;
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
