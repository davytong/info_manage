// ui.js — UI rendering helpers

const UI = {

  /* ══════════════════════════════════════
     SWEETALERT2 WRAPPERS
  ══════════════════════════════════════ */

  /* ── Toast (top-right, auto-dismiss) ── */
  toast(msg, type = 'success') {
    const iconMap = { success: 'success', error: 'error', info: 'info', warning: 'warning' };
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: iconMap[type] || 'success',
      title: msg,
      showConfirmButton: false,
      timer: 2800,
      timerProgressBar: true,
      customClass: { popup: 'swal-toast-popup' },
      didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer);
        toast.addEventListener('mouseleave', Swal.resumeTimer);
      }
    });
  },

  /* ── Confirm dialog — returns Promise<boolean> ── */
  confirm(opts = {}) {
    const isDanger = opts.icon === 'warning' || opts.danger;
    return Swal.fire({
      title: opts.title || 'Are you sure?',
      html: opts.html || opts.text || '',
      icon: opts.icon || 'question',
      showCancelButton: true,
      confirmButtonText: opts.confirmText || 'Yes',
      cancelButtonText: opts.cancelText || 'Cancel',
      customClass: {
        popup: 'swal-popup',
        confirmButton: isDanger ? 'swal-confirm-btn swal-confirm-danger' : 'swal-confirm-btn',
        cancelButton: 'swal-cancel-btn'
      },
      buttonsStyling: false,
      reverseButtons: true
    }).then(r => r.isConfirmed);
  },

  /* ── Alert ── */
  alert(opts = {}) {
    return Swal.fire({
      title: opts.title || '',
      html: opts.html || opts.text || '',
      icon: opts.icon || 'info',
      confirmButtonText: opts.confirmText || 'OK',
      customClass: { popup: 'swal-popup', confirmButton: 'swal-confirm-btn' },
      buttonsStyling: false
    });
  },

  /* ── Input prompt — returns Promise<string|null> ── */
  prompt(opts = {}) {
    return Swal.fire({
      title: opts.title || 'Enter value',
      html: opts.html || '',
      input: opts.inputType || 'text',
      inputPlaceholder: opts.placeholder || '',
      inputValue: opts.value || '',
      showCancelButton: true,
      confirmButtonText: opts.confirmText || 'OK',
      cancelButtonText: opts.cancelText || 'Cancel',
      customClass: {
        popup: 'swal-popup',
        input: 'swal-input',
        confirmButton: 'swal-confirm-btn',
        cancelButton: 'swal-cancel-btn'
      },
      buttonsStyling: false,
      inputValidator: opts.validator || null
    }).then(r => r.isConfirmed ? r.value : null);
  },

  /* ══════════════════════════════════════
     ANIMATION HELPERS
  ══════════════════════════════════════ */

  animateNumber(el, target, prefix = '$', decimals = 2) {
    const start = parseFloat(el.dataset.current || 0);
    const steps = 600 / 16;
    const inc = (target - start) / steps;
    let current = start;
    let count = 0;
    const tick = () => {
      count++;
      current += inc;
      if (count >= steps) current = target;
      el.textContent = prefix + current.toFixed(decimals);
      el.dataset.current = current;
      if (count < steps) setTimeout(tick, 16);
    };
    tick();
  },

  animateProgressBars() {
    document.querySelectorAll('.progress-fill[data-target]').forEach(el => {
      const target = parseFloat(el.dataset.target);
      setTimeout(() => { el.style.width = target + '%'; }, 50);
    });
  },

  /* ══════════════════════════════════════
     FORMAT HELPERS
  ══════════════════════════════════════ */

  formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  formatUSD(amount) {
    return '$' + Math.abs(amount).toFixed(2);
  },

  /* ══════════════════════════════════════
     RENDER HELPERS
  ══════════════════════════════════════ */

  renderProgressBar(pct, status) {
    const colorMap = { success: 'var(--success)', warning: 'var(--warning)', danger: 'var(--danger)' };
    const color = colorMap[status] || colorMap.success;
    return `<div class="progress-track">
      <div class="progress-fill" style="width:0%;background:${color}" data-target="${pct.toFixed(1)}"></div>
    </div>`;
  },

  renderHero(settings, cycleInfo, cycleSpent, mustRemainInfo) {
    const remaining = cycleInfo.income - cycleSpent;
    const safeDaily = cycleInfo.daysUntilPayday > 0 ? Math.max(0, remaining / cycleInfo.daysUntilPayday) : 0;
    const cycleLabel = Cycle.formatCycleLabel(cycleInfo.cycleStart, cycleInfo.cycleEnd);
    const greetingHour = new Date().getHours();
    const greeting = greetingHour < 12 ? 'Good morning' : greetingHour < 17 ? 'Good afternoon' : 'Good evening';
    const safeDailyColor = safeDaily < 5 ? '#ff5252' : safeDaily < 10 ? '#ff9800' : '#00c853';

    // Must remain info
    const totalMustRemain = mustRemainInfo ? mustRemainInfo.totalMustRemain : 0;
    const totalActualRemaining = mustRemainInfo ? mustRemainInfo.totalActualRemaining : 0;
    const totalDiff = mustRemainInfo ? mustRemainInfo.totalDiff : 0;
    const isOver = mustRemainInfo ? mustRemainInfo.isOver : false;

    const mustRemainHTML = `
      <div class="hero-must-remain">
        <div class="hero-must-remain-title"><i class="fa-solid fa-shield-halved me-1"></i> Must Remain (All Categories)</div>
        <div class="hero-must-remain-row">
          <span class="hero-must-remain-label">Should have left by today</span>
          <span class="hero-must-remain-val mr-plan">$${totalMustRemain.toFixed(2)}</span>
        </div>
        <div class="hero-must-remain-row">
          <span class="hero-must-remain-label">Actually have left</span>
          <span class="hero-must-remain-val mr-actual">$${totalActualRemaining.toFixed(2)}</span>
        </div>
        <div class="hero-must-remain-row hero-must-remain-status">
          <span class="hero-must-remain-label">
            ${isOver ? '<i class="fa-solid fa-circle-exclamation me-1"></i> Over plan by' : '<i class="fa-solid fa-circle-check me-1"></i> Under plan by'}
          </span>
          <span class="hero-must-remain-val mr-diff ${isOver ? 'mr-over' : 'mr-under'}">$${Math.abs(totalDiff).toFixed(2)}</span>
        </div>
      </div>`;

    return `<div class="hero-card glass-card">
      <div class="hero-greeting">${greeting}, ${settings.name} 👋</div>
      <div class="hero-cycle"><i class="fa-solid fa-calendar-days me-1"></i>${cycleLabel}</div>
      <div class="hero-safe-label">Safe to Spend Today</div>
      <div class="hero-safe-amount" style="color:${safeDailyColor}" id="heroSafe">$${safeDaily.toFixed(2)}<span>/day</span></div>
      <div class="hero-stats">
        <div class="hero-stat">
          <div class="hero-stat-val" id="heroIncome">$${cycleInfo.income.toFixed(2)}${cycleInfo.addedIncome > 0 ? `<span style="font-size:.68rem;font-weight:400;display:block;opacity:.85">(+$${cycleInfo.addedIncome.toFixed(0)} added)</span>` : ''}</div>
          <div class="hero-stat-label">Cycle Income</div>
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
      ${mustRemainHTML}
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

  renderIconHTML(iconStr) {
    if (!iconStr) return '';
    if (iconStr.startsWith('fa-') || iconStr.includes(' ')) {
      return `<i class="${iconStr}"></i>`;
    }
    return iconStr;
  },

  renderCategoryCard(key, stats) {
    const s = stats[key];

    if (s.frequency === 'once') {
      // ── One-time payment card ──
      const isActive = s.isActiveCycle;
      const cycleTag = s.payCycle === 'A' ? 'Payday 1' : 'Payday 2';
      const paidLabel = !isActive
        ? `<span class="cat-paid-badge other-cycle">🔒 ${cycleTag}</span>`
        : s.isPaid
          ? `<span class="cat-paid-badge paid">✅ Paid</span>`
          : `<span class="cat-paid-badge unpaid">⏳ ${cycleTag}</span>`;
      return `<div class="col-6 col-md-4 col-lg-3 mb-3 fade-in-card">
        <div class="cat-card cat-card-once ${s.isPaid ? 'cat-card-done' : ''} ${!isActive ? 'cat-card-inactive' : ''}" data-cat="${key}">
          <div class="cat-card-top">
            <div class="cat-icon" style="background:${s.color}22;color:${s.color}">${this.renderIconHTML(s.icon)}</div>
            <button class="cat-edit-btn" onclick="event.stopPropagation();App.openEditCategory('${key}')" title="Edit category">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
          </div>
          <div class="cat-name">${s.label}</div>
          <div class="cat-budget">$${s.cycleBudget.toFixed(2)} <span class="cat-freq-badge">once</span></div>
          ${paidLabel}
          ${isActive ? this.renderProgressBar(s.pct, s.status) : ''}
          ${isActive ? `<div class="cat-amounts">
            <span class="cat-spent">Spent: $${s.spent.toFixed(2)}</span>
            <span class="cat-remain" style="color:${s.over ? 'var(--danger)' : 'var(--success)'}">
              Left: ${s.over ? '-' : ''}$${Math.abs(s.remaining).toFixed(2)}
            </span>
          </div>` : ''}
          <div class="cat-pct-label" style="color:${s.color}">${isActive ? s.pct.toFixed(0) + '%' : '—'}</div>
          <button class="cat-add-btn" onclick="App.openQuickAdd('${key}')">
            <i class="fa-solid fa-plus"></i> Add
          </button>
        </div>
      </div>`;
    }

    // ── Daily spending card ──
    const diffColor = s.diff >= 0 ? 'var(--success)' : 'var(--danger)';
    const diffIcon = s.diff >= 0 
      ? '<i class="fa-solid fa-circle-check me-1"></i>' 
      : '<i class="fa-solid fa-circle-exclamation me-1"></i>';
    return `<div class="col-6 col-md-4 col-lg-3 mb-3 fade-in-card">
      <div class="cat-card" data-cat="${key}">
        <div class="cat-card-top">
          <div class="cat-icon" style="background:${s.color}22;color:${s.color}">${this.renderIconHTML(s.icon)}</div>
          <button class="cat-edit-btn" onclick="event.stopPropagation();App.openEditCategory('${key}')" title="Edit category">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
        </div>
        <div class="cat-name">${s.label}</div>
        <div class="cat-budget">$${s.cycleBudget.toFixed(2)}/cycle • $${s.dailyRate.toFixed(2)}/day</div>
        ${this.renderProgressBar(s.pct, s.status)}
        <div class="cat-amounts">
          <span class="cat-spent">Spent: $${s.spent.toFixed(2)}</span>
          <span class="cat-remain" style="color:${s.over ? 'var(--danger)' : 'var(--success)'}">
            Left: ${s.over ? '-' : ''}$${Math.abs(s.remaining).toFixed(2)}
          </span>
        </div>
        <div class="cat-must-remain">
          <span>Must remain: $${s.mustRemain.toFixed(2)}</span>
          <span style="color:${diffColor}; display:inline-flex; align-items:center;">${diffIcon} ${s.diff >= 0 ? '+' : ''}$${s.diff.toFixed(2)}</span>
        </div>
        <div class="cat-pct-label" style="color:${s.color}">${s.pct.toFixed(0)}%</div>
        <button class="cat-add-btn" onclick="App.openQuickAdd('${key}')">
          <i class="fa-solid fa-plus"></i> Add
        </button>
      </div>
    </div>`;
  },

  renderTransaction(tx, budgets) {
    let cat = budgets[tx.category];
    if (tx.type === 'income' || tx.category === 'income') {
      cat = { icon: 'fa-solid fa-wallet', label: 'Income', color: '#00c853' };
    }
    if (!cat) {
      cat = { icon: 'fa-solid fa-receipt', label: tx.category, color: '#667eea' };
    }
    const isInc = tx.type === 'income';
    const amtColor = isInc ? 'var(--success)' : 'var(--danger)';
    const amtPrefix = isInc ? '+$' : '-$';

    return `<div class="tx-row fade-in-card" data-id="${tx.id}">
      <div class="tx-icon" style="background:${cat.color}22;color:${cat.color}">${this.renderIconHTML(cat.icon)}</div>
      <div class="tx-info">
        <div class="tx-cat">${cat.label}</div>
        <div class="tx-note">${tx.note || '—'}</div>
        <div class="tx-date">${this.formatDate(tx.date)}</div>
      </div>
      <div class="tx-right">
        <div class="tx-amount" style="color:${amtColor}">${amtPrefix}${tx.amount.toFixed(2)}</div>
        <div class="tx-actions">
          <button class="btn-icon" onclick="App.editTransaction('${tx.id}')"><i class="fa-solid fa-pen"></i></button>
          <button class="btn-icon danger" onclick="App.deleteTransaction('${tx.id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    </div>`;
  },

  renderQuickBtn(catKey, cat, amount) {
    return `<button class="quick-btn" style="--qc:${cat.color}" onclick="App.quickAdd('${catKey}', ${amount})">
      <span class="quick-icon">${this.renderIconHTML(cat.icon)}</span>
      <span class="quick-label">+$${amount}</span>
    </button>`;
  },

  /* ── Rebuild category <select> from live data ── */
  rebuildCatSelect(budgets) {
    const sel = document.getElementById('modalCatSelect');
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">— Select Category —</option>' +
      Object.entries(budgets).map(([k, b]) => {
        const iconPrefix = (b.icon.startsWith('fa-') || b.icon.includes(' ')) ? '' : b.icon + ' ';
        return `<option value="${k}">${iconPrefix}${b.label}</option>`;
      }).join('');
    if (current && budgets[current]) sel.value = current;
  },

  rebuildTxFilterCatSelect(budgets) {
    const sel = document.getElementById('txFilterCategory');
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="all">All Categories</option>' +
      '<option value="income">Income</option>' +
      Object.entries(budgets).map(([k, b]) => {
        const iconPrefix = (b.icon.startsWith('fa-') || b.icon.includes(' ')) ? '' : b.icon + ' ';
        return `<option value="${k}">${iconPrefix}${b.label}</option>`;
      }).join('');
    if (current) sel.value = current;
  },

  renderAddCategoryCard() {
    return `<div class="col-6 col-md-4 col-lg-3 mb-3 fade-in-card">
      <div class="cat-card d-flex align-items-center justify-content-center" style="border: 2px dashed var(--border); background: transparent; cursor: pointer; min-height: 195px;" onclick="App.openAddCategory()">
        <div class="text-center">
          <div class="cat-icon mx-auto mb-2" style="background: var(--primary)15; color: var(--primary)">
            <i class="fa-solid fa-folder-plus"></i>
          </div>
          <div class="cat-name">Add Category</div>
          <div class="cat-budget" style="font-size:.7rem; margin-top:2px;">Custom limits</div>
        </div>
      </div>
    </div>`;
  }
};
