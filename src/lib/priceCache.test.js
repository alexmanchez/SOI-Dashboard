/* @vitest-environment jsdom */
/* Price history is the expensive CoinGecko call and the one that trips the
   keyless rate limit. Caching it across reloads is what keeps the app usable
   without an API key, so these guard the round-trip and its failure modes. */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadPriceCache, savePriceCache, clearPriceCache } from './priceCache';

const HISTORY = { bitcoin: { 1767139200000: 88363.72 }, ethereum: { 1767139200000: 2967.98 } };
const FETCHED = { bitcoin: 365, ethereum: 365 };

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('price history cache', () => {
  it('round-trips history and coverage', () => {
    savePriceCache(HISTORY, FETCHED);
    const out = loadPriceCache();
    expect(out.history).toEqual(HISTORY);
    expect(out.fetched).toEqual(FETCHED);
  });

  it('returns empty structures when nothing is cached', () => {
    expect(loadPriceCache()).toEqual({ history: {}, fetched: {} });
  });

  it('ignores a cache older than the TTL', () => {
    savePriceCache(HISTORY, FETCHED);
    const raw = JSON.parse(localStorage.getItem('catena.cgPriceHistory.v1'));
    raw.savedAt = Date.now() - 13 * 60 * 60 * 1000; // TTL is 12h
    localStorage.setItem('catena.cgPriceHistory.v1', JSON.stringify(raw));
    expect(loadPriceCache()).toEqual({ history: {}, fetched: {} });
  });

  it('survives corrupt JSON rather than throwing', () => {
    localStorage.setItem('catena.cgPriceHistory.v1', '{not json');
    expect(loadPriceCache()).toEqual({ history: {}, fetched: {} });
  });

  it('drops the cache instead of wedging when the quota is exceeded', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(savePriceCache(HISTORY, FETCHED)).toBe(false);
    spy.mockRestore();
    expect(loadPriceCache()).toEqual({ history: {}, fetched: {} });
  });

  it('clears on demand, so Refresh can force a refetch', () => {
    savePriceCache(HISTORY, FETCHED);
    clearPriceCache();
    expect(loadPriceCache()).toEqual({ history: {}, fetched: {} });
  });
});
