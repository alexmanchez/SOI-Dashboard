import React from 'react';
import _ from 'lodash';
import { Briefcase, ChevronRight, TrendingUp } from 'lucide-react';

import {
  PANEL, PANEL_2, BORDER, TEXT, TEXT_DIM, TEXT_MUTE,
  ACCENT, ACCENT_2, GREEN, RED, VIOLET,
} from '../lib/theme';
import { fmtCurrency, fmtPct, fmtPctSigned, fmtMoic, fundLabel } from '../lib/format';
import { sectorOf, resolveSector } from '../lib/sectors';
import { RANGES, rangeToStartMs } from '../lib/ranges';
import { snapshotsOf, latestSnapshot, isLiquid } from '../lib/snapshots';
import { buildNAVSeries, buildNAVSeriesSimple } from '../lib/rollup';
import { Panel } from '../components/ui';
import { MiniSparkline } from '../components/MiniSparkline';

export function ManagersTab({ rollup, store, onDrill, priceHistory, range, apiKey, clientShareMode, scaleBy }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {rollup.managerBreakdown.map(m => {
        const soi = store.soIs.find(s => s.id === m.soiId);
        const mgr = store.managers.find(mg => mg.id === m.managerId);
        const positions = (latestSnapshot(soi)?.positions || []).map(p => {
          const sectorId = resolveSector(p, store.sectorOverrides);
          const liquid = isLiquid(p);
          return { ...p, sectorId, liquid };
        });
        // Per-SOI sparkline
        const startMs = rangeToStartMs(range, positions);
        const series = apiKey && Object.keys(priceHistory).length > 0
          ? buildNAVSeriesSimple(positions, priceHistory, startMs, Date.now())
          : [];
        const startVal = series[0]?.value ?? 0;
        const endVal = series[series.length-1]?.value ?? 0;
        const retPct = startVal > 0 ? ((endVal - startVal) / startVal) * 100 : null;

        const bySector = _.groupBy(positions, 'sectorId');
        const sectorTop = Object.entries(bySector).map(([sid, items]) => {
          const val = _.sumBy(items, p => p.soiMarketValue || 0);
          return { id: sid, label: sectorOf(sid).label, color: sectorOf(sid).color, value: val };
        }).sort((a,b) => b.value - a.value).slice(0, 5);

        // Compute share % for client share mode display
        const sharePct = m._scale != null ? m._scale * 100 : null;

        return (
          <Panel key={m.soiId} className="p-5 hover:cursor-pointer transition-colors"
            style={{ borderColor: BORDER }}
            onClick={() => onDrill(m.soiId)}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="text-base font-semibold flex items-center gap-2">
                  {m.managerName}
                  {mgr?.type === 'fund_of_funds' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                      style={{backgroundColor: VIOLET+'22', color: VIOLET, border: `1px solid ${VIOLET}44`}}>FoF</span>
                  )}
                </div>
                <div className="text-xs" style={{color:TEXT_DIM}}>{m.vintage} • As of {m.asOfDate || '—'}</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold tabular-nums">{fmtCurrency(m.value)}</div>
                {clientShareMode && sharePct != null && (
                  <div className="text-[11px]" style={{color:TEXT_DIM}}>
                    {fmtPct(sharePct, 1)} share of fund
                  </div>
                )}
                <div className="text-xs" style={{color:TEXT_DIM}}>{fmtPct(m.pct, 1)} of book</div>
                {(() => {
                  const called = _.sumBy(store.commitments.filter(c => c.soiId === m.soiId), c => c.called || 0);
                  const moic = called > 0 ? m.value / called : null;
                  return <div className="text-xs mt-0.5 tabular-nums" style={{color:TEXT_DIM}}>MOIC {fmtMoic(moic)}</div>;
                })()}
              </div>
            </div>
            {series.length > 1 && (
              <div className="mt-3 flex items-center gap-3">
                <MiniSparkline series={series} width={140} height={34} />
                {retPct !== null && (
                  <div className="text-xs font-medium" style={{color: retPct >= 0 ? GREEN : RED}}>
                    {fmtPctSigned(retPct, 2)} <span style={{color:TEXT_MUTE}}>{range}</span>
                  </div>
                )}
              </div>
            )}
            <div className="mt-4 flex items-center gap-2 text-xs" style={{color:TEXT_DIM}}>
              <span>{m.positionCount} positions</span>
              <span style={{color:TEXT_MUTE}}>•</span>
              <span>Tap to drill in <ChevronRight size={12} className="inline" /></span>
            </div>
            <div className="mt-4">
              <div className="text-[10px] uppercase tracking-wider mb-1.5" style={{color:TEXT_MUTE}}>Sector tilt</div>
              <div className="flex h-2 rounded-full overflow-hidden" style={{backgroundColor: PANEL_2}}>
                {sectorTop.map(s => (
                  <div key={s.id} style={{ width: `${(s.value/m.value)*100}%`, backgroundColor: s.color }} title={s.label} />
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {sectorTop.slice(0, 3).map(s => (
                  <span key={s.id} className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: s.color+'22', color: s.color, border: `1px solid ${s.color}44` }}>
                    {s.label} {fmtPct((s.value/m.value)*100, 0)}
                  </span>
                ))}
              </div>
            </div>
          </Panel>
        );
      })}
    </div>
  );
}

