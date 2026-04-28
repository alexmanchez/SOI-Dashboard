import _ from 'lodash';

// CoinGecko live + historical prices + coin detail.
export const CG_BASE = 'https://api.coingecko.com/api/v3';

/* CoinGecko Demo API key — supplied via VITE_COINGECKO_API_KEY in .env.local
   (or the host's environment). Empty string falls back to a soft warning at
   call-time rather than silently using a hard-coded demo key. */
export const EMBEDDED_CG_API_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_COINGECKO_API_KEY) ||
  '';

/* Settings-drawer override wins (useful for test keys without a rebuild). */
export const resolveApiKey = (storeKey) => {
  const trimmed = (storeKey || '').trim();
  return trimmed || EMBEDDED_CG_API_KEY;
};

const withKey = (u, apiKey) =>
  apiKey ? u + (u.includes('?') ? '&' : '?') + `x_cg_demo_api_key=${encodeURIComponent(apiKey)}` : u;

export const fetchLivePrices = async (tokenIds, apiKey) => {
  const ids = _.uniq(tokenIds).filter(Boolean);
  if (!ids.length) return { prices: {}, error: null };
  const out = {};
  const batches = _.chunk(ids, 100);
  for (const batch of batches) {
    try {
      const url = `${CG_BASE}/simple/price?ids=${batch.join(',')}&vs_currencies=usd&include_24hr_change=true`;
      const res = await fetch(withKey(url, apiKey));
      if (res.status === 401 || res.status === 403) return { prices: out, error: 'Invalid API key.' };
      if (res.status === 429) return { prices: out, error: 'Rate limited (30 req/min on Demo).' };
      if (!res.ok) return { prices: out, error: `CoinGecko returned ${res.status}.` };
      const data = await res.json();
      for (const [id, v] of Object.entries(data)) {
        out[id] = { usd: v.usd, change24h: v.usd_24h_change ?? null };
      }
    } catch (_e) {
      return { prices: out, error: 'Network error.' };
    }
    await new Promise((r) => setTimeout(r, 1200));
  }
  return { prices: out, error: null };
};

export const fetchCoinDetail = async (cgTokenId, apiKey) => {
  if (!cgTokenId) return { data: null, error: 'No CoinGecko ID for this token' };
  const url = `${CG_BASE}/coins/${encodeURIComponent(cgTokenId)}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`;
  try {
    const res = await fetch(withKey(url, apiKey));
    if (!res.ok) return { data: null, error: `CoinGecko ${res.status}` };
    return { data: await res.json(), error: null };
  } catch (e) {
    return { data: null, error: e?.message || 'Network error' };
  }
};

export const fetchCoinChart = async (cgTokenId, days, apiKey) => {
  if (!cgTokenId) return { data: null, error: 'No CoinGecko ID' };
  const url = `${CG_BASE}/coins/${encodeURIComponent(cgTokenId)}/market_chart?vs_currency=usd&days=${days}`;
  try {
    const res = await fetch(withKey(url, apiKey));
    if (!res.ok) return { data: null, error: `CoinGecko ${res.status}` };
    return { data: await res.json(), error: null };
  } catch (e) {
    return { data: null, error: e?.message || 'Network error' };
  }
};

export const fetchHistory = async (tokenIds, days, apiKey, onProgress) => {
  const ids = _.uniq(tokenIds).filter(Boolean);
  if (!ids.length) return { history: {}, error: null };
  const out = {};
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    try {
      const url = `${CG_BASE}/coins/${id}/market_chart?vs_currency=usd&days=${days}&interval=daily`;
      const res = await fetch(withKey(url, apiKey));
      if (res.status === 401 || res.status === 403) return { history: out, error: 'Invalid API key.' };
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 5000));
        i--;
        continue;
      }
      if (!res.ok) {
        onProgress?.(i + 1, ids.length, id, `HTTP ${res.status}`);
        continue;
      }
      const data = await res.json();
      const byDay = {};
      for (const [ts, price] of data.prices || []) {
        const dayKey = Math.floor(ts / 86400000) * 86400000;
        byDay[dayKey] = price;
      }
      out[id] = byDay;
      onProgress?.(i + 1, ids.length, id, null);
    } catch (_e) {
      onProgress?.(i + 1, ids.length, id, 'network');
    }
    await new Promise((r) => setTimeout(r, 2100));
  }
  return { history: out, error: null };
};

// === Coin list (token search) ============================================ //
//
// /coins/list returns ~15k coins as { id, symbol, name }. Cached 24h in
// localStorage so the snapshot editor's autocomplete is instant on repeat
// opens. ~1.5 MB serialized — fits comfortably in localStorage's 5–10 MB.

const COINS_LIST_CACHE_KEY = 'catena.cgCoinsList.v1';
const COINS_LIST_TTL_MS = 24 * 60 * 60 * 1000;

let inMemCoinsList = null;
let inMemCoinsListAt = 0;

const loadCoinsListCache = () => {
  try {
    const raw = localStorage.getItem(COINS_LIST_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > COINS_LIST_TTL_MS) return null;
    return parsed.data || null;
  } catch { return null; }
};

const saveCoinsListCache = (data) => {
  try {
    localStorage.setItem(COINS_LIST_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data }));
  } catch { /* quota / disabled */ }
};

export const fetchAllCoins = async (apiKey) => {
  const now = Date.now();
  if (inMemCoinsList && now - inMemCoinsListAt < COINS_LIST_TTL_MS) {
    return { data: inMemCoinsList, error: null };
  }
  const cached = loadCoinsListCache();
  if (cached) {
    inMemCoinsList = cached;
    inMemCoinsListAt = now;
    return { data: cached, error: null };
  }
  try {
    const res = await fetch(withKey(`${CG_BASE}/coins/list`, apiKey));
    if (!res.ok) return { data: null, error: `CoinGecko ${res.status}` };
    const all = await res.json();
    inMemCoinsList = all;
    inMemCoinsListAt = now;
    saveCoinsListCache(all);
    return { data: all, error: null };
  } catch (e) {
    return { data: null, error: e?.message || 'Network error' };
  }
};

/* Lightweight relevance ranking — exact symbol, then symbol prefix, then name
   prefix, then substring fallback. Capped at `limit` results. Runs through the
   ~15k list in <5ms in practice; no fuzzy lib needed. */
export const searchCoins = (coins, query, limit = 8) => {
  if (!Array.isArray(coins) || !query) return [];
  const q = String(query).toLowerCase().trim();
  if (!q) return [];
  const exact = [];
  const symbolPrefix = [];
  const namePrefix = [];
  const contains = [];
  for (const c of coins) {
    const sym = (c.symbol || '').toLowerCase();
    const name = (c.name || '').toLowerCase();
    const id = (c.id || '').toLowerCase();
    if (sym === q) exact.push(c);
    else if (sym.startsWith(q)) symbolPrefix.push(c);
    else if (name.startsWith(q)) namePrefix.push(c);
    else if (sym.includes(q) || name.includes(q) || id.includes(q)) contains.push(c);
    if (exact.length + symbolPrefix.length + namePrefix.length + contains.length >= limit * 4) break;
  }
  return [...exact, ...symbolPrefix, ...namePrefix, ...contains].slice(0, limit);
};

