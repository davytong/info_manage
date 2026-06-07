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
    return Swal.fire({
      title: opts.title || 'Are you sure?',
      html: opts.html || opts.text || '',
      icon: opts.icon || 'question',
      showCancelButton: true,
      confirmButtonText: opts.confirmText || 'Yes',
      cancelButtonText: opts.cancelText || 'Cancel',
      confirmButtonColor: opts.icon === 'warning' ? '#ff5252' : '#667eea',
      cancelButtonColor: '#9ca3af',
      customClass: {
        popup: 'swal-popup',
        confirmButton: 'swal-confirm-btn',
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
      confirmButtonColor: '#667eea',
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
      confirmButtonColor: '#667eea',
      cancelButtonColor: '#9ca3af',
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

  renderCategoryCard(key, stats) {
    const s = stats[key];
    return `<div class="col-6 col-md-4 col-lg-3 mb-3 fade-in-card">
      <div class="cat-card" data-cat="${key}">
        <div class="cat-card-top">
          <div class="cat-icon" style="background:${s.color}22;color:${s.color}">${s.icon}</div>
          <button class="cat-edit-btn" onclick="event.stopPropagation();App.openEditCategory('${key}')" title="Edit category">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
        </div>
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
        <button class="cat-add-btn" onclick="App.openQuickAdd('${key}')">
          <i class="fa-solid fa-plus"></i> Add
        </button>
      </div>
    </div>`;
  },

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

  renderQuickBtn(catKey, cat, amount) {
    return `<button class="quick-btn" style="--qc:${cat.color}" onclick="App.quickAdd('${catKey}', ${amount})">
      <span class="quick-icon">${cat.icon}</span>
      <span class="quick-label">+$${amount}</span>
    </button>`;
  },

  /* ── Rebuild category <select> from live data ── */
  rebuildCatSelect(budgets) {
    const sel = document.getElementById('modalCatSelect');
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">— Select Category —</option>' +
      Object.entries(budgets).map(([k, b]) =>
        `<option value="${k}">${b.icon} ${b.label}</option>`
      ).join('');
    if (current && budgets[current]) sel.value = current;
  }
};
