import _ from 'lodash';

// CoinGecko live + historical prices + coin detail.
export const CG_BASE = 'https://api.coingecko.com/api/v3';

/* Embedded CoinGecko Demo API key. Prefer VITE_COINGECKO_API_KEY via env
   at build time; the literal below is the demo fallback. */
export const EMBEDDED_CG_API_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_COINGECKO_API_KEY) ||
  'CG-7PkUvXxmyBFtFXTB7HJSkX5e';

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
