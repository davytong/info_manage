// storage.js — localStorage helpers

const DB_KEY = 'budget_app_v2';

const Storage = {
    _defaults() {
        return {
            settings: {
                name: 'Davy',
                monthlyIncome: 320,
                payday1: { day: 6, amount: 160 },
                payday2: { day: 21, amount: 160 },
                exchangeRate: 4000,
                currency: 'USD'
            },
            budgets: {
                food: { label: 'Food', icon: 'fa-solid fa-utensils', color: '#ff6b35', budget: 145, frequency: 'daily' },
                gasoline: { label: 'Gasoline', icon: 'fa-solid fa-gas-pump', color: '#00b4d8', budget: 20, frequency: 'daily' },
                home: { label: 'Home & Utilities', icon: 'fa-solid fa-house', color: '#7c3aed', budget: 60, frequency: 'once', payCycle: 'B' },
                family: { label: 'MoM Bank', icon: 'fa-solid fa-building-columns', color: '#ec4899', budget: 50, frequency: 'once', payCycle: 'A' },
                vehicle: { label: 'Vehicle', icon: 'fa-solid fa-car', color: '#ef4444', budget: 10, frequency: 'once', payCycle: 'A' },
                parking: { label: 'Parking', icon: 'fa-solid fa-square-parking', color: '#14b8a6', budget: 10, frequency: 'once', payCycle: 'B' },
                emergency: { label: 'Emergency', icon: 'fa-solid fa-shield-halved', color: '#6366f1', budget: 20, frequency: 'daily' },
                personal: { label: 'Personal', icon: 'fa-solid fa-user', color: '#f43f5e', budget: 5, frequency: 'daily' }
            },
            transactions: []
        };
    },

    _migrateEmojis(data) {
        const emojiMap = {
            '🍔': 'fa-solid fa-utensils',
            '⛽': 'fa-solid fa-gas-pump',
            '🏠': 'fa-solid fa-house',
            '🏦': 'fa-solid fa-building-columns',
            '🚗': 'fa-solid fa-car',
            '🅿️': 'fa-solid fa-square-parking',
            '🛡️': 'fa-solid fa-shield-halved',
            '👤': 'fa-solid fa-user',
            '📂': 'fa-solid fa-folder-open'
        };
        if (data && data.budgets) {
            Object.values(data.budgets).forEach(b => {
                if (emojiMap[b.icon]) {
                    b.icon = emojiMap[b.icon];
                }
            });
        }
        if (data && data.settings) {
            if (data.settings.payday1 && data.settings.payday1.day === 5) {
                data.settings.payday1.day = 6;
            }
            if (data.settings.payday2 && data.settings.payday2.day === 15) {
                data.settings.payday2.day = 21;
            }
        }
        return data;
    },

    load() {
        try {
            const raw = localStorage.getItem(DB_KEY);
            if (!raw) return this._migrateEmojis(this._defaults());
            const data = JSON.parse(raw);
            const def = this._defaults();
            // Deep-merge payday objects so .day is never lost
            const p1 = { ...def.settings.payday1, ...(data.settings?.payday1 || {}) };
            const p2 = { ...def.settings.payday2, ...(data.settings?.payday2 || {}) };
            const loaded = {
                settings: { ...def.settings, ...(data.settings || {}), payday1: p1, payday2: p2 },
                budgets: { ...def.budgets, ...(data.budgets || {}) },
                transactions: data.transactions || []
            };
            return this._migrateEmojis(loaded);
        } catch {
            return this._migrateEmojis(this._defaults());
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
