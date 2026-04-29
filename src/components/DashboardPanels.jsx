import {
  useContext, useMemo, useState,
} from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
} from 'recharts';

import {
  PANEL_2, BORDER, TEXT, TEXT_DIM, TEXT_MUTE, ACCENT, ACCENT_2, GREEN, RED, GOLD, VIOLET,
} from '../lib/theme';
import { fmtCurrency, fmtPct, fmtPctSigned } from '../lib/format';
import { MOVER_RANGES, rangeToStartMs } from '../lib/ranges';
import { OpenTokenDetailContext } from '../contexts';
import {
  Panel, SectorBadge, LiquidityBadge, ChangeCell,
} from './ui';
import { TokenIcon } from './TokenIcon';

export const CompactSectorTilt = ({ breakdown }) => (
  <Panel className="p-4">
    <div className="flex items-baseline justify-between mb-3">
      <div>
        <div className="text-[10px] uppercase tracking-wider" style={{color:TEXT_MUTE}}>Sector allocation</div>
        <div className="text-sm font-semibold mt-0.5">Exposure by sector</div>
      </div>
    </div>
    <div className="space-y-2">
      {breakdown.length === 0 && (
        <div className="text-xs" style={{color: TEXT_DIM}}>No positions yet.</div>
      )}
      {breakdown.map(s => (
        <div key={s.id} className="flex items-center gap-2">
          <div style={{width: 8, height: 8, borderRadius: 2, backgroundColor: s.color, flexShrink: 0}} />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between text-xs">
              <span className="truncate">{s.label}</span>
              <span className="tabular-nums ml-2" style={{color: TEXT_DIM}}>{fmtPct(s.pct, 1)}</span>
            </div>
            <div className="h-1 rounded-full mt-0.5 overflow-hidden" style={{backgroundColor: PANEL_2}}>
              <div className="h-full" style={{width: `${s.pct}%`, backgroundColor: s.color}} />
            </div>
          </div>
        </div>
      ))}
    </div>
  </Panel>
);

/* Compact manager breakdown — one row per SOI with value + pct bar. */


export const CompactManagerBreakdown = ({ managerBreakdown, groupLabel = 'Manager allocation', subtitle = 'Exposure by fund', showModeToggle = false }) => {
  const [mode, setMode] = useState('fund'); // 'fund' | 'firm'
  const items = useMemo(() => {
    if (mode === 'firm') {
      // Aggregate fund rows into firm rows (sum across vintages per manager).
      const byFirm = {};
      for (const m of (managerBreakdown || [])) {
        const k = m.managerId || m.managerName;
        if (!byFirm[k]) byFirm[k] = { soiId: k, managerId: m.managerId, managerName: m.managerName, vintage: '', value: 0, pct: 0, positionCount: 0 };
        byFirm[k].value += m.value || 0;
        byFirm[k].pct += m.pct || 0;
        byFirm[k].positionCount += m.positionCount || 0;
      }
      return Object.values(byFirm).sort((a, b) => b.value - a.value);
    }
    return managerBreakdown || [];
  }, [managerBreakdown, mode]);

  return (
  <Panel className="p-4">
    <div className="flex items-baseline justify-between mb-3 gap-2">
      <div>
        <div className="text-[10px] uppercase tracking-wider" style={{color:TEXT_MUTE}}>{groupLabel}</div>
        <div className="text-sm font-semibold mt-0.5">{mode === 'firm' ? 'Exposure by firm' : subtitle}</div>
      </div>
      {showModeToggle && (
        <label className="flex items-center gap-1 text-[10px] uppercase tracking-wider flex-shrink-0" style={{color: TEXT_MUTE}}>
          Group:
          <select value={mode} onChange={(e) => setMode(e.target.value)}
            className="text-xs rounded px-1.5 py-0.5 outline-none normal-case tracking-normal"
            style={{backgroundColor: PANEL_2, border: `1px solid ${BORDER}`, color: TEXT, colorScheme: 'dark'}}>
            <option value="fund">By fund</option>
            <option value="firm">By firm</option>
          </select>
        </label>
      )}
    </div>
    <div className="space-y-2">
      {items.length === 0 && (
        <div className="text-xs" style={{color: TEXT_DIM}}>No managers in selection.</div>
      )}
      {items.map(m => (
        <div key={m.soiId}>
          <div className="flex items-baseline justify-between text-xs">
            <div className="min-w-0 truncate">
              <span className="font-medium">{m.managerName}</span>
              {m.vintage && <span className="ml-1.5" style={{color: TEXT_DIM}}>{m.vintage}</span>}
            </div>
            <div className="tabular-nums ml-2">{fmtCurrency(m.value)}</div>
          </div>
          <div className="h-1 rounded-full mt-0.5 overflow-hidden" style={{backgroundColor: PANEL_2}}>
            <div className="h-full" style={{width: `${m.pct}%`, backgroundColor: ACCENT}} />
          </div>
          <div className="text-[10px] tabular-nums mt-0.5" style={{color: TEXT_MUTE}}>{fmtPct(m.pct, 1)} · {m.positionCount} positions</div>
        </div>
      ))}
    </div>
  </Panel>
  );
};

