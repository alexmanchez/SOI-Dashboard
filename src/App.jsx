import {
  useState, useMemo, useCallback, useEffect,
} from 'react';
import catenaLogo from './assets/catena-logo.png';
import _ from 'lodash';
import {
  Settings, DollarSign,
} from 'lucide-react';
import {
  BG, PANEL, BORDER, TEXT, TEXT_DIM, TEXT_MUTE,
} from './lib/theme';
import {
  fundLabel,
} from './lib/format';
import {
  DEFAULT_SECTORS, setSectors,
} from './lib/sectors';
import {
  loadStore, saveStore,
} from './lib/storage';
import { seedStore } from './lib/seed';
import {
  latestSnapshot, distinctSnapshotDates,
} from './lib/snapshots';
import { computeSearchResults } from './lib/search';
import {
  computeRollup,
} from './lib/rollup';
import {
  resolveApiKey, fetchLivePrices, fetchHistory,
} from './lib/api/coingecko';
import {
  loadTokenImagesCache, saveTokenImagesCache, fetchTokenImagesMap,
} from './lib/api/cryptorank';
import {
  loadCmcIdCache, saveCmcIdCache, fetchCmcIdMap,
} from './lib/api/coinmarketcap';
import {
  TokenImageContext, OpenTokenDetailContext,
} from './contexts';

import {
  PlaceholderPage,
} from './components/ui';
import {
  TokenDetailDrawer,
} from './components/TokenDetailDrawer';
import {
  LeftSidebar, FUND_SUB_TABS,
} from './components/LeftSidebar';
import { TopNav } from './components/TopNav';
import { SearchBox } from './components/SearchBox';
import { ContextRow } from './components/ContextRow';
import { ScopeHeader } from './components/ScopeHeader';
import { TimeSlider } from './components/TimeSlider';

import {
  OverviewTab,
} from './pages/OverviewTab';
import { ExposuresPage } from './pages/ExposuresPage';
import { FundEconomicsPage } from './pages/FundEconomicsPage';
import { ManagersTab } from './pages/ManagersTab';
import { PositionsTab } from './pages/PositionsTab';
import { SOIDetail } from './pages/SOIDetail';
import { SettingsDrawer } from './pages/SettingsDrawer';
import { SnapshotEditor } from './pages/SnapshotEditor';
import { ManagerRoundsPage } from './pages/ManagerRoundsPage';
import { ImportWizard } from './import/ImportWizard';

