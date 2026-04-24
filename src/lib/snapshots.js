// Helpers over the soi.snapshots[] array.
export const snapshotsOf = (soi) => {
  if (Array.isArray(soi.snapshots) && soi.snapshots.length) return soi.snapshots;
  return [{
    id: soi.id + '_snap',
    asOfDate: soi.asOfDate || '',
    notes: soi.notes || '',
    positions: soi.positions || [],
  }];
};

export const latestSnapshot = (soi) => {
  const snaps = snapshotsOf(soi);
  return snaps.reduce(
    (best, s) => (!best || (s.asOfDate || '') > (best.asOfDate || '') ? s : best),
    null
  );
};

export const sortedSnapshots = (soi) =>
  [...snapshotsOf(soi)].sort((a, b) => ((a.asOfDate || '') < (b.asOfDate || '') ? -1 : 1));

/* Pick the most recent snapshot on or before `dateStr` (YYYY-MM-DD).
   Falls back to latestSnapshot(soi) if dateStr is falsy or every snapshot
   is after it. */
export const snapshotAsOf = (soi, dateStr) => {
  if (!dateStr) return latestSnapshot(soi);
  const snaps = sortedSnapshots(soi);
  let best = null;
  for (const s of snaps) {
    if ((s.asOfDate || '') <= dateStr) best = s;
    else break;
  }
  return best || latestSnapshot(soi);
};

// Tri-state liquidity check: override > forceLiquid bool > asset type > default.
export const isLiquid = (position) => {
  if (position.liquidityOverride === 'liquid') return true;
  if (position.liquidityOverride === 'illiquid') return false;
  if (position.forceLiquid) return true;
  if (position.assetType === 'SAFT' || position.assetType === 'Warrant' || position.assetType === 'SAFE') return false;
  return !!(position.ticker && position.quantity > 0);
};

export const liquidityOverrideOf = (position) => {
  if (position.liquidityOverride) return position.liquidityOverride;
  if (position.forceLiquid) return 'liquid';
  return 'auto';
};
