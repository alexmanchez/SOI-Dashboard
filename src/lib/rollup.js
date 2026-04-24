import _ from 'lodash';
import { snapshotsOf, latestSnapshot, snapshotAsOf, sortedSnapshots, isLiquid } from './snapshots';
import { resolveSector, sectorOf, getSectors } from './sectors';

export const getSelectedSOIs = (store, selection) => {
  if (!selection || selection.kind === 'firm') return store.soIs;
  if (selection.kind === 'client') {
    const soiIds = new Set(store.commitments.filter(c => c.clientId === selection.id).map(c => c.soiId));
    return store.soIs.filter(s => soiIds.has(s.id));
  }
  if (selection.kind === 'manager') return store.soIs.filter(s => s.managerId === selection.id);
  if (selection.kind === 'vintage') return store.soIs.filter(s => s.id === selection.id);
  return [];
};

export const computeRollup = (store, selection, livePrices, scaleBy = null, asOfDate = null) => {
  const soIs = getSelectedSOIs(store, selection);
  const managerById = Object.fromEntries(store.managers.map(m => [m.id, m]));
  const snapFor = (soi) => snapshotAsOf(soi, asOfDate);

  // Per-position enrichment
  const enriched = [];
  let fofLookThroughCount = 0;

  const enrichPosition = (p, opts) => {
    const { sectorId, liquid, managerId, managerName, vintage, soiId, scale } = opts;
    const live = p.cgTokenId && livePrices[p.cgTokenId];
    const useLive = !!live && (liquid || p.forceLiquid);
    const currentValue = useLive && p.quantity ? p.quantity * live.usd : p.soiMarketValue;
    const change24h = useLive ? (live.change24h ?? null) : null;
    enriched.push({
      ...p,
      sectorId, liquid, managerId, managerName, vintage, soiId,
      soiMarketValue: (p.soiMarketValue || 0) * scale,
      currentValue: currentValue * scale,
      change24h, hasLivePrice: useLive,
      livePrice: useLive ? live.usd : null,
      _scale: scale,
    });
  };

  for (const soi of soIs) {
    const manager = managerById[soi.managerId];
    const isFoF = manager?.type === 'fund_of_funds';

    // FoF look-through: only in client scope
    if (isFoF && selection.kind === 'client') {
      const clientCommitment = store.commitments.find(c => c.clientId === selection.id && c.soiId === soi.id);
      if (!clientCommitment) continue;
      const subCommitments = snapFor(soi)?.subCommitments || [];
      const fofTotalCalled = _.sumBy(subCommitments, s => s.called || 0);
      if (!subCommitments.length || fofTotalCalled <= 0) continue;

      const clientCalled = clientCommitment.called || 0;
      const clientShare = clientCalled / fofTotalCalled;
      fofLookThroughCount++;

      for (const sub of subCommitments) {
        const targetSoi = store.soIs.find(s => s.id === sub.toSoiId);
        if (!targetSoi) continue;
        const targetManager = managerById[targetSoi.managerId];
        if (targetManager?.type === 'fund_of_funds') {
          console.warn('Catena: nested FoF beyond 1 level — skipping', sub.toSoiId);
          continue;
        }
        const underlyingPositions = snapFor(targetSoi)?.positions || [];
        const underlyingMV = _.sumBy(underlyingPositions, p => p.soiMarketValue || 0);
        if (underlyingMV <= 0) continue;
        const fofShare = (sub.called || 0) / underlyingMV;
        const scale = clientShare * fofShare;

        for (const p of underlyingPositions) {
          const sectorId = resolveSector(p, store.sectorOverrides);
          const liquid = isLiquid(p);
          enrichPosition(p, {
            sectorId, liquid,
            managerId: soi.managerId,
            managerName: `${manager?.name || 'Unknown'} → ${targetManager?.name || '?'}`,
            vintage: `${soi.vintage} → ${targetSoi.vintage}`,
            soiId: soi.id,
            scale,
            fromFoF: true,
            fofManagerName: manager?.name || 'FoF',
          });
        }
      }
      continue; // done with this FoF SOI
    }

    // Direct SOI (existing logic)
    const scale = scaleBy ? (scaleBy(soi) ?? 1) : 1;
    for (const p of (snapFor(soi)?.positions || [])) {
      const sectorId = resolveSector(p, store.sectorOverrides);
      const liquid = isLiquid(p);
      enrichPosition(p, {
        sectorId, liquid,
        managerId: soi.managerId,
        managerName: manager?.name || 'Unknown',
        vintage: soi.vintage,
        soiId: soi.id,
        scale,
      });
    }
  }

  const totalNAV = _.sumBy(enriched, 'currentValue');
  const soiNAV   = _.sumBy(enriched, 'soiMarketValue');
  const liquidNAV = _.sumBy(enriched.filter(p => p.liquid), 'currentValue');
  const illiquidNAV = _.sumBy(enriched.filter(p => !p.liquid), 'currentValue');

  // Sector breakdown
  const bySector = _.groupBy(enriched, 'sectorId');
  const sectorBreakdown = Object.entries(bySector).map(([sid, items]) => {
    const s = sectorOf(sid);
    const value = _.sumBy(items, 'currentValue');
    return {
      id: sid,
      label: s.label,
      color: s.color,
      value,
      pct: totalNAV > 0 ? (value / totalNAV) * 100 : 0,
      count: items.length,
    };
  });
  // Ensure all 5 GICS buckets appear even if 0
  for (const s of getSectors()) {
    if (!sectorBreakdown.find(x => x.id === s.id)) {
      sectorBreakdown.push({ id: s.id, label: s.label, color: s.color, value: 0, pct: 0, count: 0 });
    }
  }
  const sectorOrder = [...getSectors().map(s=>s.id), 'unclassified'];
  sectorBreakdown.sort((a, b) => sectorOrder.indexOf(a.id) - sectorOrder.indexOf(b.id));

  // Token rollup — aggregate positions that share a ticker across managers
  const byToken = {};
  for (const p of enriched) {
    const key = (p.ticker && p.ticker.toUpperCase()) || p.positionName;
    if (!byToken[key]) {
      byToken[key] = {
        key,
        cgTokenId: p.cgTokenId || null,
        symbol: p.ticker || '',
        name: p.positionName,
        sectorId: p.sectorId,
        value: 0, soiValue: 0, quantity: 0, cost: 0,
        change24h: p.change24h, hasLivePrice: p.hasLivePrice, livePrice: p.livePrice,
        managers: new Set(),
        positions: [],
        liquid: p.liquid, forceLiquid: p.forceLiquid,
        throughFoF: false,
      };
    }
    if (!byToken[key].cgTokenId && p.cgTokenId) byToken[key].cgTokenId = p.cgTokenId;
    if (p.fromFoF) byToken[key].throughFoF = true;
    const t = byToken[key];
    t.value += p.currentValue || 0;
    t.soiValue += p.soiMarketValue || 0;
    t.quantity += p.quantity || 0;
    t.cost += p.costBasis || 0;
    t.managers.add(`${p.managerName} ${p.vintage}`);
    t.positions.push(p);
    if (p.hasLivePrice) { t.hasLivePrice = true; t.livePrice = p.livePrice; t.change24h = p.change24h; }
    if (p.liquid) t.liquid = true;
  }
  const tokenRollup = Object.values(byToken).map(t => ({
    ...t, managerCount: t.managers.size, managers: [...t.managers],
    pct: totalNAV > 0 ? (t.value / totalNAV) * 100 : 0,
  }));
  tokenRollup.sort((a, b) => b.value - a.value);

  // Concentration
  const sortedByVal = [...tokenRollup];
  const top10 = _.sumBy(sortedByVal.slice(0, 10), 'pct');
  const top25 = _.sumBy(sortedByVal.slice(0, 25), 'pct');

  // Manager breakdown
  const byManager = _.groupBy(enriched, 'soiId');
  const managerBreakdown = Object.entries(byManager).map(([soiId, items]) => {
    const soi = soIs.find(s => s.id === soiId);
    const manager = managerById[soi.managerId];
    const value = _.sumBy(items, 'currentValue');
    return {
      soiId, managerId: soi.managerId, managerName: manager?.name, vintage: soi.vintage,
      value, pct: totalNAV > 0 ? (value/totalNAV)*100 : 0,
      positionCount: items.length,
      asOfDate: snapFor(soi)?.asOfDate,
      _scale: items[0]?._scale ?? 1,
    };
  }).sort((a,b) => b.value - a.value);

  return {
    soIs, positions: enriched, tokenRollup, sectorBreakdown, managerBreakdown,
    totalNAV, soiNAV, liquidNAV, illiquidNAV,
    liquidPct: totalNAV > 0 ? (liquidNAV/totalNAV)*100 : 0,
    top10, top25,
    positionCount: enriched.length,
    managerCount: new Set(enriched.map(p=>p.managerId)).size,
    soiCount: soIs.length,
    fofLookThroughCount,
  };
};

