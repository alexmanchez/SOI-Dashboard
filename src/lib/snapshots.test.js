import { describe, it, expect } from 'vitest';

import {
  snapshotsOf,
  latestSnapshot,
  sortedSnapshots,
  snapshotAsOf,
  distinctSnapshotDates,
  earliestSnapshotDate,
  isLiquid,
  liquidityOverrideOf,
  cloneSnapshot,
  finalizeSnapshot,
} from './snapshots.js';

const mkSnap = (id, asOfDate, extras = {}) => ({
  id, asOfDate, notes: '', positions: [], subCommitments: [], status: 'finalized', ...extras,
});

const mkSoi = (snaps) => ({ id: 'soi_a', snapshots: snaps });

describe('snapshotsOf', () => {
  it('returns the snapshots array when present', () => {
    const soi = mkSoi([mkSnap('s1', '2025-01-01')]);
    expect(snapshotsOf(soi)).toHaveLength(1);
  });

  it('synthesizes a single snapshot from legacy flat positions', () => {
    const soi = { id: 'old', positions: [{ id: 'p1' }], asOfDate: '2024-12-01', notes: 'legacy' };
    const out = snapshotsOf(soi);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 'old_snap', asOfDate: '2024-12-01', notes: 'legacy' });
    expect(out[0].positions).toEqual([{ id: 'p1' }]);
  });

  it('synthesizes a single snapshot when snapshots[] is empty', () => {
    const soi = { id: 'empty', snapshots: [], positions: [{ id: 'p1' }] };
    const out = snapshotsOf(soi);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('empty_snap');
  });
});

describe('latestSnapshot', () => {
  it('returns the snapshot with the highest asOfDate', () => {
    const soi = mkSoi([mkSnap('s1', '2025-01-01'), mkSnap('s3', '2025-03-01'), mkSnap('s2', '2025-02-01')]);
    expect(latestSnapshot(soi).id).toBe('s3');
  });

  it('handles a single snapshot', () => {
    const soi = mkSoi([mkSnap('s1', '2025-01-01')]);
    expect(latestSnapshot(soi).id).toBe('s1');
  });

  it('handles missing asOfDate fields by treating empty string as the lowest', () => {
    const soi = mkSoi([mkSnap('s1', ''), mkSnap('s2', '2025-01-01')]);
    expect(latestSnapshot(soi).id).toBe('s2');
  });
});

describe('snapshotAsOf', () => {
  const soi = mkSoi([
    mkSnap('s1', '2025-01-01'),
    mkSnap('s2', '2025-04-01'),
    mkSnap('s3', '2025-08-01'),
  ]);

  it('returns the snapshot whose asOfDate is exactly the target', () => {
    expect(snapshotAsOf(soi, '2025-04-01').id).toBe('s2');
  });

  it('returns the most recent on-or-before snapshot when target is between snapshots', () => {
    expect(snapshotAsOf(soi, '2025-06-01').id).toBe('s2');
  });

  it('falls back to latest when the target is before every snapshot', () => {
    expect(snapshotAsOf(soi, '2024-01-01').id).toBe('s3');
  });

  it('returns the latest snapshot when target is after all snapshots', () => {
    expect(snapshotAsOf(soi, '2030-01-01').id).toBe('s3');
  });

  it('falls back to latest when dateStr is falsy', () => {
    expect(snapshotAsOf(soi, '').id).toBe('s3');
    expect(snapshotAsOf(soi, null).id).toBe('s3');
    expect(snapshotAsOf(soi, undefined).id).toBe('s3');
  });
});

describe('sortedSnapshots', () => {
  it('returns snapshots sorted ascending by asOfDate', () => {
    const soi = mkSoi([mkSnap('s2', '2025-04-01'), mkSnap('s1', '2025-01-01'), mkSnap('s3', '2025-08-01')]);
    expect(sortedSnapshots(soi).map((s) => s.id)).toEqual(['s1', 's2', 's3']);
  });

  it('does not mutate the input', () => {
    const snaps = [mkSnap('s2', '2025-04-01'), mkSnap('s1', '2025-01-01')];
    const soi = mkSoi(snaps);
    sortedSnapshots(soi);
    expect(snaps.map((s) => s.id)).toEqual(['s2', 's1']);
  });
});

describe('distinctSnapshotDates', () => {
  it('returns sorted unique dates across multiple SOIs', () => {
    const soIs = [
      mkSoi([mkSnap('a1', '2025-03-01'), mkSnap('a2', '2025-01-01')]),
      mkSoi([mkSnap('b1', '2025-03-01'), mkSnap('b2', '2025-02-01')]),
    ];
    expect(distinctSnapshotDates(soIs)).toEqual(['2025-01-01', '2025-02-01', '2025-03-01']);
  });

  it('returns [] for empty input', () => {
    expect(distinctSnapshotDates([])).toEqual([]);
    expect(distinctSnapshotDates(null)).toEqual([]);
    expect(distinctSnapshotDates(undefined)).toEqual([]);
  });

  it('skips snapshots without asOfDate', () => {
    const soi = mkSoi([mkSnap('s1', '2025-01-01'), mkSnap('s2', '')]);
    expect(distinctSnapshotDates([soi])).toEqual(['2025-01-01']);
  });
});

