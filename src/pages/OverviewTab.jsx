import React from 'react';
import _ from 'lodash';

import {
  PANEL, PANEL_2, BORDER, TEXT, TEXT_DIM, TEXT_MUTE,
  ACCENT, GREEN, RED,
} from '../lib/theme';
import { fmtCurrency, fmtPct, fmtMoic } from '../lib/format';
import { latestSnapshot, isLiquid } from '../lib/snapshots';
import { Panel, KPI } from '../components/ui';
import { PerformanceChart } from '../components/PerformanceChart';
import {
  CompactSectorTilt, CompactManagerBreakdown,
  TopHoldingsPanel, TopMoversPanel,
} from '../components/DashboardPanels';

export function OverviewTab({ rollup, store, selection, priceHistory, historyLoading, historyProgress, range, onRangeChange, onRequestFetch, apiKey, clientShareMode, scaleBy }) {
  // Latest snapshot date across the current selection — used as the "as of"
  // label on panels so an OCIO can see at a glance when the underlying holdings
  // data was last refreshed.
  const dataAsOf = useMemo(() => {
    const dates = (rollup.managerBreakdown || [])
      .map(m => m.asOfDate)
      .filter(Boolean)
      .sort();
    if (!dates.length) return null;
    const latest = dates[dates.length - 1];
    // Format to "Sep 30, 2025" style for display.
    const d = new Date(latest + 'T00:00:00Z');
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  }, [rollup.managerBreakdown]);

  const clientEconomics = useMemo(() => {
    if (selection?.kind !== 'client') return null;
    const commits = store.commitments.filter(c => c.clientId === selection.id);
    const totalCommitted = _.sumBy(commits, c => c.committed || 0);
    const totalCalled = _.sumBy(commits, c => c.called || 0);
    const pctInvested = totalCommitted > 0 ? (totalCalled / totalCommitted) * 100 : null;
    const pooledMoic = totalCalled > 0 ? rollup.totalNAV / totalCalled : null;
    return { totalCommitted, totalCalled, pctInvested, pooledMoic };
  }, [selection, store.commitments, rollup.totalNAV]);

  // Build scaleFn for chart (mirrors scaleBy but using the bundle object)
  const chartScaleFn = (clientShareMode && selection?.kind === 'client' && scaleBy) ? scaleBy : null;

  return (
    <div className="space-y-6">
      {/* PERFORMANCE CHART */}
      <PerformanceChart
        soiBundles={rollup.soIs}
        scaleFn={chartScaleFn}
        priceHistory={priceHistory}
        historyLoading={historyLoading}
        historyProgress={historyProgress}
        range={range}
        onRangeChange={onRangeChange}
        onRequestFetch={onRequestFetch}
        apiKey={apiKey}
        title="Portfolio performance"
        height={280}
      />

      {/* KPI ROW */}
      {rollup.fofLookThroughCount > 0 && (
        <div className="text-xs px-3 py-1.5 rounded flex items-center gap-2"
          style={{backgroundColor: VIOLET+'11', color: VIOLET, border: `1px solid ${VIOLET}33`}}>
          <TrendingUp size={12} />
          Look-through from {rollup.fofLookThroughCount} fund-of-fund{rollup.fofLookThroughCount===1?'':'s'} applied — positions reflect underlying exposure
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Total Exposure" value={fmtCurrency(rollup.totalNAV)}
             sub={`${rollup.positionCount} positions in ${rollup.soiCount} fund${rollup.soiCount===1?'':'s'}`} />
        <KPI label="Managers" value={rollup.managerCount}
             sub={`${rollup.soiCount} vintage${rollup.soiCount===1?'':'s'}`} />
        <KPI label="Liquid / Illiquid" value={fmtPct(rollup.liquidPct, 1)}
             sub={`${fmtCurrency(rollup.liquidNAV)} liquid • ${fmtCurrency(rollup.illiquidNAV)} illiquid`} />
        <KPI label="Top-10 concentration" value={fmtPct(rollup.top10, 1)}
             sub={`Top-25: ${fmtPct(rollup.top25, 1)}`} />
      </div>

      {/* Compact exposure + top-holdings + top-movers row — the main at-a-glance view. */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <CompactSectorTilt breakdown={rollup.sectorBreakdown} />
        <CompactManagerBreakdown managerBreakdown={rollup.managerBreakdown} />
        <TopHoldingsPanel tokenRollup={rollup.tokenRollup} asOf={dataAsOf} />
        <TopMoversPanel rollup={rollup} priceHistory={priceHistory} />
      </div>

      {/* Legacy grid — the Dashboard intentionally omits the large panels now;
          they live on the Exposures page. */}
      <div style={{ display: 'none' }}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel className="p-5 lg:col-span-2">
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <div className="text-xs uppercase tracking-wider" style={{color:TEXT_MUTE}}>Sector tilt (GICS-style)</div>
              <div className="text-base font-semibold mt-0.5">Exposure by bucket</div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={rollup.sectorBreakdown.filter(s => s.value > 0)}
                    dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={90} innerRadius={55}
                    strokeWidth={0}>
                    {rollup.sectorBreakdown.filter(s => s.value > 0).map((s, i) => (
                      <Cell key={i} fill={s.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: PANEL_2, border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 12 }}
                    labelStyle={{ color: TEXT }}
                    itemStyle={{ color: TEXT }}
                    formatter={(v) => fmtCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {rollup.sectorBreakdown.map(s => (
                <div key={s.id} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: s.color }} />
                  <div className="flex-1">
                    <div className="text-sm">{s.label}</div>
                    <div className="h-1.5 rounded-full mt-1 overflow-hidden" style={{ backgroundColor: PANEL_2 }}>
                      <div className="h-full" style={{ width: `${s.pct}%`, backgroundColor: s.color }} />
                    </div>
                  </div>
                  <div className="text-right" style={{ minWidth: 100 }}>
                    <div className="text-sm tabular-nums">{fmtCurrency(s.value)}</div>
                    <div className="text-[10px] tabular-nums" style={{ color: TEXT_DIM }}>{fmtPct(s.pct,1)} • {s.count} pos</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel className="p-5">
          <div className="text-xs uppercase tracking-wider mb-1" style={{color:TEXT_MUTE}}>Manager breakdown</div>
          <div className="text-base font-semibold mb-4">Exposure by vintage</div>
          <div className="space-y-3">
            {rollup.managerBreakdown.map(m => (
              <div key={m.soiId}>
                <div className="flex items-baseline justify-between text-sm">
                  <div>
                    <span className="font-medium">{m.managerName}</span>
                    <span className="text-xs ml-1.5" style={{color:TEXT_DIM}}>{m.vintage}</span>
                  </div>
                  <div className="tabular-nums">{fmtCurrency(m.value)}</div>
                </div>
                <div className="h-1.5 rounded-full mt-1 overflow-hidden" style={{ backgroundColor: PANEL_2 }}>
                  <div className="h-full" style={{ width: `${m.pct}%`, backgroundColor: ACCENT }} />
                </div>
                <div className="text-[10px] mt-0.5 tabular-nums" style={{color:TEXT_MUTE}}>{fmtPct(m.pct,1)} • {m.positionCount} positions</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      </div>

      {/* TOP TOKENS (hidden on Dashboard — kept only for legacy tooling) */}
      <Panel className="p-5" style={{ display: 'none' }}>
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <div className="text-xs uppercase tracking-wider" style={{color:TEXT_MUTE}}>Top-10 holdings (rolled up)</div>
            <div className="text-base font-semibold mt-0.5">Aggregate token exposure across managers</div>
          </div>
          {rollup.positions.some(p => p.hasLivePrice) && (
            <div className="text-xs" style={{ color: TEXT_DIM }}>
              <span style={{ color: GREEN }}>●</span> Live prices applied
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: TEXT_MUTE, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th className="text-left py-2 pr-3">Token</th>
                <th className="text-left py-2 pr-3">Sector</th>
                <th className="text-right py-2 pr-3">24h</th>
                <th className="text-right py-2 pr-3">Value</th>
                <th className="text-right py-2 pr-3">% of book</th>
                <th className="text-right py-2 pr-3">In funds</th>
                <th className="text-right py-2">Liquidity</th>
              </tr>
            </thead>
            <tbody>
              {rollup.tokenRollup.slice(0, 10).map(t => (
                <tr key={t.key} style={{ borderTop: `1px solid ${BORDER}` }}>
                  <td className="py-2.5 pr-3">
                    <div className="font-medium">{t.symbol || t.name}</div>
                    {t.symbol && t.name !== t.symbol && <div className="text-[10px]" style={{color:TEXT_MUTE}}>{t.name}</div>}
                  </td>
                  <td className="py-2.5 pr-3"><SectorBadge sectorId={t.sectorId} /></td>
                  <td className="py-2.5 pr-3 text-right tabular-nums"><ChangeCell value={t.change24h} /></td>
                  <td className="py-2.5 pr-3 text-right tabular-nums font-medium">{fmtCurrency(t.value)}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{fmtPct(t.pct, 2)}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums" style={{color: TEXT_DIM}}>{t.managerCount}</td>
                  <td className="py-2.5 text-right"><LiquidityBadge liquid={t.liquid} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