export const buildNAVSeriesSimple = (positions, priceHistory, startMs, endMs) => {
  const dayMs = 86400000;
  const start = Math.floor(startMs / dayMs) * dayMs;
  const end = Math.floor(endMs / dayMs) * dayMs;

  // Pre-fill each token's daily price by forward-filling gaps
  const filledByToken = {};
  for (const p of positions) {
    if (!p.cgTokenId || !p.liquid) continue;
    if (filledByToken[p.cgTokenId]) continue;
    const byDay = priceHistory[p.cgTokenId];
    if (!byDay) continue;
    const filled = {};
    let last = null;
    for (let d = start; d <= end; d += dayMs) {
      if (byDay[d] !== undefined) last = byDay[d];
      filled[d] = last;
    }
    filledByToken[p.cgTokenId] = filled;
  }

  const series = [];
  for (let d = start; d <= end; d += dayMs) {
    let total = 0;
    for (const p of positions) {
      // Respect acquisition date — don't count position before it was held
      const acqMs = p.acquisitionDate ? new Date(p.acquisitionDate).getTime() : null;
      const acqDay = acqMs ? Math.floor(acqMs / dayMs) * dayMs : null;
      if (acqDay && d < acqDay) continue;

      if (p.liquid && p.cgTokenId && p.quantity) {
        const filled = filledByToken[p.cgTokenId];
        const price = filled?.[d];
        if (price != null) total += p.quantity * price;
        else total += p.soiMarketValue; // fallback to mark
      } else {
        // Illiquid or unpriced — held at SOI marked value
        total += p.soiMarketValue;
      }
    }
    series.push({ date: d, value: total });
  }
  return series;
};

