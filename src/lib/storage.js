import _ from 'lodash';
import { DEFAULT_SECTORS } from './sectors';
import { snapshotsOf, latestSnapshot } from './snapshots';

// v5: 11-sector taxonomy. Bump this constant if the data model changes enough
// to require a re-seed.
export const STORE_KEY = 'catena.store.v5';

export const emptyStore = () => ({
  clients: [],
  managers: [],
  soIs: [],
  commitments: [],
  sectorOverrides: {},
  sectors: DEFAULT_SECTORS,
  settings: { cgApiKey: '', useLivePrices: false, lastRefresh: null },
});

export const loadStore = () => {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.clients || !parsed.managers || !parsed.soIs || !parsed.commitments) return null;
    if (!Array.isArray(parsed.sectors) || parsed.sectors.length === 0) parsed.sectors = DEFAULT_SECTORS;
    // Wrap legacy flat positions into a single snapshot.
    for (const soi of parsed.soIs) {
      if (!Array.isArray(soi.snapshots) || soi.snapshots.length === 0) {
        soi.snapshots = [{
          id: soi.id + '_snap',
          asOfDate: soi.asOfDate || '',
          notes: soi.notes || '',
          positions: soi.positions || [],
        }];
        delete soi.positions;
        delete soi.asOfDate;
      }
    }
    // Reset legacy called values that were set to fund total MV.
    for (const c of parsed.commitments) {
      const soi = parsed.soIs.find((s) => s.id === c.soiId);
      if (!soi) continue;
      const fundTotalMV = _.sumBy(latestSnapshot(soi)?.positions || [], (p) => p.soiMarketValue || 0);
      if (fundTotalMV > 0 && c.called > 0 && Math.abs(c.called - fundTotalMV) / fundTotalMV < 0.01) {
        c.called = Math.round((c.committed || 0) * 0.7);
      }
    }
    // Backfill commitment asOfDate — pre-Task-2 commitments are baseline-dated
    // to the SOI's earliest snapshot so commitmentAsOf returns them for any
    // time-travel position at or after that date.
    for (const c of parsed.commitments) {
      if (c.asOfDate) continue;
      const soi = parsed.soIs.find((s) => s.id === c.soiId);
      const snaps = soi ? snapshotsOf(soi) : [];
      const earliest = snaps.find((s) => s.asOfDate);
      c.asOfDate = earliest ? earliest.asOfDate : '';
    }
    for (const m of parsed.managers) {
      if (!m.type) m.type = 'direct';
    }
    for (const soi of parsed.soIs) {
      for (const snap of snapshotsOf(soi)) {
        if (!Array.isArray(snap.subCommitments)) snap.subCommitments = [];
      }
    }
    // Backfill snapshot status — pre-Task-1 snapshots are all finalized.
    for (const soi of parsed.soIs) {
      for (const snap of snapshotsOf(soi)) {
        if (!snap.status) snap.status = 'finalized';
      }
    }
    // Pre-v5 sectors missing 'base-layer' -> drop in DEFAULT_SECTORS.
    const hasV5Sectors =
      Array.isArray(parsed.sectors) && parsed.sectors.some((s) => s && s.id === 'base-layer');
    if (!hasV5Sectors) parsed.sectors = DEFAULT_SECTORS;
    return {
      ...emptyStore(),
      ...parsed,
      settings: { ...emptyStore().settings, ...(parsed.settings || {}) },
    };
  } catch {
    return null;
  }
};

export const saveStore = (store) => {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    /* quota / disabled */
  }
};
