import { useMemo, useState } from 'react';
import { ArrowLeft, Plus, Save, X } from 'lucide-react';

import {
  PANEL, PANEL_2, BORDER, TEXT, TEXT_DIM, TEXT_MUTE,
  ACCENT, GOLD, GREEN, RED, BG,
} from '../lib/theme';
import { fmtCurrency, fmtPct, fundLabel, today } from '../lib/format';
import { sectorOf, getSectors } from '../lib/sectors';
import { latestSnapshot, snapshotsOf } from '../lib/snapshots';
import {
  positionPriorNAV, positionNewNAV, totalPriorNAV, sumPositionNewNAV,
  residualCash, applyTxns,
  isCashBucket, getCashBucket, nonCashPositions,
} from '../lib/snapshotDraft';

import { Panel } from '../components/ui';
import { TokenSearch } from '../components/TokenSearch';

/* Roll-forward snapshot editor — Cambridge-style WHAT-IF table.
   Two-pane layout: prior snapshot on the left (gray), new snapshot on the right
   (accent-tinted). User edits the CHANGE column with B/S/C tags + amounts.
   Computed columns: TXN, TXN%, new NAV, new ALLOC%. On save, txns collapse into
   the position's soiMarketValue and a finalized snapshot is appended. */
export function SnapshotEditor({ store, soiId, updateStore, onClose, apiKey }) {
  const soi = store.soIs.find((s) => s.id === soiId);
  const manager = store.managers.find((m) => m.id === soi?.managerId);
  const baseSnap = soi ? latestSnapshot(soi) : null;

  const [asOfDate, setAsOfDate] = useState(today());
  const [description, setDescription] = useState('');
  const [draft, setDraft] = useState(() => {
    if (!soi || !baseSnap) return [];
    // Existing positions are already linked — they have names/tickers from the
    // prior snapshot. New ones (added below) start with _linked: false so the
    // search dropdown shows.
    const seeded = (baseSnap.positions || []).map((p) => ({ ...p, txn: null, _linked: true }));
    // Defensive: ensure a cash bucket exists even if storage migration missed
    // this snapshot. Pin it as the first row so render order matches data order.
    if (!seeded.some(isCashBucket)) {
      seeded.unshift({
        id: `cash_${Math.random().toString(36).slice(2, 10)}`,
        isCashBucket: true,
        positionName: 'Cash',
        ticker: 'USD',
        sectorId: 'cash',
        soiMarketValue: 0,
        quantity: 0,
        assetType: 'Cash',
        txn: null,
        _linked: true,
      });
    }
    return seeded;
  });
  const [cashflow, setCashflow] = useState(0);

  // Split cash bucket from non-cash for rendering. Cash row is pinned at the
  // top with a distinct treatment; everything else flows in declared order.
  const cashRow = useMemo(() => getCashBucket(draft), [draft]);
  const nonCash = useMemo(() => nonCashPositions(draft), [draft]);
  const priorTotal = useMemo(() => totalPriorNAV(draft), [draft]);
  const newTotal = useMemo(() => sumPositionNewNAV(nonCash) + (cashRow ? positionPriorNAV(cashRow) + residualCash(draft, cashflow) : 0), [nonCash, cashRow, draft, cashflow]);
  const residual = useMemo(() => residualCash(draft, cashflow), [draft, cashflow]);
  const dateConflict = useMemo(() => {
    if (!soi || !asOfDate) return false;
    return snapshotsOf(soi).some((s) => (s.asOfDate || '') === asOfDate);
  }, [soi, asOfDate]);
  // Save is gated only on a valid, non-conflicting date. Residual cash is a
  // soft warning, not a blocker — funds end periods with non-zero cash all
  // the time (capital called but not yet deployed, distributions awaiting
  // wire, etc.). The user can save and reconcile cash on the next snapshot.
  const canSave = !dateConflict && !!asOfDate;
  // With a cash bucket present the residual is auto-absorbed, so the gold
  // "leftover cash" warning treatment no longer applies. Keep the legacy
  // warning for snapshots without a cash bucket (defensive).
  const residualSignificant = !cashRow && Math.abs(residual) >= 1;

  if (!soi || !baseSnap) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: BG, color: TEXT }}>
        <div className="text-center">
          <div className="text-sm mb-2" style={{ color: TEXT_DIM }}>
            No snapshot to roll forward from. Add a baseline snapshot to this fund first.
          </div>
          <button onClick={onClose} className="px-3 py-1.5 rounded text-xs" style={{ border: `1px solid ${BORDER}` }}>
            Close
          </button>
        </div>
      </div>
    );
  }

  const setTxn = (positionId, txn) => {
    setDraft((d) => d.map((p) => (p.id === positionId ? { ...p, txn } : p)));
  };

  const addBlankPosition = () => {
    const newPos = {
      id: `p_${Math.random().toString(36).slice(2, 10)}`,
      positionName: '',
      ticker: '',
      sectorId: 'unclassified',
      quantity: 0,
      soiPrice: 0,
      soiMarketValue: 0,
      costBasis: 0,
      txn: null,
    };
    setDraft((d) => [...d, newPos]);
  };

  const updatePositionField = (id, field, value) => {
    setDraft((d) => d.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  };

  const handleSave = () => {
    if (!canSave) return;
    // Strip the transient _linked flag before saving — it's a UI-only marker
    // for whether the row has been resolved to a token.
    const stripped = draft.map(({ _linked: _l, ...rest }) => rest);
    // applyTxns absorbs cashflow + B/S/C deltas into the cash bucket so the
    // saved snapshot's cash position carries the correct end-of-period balance.
    const cleaned = applyTxns(stripped, cashflow);
    const newSnap = {
      id: `s_${Math.random().toString(36).slice(2, 10)}`,
      asOfDate,
      notes: description,
      positions: cleaned,
      subCommitments: [...(baseSnap.subCommitments || [])],
      status: 'finalized',
    };
    const finalizedSnaps = [...snapshotsOf(soi), newSnap]
      .sort((a, b) => ((a.asOfDate || '') < (b.asOfDate || '') ? -1 : 1));
    updateStore((st) => ({
      ...st,
      soIs: st.soIs.map((s) => (s.id === soiId ? { ...s, snapshots: finalizedSnaps } : s)),
    }));
    onClose();
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: BG, color: TEXT }}>
      <div className="max-w-[1600px] mx-auto px-6 py-4">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={onClose} className="text-xs flex items-center gap-1 hover:underline" style={{ color: TEXT_DIM }}>
            <ArrowLeft size={12} /> Cancel
          </button>
          <div className="flex items-center gap-2">
            {dateConflict && (
              <span className="text-[11px]" style={{ color: RED }}>
                A snapshot for {asOfDate} already exists — pick a different date.
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={!canSave}
              title={residualSignificant ? `Cash delta of ${residual >= 0 ? '+' : ''}$${Math.round(residual).toLocaleString()} will roll into the fund's cash position.` : 'Save snapshot'}
              className="px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5"
              style={{
                backgroundColor: !canSave ? 'transparent' : (residualSignificant ? GOLD + '22' : ACCENT + '22'),
                color: !canSave ? TEXT_DIM : (residualSignificant ? GOLD : ACCENT),
                border: `1px solid ${!canSave ? BORDER : (residualSignificant ? GOLD + '44' : ACCENT + '44')}`,
                opacity: canSave ? 1 : 0.5,
                cursor: canSave ? 'pointer' : 'not-allowed',
              }}
            >
              <Save size={12} /> Save snapshot
            </button>
          </div>
        </div>

        {/* Header — date + description */}
        <Panel className="p-4 mb-4">
          <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: TEXT_MUTE }}>
            New snapshot for {manager?.name} — {fundLabel(soi)}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-xs" style={{ color: TEXT_DIM }}>
              As of:
              <input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="text-sm rounded px-2 py-1"
                style={{ backgroundColor: PANEL_2, border: `1px solid ${dateConflict ? RED : BORDER}`, color: TEXT, colorScheme: 'dark' }}
              />
            </label>
            <input
              type="text"
              placeholder="Description (e.g. Q3 2025 statement)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="flex-1 text-sm rounded px-2 py-1"
              style={{ backgroundColor: PANEL_2, border: `1px solid ${BORDER}`, color: TEXT, minWidth: 260 }}
            />
          </div>
        </Panel>

        {/* Positions table */}
        <Panel className="p-0 mb-4 overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${BORDER}` }}>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: TEXT_MUTE }}>
              Positions ({nonCash.length}{cashRow ? ' + cash' : ''}) · Prior NAV {fmtCurrency(priorTotal)} → New NAV {fmtCurrency(newTotal)}
            </div>
            <button onClick={addBlankPosition}
              className="text-xs px-2 py-1 rounded flex items-center gap-1"
              style={{ color: ACCENT, border: `1px solid ${ACCENT}44` }}
            >
              <Plus size={11} /> Add asset
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: TEXT_MUTE, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `1px solid ${BORDER}` }}>
                  <th className="text-left px-3 py-2">Position</th>
                  <th className="text-left px-3 py-2">Sector</th>
                  <th className="text-right px-3 py-2" style={{ color: TEXT_DIM }}>Prior NAV</th>
                  <th className="text-right px-3 py-2" style={{ color: TEXT_DIM }}>Prior %</th>
                  <th className="text-left px-3 py-2" style={{ color: ACCENT }}>Change</th>
                  <th className="text-right px-3 py-2">TXN</th>
                  <th className="text-right px-3 py-2">TXN %</th>
                  <th className="text-right px-3 py-2" style={{ color: ACCENT }}>New NAV</th>
                  <th className="text-right px-3 py-2" style={{ color: ACCENT }}>New %</th>
                </tr>
              </thead>
              <tbody>
                {cashRow && (() => {
                  const priorNAV = positionPriorNAV(cashRow);
                  const priorPct = priorTotal > 0 ? (priorNAV / priorTotal) * 100 : 0;
                  const txnAmt = residual; // auto-derived absorption
                  const newNAV = priorNAV + txnAmt;
                  const newPct = newTotal > 0 ? (newNAV / newTotal) * 100 : 0;
                  return (
                    <tr style={{
                      borderBottom: `1px solid ${BORDER}`,
                      backgroundColor: GOLD + '0a',
                      borderLeft: `2px solid ${GOLD}66`,
                    }}>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium" style={{ color: GOLD }}>Cash</span>
                          <span className="text-[10px] px-1 py-0.5 rounded" style={{ color: GOLD, border: `1px solid ${GOLD}44`, fontSize: 9 }}>USD</span>
                        </div>
                        <div className="text-[10px]" style={{ color: TEXT_MUTE }}>
                          Auto-balanced from buys, sells, and cashflow
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-[10px] font-medium rounded px-1.5 py-0.5" style={{ backgroundColor: GOLD + '22', color: GOLD, border: `1px solid ${GOLD}44` }}>
                          Cash
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums" style={{ color: TEXT_DIM }}>{fmtCurrency(priorNAV)}</td>
                      <td className="px-3 py-2 text-right tabular-nums" style={{ color: TEXT_DIM }}>{fmtPct(priorPct, 2)}</td>
                      <td className="px-3 py-2 text-[10px]" style={{ color: TEXT_MUTE }}>
                        Derived: −Buys + Sells − Allocations + Cashflow
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums" style={{ color: txnAmt > 0 ? GREEN : (txnAmt < 0 ? RED : TEXT_DIM) }}>
                        {Math.abs(txnAmt) < 1 ? '—' : (txnAmt > 0 ? '+' : '') + fmtCurrency(txnAmt)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums" style={{ color: TEXT_DIM }}>
                        {priorTotal > 0 && Math.abs(txnAmt) >= 1 ? fmtPct((txnAmt / priorTotal) * 100, 2) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium" style={{ color: GOLD }}>{fmtCurrency(newNAV)}</td>
                      <td className="px-3 py-2 text-right tabular-nums" style={{ color: GOLD }}>{fmtPct(newPct, 2)}</td>
                    </tr>
                  );
                })()}
                {nonCash.map((p) => {
                  const priorNAV = positionPriorNAV(p);
                  const priorPct = priorTotal > 0 ? (priorNAV / priorTotal) * 100 : 0;
                  // Use the helper so $/%/Qty mode is honored. txnAmt is the
                  // signed dollar delta to this position's NAV.
                  const dollarAmt = p.txn ? (
                    p.txn.mode === '%'
                      ? (priorNAV * (Number(p.txn.amount) || 0)) / 100
                      : p.txn.mode === 'Qty'
                        ? (Number(p.txn.amount) || 0) * (Number(p.soiPrice) || 0)
                        : Number(p.txn.amount) || 0
                  ) : 0;
                  const txnAmt = p.txn ? (p.txn.type === 'S' ? -dollarAmt : dollarAmt) : 0;
                  const newNAV = positionNewNAV(p);
                  const newPct = newTotal > 0 ? (newNAV / newTotal) * 100 : 0;
                  const sec = sectorOf(p.sectorId);
                  return (
                    <tr key={p.id} style={{ borderBottom: `1px solid ${BORDER}`, backgroundColor: p.txn ? ACCENT + '0a' : 'transparent' }}>
                      <td className="px-3 py-2">
                        {p._linked ? (
                          <>
                            <input
                              type="text"
                              value={p.positionName || ''}
                              onChange={(e) => updatePositionField(p.id, 'positionName', e.target.value)}
                              className="bg-transparent border-none outline-none w-full text-sm"
                              style={{ color: TEXT }}
                            />
                            <div className="text-[10px] flex items-center gap-1" style={{ color: TEXT_DIM }}>
                              {p.ticker || 'custom'}
                              {p.cgTokenId && (
                                <span title="Linked to CoinGecko — live prices available"
                                  style={{ color: ACCENT, fontSize: 8 }}>●</span>
                              )}
                              <button
                                onClick={() => setDraft((d) => d.map((x) => x.id === p.id ? { ...x, _linked: false } : x))}
                                className="text-[9px] underline"
                                style={{ color: TEXT_MUTE }}
                                title="Re-search this asset"
                              >change</button>
                            </div>
                          </>
                        ) : (
                          <TokenSearch
                            value={p.positionName || ''}
                            onChange={(q) => updatePositionField(p.id, 'positionName', q)}
                            onSelect={(coin) => {
                              setDraft((d) => d.map((x) => x.id === p.id ? {
                                ...x,
                                positionName: coin.name,
                                ticker: coin.symbol || x.ticker || '',
                                cgTokenId: coin.id || x.cgTokenId || null,
                                _linked: true,
                              } : x));
                            }}
                            apiKey={apiKey}
                            autoFocus={!p.positionName}
                          />
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={p.sectorId || 'unclassified'}
                          onChange={(e) => updatePositionField(p.id, 'sectorId', e.target.value)}
                          className="text-[10px] px-1.5 py-0.5 rounded outline-none"
                          style={{ backgroundColor: 'transparent', color: sec.color, border: `1px solid ${sec.color}44` }}
                        >
                          {getSectors().map((s) => (
                            <option key={s.id} value={s.id} style={{ backgroundColor: PANEL_2, color: TEXT }}>{s.label}</option>
                          ))}
                          <option value="unclassified" style={{ backgroundColor: PANEL_2, color: TEXT }}>Unclassified</option>
                        </select>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums" style={{ color: TEXT_DIM }}>{fmtCurrency(priorNAV)}</td>
                      <td className="px-3 py-2 text-right tabular-nums" style={{ color: TEXT_DIM }}>{fmtPct(priorPct, 2)}</td>
                      <td className="px-3 py-2">
                        <ChangeEditor txn={p.txn} priorNAV={priorNAV} onChange={(txn) => setTxn(p.id, txn)} />
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums" style={{ color: txnAmt > 0 ? GREEN : (txnAmt < 0 ? RED : TEXT_DIM) }}>
                        {txnAmt === 0 ? '—' : (txnAmt > 0 ? '+' : '') + fmtCurrency(txnAmt)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums" style={{ color: TEXT_DIM }}>
                        {priorTotal > 0 && txnAmt !== 0 ? fmtPct((txnAmt / priorTotal) * 100, 2) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium" style={{ color: ACCENT }}>{fmtCurrency(newNAV)}</td>
                      <td className="px-3 py-2 text-right tabular-nums" style={{ color: ACCENT }}>{fmtPct(newPct, 2)}</td>
                    </tr>
                  );
                })}
                {nonCash.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-xs" style={{ color: TEXT_DIM }}>
                      No positions yet. Click "Add asset" to start.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* Cashflow + residual footer */}
        <Panel className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] uppercase tracking-wider" style={{ color: TEXT_MUTE }}>Cashflow (+In / −Out)</label>
              <input
                type="number"
                value={cashflow}
                onChange={(e) => setCashflow(Number(e.target.value) || 0)}
                placeholder="0"
                className="w-full text-base rounded px-2 py-1.5 mt-1 tabular-nums"
                style={{ backgroundColor: PANEL_2, border: `1px solid ${BORDER}`, color: TEXT }}
              />
              <div className="text-[10px] mt-1" style={{ color: TEXT_MUTE }}>
                Net new capital entering the fund this period (positive) or distributions out (negative).
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider" style={{ color: TEXT_MUTE }}>Cash delta</label>
              <div className="text-base font-medium mt-1 tabular-nums" style={{ color: Math.abs(residual) < 1 ? GREEN : GOLD }}>
                {residual >= 0 ? '+' : ''}{fmtCurrency(residual)}
              </div>
              <div className="text-[10px] mt-0.5" style={{ color: TEXT_MUTE }}>
                {cashRow
                  ? 'Mirrors the auto-derived cash row above — every B/S/C and the cashflow input flow into it.'
                  : (Math.abs(residual) < 1
                    ? 'Cash unchanged — fully reinvested.'
                    : residual > 0
                      ? 'Net cash inflow. Save anyway — this rolls into the fund\'s cash position. Or use C tags to deploy it.'
                      : 'Net cash outflow. Save anyway — represents capital called from the cash bucket. Or use S tags to fund it.')}
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* Inline B/S/C tag selector + amount input + $/% mode toggle. Commits on every
   keystroke. `mode` controls whether `amount` is read as dollars or as a
   percentage of the position's prior NAV (priorNAV used only for the small
   live preview underneath the input). */
function ChangeEditor({ txn, priorNAV, onChange }) {
  const tag = txn?.type || '';
  const amount = txn?.amount ?? '';
  const mode = txn?.mode || '$';

  const tagColor = (t) => (t === 'S' ? RED : t === 'B' ? GREEN : ACCENT);

  const commit = (nextTag, nextAmt, nextMode) => {
    if (!nextTag && nextAmt === '') {
      onChange(null);
      return;
    }
    onChange({
      type: nextTag || 'B',
      amount: nextAmt === '' ? 0 : Number(nextAmt) || 0,
      mode: nextMode || '$',
    });
  };

  const setTag = (nextTag) => {
    if (!nextTag) { onChange(null); return; }
    commit(nextTag, amount, mode);
  };

  const setAmount = (nextAmt) => {
    if (nextAmt === '' && !tag) { onChange(null); return; }
    commit(tag, nextAmt, mode);
  };

  const setMode = (nextMode) => commit(tag, amount, nextMode);

  // Preview the dollar value when in % mode so the user can see what it works
  // out to. e.g., "S 50% → $1.5M of $3.0M".
  const dollarPreview = (() => {
    if (mode !== '%' || amount === '' || !priorNAV) return null;
    const dollars = (priorNAV * (Number(amount) || 0)) / 100;
    return dollars;
  })();

  return (
    <div className="flex items-center gap-1.5">
      {['B', 'S', 'C'].map((t) => {
        const active = tag === t;
        const c = tagColor(t);
        return (
          <button
            key={t}
            onClick={() => setTag(active ? '' : t)}
            className="text-[10px] font-bold w-6 h-6 rounded flex items-center justify-center transition-colors"
            style={{
              backgroundColor: active ? c + '33' : PANEL_2,
              color: active ? c : TEXT_MUTE,
              border: `1px solid ${active ? c : BORDER}`,
              cursor: 'pointer',
            }}
            title={t === 'B' ? 'Buy / add' : t === 'S' ? 'Sell' : 'Cashflow allocation'}
          >{t}</button>
        );
      })}
      <div className="flex items-center" style={{ border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
        <input
          type="number"
          placeholder={mode === '%' ? 'pct' : 'amount'}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="text-sm px-1.5 py-0.5 w-20 tabular-nums outline-none"
          style={{ backgroundColor: PANEL_2, border: 'none', color: TEXT }}
        />
        <button
          onClick={() => setMode(mode === '$' ? '%' : '$')}
          title={mode === '$' ? 'Switch to percentage of position' : 'Switch to dollar amount'}
          className="text-[10px] font-semibold px-1.5"
          style={{
            backgroundColor: PANEL,
            color: mode === '%' ? ACCENT : TEXT_DIM,
            borderLeft: `1px solid ${BORDER}`,
            cursor: 'pointer',
            height: '100%',
            minHeight: 22,
          }}
        >{mode === '$' ? '$' : '%'}</button>
      </div>
      {dollarPreview != null && (
        <span className="text-[10px] tabular-nums" style={{ color: TEXT_MUTE }}>
          ≈ {dollarPreview >= 0 ? '+' : ''}${Math.round(dollarPreview).toLocaleString()}
        </span>
      )}
      {(tag || amount !== '') && (
        <button
          onClick={() => onChange(null)}
          className="text-[10px] p-0.5 rounded"
          style={{ color: TEXT_MUTE }}
          title="Clear change"
        ><X size={10} /></button>
      )}
    </div>
  );
}
