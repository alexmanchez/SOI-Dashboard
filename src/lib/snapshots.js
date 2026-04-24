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
