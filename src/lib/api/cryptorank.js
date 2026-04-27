// CryptoRank market-data endpoints (demo tariff).
export const CR_BASE = 'https://api.cryptorank.io/v2';
export const EMBEDDED_CR_API_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_CRYPTORANK_API_KEY) ||
  '82065ff0e0427de4c4a2d7cfb57e8e83f1ee76daf7d62557dce888814c01';

export const cryptorankFetch = async (path) => {
  try {
    const res = await fetch(`${CR_BASE}${path}`, {
      headers: { 'X-Api-Key': EMBEDDED_CR_API_KEY },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { data: null, error: `CryptoRank ${res.status}: ${body.slice(0, 200)}` };
    }
    return { data: await res.json(), error: null };
  } catch (e) {
    return { data: null, error: e?.message || 'network error' };
  }
};

export const TOKEN_IMAGES_CACHE_KEY = 'catena.tokenImages.v2';

export const loadTokenImagesCache = () => {
  try {
    const raw = localStorage.getItem(TOKEN_IMAGES_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > 7 * 24 * 60 * 60 * 1000) return null;
    return parsed.map || null;
  } catch {
    return null;
  }
};

export const saveTokenImagesCache = (map) => {
  try {
    localStorage.setItem(TOKEN_IMAGES_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), map }));
  } catch {
    /* quota / disabled */
  }
};

// Pull up to 1000 tokens' metadata (one API credit) and build TICKER -> image URL.
export const fetchTokenImagesMap = async () => {
  const { data, error } = await cryptorankFetch('/currencies?limit=1000');
  if (error || !data?.data) return null;
  const map = {};
  for (const c of data.data) {
    if (!c.symbol) continue;
    const img = c.images?.x60 || c.images?.x150 || c.images?.icon || c.images?.native;
    if (img) map[String(c.symbol).toUpperCase()] = img;
  }
  return map;
};

// === Manager funding rounds ============================================== //
//
// CryptoRank's /v2/funds/{slug}/rounds endpoint returns the manager's recent
// investments. Slug defaults to a kebab-case of manager.name; the user can
// override per-manager via `manager.cryptorankSlug` if the auto-derived slug
// doesn't match. Cached for 24h in localStorage to avoid burning credits.

export const ROUNDS_CACHE_KEY = 'catena.crManagerRounds.v1';
const ROUNDS_TTL_MS = 24 * 60 * 60 * 1000;

export const slugifyManagerName = (name) =>
  (name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

const loadRoundsCache = () => {
  try {
    const raw = localStorage.getItem(ROUNDS_CACHE_KEY);
    return raw ? JSON.parse(raw) || {} : {};
  } catch {
    return {};
  }
};

const saveRoundsCache = (m) => {
  try {
    localStorage.setItem(ROUNDS_CACHE_KEY, JSON.stringify(m));
  } catch { /* quota / disabled */ }
};

export const fetchManagerRounds = async (slug) => {
  if (!slug) return { data: null, error: 'No CryptoRank slug for this manager.' };
  const cache = loadRoundsCache();
  const cached = cache[slug];
  if (cached && Date.now() - cached.savedAt < ROUNDS_TTL_MS) {
    return { data: cached.data, error: null };
  }
  const { data, error } = await cryptorankFetch(`/funds/${encodeURIComponent(slug)}/rounds`);
  if (error) return { data: null, error };
  // Normalize — CR responses wrap the array under .data sometimes.
  const rounds = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
  cache[slug] = { savedAt: Date.now(), data: rounds };
  saveRoundsCache(cache);
  return { data: rounds, error: null };
};
