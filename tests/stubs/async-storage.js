const m = new Map();
module.exports = { __esModule: true, default: {
  getItem: async (k) => (m.has(k) ? m.get(k) : null),
  setItem: async (k, v) => { m.set(k, v); },
  removeItem: async (k) => { m.delete(k); },
}, _m: m };
