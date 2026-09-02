import { describe, expect, it } from 'vitest';

import { buildFundComparison } from './fundComparison';

/* Two direct funds with deliberate overlap, plus a fund-of-funds holding both.
   Northgate NAV = 20M, Sable NAV = 10M. */
const makeStore = () => ({
  managers: [
    { id: 'm1', name: 'Northgate Digital', type: 'direct' },
    { id: 'm2', name: 'Sable Ridge Capital', type: 'direct' },
    { id: 'm3', name: 'Atlas Multi-Manager', type: 'fund_of_funds' },
  ],
  soIs: [
    {
      id: 'f1', managerId: 'm1', vintage: 'Fund I', fundName: 'Northgate Fund I',
      snapshots: [{ id: 's1', asOfDate: '2025-09-30', subCommitments: [], positions: [
        { id: 'p1', positionName: 'Ethereum', ticker: 'ETH', soiMarketValue: 12_000_000, sectorId: 'infrastructure' },
        { id: 'p2', positionName: 'Chainlink', ticker: 'LINK', soiMarketValue: 8_000_000, sectorId: 'middleware' },
      ] }],
    },
    {
      id: 'f2', managerId: 'm2', vintage: 'Fund I', fundName: 'Sable Ridge Fund I',
      snapshots: [{ id: 's2', asOfDate: '2025-09-30', subCommitments: [], positions: [
        { id: 'p3', positionName: 'Ethereum', ticker: 'ETH', soiMarketValue: 6_000_000, sectorId: 'infrastructure' },
        { id: 'p4', positionName: 'Uniswap', ticker: 'UNI', soiMarketValue: 4_000_000, sectorId: 'defi' },
      ] }],
    },
    {
      id: 'f3', managerId: 'm3', vintage: 'Fund I', fundName: 'Atlas Diversified I',
      snapshots: [{ id: 's3', asOfDate: '2025-09-30', positions: [], subCommitments: [
        { id: 'sc1', toSoiId: 'f1', committed: 4_000_000, called: 2_000_000 }, // 10% of Northgate
        { id: 'sc2', toSoiId: 'f2', committed: 3_000_000, called: 2_500_000 }, // 25% of Sable
      ] }],
    },
  ],
  commitments: [],
  sectorOverrides: {},
});

describe('buildFundComparison', () => {
  it('gives a direct fund its positions at face value', () => {
    const { columns, rows } = buildFundComparison(makeStore(), { soiIds: ['f1'] });
    expect(columns).toHaveLength(1);
    expect(columns[0].total).toBe(20_000_000);
    expect(rows.find(r => r.key === 'ETH').values.f1).toBe(12_000_000);
  });

  it('scales a fund-of-funds by its ownership of each underlying fund', () => {
    const { columns, rows } = buildFundComparison(makeStore(), { soiIds: ['f3'] });
    // 10% of Northgate + 25% of Sable = 2.0M + 2.5M called
    expect(columns[0].total).toBeCloseTo(4_500_000, 6);
    // ETH: 12M * 0.10 + 6M * 0.25 = 1.2M + 1.5M
    expect(rows.find(r => r.key === 'ETH').values.f3).toBeCloseTo(2_700_000, 6);
    // UNI only exists in Sable: 4M * 0.25
    expect(rows.find(r => r.key === 'UNI').values.f3).toBeCloseTo(1_000_000, 6);
  });

  it('counts how many funds hold each position', () => {
    const { rows } = buildFundComparison(makeStore(), { soiIds: ['f1', 'f2'] });
    expect(rows.find(r => r.key === 'ETH').fundCount).toBe(2);
    expect(rows.find(r => r.key === 'UNI').fundCount).toBe(1);
  });

  it('reports overlap as the value held by more than one fund', () => {
    const cmp = buildFundComparison(makeStore(), { soiIds: ['f1', 'f2'] });
    // Only ETH is shared: 12M + 6M
    expect(cmp.overlapCount).toBe(1);
    expect(cmp.overlapValue).toBe(18_000_000);
    expect(cmp.grandTotal).toBe(30_000_000);
    expect(cmp.overlapPct).toBeCloseTo(60, 6);
  });

  it('flags a fund-of-funds shown alongside its own underlying funds', () => {
    const cmp = buildFundComparison(makeStore(), { soiIds: ['f1', 'f2', 'f3'] });
    expect(cmp.doubleCounted).toHaveLength(1);
    // fundLabel combines fund name and vintage, e.g. "Atlas Diversified I (Fund I)".
    expect(cmp.doubleCounted[0].fof).toContain('Atlas Diversified I');
    expect(cmp.doubleCounted[0].underlying.join(' ')).toContain('Northgate Fund I');
    expect(cmp.doubleCounted[0].underlying.join(' ')).toContain('Sable Ridge Fund I');
  });

  it('does not flag double counting when only the fund-of-funds is shown', () => {
    const cmp = buildFundComparison(makeStore(), { soiIds: ['f3'] });
    expect(cmp.doubleCounted).toEqual([]);
  });

  it('skips a fund-of-funds with no underlying funds linked', () => {
    const store = makeStore();
    store.soIs.find(s => s.id === 'f3').snapshots[0].subCommitments = [];
    const { columns } = buildFundComparison(store, { soiIds: ['f3'] });
    expect(columns).toEqual([]);
  });

  it('ignores an underlying fund with no NAV rather than dividing by zero', () => {
    const store = makeStore();
    store.soIs.find(s => s.id === 'f2').snapshots[0].positions = [];
    const { columns, rows } = buildFundComparison(store, { soiIds: ['f3'] });
    // Only the Northgate leg survives: 12M * 0.10
    expect(columns[0].total).toBeCloseTo(2_000_000, 6);
    expect(rows.every(r => Number.isFinite(r.total))).toBe(true);
  });

  it('does not look through a nested fund-of-funds', () => {
    const store = makeStore();
    store.managers.push({ id: 'm4', name: 'Beacon', type: 'fund_of_funds' });
    store.soIs.push({
      id: 'f4', managerId: 'm4', vintage: 'Fund I', fundName: 'Beacon Core',
      snapshots: [{ id: 's4', asOfDate: '2025-09-30', positions: [], subCommitments: [
        { id: 'sc3', toSoiId: 'f3', committed: 1_000_000, called: 1_000_000 },
      ] }],
    });
    const { columns } = buildFundComparison(store, { soiIds: ['f4'] });
    // The only leg points at another FoF, so nothing is contributed.
    expect(columns[0].total).toBe(0);
  });
});
