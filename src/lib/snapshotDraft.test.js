import { describe, it, expect } from 'vitest';

import {
  txnDollarAmount,
  txnDelta,
  positionPriorNAV,
  positionNewNAV,
  totalPriorNAV,
  sumPositionNewNAV,
  residualCash,
  applyTxns,
  isCashBucket,
  getCashBucket,
  nonCashPositions,
} from './snapshotDraft.js';

const mkCash = (mv = 0) => ({
  id: 'cash_x',
  isCashBucket: true,
  positionName: 'Cash',
  ticker: 'USD',
  sectorId: 'cash',
  soiMarketValue: mv,
  quantity: 0,
});

describe('txnDollarAmount', () => {
  it('returns 0 for null/undefined txn', () => {
    expect(txnDollarAmount(null, 1000)).toBe(0);
    expect(txnDollarAmount(undefined, 1000)).toBe(0);
  });

  it('returns 0 for empty / null amount', () => {
    expect(txnDollarAmount({ type: 'B', amount: '', mode: '$' }, 1000)).toBe(0);
    expect(txnDollarAmount({ type: 'B', amount: null, mode: '$' }, 1000)).toBe(0);
  });

  it('returns the amount as dollars when mode is $', () => {
    expect(txnDollarAmount({ type: 'B', amount: 250, mode: '$' }, 1000)).toBe(250);
  });

  it('multiplies prior NAV by percentage when mode is %', () => {
    expect(txnDollarAmount({ type: 'S', amount: 50, mode: '%' }, 1000)).toBe(500);
  });

  it('returns 0 when amount is non-numeric', () => {
    expect(txnDollarAmount({ type: 'B', amount: 'abc', mode: '$' }, 1000)).toBe(0);
  });

  it('multiplies amount by soiPrice when mode is Qty', () => {
    expect(txnDollarAmount({ type: 'B', amount: 5, mode: 'Qty' }, 0, 4)).toBe(20);
    expect(txnDollarAmount({ type: 'S', amount: 10, mode: 'Qty' }, 0, 100)).toBe(1000);
  });

  it('Qty mode returns 0 when soiPrice is missing or zero', () => {
    expect(txnDollarAmount({ type: 'B', amount: 5, mode: 'Qty' }, 0, 0)).toBe(0);
    expect(txnDollarAmount({ type: 'B', amount: 5, mode: 'Qty' })).toBe(0);
  });
});

describe('txnDelta', () => {
  it('B (buy) returns a positive dollar delta', () => {
    expect(txnDelta({ type: 'B', amount: 100, mode: '$' }, 1000)).toBe(100);
  });

  it('C (cashflow allocation) returns a positive dollar delta', () => {
    expect(txnDelta({ type: 'C', amount: 100, mode: '$' }, 1000)).toBe(100);
  });

  it('S (sell) returns a negative dollar delta', () => {
    expect(txnDelta({ type: 'S', amount: 100, mode: '$' }, 1000)).toBe(-100);
  });

  it('respects % mode', () => {
    expect(txnDelta({ type: 'B', amount: 25, mode: '%' }, 1000)).toBe(250);
    expect(txnDelta({ type: 'S', amount: 50, mode: '%' }, 1000)).toBe(-500);
  });

  it('returns 0 for null/empty txn', () => {
    expect(txnDelta(null, 1000)).toBe(0);
    expect(txnDelta({ type: 'B', amount: '', mode: '$' }, 1000)).toBe(0);
  });

  it('honors Qty mode with soiPrice', () => {
    expect(txnDelta({ type: 'B', amount: 3, mode: 'Qty' }, 0, 50)).toBe(150);
    expect(txnDelta({ type: 'S', amount: 3, mode: 'Qty' }, 0, 50)).toBe(-150);
  });
});

describe('positionPriorNAV', () => {
  it('reads soiMarketValue', () => {
    expect(positionPriorNAV({ soiMarketValue: 1234 })).toBe(1234);
  });

  it('returns 0 when soiMarketValue is missing', () => {
    expect(positionPriorNAV({})).toBe(0);
    expect(positionPriorNAV({ soiMarketValue: null })).toBe(0);
  });
});

describe('positionNewNAV', () => {
  it('returns prior + signed delta', () => {
    expect(positionNewNAV({ soiMarketValue: 1000, txn: { type: 'B', amount: 250, mode: '$' } })).toBe(1250);
    expect(positionNewNAV({ soiMarketValue: 1000, txn: { type: 'S', amount: 250, mode: '$' } })).toBe(750);
  });

  it('returns prior unchanged when no txn', () => {
    expect(positionNewNAV({ soiMarketValue: 1000 })).toBe(1000);
  });
});

describe('totalPriorNAV', () => {
  it('sums soiMarketValue across positions', () => {
    expect(totalPriorNAV([{ soiMarketValue: 100 }, { soiMarketValue: 250 }])).toBe(350);
  });

  it('returns 0 for empty / null input', () => {
    expect(totalPriorNAV([])).toBe(0);
    expect(totalPriorNAV(null)).toBe(0);
  });
});

describe('sumPositionNewNAV', () => {
  it('sums NAV after applying each position txn', () => {
    const positions = [
      { soiMarketValue: 1000, txn: { type: 'B', amount: 100, mode: '$' } },
      { soiMarketValue: 500, txn: { type: 'S', amount: 50, mode: '$' } },
    ];
    expect(sumPositionNewNAV(positions)).toBe(1550);
  });
});

