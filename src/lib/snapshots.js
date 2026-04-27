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

/* Distinct snapshot dates across a list of SOIs, sorted ascending. */
export const distinctSnapshotDates = (soIs) => {
  const set = new Set();
  for (const soi of soIs || []) {
    for (const snap of snapshotsOf(soi)) {
      if (snap.asOfDate) set.add(snap.asOfDate);
    }
  }
  return [...set].sort();
};

/* Earliest snapshot date across this SOI (or null). Used to decide when a
   manager "didn't yet exist" at a given time-travel slider position. */
export const earliestSnapshotDate = (soi) => {
  const snaps = sortedSnapshots(soi);
  const first = snaps.find((s) => s.asOfDate);
  return first ? first.asOfDate : null;
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

// ----------------------------------------------------------------------------
// Snapshot lifecycle helpers (Task 1)
// ----------------------------------------------------------------------------

const newSnapshotId = () => 's_' + Math.random().toString(36).slice(2, 10);
const deepCopySnapshotData = (x) => JSON.parse(JSON.stringify(x ?? null));

/* Build a new draft snapshot by deep-copying positions and subCommitments
   from `baseSnapshotId`. Pure — does not mutate `soi`. Returns the new
   snapshot; caller appends it to soi.snapshots via updateStore.
   Throws if `newAsOfDate` already exists on this SOI. */
export const cloneSnapshot = (soi, baseSnapshotId, newAsOfDate) => {
  const snaps = snapshotsOf(soi);
  if (snaps.some((s) => (s.asOfDate || '') === newAsOfDate)) {
    throw new Error(`Snapshot for ${newAsOfDate} already exists on this SOI`);
  }
  const base = snaps.find((s) => s.id === baseSnapshotId);
  if (!base) throw new Error(`Base snapshot ${baseSnapshotId} not found`);
  return {
    id: newSnapshotId(),
    asOfDate: newAsOfDate,
    notes: '',
    positions: deepCopySnapshotData(base.positions || []),
    subCommitments: deepCopySnapshotData(base.subCommitments || []),
    status: 'draft',
  };
};

/* Return a new snapshots array with the target's status flipped to
   'finalized', sorted ascending by asOfDate. Idempotent. */
export const finalizeSnapshot = (soi, snapshotId) =>
  snapshotsOf(soi)
    .map((s) => (s.id === snapshotId ? { ...s, status: 'finalized' } : s))
    .sort((a, b) => ((a.asOfDate || '') < (b.asOfDate || '') ? -1 : 1));
