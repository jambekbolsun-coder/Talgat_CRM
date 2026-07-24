(function () {
  'use strict';

  const STORAGE_KEY = 'talgat-crm-state-v1';

  const emptyState = () => ({
    version: 2,
    company: {
      name: 'Талгат',
      legalName: '',
      owner: '',
      phone: '',
      email: '',
      address: '',
      description: '',
      currency: 'сом',
      logo: ''
    },
    orders: [],
    masters: [],
    managers: [],
    products: [],
    adExpenses: [],
    campaigns: [],
    competitions: [],
    manualExpenses: [],
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  });

  function safeParse(raw) {
    try { return JSON.parse(raw); } catch (_) { return null; }
  }

  function migrate(state) {
    const base = emptyState();
    if (!state || typeof state !== 'object') return base;

    const legacyAdExpenses = Array.isArray(state.campaigns)
      ? state.campaigns
        .filter((item) => Number(item?.spent) > 0)
        .map((item) => ({
          id: item.id || `ad-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          title: item.title || 'Рекламный расход',
          date: item.spendDate || item.startDate || item.createdAt || new Date().toISOString(),
          accountCount: 1,
          amountPerAccount: Number(item.spent) || 0,
          amount: Number(item.spent) || 0,
          note: item.notes || `Перенесено из старого раздела рекламы${item.channel ? ` · ${item.channel}` : ''}`,
          createdAt: item.createdAt || new Date().toISOString(),
          updatedAt: item.updatedAt || new Date().toISOString()
        }))
      : [];

    const products = Array.isArray(state.products)
      ? state.products.map((product) => ({ ...product, managerReward: Number(product.managerReward) || 0 }))
      : [];

    const orders = Array.isArray(state.orders)
      ? state.orders.map((order) => ({
        ...order,
        managerReward: Number(order.managerReward) || 0,
        status: order.status === 'master_payment' ? 'master_payment' : order.status
      }))
      : [];

    return {
      ...base,
      ...state,
      version: 2,
      company: { ...base.company, ...(state.company || {}), currency: 'сом' },
      orders,
      masters: Array.isArray(state.masters) ? state.masters : [],
      managers: Array.isArray(state.managers) ? state.managers : [],
      products,
      adExpenses: Array.isArray(state.adExpenses) ? state.adExpenses : legacyAdExpenses,
      campaigns: [],
      competitions: Array.isArray(state.competitions) ? state.competitions : [],
      manualExpenses: Array.isArray(state.manualExpenses) ? state.manualExpenses : [],
      metadata: { ...base.metadata, ...(state.metadata || {}) }
    };
  }

  const memoryStorageData = {};
  const memoryStorage = {
    getItem(key) { return Object.prototype.hasOwnProperty.call(memoryStorageData, key) ? memoryStorageData[key] : null; },
    setItem(key, value) { memoryStorageData[key] = String(value); },
    removeItem(key) { delete memoryStorageData[key]; }
  };

  let storage = memoryStorage;
  try {
    const candidate = window.localStorage;
    const probe = '__talgat_storage_probe__';
    candidate.setItem(probe, '1');
    candidate.removeItem(probe);
    storage = candidate;
  } catch (_) {
    storage = memoryStorage;
  }

  let state = migrate(safeParse(storage.getItem(STORAGE_KEY)));
  const listeners = new Set();

  function save() {
    state.metadata.updatedAt = new Date().toISOString();
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      window.dispatchEvent(new CustomEvent('talgat-storage-error', { detail: { message: error.message } }));
    }
    listeners.forEach((listener) => listener(getState()));
  }

  function getState() {
    return typeof structuredClone === 'function' ? structuredClone(state) : JSON.parse(JSON.stringify(state));
  }

  function setState(nextState) {
    state = migrate(nextState);
    save();
  }

  function update(mutator) {
    const draft = getState();
    mutator(draft);
    state = migrate(draft);
    save();
    return getState();
  }

  function reset() {
    state = emptyState();
    save();
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function exportData() {
    return JSON.stringify(getState(), null, 2);
  }

  function importData(raw) {
    const parsed = typeof raw === 'string' ? safeParse(raw) : raw;
    if (!parsed || typeof parsed !== 'object') throw new Error('Неверный формат файла');
    state = migrate(parsed);
    save();
  }

  window.TalgatStore = { getState, setState, update, reset, subscribe, exportData, importData, STORAGE_KEY };
})();
