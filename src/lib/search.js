import { latestSnapshot } from './snapshots';

/**
 * Compute grouped global-search results (portfolios / managers / tokens).
 * Returns `null` for an empty query so callers can hide the dropdown.
 * Used by the header SearchBox; pure function of (query, store).
 */
export function computeSearchResults(rawQuery, store) {
  const q = (rawQuery || '').trim().toLowerCase();
  if (!q) return null;

  const clients = store.clients
    .filter((c) => (c.name || '').toLowerCase().includes(q))
    .slice(0, 6);

  const managers = store.managers
    .filter(
      (m) =>
        (m.name || '').toLowerCase().includes(q) ||
        (m.firm || '').toLowerCase().includes(q)
    )
    .slice(0, 6);

  const byToken = {};
  for (const soi of store.soIs) {
    const snap = latestSnapshot(soi);
    if (!snap) continue;
    const mgr = store.managers.find((m) => m.id === soi.managerId);
    for (const p of snap.positions || []) {
      const name = (p.positionName || '').toLowerCase();
      const ticker = (p.ticker || '').toLowerCase();
      if (!(name.includes(q) || ticker.includes(q))) continue;
      const key = (p.ticker || p.positionName || '').toUpperCase();
      if (!byToken[key]) {
        byToken[key] = {
          key,
          ticker: p.ticker || '',
          name: p.positionName || '',
          cgTokenId: p.cgTokenId || null,
          exposures: [],
        };
      }
      if (!byToken[key].cgTokenId && p.cgTokenId) byToken[key].cgTokenId = p.cgTokenId;
      byToken[key].exposures.push({ position: p, soi, manager: mgr });
    }
  }

  const positions = Object.values(byToken).slice(0, 8);
  return { clients, managers, positions };
}
