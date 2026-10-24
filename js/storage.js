// js/storage.js - Safe LocalStorage persistence, memory fallback, JSON export/import
window.TripSplit = window.TripSplit || {};

(function() {
  const STORAGE_KEY = 'tripsplit_data_v1';
  let memoryStore = null;
  let isStorageAvailable = true;

  // Test localStorage availability
  function checkStorageAvailability() {
    try {
      const testKey = '__tripsplit_test__';
      localStorage.setItem(testKey, testKey);
      localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  }

  isStorageAvailable = checkStorageAvailability();

  function getDefaultData() {
    const isAz = (window.TripSplit.i18n ? window.TripSplit.i18n.getLang() : 'az') === 'az';
    const prefix = isAz ? "Dost" : "Friend";
    const initialTripId = 'trip_' + Date.now();
    return {
      version: 1,
      currentTripId: initialTripId,
      trips: [
        {
          id: initialTripId,
          name: isAz ? "Bakı Həftəsonu" : "Baku Weekend",
          baseCurrency: "AZN",
          createdAt: new Date().toISOString(),
          participants: [
            { id: "p_1", name: `${prefix} 1` },
            { id: "p_2", name: `${prefix} 2` },
            { id: "p_3", name: `${prefix} 3` },
            { id: "p_4", name: `${prefix} 4` },
            { id: "p_5", name: `${prefix} 5` }
          ],
          expenses: [],
          settlements: []
        }
      ],
      cachedRates: null
    };
  }

  function loadData() {
    if (!isStorageAvailable) {
      if (!memoryStore) {
        memoryStore = getDefaultData();
      }
      return memoryStore;
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const defaultData = getDefaultData();
        saveData(defaultData);
        return defaultData;
      }
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.trips) || parsed.trips.length === 0) {
        const defaultData = getDefaultData();
        saveData(defaultData);
        return defaultData;
      }
      return parsed;
    } catch (err) {
      console.warn("Error reading localStorage, using memory store:", err);
      if (!memoryStore) {
        memoryStore = getDefaultData();
      }
      return memoryStore;
    }
  }

  function saveData(data) {
    if (!data || typeof data !== 'object') return false;
    if (!isStorageAvailable) {
      memoryStore = data;
      return true;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (err) {
      console.warn("Error writing to localStorage, falling back to memory:", err);
      memoryStore = data;
      isStorageAvailable = false;
      return false;
    }
  }

  function validateImportStructure(data) {
    if (!data || typeof data !== 'object') return false;
    if (!Array.isArray(data.trips)) return false;
    for (const trip of data.trips) {
      if (!trip || typeof trip !== 'object') return false;
      if (typeof trip.id !== 'string' || !trip.name || typeof trip.baseCurrency !== 'string') return false;
      if (!Array.isArray(trip.participants) || trip.participants.length < 2) return false;
      for (const p of trip.participants) {
        if (!p || typeof p.id !== 'string' || typeof p.name !== 'string') return false;
      }
      if (!Array.isArray(trip.expenses)) return false;
      if (!Array.isArray(trip.settlements)) return false;
    }
    return true;
  }

  function exportJSON() {
    const data = loadData();
    return JSON.stringify(data, null, 2);
  }

  function importJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (!validateImportStructure(parsed)) {
        return { success: false, error: 'invalid_structure' };
      }
      // Ensure currentTripId is valid
      if (!parsed.currentTripId || !parsed.trips.some(t => t.id === parsed.currentTripId)) {
        parsed.currentTripId = parsed.trips[0].id;
      }
      saveData(parsed);
      return { success: true };
    } catch (e) {
      return { success: false, error: 'parse_error' };
    }
  }

  function resetAllData() {
    const defaultData = getDefaultData();
    saveData(defaultData);
    return defaultData;
  }

  window.TripSplit.storage = {
    isAvailable: () => isStorageAvailable,
    loadData,
    saveData,
    exportJSON,
    importJSON,
    resetAllData,
    validateImportStructure,
    getDefaultData
  };
})();
