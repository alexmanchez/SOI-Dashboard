import { describe, it, expect } from 'vitest';

import {
  commitmentsForSoi,
  sortedCommitments,
  latestCommitment,
  commitmentAsOf,
} from './commitments.js';

const mkC = (id, soiId, asOfDate, extras = {}) =>
  ({ id, soiId, clientId: 'c1', committed: 1000, called: 700, asOfDate, ...extras });

describe('commitmentsForSoi', () => {
  it('filters commitments by soiId', () => {
    const all = [mkC('a', 'soi1', '2025-01-01'), mkC('b', 'soi2', '2025-01-01'), mkC('c', 'soi1', '2025-02-01')];
    expect(commitmentsForSoi(all, 'soi1').map((c) => c.id)).toEqual(['a', 'c']);
  });

  it('returns [] for empty / null input', () => {
    expect(commitmentsForSoi([], 'soi1')).toEqual([]);
    expect(commitmentsForSoi(null, 'soi1')).toEqual([]);
  });

  it('returns [] when no commitments match', () => {
    expect(commitmentsForSoi([mkC('a', 'soi2', '2025-01-01')], 'soi1')).toEqual([]);
  });
});

describe('sortedCommitments', () => {
  it('returns ascending-by-asOfDate', () => {
    const all = [mkC('a', 'soi1', '2025-04-01'), mkC('b', 'soi1', '2025-01-01'), mkC('c', 'soi1', '2025-08-01')];
    expect(sortedCommitments(all, 'soi1').map((c) => c.id)).toEqual(['b', 'a', 'c']);
  });
});

describe('latestCommitment', () => {
  it('returns the most recent commitment for a soi', () => {
    const all = [mkC('a', 'soi1', '2025-01-01'), mkC('b', 'soi1', '2025-04-01')];
    expect(latestCommitment(all, 'soi1').id).toBe('b');
  });

  it('returns null when no commitments exist for the soi', () => {
    expect(latestCommitment([mkC('a', 'soi2', '2025-01-01')], 'soi1')).toBe(null);
  });

  it('returns null for empty input', () => {
    expect(latestCommitment([], 'soi1')).toBe(null);
  });
});

describe('commitmentAsOf', () => {
  const all = [
    mkC('a', 'soi1', '2025-01-01', { called: 100 }),
    mkC('b', 'soi1', '2025-04-01', { called: 200 }),
    mkC('c', 'soi1', '2025-08-01', { called: 300 }),
  ];

  it('returns the exact-date commitment when asOfDate matches one', () => {
    expect(commitmentAsOf(all, 'soi1', '2025-04-01').id).toBe('b');
  });

  it('returns the most recent on-or-before commitment when in between', () => {
    expect(commitmentAsOf(all, 'soi1', '2025-06-01').id).toBe('b');
  });

  it('falls back to latest when target is before every commitment', () => {
    expect(commitmentAsOf(all, 'soi1', '2024-01-01').id).toBe('c');
  });

  it('returns latest when target is after all commitments', () => {
    expect(commitmentAsOf(all, 'soi1', '2030-01-01').id).toBe('c');
  });

  it('falls back to latest when dateStr is falsy', () => {
    expect(commitmentAsOf(all, 'soi1', '').id).toBe('c');
    expect(commitmentAsOf(all, 'soi1', null).id).toBe('c');
    expect(commitmentAsOf(all, 'soi1', undefined).id).toBe('c');
  });

  it('returns null when no commitments exist for the soi', () => {
    expect(commitmentAsOf(all, 'other', '2025-01-01')).toBe(null);
  });
});
