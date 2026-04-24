import React, { useMemo } from 'react';
import { DollarSign } from 'lucide-react';
import _ from 'lodash';

import {
  PANEL, PANEL_2, BORDER, TEXT, TEXT_DIM, TEXT_MUTE,
  ACCENT, ACCENT_2, GREEN, RED, GOLD, VIOLET,
} from '../lib/theme';
import { fmtCurrency, fmtPct, fmtMoic, fundLabel } from '../lib/format';
import { latestSnapshot, isLiquid } from '../lib/snapshots';
import { Panel, PlaceholderPage, KPI } from '../components/ui';

export function FundEconomicsPage({ rollup, store, selection, clientShareMode }) {
  const commits = useMemo(() => {
    let cc = store.commitments;
    if (selection.kind === 'client') cc = cc.filter(c => c.clientId === selection.id);
    // Decorate with current NAV from rollup.managerBreakdown where possible.
    const navBySoi = {};
    for (const m of (rollup.managerBreakdown || [])) navBySoi[m.soiId] = m.value;
    return cc.map(c => {
      const client = store.clients.find(x => x.id === c.clientId);
      const mgr = store.managers.find(x => x.id === c.managerId);
      const soi = store.soIs.find(x => x.id === c.soiId);
      const called = c.called || 0;
      const committed = c.committed || 0;
      const distributions = c.distributions || 0;
      const nav = navBySoi[c.soiId] || 0;
      return {
        id: c.id,
        clientName: client?.name || '?',
        managerName: mgr?.name || '?',
        vintage: fundLabel(soi),
        committed, called, distributions,
        uncalled: committed - called,
        pctInvested: committed > 0 ? (called / committed) * 100 : null,
        nav,
        unrealizedMoic: called > 0 ? nav / called : null,
        dpi: called > 0 ? distributions / called : null,
        tvpi: called > 0 ? (nav + distributions) / called : null,
      };
    });
  }, [store.commitments, store.clients, store.managers, store.soIs, rollup.managerBreakdown, selection]);

  const totals = useMemo(() => commits.reduce((t, c) => ({
    committed: t.committed + c.committed,
    called: t.called + c.called,
    distributions: t.distributions + c.distributions,
    nav: t.nav + c.nav,
  }), { committed: 0, called: 0, distributions: 0, nav: 0 }), [commits]);

  const pctInvested = totals.committed > 0 ? (totals.called / totals.committed) * 100 : null;
  const pooledMoic  = totals.called > 0 ? totals.nav / totals.called : null;
  const pooledTvpi  = totals.called > 0 ? (totals.nav + totals.distributions) / totals.called : null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Total Committed" value={fmtCurrency(totals.committed)} />
        <KPI label="Total Called" value={fmtCurrency(totals.called)}
             sub={`Uncalled ${fmtCurrency(totals.committed - totals.called)}`} />
        <KPI label="% Invested" value={pctInvested != null ? fmtPct(pctInvested, 1) : '—'} />
        <KPI label="Pooled Unrealized MOIC" value={fmtMoic(pooledMoic)}
             sub={clientShareMode && selection?.kind === 'client' ? 'Client NAV ÷ Called' : 'Current NAV ÷ Called'} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Distributions" value={fmtCurrency(totals.distributions)} />
        <KPI label="DPI" value={totals.called > 0 ? fmtMoic(totals.distributions/totals.called) : '—'}
             sub="Distributed ÷ Called" />
        <KPI label="TVPI" value={fmtMoic(pooledTvpi)} sub="(NAV + Dist) ÷ Called" />
        <KPI label="Commitments" value={commits.length} sub={`${new Set(commits.map(c=>c.managerName)).size} managers`} />
      </div>

      <Panel className="p-0 overflow-x-auto">
        <div className="px-5 pt-4 pb-1">
          <div className="text-xs uppercase tracking-wider" style={{color:TEXT_MUTE}}>Commitments</div>
          <div className="text-base font-semibold mt-0.5">Economics by commitment</div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ color: TEXT_MUTE, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {selection.kind !== 'client' && <th className="text-left py-2 pl-5 pr-3">Client</th>}
              <th className="text-left py-2 pr-3">Manager</th>
              <th className="text-left py-2 pr-3">Vintage</th>
              <th className="text-right py-2 pr-3">Committed</th>
              <th className="text-right py-2 pr-3">Called</th>
              <th className="text-right py-2 pr-3">Uncalled</th>
              <th className="text-right py-2 pr-3">Distributions</th>
              <th className="text-right py-2 pr-3">% Invested</th>
              <th className="text-right py-2 pr-3">NAV</th>
              <th className="text-right py-2 pr-3">Unreal MOIC</th>
              <th className="text-right py-2 pr-3">DPI</th>
              <th className="text-right py-2 pr-5">TVPI</th>
            </tr>
          </thead>
          <tbody>
            {commits.length === 0 && (
              <tr><td colSpan={12} className="py-6 text-center text-xs" style={{color: TEXT_DIM}}>No commitments for this selection.</td></tr>
            )}
            {commits.map(c => (
              <tr key={c.id} style={{ borderTop: `1px solid ${BORDER}` }}>
                {selection.kind !== 'client' && <td className="py-2.5 pl-5 pr-3">{c.clientName}</td>}
                <td className="py-2.5 pr-3 font-medium">{c.managerName}</td>
                <td className="py-2.5 pr-3" style={{color: TEXT_DIM}}>{c.vintage}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{fmtCurrency(c.committed)}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{fmtCurrency(c.called)}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums" style={{color: TEXT_DIM}}>{fmtCurrency(c.uncalled)}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{fmtCurrency(c.distributions)}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums" style={{color: TEXT_DIM}}>{c.pctInvested != null ? fmtPct(c.pctInvested, 1) : '—'}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums font-medium">{fmtCurrency(c.nav)}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{fmtMoic(c.unrealizedMoic)}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{fmtMoic(c.dpi)}</td>
                <td className="py-2.5 pr-5 text-right tabular-nums font-medium">{fmtMoic(c.tvpi)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

