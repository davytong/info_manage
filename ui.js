// ui.js — UI rendering helpers

const UI = {
    /* ── Toasts ── */
    toast(msg, type = 'success') {
        const colors = { success: '#00c853', error: '#ff5252', info: '#00bcd4', warning: '#ff9800' };
        const t = document.createElement('div');
        t.className = 'app-toast';
        t.style.cssText = `background:${colors[type] || colors.success};`;
        t.innerHTML = `<span>${msg}</span>`;
        document.body.appendChild(t);
        setTimeout(() => t.classList.add('show'), 10);
        setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 2800);
    },

    /* ── Number counter animation ── */
    animateNumber(el, target, prefix = '$', decimals = 2) {
        const start = parseFloat(el.dataset.current || 0);
        const duration = 600;
        const step = 16;
        const steps = duration / step;
        const inc = (target - start) / steps;
        let current = start;
        let count = 0;
        const tick = () => {
            count++;
            current += inc;
            if (count >= steps) { current = target; }
            el.textContent = prefix + current.toFixed(decimals);
            el.dataset.current = current;
            if (count < steps) setTimeout(tick, step);
        };
        tick();
    },

    /* ── Progress bar ── */
    renderProgressBar(pct, status) {
        const colorMap = { success: 'var(--success)', warning: 'var(--warning)', danger: 'var(--danger)' };
        const color = colorMap[status] || colorMap.success;
        return `<div class="progress-track">
      <div class="progress-fill" style="width:0%;background:${color}" data-target="${pct.toFixed(1)}"></div>
    </div>`;
    },

    /* ── Animate progress bars (call after DOM insert) ── */
    animateProgressBars() {
        document.querySelectorAll('.progress-fill[data-target]').forEach(el => {
            const target = parseFloat(el.dataset.target);
            setTimeout(() => { el.style.width = target + '%'; }, 50);
        });
    },

    /* ── Format date ── */
    formatDate(dateStr) {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
    },

    /* ── Format currency ── */
    formatUSD(amount) {
        return '$' + Math.abs(amount).toFixed(2);
    },

    /* ── Hero section ── */
    renderHero(settings, cycleInfo, cycleSpent) {
        const remaining = cycleInfo.income - cycleSpent;
        const safeDaily = cycleInfo.daysUntilPayday > 0 ? Math.max(0, remaining / cycleInfo.daysUntilPayday) : 0;
        const cycleLabel = Cycle.formatCycleLabel(cycleInfo.cycleStart, cycleInfo.cycleEnd);
        const greetingHour = new Date().getHours();
        const greeting = greetingHour < 12 ? 'Good morning' : greetingHour < 17 ? 'Good afternoon' : 'Good evening';
        const safeDailyColor = safeDaily < 5 ? '#ff5252' : safeDaily < 10 ? '#ff9800' : '#00c853';

        return `<div class="hero-card glass-card">
      <div class="hero-greeting">${greeting}, ${settings.name} 👋</div>
      <div class="hero-cycle"><i class="fa-solid fa-calendar-days me-1"></i>${cycleLabel}</div>
      <div class="hero-safe-label">Safe to Spend Today</div>
      <div class="hero-safe-amount" style="color:${safeDailyColor}" id="heroSafe">$${safeDaily.toFixed(2)}<span>/day</span></div>
      <div class="hero-stats">
        <div class="hero-stat">
          <div class="hero-stat-val" id="heroIncome">$${cycleInfo.income.toFixed(2)}</div>
          <div class="hero-stat-label">Income</div>
        </div>
        <div class="hero-stat">
          <div class="hero-stat-val text-warning" id="heroSpent">$${cycleSpent.toFixed(2)}</div>
          <div class="hero-stat-label">Spent</div>
        </div>
        <div class="hero-stat">
          <div class="hero-stat-val" style="color:${remaining < 0 ? 'var(--danger)' : 'var(--success)'}" id="heroRemain">$${remaining.toFixed(2)}</div>
          <div class="hero-stat-label">Remaining</div>
        </div>
        <div class="hero-stat">
          <div class="hero-stat-val text-info" id="heroDays">${cycleInfo.daysUntilPayday}</div>
          <div class="hero-stat-label">Days Left</div>
        </div>
      </div>
      <div class="hero-progress-wrap">
        <div class="d-flex justify-content-between mb-1 small" style="opacity:.8">
          <span>Cycle Budget Used</span>
          <span>${cycleInfo.income > 0 ? ((cycleSpent / cycleInfo.income) * 100).toFixed(0) : 0}%</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width:0%;background:${safeDailyColor}" data-target="${cycleInfo.income > 0 ? Math.min((cycleSpent / cycleInfo.income) * 100, 100).toFixed(1) : 0}"></div>
        </div>
      </div>
    </div>`;
    },

    /* ── Category card ── */
    renderCategoryCard(key, stats) {
        const s = stats[key];
        return `<div class="col-6 col-md-4 col-lg-3 mb-3 fade-in-card">
      <div class="cat-card" data-cat="${key}" onclick="App.openQuickAdd('${key}')">
        <div class="cat-icon" style="background:${s.color}22;color:${s.color}">${s.icon}</div>
        <div class="cat-name">${s.label}</div>
        <div class="cat-budget">Budget: $${s.budget}</div>
        ${this.renderProgressBar(s.pct, s.status)}
        <div class="cat-amounts">
          <span class="cat-spent">$${s.spent.toFixed(2)}</span>
          <span class="cat-remain" style="color:${s.over ? 'var(--danger)' : 'var(--success)'}">
            ${s.over ? '-' : ''}$${Math.abs(s.remaining).toFixed(2)}
          </span>
        </div>
        <div class="cat-pct-label" style="color:${s.color}">${s.pct.toFixed(0)}%</div>
      </div>
    </div>`;
    },

    /* ── Transaction row ── */
    renderTransaction(tx, budgets) {
        const cat = budgets[tx.category] || { icon: '💸', label: tx.category, color: '#667eea' };
        return `<div class="tx-row fade-in-card" data-id="${tx.id}">
      <div class="tx-icon" style="background:${cat.color}22;color:${cat.color}">${cat.icon}</div>
      <div class="tx-info">
        <div class="tx-cat">${cat.label}</div>
        <div class="tx-note">${tx.note || '—'}</div>
        <div class="tx-date">${this.formatDate(tx.date)}</div>
      </div>
      <div class="tx-right">
        <div class="tx-amount">-$${tx.amount.toFixed(2)}</div>
        <div class="tx-actions">
          <button class="btn-icon" onclick="App.editTransaction('${tx.id}')"><i class="fa-solid fa-pen"></i></button>
          <button class="btn-icon danger" onclick="App.deleteTransaction('${tx.id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    </div>`;
    },

    /* ── Quick action button ── */
    renderQuickBtn(catKey, cat, amount) {
        return `<button class="quick-btn" style="--qc:${cat.color}" onclick="App.quickAdd('${catKey}', ${amount})">
      <span class="quick-icon">${cat.icon}</span>
      <span class="quick-label">+$${amount}</span>
    </button>`;
    }
};
