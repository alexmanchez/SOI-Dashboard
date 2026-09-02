import _ from 'lodash';

import { fundLabel } from './format';
import { getSelectedSOIs } from './rollup';
import { resolveSector } from './sectors';
import { snapshotAsOf } from './snapshots';

/**
 * Pivots the funds in scope into a single holding x fund matrix, so the same
 * position can be read across managers — the overlap question a fund-of-funds
 * allocator actually asks ("how much ETH do I own, and through whom?").
 *
 * A direct fund contributes its positions at face value. A fund-of-funds is
 * looked through to its underlying funds and scaled by its ownership of each
 * (called / underlying NAV) — the same basis computeRollup uses — so a FoF
 * column is comparable to a direct one rather than being an order of magnitude
 * larger. Deliberately not scaled by any one client's share: the question here
 * is what each fund holds, not what a given LP's slice of it is worth.
 */
export const buildFundComparison = (store, { soiIds = null, asOfDate = null } = {}) => {
  const managerById = Object.fromEntries(store.managers.map(m => [m.id, m]));
  const snapFor = (soi) => snapshotAsOf(soi, asOfDate);
  const inScope = soiIds ? store.soIs.filter(s => soiIds.includes(s.id)) : store.soIs;

  const columns = [];
  const byToken = new Map();

  const add = (colId, position, scale) => {
    const key = (position.ticker || position.positionName || '').toUpperCase().trim();
    if (!key) return;
    const value = (position.soiMarketValue || 0) * scale;
    if (value <= 0) return;

    if (!byToken.has(key)) {
      byToken.set(key, {
        key,
        symbol: position.ticker || '',
        name: position.positionName,
        sectorId: resolveSector(position, store.sectorOverrides),
        values: {},
        total: 0,
      });
    }
    const row = byToken.get(key);
    row.values[colId] = (row.values[colId] || 0) + value;
    row.total += value;
  };

  for (const soi of inScope) {
    const manager = managerById[soi.managerId];
    const isFoF = manager?.type === 'fund_of_funds';
    const snap = snapFor(soi);

    if (isFoF) {
      const subs = snap?.subCommitments || [];
      if (!subs.length) continue;
      columns.push({ id: soi.id, label: fundLabel(soi), manager: manager?.name || '—', isFoF, total: 0 });

      for (const sub of subs) {
        const target = store.soIs.find(s => s.id === sub.toSoiId);
        if (!target) continue;
        // Nested fund-of-funds are out of scope here, matching computeRollup,
        // which stops at one level of look-through.
        if (managerById[target.managerId]?.type === 'fund_of_funds') continue;

        const positions = snapFor(target)?.positions || [];
        const underlyingMV = _.sumBy(positions, p => p.soiMarketValue || 0);
        if (underlyingMV <= 0) continue;

        const fofShare = (sub.called || 0) / underlyingMV;
        for (const p of positions) add(soi.id, p, fofShare);
      }
    } else {
      const positions = snap?.positions || [];
      if (!positions.length) continue;
      columns.push({ id: soi.id, label: fundLabel(soi), manager: manager?.name || '—', isFoF, total: 0 });
      for (const p of positions) add(soi.id, p, 1);
    }
  }

  const rows = [...byToken.values()].sort((a, b) => b.total - a.total);

  for (const col of columns) col.total = _.sumBy(rows, r => r.values[col.id] || 0);
  for (const r of rows) r.fundCount = columns.filter(c => (r.values[c.id] || 0) > 0).length;

  // A FoF column and its own underlying funds describe the same money twice.
  // Showing them side by side is the point of this view, but the totals are then
  // not a net exposure figure — so report it rather than quietly summing.
  const selectedIds = new Set(columns.map(c => c.id));
  const doubleCounted = [];
  for (const col of columns.filter(c => c.isFoF)) {
    const soi = inScope.find(s => s.id === col.id);
    const nested = (snapFor(soi)?.subCommitments || [])
      .map(sub => sub.toSoiId)
      .filter(id => selectedIds.has(id))
      .map(id => fundLabel(store.soIs.find(s => s.id === id)));
    if (nested.length) doubleCounted.push({ fof: col.label, underlying: nested });
  }

  const grandTotal = _.sumBy(columns, 'total');
  const overlapRows = rows.filter(r => r.fundCount > 1);
  const overlapValue = _.sumBy(overlapRows, 'total');

  return {
    columns,
    rows,
    grandTotal,
    doubleCounted,
    overlapCount: overlapRows.length,
    overlapValue,
    overlapPct: grandTotal > 0 ? (overlapValue / grandTotal) * 100 : 0,
  };
};

export { getSelectedSOIs };