export const buildNAVSeries = (soiBundles, priceHistory, startMs, endMs, scaleFn = null) => {
  const dayMs = 86400000;
  const start = Math.floor(startMs / dayMs) * dayMs;
  const end   = Math.floor(endMs   / dayMs) * dayMs;

  // Collect snapshot boundary dates
  let earliestSnapshotMs = Infinity, latestSnapshotMs = -Infinity;
  const snapshotDateSet = new Set();
  for (const bundle of soiBundles) {
    for (const snap of snapshotsOf(bundle)) {
      if (!snap.asOfDate) continue;
      const ms = new Date(snap.asOfDate + 'T00:00:00Z').getTime();
      if (isNaN(ms)) continue;
      if (ms < earliestSnapshotMs) earliestSnapshotMs = ms;
      if (ms > latestSnapshotMs)   latestSnapshotMs   = ms;
      snapshotDateSet.add(ms);
    }
  }
  if (earliestSnapshotMs === Infinity)  earliestSnapshotMs = null;
  if (latestSnapshotMs   === -Infinity) latestSnapshotMs   = null;

  // Pre-fill price history for all tokens used in any snapshot
  const filledByToken = {};
  for (const bundle of soiBundles) {
    for (const snap of snapshotsOf(bundle)) {
      for (const p of (snap.positions || [])) {
        if (!p.cgTokenId || !isLiquid(p) || filledByToken[p.cgTokenId]) continue;
        const byDay = priceHistory[p.cgTokenId];
        if (!byDay) continue;
        const filled = {}; let last = null;
        for (let d = start; d <= end; d += dayMs) {
          if (byDay[d] !== undefined) last = byDay[d];
          filled[d] = last;
        }
        filledByToken[p.cgTokenId] = filled;
      }
    }
  }

  const series = [];
  for (let d = start; d <= end; d += dayMs) {
    const dStr = new Date(d).toISOString().slice(0, 10);
    let total = 0;
    for (const bundle of soiBundles) {
      const scale = scaleFn ? (scaleFn(bundle) ?? 1) : 1;
      const snaps = sortedSnapshots(bundle);
      if (!snaps.length) continue;
      // pick latest snapshot whose asOfDate <= dStr
      let bestSnap = snaps[0];
      for (const snap of snaps) {
        if ((snap.asOfDate || '') <= dStr) bestSnap = snap;
        else break;
      }
      let bundleTotal = 0;
      for (const p of (bestSnap.positions || [])) {
        const acqMs  = p.acquisitionDate ? new Date(p.acquisitionDate).getTime() : null;
        const acqDay = acqMs ? Math.floor(acqMs / dayMs) * dayMs : null;
        if (acqDay && d < acqDay) continue;
        if (isLiquid(p) && p.cgTokenId && p.quantity) {
          const price = filledByToken[p.cgTokenId]?.[d];
          bundleTotal += price != null ? p.quantity * price : p.soiMarketValue;
        } else {
          bundleTotal += p.soiMarketValue || 0;
        }
      }
      total += bundleTotal * scale;
    }
    series.push({ date: d, value: total });
  }

  return {
    series,
    earliestSnapshotMs,
    latestSnapshotMs,
    snapshotDates: [...snapshotDateSet].sort((a, b) => a - b),
  };
};