describe('residualCash', () => {
  it('starts from cashflow and applies B/S/C deltas', () => {
    // 100 in - 50 buy + 25 sell - 10 cashflow allocation = 65
    const positions = [
      { soiMarketValue: 0, txn: { type: 'B', amount: 50, mode: '$' } },
      { soiMarketValue: 0, txn: { type: 'S', amount: 25, mode: '$' } },
      { soiMarketValue: 0, txn: { type: 'C', amount: 10, mode: '$' } },
    ];
    expect(residualCash(positions, 100)).toBe(65);
  });

  it('returns the cashflow when no positions have txns', () => {
    expect(residualCash([{ soiMarketValue: 100 }], 50)).toBe(50);
  });

  it('returns 0 when nothing happened', () => {
    expect(residualCash([], 0)).toBe(0);
  });

  it('can be negative (capital called from cash bucket)', () => {
    const positions = [{ soiMarketValue: 0, txn: { type: 'B', amount: 200, mode: '$' } }];
    expect(residualCash(positions, 0)).toBe(-200);
  });

  it('can be positive (net inflow)', () => {
    const positions = [{ soiMarketValue: 1000, txn: { type: 'S', amount: 100, mode: '%' } }];
    expect(residualCash(positions, 0)).toBe(1000);
  });

  it('returns 0 for empty positions and zero cashflow', () => {
    expect(residualCash(null, 0)).toBe(0);
  });
});

describe('applyTxns', () => {
  it('strips the txn field and updates soiMarketValue to the post-txn value', () => {
    const positions = [
      { id: 'p1', soiMarketValue: 1000, txn: { type: 'B', amount: 100, mode: '$' } },
      { id: 'p2', soiMarketValue: 500, txn: null },
    ];
    const out = applyTxns(positions);
    expect(out[0]).toEqual({ id: 'p1', soiMarketValue: 1100 });
    expect(out[1]).toEqual({ id: 'p2', soiMarketValue: 500 });
    // txn field gone on every output position
    out.forEach((p) => expect(p.txn).toBeUndefined());
  });

  it('preserves other position fields', () => {
    const out = applyTxns([{ id: 'p1', positionName: 'BTC', ticker: 'BTC', soiMarketValue: 100, txn: null, costBasis: 50 }]);
    expect(out[0]).toMatchObject({ id: 'p1', positionName: 'BTC', ticker: 'BTC', costBasis: 50 });
  });

  it('returns [] for empty / null input', () => {
    expect(applyTxns([])).toEqual([]);
    expect(applyTxns(null)).toEqual([]);
  });
});

describe('cash bucket helpers', () => {
  it('isCashBucket flags only positions with isCashBucket: true', () => {
    expect(isCashBucket(mkCash())).toBe(true);
    expect(isCashBucket({ id: 'p1' })).toBe(false);
    expect(isCashBucket(null)).toBe(false);
  });

  it('getCashBucket finds the cash row in a positions array', () => {
    const positions = [{ id: 'p1' }, mkCash(500), { id: 'p2' }];
    expect(getCashBucket(positions).soiMarketValue).toBe(500);
  });

  it('getCashBucket returns null when none present', () => {
    expect(getCashBucket([{ id: 'p1' }])).toBe(null);
    expect(getCashBucket([])).toBe(null);
    expect(getCashBucket(null)).toBe(null);
  });

  it('nonCashPositions filters out the cash bucket', () => {
    const positions = [{ id: 'p1' }, mkCash(500), { id: 'p2' }];
    expect(nonCashPositions(positions).map((p) => p.id)).toEqual(['p1', 'p2']);
  });
});

describe('residualCash with a cash bucket', () => {
  it('ignores cash bucket positions when computing the delta', () => {
    // Cash bucket should never carry a txn, but if one slipped in it must
    // not affect the residual.
    const positions = [
      mkCash(1000),
      { id: 'p1', soiMarketValue: 500, txn: { type: 'B', amount: 100, mode: '$' } },
    ];
    expect(residualCash(positions, 0)).toBe(-100);
  });

  it('returns the net delta the cash bucket should absorb', () => {
    const positions = [
      mkCash(1000),
      { id: 'btc', soiMarketValue: 1000, txn: { type: 'B', amount: 200, mode: '$' } },
      { id: 'sol', soiMarketValue: 500, txn: { type: 'S', amount: 100, mode: '$' } },
    ];
    // -200 (buy) + 100 (sell) + 50 (cashflow in) = -50
    expect(residualCash(positions, 50)).toBe(-50);
  });
});

describe('applyTxns with a cash bucket', () => {
  it('absorbs the residual delta into the cash bucket NAV', () => {
    const positions = [
      mkCash(1000),
      { id: 'btc', soiMarketValue: 2000, txn: { type: 'B', amount: 500, mode: '$' } },
    ];
    const out = applyTxns(positions, 0);
    expect(out.find((p) => p.isCashBucket).soiMarketValue).toBe(500); // 1000 - 500
    expect(out.find((p) => p.id === 'btc').soiMarketValue).toBe(2500); // 2000 + 500
  });

  it('rolls cashflow into the cash bucket', () => {
    const positions = [mkCash(0)];
    const out = applyTxns(positions, 1000);
    expect(out.find((p) => p.isCashBucket).soiMarketValue).toBe(1000);
  });

  it('preserves cash bucket fields except soiMarketValue', () => {
    const positions = [mkCash(500), { id: 'p1', soiMarketValue: 100 }];
    const out = applyTxns(positions, 0);
    const cash = out.find((p) => p.isCashBucket);
    expect(cash).toMatchObject({ positionName: 'Cash', ticker: 'USD', sectorId: 'cash' });
  });

  it('does nothing different when no cash bucket is present', () => {
    const positions = [{ id: 'p1', soiMarketValue: 1000, txn: { type: 'B', amount: 100, mode: '$' } }];
    const out = applyTxns(positions, 50);
    expect(out).toEqual([{ id: 'p1', soiMarketValue: 1100 }]);
  });
});
