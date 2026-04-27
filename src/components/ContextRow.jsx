import { useEffect, useMemo } from 'react';
import { Calendar, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

import { BORDER, PANEL_2, TEXT, TEXT_DIM, TEXT_MUTE, ACCENT, ACCENT_2, GOLD } from '../lib/theme';
import { distinctSnapshotDates, snapshotsOf } from '../lib/snapshots';

import { Breadcrumb } from './ui';

/**
 * Second row of the header: breadcrumb on the left, as-of-date + live-price
 * toggle + refresh button on the right. Shown under the TopNav.
 */
export function ContextRow({
  store,
  selection,
  drilldownSoi,
  asOfDate,
  clientShareMode,
  priceLoading,
  setSelection,
  setDrilldownSoi,
  setOpenMenu,
  setTab,
  setClientShareMode,
  setAsOfDate,
  updateStore,
  refreshPrices,
}) {
  // Scope-filtered SOI list — drives the saved-snapshots dropdown and the
  // prev/next arrows so navigation stays within the user's current context.
  const scopedSoIs = useMemo(() => {
    if (!selection) return store.soIs;
    if (selection.kind === 'firm') return store.soIs;
    if (selection.kind === 'client') {
      const ids = new Set(
        (store.commitments || []).filter((c) => c.clientId === selection.id).map((c) => c.soiId)
      );
      return store.soIs.filter((s) => ids.has(s.id));
    }
    if (selection.kind === 'manager') return store.soIs.filter((s) => s.managerId === selection.id);
    if (selection.kind === 'vintage') {
      return store.soIs.filter((s) => `${s.managerId}_${s.vintage}` === selection.id);
    }
    return store.soIs;
  }, [store.soIs, store.commitments, selection]);

  const savedDates = useMemo(() => distinctSnapshotDates(scopedSoIs), [scopedSoIs]);

  // Per-date SOI count for the dropdown labels — "Sep 30, 2025 · 5 funds".
  const savedDateCounts = useMemo(() => {
    const m = {};
    for (const soi of scopedSoIs) {
      for (const snap of snapshotsOf(soi)) {
        if (snap.asOfDate) m[snap.asOfDate] = (m[snap.asOfDate] || 0) + 1;
      }
    }
    return m;
  }, [scopedSoIs]);

  const currentIdx = savedDates.indexOf(asOfDate);
  const prevDate = currentIdx > 0 ? savedDates[currentIdx - 1] : null;
  const nextDate = currentIdx >= 0 && currentIdx < savedDates.length - 1 ? savedDates[currentIdx + 1] : null;
  // If asOfDate is between snapshots, jump to the most recent on-or-before.
  const fallbackPrev = useMemo(() => {
    if (currentIdx >= 0) return null;
    let best = null;
    for (const d of savedDates) {
      if (d <= asOfDate) best = d;
      else break;
    }
    return best;
  }, [savedDates, asOfDate, currentIdx]);
  const effectivePrev = prevDate ?? fallbackPrev;

  // Keyboard hotkeys [ ] to step through saved snapshots when input/textarea
  // isn't focused. Mirrors how the Time Slider behaves but always available.
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === '[' && effectivePrev) setAsOfDate(effectivePrev);
      if (e.key === ']' && nextDate) setAsOfDate(nextDate);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [effectivePrev, nextDate, setAsOfDate]);

  const prettyDate = (d) => new Date(d + 'T00:00:00Z').toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div
      className="max-w-[1600px] mx-auto px-6 py-2 flex items-center gap-3 flex-wrap"
      style={{ borderTop: `1px solid ${BORDER}` }}
    >
      <Breadcrumb
        store={store}
        selection={selection}
        drilldownSoi={drilldownSoi}
        onCrumb={(sel) => {
          setSelection(sel);
          setDrilldownSoi(null);
          setOpenMenu(null);
          setTab(sel.kind === 'manager' ? 'managers' : 'overview');
        }}
      />
      {selection.kind === 'client' && (
        <button
          onClick={() => setClientShareMode((m) => !m)}
          className="px-2.5 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors"
          style={{
            backgroundColor: clientShareMode ? ACCENT + '22' : 'transparent',
            color: clientShareMode ? ACCENT_2 : TEXT_DIM,
            border: `1px solid ${clientShareMode ? ACCENT + '44' : BORDER}`,
          }}
        >
          {clientShareMode ? '⊗ Client share' : '⊞ Full fund'}
        </button>
      )}

      <div className="flex-1" />

      {/* As-of-date with prev/next arrows + saved-snapshots dropdown */}
      <div className="flex items-center gap-1.5">
        <Calendar size={12} style={{ color: TEXT_MUTE }} />
        <span className="text-[10px] uppercase tracking-wider" style={{ color: TEXT_MUTE }}>As of</span>
        <button
          onClick={() => effectivePrev && setAsOfDate(effectivePrev)}
          disabled={!effectivePrev}
          title={effectivePrev ? `Previous saved snapshot (${effectivePrev}) · [` : 'No earlier saved snapshot'}
          className="p-1 rounded"
          style={{
            color: effectivePrev ? TEXT_DIM : TEXT_MUTE,
            border: `1px solid ${BORDER}`,
            backgroundColor: PANEL_2,
            opacity: effectivePrev ? 1 : 0.4,
            cursor: effectivePrev ? 'pointer' : 'not-allowed',
          }}
        >
          <ChevronLeft size={12} />
        </button>
        <input
          type="date"
          value={asOfDate}
          onChange={(e) => setAsOfDate(e.target.value)}
          className="text-xs rounded px-2 py-1 outline-none"
          style={{ backgroundColor: PANEL_2, border: `1px solid ${BORDER}`, color: TEXT, colorScheme: 'dark' }}
        />
        <button
          onClick={() => nextDate && setAsOfDate(nextDate)}
          disabled={!nextDate}
          title={nextDate ? `Next saved snapshot (${nextDate}) · ]` : 'No later saved snapshot'}
          className="p-1 rounded"
          style={{
            color: nextDate ? TEXT_DIM : TEXT_MUTE,
            border: `1px solid ${BORDER}`,
            backgroundColor: PANEL_2,
            opacity: nextDate ? 1 : 0.4,
            cursor: nextDate ? 'pointer' : 'not-allowed',
          }}
        >
          <ChevronRight size={12} />
        </button>
        {savedDates.length > 0 && (
          <select
            value={savedDates.includes(asOfDate) ? asOfDate : ''}
            onChange={(e) => e.target.value && setAsOfDate(e.target.value)}
            className="text-xs rounded px-2 py-1 outline-none"
            style={{ backgroundColor: GOLD + '11', border: `1px solid ${GOLD}44`, color: GOLD, colorScheme: 'dark' }}
            title="Jump to a saved snapshot"
          >
            <option value="" style={{ backgroundColor: PANEL_2, color: TEXT_DIM }}>
              {savedDates.includes(asOfDate) ? prettyDate(asOfDate) : 'Saved snapshots…'}
            </option>
            {savedDates.slice().reverse().map((d) => (
              <option key={d} value={d} style={{ backgroundColor: PANEL_2, color: TEXT }}>
                {prettyDate(d)} · {savedDateCounts[d]} {savedDateCounts[d] === 1 ? 'fund' : 'funds'}
              </option>
            ))}
          </select>
        )}
      </div>

      {store.settings.lastRefresh && (
        <div className="text-[10px]" style={{ color: TEXT_MUTE }}>
          {new Date(store.settings.lastRefresh).toLocaleTimeString()}
        </div>
      )}
      {/* Live prices toggle — OFF disables auto-fetch, preserves demo credits. */}
      <button
        onClick={() =>
          updateStore((st) => ({ ...st, settings: { ...st.settings, useLivePrices: !st.settings.useLivePrices } }))
        }
        className="px-2.5 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors"
        title={
          store.settings.useLivePrices
            ? 'Live CoinGecko prices ON — click to disable (saves API credits)'
            : 'Live CoinGecko prices OFF — click to enable (auto-fetches history)'
        }
        style={{
          backgroundColor: store.settings.useLivePrices ? ACCENT + '22' : 'transparent',
          color: store.settings.useLivePrices ? ACCENT_2 : TEXT_DIM,
          border: `1px solid ${store.settings.useLivePrices ? ACCENT + '44' : BORDER}`,
        }}
      >
        <span
          style={{
            width: 6, height: 6, borderRadius: 3,
            backgroundColor: store.settings.useLivePrices ? '#3ecf8e' : TEXT_MUTE,
          }}
        />
        Live: {store.settings.useLivePrices ? 'ON' : 'OFF'}
      </button>
      <button
        onClick={refreshPrices}
        disabled={priceLoading || !store.settings.useLivePrices}
        className="px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors"
        style={{
          border: `1px solid ${BORDER}`,
          color: TEXT,
          backgroundColor: PANEL_2,
          opacity: priceLoading || !store.settings.useLivePrices ? 0.4 : 1,
        }}
      >
        <RefreshCw size={12} className={priceLoading ? 'animate-spin' : ''} />
        {priceLoading ? 'Fetching…' : 'Refresh'}
      </button>
    </div>
  );
}
