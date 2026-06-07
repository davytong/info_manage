// storage.js — localStorage helpers

const DB_KEY = 'budget_app_v2';

const Storage = {
    _defaults() {
        return {
            settings: {
                name: 'Davy',
                monthlyIncome: 320,
                payday1: { day: 5, amount: 160 },
                payday2: { day: 15, amount: 160 },
                exchangeRate: 4000,
                currency: 'USD'
            },
            budgets: {
                food: { label: 'Food', icon: '🍔', color: '#ff6b35', budget: 145 },
                gasoline: { label: 'Gasoline', icon: '⛽', color: '#2196f3', budget: 20 },
                home: { label: 'Home', icon: '🏠', color: '#9c27b0', budget: 60 },
                family: { label: 'Family', icon: '👨‍👩‍👧', color: '#4caf50', budget: 50 },
                vehicle: { label: 'Vehicle', icon: '🚗', color: '#f44336', budget: 10 },
                parking: { label: 'Parking', icon: '🅿️', color: '#009688', budget: 10 },
                emergency: { label: 'Emergency', icon: '🛡️', color: '#3f51b5', budget: 20 },
                personal: { label: 'Personal', icon: '👤', color: '#e91e63', budget: 5 }
            },
            transactions: []
        };
    },

    load() {
        try {
            const raw = localStorage.getItem(DB_KEY);
            if (!raw) return this._defaults();
            const data = JSON.parse(raw);
            const def = this._defaults();
            // Deep-merge payday objects so .day is never lost
            const p1 = { ...def.settings.payday1, ...(data.settings?.payday1 || {}) };
            const p2 = { ...def.settings.payday2, ...(data.settings?.payday2 || {}) };
            return {
                settings: { ...def.settings, ...(data.settings || {}), payday1: p1, payday2: p2 },
                budgets: { ...def.budgets, ...(data.budgets || {}) },
                transactions: data.transactions || []
            };
        } catch {
            return this._defaults();
        }
    },

    save(data) {
        localStorage.setItem(DB_KEY, JSON.stringify(data));
    },

    exportJSON() {
        const data = this.load();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `budget-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    },

    importJSON(file, callback) {
        const reader = new FileReader();
        reader.onload = e => {
            try {
                const data = JSON.parse(e.target.result);
                this.save(data);
                callback(true);
            } catch {
                callback(false);
            }
        };
        reader.readAsText(file);
    }
};
