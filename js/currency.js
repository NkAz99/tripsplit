// js/currency.js - Currency management, live rate fetching with timeout, fallback rates, conversion & money formatting
window.TripSplit = window.TripSplit || {};

(function() {
  const SUPPORTED_CURRENCIES = [
    { code: 'AZN', symbol: '₼', name: 'Azərbaycan Manatı (AZN)' },
    { code: 'USD', symbol: '$', name: 'US Dollar (USD)' },
    { code: 'EUR', symbol: '€', name: 'Euro (EUR)' },
    { code: 'TRY', symbol: '₺', name: 'Türk Lirası (TRY)' },
    { code: 'GBP', symbol: '£', name: 'British Pound (GBP)' },
    { code: 'RUB', symbol: '₽', name: 'Rusiya Rublu (RUB)' }
  ];

  // Hardcoded realistic fallback rates (Base: AZN, Date: 2026-10-24)
  const FALLBACK_RATES = {
    base: 'AZN',
    date: '2026-10-24',
    rates: {
      AZN: 1.0,
      USD: 0.5882,
      EUR: 0.5412,
      TRY: 20.1176,
      GBP: 0.4588,
      RUB: 56.7647
    }
  };

  // Convert minor units (qəpik/cents) to major float/string
  function minorToMajor(minorUnits) {
    const num = Math.round(Number(minorUnits) || 0);
    return (num / 100).toFixed(2);
  }

  // Convert major decimal string or number to integer minor units
  function majorToMinor(majorStrOrNum) {
    const val = parseFloat(majorStrOrNum);
    if (isNaN(val)) return 0;
    return Math.round(val * 100);
  }

  // Format minor units with currency symbol/code for UI display
  function formatMoney(minorUnits, currCode = 'AZN') {
    const major = minorToMajor(minorUnits);
    const curr = SUPPORTED_CURRENCIES.find(c => c.code === currCode);
    const sym = curr ? curr.symbol : currCode;
    
    // Nice formatting with thousands separator if needed
    const parts = major.split('.');
    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    const formatted = `${integerPart}.${parts[1]}`;

    if (currCode === 'USD') return `$${formatted}`;
    if (currCode === 'GBP') return `£${formatted}`;
    if (currCode === 'EUR') return `€${formatted}`;
    return `${formatted} ${sym}`;
  }

  // Calculate rate from one currency to another using a base-anchored rates table
  // Formula: 1 from = (ratesTable[to] / ratesTable[from]) to
  function getExchangeRate(fromCurr, toCurr, rateData) {
    if (fromCurr === toCurr) return 1.0;
    const rates = (rateData && rateData.rates) ? rateData.rates : FALLBACK_RATES.rates;
    const fromRate = rates[fromCurr];
    const toRate = rates[toCurr];
    if (!fromRate || !toRate) return 1.0;
    return toRate / fromRate;
  }

  // Convert minor units from one currency to another
  function convertMinor(amountMinor, fromCurr, toCurr, customRate = null, rateData = null) {
    if (fromCurr === toCurr) return Math.round(amountMinor);
    const rate = customRate !== null && !isNaN(customRate) && customRate > 0
      ? customRate
      : getExchangeRate(fromCurr, toCurr, rateData);
    return Math.round(amountMinor * rate);
  }

  // In-memory session fetch state to ensure status is LIVE ONLY when a fetch just succeeded
  let sessionFetchState = {
    isLive: false,
    timestamp: null
  };

  function resetSessionState() {
    sessionFetchState = {
      isLive: false,
      timestamp: null
    };
  }

  function formatTime(timestamp) {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function formatDateTime(timestamp) {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    const pad = n => String(n).padStart(2, '0');
    const y = d.getFullYear();
    const m = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const h = pad(d.getHours());
    const min = pad(d.getMinutes());
    return `${y}-${m}-${day} ${h}:${min}`;
  }

  // Fetch live rates from open.er-api.com with 6s timeout
  async function fetchLiveRates(baseCurrency = 'AZN') {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
      const url = `https://open.er-api.com/v6/latest/${encodeURIComponent(baseCurrency)}`;
      // Requirement 3: Bypass HTTP cache so a stale cached response is never mistaken for live data
      const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
      clearTimeout(timeoutId);

      // Requirement 2: response.ok must be true
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const json = await response.json();

      // Requirement 2: JSON result === "success" AND rates contains needed currencies
      const requiredCodes = SUPPORTED_CURRENCIES.map(c => c.code);
      const hasAllCurrencies = json && json.result === 'success' && json.rates &&
        requiredCodes.every(code => typeof json.rates[code] === 'number' && json.rates[code] > 0);

      if (!hasAllCurrencies) {
        throw new Error("Invalid API response format or missing required currencies");
      }

      // Requirement 1: Timestamp of last SUCCESSFUL network fetch saved in localStorage
      const fetchTime = Date.now();
      const rateInfo = {
        base: baseCurrency,
        rates: json.rates,
        timestamp: fetchTime,
        timeLastUpdateUtc: json.time_last_update_utc || new Date().toISOString()
      };

      // Save to storage cache
      const data = window.TripSplit.storage.loadData();
      data.cachedRates = rateInfo;
      window.TripSplit.storage.saveData(data);

      sessionFetchState = {
        isLive: true,
        timestamp: fetchTime
      };

      return { success: true, rateInfo };
    } catch (err) {
      clearTimeout(timeoutId);
      // Requirement 2 & 4: On any failure, treat as failure, never mark as live, never update saved timestamp!
      sessionFetchState = {
        isLive: false,
        timestamp: null
      };
      return { success: false, error: err.message };
    }
  }

  // Get active rates with status metadata
  function getActiveRates() {
    const data = window.TripSplit.storage.loadData();
    const cached = data.cachedRates;

    // 1. Status is LIVE only if the network fetch just completed successfully in the current session
    if (sessionFetchState.isLive && sessionFetchState.timestamp && cached && cached.rates) {
      return {
        rates: cached.rates,
        base: cached.base || 'AZN',
        source: 'live',
        timestamp: sessionFetchState.timestamp,
        isOutdated: false,
        statusType: 'live',
        dateStr: formatTime(sessionFetchState.timestamp),
        fullDateStr: formatDateTime(sessionFetchState.timestamp)
      };
    }

    // 2. Cached rates from localStorage (from previous successful fetch)
    if (cached && cached.rates && cached.timestamp) {
      const ageMs = Date.now() - cached.timestamp;
      const isOutdated = ageMs > (24 * 60 * 60 * 1000);
      return {
        rates: cached.rates,
        base: cached.base || 'AZN',
        source: 'cached',
        timestamp: cached.timestamp,
        isOutdated,
        statusType: 'cached',
        dateStr: formatTime(cached.timestamp),
        fullDateStr: formatDateTime(cached.timestamp)
      };
    }

    // 3. Hardcoded fallback
    return {
      rates: FALLBACK_RATES.rates,
      base: FALLBACK_RATES.base,
      source: 'fallback',
      timestamp: new Date(FALLBACK_RATES.date).getTime(),
      isOutdated: true,
      statusType: 'fallback',
      dateStr: FALLBACK_RATES.date,
      fullDateStr: FALLBACK_RATES.date
    };
  }

  window.TripSplit.currency = {
    SUPPORTED_CURRENCIES,
    FALLBACK_RATES,
    minorToMajor,
    majorToMinor,
    formatMoney,
    getExchangeRate,
    convertMinor,
    fetchLiveRates,
    getActiveRates,
    resetSessionState
  };
})();
