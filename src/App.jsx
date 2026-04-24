import React, { useState, useMemo, useCallback, useEffect, useRef, useContext } from 'react';
import catenaLogo from './assets/catena-logo.png';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import _ from 'lodash';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, LineChart, Line, ReferenceLine, ReferenceArea } from 'recharts';
import { Upload, RefreshCw, AlertCircle, Layers, Search, Lock, ArrowLeft, FileSpreadsheet, Activity, Plus, Settings, Download, Trash2, Users, Briefcase, Building2, ChevronDown, ChevronRight, Edit2, X, Check, Eye, EyeOff, TrendingUp, Calendar, Home, Globe, Twitter, Linkedin, ExternalLink, PieChart as PieChartIcon, DollarSign, LayoutDashboard } from 'lucide-react';
import {
  BG, PANEL, PANEL_2, BORDER, TEXT, TEXT_DIM, TEXT_MUTE,
  ACCENT, ACCENT_2, GREEN, RED, GOLD, VIOLET,
} from './lib/theme';
import {
  fmtCurrency, fmtPct, fmtPctSigned, fmtMoic, fmtNum, fundLabel, uid, today,
} from './lib/format';
import {
  DEFAULT_SECTORS, DEFAULT_TOKEN_SECTOR, LEGACY_SECTOR_MAP, UNCLASSIFIED,
  getSectors, setSectors, sectorOf, resolveSector,
} from './lib/sectors';
import { RANGES, MOVER_RANGES, DETAIL_RANGES, rangeToStartMs, rangeToDays } from './lib/ranges';
import {
  FIELDS, SUBTOTAL_PATTERNS, normalize, parseNum, parseDate,
  matchScore, autoMapColumns, detectHeaderRow, dedupeHeaders,
} from './lib/parsing';
import { STORE_KEY, emptyStore, loadStore, saveStore } from './lib/storage';
import { seedStore } from './lib/seed';
import {
  snapshotsOf, latestSnapshot, sortedSnapshots, isLiquid, liquidityOverrideOf,
} from './lib/snapshots';
import { getSelectedSOIs, computeRollup, buildNAVSeries, buildNAVSeriesSimple } from './lib/rollup';
import {
  CG_BASE, EMBEDDED_CG_API_KEY, resolveApiKey,
  fetchLivePrices, fetchCoinDetail, fetchCoinChart, fetchHistory,
} from './lib/api/coingecko';
import {
  CR_BASE, EMBEDDED_CR_API_KEY, cryptorankFetch,
  TOKEN_IMAGES_CACHE_KEY, loadTokenImagesCache, saveTokenImagesCache, fetchTokenImagesMap,
} from './lib/api/cryptorank';
import {
  EMBEDDED_CMC_API_KEY, CMC_IMG, CMC_GIF,
  CMC_ID_CACHE_KEY, cmcFetch, loadCmcIdCache, saveCmcIdCache, fetchCmcIdMap,
} from './lib/api/coinmarketcap';
import { TokenImageContext, OpenTokenDetailContext } from './contexts';

import {
  Panel, KPI, Pill, Tab, NavButton, Breadcrumb, EditableText,
  ManagerSocials, SectorBadge, LiquidityBadge, ChangeCell,
  SortHead, Modal, ChoiceCard, MenuItem, PlaceholderPage,
  Field, TextInput, NumField, Stat, Select,
} from './components/ui';
import { TokenIcon } from './components/TokenIcon';
import { TokenDetailDrawer } from './components/TokenDetailDrawer';
import { LeftSidebar, SIDEBAR_SECTIONS } from './components/LeftSidebar';
import { PortfolioSelector } from './components/PortfolioSelector';
import { PerformanceChart } from './components/PerformanceChart';
import { MiniSparkline } from './components/MiniSparkline';
import {
  CompactSectorTilt, CompactManagerBreakdown,
  TopHoldingsPanel, TopMoversPanel,
  FullSectorTiltPanel, LiquidityBreakdownPanel, FullTopHoldingsTable,
} from './components/DashboardPanels';

