import { Calendar, RefreshCw } from 'lucide-react';

import { BORDER, PANEL_2, TEXT, TEXT_DIM, TEXT_MUTE, ACCENT, ACCENT_2 } from '../lib/theme';

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

      {/* As-of-date */}
      <div className="flex items-center gap-1.5">
        <Calendar size={12} style={{ color: TEXT_MUTE }} />
        <span className="text-[10px] uppercase tracking-wider" style={{ color: TEXT_MUTE }}>As of</span>
        <input
          type="date"
          value={asOfDate}
          onChange={(e) => setAsOfDate(e.target.value)}
          className="text-xs rounded px-2 py-1 outline-none"
          style={{ backgroundColor: PANEL_2, border: `1px solid ${BORDER}`, color: TEXT, colorScheme: 'dark' }}
        />
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