/* Largest liquid holdings. Right column stacks % of book on top, dollar
   value underneath. Count is user-toggleable (5 / 10) when there's enough
   data; otherwise the panel just shows whatever there is. */


export const TopHoldingsPanel = ({ tokenRollup, asOf }) => {
  const openDetail = useContext(OpenTokenDetailContext);
  const allLiquid = (tokenRollup || []).filter(t => t.liquid);
  const showToggle = allLiquid.length > 5;
  const [count, setCount] = useState(5);
  const effectiveCount = Math.min(count, allLiquid.length);
  const liquidOnly = allLiquid.slice(0, effectiveCount);
  return (
    <Panel className="p-4">
      <div className="flex items-start justify-between mb-3 gap-2 flex-wrap">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider" style={{color:TEXT_MUTE}}>
            {allLiquid.length <= 5 ? 'Liquid holdings' : 'Largest liquid holdings'}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {showToggle && (
            <label className="flex items-center gap-1 text-[10px] uppercase tracking-wider" style={{color: TEXT_MUTE}}>
              Top:
              <select value={count} onChange={(e) => setCount(Number(e.target.value))}
                className="text-xs rounded px-1.5 py-0.5 outline-none normal-case tracking-normal"
                style={{backgroundColor: PANEL_2, border: `1px solid ${BORDER}`, color: TEXT, colorScheme: 'dark'}}>
                <option value={5}>Top 5</option>
                <option value={10}>Top {Math.min(10, allLiquid.length)}</option>
              </select>
            </label>
          )}
          {asOf && (
            <div className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0"
              style={{color: GOLD, backgroundColor: GOLD+'11', border: `1px solid ${GOLD}44`}}>
              As of {asOf}
            </div>
          )}
        </div>
      </div>
      <div className="space-y-1.5">
        {liquidOnly.length === 0 && (
          <div className="text-xs" style={{color: TEXT_DIM}}>No liquid tokens yet.</div>
        )}
        {liquidOnly.map((t, i) => (
          <button key={t.key} onClick={() => t.cgTokenId && openDetail({ cgTokenId: t.cgTokenId, symbol: t.symbol, name: t.name })}
            disabled={!t.cgTokenId}
            className="w-full flex items-center gap-2 py-1 px-1 rounded hover:bg-white/5 transition-colors text-left disabled:cursor-default disabled:hover:bg-transparent">
            <div className="text-[10px] tabular-nums w-4 text-right" style={{color: TEXT_MUTE}}>{i+1}</div>
            <TokenIcon ticker={t.symbol} name={t.name} size={22} />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate flex items-center gap-1">
                <span className="truncate">{t.symbol || t.name}</span>
                {t.throughFoF && (
                  <span className="text-[9px] px-1 rounded font-medium flex-shrink-0"
                    style={{ backgroundColor: VIOLET + '22', color: VIOLET, border: `1px solid ${VIOLET}44` }}>FoF</span>
                )}
              </div>
              {t.symbol && t.name !== t.symbol && <div className="text-[10px] truncate" style={{color: TEXT_MUTE}}>{t.name}</div>}
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-xs tabular-nums font-semibold">{fmtPct(t.pct, 1)}</div>
              <div className="text-[10px] tabular-nums" style={{color: TEXT_DIM}}>{fmtCurrency(t.value)}</div>
            </div>
          </button>
        ))}
      </div>
    </Panel>
  );
};

/* Top N movers (by absolute % change over selected range). Uses
   live prices for 1D, priceHistory for other ranges. */


