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

  // Fetch live rates from open.er-api.com with 6s timeout
  async function fetchLiveRates(baseCurrency = 'AZN') {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
      const url = `https://open.er-api.com/v6/latest/${encodeURIComponent(baseCurrency)}`;
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const json = await response.json();
      if (json && json.result === 'success' && json.rates) {
        const rateInfo = {
          base: baseCurrency,
          rates: json.rates,
          timestamp: Date.now(),
          timeLastUpdateUtc: json.time_last_update_utc || new Date().toISOString(),
          source: 'live'
        };
        // Save to storage cache
        const data = window.TripSplit.storage.loadData();
        data.cachedRates = rateInfo;
        window.TripSplit.storage.saveData(data);
        return { success: true, rateInfo };
      } else {
        throw new Error("Invalid API response format");
      }
    } catch (err) {
      clearTimeout(timeoutId);
      // Silently fall back to cached or hardcoded fallback
      return { success: false, error: err.message };
    }
  }

  // Get active rates with status metadata
  function getActiveRates() {
    const data = window.TripSplit.storage.loadData();
    const cached = data.cachedRates;

    if (cached && cached.rates) {
      const ageHours = (Date.now() - cached.timestamp) / (1000 * 60 * 60);
      const isOutdated = ageHours > 24;
      return {
        rates: cached.rates,
        base: cached.base || 'AZN',
        source: cached.source || 'cached',
        timestamp: cached.timestamp,
        isOutdated,
        statusType: cached.source === 'live' ? 'live' : 'cached',
        dateStr: new Date(cached.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        fullDateStr: new Date(cached.timestamp).toLocaleDateString()
      };
    }

    // Hardcoded fallback
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
    getActiveRates
  };
})();
