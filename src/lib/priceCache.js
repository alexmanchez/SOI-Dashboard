// Persistent cache for CoinGecko daily price history.
//
// History lived only in React state, so every page reload refetched a full
// 365-day series for every linked token. That is the expensive call — and on
// the keyless tier it is what trips the rate limit, which surfaces as an
// opaque CORS failure because throttled responses omit CORS headers. Live
// prices (simple/price) are one cheap call and were never the problem.
//
// A past day's close never changes, so this is safe to cache aggressively.
// The TTL exists only so the current (still-moving) day eventually refreshes.

const CACHE_KEY = 'catena.cgPriceHistory.v1';
const TTL_MS = 12 * 60 * 60 * 1000;

/* Shape: { savedAt, fetched: { [tokenId]: daysFetched },
            history: { [tokenId]: { [utcDayMs]: price } } } */
export const loadPriceCache = () => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return { history: {}, fetched: {} };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { history: {}, fetched: {} };
    if (!parsed.savedAt || Date.now() - parsed.savedAt > TTL_MS) {
      return { history: {}, fetched: {} };
    }
    return {
      history: parsed.history && typeof parsed.history === 'object' ? parsed.history : {},
      fetched: parsed.fetched && typeof parsed.fetched === 'object' ? parsed.fetched : {},
    };
  } catch {
    return { history: {}, fetched: {} };
  }
};

export const savePriceCache = (history, fetched) => {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ savedAt: Date.now(), history, fetched })
    );
    return true;
  } catch {
    // Quota exceeded on a large book — drop the cache rather than wedging the
    // app. Worst case we refetch next session.
    try { localStorage.removeItem(CACHE_KEY); } catch { /* nothing to do */ }
    return false;
  }
};

export const clearPriceCache = () => {
  try { localStorage.removeItem(CACHE_KEY); } catch { /* nothing to do */ }
};
