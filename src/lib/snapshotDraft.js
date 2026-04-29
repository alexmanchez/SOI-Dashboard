// Helpers for the roll-forward snapshot editor (Cambridge-style WHAT-IF table).
//
// Each position in a draft snapshot may carry a transient `txn` field:
//   { type: 'B' | 'S' | 'C', amount: number, mode: '$' | '%' | 'Qty' }
//   B = buy/add (adds to NAV, debits cash)
//   S = sell (subtracts from NAV, credits cash)
//   C = cashflow allocation (adds to NAV, debits cash) — explicit "put residual here"
// `mode` controls how `amount` is interpreted:
//   '$'   — literal dollar amount.
//   '%'   — percentage of the position's prior NAV (handy for partial sells like 50%).
//   'Qty' — token quantity; dollar value derived from `soiPrice`.
//
// One position per snapshot is the synthetic CASH BUCKET — flagged by
// `isCashBucket: true`. The cash bucket's TXN is auto-derived from every
// non-cash B/S/C plus the explicit cashflow input, so the user never edits
// it directly. See SnapshotEditor for the UI rendering.

export const isCashBucket = (p) => p?.isCashBucket === true;

export const getCashBucket = (positions) =>
  (positions || []).find(isCashBucket) || null;

export const nonCashPositions = (positions) =>
  (positions || []).filter((p) => !isCashBucket(p));

export const txnDollarAmount = (txn, priorNAV = 0, soiPrice = 0) => {
  if (!txn || txn.amount == null || txn.amount === '') return 0;
  const amt = Number(txn.amount);
  if (Number.isNaN(amt)) return 0;
  if (txn.mode === '%') return (priorNAV * amt) / 100;
  if (txn.mode === 'Qty') return amt * (Number(soiPrice) || 0);
  return amt;
};

export const txnDelta = (txn, priorNAV = 0, soiPrice = 0) => {
  const dollar = txnDollarAmount(txn, priorNAV, soiPrice);
  return txn?.type === 'S' ? -dollar : dollar;
};

export const positionPriorNAV = (p) => Number(p.soiMarketValue) || 0;
export const positionNewNAV = (p) => {
  const prior = positionPriorNAV(p);
  return prior + txnDelta(p.txn, prior, p.soiPrice);
};

export const totalPriorNAV = (positions) =>
  (positions || []).reduce((s, p) => s + positionPriorNAV(p), 0);

export const sumPositionNewNAV = (positions) =>
  (positions || []).reduce((s, p) => s + positionNewNAV(p), 0);

/* residualCash = "cash delta" — net change to the fund's cash bucket from
   all non-cash B/S/C transactions plus the explicit cashflow input:
     + cashflow in
     + sells (positions converted to cash)
     - buys
     - cashflow allocations
   Cash-bucket positions are excluded from the sum since their txn is always
   null (the bucket is the sink, not a source of B/S/C deltas). */
export const residualCash = (positions, cashflow = 0) => {
  let residual = Number(cashflow) || 0;
  for (const p of nonCashPositions(positions)) {
    if (!p.txn) continue;
    const dollar = txnDollarAmount(p.txn, positionPriorNAV(p), p.soiPrice);
    if (p.txn.type === 'B') residual -= dollar;
    else if (p.txn.type === 'S') residual += dollar;
    else if (p.txn.type === 'C') residual -= dollar;
  }
  return residual;
};

/* Apply all txns to positions, returning a clean array with no `txn` fields
   and soiMarketValue updated to the post-transaction value.

   When a cash bucket is present, its new soiMarketValue absorbs the residual
   cash delta (priorCash + residualCash). Pass `cashflow` so the explicit
   capital-call / distribution input rolls into the bucket too. */
export const applyTxns = (positions, cashflow = 0) => {
  if (!positions) return [];
  const cash = getCashBucket(positions);
  const cleaned = positions.map((p) => {
    const newValue = isCashBucket(p) ? positionPriorNAV(p) : positionNewNAV(p);
    const { txn: _txn, ...clean } = p;
    return { ...clean, soiMarketValue: newValue };
  });
  if (!cash) return cleaned;
  const delta = residualCash(positions, cashflow);
  const newCashValue = positionPriorNAV(cash) + delta;
  return cleaned.map((p) => (p.isCashBucket ? { ...p, soiMarketValue: newCashValue } : p));
};
