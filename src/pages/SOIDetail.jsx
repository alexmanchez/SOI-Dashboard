import React, { useContext, useEffect, useMemo, useState } from 'react';
import _ from 'lodash';
import {
  ArrowLeft, Edit2, X, Check, Plus, Trash2, RefreshCw,
  Calendar, ChevronDown, ChevronRight,
} from 'lucide-react';

import {
  BG, PANEL, PANEL_2, BORDER, TEXT, TEXT_DIM, TEXT_MUTE,
  ACCENT, ACCENT_2, GREEN, RED, GOLD, VIOLET,
} from '../lib/theme';
import { fmtCurrency, fmtPct, fmtPctSigned, fmtNum, fmtMoic, fundLabel, uid, today } from '../lib/format';
import { getSectors, sectorOf, resolveSector } from '../lib/sectors';
import { RANGES } from '../lib/ranges';
import {
  snapshotsOf, latestSnapshot, sortedSnapshots, isLiquid, liquidityOverrideOf,
} from '../lib/snapshots';
import { OpenTokenDetailContext } from '../contexts';

import {
  Panel, Pill, EditableText, SectorBadge, LiquidityBadge, ChangeCell, SortHead,
  ManagerSocials, KPI, NumField, Stat,
} from '../components/ui';
import { TokenIcon } from '../components/TokenIcon';
import { PerformanceChart } from '../components/PerformanceChart';
import {
  CompactSectorTilt, TopHoldingsPanel, TopMoversPanel,
  LiquidityBreakdownPanel,
} from '../components/DashboardPanels';
import { PositionEditor } from './PositionEditor';
import { ImportWizard } from '../import/ImportWizard';

