// Helpers for the roll-forward snapshot editor (Cambridge-style WHAT-IF table).
//
// Each position in a draft snapshot may carry a transient `txn` field:
//   { type: 'B' | 'S' | 'C', amount: number, mode: '$' | '%' }
//   B = buy/add (adds to NAV, debits cash)
//   S = sell (subtracts from NAV, credits cash)
//   C = cashflow allocation (adds to NAV, debits cash) — explicit "put residual here"
// `mode` controls how `amount` is interpreted: '$' is a dollar amount, '%' is
// a percentage of the position's prior NAV (handy for partial sells like 50%).

export const txnDollarAmount = (txn, priorNAV = 0) => {
  if (!txn || txn.amount == null || txn.amount === '') return 0;
  const amt = Number(txn.amount);
  if (Number.isNaN(amt)) return 0;
  return txn.mode === '%' ? (priorNAV * amt) / 100 : amt;
};

export const txnDelta = (txn, priorNAV = 0) => {
  const dollar = txnDollarAmount(txn, priorNAV);
  return txn?.type === 'S' ? -dollar : dollar;
};

export const positionPriorNAV = (p) => Number(p.soiMarketValue) || 0;
export const positionNewNAV = (p) => {
  const prior = positionPriorNAV(p);
  return prior + txnDelta(p.txn, prior);
};

export const totalPriorNAV = (positions) =>
  (positions || []).reduce((s, p) => s + positionPriorNAV(p), 0);

export const sumPositionNewNAV = (positions) =>
  (positions || []).reduce((s, p) => s + positionNewNAV(p), 0);

/* residualCash = "cash delta" — net change to the fund's cash bucket:
     + cashflow in
     + sells (positions converted to cash)
     - buys
     - cashflow allocations
   This is informational rather than enforced — funds frequently end periods
   with non-zero cash positions. The editor uses this for a soft warning when
   the user might want to allocate the remaining cash. */
export const residualCash = (positions, cashflow = 0) => {
  let residual = Number(cashflow) || 0;
  for (const p of positions || []) {
    if (!p.txn) continue;
    const dollar = txnDollarAmount(p.txn, positionPriorNAV(p));
    if (p.txn.type === 'B') residual -= dollar;
    else if (p.txn.type === 'S') residual += dollar;
    else if (p.txn.type === 'C') residual -= dollar;
  }
  return residual;
};

/* Apply all txns to positions, returning a clean array with no `txn` fields and
   soiMarketValue updated to the post-transaction value. */
export const applyTxns = (positions) =>
  (positions || []).map((p) => {
    const newValue = positionNewNAV(p);
    const { txn: _txn, ...clean } = p;
    return { ...clean, soiMarketValue: newValue };
  });