export const TopMoversPanel = ({ rollup, priceHistory }) => {
  const openDetail = useContext(OpenTokenDetailContext);
  const [range, setRange] = useState('1D');
  const [count, setCount] = useState(5);
  const movers = useMemo(() => {
    const items = [];
    if (range === '1D') {
      // 1D: use the change24h that computeRollup already baked onto each position.
      for (const p of rollup.positions || []) {
        if (!p.hasLivePrice || p.change24h == null) continue;
        items.push({
          key: p.id || `${p.cgTokenId}-${p.soiId || ''}`,
          cgTokenId: p.cgTokenId,
          symbol: p.ticker || p.positionName,
          name: p.positionName,
          change: p.change24h,
          value: p.currentValue || p.soiMarketValue,
        });
      }
    } else {
      // MTD/YTD/1Y/SI: compute from priceHistory
      const startMs = rangeToStartMs(range, rollup.positions || []);
      for (const p of rollup.positions || []) {
        if (!p.cgTokenId) continue;
        const hist = priceHistory[p.cgTokenId];
        if (!hist) continue;
        const days = Object.keys(hist).map(Number).sort((a,b)=>a-b);
        if (!days.length) continue;
        const startDay = days.find(d => d >= startMs) ?? days[0];
        const endDay = days[days.length - 1];
        const startPrice = hist[startDay];
        const endPrice = hist[endDay];
        if (!startPrice || !endPrice) continue;
        const change = ((endPrice - startPrice) / startPrice) * 100;
        items.push({
          key: p.id || `${p.cgTokenId}-${p.soiId || ''}`,
          cgTokenId: p.cgTokenId,
          symbol: p.ticker || p.positionName,
          name: p.positionName,
          change,
          value: p.currentValue || p.soiMarketValue,
        });
      }
    }
    // Dedup by symbol (one row per token, use largest absolute move)
    const bySymbol = {};
    for (const item of items) {
      const key = item.symbol;
      if (!bySymbol[key] || Math.abs(item.change) > Math.abs(bySymbol[key].change)) bySymbol[key] = item;
    }
    return Object.values(bySymbol)
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
      .slice(0, count);
  }, [rollup.positions, priceHistory, range, count]);

  return (
    <Panel className="p-4">
      <div className="mb-3">
        <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider" style={{color:TEXT_MUTE}}>Largest price moves</div>
            <div className="text-sm font-semibold mt-0.5">Biggest winners and losers</div>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <label className="flex items-center gap-1 text-[10px] uppercase tracking-wider" style={{color: TEXT_MUTE}}>
              Timeframe:
              <select value={range} onChange={(e) => setRange(e.target.value)}
                className="text-xs rounded px-1.5 py-0.5 outline-none normal-case tracking-normal"
                style={{backgroundColor: PANEL_2, border: `1px solid ${BORDER}`, color: TEXT, colorScheme: 'dark'}}>
                {MOVER_RANGES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-1 text-[10px] uppercase tracking-wider" style={{color: TEXT_MUTE}}>
              Top:
              <select value={count} onChange={(e) => setCount(Number(e.target.value))}
                className="text-xs rounded px-1.5 py-0.5 outline-none normal-case tracking-normal"
                style={{backgroundColor: PANEL_2, border: `1px solid ${BORDER}`, color: TEXT, colorScheme: 'dark'}}>
                <option value={5}>Top 5</option>
                <option value={10}>Top 10</option>
              </select>
            </label>
          </div>
        </div>
      </div>
      {movers.length === 0 ? (
        <div className="text-xs p-3 rounded" style={{backgroundColor: PANEL_2, color: TEXT_MUTE, border: `1px dashed ${BORDER}`}}>
          No mover data — enable Live prices and Refresh to populate this panel.
        </div>
      ) : (
        <div className="space-y-1.5">
          {movers.map((m, i) => {
            const positive = m.change >= 0;
            return (
              <button key={m.key} onClick={() => m.cgTokenId && openDetail({ cgTokenId: m.cgTokenId, symbol: m.symbol, name: m.name })}
                disabled={!m.cgTokenId}
                className="w-full flex items-center gap-2 py-1 px-1 rounded hover:bg-white/5 transition-colors text-left disabled:cursor-default disabled:hover:bg-transparent">
                <div className="text-[10px] tabular-nums w-5 text-right" style={{color: TEXT_MUTE}}>{i+1}</div>
                <TokenIcon ticker={m.symbol} name={m.name} size={20} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{m.symbol}</div>
                  {m.name && m.name !== m.symbol && <div className="text-[10px] truncate" style={{color: TEXT_MUTE}}>{m.name}</div>}
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xs tabular-nums font-medium" style={{color: positive ? GREEN : RED}}>
                    {positive ? '▲' : '▼'} {fmtPctSigned(m.change, 2)}
                  </div>
                  {m.value != null && <div className="text-[10px] tabular-nums" style={{color: TEXT_DIM}}>{fmtCurrency(m.value)}</div>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Panel>
  );
};

/* Full sector-tilt panel (with pie chart). Used on Exposures page. */


export const FullSectorTiltPanel = ({ breakdown }) => (
  <Panel className="p-5">
    <div className="flex items-baseline justify-between mb-3">
      <div>
        <div className="text-xs uppercase tracking-wider" style={{color:TEXT_MUTE}}>Sector tilt (GICS-style)</div>
        <div className="text-base font-semibold mt-0.5">Exposure by bucket</div>
      </div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={breakdown.filter(s => s.value > 0)}
              dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={100} innerRadius={60}
              strokeWidth={0}>
              {breakdown.filter(s => s.value > 0).map((s, i) => (
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
        {breakdown.map(s => (
          <div key={s.id} className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: s.color }} />
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate">{s.label}</div>
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
);

/* Liquid vs illiquid split. */


export const LiquidityBreakdownPanel = ({ rollup }) => {
  const liquidPct = rollup.liquidPct || 0;
  const illiquidPct = 100 - liquidPct;
  return (
    <Panel className="p-5">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <div className="text-xs uppercase tracking-wider" style={{color:TEXT_MUTE}}>Liquidity</div>
          <div className="text-base font-semibold mt-0.5">Liquid vs illiquid</div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div style={{ width: 120, height: 120 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie data={[{name:'Liquid', value: rollup.liquidNAV, color: ACCENT_2},
                          {name:'Illiquid', value: rollup.illiquidNAV, color: VIOLET}]}
                dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={56} innerRadius={36}
                strokeWidth={0}>
                <Cell fill={ACCENT_2} />
                <Cell fill={VIOLET} />
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: PANEL_2, border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 12 }}
                formatter={(v) => fmtCurrency(v)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-2">
          <div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2"><div style={{width:10, height:10, borderRadius:2, backgroundColor: ACCENT_2}} /> Liquid</div>
              <div className="tabular-nums">{fmtCurrency(rollup.liquidNAV)} • {fmtPct(liquidPct,1)}</div>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2"><div style={{width:10, height:10, borderRadius:2, backgroundColor: VIOLET}} /> Illiquid</div>
              <div className="tabular-nums">{fmtCurrency(rollup.illiquidNAV)} • {fmtPct(illiquidPct,1)}</div>
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
};

/* Full top-holdings table. Accepts a count cap (default 25). */


export const FullTopHoldingsTable = ({ tokenRollup, count = 25 }) => {
  const openDetail = useContext(OpenTokenDetailContext);
  return (
    <Panel className="p-5">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <div className="text-xs uppercase tracking-wider" style={{color:TEXT_MUTE}}>Top-{count} holdings (rolled up)</div>
          <div className="text-base font-semibold mt-0.5">Aggregate token exposure across managers</div>
        </div>
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
            {tokenRollup.slice(0, count).map(t => (
              <tr key={t.key}
                onClick={() => t.cgTokenId && openDetail({ cgTokenId: t.cgTokenId, symbol: t.symbol, name: t.name })}
                style={{ borderTop: `1px solid ${BORDER}`, cursor: t.cgTokenId ? 'pointer' : 'default' }}
                className={t.cgTokenId ? 'hover:bg-white/5' : ''}>
                <td className="py-2.5 pr-3">
                  <div className="flex items-center gap-2.5">
                    <TokenIcon ticker={t.symbol} name={t.name} size={22} />
                    <div>
                      <div className="font-medium flex items-center gap-1.5">
                        <span>{t.symbol || t.name}</span>
                        {t.throughFoF && (
                          <span className="text-[9px] px-1 rounded font-medium"
                            style={{ backgroundColor: VIOLET + '22', color: VIOLET, border: `1px solid ${VIOLET}44` }}>FoF</span>
                        )}
                      </div>
                      {t.symbol && t.name !== t.symbol && <div className="text-[10px]" style={{color:TEXT_MUTE}}>{t.name}</div>}
                    </div>
                  </div>
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
  );
};

/* ExposuresPage — lives behind the Exposures sidebar item. */

