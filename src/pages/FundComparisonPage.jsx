import { AlertCircle } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Panel, SectorBadge } from '../components/ui';
import { buildFundComparison } from '../lib/fundComparison';
import { fmtCurrency, fmtPct, fundLabel } from '../lib/format';
import { getSelectedSOIs } from '../lib/rollup';
import { ACCENT, ACCENT_2, BORDER, GOLD, PANEL, PANEL_2, TEXT, TEXT_DIM, TEXT_MUTE } from '../lib/theme';

/* FundComparisonPage — one holding read across every fund in scope.
   Answers the overlap question directly: which positions appear in more than
   one fund, and how much exposure each fund contributes to them. */
export function FundComparisonPage({ store, selection, asOfDate }) {
  const scopeSois = useMemo(
    () => getSelectedSOIs(store, selection),
    [store, selection],
  );
  const scopeSoiIds = useMemo(() => scopeSois.map(s => s.id), [scopeSois]);

  const [picked, setPicked] = useState(null); // null = everything in scope
  const [overlapOnly, setOverlapOnly] = useState(false);

  const activeIds = picked ?? scopeSoiIds;
  const cmp = useMemo(
    () => buildFundComparison(store, { soiIds: activeIds, asOfDate }),
    [store, activeIds, asOfDate],
  );

  const visibleRows = overlapOnly ? cmp.rows.filter(r => r.fundCount > 1) : cmp.rows;

  const toggleFund = (id) => {
    const base = picked ?? scopeSoiIds;
    setPicked(base.includes(id) ? base.filter(x => x !== id) : [...base, id]);
  };

  if (cmp.columns.length === 0) {
    return (
      <Panel className="p-12 text-center">
        <div className="text-sm" style={{ color: TEXT_DIM }}>
          No funds with holdings in this selection yet.
        </div>
        <div className="text-xs mt-1" style={{ color: TEXT_MUTE }}>
          Import a statement, or link underlying funds into a fund-of-funds, to compare holdings.
        </div>
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Panel className="p-4">
          <div className="text-[10px] uppercase tracking-wider" style={{ color: TEXT_MUTE }}>Funds compared</div>
          <div className="text-xl font-semibold mt-0.5">{cmp.columns.length}</div>
        </Panel>
        <Panel className="p-4">
          <div className="text-[10px] uppercase tracking-wider" style={{ color: TEXT_MUTE }}>Distinct holdings</div>
          <div className="text-xl font-semibold mt-0.5">{cmp.rows.length}</div>
        </Panel>
        <Panel className="p-4">
          <div className="text-[10px] uppercase tracking-wider" style={{ color: TEXT_MUTE }}>Held by 2+ funds</div>
          <div className="text-xl font-semibold mt-0.5" style={{ color: cmp.overlapCount ? GOLD : TEXT }}>
            {cmp.overlapCount}
          </div>
        </Panel>
        <Panel className="p-4">
          <div className="text-[10px] uppercase tracking-wider" style={{ color: TEXT_MUTE }}>Overlapping exposure</div>
          <div className="text-xl font-semibold mt-0.5">{fmtCurrency(cmp.overlapValue)}</div>
          <div className="text-[10px] mt-0.5" style={{ color: TEXT_DIM }}>{fmtPct(cmp.overlapPct, 1)} of total</div>
        </Panel>
      </div>

      {cmp.doubleCounted.length > 0 && (
        <Panel className="p-3 flex items-start gap-2" style={{ borderColor: GOLD + '66', backgroundColor: GOLD + '11' }}>
          <AlertCircle size={14} style={{ color: GOLD, flexShrink: 0, marginTop: 1 }} />
          <div className="text-xs" style={{ color: TEXT_DIM }}>
            {cmp.doubleCounted.map(d => (
              <div key={d.fof}>
                <span style={{ color: GOLD, fontWeight: 500 }}>{d.fof}</span> invests in {d.underlying.join(', ')} —
                also shown separately. Row and column totals count that exposure twice.
              </div>
            ))}
            <div className="mt-1" style={{ color: TEXT_MUTE }}>
              Deselect either the fund-of-funds or its underlying funds for a net figure.
            </div>
          </div>
        </Panel>
      )}

      <Panel className="p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-wider mr-1" style={{ color: TEXT_MUTE }}>Funds</span>
          {scopeSois.map(soi => {
            const on = activeIds.includes(soi.id);
            const mgr = store.managers.find(m => m.id === soi.managerId);
            return (
              <button key={soi.id} onClick={() => toggleFund(soi.id)}
                className="px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1.5"
                style={{
                  backgroundColor: on ? ACCENT + '22' : 'transparent',
                  color: on ? ACCENT_2 : TEXT_DIM,
                  border: `1px solid ${on ? ACCENT + '44' : BORDER}`,
                }}>
                {mgr?.type === 'fund_of_funds' && (
                  <span className="text-[8px] px-1 rounded" style={{ backgroundColor: ACCENT + '33', color: ACCENT_2 }}>FoF</span>
                )}
                {fundLabel(soi)}
              </button>
            );
          })}
          <div className="flex-1" />
          <button onClick={() => setOverlapOnly(v => !v)}
            className="px-2 py-1 rounded text-[11px] font-medium"
            style={{
              backgroundColor: overlapOnly ? GOLD + '22' : 'transparent',
              color: overlapOnly ? GOLD : TEXT_DIM,
              border: `1px solid ${overlapOnly ? GOLD + '44' : BORDER}`,
            }}>
            Overlap only
          </button>
        </div>
      </Panel>

      <Panel className="p-0 overflow-hidden">
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full text-xs" style={{ minWidth: 520 + cmp.columns.length * 130 }}>
            <thead>
              <tr style={{ backgroundColor: PANEL_2 }}>
                <th className="text-left px-3 py-2.5 sticky left-0"
                  style={{ color: TEXT_MUTE, backgroundColor: PANEL_2, minWidth: 190 }}>Holding</th>
                <th className="text-left px-3 py-2.5" style={{ color: TEXT_MUTE }}>Sector</th>
                <th className="text-center px-2 py-2.5" style={{ color: TEXT_MUTE }}>Funds</th>
                {cmp.columns.map(c => (
                  <th key={c.id} className="text-right px-3 py-2.5" style={{ color: TEXT_MUTE, minWidth: 130 }}>
                    <div className="flex items-center justify-end gap-1">
                      {c.isFoF && (
                        <span className="text-[8px] px-1 rounded"
                          style={{ backgroundColor: ACCENT + '22', color: ACCENT_2 }}>FoF</span>
                      )}
                      <span className="truncate">{c.label}</span>
                    </div>
                    <div className="text-[9px] font-normal truncate" style={{ color: TEXT_MUTE }}>{c.manager}</div>
                  </th>
                ))}
                <th className="text-right px-3 py-2.5" style={{ color: TEXT_MUTE }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map(r => {
                const shared = r.fundCount > 1;
                return (
                  <tr key={r.key}
                    style={{ borderTop: `1px solid ${BORDER}`, backgroundColor: shared ? GOLD + '11' : 'transparent' }}>
                    <td className="px-3 py-2 sticky left-0" style={{ backgroundColor: shared ? PANEL_2 : PANEL }}>
                      <div className="font-medium">{r.symbol || r.name}</div>
                      {r.symbol && r.name !== r.symbol && (
                        <div className="text-[10px] truncate" style={{ color: TEXT_MUTE, maxWidth: 170 }}>{r.name}</div>
                      )}
                    </td>
                    <td className="px-3 py-2"><SectorBadge sectorId={r.sectorId} /></td>
                    <td className="px-2 py-2 text-center">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                        style={{ backgroundColor: shared ? GOLD + '22' : 'transparent', color: shared ? GOLD : TEXT_MUTE }}>
                        {r.fundCount}
                      </span>
                    </td>
                    {cmp.columns.map(c => {
                      const v = r.values[c.id] || 0;
                      return (
                        <td key={c.id} className="px-3 py-2 text-right tabular-nums"
                          style={{ color: v > 0 ? TEXT : TEXT_MUTE }}>
                          {v > 0 ? (
                            <>
                              <div>{fmtCurrency(v)}</div>
                              <div className="text-[9px]" style={{ color: TEXT_MUTE }}>
                                {c.total > 0 ? fmtPct((v / c.total) * 100, 1) : '–'}
                              </div>
                            </>
                          ) : '—'}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtCurrency(r.total)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: `2px solid ${BORDER}`, backgroundColor: PANEL_2 }}>
                <td className="px-3 py-2.5 font-semibold sticky left-0" style={{ backgroundColor: PANEL_2 }}>Total</td>
                <td colSpan={2} />
                {cmp.columns.map(c => (
                  <td key={c.id} className="px-3 py-2.5 text-right tabular-nums font-semibold">{fmtCurrency(c.total)}</td>
                ))}
                <td className="px-3 py-2.5 text-right tabular-nums font-semibold">{fmtCurrency(cmp.grandTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Panel>

      <div className="text-[10px] leading-relaxed" style={{ color: TEXT_MUTE }}>
        Fund-of-funds columns are looked through to their underlying funds and scaled by the FoF&apos;s
        ownership of each (called capital ÷ underlying NAV), so they are comparable to direct funds.
        Highlighted rows are held by more than one fund — that overlap is your true concentration.
      </div>
    </div>
  );
}
