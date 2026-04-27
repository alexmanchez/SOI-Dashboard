// DefiLlama API client. Currently only powers the Protocol TVL section in
// the TokenDetailDrawer — a single read-only endpoint, free, no auth.
//
// `/protocols` returns ~3k entries with name / symbol / tvl / change_1d /
// change_7d. We cache the full list for an hour in localStorage to keep
// drawer opens snappy and avoid pinging the API on every interaction.

const PROTOCOLS_CACHE_KEY = 'catena.defiLlamaProtocols.v1';
const PROTOCOLS_TTL_MS = 60 * 60 * 1000;

let inMem = null;
let inMemAt = 0;

const loadCache = () => {
  try {
    const raw = localStorage.getItem(PROTOCOLS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > PROTOCOLS_TTL_MS) return null;
    return parsed.data || null;
  } catch {
    return null;
  }
};

const saveCache = (data) => {
  try {
    localStorage.setItem(PROTOCOLS_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data }));
  } catch { /* quota / disabled */ }
};

export const fetchProtocols = async () => {
  const now = Date.now();
  if (inMem && now - inMemAt < PROTOCOLS_TTL_MS) return { data: inMem, error: null };

  const cached = loadCache();
  if (cached) {
    inMem = cached;
    inMemAt = now;
    return { data: cached, error: null };
  }

  try {
    const res = await fetch('https://api.llama.fi/protocols');
    if (!res.ok) return { data: null, error: `DefiLlama ${res.status}` };
    const all = await res.json();
    // Trim to the fields we use to keep localStorage usage in check.
    const trimmed = (all || []).map((p) => ({
      name: p.name,
      symbol: p.symbol,
      slug: p.slug,
      tvl: p.tvl,
      change_1d: p.change_1d,
      change_7d: p.change_7d,
      category: p.category,
      logo: p.logo,
      url: p.url,
    }));
    inMem = trimmed;
    inMemAt = now;
    saveCache(trimmed);
    return { data: trimmed, error: null };
  } catch (e) {
    return { data: null, error: e?.message || 'Network error' };
  }
};

/* Best-effort match by symbol then name. DefiLlama protocol entries don't
   always agree with token tickers (e.g. CRV vs Curve.fi), so we try symbol
   first (faster, mostly correct for DeFi blue chips) then fall back to name. */
export const findProtocolMatch = (protocols, { symbol, name }) => {
  if (!Array.isArray(protocols) || !protocols.length) return null;
  const sym = (symbol || '').toUpperCase().trim();
  const nm = (name || '').toLowerCase().trim();
  if (!sym && !nm) return null;
  if (sym) {
    const bySymbol = protocols.find((p) => (p.symbol || '').toUpperCase() === sym);
    if (bySymbol) return bySymbol;
  }
  if (nm) {
    const byName = protocols.find((p) => (p.name || '').toLowerCase() === nm);
    if (byName) return byName;
  }
  return null;
};
