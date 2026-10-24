// js/app.js - Main UI application controller, DOM rendering, modal handling, offline/online synchronization
window.TripSplit = window.TripSplit || {};

(function() {
  const { i18n, storage, currency, settlement } = window.TripSplit;
  const t = i18n.t;

  // Application State
  let appData = null;
  let currentTrip = null;
  let activeRates = null;
  let editingExpenseId = null;

  // Escape HTML helper for security
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Toast notification
  function showToast(message) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // Copy to clipboard with file:// fallback
  async function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {
        // fallback
      }
    }
    // Fallback using textarea + execCommand
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      textArea.remove();
      return successful;
    } catch (e) {
      return false;
    }
  }

  // Initialize App
  async function init() {
    appData = storage.loadData();
    activeRates = currency.getActiveRates();

    // Check storage availability
    if (!storage.isAvailable()) {
      const banner = document.getElementById('storageWarningBanner');
      if (banner) banner.style.display = 'flex';
    }

    setupEventListeners();
    updateOnlineStatus();
    updateRatesBadge();

    // Attempt to fetch live rates on startup
    refreshExchangeRates(false);

    // Load initial trip or dashboard
    if (appData.currentTripId) {
      const trip = appData.trips.find(t => t.id === appData.currentTripId);
      if (trip) {
        openTrip(trip.id);
      } else {
        showDashboard();
      }
    } else {
      showDashboard();
    }

    // Setup initial language buttons
    updateLanguageButtons();
    applyTranslations();
  }

  // Event Listeners
  function setupEventListeners() {
    // Network listeners
    window.addEventListener('online', () => {
      updateOnlineStatus();
      refreshExchangeRates(false);
    });
    window.addEventListener('offline', () => {
      updateOnlineStatus();
    });

    // Language buttons
    document.querySelectorAll('[data-lang]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const lang = e.currentTarget.getAttribute('data-lang');
        i18n.setLang(lang);
      });
    });

    // Refresh rates button
    const refreshBtn = document.getElementById('refreshRatesBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => refreshExchangeRates(true));
    }

    // Modal close buttons
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        closeAllModals();
      });
    });

    // Dashboard Buttons
    const newTripBtn = document.getElementById('newTripBtn');
    if (newTripBtn) {
      newTripBtn.addEventListener('click', () => openModal('newTripModal'));
    }

    const backToTripsBtn = document.getElementById('backToTripsBtn');
    if (backToTripsBtn) {
      backToTripsBtn.addEventListener('click', showDashboard);
    }

    const resetAllBtn = document.getElementById('resetAllDataBtn');
    if (resetAllBtn) {
      resetAllBtn.addEventListener('click', () => openModal('resetConfirmModal'));
    }

    const exportBtn = document.getElementById('exportJsonBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', handleExportJSON);
    }

    const importInput = document.getElementById('importJsonInput');
    if (importInput) {
      importInput.addEventListener('change', handleImportJSON);
    }

    // Trip actions inside trip view
    const addExpenseBtn = document.getElementById('addExpenseBtn');
    if (addExpenseBtn) {
      addExpenseBtn.addEventListener('click', () => openExpenseModal(null));
    }

    const renameTripBtn = document.getElementById('renameTripBtn');
    if (renameTripBtn) {
      renameTripBtn.addEventListener('click', () => {
        if (!currentTrip) return;
        document.getElementById('renameTripInput').value = currentTrip.name;
        openModal('renameTripModal');
      });
    }

    const deleteTripBtn = document.getElementById('deleteTripBtn');
    if (deleteTripBtn) {
      deleteTripBtn.addEventListener('click', () => {
        if (!currentTrip) return;
        document.getElementById('deleteTripPrompt').textContent = t('confirm_delete_trip', { name: currentTrip.name });
        openModal('deleteTripModal');
      });
    }

    const copySummaryBtn = document.getElementById('copySummaryBtn');
    if (copySummaryBtn) {
      copySummaryBtn.addEventListener('click', handleCopySummary);
    }

    // Inline participant form
    const addParticipantForm = document.getElementById('addParticipantForm');
    if (addParticipantForm) {
      addParticipantForm.addEventListener('submit', handleAddParticipant);
    }

    // Forms
    const newTripForm = document.getElementById('newTripForm');
    if (newTripForm) {
      newTripForm.addEventListener('submit', handleCreateTrip);
    }

    const renameTripForm = document.getElementById('renameTripForm');
    if (renameTripForm) {
      renameTripForm.addEventListener('submit', handleRenameTrip);
    }

    const editParticipantForm = document.getElementById('editParticipantForm');
    if (editParticipantForm) {
      editParticipantForm.addEventListener('submit', handleEditParticipant);
    }

    const confirmDeleteTripBtn = document.getElementById('confirmDeleteTripBtn');
    if (confirmDeleteTripBtn) {
      confirmDeleteTripBtn.addEventListener('click', handleConfirmDeleteTrip);
    }

    const confirmResetBtn = document.getElementById('confirmResetBtn');
    if (confirmResetBtn) {
      confirmResetBtn.addEventListener('click', handleConfirmReset);
    }

    const expenseForm = document.getElementById('expenseForm');
    if (expenseForm) {
      expenseForm.addEventListener('submit', handleSaveExpense);
    }

    // Expense Form interactions
    const expenseAmountInput = document.getElementById('expenseAmount');
    const expenseCurrencySelect = document.getElementById('expenseCurrency');
    const overrideRateCheckbox = document.getElementById('overrideRateCheckbox');
    const customRateInput = document.getElementById('customRateInput');

    if (expenseAmountInput) {
      expenseAmountInput.addEventListener('input', updateExpenseRateSnapshotPreview);
    }
    if (expenseCurrencySelect) {
      expenseCurrencySelect.addEventListener('change', updateExpenseRateSnapshotPreview);
    }
    if (overrideRateCheckbox) {
      overrideRateCheckbox.addEventListener('change', (e) => {
        const rateBox = document.getElementById('overrideRateBox');
        if (rateBox) rateBox.style.display = e.target.checked ? 'block' : 'none';
        updateExpenseRateSnapshotPreview();
      });
    }
    if (customRateInput) {
      customRateInput.addEventListener('input', updateExpenseRateSnapshotPreview);
    }

    // Split method radio
    document.querySelectorAll('input[name="splitMethod"]').forEach(r => {
      r.addEventListener('change', handleSplitMethodChange);
    });

    const selectAllBtn = document.getElementById('selectAllParticipantsBtn');
    if (selectAllBtn) {
      selectAllBtn.addEventListener('click', () => {
        document.querySelectorAll('#splitCheckboxesContainer input[type="checkbox"]').forEach(c => c.checked = true);
        handleSplitSelectionChange();
      });
    }

    const deselectAllBtn = document.getElementById('deselectAllParticipantsBtn');
    if (deselectAllBtn) {
      deselectAllBtn.addEventListener('click', () => {
        document.querySelectorAll('#splitCheckboxesContainer input[type="checkbox"]').forEach(c => c.checked = false);
        handleSplitSelectionChange();
      });
    }

    // Currency Converter widget
    const convertBtn = document.getElementById('runConverterBtn');
    if (convertBtn) {
      convertBtn.addEventListener('click', runCurrencyConverter);
    }
    const swapBtn = document.getElementById('swapConverterBtn');
    if (swapBtn) {
      swapBtn.addEventListener('click', swapCurrencyConverter);
    }
    const convAmtInput = document.getElementById('converterAmount');
    if (convAmtInput) {
      convAmtInput.addEventListener('input', runCurrencyConverter);
    }
    const convFromSelect = document.getElementById('converterFrom');
    if (convFromSelect) {
      convFromSelect.addEventListener('change', runCurrencyConverter);
    }
    const convToSelect = document.getElementById('converterTo');
    if (convToSelect) {
      convToSelect.addEventListener('change', runCurrencyConverter);
    }
  }

  // Language Change callback
  function onLanguageChange() {
    updateLanguageButtons();
    applyTranslations();
    if (currentTrip) {
      renderTripDetails();
    } else {
      renderDashboard();
    }
    updateRatesBadge();
  }

  function updateLanguageButtons() {
    const cur = i18n.getLang();
    document.querySelectorAll('[data-lang]').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-lang') === cur);
    });
  }

  function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      el.textContent = t(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      el.placeholder = t(key);
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      el.title = t(key);
    });
  }

  // Network & Rates Display
  function updateOnlineStatus() {
    const isOnline = navigator.onLine;
    const badge = document.getElementById('networkStatusBadge');
    if (badge) {
      badge.textContent = isOnline ? t('status_online') : t('status_offline');
      badge.className = `badge ${isOnline ? 'badge-online' : 'badge-offline'}`;
    }
  }

  async function refreshExchangeRates(notifyUser = true) {
    const base = currentTrip ? currentTrip.baseCurrency : 'AZN';
    const res = await currency.fetchLiveRates(base);
    activeRates = currency.getActiveRates();
    updateRatesBadge();

    if (notifyUser) {
      if (res.success) {
        showToast(t('rates_live', { time: activeRates.dateStr }));
      } else {
        showToast(t('rates_fallback', { date: activeRates.dateStr }));
      }
    }
  }

  function updateRatesBadge() {
    const badge = document.getElementById('ratesStatusBadge');
    const warning = document.getElementById('ratesWarningBanner');
    if (!badge) return;

    activeRates = currency.getActiveRates();
    if (activeRates.statusType === 'live') {
      badge.className = 'badge badge-live';
      badge.textContent = t('rates_live', { time: activeRates.dateStr });
    } else if (activeRates.statusType === 'cached') {
      badge.className = 'badge badge-cached';
      badge.textContent = t('rates_cached', { date: activeRates.fullDateStr });
    } else {
      badge.className = 'badge badge-fallback';
      badge.textContent = t('rates_fallback', { date: activeRates.dateStr });
    }

    if (warning) {
      warning.style.display = activeRates.isOutdated ? 'flex' : 'none';
    }
  }

  // Modals management
  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('open');
      const firstInput = modal.querySelector('input:not([type="hidden"]), select');
      if (firstInput) firstInput.focus();
    }
  }

  function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
    editingExpenseId = null;
  }

  // Dashboard View
  function showDashboard() {
    currentTrip = null;
    appData.currentTripId = null;
    storage.saveData(appData);

    document.getElementById('dashboardSection').classList.add('active');
    document.getElementById('tripSection').classList.remove('active');
    renderDashboard();
  }

  function renderDashboard() {
    const container = document.getElementById('tripsGrid');
    const emptyState = document.getElementById('tripsEmptyState');
    if (!container) return;

    container.innerHTML = '';
    const trips = appData.trips || [];

    if (trips.length === 0) {
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    trips.forEach(trip => {
      const calc = settlement.calculateBalances(trip);
      const card = document.createElement('div');
      card.className = 'trip-card';

      const createdDate = new Date(trip.createdAt).toLocaleDateString();
      const costFormatted = currency.formatMoney(calc.totalCostMinor, trip.baseCurrency);

      card.innerHTML = `
        <div>
          <div class="trip-card-header">
            <h3 class="trip-card-title">${escapeHtml(trip.name)}</h3>
            <span class="badge badge-live">${escapeHtml(trip.baseCurrency)}</span>
          </div>
          <div class="trip-meta">${createdDate}</div>
          <div class="trip-card-stats">
            <div>
              <div class="trip-stat-label">${t('participants')}</div>
              <div class="trip-stat-val">👥 ${trip.participants.length}</div>
            </div>
            <div>
              <div class="trip-stat-label">${t('total_trip_cost')}</div>
              <div class="trip-stat-val">${costFormatted}</div>
            </div>
          </div>
        </div>
        <div class="trip-card-actions">
          <button class="btn btn-primary btn-sm" data-open-trip="${trip.id}">
            ${t('open')} →
          </button>
          <div style="display:flex;gap:0.35rem;">
            <button class="btn btn-secondary btn-sm" data-rename-trip="${trip.id}">
              ✏️
            </button>
            <button class="btn btn-danger btn-sm" data-delete-trip="${trip.id}">
              🗑️
            </button>
          </div>
        </div>
      `;

      card.querySelector('[data-open-trip]').addEventListener('click', () => openTrip(trip.id));
      card.querySelector('[data-rename-trip]').addEventListener('click', (e) => {
        e.stopPropagation();
        currentTrip = trip;
        document.getElementById('renameTripInput').value = trip.name;
        openModal('renameTripModal');
      });
      card.querySelector('[data-delete-trip]').addEventListener('click', (e) => {
        e.stopPropagation();
        currentTrip = trip;
        document.getElementById('deleteTripPrompt').textContent = t('confirm_delete_trip', { name: trip.name });
        openModal('deleteTripModal');
      });

      container.appendChild(card);
    });
  }

  // Open Trip View
  function openTrip(tripId) {
    const trip = appData.trips.find(t => t.id === tripId);
    if (!trip) {
      showDashboard();
      return;
    }

    currentTrip = trip;
    appData.currentTripId = trip.id;
    storage.saveData(appData);

    document.getElementById('dashboardSection').classList.remove('active');
    document.getElementById('tripSection').classList.add('active');

    renderTripDetails();
  }

  function renderTripDetails() {
    if (!currentTrip) return;

    // Header info
    document.getElementById('tripHeroTitle').textContent = currentTrip.name;
    document.getElementById('tripBaseCurrencyBadge').textContent = currentTrip.baseCurrency;

    // Calculations
    const calc = settlement.calculateBalances(currentTrip);
    settlement.assertZeroSum(calc.balances);

    document.getElementById('tripTotalCostDisplay').textContent =
      currency.formatMoney(calc.totalCostMinor, currentTrip.baseCurrency);

    renderParticipantsList();
    renderCategoryBreakdown(calc.categoryTotals, calc.totalCostMinor);
    renderBalancesList(calc.balances, calc.paidTotals, calc.fairShareTotals);
    renderSettlements(calc.balances);
    renderSettlementHistory();
    renderExpensesList();
    populateCurrencyConverterDefaults();
  }

  // Participants rendering
  function renderParticipantsList() {
    const container = document.getElementById('participantsChipsContainer');
    if (!container || !currentTrip) return;
    container.innerHTML = '';

    currentTrip.participants.forEach(p => {
      const chip = document.createElement('div');
      chip.className = 'participant-chip';

      const initial = p.name ? p.name.trim().charAt(0).toUpperCase() : '?';

      chip.innerHTML = `
        <span class="participant-chip-avatar">${escapeHtml(initial)}</span>
        <span>${escapeHtml(p.name)}</span>
        <button class="edit-participant-btn" title="${t('edit')}" data-edit-participant="${p.id}">✏️</button>
        <button class="remove-participant-btn" title="${t('delete')}" data-remove-participant="${p.id}">×</button>
      `;

      chip.querySelector('[data-edit-participant]').addEventListener('click', () => openEditParticipantModal(p.id));
      chip.querySelector('[data-remove-participant]').addEventListener('click', () => handleRemoveParticipant(p.id));
      container.appendChild(chip);
    });
  }

  function openEditParticipantModal(participantId) {
    if (!currentTrip) return;
    const p = currentTrip.participants.find(part => part.id === participantId);
    if (!p) return;

    document.getElementById('editParticipantId').value = p.id;
    document.getElementById('editParticipantNameInput').value = p.name;
    document.getElementById('editParticipantFormError').textContent = '';
    openModal('editParticipantModal');
  }

  function handleEditParticipant(e) {
    e.preventDefault();
    if (!currentTrip) return;

    const id = document.getElementById('editParticipantId').value;
    const input = document.getElementById('editParticipantNameInput');
    const errBox = document.getElementById('editParticipantFormError');
    errBox.textContent = '';

    const newName = input.value.trim();
    if (!newName) {
      errBox.textContent = t('name_empty');
      return;
    }

    // Check uniqueness (case-insensitive) among other participants
    const exists = currentTrip.participants.some(
      p => p.id !== id && p.name.trim().toLowerCase() === newName.toLowerCase()
    );
    if (exists) {
      errBox.textContent = t('name_already_exists');
      return;
    }

    const participant = currentTrip.participants.find(p => p.id === id);
    if (participant) {
      participant.name = newName;
      storage.saveData(appData);
      closeAllModals();
      renderTripDetails();
    }
  }

  function handleAddParticipant(e) {
    e.preventDefault();
    const input = document.getElementById('newParticipantNameInput');
    const name = input.value.trim();
    if (!name) {
      alert(t('name_empty'));
      return;
    }

    if (currentTrip.participants.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      alert(t('name_already_exists'));
      return;
    }

    const newId = 'p_' + Date.now();
    currentTrip.participants.push({ id: newId, name });
    storage.saveData(appData);
    input.value = '';
    renderTripDetails();
  }

  function handleRemoveParticipant(participantId) {
    if (currentTrip.participants.length <= 2) {
      alert(t('min_participants_warning'));
      return;
    }

    // Check if participant is in any expense
    const isInExpense = currentTrip.expenses.some(exp => {
      if (exp.paidBy === participantId) return true;
      if (Array.isArray(exp.splitAmong) && exp.splitAmong.includes(participantId)) return true;
      if (exp.customSplits && exp.customSplits[participantId] !== undefined) return true;
      return false;
    });

    if (isInExpense) {
      alert(t('participant_in_use'));
      return;
    }

    currentTrip.participants = currentTrip.participants.filter(p => p.id !== participantId);
    storage.saveData(appData);
    renderTripDetails();
  }

  // Category Breakdown
  function renderCategoryBreakdown(catTotals, totalCostMinor) {
    const container = document.getElementById('categoryBreakdownContainer');
    if (!container) return;
    container.innerHTML = '';

    const categories = [
      { key: 'food', label: t('cat_food'), class: 'fill-food' },
      { key: 'transport', label: t('cat_transport'), class: 'fill-transport' },
      { key: 'accommodation', label: t('cat_accommodation'), class: 'fill-accommodation' },
      { key: 'entertainment', label: t('cat_entertainment'), class: 'fill-entertainment' },
      { key: 'other', label: t('cat_other'), class: 'fill-other' }
    ];

    categories.forEach(cat => {
      const amt = catTotals[cat.key] || 0;
      const pct = totalCostMinor > 0 ? Math.round((amt / totalCostMinor) * 100) : 0;

      const item = document.createElement('div');
      item.className = 'category-bar-item';
      item.innerHTML = `
        <div class="category-bar-label-row">
          <span>${cat.label}</span>
          <span>${currency.formatMoney(amt, currentTrip.baseCurrency)} (${pct}%)</span>
        </div>
        <div class="category-track">
          <div class="category-fill ${cat.class}" style="width: ${pct}%;"></div>
        </div>
      `;
      container.appendChild(item);
    });
  }

  // Balances
  function renderBalancesList(balances, paidTotals, fairShareTotals) {
    const container = document.getElementById('balancesListContainer');
    if (!container) return;
    container.innerHTML = '';

    currentTrip.participants.forEach(p => {
      const net = balances[p.id] || 0;
      const paid = paidTotals[p.id] || 0;
      const fair = fairShareTotals[p.id] || 0;

      const item = document.createElement('div');
      item.className = 'balance-item';

      let stateClass = 'balance-zero';
      let stateText = '0.00';
      if (net > 0) {
        stateClass = 'balance-positive';
        stateText = `+${currency.formatMoney(net, currentTrip.baseCurrency)} (${t('gets_back')})`;
      } else if (net < 0) {
        stateClass = 'balance-negative';
        stateText = `-${currency.formatMoney(Math.abs(net), currentTrip.baseCurrency)} (${t('owes')})`;
      }

      item.innerHTML = `
        <div>
          <div class="balance-person">
            <span>👤</span>
            <span>${escapeHtml(p.name)}</span>
          </div>
          <div style="font-size: 0.75rem; color: var(--neutral-500); margin-top: 2px;">
            ${t('paid_by')}: ${currency.formatMoney(paid, currentTrip.baseCurrency)} | ${t('amount')}: ${currency.formatMoney(fair, currentTrip.baseCurrency)}
          </div>
        </div>
        <div class="balance-amt ${stateClass}">
          ${stateText}
        </div>
      `;
      container.appendChild(item);
    });
  }

  // Who owes whom (Transfers)
  function renderSettlements(balances) {
    const container = document.getElementById('transfersListContainer');
    const emptyNotice = document.getElementById('allSettledNotice');
    if (!container) return;
    container.innerHTML = '';

    const transfers = settlement.simplifyDebts(balances);

    if (transfers.length === 0) {
      if (emptyNotice) emptyNotice.style.display = 'block';
      return;
    }

    if (emptyNotice) emptyNotice.style.display = 'none';

    transfers.forEach(tr => {
      const debtor = currentTrip.participants.find(p => p.id === tr.from);
      const creditor = currentTrip.participants.find(p => p.id === tr.to);
      const debtorName = debtor ? debtor.name : 'Unknown';
      const creditorName = creditor ? creditor.name : 'Unknown';

      const card = document.createElement('div');
      card.className = 'transfer-card';

      card.innerHTML = `
        <div class="transfer-flow">
          <span class="transfer-payer">${escapeHtml(debtorName)}</span>
          <span class="transfer-arrow">➔</span>
          <span class="transfer-amount">${currency.formatMoney(tr.amountMinor, currentTrip.baseCurrency)}</span>
          <span class="transfer-arrow">➔</span>
          <span class="transfer-receiver">${escapeHtml(creditorName)}</span>
        </div>
        <button class="btn btn-success btn-sm" data-mark-paid="${tr.from}_${tr.to}_${tr.amountMinor}">
          ✓ ${t('mark_as_paid')}
        </button>
      `;

      card.querySelector('[data-mark-paid]').addEventListener('click', () => {
        handleMarkSettlementPaid(tr.from, tr.to, tr.amountMinor);
      });

      container.appendChild(card);
    });
  }

  function handleMarkSettlementPaid(fromId, toId, amountMinor) {
    if (!currentTrip) return;
    if (!Array.isArray(currentTrip.settlements)) {
      currentTrip.settlements = [];
    }

    const newSettlement = {
      id: 'set_' + Date.now(),
      from: fromId,
      to: toId,
      amountMinor: Math.round(amountMinor),
      date: new Date().toISOString(),
      currency: currentTrip.baseCurrency
    };

    currentTrip.settlements.push(newSettlement);
    storage.saveData(appData);
    renderTripDetails();
    showToast(t('mark_as_paid'));
  }

  // Settlement History
  function renderSettlementHistory() {
    const container = document.getElementById('settlementHistoryContainer');
    const emptyNotice = document.getElementById('noSettlementsNotice');
    if (!container) return;
    container.innerHTML = '';

    const settlements = currentTrip.settlements || [];
    if (settlements.length === 0) {
      if (emptyNotice) emptyNotice.style.display = 'block';
      return;
    }

    if (emptyNotice) emptyNotice.style.display = 'none';

    settlements.slice().reverse().forEach(s => {
      const debtor = currentTrip.participants.find(p => p.id === s.from);
      const creditor = currentTrip.participants.find(p => p.id === s.to);
      const debtorName = debtor ? debtor.name : 'Unknown';
      const creditorName = creditor ? creditor.name : 'Unknown';

      const item = document.createElement('div');
      item.className = 'settlement-history-item';

      const dateStr = new Date(s.date).toLocaleDateString();

      item.innerHTML = `
        <div>
          <span>✓ <strong>${escapeHtml(debtorName)}</strong> paid <strong>${escapeHtml(creditorName)}</strong>: ${currency.formatMoney(s.amountMinor, currentTrip.baseCurrency)}</span>
          <span style="color: var(--neutral-400); margin-left: 0.5rem;">(${dateStr})</span>
        </div>
        <button class="btn btn-danger btn-sm" style="padding: 0.2rem 0.5rem;" data-undo-settlement="${s.id}">
          ↺ ${t('undo')}
        </button>
      `;

      item.querySelector('[data-undo-settlement]').addEventListener('click', () => {
        currentTrip.settlements = currentTrip.settlements.filter(item => item.id !== s.id);
        storage.saveData(appData);
        renderTripDetails();
      });

      container.appendChild(item);
    });
  }

  // Expenses List
  function renderExpensesList() {
    const container = document.getElementById('expensesListContainer');
    const emptyNotice = document.getElementById('noExpensesNotice');
    if (!container) return;
    container.innerHTML = '';

    const expenses = currentTrip.expenses || [];
    if (expenses.length === 0) {
      if (emptyNotice) emptyNotice.style.display = 'block';
      return;
    }

    if (emptyNotice) emptyNotice.style.display = 'none';

    const catIcons = {
      food: '🍔',
      transport: '🚕',
      accommodation: '🏨',
      entertainment: '🎟️',
      other: '📦'
    };

    expenses.slice().reverse().forEach(exp => {
      const payer = currentTrip.participants.find(p => p.id === exp.paidBy);
      const payerName = payer ? payer.name : 'Unknown';

      const card = document.createElement('div');
      card.className = 'expense-card';

      const icon = catIcons[exp.category] || '📦';
      const convertedCost = currency.formatMoney(exp.convertedAmountMinor, currentTrip.baseCurrency);
      const originalCost = currency.formatMoney(exp.amountMinor, exp.currency);

      let multiCurrDisplay = '';
      if (exp.currency !== currentTrip.baseCurrency) {
        multiCurrDisplay = `<span class="expense-orig-amount">${originalCost} (Rate: ${Number(exp.rateSnapshot.rate).toFixed(4)})</span>`;
      }

      // Split count
      const splitCount = exp.splitType === 'custom' && exp.customSplits
        ? Object.keys(exp.customSplits).length
        : (exp.splitAmong ? exp.splitAmong.length : currentTrip.participants.length);

      card.innerHTML = `
        <div class="expense-left">
          <div class="expense-cat-icon">${icon}</div>
          <div class="expense-info">
            <div class="expense-title">${escapeHtml(exp.title)}</div>
            <div class="expense-meta">
              <span>👤 ${t('paid_by')}: <strong>${escapeHtml(payerName)}</strong></span>
              <span>•</span>
              <span>📅 ${exp.date}</span>
              <span>•</span>
              <span>👥 ${splitCount} ${t('participants').toLowerCase()}</span>
            </div>
          </div>
        </div>
        <div class="expense-right">
          <div class="expense-amount-box">
            <div class="expense-primary-amount">${convertedCost}</div>
            ${multiCurrDisplay}
          </div>
          <div class="expense-actions">
            <button class="btn btn-secondary btn-sm" data-edit-expense="${exp.id}" title="${t('edit')}">✏️</button>
            <button class="btn btn-danger btn-sm" data-delete-expense="${exp.id}" title="${t('delete')}">🗑️</button>
          </div>
        </div>
      `;

      card.querySelector('[data-edit-expense]').addEventListener('click', () => openExpenseModal(exp.id));
      card.querySelector('[data-delete-expense]').addEventListener('click', () => handleDeleteExpense(exp));

      container.appendChild(card);
    });
  }

  // Expense Modal (Add / Edit)
  function openExpenseModal(expenseId = null) {
    editingExpenseId = expenseId;
    const modal = document.getElementById('expenseModal');
    const form = document.getElementById('expenseForm');
    const titleEl = document.getElementById('expenseModalTitle');
    const paidBySelect = document.getElementById('expensePaidBy');
    const currencySelect = document.getElementById('expenseCurrency');

    form.reset();
    document.getElementById('expenseFormErrors').textContent = '';

    // Populate Paid By options
    paidBySelect.innerHTML = '';
    currentTrip.participants.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      paidBySelect.appendChild(opt);
    });

    // Populate Currencies
    currencySelect.innerHTML = '';
    currency.SUPPORTED_CURRENCIES.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.code;
      opt.textContent = `${c.code} (${c.symbol})`;
      currencySelect.appendChild(opt);
    });

    // Populate Split Checkboxes
    renderSplitCheckboxes();

    if (expenseId) {
      titleEl.textContent = t('edit_expense');
      const exp = currentTrip.expenses.find(e => e.id === expenseId);
      if (exp) {
        document.getElementById('expenseTitle').value = exp.title;
        document.getElementById('expenseCategory').value = exp.category;
        document.getElementById('expenseAmount').value = currency.minorToMajor(exp.amountMinor);
        currencySelect.value = exp.currency;
        paidBySelect.value = exp.paidBy;
        document.getElementById('expenseDate').value = exp.date;

        if (exp.rateSnapshot && exp.rateSnapshot.source === 'manual') {
          document.getElementById('overrideRateCheckbox').checked = true;
          document.getElementById('overrideRateBox').style.display = 'block';
          document.getElementById('customRateInput').value = exp.rateSnapshot.rate;
        } else {
          document.getElementById('overrideRateCheckbox').checked = false;
          document.getElementById('overrideRateBox').style.display = 'none';
          document.getElementById('customRateInput').value = '';
        }

        // Split type
        const splitMethodRadio = document.querySelector(`input[name="splitMethod"][value="${exp.splitType || 'equal'}"]`);
        if (splitMethodRadio) splitMethodRadio.checked = true;

        // Checked participants
        const splitAmong = exp.splitAmong || currentTrip.participants.map(p => p.id);
        document.querySelectorAll('#splitCheckboxesContainer input[type="checkbox"]').forEach(c => {
          c.checked = splitAmong.includes(c.value);
        });

        if (exp.splitType === 'custom') {
          renderCustomSplitInputs(exp.manualSplits || exp.customSplits, exp.manualParticipantIds);
        }
      }
    } else {
      titleEl.textContent = t('add_expense');
      document.getElementById('expenseDate').value = new Date().toISOString().split('T')[0];
      currencySelect.value = currentTrip.baseCurrency;
      document.getElementById('overrideRateCheckbox').checked = false;
      document.getElementById('overrideRateBox').style.display = 'none';
      document.getElementById('customRateInput').value = '';
      document.querySelector('input[name="splitMethod"][value="equal"]').checked = true;
      document.querySelectorAll('#splitCheckboxesContainer input[type="checkbox"]').forEach(c => c.checked = true);
    }

    handleSplitMethodChange();
    updateExpenseRateSnapshotPreview();
    openModal('expenseModal');
  }

  function renderSplitCheckboxes() {
    const container = document.getElementById('splitCheckboxesContainer');
    if (!container || !currentTrip) return;
    container.innerHTML = '';

    currentTrip.participants.forEach(p => {
      const label = document.createElement('label');
      label.className = 'checkbox-item';
      label.innerHTML = `
        <input type="checkbox" value="${p.id}" checked>
        <span>${escapeHtml(p.name)}</span>
      `;
      label.querySelector('input').addEventListener('change', handleSplitSelectionChange);
      container.appendChild(label);
    });
  }

  function handleSplitMethodChange() {
    const isCustom = document.querySelector('input[name="splitMethod"]:checked').value === 'custom';
    const customSection = document.getElementById('customSplitSection');
    if (customSection) {
      customSection.style.display = isCustom ? 'block' : 'none';
    }
    if (isCustom) {
      renderCustomSplitInputs();
    }
  }

  function handleSplitSelectionChange() {
    const isCustom = document.querySelector('input[name="splitMethod"]:checked').value === 'custom';
    if (isCustom) {
      renderCustomSplitInputs();
    }
  }

  function renderCustomSplitInputs(existingShares = null, manualParticipantIds = null) {
    const container = document.getElementById('customSplitRowsContainer');
    if (!container || !currentTrip) return;
    container.innerHTML = '';

    const selectedIds = Array.from(document.querySelectorAll('#splitCheckboxesContainer input[type="checkbox"]:checked'))
      .map(c => c.value);

    selectedIds.forEach(id => {
      const p = currentTrip.participants.find(part => part.id === id);
      if (!p) return;

      const row = document.createElement('div');
      row.className = 'custom-split-row';

      let currentVal = '';
      if (existingShares) {
        if (manualParticipantIds && Array.isArray(manualParticipantIds)) {
          if (manualParticipantIds.includes(id) && existingShares[id] !== undefined) {
            currentVal = currency.minorToMajor(existingShares[id]);
          }
        } else if (existingShares[id] !== undefined) {
          currentVal = currency.minorToMajor(existingShares[id]);
        }
      }

      row.innerHTML = `
        <span>${escapeHtml(p.name)}</span>
        <input type="number" step="0.01" min="0" class="custom-split-input" data-custom-p="${p.id}" value="${currentVal}" placeholder="0.00">
      `;

      row.querySelector('input').addEventListener('input', calculateCustomSplitDifference);
      container.appendChild(row);
    });

    calculateCustomSplitDifference();
  }

  function calculateCustomSplitDifference() {
    const amountVal = parseFloat(document.getElementById('expenseAmount').value) || 0;
    const totalMinor = Math.round(amountVal * 100);
    const expCurrency = document.getElementById('expenseCurrency') ? document.getElementById('expenseCurrency').value : 'AZN';

    const selectedIds = Array.from(document.querySelectorAll('#splitCheckboxesContainer input[type="checkbox"]:checked'))
      .map(c => c.value);

    const inputs = document.querySelectorAll('[data-custom-p]');
    const filledSharesMinor = {};
    let hasNegative = false;

    inputs.forEach(input => {
      const pId = input.getAttribute('data-custom-p');
      if (!selectedIds.includes(pId)) return;

      const rawVal = input.value.trim();
      if (rawVal !== '') {
        const floatVal = parseFloat(rawVal);
        if (isNaN(floatVal) || floatVal < 0) {
          hasNegative = true;
        } else {
          filledSharesMinor[pId] = Math.round(floatVal * 100);
        }
      }
    });

    const badge = document.getElementById('splitDiffBadge');
    if (!badge) return;

    if (hasNegative) {
      badge.className = 'split-diff-badge mismatch';
      badge.textContent = t('err_negative_share');
      return;
    }

    const result = settlement.splitHybrid(totalMinor, selectedIds, filledSharesMinor, 0);

    if (!result.valid) {
      badge.className = 'split-diff-badge mismatch';
      if (result.error === 'excess') {
        const diffStr = currency.minorToMajor(result.diff) + ' ' + expCurrency;
        const sumStr = currency.minorToMajor(result.filledSum) + ' ' + expCurrency;
        const totalStr = currency.minorToMajor(totalMinor) + ' ' + expCurrency;
        badge.textContent = t('err_custom_excess', { sum: sumStr, total: totalStr, diff: diffStr });
      } else if (result.error === 'sum_mismatch') {
        const diffStr = currency.minorToMajor(result.diff) + ' ' + expCurrency;
        const sumStr = currency.minorToMajor(result.filledSum) + ' ' + expCurrency;
        const totalStr = currency.minorToMajor(totalMinor) + ' ' + expCurrency;
        badge.textContent = t('err_custom_sum_mismatch', { sum: sumStr, total: totalStr, diff: diffStr });
      } else {
        badge.textContent = t('err_negative_share');
      }

      inputs.forEach(input => {
        if (input.value.trim() === '') {
          input.placeholder = "0.00";
        }
      });
      return;
    }

    // Valid hybrid split
    badge.className = 'split-diff-badge matched';

    if (result.emptyIds.length === 0) {
      const totalStr = currency.minorToMajor(totalMinor) + ' ' + expCurrency;
      badge.textContent = `✓ ${t('matched_exact')} (${totalStr})`;
    } else if (result.remainder === 0) {
      badge.textContent = t('split_hybrid_zero_rem', { count: result.emptyIds.length });
    } else {
      const remStr = currency.minorToMajor(result.remainder) + ' ' + expCurrency;
      badge.textContent = t('split_hybrid_summary', { rem: remStr, count: result.emptyIds.length });
    }

    // Update placeholders on empty fields with computed shares
    inputs.forEach(input => {
      const pId = input.getAttribute('data-custom-p');
      if (input.value.trim() === '') {
        const shareMinor = result.shares[pId] !== undefined ? result.shares[pId] : 0;
        input.placeholder = `≈ ${currency.minorToMajor(shareMinor)}`;
      } else {
        input.placeholder = "0.00";
      }
    });
  }

  function updateExpenseRateSnapshotPreview() {
    const curr = document.getElementById('expenseCurrency').value;
    const base = currentTrip ? currentTrip.baseCurrency : 'AZN';
    const isOverridden = document.getElementById('overrideRateCheckbox').checked;
    const customRateVal = parseFloat(document.getElementById('customRateInput').value);

    let rate = 1.0;
    let source = 'live';

    if (curr === base) {
      rate = 1.0;
      document.getElementById('expenseRatePreview').textContent = `1 ${curr} = 1.00 ${base}`;
      return;
    }

    if (isOverridden && !isNaN(customRateVal) && customRateVal > 0) {
      rate = customRateVal;
      source = 'manual';
    } else {
      rate = currency.getExchangeRate(curr, base, activeRates);
      source = activeRates.source;
    }

    const preview = document.getElementById('expenseRatePreview');
    if (preview) {
      preview.textContent = `1 ${curr} = ${rate.toFixed(4)} ${base} (${source})`;
    }

    // Also recalculate custom diff if custom split is active
    calculateCustomSplitDifference();
  }

  function handleSaveExpense(e) {
    e.preventDefault();
    const errorBox = document.getElementById('expenseFormErrors');
    errorBox.textContent = '';

    try {
      const title = document.getElementById('expenseTitle').value.trim();
      const category = document.getElementById('expenseCategory').value;
      const amountFloat = parseFloat(document.getElementById('expenseAmount').value);
      const expCurrency = document.getElementById('expenseCurrency').value;
      const paidBy = document.getElementById('expensePaidBy').value;
      const date = document.getElementById('expenseDate').value;
      const splitMethod = document.querySelector('input[name="splitMethod"]:checked').value;
      const isOverridden = document.getElementById('overrideRateCheckbox').checked;
      const customRate = parseFloat(document.getElementById('customRateInput').value);

      // Validations
      if (!title) {
        errorBox.textContent = t('err_title_req');
        return;
      }
      if (isNaN(amountFloat) || amountFloat <= 0) {
        errorBox.textContent = t('err_amount_positive');
        return;
      }

      const selectedParticipants = Array.from(document.querySelectorAll('#splitCheckboxesContainer input[type="checkbox"]:checked'))
        .map(c => c.value);

      if (selectedParticipants.length === 0) {
        errorBox.textContent = t('err_at_least_one_split');
        return;
      }

      const amountMinor = Math.round(amountFloat * 100);
      const baseCurrency = currentTrip.baseCurrency;

      // Rate snapshot computation
      let finalRate = 1.0;
      let rateSource = 'live';
      if (expCurrency === baseCurrency) {
        finalRate = 1.0;
        rateSource = 'base';
      } else if (isOverridden) {
        if (isNaN(customRate) || customRate <= 0) {
          errorBox.textContent = t('err_invalid_rate');
          return;
        }
        finalRate = customRate;
        rateSource = 'manual';
      } else {
        finalRate = currency.getExchangeRate(expCurrency, baseCurrency, activeRates);
        rateSource = activeRates.source;
      }

      const filledSharesMinor = {};
      if (splitMethod === 'custom') {
        let hasNegative = false;
        const inputs = document.querySelectorAll('[data-custom-p]');

        inputs.forEach(input => {
          const pId = input.getAttribute('data-custom-p');
          if (!selectedParticipants.includes(pId)) return;

          const rawVal = input.value.trim();
          if (rawVal !== '') {
            const floatVal = parseFloat(rawVal);
            if (isNaN(floatVal) || floatVal < 0) {
              hasNegative = true;
            } else {
              filledSharesMinor[pId] = Math.round(floatVal * 100);
            }
          }
        });

        if (hasNegative) {
          errorBox.textContent = t('err_negative_share');
          return;
        }
      }

      // Build expense via settlement.buildExpense (single rounding rule applied)
      let built;
      try {
        built = settlement.buildExpense({
          id: editingExpenseId || ('exp_' + Date.now()),
          title,
          category,
          amountMinor,
          currency: expCurrency,
          baseCurrency,
          rate: finalRate,
          rateSource,
          paidBy,
          date,
          splitType: splitMethod,
          splitAmong: selectedParticipants,
          filledSharesMinor,
          rotationIndex: 0
        });
      } catch (calcErr) {
        if (calcErr.message === 'excess') {
          const diffStr = currency.minorToMajor(calcErr.diff) + ' ' + expCurrency;
          const sumStr = currency.minorToMajor(calcErr.filledSum) + ' ' + expCurrency;
          const totalStr = currency.minorToMajor(amountMinor) + ' ' + expCurrency;
          errorBox.textContent = t('err_custom_excess', { sum: sumStr, total: totalStr, diff: diffStr });
        } else if (calcErr.message === 'sum_mismatch') {
          const diffStr = currency.minorToMajor(calcErr.diff) + ' ' + expCurrency;
          const sumStr = currency.minorToMajor(calcErr.filledSum) + ' ' + expCurrency;
          const totalStr = currency.minorToMajor(amountMinor) + ' ' + expCurrency;
          errorBox.textContent = t('err_custom_sum_mismatch', { sum: sumStr, total: totalStr, diff: diffStr });
        } else if (calcErr.message === 'negative_or_invalid') {
          errorBox.textContent = t('err_negative_share');
        } else {
          errorBox.textContent = calcErr.message;
        }
        return;
      }

      if (editingExpenseId) {
        // Update existing
        const expIdx = currentTrip.expenses.findIndex(e => e.id === editingExpenseId);
        if (expIdx !== -1) {
          currentTrip.expenses[expIdx] = built;
        }
      } else {
        // Add new
        currentTrip.expenses.push(built);
      }

      storage.saveData(appData);
      closeAllModals();
      renderTripDetails();
    } catch (unexpectedErr) {
      console.error("Error saving expense:", unexpectedErr);
      errorBox.textContent = t('err_general_save') + ' (' + unexpectedErr.message + ')';
    }
  }

  function handleDeleteExpense(exp) {
    if (confirm(t('confirm_delete_expense', { title: exp.title }))) {
      currentTrip.expenses = currentTrip.expenses.filter(e => e.id !== exp.id);
      storage.saveData(appData);
      renderTripDetails();
    }
  }

  // Create Trip
  function handleCreateTrip(e) {
    e.preventDefault();
    const nameInput = document.getElementById('newTripName');
    const baseCurrSelect = document.getElementById('newTripCurrency');
    const name = nameInput.value.trim();

    if (!name) return;

    const prefix = i18n.getLang() === 'az' ? 'Dost' : 'Friend';
    const newTripId = 'trip_' + Date.now();

    const newTrip = {
      id: newTripId,
      name,
      baseCurrency: baseCurrSelect.value,
      createdAt: new Date().toISOString(),
      participants: [
        { id: 'p_1', name: `${prefix} 1` },
        { id: 'p_2', name: `${prefix} 2` },
        { id: 'p_3', name: `${prefix} 3` },
        { id: 'p_4', name: `${prefix} 4` },
        { id: 'p_5', name: `${prefix} 5` }
      ],
      expenses: [],
      settlements: []
    };

    appData.trips.unshift(newTrip);
    storage.saveData(appData);
    closeAllModals();
    openTrip(newTrip.id);
  }

  // Rename Trip
  function handleRenameTrip(e) {
    e.preventDefault();
    if (!currentTrip) return;
    const newName = document.getElementById('renameTripInput').value.trim();
    if (newName) {
      currentTrip.name = newName;
      storage.saveData(appData);
      closeAllModals();
      renderTripDetails();
    }
  }

  // Delete Trip
  function handleConfirmDeleteTrip() {
    if (!currentTrip) return;
    appData.trips = appData.trips.filter(t => t.id !== currentTrip.id);
    closeAllModals();
    showDashboard();
  }

  // Reset All
  function handleConfirmReset() {
    appData = storage.resetAllData();
    closeAllModals();
    showDashboard();
    showToast(t('reset_all_data'));
  }

  // Export / Import
  function handleExportJSON() {
    const jsonStr = storage.exportJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tripsplit-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function handleImportJSON(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target.result;
      const result = storage.importJSON(content);
      if (result.success) {
        appData = storage.loadData();
        showToast(t('import_success'));
        showDashboard();
      } else {
        alert(t('import_invalid'));
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  }

  // WhatsApp / Telegram Summary
  async function handleCopySummary() {
    if (!currentTrip) return;

    const calc = settlement.calculateBalances(currentTrip);
    const transfers = settlement.simplifyDebts(calc.balances);

    const totalCostStr = currency.formatMoney(calc.totalCostMinor, currentTrip.baseCurrency);

    let summaryText = `${t('whatsapp_title', { tripName: currentTrip.name })}\n`;
    summaryText += `${t('whatsapp_total', { total: totalCostStr })}\n\n`;

    summaryText += `${t('whatsapp_balances_title')}\n`;
    currentTrip.participants.forEach(p => {
      const net = calc.balances[p.id] || 0;
      let status = '';
      if (net > 0) {
        status = `+${currency.formatMoney(net, currentTrip.baseCurrency)} (${t('gets_back')})`;
      } else if (net < 0) {
        status = `-${currency.formatMoney(Math.abs(net), currentTrip.baseCurrency)} (${t('owes')})`;
      } else {
        status = `0.00 ${currentTrip.baseCurrency} (0)`;
      }
      summaryText += `• ${p.name}: ${status}\n`;
    });

    summaryText += `\n${t('whatsapp_transfers_title')}\n`;
    if (transfers.length === 0) {
      summaryText += `${t('whatsapp_no_transfers')}\n`;
    } else {
      transfers.forEach(tr => {
        const debtor = currentTrip.participants.find(p => p.id === tr.from);
        const creditor = currentTrip.participants.find(p => p.id === tr.to);
        const dName = debtor ? debtor.name : 'Unknown';
        const cName = creditor ? creditor.name : 'Unknown';
        const amtStr = currency.formatMoney(tr.amountMinor, currentTrip.baseCurrency);
        summaryText += `• ${dName} ➔ ${amtStr} ➔ ${cName}\n`;
      });
    }

    summaryText += `\n${t('whatsapp_footer')}`;

    const copied = await copyToClipboard(summaryText);
    if (copied) {
      showToast(t('summary_copied'));
    } else {
      alert(t('summary_copy_failed') + '\n\n' + summaryText);
    }
  }

  // Standalone Currency Converter
  function populateCurrencyConverterDefaults() {
    const fromSelect = document.getElementById('converterFrom');
    const toSelect = document.getElementById('converterTo');
    if (!fromSelect || !toSelect) return;

    fromSelect.innerHTML = '';
    toSelect.innerHTML = '';

    currency.SUPPORTED_CURRENCIES.forEach(c => {
      const opt1 = document.createElement('option');
      opt1.value = c.code;
      opt1.textContent = `${c.code} (${c.symbol})`;
      fromSelect.appendChild(opt1);

      const opt2 = document.createElement('option');
      opt2.value = c.code;
      opt2.textContent = `${c.code} (${c.symbol})`;
      toSelect.appendChild(opt2);
    });

    fromSelect.value = 'USD';
    toSelect.value = currentTrip ? currentTrip.baseCurrency : 'AZN';
    runCurrencyConverter();
  }

  function runCurrencyConverter() {
    const amtInput = document.getElementById('converterAmount');
    const fromSelect = document.getElementById('converterFrom');
    const toSelect = document.getElementById('converterTo');
    const resultBox = document.getElementById('converterResult');
    if (!amtInput || !fromSelect || !toSelect || !resultBox) return;

    const amount = parseFloat(amtInput.value) || 0;
    const fromCurr = fromSelect.value;
    const toCurr = toSelect.value;

    const rate = currency.getExchangeRate(fromCurr, toCurr, activeRates);
    const converted = amount * rate;

    resultBox.textContent = `${amount.toFixed(2)} ${fromCurr} = ${converted.toFixed(2)} ${toCurr}`;
  }

  function swapCurrencyConverter() {
    const fromSelect = document.getElementById('converterFrom');
    const toSelect = document.getElementById('converterTo');
    const tmp = fromSelect.value;
    fromSelect.value = toSelect.value;
    toSelect.value = tmp;
    runCurrencyConverter();
  }

  window.TripSplit.app = {
    init,
    onLanguageChange,
    openTrip,
    showDashboard,
    refreshExchangeRates
  };

  document.addEventListener('DOMContentLoaded', init);
})();
