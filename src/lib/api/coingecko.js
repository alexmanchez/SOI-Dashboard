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

const MAX_RETRIES_PER_TOKEN = 3;

export const fetchHistory = async (tokenIds, days, apiKey, onProgress) => {
  const ids = _.uniq(tokenIds).filter(Boolean);
  if (!ids.length) return { history: {}, error: null };
  const out = {};
  const retries = {};
  const failed = [];
  let throttled = false;
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    try {
      const url = `${CG_BASE}/coins/${id}/market_chart?vs_currency=usd&days=${days}&interval=daily`;
      const res = await fetch(withKey(url, apiKey));
      if (res.status === 401 || res.status === 403) return { history: out, error: 'Invalid API key.' };
      if (res.status === 429) {
        // Back off and retry, but bounded — `i--` with no cap spins forever
        // against a sustained rate limit, and the keyless tier throttles hard.
        retries[id] = (retries[id] || 0) + 1;
        if (retries[id] <= MAX_RETRIES_PER_TOKEN) {
          await new Promise((r) => setTimeout(r, 5000));
          i--;
          continue;
        }
        throttled = true;
        onProgress?.(i + 1, ids.length, id, 'rate limited');
        failed.push(id);
        continue;
      }
      if (!res.ok) {
        onProgress?.(i + 1, ids.length, id, `HTTP ${res.status}`);
        failed.push(id);
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
      // A throttled CoinGecko response omits CORS headers, so the browser
      // rejects the fetch outright and it lands here rather than as a 429.
      // Reporting that as a bare network error sends people chasing their
      // connection when the real cause is the rate limit.
      throttled = true;
      failed.push(id);
      onProgress?.(i + 1, ids.length, id, 'network');
    }
    await new Promise((r) => setTimeout(r, 2100));
  }
  if (failed.length) {
    const scope = failed.length === ids.length ? 'No' : 'Some';
    const cause = throttled
      ? (apiKey
        ? 'CoinGecko rate limit reached — wait a minute and refresh.'
        : 'The keyless CoinGecko tier rate-limited the request. Add a free Demo API key in Settings for reliable history.')
      : 'CoinGecko did not return data for every token.';
    return { history: out, error: `${scope} price history loaded for ${failed.length} of ${ids.length} token(s). ${cause}` };
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

/* Lightweight relevance ranking over the ~15k /coins/list payload.
   Capped at `limit` results; no fuzzy lib needed.

   Bucket order matters more than it looks. The list carries no market-cap
   data, so there is nothing to rank "importance" by — and thousands of
   memecoins deliberately squat the names and symbols of major assets. Ranking
   exact-symbol first surfaced HarryPotterTrumpHomerSimpson777Inu (symbol
   "ethereum") above Ethereum, and buried Solana entirely behind coins merely
   containing the word.

   CoinGecko's canonical id is the reliable tie-breaker: the major asset owns
   the plain id ("bitcoin", "ethereum", "solana"), while squatters get
   suffixed ids. So exact id wins, then exact name, then exact symbol. */
export const searchCoins = (coins, query, limit = 8) => {
  if (!Array.isArray(coins) || !query) return [];
  const q = String(query).toLowerCase().trim();
  if (!q) return [];
  const idExact = [];
  const nameExact = [];
  const symbolExact = [];
  const symbolPrefix = [];
  const namePrefix = [];
  const contains = [];
  const buckets = [idExact, nameExact, symbolExact, symbolPrefix, namePrefix, contains];
  const collected = () => buckets.reduce((n, b) => n + b.length, 0);
  for (const c of coins) {
    const sym = (c.symbol || '').toLowerCase();
    const name = (c.name || '').toLowerCase();
    const id = (c.id || '').toLowerCase();
    if (id === q) idExact.push(c);
    else if (name === q) nameExact.push(c);
    else if (sym === q) symbolExact.push(c);
    else if (sym.startsWith(q)) symbolPrefix.push(c);
    else if (name.startsWith(q)) namePrefix.push(c);
    else if (sym.includes(q) || name.includes(q) || id.includes(q)) contains.push(c);
    // Keep scanning past the cap while the top buckets are still empty — the
    // canonical asset's id often sorts late alphabetically, and bailing early
    // is exactly how Solana went missing.
    if (collected() >= limit * 4 && (idExact.length || nameExact.length)) break;
    if (collected() >= limit * 40) break;
  }
  return [...idExact, ...nameExact, ...symbolExact, ...symbolPrefix, ...namePrefix, ...contains]
    .slice(0, limit);
};

/* Market-cap-ranked search via CoinGecko's own /search endpoint.

   The cached /coins/list has no market-cap data, so it cannot break ticker
   collisions — a bare "btc" is shared by hundreds of coins and the canonical
   one is not distinguishable locally. /search returns results ordered by
   market_cap_rank, which is exactly the missing signal. Works keyless.

   Returns [] on any failure so the caller can fall back to local results
   rather than showing the user an error mid-typing. */
export const searchCoinsRemote = async (query, apiKey) => {
  const q = String(query || '').trim();
  if (!q) return [];
  try {
    const url = `${CG_BASE}/search?query=${encodeURIComponent(q)}`;
    const res = await fetch(withKey(url, apiKey));
    if (!res.ok) return [];
    const data = await res.json();
    return (data.coins || []).map((c) => ({
      id: c.id,
      symbol: c.symbol,
      name: c.name,
      marketCapRank: c.market_cap_rank ?? null,
    }));
  } catch {
    return [];
  }
};

/* Merge market-cap-ranked remote hits ahead of local matches, de-duplicated.
   Remote ordering wins because it encodes market cap; local fills the tail so
   the list stays useful when the network is slow, rate-limited, or offline. */
export const mergeCoinMatches = (remote, local, limit = 8) => {
  const seen = new Set();
  const out = [];
  for (const c of [...(remote || []), ...(local || [])]) {
    if (!c || !c.id || seen.has(c.id)) continue;
    seen.add(c.id);
    out.push(c);
    if (out.length >= limit) break;
  }
  return out;
};