describe('earliestSnapshotDate', () => {
  it('returns the earliest non-empty asOfDate', () => {
    const soi = mkSoi([mkSnap('s1', '2025-04-01'), mkSnap('s2', '2025-01-01')]);
    expect(earliestSnapshotDate(soi)).toBe('2025-01-01');
  });

  it('returns null when no snapshot has an asOfDate', () => {
    const soi = mkSoi([mkSnap('s1', '')]);
    expect(earliestSnapshotDate(soi)).toBe(null);
  });
});

describe('isLiquid', () => {
  it('respects an explicit liquidityOverride: liquid', () => {
    expect(isLiquid({ liquidityOverride: 'liquid', assetType: 'SAFT' })).toBe(true);
  });

  it('respects an explicit liquidityOverride: illiquid', () => {
    expect(isLiquid({ liquidityOverride: 'illiquid', ticker: 'BTC', quantity: 1 })).toBe(false);
  });

  it('treats forceLiquid: true as liquid', () => {
    expect(isLiquid({ forceLiquid: true, assetType: 'SAFT' })).toBe(true);
  });

  it('returns false for SAFT/Warrant/SAFE asset types', () => {
    expect(isLiquid({ assetType: 'SAFT', ticker: 'X', quantity: 1 })).toBe(false);
    expect(isLiquid({ assetType: 'Warrant', ticker: 'Y', quantity: 1 })).toBe(false);
    expect(isLiquid({ assetType: 'SAFE', ticker: 'Z', quantity: 1 })).toBe(false);
  });

  it('returns true when ticker + positive quantity are set', () => {
    expect(isLiquid({ ticker: 'BTC', quantity: 1 })).toBe(true);
  });

  it('returns false when missing ticker or non-positive quantity', () => {
    expect(isLiquid({ ticker: '', quantity: 1 })).toBe(false);
    expect(isLiquid({ ticker: 'BTC', quantity: 0 })).toBe(false);
    expect(isLiquid({})).toBe(false);
  });
});

describe('liquidityOverrideOf', () => {
  it('returns the override when set', () => {
    expect(liquidityOverrideOf({ liquidityOverride: 'liquid' })).toBe('liquid');
    expect(liquidityOverrideOf({ liquidityOverride: 'illiquid' })).toBe('illiquid');
  });

  it('returns "liquid" when forceLiquid is set without override', () => {
    expect(liquidityOverrideOf({ forceLiquid: true })).toBe('liquid');
  });

  it('returns "auto" otherwise', () => {
    expect(liquidityOverrideOf({})).toBe('auto');
    expect(liquidityOverrideOf({ ticker: 'BTC' })).toBe('auto');
  });
});

describe('cloneSnapshot', () => {
  const soi = mkSoi([
    mkSnap('s1', '2025-01-01', { positions: [{ id: 'p1', name: 'BTC' }], subCommitments: [{ called: 100 }] }),
    mkSnap('s2', '2025-04-01'),
  ]);

  it('deep-copies positions + subCommitments and returns a draft snapshot', () => {
    const cloned = cloneSnapshot(soi, 's1', '2025-06-01');
    expect(cloned.asOfDate).toBe('2025-06-01');
    expect(cloned.status).toBe('draft');
    expect(cloned.positions).toEqual([{ id: 'p1', name: 'BTC' }]);
    // Deep copy: mutating the clone doesn't affect the source.
    cloned.positions[0].name = 'ETH';
    expect(soi.snapshots[0].positions[0].name).toBe('BTC');
  });

  it('throws when newAsOfDate already exists on the SOI', () => {
    expect(() => cloneSnapshot(soi, 's1', '2025-04-01')).toThrow(/already exists/);
  });

  it('throws when baseSnapshotId does not exist', () => {
    expect(() => cloneSnapshot(soi, 'missing', '2025-06-01')).toThrow(/not found/);
  });
});

describe('finalizeSnapshot', () => {
  it('flips the target snapshot status to finalized and sorts ascending', () => {
    const soi = mkSoi([
      mkSnap('s2', '2025-04-01', { status: 'draft' }),
      mkSnap('s1', '2025-01-01'),
    ]);
    const out = finalizeSnapshot(soi, 's2');
    expect(out.map((s) => s.id)).toEqual(['s1', 's2']);
    expect(out.find((s) => s.id === 's2').status).toBe('finalized');
  });

  it('is idempotent — finalizing an already-finalized snapshot is a no-op', () => {
    const soi = mkSoi([mkSnap('s1', '2025-01-01', { status: 'finalized' })]);
    const out = finalizeSnapshot(soi, 's1');
    expect(out[0].status).toBe('finalized');
  });

  it('does not mutate the original snapshots', () => {
    const soi = mkSoi([mkSnap('s1', '2025-01-01', { status: 'draft' })]);
    finalizeSnapshot(soi, 's1');
    expect(soi.snapshots[0].status).toBe('draft');
  });
});
