/* Ranking guards for searchCoins.

   Memecoins deliberately squat the names and symbols of major assets, so a
   naive "exact symbol first" ranking surfaces them above the real thing.
   These fixtures are shaped like the real /coins/list entries that caused it. */
import { describe, expect, it } from 'vitest';

import { searchCoins } from './coingecko';

const COINS = [
  // Squatter whose *symbol* is literally "ethereum".
  { id: 'harrypottertrumphomersimpson777inu', symbol: 'ethereum', name: 'HarryPotterTrumpHomerSimpson777Inu' },
  { id: 'barbiecrashbandicootrfk88', symbol: 'solana', name: 'BarbieCrashBandicootRFK88' },
  { id: 'apu-apustaja-solana', symbol: 'apu', name: 'Apu Apustaja (Solana)' },
  { id: 'baby-solana', symbol: 'babysol', name: 'Baby Solana' },
  { id: 'ethereum-classic', symbol: 'etc', name: 'Ethereum Classic' },
  { id: 'bitcoin-cash', symbol: 'bch', name: 'Bitcoin Cash' },
  // The canonical assets — note they sort late here on purpose.
  { id: 'solana', symbol: 'sol', name: 'Solana' },
  { id: 'ethereum', symbol: 'eth', name: 'Ethereum' },
  { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' },
  { id: 'chainlink', symbol: 'link', name: 'Chainlink' },
  { id: 'uniswap', symbol: 'uni', name: 'Uniswap' },
];

describe('searchCoins ranking', () => {
  it.each([
    ['bitcoin', 'bitcoin'],
    ['ethereum', 'ethereum'],
    ['solana', 'solana'],
    ['chainlink', 'chainlink'],
    ['uniswap', 'uniswap'],
  ])('ranks the canonical asset first for %s', (query, expectedId) => {
    expect(searchCoins(COINS, query)[0].id).toBe(expectedId);
  });

  it('outranks a memecoin that squats a major asset symbol', () => {
    const top = searchCoins(COINS, 'ethereum')[0];
    expect(top.id).toBe('ethereum');
    expect(top.symbol).toBe('eth');
  });

  it('still finds the canonical asset when many coins merely contain the word', () => {
    const ids = searchCoins(COINS, 'solana').map((c) => c.id);
    expect(ids).toContain('solana');
    expect(ids[0]).toBe('solana');
  });

  it('still resolves a plain ticker search', () => {
    expect(searchCoins(COINS, 'btc')[0].id).toBe('bitcoin');
    expect(searchCoins(COINS, 'link')[0].id).toBe('chainlink');
  });

  it('returns nothing for an empty query and tolerates a bad list', () => {
    expect(searchCoins(COINS, '')).toEqual([]);
    expect(searchCoins(null, 'btc')).toEqual([]);
  });
});
