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
  positionNewQuantity,
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

describe("'R' revaluation transactions", () => {
  const cash = (v) => ({ id: 'cash', isCashBucket: true, positionName: 'Cash', soiMarketValue: v });

  it('moves NAV without touching cash on a markup', () => {
    const positions = [
      cash(500_000),
      { id: 'saft', positionName: 'Aperture Labs SAFT', soiMarketValue: 1_200_000,
        txn: { type: 'R', amount: 600_000, mode: '$' } },
    ];
    // NAV rises by the re-mark...
    expect(positionNewNAV(positions[1])).toBe(1_800_000);
    // ...and the cash bucket is untouched: no cash changed hands.
    expect(residualCash(positions, 0)).toBe(0);
    const applied = applyTxns(positions, 0);
    expect(applied.find((p) => p.id === 'saft').soiMarketValue).toBe(1_800_000);
    expect(applied.find((p) => p.isCashBucket).soiMarketValue).toBe(500_000);
  });

  it('accepts a negative amount as a markdown', () => {
    const p = { id: 'x', soiMarketValue: 1_000_000, txn: { type: 'R', amount: -250_000, mode: '$' } };
    expect(positionNewNAV(p)).toBe(750_000);
    expect(residualCash([cash(0), p], 0)).toBe(0);
  });

  it('supports percentage re-marks in both directions', () => {
    const up = { id: 'u', soiMarketValue: 800_000, txn: { type: 'R', amount: 25, mode: '%' } };
    const down = { id: 'd', soiMarketValue: 800_000, txn: { type: 'R', amount: -50, mode: '%' } };
    expect(positionNewNAV(up)).toBe(1_000_000);
    expect(positionNewNAV(down)).toBe(400_000);
  });

  it('leaves buy/sell cash behaviour unchanged alongside a revaluation', () => {
    const positions = [
      cash(1_000_000),
      { id: 'b', soiMarketValue: 100_000, txn: { type: 'B', amount: 200_000, mode: '$' } },
      { id: 's', soiMarketValue: 500_000, txn: { type: 'S', amount: 300_000, mode: '$' } },
      { id: 'r', soiMarketValue: 400_000, txn: { type: 'R', amount: 900_000, mode: '$' } },
    ];
    // Buy debits 200k, sell credits 300k, revaluation contributes nothing.
    expect(residualCash(positions, 0)).toBe(100_000);
    const applied = applyTxns(positions, 0);
    expect(applied.find((p) => p.isCashBucket).soiMarketValue).toBe(1_100_000);
    expect(applied.find((p) => p.id === 'r').soiMarketValue).toBe(1_300_000);
  });
});

describe('quantity roll-forward', () => {
  const cashRow = { id: 'cash', isCashBucket: true, positionName: 'Cash', soiMarketValue: 1_000_000, quantity: 0 };

  it('reduces token count when a position is sold down', () => {
    // 60,000 UNI marked at $5.9193; sell the whole position.
    const uni = {
      id: 'uni', ticker: 'UNI', quantity: 60_000, soiPrice: 5.9193,
      soiMarketValue: 355_158, txn: { type: 'S', amount: 100, mode: '%' },
    };
    expect(positionNewQuantity(uni)).toBeCloseTo(0, 6);
    const [, applied] = applyTxns([cashRow, uni], 0);
    expect(applied.soiMarketValue).toBeCloseTo(0, 6);
    // The critical part: quantity must go to zero too, or live pricing keeps
    // valuing 60,000 UNI that the fund no longer holds.
    expect(applied.quantity).toBeCloseTo(0, 6);
  });

  it('increases token count on a dollar buy at the snapshot price', () => {
    const btc = {
      id: 'btc', ticker: 'BTC', quantity: 30, soiPrice: 88_363.7222,
      soiMarketValue: 2_650_912, txn: { type: 'B', amount: 1_000_000, mode: '$' },
    };
    // $1,000,000 / 88,363.7222 = 11.3169 BTC
    expect(positionNewQuantity(btc)).toBeCloseTo(30 + 1_000_000 / 88_363.7222, 6);
  });

  it('treats Qty mode as a literal token delta', () => {
    const sol = {
      id: 'sol', quantity: 8_000, soiPrice: 124.8266,
      soiMarketValue: 998_613, txn: { type: 'B', amount: 2_000, mode: 'Qty' },
    };
    expect(positionNewQuantity(sol)).toBe(10_000);
  });

  it('leaves quantity untouched on a revaluation', () => {
    // A re-mark is a price move: the fund still holds the same tokens.
    const btc = {
      id: 'btc', quantity: 30, soiPrice: 88_363.7222,
      soiMarketValue: 2_650_912, txn: { type: 'R', amount: -650_912, mode: '$' },
    };
    expect(positionNewQuantity(btc)).toBe(30);
    const [, applied] = applyTxns([cashRow, btc], 0);
    expect(applied.soiMarketValue).toBe(2_000_000);
    expect(applied.quantity).toBe(30);
  });

  it('never drives quantity negative on an oversized sell', () => {
    const p = { id: 'x', quantity: 100, soiPrice: 10, soiMarketValue: 1_000, txn: { type: 'S', amount: 5_000, mode: '$' } };
    expect(positionNewQuantity(p)).toBe(0);
  });

  it('leaves a zero-quantity illiquid position alone', () => {
    const saft = { id: 'saft', quantity: 0, soiPrice: 0, soiMarketValue: 1_200_000, txn: { type: 'R', amount: 600_000, mode: '$' } };
    expect(positionNewQuantity(saft)).toBe(0);
    const [, applied] = applyTxns([cashRow, saft], 0);
    expect(applied.soiMarketValue).toBe(1_800_000);
  });
});
