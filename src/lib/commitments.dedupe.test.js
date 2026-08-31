/* Guards against double-counting dated commitment rows.

   A commitment is a dated row — one per statement period per client per fund.
   Any total that sums the raw rows counts a fund's commitment once per period,
   so a single $10M fund with a year-end and a Q1 row reports $20M committed.
   Totals must first collapse to the row in force. */
import { describe, expect, it } from 'vitest';

import { commitmentAsOf, sortedCommitments } from './commitments';

const ROWS = [
  { id: 'a1', clientId: 'c1', soiId: 'f1', committed: 10_000_000, called: 6_000_000, asOfDate: '2025-12-31' },
  { id: 'a2', clientId: 'c1', soiId: 'f1', committed: 10_000_000, called: 7_500_000, asOfDate: '2026-03-31' },
  { id: 'b1', clientId: 'c1', soiId: 'f2', committed: 15_000_000, called: 3_000_000, asOfDate: '2026-03-31' },
];

// Mirrors the collapse FundEconomicsPage performs before totalling.
const inForce = (rows, asOf) => {
  const ids = new Set();
  const out = [];
  for (const r of rows) {
    const sameLine = rows.filter((x) => x.soiId === r.soiId && x.clientId === r.clientId);
    const winner = commitmentAsOf(sameLine, r.soiId, asOf) || r;
    if (!ids.has(winner.id)) { ids.add(winner.id); out.push(winner); }
  }
  return out;
};

const sum = (rows, key) => rows.reduce((n, r) => n + (r[key] || 0), 0);

describe('dated commitment totals', () => {
  it('counts a fund with two dated rows only once', () => {
    const rows = inForce(ROWS, null);
    expect(rows).toHaveLength(2);
    // Naively summing all three rows would report $35M.
    expect(sum(rows, 'committed')).toBe(25_000_000);
  });

  it('uses the latest row when no as-of date is given', () => {
    expect(sum(inForce(ROWS, null), 'called')).toBe(10_500_000); // 7.5M + 3M
  });

  it('falls back to the earlier row when time-travelling', () => {
    const rows = inForce(ROWS, '2025-12-31');
    // f2's only row post-dates the cut-off, so commitmentAsOf falls back to it.
    expect(rows.find((r) => r.soiId === 'f1').called).toBe(6_000_000);
  });

  it('keeps two clients in the same fund as separate commitments', () => {
    const twoClients = [
      ROWS[0],
      { id: 'z1', clientId: 'c2', soiId: 'f1', committed: 4_000_000, called: 1_000_000, asOfDate: '2025-12-31' },
    ];
    const rows = inForce(twoClients, null);
    expect(rows).toHaveLength(2);
    expect(sum(rows, 'committed')).toBe(14_000_000);
  });

  it('sortedCommitments orders rows chronologically', () => {
    expect(sortedCommitments(ROWS, 'f1').map((r) => r.asOfDate))
      .toEqual(['2025-12-31', '2026-03-31']);
  });
});
