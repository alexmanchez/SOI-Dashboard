// CoinMarketCap Pro API: ticker -> id mapping + logo URLs.
export const EMBEDDED_CMC_API_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_COINMARKETCAP_API_KEY) ||
  'a88a40ca0937478c9263d39a1fbf5a62';

export const CMC_IMG = (id) => `https://s2.coinmarketcap.com/static/img/coins/64x64/${id}.png`;
// Animated GIFs exist for top tokens; 403 on unsupported tokens falls through to PNG.
export const CMC_GIF = (id) => `https://s2.coinmarketcap.com/static/img/coins/64x64/${id}.gif`;

export const cmcFetch = async (path) => {
  try {
    const res = await fetch(`https://pro-api.coinmarketcap.com${path}`, {
      headers: { 'X-CMC_PRO_API_KEY': EMBEDDED_CMC_API_KEY, Accept: 'application/json' },
    });
    if (!res.ok) return { data: null, error: `CMC ${res.status}` };
    return { data: await res.json(), error: null };
  } catch (e) {
    return { data: null, error: e?.message || 'network error' };
  }
};

export const CMC_ID_CACHE_KEY = 'catena.cmcIds.v2';

export const loadCmcIdCache = () => {
  try {
    const raw = localStorage.getItem(CMC_ID_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > 30 * 24 * 60 * 60 * 1000) return null;
    return parsed.map || null;
  } catch {
    return null;
  }
};

export const saveCmcIdCache = (map) => {
  try {
    localStorage.setItem(CMC_ID_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), map }));
  } catch {
    /* quota / disabled */
  }
};

export const fetchCmcIdMap = async () => {
  const { data, error } = await cmcFetch('/v1/cryptocurrency/map?limit=5000&sort=cmc_rank');
  if (error || !data?.data) return null;
  const map = {};
  for (const c of data.data) {
    if (c.symbol && c.id && !map[String(c.symbol).toUpperCase()]) {
      map[String(c.symbol).toUpperCase()] = c.id;
    }
  }
  return map;
};