export default function App() {
  const [store, setStore] = useState(() => {
    const loaded = loadStore();
    if (loaded && (loaded.soIs.length || loaded.clients.length)) return loaded;
    return seedStore();
  });
  // Sync lib/sectors module-level ref to the live store list. If stored
  // sectors lack the v5 'base-layer' bucket (e.g. HMR preserved an older
  // store in memory), force-use DEFAULT_SECTORS so breakdown labels and
  // colors reflect the current taxonomy regardless of persisted state.
  //
  // The effect keys on store.sectors and only mutates the module-local ref,
  // so it does not cause a re-render loop. Children read sectors via
  // getSectors()/sectorOf(); on first render after a mutation they see the
  // new ref because useEffect runs synchronously after commit.
  useEffect(() => {
    const valid =
      store.sectors && store.sectors.length &&
      store.sectors.some((sec) => sec && sec.id === 'base-layer');
    setSectors(valid ? store.sectors : DEFAULT_SECTORS);
  }, [store.sectors]);
  useEffect(() => { saveStore(store); }, [store]);

  // Top-level navigation: selection + tab
  const [selection, setSelection] = useState(() => {
    // Start scoped to the first client if one exists (most useful default)
    const loaded = loadStore() || seedStore();
    if (loaded.clients.length === 1) return { kind: 'client', id: loaded.clients[0].id };
    if (loaded.clients.length > 1)   return { kind: 'firm' };
    return { kind: 'firm' };
  });
  const [tab, setTab] = useState('overview'); // overview | managers | positions | settings
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [searchQuery, setSearchQuery] = useState('');
  const [openMenu, setOpenMenu] = useState(null); // 'portfolios' | 'managers' | 'create' | null
  const [flyoutManagerId, setFlyoutManagerId] = useState(null); // which manager's vintage flyout is open
  const [flyoutSoiId, setFlyoutSoiId] = useState(null);         // which FoF SOI's underlying-commitments flyout is open
  const [subPage, setSubPage] = useState('dashboard'); // dashboard | positions | exposures | fund-economics
  const [detailToken, setDetailToken] = useState(null);
  // Roll-forward snapshot editor — when set, renders a fullscreen overlay.
  const [snapshotEditorSoi, setSnapshotEditorSoi] = useState(null);

  /* Drawer-via-URL: if the user lands on #/token/:id (or navigates with back/
     forward), open the drawer pre-loaded to that token. The drawer itself
     writes the hash when the user expands it, so a shared URL round-trips. */
  useEffect(() => {
    const applyHash = () => {
      const m = window.location.hash.match(/^#\/token\/([^/?]+)/);
      if (m) {
        const cgTokenId = decodeURIComponent(m[1]);
        setDetailToken((t) => (t && t.cgTokenId === cgTokenId ? t : { cgTokenId, symbol: '', name: cgTokenId }));
      }
    };
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, []);

  /* Token image caches: CryptoRank (fallback source) + CoinMarketCap
     (primary source, higher-quality logos). Both fetched once per browser
     and persisted in localStorage. */
  const [crMap, setCrMap] = useState(() => loadTokenImagesCache() || {});
  const [cmcIdMap, setCmcIdMap] = useState(() => loadCmcIdCache() || {});
  useEffect(() => {
    let cancelled = false;
    if (Object.keys(crMap).length === 0) {
      (async () => {
        const m = await fetchTokenImagesMap();
        if (!cancelled && m) { setCrMap(m); saveTokenImagesCache(m); }
      })();
    }
    if (Object.keys(cmcIdMap).length === 0) {
      (async () => {
        const m = await fetchCmcIdMap();
        if (!cancelled && m) { setCmcIdMap(m); saveCmcIdCache(m); }
      })();
    }
    return () => { cancelled = true; };
  }, []);
  const tokenImagesCtx = useMemo(() => ({ crMap, cmcIdMap }), [crMap, cmcIdMap]);

  const searchResults = useMemo(() => computeSearchResults(searchQuery, store), [searchQuery, store]);
  const [drilldownSoi, setDrilldownSoi] = useState(null); // when viewing a single SOI in depth

  // Fund Economics is client-scoped. Snap it back to 'dashboard' if the user
  // navigates into a manager/vintage view — done via setState-during-render
  // (React's blessed pattern for resetting state when deps change) instead
  // of a useEffect, which would lag one render and trip set-state-in-effect.
  const [_lastScopeKey, _setLastScopeKey] = useState(null);
  const _scopeKey = `${selection.kind}:${selection.id || ''}:${drilldownSoi || ''}`;
  if (_scopeKey !== _lastScopeKey) {
    _setLastScopeKey(_scopeKey);
    const onMgrOrVint =
      selection.kind === 'manager' || selection.kind === 'vintage' || !!drilldownSoi;
    if (onMgrOrVint && subPage === 'fund-economics') setSubPage('dashboard');
  }
  const [range, setRange] = useState('SI');

  // Live prices (in-memory only; re-fetch on demand)
  const [livePrices, setLivePrices] = useState({});
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceError, setPriceError] = useState(null);

  // Historical prices — keyed by cgTokenId → { [utcDayMs]: close }
  // Stored by (tokenId, maxDaysFetched) so we don't re-fetch if we already have enough
  const [priceHistory, setPriceHistory] = useState({});
  const [historyFetched, setHistoryFetched] = useState({}); // { [tokenId]: daysFetched }
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyProgress, setHistoryProgress] = useState({ current: 0, total: 0, token: '' });

  // Client share mode — scales NAV figures to client's pro-rata called capital fraction
  const [clientShareMode, setClientShareMode] = useState(true);

  // Import wizard state
  const [importOpen, setImportOpen] = useState(false);

  // Settings drawer
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Update helpers
  const updateStore = useCallback((mutator) => {
    setStore(prev => {
      const next = typeof mutator === 'function' ? mutator(prev) : mutator;
      return next;
    });
  }, []);

  // Collect all coingecko ids across store for refresh
  const allCgIds = useMemo(() => {
    const ids = new Set();
    for (const soi of store.soIs) for (const p of (latestSnapshot(soi)?.positions || [])) if (p.cgTokenId) ids.add(p.cgTokenId);
    return [...ids];
  }, [store.soIs]);

  const effectiveApiKey = resolveApiKey(store.settings.cgApiKey);

  const refreshPrices = useCallback(async () => {
    if (!store.settings.useLivePrices) {
      setPriceError('Live prices are OFF. Toggle "Live: ON" in the header to enable CoinGecko fetches.');
      return;
    }
    if (!effectiveApiKey) {
      setPriceError('CoinGecko API key not configured. Set VITE_COINGECKO_API_KEY at build time or paste a key in Settings.');
      return;
    }
    setPriceLoading(true); setPriceError(null);
    const { prices, error } = await fetchLivePrices(allCgIds, effectiveApiKey);
    setLivePrices(prices);
    if (error) setPriceError(error);
    updateStore(s => ({ ...s, settings: { ...s.settings, lastRefresh: new Date().toISOString() } }));
    setPriceLoading(false);
  }, [allCgIds, effectiveApiKey, updateStore]);

  // Fetch historical price data for the given scope + days window.
  // Skips tokens we already have sufficient history for.
  const fetchHistoryFor = useCallback(async (tokenIds, daysNeeded) => {
    if (!store.settings.useLivePrices) return; // silent skip: chart shows existing cached data
    if (!effectiveApiKey) {
      setPriceError('CoinGecko API key not configured. Set VITE_COINGECKO_API_KEY at build time or paste a key in Settings.');
      return;
    }
    const cappedDays = Math.min(daysNeeded, 365);  // CoinGecko Demo limit
    const ids = _.uniq(tokenIds).filter(Boolean);
    const missing = ids.filter(id => (historyFetched[id] || 0) < cappedDays);
    if (!missing.length) return;

    setHistoryLoading(true); setPriceError(null);
    setHistoryProgress({ current: 0, total: missing.length, token: '' });
    const { history, error } = await fetchHistory(
      missing, cappedDays, effectiveApiKey,
      (current, total, token) => setHistoryProgress({ current, total, token })
    );
    if (error) setPriceError(error);
    setPriceHistory(prev => {
      const merged = { ...prev };
      for (const [id, byDay] of Object.entries(history)) {
        merged[id] = { ...(merged[id] || {}), ...byDay };
      }
      return merged;
    });
    setHistoryFetched(prev => {
      const next = { ...prev };
      for (const id of missing) next[id] = Math.max(next[id] || 0, cappedDays);
      return next;
    });
    setHistoryLoading(false);
    setHistoryProgress({ current: 0, total: 0, token: '' });
  }, [effectiveApiKey, historyFetched]);

  // Pro-rata scale factor per SOI (client called / fund total MV)
  const scaleBy = useMemo(() => {
    if (selection.kind !== 'client' || !clientShareMode) return null;
    return (soi) => {
      const commitment = store.commitments.find(c => c.clientId === selection.id && c.soiId === soi.id);
      if (!commitment) return 1;
      const fundTotalCalled = _.sumBy(latestSnapshot(soi)?.positions || [], p => p.soiMarketValue || 0);
      if (fundTotalCalled <= 0) return 1;
      return (commitment.called || 0) / fundTotalCalled;
    };
  }, [selection, store.commitments, store.soIs, clientShareMode]);

  // Rollup for current selection
  const rollup = useMemo(
    () => computeRollup(store, selection, livePrices, scaleBy, asOfDate),
    [store, selection, livePrices, scaleBy, asOfDate]
  );

  // Distinct snapshot dates across the current scope — feeds the global TimeSlider.
  const snapshotDates = useMemo(() => distinctSnapshotDates(rollup.soIs), [rollup.soIs]);

  // Selection label
  const selectionLabel = useMemo(() => {
    if (selection.kind === 'firm') return 'All Clients';
    if (selection.kind === 'client') return store.clients.find(c => c.id === selection.id)?.name || 'Unknown client';
    if (selection.kind === 'manager') return store.managers.find(m => m.id === selection.id)?.name || 'Unknown manager';
    if (selection.kind === 'vintage') {
      const soi = store.soIs.find(s => s.id === selection.id);
      const mgr = store.managers.find(m => m.id === soi?.managerId);
      return `${mgr?.name || '?'} ${fundLabel(soi) || ''}`.trim();
    }
    return '';
  }, [selection, store]);

  const containerStyle = { minHeight: '100vh', backgroundColor: BG, color: TEXT, fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' };

  return (
    <TokenImageContext.Provider value={tokenImagesCtx}><OpenTokenDetailContext.Provider value={setDetailToken}>
    <div style={containerStyle}>
      {/* ========= TOP NAV ROW ========= */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, backgroundColor: PANEL, position: 'relative' }}>
        <div className="max-w-[1600px] mx-auto px-6 py-2.5 flex items-center gap-4">
          {/* Brand */}
          <div className="flex items-center gap-2">
            <img src={catenaLogo} alt="Catena"
                 className="flex-shrink-0"
                 style={{ width: 36, height: 36, objectFit: 'contain' }} />
            <div>
              <div className="text-sm font-semibold tracking-tight">Catena</div>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: TEXT_MUTE }}>Portfolio Exposure</div>
            </div>
          </div>

          <TopNav
            store={store}
            selection={selection}
            tab={tab}
            openMenu={openMenu}
            flyoutManagerId={flyoutManagerId}
            flyoutSoiId={flyoutSoiId}
            setSelection={setSelection}
            setTab={setTab}
            setDrilldownSoi={setDrilldownSoi}
            setSubPage={setSubPage}
            setOpenMenu={setOpenMenu}
            setFlyoutManagerId={setFlyoutManagerId}
            setFlyoutSoiId={setFlyoutSoiId}
            onCreatePortfolio={() => setSettingsOpen(true)}
            onCreateManager={() => setSettingsOpen(true)}
            onImport={() => setImportOpen(true)}
          />

          <div className="flex-1" />

          <SearchBox
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchResults={searchResults}
            store={store}
            onOpenClient={(c) => {
              setSearchQuery(""); setSelection({kind:"client", id:c.id}); setTab("overview"); setDrilldownSoi(null); setOpenMenu(null);
            }}
            onOpenManager={(_m, mSois) => {
              setSearchQuery(""); setTab("managers"); setDrilldownSoi(mSois[0]?.id || null); setOpenMenu(null);
            }}
            onOpenToken={(t) => {
              setSearchQuery(""); setOpenMenu(null);
              setDetailToken({ cgTokenId: t.cgTokenId, symbol: t.ticker, name: t.name });
            }}
          />

          {/* Settings gear */}
          <button onClick={() => setSettingsOpen(true)}
            className="p-1.5 rounded" style={{ color: TEXT_DIM }}>
            <Settings size={16} />
          </button>
        </div>

        {/* ========= CONTEXT ROW ========= */}
        <ContextRow
          store={store}
          selection={selection}
          drilldownSoi={drilldownSoi}
          asOfDate={asOfDate}
          clientShareMode={clientShareMode}
          priceLoading={priceLoading}
          setSelection={setSelection}
          setDrilldownSoi={setDrilldownSoi}
          setOpenMenu={setOpenMenu}
          setTab={setTab}
          setClientShareMode={setClientShareMode}
          setAsOfDate={setAsOfDate}
          updateStore={updateStore}
          refreshPrices={refreshPrices}
        />

        {/* Click-off overlay for any open dropdown menu or active search. */}
        {(openMenu || searchResults) && (
          <div onClick={() => { setOpenMenu(null); setFlyoutManagerId(null); setFlyoutSoiId(null); setSearchQuery(''); }}
            style={{ position: 'fixed', inset: 0, zIndex: 41 }} />
        )}
      </div>

      {/* ========= MAIN ========= */}
      {(() => {
        // Sidebar layout is now used for anything that's not the bare "all managers
        // grid" landing. That grid keeps its full-width layout because it's a
        // directory, not a detail page.
        const isManagersGrid = tab === 'managers' && !drilldownSoi && selection.kind !== 'manager' && selection.kind !== 'vintage';
        const useSidebarLayout = !isManagersGrid && rollup.positionCount > 0;
        const onManagerOrVintage = selection.kind === 'manager' || selection.kind === 'vintage' || !!drilldownSoi;
        const HeaderBlock = (
          <ScopeHeader
            selection={selection}
            selectionLabel={selectionLabel}
            rollup={rollup}
            clientShareMode={clientShareMode}
            priceError={priceError}
            onRenameClient={(nextName) => updateStore(st => ({
              ...st,
              clients: st.clients.map(c => c.id === selection.id ? { ...c, name: nextName } : c),
            }))}
            onImport={() => setImportOpen(true)}
          />
        );

        const ContentForOverview = (
          <>
            {subPage === 'dashboard' && drilldownSoi && (
              <SOIDetail
                store={store}
                soiId={drilldownSoi}
                livePrices={livePrices}
                onBack={() => setDrilldownSoi(null)}
                updateStore={updateStore}
                priceHistory={priceHistory}
                historyLoading={historyLoading}
                historyProgress={historyProgress}
                range={range}
                onRangeChange={setRange}
                onRequestFetch={fetchHistoryFor}
                apiKey={effectiveApiKey}
                onCreateSnapshot={(id) => setSnapshotEditorSoi(id)}
                view="holdings" />
            )}
            {subPage === 'positions' && drilldownSoi && (
              <SOIDetail
                store={store}
                soiId={drilldownSoi}
                livePrices={livePrices}
                onBack={() => setDrilldownSoi(null)}
                updateStore={updateStore}
                priceHistory={priceHistory}
                historyLoading={historyLoading}
                historyProgress={historyProgress}
                range={range}
                onRangeChange={setRange}
                onRequestFetch={fetchHistoryFor}
                apiKey={effectiveApiKey}
                onCreateSnapshot={(id) => setSnapshotEditorSoi(id)}
                view="positions" />
            )}
            {subPage === 'fund-economics' && drilldownSoi && (
              <SOIDetail
                store={store}
                soiId={drilldownSoi}
                livePrices={livePrices}
                onBack={() => setDrilldownSoi(null)}
                updateStore={updateStore}
                priceHistory={priceHistory}
                historyLoading={historyLoading}
                historyProgress={historyProgress}
                range={range}
                onRangeChange={setRange}
                onRequestFetch={fetchHistoryFor}
                apiKey={effectiveApiKey}
                onCreateSnapshot={(id) => setSnapshotEditorSoi(id)}
                view="economics" />
            )}
            {subPage === 'dashboard' && !drilldownSoi && (
              <OverviewTab rollup={rollup} store={store} selection={selection}
                priceHistory={priceHistory} historyLoading={historyLoading} historyProgress={historyProgress}
                range={range} onRangeChange={setRange} onRequestFetch={fetchHistoryFor}
                apiKey={effectiveApiKey} updateStore={updateStore}
                asOfDate={asOfDate}
                clientShareMode={clientShareMode} scaleBy={scaleBy} />
            )}
            {subPage === 'positions' && !drilldownSoi && (
              <PositionsTab rollup={rollup} store={store} updateStore={updateStore} />
            )}
            {subPage === 'exposures' && (
              <ExposuresPage rollup={rollup} selection={selection} />
            )}
            {subPage === 'rounds' && !drilldownSoi && selection.kind === 'manager' && (
              <ManagerRoundsPage
                manager={store.managers.find((m) => m.id === selection.id)}
                updateStore={updateStore}
              />
            )}
            {subPage === 'fund-economics' && !drilldownSoi && !onManagerOrVintage && (
              <FundEconomicsPage rollup={rollup} store={store} selection={selection} clientShareMode={clientShareMode} />
            )}
            {subPage === 'fund-economics' && !drilldownSoi && onManagerOrVintage && (
              <PlaceholderPage icon={DollarSign}
                title="Fund Economics is client-scoped"
                description="Committed / Called / MOIC / TVPI are properties of a client's commitment to this manager. Select a specific client from Portfolios to see them." />
            )}
          </>
        );

        if (useSidebarLayout) {
          return (
            <div className="max-w-[1600px] mx-auto flex">
              <LeftSidebar
                subPage={subPage} setSubPage={setSubPage}
                setDrilldownSoi={setDrilldownSoi}
                hiddenItems={[
                  ...(onManagerOrVintage ? ['fund-economics'] : []),
                  ...(selection.kind !== 'manager' || drilldownSoi ? ['rounds'] : []),
                ]}
                activeFundId={drilldownSoi}
                onDrillFund={(soiId) => { setDrilldownSoi(soiId); setSubPage('dashboard'); }}
                extraSections={(() => {
                  // On manager view (no drilldown), list the manager's funds.
                  if (selection.kind === 'manager' && !drilldownSoi) {
                    const mSois = store.soIs.filter(s => s.managerId === selection.id);
                    if (mSois.length === 0) return [];
                    return [{
                      group: 'Funds',
                      items: mSois.map(soi => ({
                        id: soi.id,
                        label: fundLabel(soi),
                        sub: latestSnapshot(soi)?.asOfDate ? `as of ${latestSnapshot(soi).asOfDate}` : null,
                        children: drilldownSoi === soi.id ? FUND_SUB_TABS.map((t) => ({
                          id: t.id, label: t.label, icon: t.icon,
                          onClick: () => setSubPage(t.id),
                        })) : null,
                      })),
                    }];
                  }
                  // On a vintage drilldown, show a "Back to manager" + sibling funds.
                  if (drilldownSoi) {
                    const drilled = store.soIs.find(s => s.id === drilldownSoi);
                    if (!drilled) return [];
                    const siblingFunds = store.soIs.filter(s => s.managerId === drilled.managerId);
                    if (siblingFunds.length === 0) return [];
                    return [{
                      group: 'Funds',
                      items: siblingFunds.map(soi => ({
                        id: soi.id,
                        label: fundLabel(soi),
                        sub: latestSnapshot(soi)?.asOfDate ? `as of ${latestSnapshot(soi).asOfDate}` : null,
                        children: drilldownSoi === soi.id ? FUND_SUB_TABS.map((t) => ({
                          id: t.id, label: t.label, icon: t.icon,
                          onClick: () => setSubPage(t.id),
                        })) : null,
                      })),
                    }];
                  }
                  return [];
                })()}
              />
              <div className="flex-1 px-6 py-6 min-w-0">
                {HeaderBlock}
                {snapshotDates.length > 1 && (
                  <div className="mb-4">
                    <TimeSlider dates={snapshotDates} value={asOfDate} onChange={setAsOfDate} />
                  </div>
                )}
                {rollup.positionCount > 0 && ContentForOverview}
              </div>
            </div>
          );
        }

        // Bare "all managers" directory keeps its full-width layout — no sidebar.
        return (
          <div className="max-w-[1600px] mx-auto px-6 py-6">
            {HeaderBlock}
            {snapshotDates.length > 1 && (
              <div className="mb-4">
                <TimeSlider dates={snapshotDates} value={asOfDate} onChange={setAsOfDate} />
              </div>
            )}
            {rollup.positionCount > 0 && (
              <ManagersTab rollup={rollup} store={store} onDrill={(soiId) => setDrilldownSoi(soiId)}
                priceHistory={priceHistory} range={range} apiKey={effectiveApiKey}
                clientShareMode={clientShareMode} scaleBy={scaleBy} />
            )}
          </div>
        );
      })()}

      {importOpen && (
        <ImportWizard
          store={store}
          updateStore={updateStore}
          onClose={() => setImportOpen(false)}
          onDone={() => { setImportOpen(false); }}
        />
      )}

      {settingsOpen && (
        <SettingsDrawer
          store={store}
          updateStore={updateStore}
          selection={selection}
          setSelection={setSelection}
          onClose={() => setSettingsOpen(false)}
          onResetSeed={() => { const s = seedStore(); setStore(s); setLivePrices({}); setSelection({kind:'client', id:s.clients[0].id}); setSettingsOpen(false); }}
        />
      )}
    </div>
    {snapshotEditorSoi && (
      <div style={{ position: 'fixed', inset: 0, zIndex: 100, backgroundColor: BG, overflow: 'auto' }}>
        <SnapshotEditor
          store={store}
          soiId={snapshotEditorSoi}
          updateStore={updateStore}
          onClose={() => setSnapshotEditorSoi(null)}
        />
      </div>
    )}
    {detailToken && <TokenDetailDrawer token={detailToken} onClose={() => {
      setDetailToken(null);
      if (/^#\/token\//.test(window.location.hash)) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }} apiKey={effectiveApiKey} store={store} />}
    </OpenTokenDetailContext.Provider></TokenImageContext.Provider>
  );
}

/* =============================================================================
   PERFORMANCE CHART — Yahoo Finance-adjacent area chart
   Props:
     soiBundles: array of SOI objects (each with snapshots)
     scaleFn: optional (bundle) => scale factor
     priceHistory: { cgTokenId → { utcDayMs → price } }
     historyLoading: bool
     historyProgress: { current, total, token }
     range: one of RANGES
     onRangeChange, onRequestFetch(tokenIds, days): to trigger fetch on demand
     apiKey: for gating UI
     height, compact: style controls
   ============================================================================= */

/* =============================================================================
   DASHBOARD / EXPOSURES / FUND ECONOMICS — helper components and pages.
   Dashboard is a compact summary; Exposures is the detailed exposure breakdown;
   Fund Economics is the commitment-level MOIC / TVPI / DPI view.
   ============================================================================= */

/* Compact sector tilt: horizontal bars only (no pie), used on Dashboard. */

/* =============================================================================
   IMPORT WIZARD — file upload → map cols → assign to manager/client → save
   Also supports manual entry from scratch.
   ============================================================================= */