export function SOIDetail({ store, soiId, livePrices, onBack, updateStore, priceHistory, historyLoading, historyProgress, range, onRangeChange, onRequestFetch, apiKey }) {
  const soi = store.soIs.find(s => s.id === soiId);
  const manager = store.managers.find(m => m.id === soi?.managerId);
  const [editingPosition, setEditingPosition] = useState(null); // {mode: 'add'|'edit', position?}
  const [updatingSOI, setUpdatingSOI] = useState(false);

  const snaps = soi ? sortedSnapshots(soi) : [];
  const [selectedSnapId, setSelectedSnapId] = useState(() => latestSnapshot(soi)?.id ?? null);
  useEffect(() => { setSelectedSnapId(latestSnapshot(soi)?.id ?? null); }, [soiId]);

  if (!soi) return null;

  const selectedSnap = snaps.find(s => s.id === selectedSnapId) || latestSnapshot(soi) || snaps[0];

  // Build enriched positions for this one SOI
  const rows = useMemo(() => {
    return (selectedSnap?.positions || []).map(p => {
      const sectorId = resolveSector(p, store.sectorOverrides);
      const liquid = isLiquid(p);
      const live = p.cgTokenId && livePrices[p.cgTokenId];
      const useLive = !!live && liquid;
      const currentValue = useLive && p.quantity ? p.quantity * live.usd : p.soiMarketValue;
      return {
        ...p, sectorId, liquid, currentValue,
        livePrice: useLive ? live.usd : null,
        change24h: useLive ? live.change24h : null,
        hasLivePrice: useLive,
      };
    });
  }, [selectedSnap, store.sectorOverrides, livePrices]);

  const totalNAV = _.sumBy(rows, 'currentValue');
  const soiNAV = _.sumBy(rows, 'soiMarketValue');
  const liquidNAV = _.sumBy(rows.filter(r=>r.liquid), 'currentValue');
  const illiquidNAV = _.sumBy(rows.filter(r=>!r.liquid), 'currentValue');

  const bySector = _.groupBy(rows, 'sectorId');
  const sectorData = getSectors().map(s => {
    const items = bySector[s.id] || [];
    const v = _.sumBy(items, 'currentValue');
    return { id: s.id, label: s.label, color: s.color, value: v, pct: totalNAV>0?(v/totalNAV)*100:0, count: items.length };
  }).filter(s => s.value > 0);

  const deleteSnapshot = (snapId) => {
    if (snaps.length <= 1) { alert('Cannot delete the only snapshot.'); return; }
    if (!confirm('Delete this snapshot? This cannot be undone.')) return;
    updateStore(s => ({
      ...s,
      soIs: s.soIs.map(x => x.id !== soiId ? x : {
        ...x,
        snapshots: snapshotsOf(x).filter(snap => snap.id !== snapId),
      }),
    }));
    const remaining = snaps.filter(s => s.id !== snapId);
    setSelectedSnapId(remaining[remaining.length - 1]?.id ?? null);
  };

  const cycleLiquidity = (posId) => {
    // auto → liquid → illiquid → auto
    const cur = rows.find(r => r.id === posId);
    const curOverride = liquidityOverrideOf(cur);
    const next = curOverride === 'auto' ? (cur.liquid ? 'illiquid' : 'liquid')
               : curOverride === 'liquid' ? 'illiquid' : 'auto';
    updateStore(s => ({
      ...s,
      soIs: s.soIs.map(x => x.id !== soiId ? x : {
        ...x,
        snapshots: snapshotsOf(x).map(snap =>
          snap.id !== selectedSnapId ? snap : {
            ...snap,
            positions: snap.positions.map(p => {
              if (p.id !== posId) return p;
              const copy = { ...p, liquidityOverride: next };
              delete copy.forceLiquid;
              return copy;
            }),
          }
        ),
      }),
    }));
  };

  const savePosition = (payload) => {
    updateStore(s => ({
      ...s,
      soIs: s.soIs.map(x => {
        if (x.id !== soiId) return x;
        return {
          ...x,
          snapshots: snapshotsOf(x).map(snap => {
            if (snap.id !== selectedSnapId) return snap;
            if (payload.id && snap.positions.find(p => p.id === payload.id)) {
              return { ...snap, positions: snap.positions.map(p => p.id === payload.id ? { ...p, ...payload } : p) };
            }
            return { ...snap, positions: [...snap.positions, { ...payload, id: payload.id || uid() }] };
          }),
        };
      }),
    }));
    setEditingPosition(null);
  };

  const deletePosition = (posId) => {
    if (!confirm('Delete this position?')) return;
    updateStore(s => ({
      ...s,
      soIs: s.soIs.map(x => x.id !== soiId ? x : {
        ...x,
        snapshots: snapshotsOf(x).map(snap =>
          snap.id !== selectedSnapId ? snap : { ...snap, positions: snap.positions.filter(p => p.id !== posId) }
        ),
      }),
    }));
  };

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-xs flex items-center gap-1 hover:underline" style={{color:TEXT_DIM}}>
        <ArrowLeft size={12} /> Back to managers
      </button>
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider" style={{color:TEXT_MUTE}}>Fund snapshot</div>
          <h2 className="text-xl font-semibold mt-0.5">{manager?.name} — {fundLabel(soi)}</h2>
          <div className="text-xs mt-1 flex items-center gap-2" style={{color:TEXT_DIM}}>
            {snaps.length >= 2 ? (
              <div className="flex items-center gap-2">
                <select value={selectedSnapId || ''} onChange={e => setSelectedSnapId(e.target.value)}
                  className="text-xs px-2 py-1 rounded outline-none"
                  style={{color:GOLD, backgroundColor:GOLD+'11', border:`1px solid ${GOLD}44`}}>
                  {[...snaps].reverse().map(snap => (
                    <option key={snap.id} value={snap.id}>
                      As of {snap.asOfDate || '—'}{snap.notes ? ` (${snap.notes})` : ''}
                    </option>
                  ))}
                </select>
                {snaps.length > 1 && (
                  <button onClick={() => deleteSnapshot(selectedSnapId)}
                    className="text-xs px-2 py-1 rounded flex items-center gap-1"
                    style={{color:RED, border:`1px solid ${RED}44`}}>
                    <Trash2 size={10}/> Delete snapshot
                  </button>
                )}
              </div>
            ) : (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded" style={{color:GOLD, backgroundColor:GOLD+'11', border:`1px solid ${GOLD}44`}}>
                As of {selectedSnap?.asOfDate || '—'}
              </span>
            )}
            <span>{rows.length} positions</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wider" style={{color:TEXT_MUTE}}>Fund NAV</div>
          <div className="text-xl font-semibold">{fmtCurrency(totalNAV)}</div>
          {totalNAV !== soiNAV && (
            <div className="text-[11px]" style={{color:TEXT_DIM}}>
              Snapshot: {fmtCurrency(soiNAV)} • <ChangeCell value={((totalNAV-soiNAV)/soiNAV)*100} />
            </div>
          )}
        </div>
      </div>

      {/* Performance chart */}
      <PerformanceChart
        soiBundles={[soi]}
        priceHistory={priceHistory}
        historyLoading={historyLoading}
        historyProgress={historyProgress}
        range={range}
        onRangeChange={onRangeChange}
        onRequestFetch={onRequestFetch}
        apiKey={apiKey}
        title={`${manager?.name} ${soi.vintage} performance`}
        height={240}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="NAV" value={fmtCurrency(totalNAV)} />
        <KPI label="Positions" value={rows.length} />
        <KPI label="Liquid" value={fmtCurrency(liquidNAV)} sub={fmtPct(totalNAV>0?(liquidNAV/totalNAV)*100:0,1)} />
        <KPI label="Illiquid" value={fmtCurrency(illiquidNAV)} sub={fmtPct(totalNAV>0?(illiquidNAV/totalNAV)*100:0,1)} />
      </div>

      {(() => {
        const commitment = store.commitments.find(c => c.soiId === soi.id);
        if (!commitment) {
          return (
            <Panel className="p-5">
              <div className="text-xs uppercase tracking-wider mb-2" style={{color:TEXT_MUTE}}>Fund economics</div>
              <div className="text-sm" style={{color:TEXT_DIM}}>No commitment linked to this SOI.</div>
            </Panel>
          );
        }
        const committed = commitment.committed || 0;
        const called = commitment.called || 0;
        const distributions = commitment.distributions || 0;
        const uncalled = committed - called;
        const pctInvested = committed > 0 ? (called / committed) * 100 : null;
        const unrealizedMoic = called > 0 ? totalNAV / called : null;
        const dpi = called > 0 ? distributions / called : null;
        const tvpi = called > 0 ? (totalNAV + distributions) / called : null;
        const updateCommitment = (patch) => updateStore(s => ({
          ...s, commitments: s.commitments.map(c => c.id === commitment.id ? { ...c, ...patch } : c),
        }));
        return (
          <Panel className="p-5">
            <div className="text-xs uppercase tracking-wider mb-3" style={{color:TEXT_MUTE}}>Fund economics</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <NumField label="Commitment" value={committed} onSave={v => updateCommitment({ committed: v })} />
              <NumField label="Called" value={called} onSave={v => updateCommitment({ called: v })} />
              <NumField label="Distributions" value={distributions} onSave={v => updateCommitment({ distributions: v })} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <Stat label="Uncalled" value={fmtCurrency(uncalled)} />
              <Stat label="% Invested" value={pctInvested != null ? fmtPct(pctInvested, 1) : '—'} />
              <Stat label="Unrealized MOIC" value={fmtMoic(unrealizedMoic)} />
              <Stat label="DPI" value={fmtMoic(dpi)} />
              <Stat label="TVPI" value={fmtMoic(tvpi)} />
            </div>
            {(() => {
              const fundTotalCalled = _.sumBy(latestSnapshot(soi)?.positions||[], p=>p.soiMarketValue||0);
              const shareOfFund = fundTotalCalled > 0 ? (called/fundTotalCalled)*100 : null;
              return (
                <div className="grid grid-cols-2 gap-2 pt-2 mt-2" style={{borderTop: `1px solid ${BORDER}`}}>
                  <Stat label="Fund Total NAV" value={fmtCurrency(fundTotalCalled)} />
                  <Stat label="Your Share of Fund" value={shareOfFund != null ? fmtPct(shareOfFund, 2) : '—'} />
                </div>
              );
            })()}
          </Panel>
        );
      })()}

      {/* Underlying Commitments — only shown for FoF SOIs */}
      {manager?.type === 'fund_of_funds' && (() => {
        const subCommitments = selectedSnap?.subCommitments || [];
        const fofTotalCalled = _.sumBy(subCommitments, s => s.called || 0);
        return (
          <Panel className="p-5">
            <div className="text-xs uppercase tracking-wider mb-3" style={{color:TEXT_MUTE}}>
              Underlying Manager Commitments ({subCommitments.length})
            </div>
            {subCommitments.length === 0 ? (
              <div className="text-sm" style={{color:TEXT_DIM}}>No sub-commitments in this snapshot.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{color:TEXT_MUTE, fontSize:11, textTransform:'uppercase', letterSpacing:'0.05em', borderBottom:`1px solid ${BORDER}`}}>
                      <th className="text-left px-3 py-2">Fund</th>
                      <th className="text-right px-3 py-2">Committed</th>
                      <th className="text-right px-3 py-2">Called</th>
                      <th className="text-right px-3 py-2">Distributions</th>
                      <th className="text-right px-3 py-2">Underlying NAV</th>
                      <th className="text-right px-3 py-2">FoF Share %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subCommitments.map(sub => {
                      const targetSoi = store.soIs.find(s => s.id === sub.toSoiId);
                      const targetMgr = targetSoi ? store.managers.find(mm => mm.id === targetSoi.managerId) : null;
                      const underlyingMV = _.sumBy(latestSnapshot(targetSoi)?.positions || [], p => p.soiMarketValue || 0);
                      const fofSharePct = underlyingMV > 0 ? (sub.called || 0) / underlyingMV * 100 : null;
                      const pctOfFoF = fofTotalCalled > 0 ? (sub.called || 0) / fofTotalCalled * 100 : null;
                      return (
                        <tr key={sub.id} style={{borderBottom:`1px solid ${BORDER}`}}>
                          <td className="px-3 py-2.5">
                            <div className="font-medium">{targetMgr?.name || '?'}</div>
                            <div className="text-[10px]" style={{color:TEXT_DIM}}>{targetSoi?.vintage || '—'}</div>
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{fmtCurrency(sub.committed)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            {fmtCurrency(sub.called)}
                            {pctOfFoF != null && <div className="text-[10px]" style={{color:TEXT_DIM}}>{fmtPct(pctOfFoF, 1)} of FoF</div>}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{fmtCurrency(sub.distributions)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{underlyingMV > 0 ? fmtCurrency(underlyingMV) : '—'}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            {fofSharePct != null ? <span style={{color: ACCENT_2}}>{fmtPct(fofSharePct, 2)}</span> : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        );
      })()}

      <Panel className="p-5">
        <div className="text-xs uppercase tracking-wider mb-3" style={{color:TEXT_MUTE}}>Sector tilt</div>
        <div className="flex h-3 rounded-full overflow-hidden mb-3" style={{backgroundColor:PANEL_2}}>
          {sectorData.map(s => (
            <div key={s.id} style={{width: `${s.pct}%`, backgroundColor: s.color}} title={`${s.label} ${fmtPct(s.pct,1)}`} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {sectorData.map(s => (
            <div key={s.id} className="text-xs px-2 py-1 rounded flex items-center gap-1.5"
              style={{backgroundColor: s.color+'22', color: s.color, border: `1px solid ${s.color}44`}}>
              <span className="w-1.5 h-1.5 rounded-full" style={{backgroundColor: s.color}} />
              {s.label} <span className="tabular-nums">{fmtPct(s.pct,1)}</span>
            </div>
          ))}
        </div>
      </Panel>

      {/* Positions table */}
      <Panel className="p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3" style={{borderBottom: `1px solid ${BORDER}`}}>
          <div className="text-sm font-semibold">Positions</div>
          <div className="flex items-center gap-2">
            <button onClick={() => setUpdatingSOI(true)}
              className="text-xs px-3 py-1.5 rounded font-medium flex items-center gap-1"
              style={{color: TEXT, backgroundColor: PANEL_2, border: `1px solid ${BORDER}`}}>
              <RefreshCw size={12} /> Update holdings
            </button>
            <button onClick={() => setEditingPosition({ mode: 'add' })}
              className="text-xs px-3 py-1.5 rounded font-medium flex items-center gap-1"
              style={{backgroundColor: ACCENT, color: BG}}>
              <Plus size={12} /> Add position
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: TEXT_MUTE, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `1px solid ${BORDER}` }}>
                <th className="text-left px-3 py-2">Position</th>
                <th className="text-left px-3 py-2">Sector</th>
                <th className="text-right px-3 py-2">Qty</th>
                <th className="text-right px-3 py-2">Snap Px</th>
                <th className="text-right px-3 py-2">Live Px</th>
                <th className="text-right px-3 py-2">24h</th>
                <th className="text-right px-3 py-2">Cost</th>
                <th className="text-right px-3 py-2">Value</th>
                <th className="text-right px-3 py-2">P&amp;L $</th>
                <th className="text-right px-3 py-2">P&amp;L %</th>
                <th className="text-right px-3 py-2">% NAV</th>
                <th className="text-right px-3 py-2">Liquidity</th>
                <th className="text-right px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {_.orderBy(rows, 'currentValue', 'desc').map(p => {
                const pct = totalNAV>0 ? (p.currentValue/totalNAV)*100 : 0;
                const plDollars = p.costBasis != null ? p.currentValue - p.costBasis : null;
                const plPct = (p.costBasis != null && p.costBasis !== 0) ? (plDollars / p.costBasis) * 100 : null;
                const override = liquidityOverrideOf(p);
                return (
                  <tr key={p.id} style={{borderBottom: `1px solid ${BORDER}`}}>
                    <td className="px-3 py-2.5">
                      <div className="font-medium">{p.positionName}</div>
                      <div className="text-[10px]" style={{color:TEXT_MUTE}}>
                        {p.ticker && <span>{p.ticker}</span>}
                        {p.assetType && <span> • {p.assetType}</span>}
                        {p.acquisitionDate && <span> • Acq {String(p.acquisitionDate).slice(0,10)}</span>}
                      </div>
                      {p.notes && <div className="text-[10px] mt-0.5" style={{color:TEXT_DIM}}>{p.notes}</div>}
                    </td>
                    <td className="px-3 py-2.5"><SectorBadge sectorId={p.sectorId} /></td>
                    <td className="px-3 py-2.5 text-right tabular-nums" style={{color: p.quantity ? TEXT : TEXT_MUTE}}>
                      {p.quantity ? p.quantity.toLocaleString(undefined,{maximumFractionDigits: 2}) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums" style={{color:TEXT_DIM}}>
                      {p.soiPrice ? `$${p.soiPrice.toLocaleString(undefined,{maximumFractionDigits: 4})}` : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {p.livePrice ? <span style={{color:GREEN}}>${p.livePrice.toLocaleString(undefined,{maximumFractionDigits: 4})}</span> : <span style={{color:TEXT_MUTE}}>—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums"><ChangeCell value={p.change24h} /></td>
                    <td className="px-3 py-2.5 text-right tabular-nums" style={{color:TEXT_DIM}}>
                      {p.costBasis != null ? fmtCurrency(p.costBasis) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium">{fmtCurrency(p.currentValue)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {plDollars != null ? <ChangeCell value={plDollars} format="currency" /> : <span style={{color:TEXT_MUTE}}>—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {plPct != null ? <ChangeCell value={plPct} /> : <span style={{color:TEXT_MUTE}}>—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{fmtPct(pct,2)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <button onClick={()=>cycleLiquidity(p.id)}
                        className="text-[10px] px-1.5 py-0.5 rounded inline-flex items-center gap-1"
                        style={{
                          backgroundColor: p.liquid ? GREEN+'22' : GOLD+'22',
                          color: p.liquid ? GREEN : GOLD,
                          border: `1px solid ${p.liquid ? GREEN+'44' : GOLD+'44'}`,
                        }}
                        title={
                          override === 'auto' ? 'Click to override (next: ' + (p.liquid ? 'Illiquid' : 'Liquid') + ')' :
                          override === 'liquid' ? 'Forced liquid. Click for Illiquid.' :
                          'Forced illiquid. Click to reset to auto.'
                        }>
                        {p.liquid ? 'Liquid' : 'Illiquid'}
                        {override !== 'auto' && <Check size={10} />}
                      </button>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={()=>setEditingPosition({mode:'edit', position: p})}
                          className="p-1 rounded" style={{color:TEXT_DIM}} title="Edit">
                          <Edit2 size={12} />
                        </button>
                        <button onClick={()=>deletePosition(p.id)}
                          className="p-1 rounded" style={{color:TEXT_DIM}} title="Delete">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {editingPosition && (
        <PositionEditor
          mode={editingPosition.mode}
          position={editingPosition.position}
          onCancel={() => setEditingPosition(null)}
          onSave={savePosition}
        />
      )}

      {updatingSOI && (
        <ImportWizard
          store={store}
          updateStore={updateStore}
          onClose={() => setUpdatingSOI(false)}
          onDone={() => setUpdatingSOI(false)}
          prefillTarget={{ soiId, managerId: soi.managerId, mode: 'replace' }}
        />
      )}
    </div>
  );
}

