import {
  Fragment, useMemo, useState,
} from 'react';
import _ from 'lodash';
import {
  Search, Layers,
} from 'lucide-react';

import {
  PANEL, PANEL_2, BORDER, TEXT, TEXT_DIM, TEXT_MUTE, ACCENT, GREEN, GOLD,
} from '../lib/theme';
import {
  fmtCurrency, fmtPct,
} from '../lib/format';
import { getSectors, sectorOf } from '../lib/sectors';
import {
  snapshotsOf,
} from '../lib/snapshots';
import {
  Panel, SortHead, ChangeCell,
} from '../components/ui';

export function PositionsTab({ rollup, store: _store, updateStore }) {
  const [search, setSearch] = useState('');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [liquidityFilter, setLiquidityFilter] = useState('all');
  const [sortBy, setSortBy] = useState('value');
  const [sortDir, setSortDir] = useState('desc');
  const [groupBySector, setGroupBySector] = useState(false);

  const rows = useMemo(() => {
    let r = rollup.tokenRollup;
    if (search) {
      const s = search.toLowerCase();
      r = r.filter(x => String(x.symbol||'').toLowerCase().includes(s) || String(x.name||'').toLowerCase().includes(s));
    }
    if (sectorFilter !== 'all') r = r.filter(x => x.sectorId === sectorFilter);
    if (liquidityFilter === 'liquid') r = r.filter(x => x.liquid);
    if (liquidityFilter === 'illiquid') r = r.filter(x => !x.liquid);
    return _.orderBy(r, sortBy, sortDir);
  }, [rollup, search, sectorFilter, liquidityFilter, sortBy, sortDir]);

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  // Grouped layout: bucket rows by sectorId, sort sectors by aggregate value desc.
  const grouped = useMemo(() => {
    if (!groupBySector) return null;
    const total = _.sumBy(rows, (r) => r.value || 0);
    const byId = {};
    for (const r of rows) {
      const id = r.sectorId || 'unclassified';
      if (!byId[id]) byId[id] = { id, rows: [], total: 0 };
      byId[id].rows.push(r);
      byId[id].total += r.value || 0;
    }
    return Object.values(byId)
      .map((g) => ({ ...g, pct: total > 0 ? (g.total / total) * 100 : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [rows, groupBySector]);

  // Toggle liquidity on EVERY SAFT-type position with this ticker in the store
  const flipForceLiquid = (tokenKey, newValue) => {
    updateStore(s => ({
      ...s,
      soIs: s.soIs.map(soi => ({
        ...soi,
        snapshots: snapshotsOf(soi).map(snap => ({
          ...snap,
          positions: snap.positions.map(p => {
            const key = (p.ticker&&p.ticker.toUpperCase())||p.positionName;
            if (key !== tokenKey) return p;
            return { ...p, forceLiquid: newValue };
          }),
        })),
      })),
    }));
  };

  const changeSector = (tokenKey, sectorId) => {
    updateStore(s => {
      // Persist as a global override so future uploads with this ticker inherit it
      const newOverrides = { ...s.sectorOverrides };
      if (tokenKey && typeof tokenKey === 'string') newOverrides[tokenKey.toUpperCase()] = sectorId;
      return {
        ...s,
        sectorOverrides: newOverrides,
        soIs: s.soIs.map(soi => ({
          ...soi,
          snapshots: snapshotsOf(soi).map(snap => ({
            ...snap,
            positions: snap.positions.map(p => {
              const key = (p.ticker&&p.ticker.toUpperCase())||p.positionName;
              if (key !== tokenKey) return p;
              return { ...p, sectorId };
            }),
          })),
        })),
      };
    });
  };

  return (
    <div className="space-y-4">
      <Panel className="p-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-[220px]">
          <Search size={14} style={{ color: TEXT_DIM }} />
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search tokens…"
            className="flex-1 bg-transparent text-sm outline-none" style={{color:TEXT}} />
        </div>
        <select value={sectorFilter} onChange={e=>setSectorFilter(e.target.value)}
          className="text-xs px-2 py-1 rounded outline-none"
          style={{ backgroundColor: PANEL_2, color: TEXT, border: `1px solid ${BORDER}` }}>
          <option value="all">All sectors</option>
          {getSectors().map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          <option value="unclassified">Unclassified</option>
        </select>
        <select value={liquidityFilter} onChange={e=>setLiquidityFilter(e.target.value)}
          className="text-xs px-2 py-1 rounded outline-none"
          style={{ backgroundColor: PANEL_2, color: TEXT, border: `1px solid ${BORDER}` }}>
          <option value="all">All liquidity</option>
          <option value="liquid">Liquid only</option>
          <option value="illiquid">Illiquid only</option>
        </select>
        <button
          onClick={() => setGroupBySector((g) => !g)}
          className="text-xs px-2 py-1 rounded flex items-center gap-1"
          style={{
            backgroundColor: groupBySector ? GOLD + '22' : 'transparent',
            color: groupBySector ? GOLD : TEXT_DIM,
            border: `1px solid ${groupBySector ? GOLD + '44' : BORDER}`,
          }}
          title="Group rows by sector"
        >
          <Layers size={12} /> {groupBySector ? 'Grouped' : 'Group by sector'}
        </button>
        <div className="text-xs" style={{color:TEXT_DIM}}>{rows.length} tokens</div>
      </Panel>
      <Panel className="p-0 overflow-hidden">
        {rows.some((t) => t.hasLivePrice) && (
          <div
            className="px-4 py-2 text-[10px] flex items-center gap-2"
            style={{ color: TEXT_MUTE, borderBottom: `1px solid ${BORDER}` }}
          >
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, backgroundColor: ACCENT + '33', border: `1px solid ${ACCENT}55` }} />
            Tinted rows use live prices — current value reflects the latest CoinGecko fetch; manager-marked snapshot values feed everything else.
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: TEXT_MUTE, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `1px solid ${BORDER}` }}>
                <SortHead col="symbol"  by={sortBy} dir={sortDir} onClick={toggleSort} align="left">Token</SortHead>
                <SortHead col="sectorId" by={sortBy} dir={sortDir} onClick={toggleSort} align="left">Sector</SortHead>
                <SortHead col="change24h" by={sortBy} dir={sortDir} onClick={toggleSort} align="right">24h</SortHead>
                <SortHead col="value" by={sortBy} dir={sortDir} onClick={toggleSort} align="right">Value</SortHead>
                <SortHead col="pct" by={sortBy} dir={sortDir} onClick={toggleSort} align="right">% Book</SortHead>
                <SortHead col="managerCount" by={sortBy} dir={sortDir} onClick={toggleSort} align="right">In funds</SortHead>
                <th className="text-right px-3 py-2">Liquidity</th>
              </tr>
            </thead>
            <tbody>
              {!groupBySector && rows.map((t) => (
                <PositionRow key={t.key} t={t} changeSector={changeSector} flipForceLiquid={flipForceLiquid} indent={false} />
              ))}
              {groupBySector && grouped && grouped.map((g) => {
                const sec = sectorOf(g.id);
                return (
                  <Fragment key={g.id}>
                    <tr style={{ backgroundColor: sec.color + '11', borderTop: `2px solid ${sec.color}55`, borderBottom: `1px solid ${BORDER}` }}>
                      <td className="px-3 py-2" colSpan={3}>
                        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: sec.color }}>
                          {sec.label}
                        </span>
                        <span className="text-[10px] ml-2" style={{ color: TEXT_MUTE }}>
                          {g.rows.length} {g.rows.length === 1 ? 'token' : 'tokens'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium" style={{ color: TEXT }}>
                        {fmtCurrency(g.total)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums" style={{ color: TEXT_DIM }}>
                        {fmtPct(g.pct, 2)}
                      </td>
                      <td colSpan={2} />
                    </tr>
                    {g.rows.map((t) => (
                      <PositionRow key={t.key} t={t} changeSector={changeSector} flipForceLiquid={flipForceLiquid} indent={true} />
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function PositionRow({ t, changeSector, flipForceLiquid, indent }) {
  return (
    <tr
      style={{
        borderBottom: `1px solid ${BORDER}`,
        // Subtle accent tint when this row's value is computed from live
        // prices — same treatment as the per-fund PositionGrid so the global
        // and per-fund views read consistently.
        backgroundColor: t.hasLivePrice ? ACCENT + '0c' : 'transparent',
      }}
      title={t.hasLivePrice
        ? 'Simulated · current value computed from live price for this token. Manager-marked snapshot values feed into the rollup.'
        : 'Manager-marked · all values from snapshot rollup.'}
    >
      <td className="px-3 py-2.5" style={{ paddingLeft: indent ? 32 : undefined }}>
        <div className="font-medium">{t.symbol || t.name}</div>
        {t.symbol && t.name !== t.symbol && <div className="text-[10px]" style={{ color: TEXT_MUTE }}>{t.name}</div>}
        <div className="text-[10px] mt-0.5" style={{ color: TEXT_MUTE }}>
          {t.managers.slice(0,2).join(' • ')}{t.managers.length>2 ? ` +${t.managers.length-2}` : ''}
        </div>
      </td>
      <td className="px-3 py-2.5">
        <select value={t.sectorId} onChange={(e) => changeSector(t.key, e.target.value)}
          className="text-xs px-1.5 py-0.5 rounded outline-none"
          style={{ backgroundColor: 'transparent', color: sectorOf(t.sectorId).color, border: `1px solid ${sectorOf(t.sectorId).color}44` }}>
          {getSectors().map((s) => <option key={s.id} value={s.id} style={{ backgroundColor: PANEL, color: TEXT }}>{s.label}</option>)}
          <option value="unclassified" style={{ backgroundColor: PANEL, color: TEXT }}>Unclassified</option>
        </select>
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums"><ChangeCell value={t.change24h} /></td>
      <td className="px-3 py-2.5 text-right tabular-nums font-medium">{fmtCurrency(t.value)}</td>
      <td className="px-3 py-2.5 text-right tabular-nums">{fmtPct(t.pct, 2)}</td>
      <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: TEXT_DIM }}>{t.managerCount}</td>
      <td className="px-3 py-2.5 text-right">
        <button onClick={() => flipForceLiquid(t.key, !t.forceLiquid)}
          className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded"
          style={{
            backgroundColor: t.liquid ? GREEN + '22' : GOLD + '22',
            color: t.liquid ? GREEN : GOLD,
            border: `1px solid ${t.liquid ? GREEN + '44' : GOLD + '44'}`,
          }}
          title={t.forceLiquid ? 'Click to revert to snapshot treatment' : "Mark as liquid (TGE'd)"}>
          {t.liquid ? 'Liquid' : 'Illiquid'}
          {t.forceLiquid && <span style={{ opacity: 0.7 }}>•</span>}
        </button>
      </td>
    </tr>
  );
}