import { OverviewTab } from './pages/OverviewTab';
import { ExposuresPage } from './pages/ExposuresPage';
import { FundEconomicsPage } from './pages/FundEconomicsPage';
import { ManagersTab } from './pages/ManagersTab';
import { PositionsTab } from './pages/PositionsTab';
import { SOIDetail } from './pages/SOIDetail';
import { PositionEditor } from './pages/PositionEditor';
import { SettingsDrawer } from './pages/SettingsDrawer';
import { ImportWizard } from './import/ImportWizard';

export default function App() {
  const [store, setStore] = useState(() => {
    const loaded = loadStore();
    if (loaded && (loaded.soIs.length || loaded.clients.length)) return loaded;
    return seedStore();
  });
  // Sync lib/sectors module-level ref to the live store list before any child render / useMemo.
  // If stored sectors lack the v5 'base-layer' bucket (e.g. HMR preserved an
  // older store in memory), force-use DEFAULT_SECTORS so breakdown labels and
  // colors reflect the current taxonomy regardless of persisted state.
  const _storedSectorsValid = store.sectors && store.sectors.length && store.sectors.some(sec => sec && sec.id === 'base-layer');
  setSectors(_storedSectorsValid ? store.sectors : DEFAULT_SECTORS);
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

  /* Compute grouped search results across portfolios / managers / positions.
     Null when query is empty, signaling "don't render the dropdown." */
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    const clients = store.clients
      .filter(c => (c.name || '').toLowerCase().includes(q))
      .slice(0, 6);
    const managers = store.managers
      .filter(m => (m.name || '').toLowerCase().includes(q) || (m.firm || '').toLowerCase().includes(q))
      .slice(0, 6);
    const byToken = {};
    for (const soi of store.soIs) {
      const snap = latestSnapshot(soi);
      if (!snap) continue;
      const mgr = store.managers.find(m => m.id === soi.managerId);
      for (const p of (snap.positions || [])) {
        const name = (p.positionName || '').toLowerCase();
        const ticker = (p.ticker || '').toLowerCase();
        if (!(name.includes(q) || ticker.includes(q))) continue;
        const key = (p.ticker || p.positionName || '').toUpperCase();
        if (!byToken[key]) {
          byToken[key] = { key, ticker: p.ticker || '', name: p.positionName || '',
                           cgTokenId: p.cgTokenId || null, exposures: [] };
        }
        if (!byToken[key].cgTokenId && p.cgTokenId) byToken[key].cgTokenId = p.cgTokenId;
        byToken[key].exposures.push({ position: p, soi, manager: mgr });
      }
    }
    const positions = Object.values(byToken).slice(0, 8);
    return { clients, managers, positions };
  }, [searchQuery, store]);
  const [drilldownSoi, setDrilldownSoi] = useState(null); // when viewing a single SOI in depth

  // Snap subPage back to dashboard if the user switches to a manager/vintage
  // view while Fund Economics was open (it's client-scoped).
  useEffect(() => {
    const onMgrOrVint = selection.kind === 'manager' || selection.kind === 'vintage' || !!drilldownSoi;
    if (onMgrOrVint && subPage === 'fund-economics') setSubPage('dashboard');
  }, [selection, drilldownSoi]);
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
  const rollup = useMemo(() => computeRollup(store, selection, livePrices, scaleBy), [store, selection, livePrices, scaleBy]);

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

          {/* Primary nav */}
          <div className="flex items-center gap-1 ml-6">
            <NavButton active={tab==='overview' && selection.kind==='firm'} onClick={()=>{setSelection({kind:'firm'}); setTab('overview'); setDrilldownSoi(null); setOpenMenu(null); setSubPage('dashboard');}} icon={Home}>Home</NavButton>

            {/* Portfolios: opens a dropdown listing clients */}
            <div style={{ position: 'relative' }}>
              <NavButton
                active={tab==='positions' || openMenu==='portfolios'}
                onClick={() => setOpenMenu(openMenu==='portfolios' ? null : 'portfolios')}
                icon={Layers}
                hasCaret>Portfolios</NavButton>
              {openMenu === 'portfolios' && (
                <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 42 }}>
                  <div className="rounded shadow-xl py-1"
                    style={{ backgroundColor: PANEL_2, border: `1px solid ${BORDER}`, minWidth: 220 }}>
                    <button onClick={() => { setOpenMenu(null); setSelection({kind:'firm'}); setTab('overview'); setDrilldownSoi(null); }}
                      className="w-full text-left px-3 py-2 text-xs flex items-center gap-2"
                      style={{ color: TEXT }}>
                      <Users size={13} style={{ color: ACCENT_2 }} />
                      <span>All portfolios</span>
                    </button>
                    <div style={{ height: 1, backgroundColor: BORDER, margin: '4px 0' }} />
                    {store.clients.length === 0 && (
                      <div className="px-3 py-2 text-xs" style={{ color: TEXT_MUTE }}>No portfolios yet.</div>
                    )}
                    {store.clients.map(c => (
                      <button key={c.id}
                        onClick={() => { setOpenMenu(null); setSelection({kind:'client', id:c.id}); setTab('overview'); setDrilldownSoi(null); }}
                        className="w-full text-left px-3 py-2 text-xs flex items-center gap-2"
                        style={{ color: TEXT }}>
                        <span style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ACCENT_2, flexShrink: 0 }} />
                        <span className="truncate">{c.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Managers: cascading dropdown — managers → vintages → (FoF only) underlying commitments */}
            <div style={{ position: 'relative' }}>
              <NavButton
                active={tab==='managers' || openMenu==='managers'}
                onClick={() => { setOpenMenu(openMenu==='managers' ? null : 'managers'); setFlyoutManagerId(null); setFlyoutSoiId(null); }}
                icon={Briefcase}
                hasCaret>Managers</NavButton>
              {openMenu === 'managers' && (
                <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 42 }}>
                  <div className="rounded shadow-xl py-1"
                    style={{ backgroundColor: PANEL_2, border: `1px solid ${BORDER}`, minWidth: 260 }}>
                    <button onClick={() => { setOpenMenu(null); setFlyoutManagerId(null); setFlyoutSoiId(null); setTab('managers'); setDrilldownSoi(null); }}
                      className="w-full text-left px-3 py-2 text-xs flex items-center gap-2"
                      style={{ color: TEXT }}>
                      <Briefcase size={13} style={{ color: ACCENT_2 }} />
                      <span>All managers</span>
                    </button>
                    <div style={{ height: 1, backgroundColor: BORDER, margin: '4px 0' }} />
                    {store.managers.length === 0 && (
                      <div className="px-3 py-2 text-xs" style={{ color: TEXT_MUTE }}>No managers yet.</div>
                    )}
                    {store.managers.map(m => {
                      const mSois = store.soIs.filter(x => x.managerId === m.id);
                      const isFoF = m.type === 'fund_of_funds';
                      const isMOpen = flyoutManagerId === m.id;
                      return (
                        <div key={m.id} style={{ position: 'relative' }}>
                          <button onClick={() => {
                            // Clicking the manager name navigates to the manager's
                            // overview AND opens the vintage flyout so the user can
                            // optionally drill further.
                            setSelection({ kind: 'manager', id: m.id });
                            setTab('managers');
                            setDrilldownSoi(null);
                            setSubPage('dashboard');
                            if (mSois.length > 0) {
                              setFlyoutManagerId(isMOpen ? null : m.id);
                              setFlyoutSoiId(null);
                            } else {
                              setOpenMenu(null); setFlyoutManagerId(null); setFlyoutSoiId(null);
                            }
                          }}
                            className="w-full text-left px-3 py-2 text-xs flex items-center gap-2"
                            style={{ color: TEXT, backgroundColor: isMOpen ? BORDER + '66' : 'transparent' }}>
                            <span style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ACCENT_2, flexShrink: 0 }} />
                            <div className="min-w-0 flex-1">
                              <div className="truncate flex items-center gap-1.5">
                                <span className="truncate">{m.name}</span>
                                {isFoF && <span className="text-[9px] px-1 rounded flex-shrink-0" style={{ backgroundColor: ACCENT_2 + '22', color: ACCENT_2 }}>FoF</span>}
                              </div>
                              <div className="text-[10px] truncate" style={{ color: TEXT_MUTE }}>
                                {mSois.length} {mSois.length === 1 ? 'vintage' : 'vintages'}
                              </div>
                            </div>
                            {mSois.length > 0 && <ChevronRight size={12} style={{ color: TEXT_MUTE, flexShrink: 0 }} />}
                          </button>

                          {/* Level 2: this manager's vintages */}
                          {isMOpen && (
                            <div style={{ position: 'absolute', top: 0, left: '100%', marginLeft: 4 }}>
                              <div className="rounded shadow-xl py-1"
                                style={{ backgroundColor: PANEL_2, border: `1px solid ${BORDER}`, minWidth: 260 }}>
                                <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider" style={{ color: TEXT_MUTE }}>
                                  {m.name} · funds
                                </div>
                                {mSois.map(soi => {
                                  const snap = latestSnapshot(soi);
                                  const subs = (snap?.subCommitments || []);
                                  const hasSubs = isFoF && subs.length > 0;
                                  const isVOpen = flyoutSoiId === soi.id;
                                  return (
                                    <div key={soi.id} style={{ position: 'relative' }}>
                                      <button onClick={() => {
                                        if (hasSubs) {
                                          setFlyoutSoiId(isVOpen ? null : soi.id);
                                        } else {
                                          setOpenMenu(null); setFlyoutManagerId(null); setFlyoutSoiId(null);
                                          setTab('managers'); setDrilldownSoi(soi.id);
                                        }
                                      }}
                                        className="w-full text-left px-3 py-2 text-xs flex items-center gap-2"
                                        style={{ color: TEXT, backgroundColor: isVOpen ? BORDER + '66' : 'transparent' }}>
                                        <Layers size={13} style={{ color: ACCENT_2, flexShrink: 0 }} />
                                        <div className="min-w-0 flex-1">
                                          <div className="truncate">{soi.fundName || soi.vintage}</div>
                                          <div className="text-[10px] truncate" style={{ color: TEXT_MUTE }}>
                                            {snap?.asOfDate ? `as of ${snap.asOfDate}` : 'no snapshot'}
                                            {hasSubs && ` · ${subs.length} underlying`}
                                          </div>
                                        </div>
                                        {hasSubs && <ChevronRight size={12} style={{ color: TEXT_MUTE, flexShrink: 0 }} />}
                                      </button>

                                      {/* Level 3: underlying FoF commitments (only for FoF vintages with sub-commitments) */}
                                      {isVOpen && hasSubs && (
                                        <div style={{ position: 'absolute', top: 0, left: '100%', marginLeft: 4 }}>
                                          <div className="rounded shadow-xl py-1"
                                            style={{ backgroundColor: PANEL_2, border: `1px solid ${BORDER}`, minWidth: 280 }}>
                                            <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider" style={{ color: TEXT_MUTE }}>
                                              {fundLabel(soi)} · underlying
                                            </div>
                                            {subs.map((sub, i) => {
                                              const subSoi = store.soIs.find(x => x.id === sub.toSoiId);
                                              const subMgr = subSoi ? store.managers.find(mm => mm.id === subSoi.managerId) : null;
                                              return (
                                                <button key={sub.toSoiId || i}
                                                  onClick={() => {
                                                    if (!subSoi) return;
                                                    setOpenMenu(null); setFlyoutManagerId(null); setFlyoutSoiId(null);
                                                    setTab('managers'); setDrilldownSoi(subSoi.id);
                                                  }}
                                                  disabled={!subSoi}
                                                  className="w-full text-left px-3 py-2 text-xs flex items-center gap-2"
                                                  style={{ color: subSoi ? TEXT : TEXT_MUTE, opacity: subSoi ? 1 : 0.5 }}>
                                                  <span style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ACCENT_2, flexShrink: 0 }} />
                                                  <div className="min-w-0 flex-1">
                                                    <div className="truncate">{subMgr?.name || '(missing manager)'} — {fundLabel(subSoi)}</div>
                                                    <div className="text-[10px] truncate" style={{ color: TEXT_MUTE }}>
                                                      {fmtCurrency(sub.committed || 0)} committed
                                                    </div>
                                                  </div>
                                                </button>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Create: opens a dropdown with create options */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setOpenMenu(openMenu==='create' ? null : 'create')}
                className="ml-2 px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5"
                style={{ backgroundColor: ACCENT, color: BG }}>
                <Plus size={12} /> Create
              </button>
              {openMenu === 'create' && (
                <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 42 }}>
                  <div className="rounded shadow-xl py-1"
                    style={{ backgroundColor: PANEL_2, border: `1px solid ${BORDER}`, minWidth: 220 }}>
                    <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider" style={{ color: TEXT_MUTE }}>New</div>
                    <button onClick={() => { setOpenMenu(null); setSettingsOpen(true); }}
                      className="w-full text-left px-3 py-2 text-xs flex items-center gap-2"
                      style={{ color: TEXT }}>
                      <Users size={13} style={{ color: ACCENT_2 }} /> Portfolio (client)
                    </button>
                    <button onClick={() => { setOpenMenu(null); setSettingsOpen(true); }}
                      className="w-full text-left px-3 py-2 text-xs flex items-center gap-2"
                      style={{ color: TEXT }}>
                      <Briefcase size={13} style={{ color: ACCENT_2 }} /> Manager
                    </button>
                    <button onClick={() => { setOpenMenu(null); setImportOpen(true); }}
                      className="w-full text-left px-3 py-2 text-xs flex items-center gap-2"
                      style={{ color: TEXT }}>
                      <Upload size={13} style={{ color: ACCENT_2 }} /> Holdings snapshot (import)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1" />

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: TEXT_MUTE, pointerEvents: 'none' }} />
            <input type="search" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}
              placeholder="Search portfolios, managers, positions…"
              className="pl-7 pr-3 py-1.5 rounded text-xs outline-none"
              style={{ backgroundColor: PANEL_2, border: `1px solid ${BORDER}`, color: TEXT, width: 260 }}
            />
            {searchResults && (
              <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 43, width: 360 }}>
                <div className="rounded shadow-xl py-1"
                  style={{ backgroundColor: PANEL_2, border: `1px solid ${BORDER}`, maxHeight: 460, overflowY: 'auto' }}>
                  {searchResults.clients.length === 0
                   && searchResults.managers.length === 0
                   && searchResults.positions.length === 0 && (
                    <div className="px-3 py-3 text-xs" style={{ color: TEXT_MUTE }}>No matches.</div>
                  )}
                  {searchResults.clients.length > 0 && (
                    <>
                      <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider" style={{ color: TEXT_MUTE }}>Portfolios</div>
                      {searchResults.clients.map(c => (
                        <button key={c.id}
                          onClick={() => { setSearchQuery(''); setSelection({kind:'client', id:c.id}); setTab('overview'); setDrilldownSoi(null); setOpenMenu(null); }}
                          className="w-full text-left px-3 py-2 text-xs flex items-center gap-2"
                          style={{ color: TEXT }}>
                          <Users size={13} style={{ color: ACCENT_2 }} />
                          <span className="truncate">{c.name}</span>
                        </button>
                      ))}
                    </>
                  )}
                  {searchResults.managers.length > 0 && (
                    <>
                      <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider" style={{ color: TEXT_MUTE }}>Managers</div>
                      {searchResults.managers.map(m => {
                        const mSois = store.soIs.filter(x => x.managerId === m.id);
                        return (
                          <button key={m.id}
                            onClick={() => { setSearchQuery(''); setTab('managers'); setDrilldownSoi(mSois[0]?.id || null); setOpenMenu(null); }}
                            className="w-full text-left px-3 py-2 text-xs flex items-center gap-2"
                            style={{ color: TEXT }}>
                            <Briefcase size={13} style={{ color: ACCENT_2 }} />
                            <div className="min-w-0 flex-1">
                              <div className="truncate">{m.name}</div>
                              {m.firm && <div className="text-[10px] truncate" style={{ color: TEXT_MUTE }}>{m.firm}</div>}
                            </div>
                          </button>
                        );
                      })}
                    </>
                  )}
                  {searchResults.positions.length > 0 && (
                    <>
                      <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider" style={{ color: TEXT_MUTE }}>Tokens</div>
                      {searchResults.positions.map((t) => (
                        <button key={t.key}
                          onClick={() => {
                            setSearchQuery(''); setOpenMenu(null);
                            setDetailToken({ cgTokenId: t.cgTokenId, symbol: t.ticker, name: t.name });
                          }}
                          className="w-full text-left px-3 py-2 text-xs flex items-center gap-2"
                          style={{ color: TEXT }}>
                          <TokenIcon ticker={t.ticker} name={t.name} size={20} />
                          <div className="min-w-0 flex-1">
                            <div className="truncate">
                              <span style={{ fontWeight: 600 }}>{t.ticker || t.name}</span>
                              {t.ticker && t.name !== t.ticker && (
                                <span style={{ color: TEXT_DIM }}> · {t.name}</span>
                              )}
                            </div>
                            <div className="text-[10px] truncate" style={{ color: TEXT_MUTE }}>
                              {t.exposures.length === 1
                                ? `1 fund: ${t.exposures[0].manager?.name || '?'} · ${fundLabel(t.exposures[0].soi)}`
                                : `${t.exposures.length} funds`}
                            </div>
                          </div>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Settings gear */}
          <button onClick={() => setSettingsOpen(true)}
            className="p-1.5 rounded" style={{ color: TEXT_DIM }}>
            <Settings size={16} />
          </button>
        </div>

        {/* ========= CONTEXT ROW ========= */}
        <div className="max-w-[1600px] mx-auto px-6 py-2 flex items-center gap-3 flex-wrap" style={{ borderTop: `1px solid ${BORDER}` }}>
          <Breadcrumb store={store} selection={selection} drilldownSoi={drilldownSoi}
            onCrumb={(sel) => { setSelection(sel); setDrilldownSoi(null); setOpenMenu(null); setTab(sel.kind === 'manager' ? 'managers' : 'overview'); }} />
          {selection.kind === 'client' && (
            <button onClick={() => setClientShareMode(m => !m)}
              className="px-2.5 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors"
              style={{
                backgroundColor: clientShareMode ? ACCENT + '22' : 'transparent',
                color: clientShareMode ? ACCENT_2 : TEXT_DIM,
                border: `1px solid ${clientShareMode ? ACCENT + '44' : BORDER}`,
              }}>
              {clientShareMode ? '⊗ Client share' : '⊞ Full fund'}
            </button>
          )}

          <div className="flex-1" />

          {/* As-of-date */}
          <div className="flex items-center gap-1.5">
            <Calendar size={12} style={{ color: TEXT_MUTE }} />
            <span className="text-[10px] uppercase tracking-wider" style={{ color: TEXT_MUTE }}>As of</span>
            <input type="date" value={asOfDate} onChange={e=>setAsOfDate(e.target.value)}
              className="text-xs rounded px-2 py-1 outline-none"
              style={{ backgroundColor: PANEL_2, border: `1px solid ${BORDER}`, color: TEXT, colorScheme: 'dark' }}
            />
          </div>

          {store.settings.lastRefresh && (
            <div className="text-[10px]" style={{ color: TEXT_MUTE }}>
              {new Date(store.settings.lastRefresh).toLocaleTimeString()}
            </div>
          )}
          {/* Live prices toggle — when OFF, no CoinGecko auto-fetch fires; saves demo credits during iteration. */}
          <button
            onClick={() => updateStore(st => ({ ...st, settings: { ...st.settings, useLivePrices: !st.settings.useLivePrices } }))}
            className="px-2.5 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors"
            title={store.settings.useLivePrices ? 'Live CoinGecko prices ON — click to disable (saves API credits)' : 'Live CoinGecko prices OFF — click to enable (auto-fetches history)'}
            style={{
              backgroundColor: store.settings.useLivePrices ? ACCENT + '22' : 'transparent',
              color: store.settings.useLivePrices ? ACCENT_2 : TEXT_DIM,
              border: `1px solid ${store.settings.useLivePrices ? ACCENT + '44' : BORDER}`,
            }}>
            <span style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: store.settings.useLivePrices ? '#3ecf8e' : TEXT_MUTE }} />
            Live: {store.settings.useLivePrices ? 'ON' : 'OFF'}
          </button>
          <button onClick={refreshPrices} disabled={priceLoading || !store.settings.useLivePrices}
            className="px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors"
            style={{ border: `1px solid ${BORDER}`, color: TEXT, backgroundColor: PANEL_2, opacity: (priceLoading || !store.settings.useLivePrices) ? 0.4 : 1 }}>
            <RefreshCw size={12} className={priceLoading ? 'animate-spin' : ''} />
            {priceLoading ? 'Fetching…' : 'Refresh'}
          </button>
        </div>

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
          <>
            {/* Selection summary line */}
            <div className="flex items-baseline justify-between mb-6">
              <div>
                <div className="text-xs uppercase tracking-wider" style={{ color: TEXT_MUTE }}>
                  {selection.kind === 'firm' ? 'Firm-wide rollup (all clients, all managers)' :
                   selection.kind === 'client' ? 'Client portfolio' :
                   selection.kind === 'manager' ? 'Manager (all vintages, across clients)' : 'Single fund vintage'}
                </div>
                {selection.kind === 'client' ? (
                  <EditableText
                    tag="h1"
                    className="text-2xl font-semibold mt-0.5"
                    style={{ display: 'inline-block', minWidth: 180 }}
                    value={selectionLabel}
                    placeholder="Name this portfolio…"
                    onCommit={(nextName) => {
                      if (!nextName) return;
                      updateStore(st => ({
                        ...st,
                        clients: st.clients.map(c => c.id === selection.id ? { ...c, name: nextName } : c),
                      }));
                    }}
                  />
                ) : (
                  <h1 className="text-2xl font-semibold mt-0.5">{selectionLabel}</h1>
                )}
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-wider" style={{ color: TEXT_MUTE }}>Total exposure</div>
                <div className="text-2xl font-semibold">{fmtCurrency(rollup.totalNAV)}</div>
                {clientShareMode && selection?.kind === 'client' && (
                  <div className="text-[10px] mt-0.5" style={{color: TEXT_DIM}}>Scaled to client's pro-rata share of called capital</div>
                )}
              </div>
            </div>

            {priceError && (
              <Panel className="p-3 mb-4 flex items-center gap-2" style={{ borderColor: RED + '66', backgroundColor: RED + '11' }}>
                <AlertCircle size={14} style={{ color: RED }} />
                <span className="text-xs" style={{ color: RED }}>{priceError}</span>
              </Panel>
            )}

            {rollup.positionCount === 0 && (
              <Panel className="p-12 text-center">
                <div className="text-sm" style={{ color: TEXT_DIM }}>No positions in this selection yet.</div>
                <button onClick={() => setImportOpen(true)}
                  className="mt-4 px-4 py-2 rounded text-xs font-medium inline-flex items-center gap-1.5"
                  style={{ backgroundColor: ACCENT, color: BG }}>
                  <Upload size={12} /> Import a snapshot
                </button>
              </Panel>
            )}
          </>
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
                apiKey={effectiveApiKey} />
            )}
            {subPage === 'dashboard' && !drilldownSoi && (
              <OverviewTab rollup={rollup} store={store} selection={selection}
                priceHistory={priceHistory} historyLoading={historyLoading} historyProgress={historyProgress}
                range={range} onRangeChange={setRange} onRequestFetch={fetchHistoryFor}
                apiKey={effectiveApiKey} updateStore={updateStore}
                clientShareMode={clientShareMode} scaleBy={scaleBy} />
            )}
            {subPage === 'positions' && (
              <PositionsTab rollup={rollup} store={store} updateStore={updateStore} />
            )}
            {subPage === 'exposures' && (
              <ExposuresPage rollup={rollup} selection={selection} />
            )}
            {subPage === 'fund-economics' && !onManagerOrVintage && (
              <FundEconomicsPage rollup={rollup} store={store} selection={selection} clientShareMode={clientShareMode} />
            )}
            {subPage === 'fund-economics' && onManagerOrVintage && (
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
                hiddenItems={onManagerOrVintage ? ['fund-economics'] : []}
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
                      })),
                    }];
                  }
                  // On a vintage drilldown, show a "Back to manager" + sibling funds.
                  if (drilldownSoi) {
                    const drilled = store.soIs.find(s => s.id === drilldownSoi);
                    if (!drilled) return [];
                    const siblingFunds = store.soIs.filter(s => s.managerId === drilled.managerId);
                    if (siblingFunds.length <= 1) return [];
                    return [{
                      group: 'Funds',
                      items: siblingFunds.map(soi => ({
                        id: soi.id,
                        label: fundLabel(soi),
                        sub: latestSnapshot(soi)?.asOfDate ? `as of ${latestSnapshot(soi).asOfDate}` : null,
                      })),
                    }];
                  }
                  return [];
                })()}
              />
              <div className="flex-1 px-6 py-6 min-w-0">
                {HeaderBlock}
                {rollup.positionCount > 0 && ContentForOverview}
              </div>
            </div>
          );
        }

        // Bare "all managers" directory keeps its full-width layout — no sidebar.
        return (
          <div className="max-w-[1600px] mx-auto px-6 py-6">
            {HeaderBlock}
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

