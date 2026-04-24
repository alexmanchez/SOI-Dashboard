import React, { useMemo, useEffect } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  ReferenceLine, ReferenceArea,
} from 'recharts';
import { RefreshCw, AlertCircle } from 'lucide-react';

import {
  PANEL, PANEL_2, BORDER, TEXT, TEXT_DIM, TEXT_MUTE,
  ACCENT, GREEN, RED, GOLD,
} from '../lib/theme';
import { fmtCurrency, fmtPctSigned } from '../lib/format';
import { RANGES, rangeToStartMs, rangeToDays } from '../lib/ranges';
import { snapshotsOf, isLiquid } from '../lib/snapshots';
import { buildNAVSeries } from '../lib/rollup';

import { Panel, Pill } from './ui';

export function PerformanceChart({ soiBundles, scaleFn, priceHistory, historyLoading, historyProgress, range, onRangeChange, onRequestFetch, apiKey, height=260, compact=false, title }) {
  const tokenIds = useMemo(() => {
    const ids = new Set();
    for (const b of soiBundles) for (const snap of snapshotsOf(b)) for (const p of (snap.positions||[])) if (isLiquid(p)&&p.cgTokenId) ids.add(p.cgTokenId);
    return [...ids];
  }, [soiBundles]);

  const allPositions = useMemo(() => soiBundles.flatMap(b => snapshotsOf(b).flatMap(s => s.positions||[])), [soiBundles]);
  const daysNeeded = useMemo(() => Math.min(rangeToDays(range, allPositions), 365), [range, allPositions]);

  // Trigger fetch if we're missing data
  useEffect(() => {
    if (!apiKey || !tokenIds.length) return;
    onRequestFetch?.(tokenIds, daysNeeded);
  }, [tokenIds.join(','), daysNeeded, apiKey]);

  // Build series
  const { series, earliestSnapshotMs, latestSnapshotMs, snapshotDates } = useMemo(() => {
    if (!soiBundles.length) return { series:[], earliestSnapshotMs:null, latestSnapshotMs:null, snapshotDates:[] };
    const startMs = rangeToStartMs(range, allPositions);
    return buildNAVSeries(soiBundles, priceHistory, startMs, Date.now(), scaleFn);
  }, [soiBundles, priceHistory, range, allPositions, scaleFn]);

  // Derive asOfMs from latestSnapshotMs for badge display
  const asOfMs = latestSnapshotMs;

  const startValue = series[0]?.value ?? 0;
  const endValue = series[series.length - 1]?.value ?? 0;
  const returnPct = startValue > 0 ? ((endValue - startValue) / startValue) * 100 : 0;
  const positive = returnPct >= 0;
  const lineColor = positive ? GREEN : RED;

  const tokensCovered = tokenIds.filter(id => priceHistory[id]).length;
  const needsData = apiKey && tokenIds.length > 0 && tokensCovered < tokenIds.length;

  const yMin = useMemo(() => {
    const vals = series.map(s => s.value).filter(v => v > 0);
    if (!vals.length) return 0;
    const min = Math.min(...vals), max = Math.max(...vals);
    return Math.max(0, min - (max - min) * 0.1);
  }, [series]);
  const yMax = useMemo(() => {
    const vals = series.map(s => s.value).filter(v => v > 0);
    if (!vals.length) return 1;
    const min = Math.min(...vals), max = Math.max(...vals);
    return max + (max - min) * 0.1;
  }, [series]);

  return (
    <Panel className={compact ? 'p-3' : 'p-5'}>
      {!compact && (
        <div className="flex items-start justify-between mb-3">
          <div>
            {title && <div className="text-xs uppercase tracking-wider" style={{color:TEXT_MUTE}}>{title}</div>}
            <div className="flex items-baseline gap-3 mt-0.5">
              <div className="text-xl font-semibold">{fmtCurrency(endValue)}</div>
              <div className="text-sm font-medium" style={{color: positive ? GREEN : RED}}>
                {positive ? '▲' : '▼'} {fmtPctSigned(returnPct, 2)}
                <span className="ml-1" style={{color:TEXT_DIM}}>{range}</span>
              </div>
              {asOfMs && (
                <div className="text-[10px] px-2 py-0.5 rounded" style={{color: GOLD, backgroundColor: GOLD+'11', border: `1px solid ${GOLD}44`}}>
                  As of {new Date(asOfMs).toLocaleDateString([], {year:'numeric', month:'short', day:'numeric'})}
                </div>
              )}
            </div>
          </div>
          {onRangeChange && (
            <div className="flex items-center gap-1">
              {RANGES.map(r => (
                <Pill key={r.id} active={range===r.id} onClick={()=>onRangeChange(r.id)}>{r.label}</Pill>
              ))}
            </div>
          )}
        </div>
      )}
      {!compact && snapshotDates && snapshotDates.length > 1 && (
        <div className="flex items-center gap-4 mb-2" style={{fontSize:10, color:TEXT_MUTE}}>
          <span>◼ <span style={{color:TEXT_DIM}}>Realized</span> (between snapshots)</span>
          <span>◻ Simulated (before / after holdings date)</span>
          <span style={{color:GOLD}}>━━</span><span>Snapshot date</span>
        </div>
      )}

      {!apiKey && (
        <div className="flex items-center justify-center text-xs p-6 rounded"
          style={{backgroundColor: PANEL_2, color: TEXT_DIM, border: `1px dashed ${BORDER}`, height}}>
          No CoinGecko API key configured. Set VITE_COINGECKO_API_KEY at build time, or paste an override in Settings.
        </div>
      )}

      {apiKey && historyLoading && (
        <div className="flex flex-col items-center justify-center text-xs rounded gap-2"
          style={{backgroundColor: PANEL_2, color: TEXT_DIM, border: `1px dashed ${BORDER}`, height}}>
          <RefreshCw size={16} className="animate-spin" style={{color:ACCENT}} />
          <div>Fetching history {historyProgress.current}/{historyProgress.total} — {historyProgress.token}</div>
          <div className="w-40 h-1 rounded-full overflow-hidden" style={{backgroundColor: BORDER}}>
            <div className="h-full" style={{width: `${(historyProgress.current/Math.max(1,historyProgress.total))*100}%`, backgroundColor: ACCENT}} />
          </div>
          <div className="text-[10px]" style={{color:TEXT_MUTE}}>~2s per token on Demo tier</div>
        </div>
      )}

      {apiKey && !historyLoading && needsData && (
        <div className="flex items-center justify-center text-xs p-6 rounded"
          style={{backgroundColor: PANEL_2, color: TEXT_DIM, border: `1px dashed ${BORDER}`, height}}>
          History not yet loaded for this range. Click "Refresh prices" to fetch.
        </div>
      )}

      {apiKey && !historyLoading && !needsData && series.length > 0 && (
        <div style={{width:'100%', height}}>
          <ResponsiveContainer>
            <AreaChart data={series} margin={{top: 8, right: 8, left: 0, bottom: 0}}>
              <defs>
                <linearGradient id={`grad-${positive?'up':'down'}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={lineColor} stopOpacity={0.35}/>
                  <stop offset="100%" stopColor={lineColor} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{fontSize: 10, fill: TEXT_MUTE}} axisLine={false} tickLine={false}
                tickFormatter={(ms) => {
                  const d = new Date(ms);
                  if (range === '1D') return d.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
                  if (range === 'MTD' || range === 'YTD') return d.toLocaleDateString([], {month: 'short', day: 'numeric'});
                  return d.toLocaleDateString([], {month: 'short', year: '2-digit'});
                }}
                minTickGap={60} />
              <YAxis domain={[yMin, yMax]} tick={{fontSize: 10, fill: TEXT_MUTE}} axisLine={false} tickLine={false}
                tickFormatter={(v) => fmtCurrency(v, 0)} width={60} />
              <Tooltip
                contentStyle={{backgroundColor: PANEL_2, border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 12}}
                labelStyle={{color: TEXT_DIM}}
                itemStyle={{color: TEXT}}
                labelFormatter={(ms) => new Date(ms).toLocaleDateString([], {year:'numeric', month: 'short', day: 'numeric'})}
                formatter={(v) => [fmtCurrency(v), 'NAV']} />
              <Area type="monotone" dataKey="value" stroke={lineColor} strokeWidth={1.5}
                fill={`url(#grad-${positive?'up':'down'})`} />
              {/* Backward-simulated (before earliest snapshot) */}
              {earliestSnapshotMs && series.length > 0 && earliestSnapshotMs > series[0].date && (
                <ReferenceArea
                  x1={series[0].date}
                  x2={Math.min(earliestSnapshotMs, series[series.length-1].date)}
                  fill={TEXT_MUTE} fillOpacity={0.12} stroke="none" />
              )}
              {/* Forward-simulated (after latest snapshot) */}
              {latestSnapshotMs && series.length > 0 && latestSnapshotMs < series[series.length-1].date && (
                <ReferenceArea
                  x1={Math.max(latestSnapshotMs, series[0].date)}
                  x2={series[series.length-1].date}
                  fill={GOLD} fillOpacity={0.08} stroke="none" />
              )}
              {/* Snapshot date markers */}
              {(snapshotDates||[]).filter(ms => series.length > 0 && ms >= series[0].date && ms <= series[series.length-1].date).map((ms,i) => (
                <ReferenceLine key={i} x={ms} stroke={GOLD} strokeWidth={1} strokeDasharray="3 3"
                  label={{ value: new Date(ms).toLocaleDateString([],{month:'short',year:'2-digit'}), position:'top', fill:GOLD, fontSize:9 }} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {apiKey && !historyLoading && !series.length && (
        <div className="flex items-center justify-center text-xs p-6 rounded"
          style={{backgroundColor: PANEL_2, color: TEXT_DIM, border: `1px dashed ${BORDER}`, height}}>
          No data in this range.
        </div>
      )}
    </Panel>
  );
}

