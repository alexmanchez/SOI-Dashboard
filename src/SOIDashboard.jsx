import React, { useState, useMemo, useCallback, useEffect, useRef, useContext, createContext } from 'react';
import catenaLogo from './assets/catena-logo.png';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import _ from 'lodash';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, LineChart, Line, ReferenceLine, ReferenceArea } from 'recharts';
import { Upload, RefreshCw, AlertCircle, Layers, Search, Lock, ArrowLeft, FileSpreadsheet, Activity, Plus, Settings, Download, Trash2, Users, Briefcase, Building2, ChevronDown, ChevronRight, Edit2, X, Check, Eye, EyeOff, TrendingUp, Calendar, Home, Globe, Twitter, Linkedin, ExternalLink, PieChart as PieChartIcon, DollarSign, LayoutDashboard } from 'lucide-react';

/* =============================================================================
   CATENA — Crypto Portfolio Exposure Dashboard
   ============================================================================= */

// --- Dark theme palette (Yahoo-Finance-adjacent, CA-tinted) --------------------
// Catena palette — institutional cypherpunk. Backgrounds are near-black
// with a deep blue-violet lean, panels a subtle navy-purple, borders quiet.
// The primary accent is an electric teal (the signature pop color). Lime /
// Punch / Gold provide positive / negative / highlight accents. Violet is
// reserved for FoF.
const BG        = '#070B14';   // deep blue-black (cypherpunk canvas)
const PANEL     = '#0D1524';   // panel on near-black
const PANEL_2   = '#151F38';   // hover / active panel (slightly lifted)
const BORDER    = '#1E2B45';   // quiet navy-purple border
const TEXT      = '#EEF3FA';   // soft near-white
const TEXT_DIM  = '#8D97A8';   // cool dim (CA Gray — shifted cooler)
const TEXT_MUTE = '#58637A';   // muted slate
const ACCENT    = '#22D3C5';   // electric teal (cypherpunk signature)
const ACCENT_2  = '#5EEADA';   // teal highlight
const GREEN     = '#9FCD2E';   // Lime (positives / up-moves)
const RED       = '#E25D6E';   // Punch, softened for dark (negatives)
const GOLD      = '#D4A64F';   // Gold warmed up (pills / highlights)
const VIOLET    = '#9D7AFF';   // electric violet (FoF accent)

// GICS-style 5-bucket taxonomy seed (user can add/edit/remove in Settings)
const DEFAULT_SECTORS = [
  { id: 'base-layer',       label: 'Base Layer',              color: '#22D3C5', desc: 'L1 blockchains (BTC, ETH, SOL, TIA)' },
  { id: 'infrastructure',   label: 'Infrastructure',          color: '#5EA0F2', desc: 'L2s, middleware, oracles, bridges, indexing' },
  { id: 'defi',             label: 'DeFi',                    color: '#9FCD2E', desc: 'DEXs, lending, perps, yield' },
  { id: 'gaming',           label: 'Gaming',                  color: '#EC4899', desc: 'On-chain gaming, metaverse' },
  { id: 'depin',            label: 'DePIN',                   color: '#06B6D4', desc: 'Decentralized physical infrastructure networks' },
  { id: 'ai-compute',       label: 'AI & Compute',            color: '#9D7AFF', desc: 'AI protocols, GPU markets, training' },
  { id: 'consumer-media',   label: 'Consumer & Media',        color: '#F59E0B', desc: 'Social, NFT, creator, content' },
  { id: 'security-privacy', label: 'Security & Privacy',      color: '#E25D6E', desc: 'ZK, privacy, auditing, compliance' },
  { id: 'stablecoins',      label: 'Stablecoins & Cash',      color: '#A7A9AC', desc: 'USDC, USDT, DAI, USDe' },
  { id: 'rwa-credit',       label: 'RWA & Credit',            color: '#D4A64F', desc: 'Tokenized RWAs, on-chain debt' },
  { id: 'staking',          label: 'Staking & Restaking',     color: '#10B981', desc: 'Liquid staking, restaking, validators' },
];
// Module-level mutable ref. Reassigned from store.sectors at top of SOIDashboard render,
// before any useMemo/compute runs, so all downstream consumers see the current list.
let SECTORS = DEFAULT_SECTORS;
const UNCLASSIFIED = { id: 'unclassified', label: 'Unclassified', color: '#6B7280' };
const sectorOf = (id) => SECTORS.find(s => s.id === id) || UNCLASSIFIED;

// Canonical token → sector map (seed; user can override in Settings)
const DEFAULT_TOKEN_SECTOR = {
  // Base Layer (L1s)
  'BTC': 'base-layer', 'ETH': 'base-layer', 'SOL': 'base-layer',
  'SUI': 'base-layer', 'APT': 'base-layer', 'SEI': 'base-layer',
  'TIA': 'base-layer', 'NEAR': 'base-layer', 'AVAX': 'base-layer',
  'TON': 'base-layer', 'ADA': 'base-layer', 'DOT': 'base-layer',
  'INJ': 'base-layer', 'BERA': 'base-layer', 'MNT': 'base-layer',
  'MOVE': 'base-layer', 'MONAD': 'base-layer',
  // Infrastructure (L2s, oracles, bridges)
  'ARB': 'infrastructure', 'OP': 'infrastructure', 'STRK': 'infrastructure',
  'MATIC': 'infrastructure', 'POL': 'infrastructure', 'BASE': 'infrastructure',
  'LINK': 'infrastructure', 'GRT': 'infrastructure', 'AXL': 'infrastructure',
  'AR': 'infrastructure', 'ATH': 'infrastructure',
  // DeFi
  'UNI': 'defi', 'AAVE': 'defi', 'COMP': 'defi', 'CRV': 'defi',
  'LDO': 'defi', 'PENDLE': 'defi', 'GMX': 'defi', 'DYDX': 'defi',
  'HYPE': 'defi', 'ENA': 'defi', 'MORPHO': 'defi', 'JUP': 'defi',
  // Gaming
  'IMX': 'gaming', 'RON': 'gaming', 'SAND': 'gaming', 'MANA': 'gaming',
  'AXS': 'gaming', 'PRIME': 'gaming', 'GAME': 'gaming',
  // DePIN
  'GRASS': 'depin', 'RNDR': 'depin', 'RENDER': 'depin', 'FIL': 'depin',
  'HNT': 'depin', 'IOT': 'depin', 'OCEAN': 'depin',
  // AI & Compute
  'FET': 'ai-compute', 'TAO': 'ai-compute', 'AGIX': 'ai-compute',
  'WLD': 'ai-compute', 'ICP': 'ai-compute',
  // Consumer & Media
  'STORY': 'consumer-media',
  // Security & Privacy
  'XMR': 'security-privacy', 'ZEC': 'security-privacy',
  // Stablecoins & Cash
  'USDC': 'stablecoins', 'USDT': 'stablecoins', 'DAI': 'stablecoins',
  'FRAX': 'stablecoins', 'USDE': 'stablecoins', 'PYUSD': 'stablecoins', 'USD': 'stablecoins',
  // RWA & Credit
  'ONDO': 'rwa-credit', 'MKR': 'rwa-credit',
  // Staking & Restaking
  'EIGEN': 'staking', 'JTO': 'staking', 'RPL': 'staking',
  'ETHFI': 'staking', 'REZ': 'staking', 'KMNO': 'staking',
};

// Time range pills
const RANGES = [
  { id: '1D',  label: '1D',  days: 1 },
  { id: 'MTD', label: 'MTD', days: null }, // computed
  { id: 'YTD', label: 'YTD', days: null },
  { id: '1Y',  label: '1Y',  days: 365 },
  { id: 'SI',  label: 'SI',  days: null }, // since inception
];

// --- Parsing helpers (preserved from v1) -------------------------------------
const FIELDS = {
  positionName:   { label: 'Position Name',          required: true,  synonyms: ['position name','position','name','asset','asset name','security','security name','holding','holdings','investment','investment name','company','company name','issuer','description','token name','instrument','portfolio company'] },
  ticker:         { label: 'Ticker / Symbol',        required: false, synonyms: ['ticker','symbol','ticker/symbol','token','token symbol','cusip'] },
  assetType:      { label: 'Asset Type',             required: false, synonyms: ['asset type','type','instrument type','security type','instrument','asset class','investment type','holding type'] },
  sector:         { label: 'Sector / Category',      required: false, synonyms: ['sector','category','sector/category','industry','vertical','theme','classification','gics sector','sub-sector','sub sector','strategy'] },
  quantity:       { label: 'Quantity',               required: false, synonyms: ['quantity','qty','shares','units','tokens','coins','position size','number of shares','# shares','par','par value','principal','notional'] },
  price:          { label: 'Price (at SOI)',         required: false, synonyms: ['price','unit price','price per share','mark','mark price','last price','nav per unit','price per unit','current price'] },
  costBasis:      { label: 'Cost Basis',             required: false, synonyms: ['cost basis','cost','book value','invested capital','basis','acquisition cost','total cost','original cost','cost ($)','investment cost'] },
  marketValue:    { label: 'Market Value (at SOI)',  required: true,  synonyms: ['market value','mv','fair value','fv','value','nav contribution','current value','mkt value','market val','fmv','ending value','ending mv','ending market value','value ($)','gross market value','gross exposure','net asset value','nav','position value'] },
  unrealizedPL:   { label: 'Unrealized P&L',         required: false, synonyms: ['unrealized gain/loss','unrealized p&l','unrealized pnl','unrealized gain (loss)','ugl','gain/loss','p&l','pnl','unrealized','unrealized profit','unrealized gain','u/g/l','gain loss'] },
  pctNav:         { label: '% of NAV',               required: false, synonyms: ['% of nav','pct of nav','% nav','percent of nav','weight','% of portfolio','portfolio %','allocation','pct','% weight','% of total','portfolio weight','% of aum','% of fund'] },
  acquisitionDate:{ label: 'Acquisition Date',       required: false, synonyms: ['acquisition date','date','purchase date','entry date','invested date','buy date','date acquired','initial investment date','trade date'] },
  liquidity:      { label: 'Liquidity',              required: false, synonyms: ['liquidity','liquidity tier','lockup','vesting','liquid/locked','liquid','liquidity profile','lock-up'] },
};
const SUBTOTAL_PATTERNS = /^(total|subtotal|sub-total|grand total|sum|net total|fund total|portfolio total|aggregate)/i;

const normalize = (s) => String(s ?? '').toLowerCase().trim().replace(/[_\-\/]/g, ' ').replace(/[()]/g, '').replace(/\s+/g, ' ');
const parseNum = (v) => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return isNaN(v) ? null : v;
  let s = String(v).trim();
  if (!s || s === '-' || s === '–' || s === 'N/A' || s === 'n/a') return null;
  const isNegParen = /^\(.+\)$/.test(s);
  s = s.replace(/[$,%\s€£¥]/g, '').replace(/[()]/g, '');
  const n = parseFloat(s);
  if (isNaN(n)) return null;
  return isNegParen ? -n : n;
};
const parseDate = (v) => {
  if (!v) return null;
  if (v instanceof Date && !isNaN(v)) return v;
  if (typeof v === 'number' && v > 10000 && v < 60000) {
    const ms = (v - 25569) * 86400 * 1000;
    const d = new Date(ms); return isNaN(d) ? null : d;
  }
  const d = new Date(v); return isNaN(d) ? null : d;
};
const matchScore = (header, candidates) => {
  const n = normalize(header); if (!n) return 0;
  let best = 0;
  for (const c of candidates) {
    if (n === c) best = Math.max(best, 100);
    else if (n === c.replace(/\s/g, '')) best = Math.max(best, 95);
    else if (n.startsWith(c) || c.startsWith(n)) best = Math.max(best, 85);
    else if (n.includes(c) && c.length >= 3) best = Math.max(best, 75);
    else if (c.includes(n) && n.length >= 3) best = Math.max(best, 65);
  }
  return best;
};
const autoMapColumns = (headers) => {
  const mapping = {}; const scores = {}; const used = new Set();
  const candidates = [];
  for (const [field, def] of Object.entries(FIELDS)) {
    for (const h of headers) {
      const s = matchScore(h, def.synonyms);
      if (s > 0) candidates.push({ field, header: h, score: s });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  for (const c of candidates) {
    if (mapping[c.field] || used.has(c.header) || c.score < 60) continue;
    mapping[c.field] = c.header; scores[c.field] = c.score; used.add(c.header);
  }
  return { mapping, scores };
};
const detectHeaderRow = (rows) => {
  const allSynonyms = Object.values(FIELDS).flatMap(f => f.synonyms);
  const limit = Math.min(25, rows.length);
  let bestRow = 0, bestScore = 0;
  for (let i = 0; i < limit; i++) {
    const row = rows[i] || [];
    const cells = row.map(c => normalize(c)).filter(Boolean);
    if (cells.length < 3) continue;
    let hits = 0;
    for (const cell of cells) {
      for (const syn of allSynonyms) { if (cell === syn || cell.includes(syn) || syn.includes(cell)) { hits++; break; } }
    }
    const textCells = row.filter(c => c && typeof c === 'string' && isNaN(parseNum(c))).length;
    const score = hits * 3 + textCells;
    if (score > bestScore && hits >= 2) { bestScore = score; bestRow = i; }
  }
  return bestRow;
};
const dedupeHeaders = (headers) => {
  const seen = {};
  return headers.map((h, i) => {
    const base = h && String(h).trim() ? String(h).trim() : `Column ${i + 1}`;
    if (seen[base] === undefined) { seen[base] = 0; return base; }
    seen[base]++; return `${base} (${seen[base]})`;
  });
};

// --- Format helpers -----------------------------------------------------------
const fmtCurrency = (v, digits) => {
  if (v === null || v === undefined || isNaN(v)) return '–';
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  const d = digits !== undefined ? digits : (abs >= 1e6 ? 2 : abs >= 1e3 ? 1 : 0);
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(d)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(d)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(d)}K`;
  return `${sign}$${abs.toFixed(d)}`;
};
const fmtPct = (v, d=2) => (v === null || v === undefined || isNaN(v)) ? '–' : `${v.toFixed(d)}%`;
const fmtPctSigned = (v, d=2) => {
  if (v === null || v === undefined || isNaN(v)) return '–';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(d)}%`;
};
const fmtMoic = (v) => (v === null || v === undefined || isNaN(v) || !isFinite(v)) ? '—' : `${v.toFixed(2)}×`;
const uid = () => Math.random().toString(36).slice(2, 10);

const fmtNum = (v, digits) => {
  if (v === null || v === undefined || isNaN(v)) return '–';
  const abs = Math.abs(v);
  const d = digits !== undefined ? digits : 2;
  if (abs >= 1e12) return (v/1e12).toFixed(d) + 'T';
  if (abs >= 1e9)  return (v/1e9).toFixed(d) + 'B';
  if (abs >= 1e6)  return (v/1e6).toFixed(d) + 'M';
  if (abs >= 1e3)  return (v/1e3).toFixed(d) + 'K';
  return Math.round(v).toLocaleString();
};

// Human-friendly label for a fund snapshot: "Fund Name (2023)" when both
// are present, else whichever is available. Tolerates old data where the
// fund name was stored in `vintage`.
const fundLabel = (soi) => {
  if (!soi) return '—';
  const fund = soi.fundName;
  const year = soi.vintage;
  if (fund && year) return `${fund} (${year})`;
  return fund || year || '—';
};
const today = () => new Date().toISOString().slice(0,10);

/* =============================================================================
   DATA MODEL
   ---------
   Store shape:
   {
     clients:   [{id, name, notes}]
     managers:  [{id, name, firm}]                 (e.g., "Nimbus Digital Capital")
     soIs:      [{id, managerId, vintage,
                  snapshots: [{id, asOfDate, notes,
                    positions: [ {id, positionName, ticker, quantity, soiPrice,
                                 costBasis, soiMarketValue, acquisitionDate, assetType,
                                 sectorId,          // our canonical GICS bucket
                                 forceLiquid,       // user flipped "mark as liquid after TGE"
                                 cgTokenId,         // optional: resolved CoinGecko coin id for live price
                                 chain, address,    // optional: onchain identity
                                 notes} ] }] }]
     commitments: [{id, clientId, managerId, soiId, committed, called}]
       // one client can commit to a manager/vintage. commitment data drives the
       // rollup: positions inside soi are scaled to the commitment's "called" value
       // implicitly (we treat the SOI's MV total as the called NAV for v1).
     sectorOverrides: { [symbolUpper]: sectorId }
     settings:  { cgApiKey, useLivePrices, lastRefresh }
   }
   ============================================================================= */

const STORE_KEY = 'catena.store.v5'; // v5: 11-sector taxonomy
const emptyStore = () => ({
  clients: [], managers: [], soIs: [], commitments: [],
  sectorOverrides: {}, sectors: DEFAULT_SECTORS,
  settings: { cgApiKey: '', useLivePrices: false, lastRefresh: null },
});

const loadStore = () => {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Basic shape validation
    if (!parsed.clients || !parsed.managers || !parsed.soIs || !parsed.commitments) return null;
    // Migrate: ensure sectors array exists for pre-Stage-4 stores
    if (!Array.isArray(parsed.sectors) || parsed.sectors.length === 0) parsed.sectors = DEFAULT_SECTORS;
    // Migrate: wrap legacy flat positions into snapshots array
    for (const soi of parsed.soIs) {
      if (!Array.isArray(soi.snapshots) || soi.snapshots.length === 0) {
        soi.snapshots = [{ id: soi.id + '_snap', asOfDate: soi.asOfDate || '', notes: soi.notes || '', positions: soi.positions || [] }];
        delete soi.positions;
        delete soi.asOfDate;
      }
    }
    // Migrate: reset legacy called values that were set to fund total MV
    for (const c of parsed.commitments) {
      const soi = parsed.soIs.find(s => s.id === c.soiId);
      if (!soi) continue;
      const fundTotalMV = _.sumBy(latestSnapshot(soi)?.positions || [], p => p.soiMarketValue || 0);
      if (fundTotalMV > 0 && c.called > 0 && Math.abs(c.called - fundTotalMV) / fundTotalMV < 0.01) {
        c.called = Math.round((c.committed || 0) * 0.7);
      }
    }
    // Migrate: add type field to managers (default 'direct' for pre-Stage-6 stores)
    for (const m of parsed.managers) {
      if (!m.type) m.type = 'direct';
    }
    // Migrate: add subCommitments array to every snapshot (default [] for pre-Stage-6 stores)
    for (const soi of parsed.soIs) {
      for (const snap of snapshotsOf(soi)) {
        if (!Array.isArray(snap.subCommitments)) snap.subCommitments = [];
      }
    }
    // Migrate: if stored sectors don't include the v5 'base-layer' bucket,
    // replace sectors with DEFAULT_SECTORS. Position sectorIds auto-resolve
    // via DEFAULT_TOKEN_SECTOR through resolveSector() so they pick up the
    // new buckets without explicit remapping.
    const hasV5Sectors = Array.isArray(parsed.sectors) && parsed.sectors.some(s => s && s.id === 'base-layer');
    if (!hasV5Sectors) parsed.sectors = DEFAULT_SECTORS;
    return { ...emptyStore(), ...parsed, settings: { ...emptyStore().settings, ...(parsed.settings || {}) } };
  } catch { return null; }
};
const saveStore = (store) => {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch {}
};

/* =============================================================================
   SEED DATA — 1 client, 2 managers, 4 vintages, realistic overlap
   ============================================================================= */
const seedStore = () => {
  const clientId = uid();
  const fwId = uid(), hackId = uid();
  const fw3Id = uid(), fw4Id = uid(), hack1Id = uid(), hack2Id = uid();
  const atlasId = uid(), atlasFundId = uid();

  const mkPos = (name, ticker, qty, price, mv, sectorId, date, opts={}) => ({
    id: uid(),
    positionName: name,
    ticker,
    quantity: qty,
    soiPrice: price,
    costBasis: opts.cost ?? null,
    soiMarketValue: mv,
    acquisitionDate: date,
    assetType: opts.assetType || (ticker ? 'Liquid Token' : 'SAFT'),
    sectorId,
    forceLiquid: opts.forceLiquid || false,
    cgTokenId: opts.cgTokenId || null,
    chain: opts.chain || null, address: opts.address || null,
    notes: opts.notes || '',
  });

  // --- Nimbus Digital Capital Token Growth Fund II (2021 vintage, older book, more liquid) ---
  const fw3Positions = [
    mkPos('Ethereum',         'ETH',   8500,   2200,  18_700_000, 'base-layer', '2021-05-15', { cost: 12_000_000, cgTokenId: 'ethereum' }),
    mkPos('Solana',           'SOL',   220000, 28,    6_160_000,  'base-layer', '2021-06-10', { cost: 1_500_000,  cgTokenId: 'solana' }),
    mkPos('Uniswap',          'UNI',   450000, 6.2,   2_790_000,  'defi',           '2021-07-01', { cost: 3_200_000,  cgTokenId: 'uniswap' }),
    mkPos('Chainlink',        'LINK',  280000, 14,    3_920_000,  'infrastructure',     '2021-04-20', { cost: 2_100_000,  cgTokenId: 'chainlink' }),
    mkPos('Lido DAO',         'LDO',   1400000,1.8,   2_520_000,  'defi',           '2022-01-11', { cost: 3_800_000,  cgTokenId: 'lido-dao' }),
    mkPos('Arbitrum',         'ARB',   3200000,0.75,  2_400_000,  'infrastructure', '2023-03-23', { cost: 2_200_000,  cgTokenId: 'arbitrum' }),
    mkPos('Optimism',         'OP',    1800000,1.65,  2_970_000,  'infrastructure', '2022-05-31', { cost: 1_900_000,  cgTokenId: 'optimism' }),
    mkPos('Aave',              'AAVE', 35000,  95,    3_325_000,  'defi',           '2021-09-14', { cost: 4_100_000,  cgTokenId: 'aave' }),
    mkPos('Synthetix SAFT',   '',      0,      0,     1_500_000,  'defi',           '2021-08-02', { assetType: 'SAFT' }),
    mkPos('Ocean Protocol',   'OCEAN', 5000000,0.55,  2_750_000,  'depin',     '2021-11-03', { cost: 1_800_000,  cgTokenId: 'ocean-protocol' }),
    mkPos('Axie Infinity',    'AXS',   180000, 6.8,   1_224_000,  'gaming',   '2021-10-05', { cost: 4_200_000,  cgTokenId: 'axie-infinity' }),
    mkPos('USDC',             'USDC',  2000000,1,     2_000_000,  'stablecoins',    '2022-12-01', { cgTokenId: 'usd-coin', forceLiquid: true }),
  ];

  // --- Nimbus Digital Capital Opportunity Fund III (2023 vintage, newer, more SAFTs + modern tokens) ---
  const fw4Positions = [
    mkPos('Ethereum',          'ETH',  6200,    2800, 17_360_000, 'base-layer', '2023-04-12', { cost: 15_500_000, cgTokenId: 'ethereum' }),
    mkPos('Solana',            'SOL',  150000,  95,   14_250_000, 'base-layer', '2023-02-20', { cost: 4_200_000,  cgTokenId: 'solana' }),
    mkPos('EigenLayer',        'EIGEN',800000,  3.2,  2_560_000,  'staking',     '2024-05-12', { cost: 2_100_000,  cgTokenId: 'eigenlayer' }),
    mkPos('Hyperliquid',       'HYPE', 280000,  24,   6_720_000,  'defi',           '2024-11-29', { cost: 3_500_000,  cgTokenId: 'hyperliquid' }),
    mkPos('Celestia',          'TIA',  400000,  5.8,  2_320_000,  'base-layer', '2023-11-01', { cost: 3_800_000,  cgTokenId: 'celestia' }),
    mkPos('Ondo Finance',      'ONDO', 2200000, 0.95, 2_090_000,  'rwa-credit',           '2024-01-18', { cost: 1_900_000,  cgTokenId: 'ondo-finance' }),
    mkPos('Pendle',            'PENDLE',300000, 4.1,  1_230_000,  'defi',           '2023-07-22', { cost: 800_000,    cgTokenId: 'pendle' }),
    mkPos('Jito',              'JTO',  600000,  3.2,  1_920_000,  'staking', '2023-12-07', { cost: 1_500_000,  cgTokenId: 'jito-governance-token' }),
    mkPos('Monad SAFT',        '',     0,       0,    3_500_000,  'base-layer', '2024-02-15', { assetType: 'SAFT', notes: 'Locked; TGE est H2 2026' }),
    mkPos('Berachain SAFT',    '',     0,       0,    2_800_000,  'base-layer', '2024-06-01', { assetType: 'SAFT', notes: 'Liquid since TGE Feb 2025', forceLiquid: true, ticker: 'BERA', cgTokenId: 'berachain-bera' }),
    mkPos('Movement SAFT',     '',     0,       0,    1_500_000,  'base-layer', '2024-04-20', { assetType: 'SAFT' }),
    mkPos('Story Protocol SAFT','',    0,       0,    1_800_000,  'consumer-media',   '2024-08-10', { assetType: 'SAFT' }),
    mkPos('USDC',              'USDC', 3000000, 1,    3_000_000,  'stablecoins',    '2024-01-01', { cgTokenId: 'usd-coin', forceLiquid: true }),
  ];

  // --- Vertex Crypto Partners Fund III (2022 vintage) ---
  const hack1Positions = [
    mkPos('Ethereum',          'ETH',  3500,    1600, 5_600_000,  'base-layer', '2022-06-20', { cost: 4_800_000, cgTokenId: 'ethereum' }),
    mkPos('Solana',            'SOL',  80000,   22,   1_760_000,  'base-layer', '2022-07-15', { cost: 3_200_000, cgTokenId: 'solana' }),
    mkPos('Aptos',             'APT',  400000,  7.5,  3_000_000,  'base-layer', '2022-10-18', { cost: 1_200_000, cgTokenId: 'aptos' }),
    mkPos('Sui',               'SUI',  2800000, 1.1,  3_080_000,  'base-layer', '2023-05-03', { cost: 1_500_000, cgTokenId: 'sui' }),
    mkPos('EigenLayer',        'EIGEN',500000,  3.2,  1_600_000,  'staking',     '2024-05-12', { cost: 1_400_000, cgTokenId: 'eigenlayer' }),
    mkPos('Render',            'RENDER',200000, 5.2,  1_040_000,  'depin',     '2022-11-25', { cost: 420_000,   cgTokenId: 'render-token' }),
    mkPos('dYdX',              'DYDX', 800000,  1.2,  960_000,    'defi',           '2022-08-30', { cost: 2_400_000, cgTokenId: 'dydx-chain' }),
    mkPos('Injective',         'INJ',  150000,  22,   3_300_000,  'base-layer', '2023-01-14', { cost: 800_000,   cgTokenId: 'injective-protocol' }),
    mkPos('Worldcoin',         'WLD',  400000,  2.8,  1_120_000,  'ai-compute',   '2023-07-24', { cost: 1_000_000, cgTokenId: 'worldcoin-wld' }),
    mkPos('Sei SAFT',          '',     0,       0,    900_000,    'base-layer', '2022-09-12', { assetType: 'SAFT', notes: 'Liquid since TGE', forceLiquid: true, ticker: 'SEI', cgTokenId: 'sei-network' }),
    mkPos('USDC',              'USDC', 1500000, 1,    1_500_000,  'stablecoins',    '2022-06-01', { cgTokenId: 'usd-coin', forceLiquid: true }),
  ];

  // --- Vertex Crypto Partners Fund IV (2024 vintage, AI + infra heavy) ---
  const hack2Positions = [
    mkPos('Ethereum',          'ETH',  4800,    3200, 15_360_000, 'base-layer', '2024-02-05', { cost: 14_000_000, cgTokenId: 'ethereum' }),
    mkPos('Solana',            'SOL',  95000,   135,  12_825_000, 'base-layer', '2024-01-20', { cost: 8_500_000,  cgTokenId: 'solana' }),
    mkPos('Hyperliquid',       'HYPE', 180000,  24,   4_320_000,  'defi',           '2024-11-29', { cost: 2_200_000,  cgTokenId: 'hyperliquid' }),
    mkPos('EigenLayer',        'EIGEN',1200000, 3.2,  3_840_000,  'staking',     '2024-05-12', { cost: 3_000_000,  cgTokenId: 'eigenlayer' }),
    mkPos('Bittensor',         'TAO',  9000,    420,  3_780_000,  'ai-compute',   '2024-03-11', { cost: 1_800_000,  cgTokenId: 'bittensor' }),
    mkPos('Fetch.ai',          'FET',  2500000, 1.3,  3_250_000,  'ai-compute',   '2024-04-02', { cost: 2_800_000,  cgTokenId: 'fetch-ai' }),
    mkPos('Jupiter',           'JUP',  3500000, 0.92, 3_220_000,  'defi',           '2024-01-31', { cost: 2_500_000,  cgTokenId: 'jupiter-exchange-solana' }),
    mkPos('Ethena',            'ENA',  5500000, 0.45, 2_475_000,  'defi',           '2024-04-02', { cost: 4_400_000,  cgTokenId: 'ethena' }),
    mkPos('Celestia',          'TIA',  300000,  5.8,  1_740_000,  'base-layer', '2024-01-15', { cost: 2_700_000,  cgTokenId: 'celestia' }),
    mkPos('Monad SAFT',        '',     0,       0,    2_500_000,  'base-layer', '2024-04-01', { assetType: 'SAFT', notes: 'Locked; TGE est H2 2026' }),
    mkPos('Grass SAFT',        '',     0,       0,    1_200_000,  'depin',     '2024-03-20', { assetType: 'SAFT', notes: 'Liquid since TGE', forceLiquid: true, ticker: 'GRASS', cgTokenId: 'grass-2' }),
    mkPos('Story Protocol SAFT','',    0,       0,    1_500_000,  'consumer-media',   '2024-08-10', { assetType: 'SAFT' }),
    mkPos('USDC',              'USDC', 4000000, 1,    4_000_000,  'stablecoins',    '2024-01-01', { cgTokenId: 'usd-coin', forceLiquid: true }),
  ];

  // --- Vertex Fund IV older snapshot (~85% qty, ~75% MV) ---
  const hack2PositionsOld = [
    mkPos('Ethereum',  'ETH',  4080,  2900, 11_520_000,'base-layer','2024-02-05',{cost:14_000_000,cgTokenId:'ethereum'}),
    mkPos('Solana',    'SOL',  80750, 115,   9_619_000,'base-layer','2024-01-20',{cost:8_500_000, cgTokenId:'solana'}),
    mkPos('Hyperliquid','HYPE',153000,18,    3_240_000,'defi',          '2024-11-29',{cost:2_200_000, cgTokenId:'hyperliquid'}),
    mkPos('EigenLayer','EIGEN',1020000,2.8,  2_880_000,'middleware',    '2024-05-12',{cost:3_000_000, cgTokenId:'eigenlayer'}),
    mkPos('Bittensor', 'TAO',  7650,  380,   2_835_000,'ai-compute',  '2024-03-11',{cost:1_800_000, cgTokenId:'bittensor'}),
    mkPos('Fetch.ai',  'FET',  2125000,1.1,  2_438_000,'ai-compute',  '2024-04-02',{cost:2_800_000, cgTokenId:'fetch-ai'}),
    mkPos('Jupiter',   'JUP',  2975000,0.78, 2_415_000,'defi',          '2024-01-31',{cost:2_500_000, cgTokenId:'jupiter-exchange-solana'}),
    mkPos('Ethena',    'ENA',  4675000,0.38, 1_856_000,'defi',          '2024-04-02',{cost:4_400_000, cgTokenId:'ethena'}),
    mkPos('Celestia',  'TIA',  255000, 5.2,  1_305_000,'base-layer','2024-01-15',{cost:2_700_000, cgTokenId:'celestia'}),
    mkPos('Monad SAFT','',     0,      0,    1_875_000,'infrastructure','2024-04-01',{assetType:'SAFT',notes:'Locked; TGE est H2 2026'}),
    mkPos('Grass SAFT','',     0,      0,      900_000,'middleware',    '2024-03-20',{assetType:'SAFT',notes:'Liquid since TGE',forceLiquid:true,ticker:'GRASS',cgTokenId:'grass-2'}),
    mkPos('Story Protocol SAFT','',0,  0,    1_125_000,'applications',  '2024-08-10',{assetType:'SAFT'}),
    mkPos('USDC',      'USDC', 3000000,1,    3_000_000,'stablecoins',   '2024-01-01',{cgTokenId:'usd-coin',forceLiquid:true}),
  ];

  return {
    clients: [{ id: clientId, name: 'Sample Family Office', notes: 'Seed demo client — illustrative only. All manager names, positions, and values are fictional.' }],
    managers: [
      { id: fwId,    name: 'Nimbus Digital Capital', firm: 'Nimbus', type: 'direct', socials: {} },
      { id: hackId,  name: 'Vertex Crypto Partners', firm: 'Vertex', type: 'direct', socials: {} },
      { id: atlasId, name: 'Atlas Capital Partners', firm: 'Atlas',  type: 'fund_of_funds', socials: {} },
    ],
    soIs: [
      { id: fw3Id,      managerId: fwId,    fundName: 'Token Growth Fund II', vintage: '2023', snapshots: [{ id: uid(), asOfDate: '2025-09-30', notes: '',                   positions: fw3Positions,  subCommitments: [] }] },
      { id: fw4Id,      managerId: fwId,    fundName: 'Opportunity Fund III',         vintage: '2024', snapshots: [{ id: uid(), asOfDate: '2025-09-30', notes: '',                   positions: fw4Positions,  subCommitments: [] }] },
      { id: hack1Id,    managerId: hackId,  fundName: 'Fund III',                  vintage: '2022', snapshots: [{ id: uid(), asOfDate: '2025-09-30', notes: '',                   positions: hack1Positions, subCommitments: [] }] },
      { id: hack2Id,    managerId: hackId,  fundName: 'Fund IV',                   vintage: '2024', snapshots: [
        { id: uid(), asOfDate: '2025-06-30', notes: 'Q2 2025 statement', positions: hack2PositionsOld, subCommitments: [] },
        { id: uid(), asOfDate: '2025-09-30', notes: 'Q3 2025 statement', positions: hack2Positions,    subCommitments: [] },
      ]},
      { id: atlasFundId, managerId: atlasId, fundName: 'Blockchain Fund II', vintage: '2022', snapshots: [{
        id: uid(), asOfDate: '2025-09-30', notes: 'Q3 2025 — FoF look-through statement', positions: [],
        subCommitments: [
          { id: uid(), toSoiId: fw4Id,   committed: 5_000_000, called: 3_500_000, distributions: 0 },
          { id: uid(), toSoiId: hack1Id, committed: 3_000_000, called: 2_100_000, distributions: 0 },
          { id: uid(), toSoiId: hack2Id, committed: 8_000_000, called: 5_600_000, distributions: 0 },
        ],
      }]},
    ],
    commitments: [
      { id: uid(), clientId, managerId: fwId,    soiId: fw3Id,      committed: 3_000_000, called: Math.round(3_000_000*0.7), distributions: 800_000 },
      { id: uid(), clientId, managerId: fwId,    soiId: fw4Id,      committed: 5_000_000, called: Math.round(5_000_000*0.7), distributions: 200_000 },
      { id: uid(), clientId, managerId: hackId,  soiId: hack1Id,    committed: 2_000_000, called: Math.round(2_000_000*0.7), distributions: 500_000 },
      { id: uid(), clientId, managerId: hackId,  soiId: hack2Id,    committed: 8_000_000, called: Math.round(8_000_000*0.7), distributions: 0 },
      { id: uid(), clientId, managerId: atlasId, soiId: atlasFundId, committed: 4_000_000, called: 2_800_000, distributions: 0 },
    ],
    sectorOverrides: {},
    sectors: DEFAULT_SECTORS,
    settings: { cgApiKey: '', useLivePrices: false, lastRefresh: null },
  };
};

/* =============================================================================
   SNAPSHOT HELPERS
   ============================================================================= */
const snapshotsOf = (soi) => {
  if (Array.isArray(soi.snapshots) && soi.snapshots.length) return soi.snapshots;
  // legacy fallback
  return [{ id: soi.id + '_snap', asOfDate: soi.asOfDate || '', notes: soi.notes || '', positions: soi.positions || [] }];
};
const latestSnapshot = (soi) => {
  const snaps = snapshotsOf(soi);
  return snaps.reduce((best, s) => (!best || (s.asOfDate || '') > (best.asOfDate || '')) ? s : best, null);
};
const sortedSnapshots = (soi) =>
  [...snapshotsOf(soi)].sort((a, b) => (a.asOfDate || '') < (b.asOfDate || '') ? -1 : 1);

/* =============================================================================
   ROLLUP ENGINE
   Given a store and a selection scope, return aggregated positions + metrics.
   Selection = { kind: 'firm' | 'client' | 'manager' | 'vintage', id? }
   ============================================================================= */
const getSelectedSOIs = (store, selection) => {
  if (!selection || selection.kind === 'firm') return store.soIs;
  if (selection.kind === 'client') {
    const soiIds = new Set(store.commitments.filter(c => c.clientId === selection.id).map(c => c.soiId));
    return store.soIs.filter(s => soiIds.has(s.id));
  }
  if (selection.kind === 'manager') return store.soIs.filter(s => s.managerId === selection.id);
  if (selection.kind === 'vintage') return store.soIs.filter(s => s.id === selection.id);
  return [];
};

// Legacy sectorIds from the pre-v5 taxonomy get remapped here so stored
// positions don't fall through to 'unclassified' when the app loads them.
const LEGACY_SECTOR_MAP = {
  'middleware':   'infrastructure',
  'applications': 'consumer-media',
};

const resolveSector = (position, overrides) => {
  const sym = String(position.ticker || '').toUpperCase().trim();
  if (sym && overrides[sym]) return overrides[sym];
  // Token map wins over stored sectorId so taxonomy updates auto-apply.
  if (sym && DEFAULT_TOKEN_SECTOR[sym]) return DEFAULT_TOKEN_SECTOR[sym];
  if (position.sectorId) return LEGACY_SECTOR_MAP[position.sectorId] || position.sectorId;
  return UNCLASSIFIED.id;
};

const isLiquid = (position) => {
  // Tri-state override: 'liquid' | 'illiquid' | 'auto' (default)
  if (position.liquidityOverride === 'liquid') return true;
  if (position.liquidityOverride === 'illiquid') return false;
  // Back-compat: old forceLiquid boolean flag
  if (position.forceLiquid) return true;
  if (position.assetType === 'SAFT' || position.assetType === 'Warrant' || position.assetType === 'SAFE') return false;
  return !!(position.ticker && position.quantity > 0);
};
const liquidityOverrideOf = (position) => {
  if (position.liquidityOverride) return position.liquidityOverride;
  if (position.forceLiquid) return 'liquid';
  return 'auto';
};

const computeRollup = (store, selection, livePrices, scaleBy = null) => {
  const soIs = getSelectedSOIs(store, selection);
  const managerById = Object.fromEntries(store.managers.map(m => [m.id, m]));

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
      const subCommitments = latestSnapshot(soi)?.subCommitments || [];
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
        const underlyingPositions = latestSnapshot(targetSoi)?.positions || [];
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
    for (const p of (latestSnapshot(soi)?.positions || [])) {
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
  for (const s of SECTORS) {
    if (!sectorBreakdown.find(x => x.id === s.id)) {
      sectorBreakdown.push({ id: s.id, label: s.label, color: s.color, value: 0, pct: 0, count: 0 });
    }
  }
  const sectorOrder = [...SECTORS.map(s=>s.id), 'unclassified'];
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
      asOfDate: latestSnapshot(soi)?.asOfDate,
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

/* =============================================================================
   COINGECKO LIVE PRICES (by coin id, batch)
   ============================================================================= */
const CG_BASE = 'https://api.coingecko.com/api/v3';

/* Embedded CoinGecko Demo API key.
   The site ships with a key so users don't have to paste one into Settings.

   Preferred: set VITE_COINGECKO_API_KEY in .env (local) and in your host's
   environment variables (e.g. Vercel → Project → Settings → Environment
   Variables). Vite inlines it at build time.

   Fallback: replace the empty string below with a literal 'CG-xxxxxxxx' key.
   Easier for a quick demo, but anyone who views the page source can read it.
   For a public production deploy, proxy CoinGecko through a small backend
   instead of shipping the key. */
const EMBEDDED_CG_API_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_COINGECKO_API_KEY) ||
  'CG-7PkUvXxmyBFtFXTB7HJSkX5e';

/* The effective key: a Settings-drawer override wins (useful if someone
   wants to test a different key without a rebuild), otherwise the embedded one. */
const resolveApiKey = (storeKey) => {
  const trimmed = (storeKey || '').trim();
  return trimmed || EMBEDDED_CG_API_KEY;
};

/* =============================================================================
   CRYPTORANK API (market data endpoints only on demo tariff).
   Fund / company / fundraising endpoints require a paid plan.
   ============================================================================= */
const CR_BASE = 'https://api.cryptorank.io/v2';
const EMBEDDED_CR_API_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_CRYPTORANK_API_KEY) ||
  '82065ff0e0427de4c4a2d7cfb57e8e83f1ee76daf7d62557dce888814c01';

/* Fetch helper. Returns { data, error }.  Wrapped for future endpoints once
   the user upgrades the tariff and gets /v2/funds, /v2/companies, etc. */
const cryptorankFetch = async (path) => {
  try {
    const res = await fetch(`${CR_BASE}${path}`, {
      headers: { 'X-Api-Key': EMBEDDED_CR_API_KEY },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { data: null, error: `CryptoRank ${res.status}: ${body.slice(0,200)}` };
    }
    return { data: await res.json(), error: null };
  } catch (e) {
    return { data: null, error: e?.message || 'network error' };
  }
};

/* Shared context of ticker -> high-quality logo URL, fetched once from
   CryptoRank and cached in localStorage so we only hit the API on first
   browser load. TokenIcon pulls from this for its primary source. */
const TokenImageContext = createContext({ crMap: {}, cmcIdMap: {} });
const TOKEN_IMAGES_CACHE_KEY = 'catena.tokenImages.v2';
const CMC_ID_CACHE_KEY = 'catena.cmcIds.v2';

const loadTokenImagesCache = () => {
  try {
    const raw = localStorage.getItem(TOKEN_IMAGES_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Expire after 7 days — images don't change often but we shouldn't cache forever.
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > 7 * 24 * 60 * 60 * 1000) return null;
    return parsed.map || null;
  } catch { return null; }
};

const saveTokenImagesCache = (map) => {
  try { localStorage.setItem(TOKEN_IMAGES_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), map })); } catch {}
};

const loadCmcIdCache = () => {
  try {
    const raw = localStorage.getItem(CMC_ID_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > 30 * 24 * 60 * 60 * 1000) return null;
    return parsed.map || null;
  } catch { return null; }
};

const saveCmcIdCache = (map) => {
  try { localStorage.setItem(CMC_ID_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), map })); } catch {}
};

// Fetch up to 1000 tokens' metadata from CryptoRank and build a
// { TICKER_UPPER: imageUrl } map. Uses at most 1 API credit per session.
const fetchTokenImagesMap = async () => {
  const { data, error } = await cryptorankFetch('/currencies?limit=1000');
  if (error || !data?.data) return null;
  const map = {};
  for (const c of data.data) {
    if (!c.symbol) continue;
    const img = c.images?.x60 || c.images?.x150 || c.images?.icon || c.images?.native;
    if (img) map[String(c.symbol).toUpperCase()] = img;
  }
  return map;
};

/* =============================================================================
   COINMARKETCAP API (CORS open on Pro API; logo CDN is public).
   The Pro API's /cryptocurrency/map endpoint gives ticker → CMC id mapping,
   which we turn into logo URLs of the form:
     https://s2.coinmarketcap.com/static/img/coins/64x64/{id}.png
   ============================================================================= */
const EMBEDDED_CMC_API_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_COINMARKETCAP_API_KEY) ||
  'a88a40ca0937478c9263d39a1fbf5a62';
const CMC_IMG = (id) => `https://s2.coinmarketcap.com/static/img/coins/64x64/${id}.png`;
// CoinMarketCap serves animated GIFs at the same path with a .gif extension
// for a subset of top tokens (BTC, XRP, SOL, DOGE, etc.). Tokens without an
// animated version respond 403, which onError catches and falls through to
// the static PNG. Browser cache keeps it cheap on subsequent loads.
const CMC_GIF = (id) => `https://s2.coinmarketcap.com/static/img/coins/64x64/${id}.gif`;

const cmcFetch = async (path) => {
  try {
    const res = await fetch(`https://pro-api.coinmarketcap.com${path}`, {
      headers: { 'X-CMC_PRO_API_KEY': EMBEDDED_CMC_API_KEY, 'Accept': 'application/json' },
    });
    if (!res.ok) return { data: null, error: `CMC ${res.status}` };
    return { data: await res.json(), error: null };
  } catch (e) {
    return { data: null, error: e?.message || 'network error' };
  }
};

// Fetch the top 5000 tokens from CMC's symbol→id map. Used once per browser.
const fetchCmcIdMap = async () => {
  const { data, error } = await cmcFetch('/v1/cryptocurrency/map?limit=5000&sort=cmc_rank');
  if (error || !data?.data) return null;
  const map = {};
  for (const c of data.data) {
    if (c.symbol && c.id && !map[String(c.symbol).toUpperCase()]) {
      map[String(c.symbol).toUpperCase()] = c.id;
    }
  }
  return map;
};
const fetchLivePrices = async (tokenIds, apiKey) => {
  const ids = _.uniq(tokenIds).filter(Boolean);
  if (!ids.length) return { prices: {}, error: null };
  const withKey = (u) => apiKey ? u + (u.includes('?') ? '&' : '?') + `x_cg_demo_api_key=${encodeURIComponent(apiKey)}` : u;
  const out = {};
  const batches = _.chunk(ids, 100);
  for (const batch of batches) {
    try {
      const url = `${CG_BASE}/simple/price?ids=${batch.join(',')}&vs_currencies=usd&include_24hr_change=true`;
      const res = await fetch(withKey(url));
      if (res.status === 401 || res.status === 403) return { prices: out, error: 'Invalid API key.' };
      if (res.status === 429) return { prices: out, error: 'Rate limited (30 req/min on Demo).' };
      if (!res.ok) return { prices: out, error: `CoinGecko returned ${res.status}.` };
      const data = await res.json();
      for (const [id, v] of Object.entries(data)) {
        out[id] = { usd: v.usd, change24h: v.usd_24h_change ?? null };
      }
    } catch (e) {
      return { prices: out, error: 'Network error.' };
    }
    await new Promise(r => setTimeout(r, 1200));
  }
  return { prices: out, error: null };
};

/* Historical prices: fetch up to N days of daily closes for a list of coin ids.
   Returns { [coinId]: { [utcMidnightMs]: closePrice } }
   Uses /coins/{id}/market_chart?vs_currency=usd&days=N&interval=daily
   Rate-limited: ~2s between calls for Demo tier. */
const fetchCoinDetail = async (cgTokenId, apiKey) => {
  if (!cgTokenId) return { data: null, error: 'No CoinGecko ID for this token' };
  const withKey = (u) => apiKey ? u + (u.includes('?') ? '&' : '?') + `x_cg_demo_api_key=${encodeURIComponent(apiKey)}` : u;
  const url = `${CG_BASE}/coins/${encodeURIComponent(cgTokenId)}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`;
  try {
    const res = await fetch(withKey(url));
    if (!res.ok) return { data: null, error: `CoinGecko ${res.status}` };
    return { data: await res.json(), error: null };
  } catch (e) { return { data: null, error: e?.message || 'Network error' }; }
};

const fetchCoinChart = async (cgTokenId, days, apiKey) => {
  if (!cgTokenId) return { data: null, error: 'No CoinGecko ID' };
  const withKey = (u) => apiKey ? u + (u.includes('?') ? '&' : '?') + `x_cg_demo_api_key=${encodeURIComponent(apiKey)}` : u;
  const url = `${CG_BASE}/coins/${encodeURIComponent(cgTokenId)}/market_chart?vs_currency=usd&days=${days}`;
  try {
    const res = await fetch(withKey(url));
    if (!res.ok) return { data: null, error: `CoinGecko ${res.status}` };
    return { data: await res.json(), error: null };
  } catch (e) { return { data: null, error: e?.message || 'Network error' }; }
};

const fetchHistory = async (tokenIds, days, apiKey, onProgress) => {
  const ids = _.uniq(tokenIds).filter(Boolean);
  if (!ids.length) return { history: {}, error: null };
  const withKey = (u) => apiKey ? u + (u.includes('?') ? '&' : '?') + `x_cg_demo_api_key=${encodeURIComponent(apiKey)}` : u;
  const out = {};
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    try {
      const url = `${CG_BASE}/coins/${id}/market_chart?vs_currency=usd&days=${days}&interval=daily`;
      const res = await fetch(withKey(url));
      if (res.status === 401 || res.status === 403) return { history: out, error: 'Invalid API key.' };
      if (res.status === 429) { await new Promise(r => setTimeout(r, 5000)); i--; continue; }
      if (!res.ok) { onProgress?.(i + 1, ids.length, id, `HTTP ${res.status}`); continue; }
      const data = await res.json();
      const byDay = {};
      for (const [ts, price] of (data.prices || [])) {
        const dayKey = Math.floor(ts / 86400000) * 86400000;
        byDay[dayKey] = price;
      }
      out[id] = byDay;
      onProgress?.(i + 1, ids.length, id, null);
    } catch (e) {
      onProgress?.(i + 1, ids.length, id, 'network');
    }
    await new Promise(r => setTimeout(r, 2100));
  }
  return { history: out, error: null };
};

/* Build a NAV time series for a set of positions given priceHistory.
   positions: [{quantity, soiMarketValue, acquisitionDate, cgTokenId, liquid}]
   Returns [{date: ms, value: usd}] covering the requested range.
   Used for ManagersTab sparklines. */
const buildNAVSeriesSimple = (positions, priceHistory, startMs, endMs) => {
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

/* Build a NAV time series for soiBundles (SOIs with snapshots).
   Supports multiple snapshots per SOI — uses the latest snapshot active at each day.
   Returns { series, earliestSnapshotMs, latestSnapshotMs, snapshotDates }. */
const buildNAVSeries = (soiBundles, priceHistory, startMs, endMs, scaleFn = null) => {
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

const rangeToStartMs = (rangeId, positions) => {
  const now = Date.now();
  const dayMs = 86400000;
  if (rangeId === '1D') return now - dayMs;
  if (rangeId === 'MTD') {
    const d = new Date(); d.setUTCDate(1); d.setUTCHours(0,0,0,0);
    return d.getTime();
  }
  if (rangeId === 'YTD') {
    const d = new Date(); d.setUTCMonth(0, 1); d.setUTCHours(0,0,0,0);
    return d.getTime();
  }
  if (rangeId === '1Y') return now - 365 * dayMs;
  if (rangeId === '5Y') return now - 5 * 365 * dayMs;
  if (rangeId === 'SI') {
    // Since earliest acquisition date in the selection
    const dates = positions.map(p => p.acquisitionDate ? new Date(p.acquisitionDate).getTime() : null).filter(Boolean);
    return dates.length ? Math.min(...dates) : (now - 365 * dayMs);
  }
  return now - 30 * dayMs;
};
const rangeToDays = (rangeId, positions) => {
  const startMs = rangeToStartMs(rangeId, positions);
  return Math.max(2, Math.ceil((Date.now() - startMs) / 86400000));
};

/* =============================================================================
   SHARED UI PRIMITIVES
   ============================================================================= */
const Panel = ({ children, className='', style={}, ...rest }) => (
  <div {...rest}
    className={`rounded-lg ${className}`}
    style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}`, ...style }}>
    {children}
  </div>
);

const KPI = ({ label, value, sub, tone }) => {
  const toneColor = tone === 'up' ? GREEN : tone === 'down' ? RED : TEXT;
  return (
    <Panel className="p-4">
      <div className="text-[11px] uppercase tracking-wider" style={{ color: TEXT_MUTE }}>{label}</div>
      <div className="text-2xl font-semibold mt-1" style={{ color: toneColor }}>{value}</div>
      {sub && <div className="text-xs mt-1" style={{ color: TEXT_DIM }}>{sub}</div>}
    </Panel>
  );
};

const Pill = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className="px-2.5 py-1 rounded text-xs font-medium transition-colors"
    style={{
      color: active ? BG : TEXT_DIM,
      backgroundColor: active ? ACCENT : 'transparent',
      border: `1px solid ${active ? ACCENT : BORDER}`,
    }}>
    {children}
  </button>
);

const Tab = ({ active, onClick, children, icon: Icon }) => (
  <button onClick={onClick}
    className="px-4 py-2 text-sm font-medium flex items-center gap-2 transition-colors"
    style={{
      color: active ? TEXT : TEXT_DIM,
      borderBottom: `2px solid ${active ? ACCENT : 'transparent'}`,
    }}>
    {Icon && <Icon size={14} />}{children}
  </button>
);

/* Top-nav button — used in the primary header row for Home / Portfolios / Managers.
   Styled to echo the Portfolio Workbench nav: uppercase label, quiet until active,
   active state fills with the darker panel color. `hasCaret` shows a ChevronDown
   for buttons that open a dropdown (Portfolios / Managers). */
/* Read-only breadcrumb shown in the context row. Navigates via click on
   each crumb (except the leaf). Reflects the current selection + SOI drilldown. */
const Breadcrumb = ({ store, selection, drilldownSoi, onCrumb }) => {
  const crumbs = [];
  if (selection.kind === 'firm') {
    crumbs.push({ label: 'Firm-wide', icon: Home, onClick: null });
  } else if (selection.kind === 'client') {
    const c = store.clients.find(x => x.id === selection.id);
    crumbs.push({ label: 'Portfolios', icon: Users, onClick: () => onCrumb({ kind: 'firm' }) });
    crumbs.push({ label: c?.name || '—', icon: null, onClick: null });
  } else if (selection.kind === 'manager') {
    const m = store.managers.find(x => x.id === selection.id);
    crumbs.push({ label: 'Managers', icon: Briefcase, onClick: () => onCrumb({ kind: 'firm' }) });
    crumbs.push({ label: m?.name || '—', icon: null, onClick: null });
  } else if (selection.kind === 'vintage') {
    const v = store.soIs.find(x => x.id === selection.id);
    const m = v ? store.managers.find(x => x.id === v.managerId) : null;
    crumbs.push({ label: 'Managers', icon: Briefcase, onClick: () => onCrumb({ kind: 'firm' }) });
    if (m) crumbs.push({ label: m.name, icon: null, onClick: () => onCrumb({ kind: 'manager', id: m.id }) });
    crumbs.push({ label: v?.vintage || '—', icon: null, onClick: null });
  }
  if (drilldownSoi) {
    const v = store.soIs.find(x => x.id === drilldownSoi);
    const m = v ? store.managers.find(x => x.id === v.managerId) : null;
    if (m && !crumbs.some(c => c.label === m.name)) crumbs.push({ label: m.name, icon: null, onClick: () => onCrumb({ kind: 'manager', id: m.id }) });
    if (v && !crumbs.some(c => c.label === v.vintage)) crumbs.push({ label: v.vintage, icon: null, onClick: null });
  }
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {crumbs.map((c, i) => {
        const isLeaf = i === crumbs.length - 1;
        const Icon = c.icon;
        const content = (
          <span className="flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors"
            style={{
              color: isLeaf ? TEXT : TEXT_DIM,
              backgroundColor: isLeaf ? PANEL_2 : 'transparent',
              fontWeight: isLeaf ? 600 : 400,
              cursor: c.onClick ? 'pointer' : 'default',
            }}>
            {Icon && <Icon size={12} style={{ color: isLeaf ? ACCENT_2 : TEXT_MUTE }} />}
            {c.label}
          </span>
        );
        return (
          <React.Fragment key={i}>
            {i > 0 && <ChevronRight size={10} style={{ color: TEXT_MUTE }} />}
            {c.onClick ? <button onClick={c.onClick}>{content}</button> : content}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const NavButton = ({ active, onClick, children, icon: Icon, hasCaret }) => (
  <button onClick={onClick}
    className="px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
    style={{
      color: active ? TEXT : TEXT_DIM,
      backgroundColor: active ? PANEL_2 : 'transparent',
    }}>
    {Icon && <Icon size={13} />}{children}{hasCaret && <ChevronDown size={12} style={{opacity: 0.7}} />}
  </button>
);

/* A row of small social-link chips for a manager. Returns null if no socials.
   Links open in a new tab with noopener/noreferrer. */
const ManagerSocials = ({ socials }) => {
  if (!socials) return null;
  const items = [];
  if (socials.website)  items.push({ icon: Globe,    label: 'Website',  url: socials.website });
  if (socials.twitter)  items.push({ icon: Twitter,  label: 'X',        url: socials.twitter });
  if (socials.linkedin) items.push({ icon: Linkedin, label: 'LinkedIn', url: socials.linkedin });
  if (items.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5">
      {items.map((it, i) => (
        <a key={i} href={it.url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors"
          style={{ backgroundColor: PANEL_2, border: `1px solid ${BORDER}`, color: TEXT_DIM }}
          title={it.label}>
          <it.icon size={11} />
          <span>{it.label}</span>
          <ExternalLink size={9} style={{ opacity: 0.6 }} />
        </a>
      ))}
    </div>
  );
};

/* Click-to-edit text. Renders plain text until clicked; then becomes an
   inline input. Enter/blur saves; Escape cancels. Used for renaming the
   client portfolio title, manager names, etc. */
const EditableText = ({ value, onCommit, placeholder, className, style, tag = 'span' }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  useEffect(() => { if (!editing) setDraft(value || ''); }, [value, editing]);

  const commit = () => {
    setEditing(false);
    const trimmed = (draft || '').trim();
    if (trimmed !== (value || '').trim()) onCommit?.(trimmed);
  };
  const cancel = () => { setDraft(value || ''); setEditing(false); };

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } if (e.key === 'Escape') { e.preventDefault(); cancel(); } }}
        className={className}
        style={{
          background: 'transparent',
          border: 'none',
          borderBottom: `2px solid ${ACCENT}`,
          outline: 'none',
          padding: 0,
          color: TEXT,
          width: '100%',
          font: 'inherit',
          ...style,
        }}
        placeholder={placeholder}
      />
    );
  }
  const Tag = tag;
  const displayValue = value && String(value).length ? value : (placeholder || 'Click to edit');
  const isPlaceholder = !value || String(value).length === 0;
  return (
    <Tag
      onClick={() => setEditing(true)}
      className={className}
      style={{
        cursor: 'text',
        borderBottom: `1px dashed transparent`,
        ...style,
        color: isPlaceholder ? TEXT_MUTE : (style && style.color) || undefined,
        fontStyle: isPlaceholder ? 'italic' : undefined,
      }}
      title="Click to edit"
      onMouseEnter={(e) => { e.currentTarget.style.borderBottomColor = BORDER; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderBottomColor = 'transparent'; }}
    >
      {displayValue}
    </Tag>
  );
};

/* Token logo. Tries three sources in order:
     1. CryptoRank image map (from TokenImageContext) — high-quality, matches
        CoinGecko / CoinMarketCap-style logos.
     2. atomiclabs/cryptocurrency-icons via jsdelivr (covers top ~500 tokens).
     3. Letter-in-a-circle chip fallback. */
const TokenIcon = ({ ticker, name, size = 20 }) => {
  const ctx = useContext(TokenImageContext) || {};
  const crMap = ctx.crMap || {};
  const cmcIdMap = ctx.cmcIdMap || {};
  const symbol = (ticker || '').trim();
  const symbolLower = symbol.toLowerCase();
  const symbolUpper = symbol.toUpperCase();
  const cmcId = cmcIdMap[symbolUpper];
  const crImage = crMap[symbolUpper];
  const sources = [];
  if (cmcId) sources.push(CMC_GIF(cmcId));  // primary: CoinMarketCap animated (if available)
  if (cmcId) sources.push(CMC_IMG(cmcId));  // secondary: CoinMarketCap static PNG
  if (crImage) sources.push(crImage);        // tertiary: CryptoRank image
  if (symbolLower) sources.push(`https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@master/svg/color/${symbolLower}.svg`);
  const [stage, setStage] = useState(0);
  useEffect(() => { setStage(0); }, [symbolUpper, cmcId, crImage]);
  const src = sources[stage];
  if (!symbol || !src) {
    const letter = ((ticker || name || '?').trim().charAt(0) || '?').toUpperCase();
    return (
      <div style={{
        width: size, height: size, borderRadius: size/2,
        backgroundColor: PANEL_2, color: TEXT_DIM,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: Math.max(9, Math.round(size * 0.5)), fontWeight: 600,
        border: `1px solid ${BORDER}`,
        flexShrink: 0,
      }}>{letter}</div>
    );
  }
  return (
    <img
      src={src}
      width={size} height={size}
      alt={ticker || name || ''}
      decoding="async"
      onError={() => setStage(stage + 1)}
      style={{ borderRadius: size/2, flexShrink: 0, backgroundColor: 'transparent', objectFit: 'cover' }}
    />
  );
};

const OpenTokenDetailContext = createContext(() => {});

const MOVER_RANGES = [
  { id: '1D',  label: '1D'  },
  { id: 'MTD', label: 'MTD' },
  { id: 'YTD', label: 'YTD' },
  { id: '1Y',  label: '1Y'  },
  { id: '5Y',  label: '5Y'  },
];

const DETAIL_RANGES = [
  { id: '1',   label: '24h' },
  { id: '7',   label: '7D'  },
  { id: '30',  label: '1M'  },
  { id: '90',  label: '3M'  },
  { id: '365', label: '1Y'  },
  { id: 'max', label: 'All' },
];

function TokenDetailDrawer({ token, onClose, apiKey, store }) {
  const [coin, setCoin] = useState(null);
  const [chart, setChart] = useState(null);
  const [range, setRange] = useState('365');
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token?.cgTokenId) {
      setError('This position has no CoinGecko ID linked.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true); setError(null);
    (async () => {
      const [coinRes, chartRes] = await Promise.all([
        fetchCoinDetail(token.cgTokenId, apiKey),
        fetchCoinChart(token.cgTokenId, '365', apiKey),
      ]);
      if (cancelled) return;
      if (coinRes.error) setError(coinRes.error);
      setCoin(coinRes.data);
      setChart(chartRes.data);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [token?.cgTokenId, apiKey]);

  useEffect(() => {
    if (!token?.cgTokenId || range === '365') return;
    let cancelled = false;
    setChartLoading(true);
    (async () => {
      const r = await fetchCoinChart(token.cgTokenId, range, apiKey);
      if (!cancelled) {
        if (r.data) setChart(r.data);
        setChartLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token?.cgTokenId, range, apiKey]);

  const m = coin?.market_data;
  const price = m?.current_price?.usd ?? null;
  const change24h = m?.price_change_percentage_24h ?? null;
  const positive = change24h != null ? change24h >= 0 : true;
  const lineColor = positive ? GREEN : RED;

  const series = useMemo(() => {
    if (!chart?.prices) return [];
    return chart.prices.map(([t, p]) => ({ t, p }));
  }, [chart]);

  const fmtPrice = (v) => {
    if (v == null || isNaN(v)) return '–';
    const abs = Math.abs(v);
    const digits = abs < 0.01 ? 6 : abs < 1 ? 4 : 2;
    return '$' + v.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  };

  return (
    <>
      <div onClick={onClose}
        style={{ position: 'fixed', inset: 0, backgroundColor: '#000', opacity: 0.55, zIndex: 90 }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: expanded ? 'min(1200px, 96vw)' : 540, maxWidth: '100vw',
        backgroundColor: PANEL, borderLeft: `1px solid ${BORDER}`, zIndex: 91,
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
        boxShadow: '-20px 0 60px rgba(0,0,0,0.5)',
        transition: 'width 200ms cubic-bezier(0.22, 1, 0.36, 1)',
      }}>
        <div style={{ padding: 20, borderBottom: `1px solid ${BORDER}`, position: 'sticky', top: 0, backgroundColor: PANEL, zIndex: 2 }}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <TokenIcon ticker={token.symbol || token.ticker} name={token.name} size={40} />
              <div className="min-w-0">
                <div className="text-lg font-bold truncate tracking-tight" style={{ color: TEXT }}>{coin?.name || token.name || token.symbol}</div>
                <div className="text-xs" style={{ color: TEXT_DIM }}>
                  {(token.symbol || token.ticker || '').toUpperCase()}
                  {coin?.market_cap_rank ? ` · Rank #${coin.market_cap_rank}` : ''}
                  {token.cgTokenId ? ` · ${token.cgTokenId}` : ''}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded flex-shrink-0"
              style={{ color: TEXT_DIM, backgroundColor: PANEL_2, border: `1px solid ${BORDER}` }}
              title="Close"><X size={14}/></button>
          </div>
          {price != null && (
            <div className="flex items-baseline gap-3 mt-4 flex-wrap">
              <div className="text-3xl font-bold tracking-tight tabular-nums"
                style={{ color: TEXT, textShadow: '0 0 1px rgba(255,255,255,0.08)' }}>
                {fmtPrice(price)}
              </div>
              {change24h != null && (
                <div style={{ color: positive ? GREEN : RED }} className="text-base font-semibold">
                  {positive ? '▲' : '▼'} {fmtPctSigned(change24h, 2)} <span style={{ color: TEXT_DIM }}>24h</span>
                </div>
              )}
            </div>
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-center p-10 text-xs gap-2" style={{ color: TEXT_DIM }}>
            <RefreshCw size={14} className="animate-spin" /> Loading from CoinGecko…
          </div>
        )}

        {error && !coin && (
          <div className="p-5 text-xs m-4 rounded" style={{ backgroundColor: RED + '11', color: RED, border: `1px solid ${RED}44` }}>
            {error}
          </div>
        )}

        {coin && (
          <>
            <div style={{ padding: 20, borderBottom: `1px solid ${BORDER}` }}>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs uppercase tracking-wider" style={{ color: TEXT_MUTE }}>Price history</div>
                <div className="flex items-center gap-1">
                  {DETAIL_RANGES.map(r => (
                    <Pill key={r.id} active={range === r.id} onClick={() => setRange(r.id)}>{r.label}</Pill>
                  ))}
                </div>
              </div>
              {series.length > 0 ? (
                <div style={{ height: 200, position: 'relative' }}>
                  {chartLoading && (
                    <div style={{ position: 'absolute', top: 4, right: 4, zIndex: 1 }}>
                      <RefreshCw size={12} className="animate-spin" style={{ color: TEXT_DIM }} />
                    </div>
                  )}
                  <ResponsiveContainer>
                    <AreaChart data={series} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="tokenDetailGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={lineColor} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="t" tick={{ fontSize: 10, fill: TEXT_MUTE }} axisLine={false} tickLine={false}
                        tickFormatter={(ms) => {
                          const d = new Date(ms);
                          if (range === '1') return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                          if (range === '7' || range === '30') return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
                          return d.toLocaleDateString([], { month: 'short', year: '2-digit' });
                        }} minTickGap={40} />
                      <YAxis tick={{ fontSize: 10, fill: TEXT_MUTE }} axisLine={false} tickLine={false} width={55}
                        tickFormatter={(v) => v >= 1 ? '$' + v.toFixed(0) : '$' + v.toFixed(3)} />
                      <Tooltip
                        contentStyle={{ backgroundColor: PANEL_2, border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 12 }}
                        labelStyle={{ color: TEXT_DIM }}
                        itemStyle={{ color: TEXT }}
                        labelFormatter={(ms) => new Date(ms).toLocaleString()}
                        formatter={(v) => [fmtPrice(v), 'Price']} />
                      <Area type="monotone" dataKey="p" stroke={lineColor} strokeWidth={1.5} fill="url(#tokenDetailGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-xs p-6 rounded text-center" style={{ backgroundColor: PANEL_2, color: TEXT_DIM, border: `1px dashed ${BORDER}` }}>
                  No chart data returned.
                </div>
              )}
            </div>

            {(() => {
              if (!store || !token) return null;
              const sym = (token.symbol || token.ticker || '').toUpperCase();
              const cg = token.cgTokenId;
              const rows = [];
              for (const soi of (store.soIs || [])) {
                const snap = latestSnapshot(soi);
                if (!snap) continue;
                const mgr = (store.managers || []).find(m => m.id === soi.managerId);
                for (const p of (snap.positions || [])) {
                  const match = (p.cgTokenId && cg && p.cgTokenId === cg) ||
                                (sym && (p.ticker || '').toUpperCase() === sym);
                  if (!match) continue;
                  rows.push({ manager: mgr, soi, position: p, asOfDate: snap.asOfDate });
                }
              }
              if (rows.length === 0) return null;
              const totalValue = rows.reduce((sum, r) => sum + (r.position.soiMarketValue || 0), 0);
              return (
                <div style={{ padding: 20, borderBottom: `1px solid ${BORDER}` }}>
                  <div className="flex items-baseline justify-between mb-3">
                    <div className="text-xs uppercase tracking-wider" style={{ color: TEXT_MUTE }}>Your exposure</div>
                    <div className="text-[10px]" style={{ color: TEXT_DIM }}>
                      {rows.length} {rows.length === 1 ? 'fund' : 'funds'} · {fmtCurrency(totalValue)}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {rows.map((r, i) => (
                      <div key={i} className="flex items-baseline justify-between gap-2 text-xs py-1"
                        style={{ borderBottom: i < rows.length - 1 ? `1px solid ${BORDER}` : 'none', paddingBottom: 8 }}>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate" style={{ color: TEXT }}>{r.manager?.name || '?'}</div>
                          <div className="text-[10px] truncate" style={{ color: TEXT_DIM }}>
                            {fundLabel(r.soi)}
                            {r.position.acquisitionDate && ` · as of ${r.position.acquisitionDate}`}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="tabular-nums font-semibold" style={{ color: TEXT }}>{fmtCurrency(r.position.soiMarketValue)}</div>
                          {r.position.quantity > 0 && (
                            <div className="text-[10px] tabular-nums" style={{ color: TEXT_DIM }}>
                              {fmtNum(r.position.quantity, 2)} {r.position.ticker}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            <div style={{ padding: 20, borderBottom: `1px solid ${BORDER}` }}>
              <div className="text-xs uppercase tracking-wider mb-3" style={{ color: TEXT_MUTE }}>Market</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <DetailStat label="Market Cap" value={fmtCurrency(m?.market_cap?.usd)} />
                <DetailStat label="24h Volume" value={fmtCurrency(m?.total_volume?.usd)} />
                <DetailStat label="FDV" value={fmtCurrency(m?.fully_diluted_valuation?.usd)} />
                <DetailStat label="Vol / Mkt Cap"
                  value={(m?.market_cap?.usd && m?.total_volume?.usd) ? ((m.total_volume.usd / m.market_cap.usd) * 100).toFixed(2) + '%' : '–'} />
                <DetailStat label="Supply"
                  value={m?.circulating_supply ? fmtNum(m.circulating_supply) : null}
                  sub={m?.total_supply && m.circulating_supply && m.total_supply !== m.circulating_supply ? `Total: ${fmtNum(m.total_supply)}` : null} />
                <DetailStat label="ATH"
                  value={m?.ath?.usd ? fmtPrice(m.ath.usd) : '–'}
                  sub={m?.ath_change_percentage?.usd != null ? fmtPctSigned(m.ath_change_percentage.usd, 1) + ' from ATH' : null} />
                <DetailStat label="ATL"
                  value={m?.atl?.usd ? fmtPrice(m.atl.usd) : '–'}
                  sub={m?.atl_change_percentage?.usd != null ? fmtPctSigned(m.atl_change_percentage.usd, 0) + ' from ATL' : null} />
                <DetailStat label="Change (7d)"
                  value={m?.price_change_percentage_7d != null ? fmtPctSigned(m.price_change_percentage_7d, 2) : '–'} />
              </div>
            </div>

            {coin.links && (
              <div style={{ padding: 20, borderBottom: `1px solid ${BORDER}` }}>
                <div className="text-xs uppercase tracking-wider mb-3" style={{ color: TEXT_MUTE }}>Links</div>
                <div className="flex flex-wrap gap-1.5">
                  {coin.links.homepage?.[0] && <DetailLink href={coin.links.homepage[0]} icon={Globe} label="Website" />}
                  {coin.links.twitter_screen_name && <DetailLink href={`https://twitter.com/${coin.links.twitter_screen_name}`} icon={Twitter} label="X" />}
                  {coin.links.subreddit_url && <DetailLink href={coin.links.subreddit_url} icon={Globe} label="Reddit" />}
                  {coin.links.telegram_channel_identifier && <DetailLink href={`https://t.me/${coin.links.telegram_channel_identifier}`} icon={Globe} label="Telegram" />}
                  {(coin.links.blockchain_site || []).filter(Boolean).slice(0, 2).map((url, i) => (
                    <DetailLink key={i} href={url} icon={ExternalLink} label="Explorer" />
                  ))}
                </div>
              </div>
            )}

            {coin.description?.en && (
              <div style={{ padding: 20 }}>
                <div className="text-xs uppercase tracking-wider mb-2" style={{ color: TEXT_MUTE }}>About</div>
                <div className="text-xs" style={{ color: TEXT_DIM, lineHeight: 1.55 }}>
                  {coin.description.en.split(/\s+/).slice(0, 120).join(' ').replace(/<[^>]+>/g, '')}
                  {coin.description.en.split(/\s+/).length > 120 && '…'}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

const DetailStat = ({ label, value, sub }) => {
  // Hide stats with no actual data so the grid doesn't advertise empty fields.
  if (value == null || value === '–' || value === '—' || value === '∞') return null;
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider" style={{ color: TEXT_MUTE }}>{label}</div>
      <div className="tabular-nums font-semibold text-base" style={{ color: TEXT }}>{value}</div>
      {sub && <div className="text-[10px] tabular-nums" style={{ color: TEXT_DIM }}>{sub}</div>}
    </div>
  );
};

const DetailLink = ({ href, icon: Icon, label }) => (
  <a href={href} target="_blank" rel="noopener noreferrer"
    className="flex items-center gap-1 px-2 py-1 rounded text-[11px] hover:opacity-80 transition-opacity"
    style={{ backgroundColor: PANEL_2, border: `1px solid ${BORDER}`, color: TEXT_DIM }}>
    <Icon size={11} /> {label} <ExternalLink size={9} style={{ opacity: 0.6 }} />
  </a>
);

/* Left-hand sidebar for the portfolio / manager workspace. Shows sub-page
   navigation within the current entity (Dashboard / Positions / Exposures /
   Fund Economics), echoing the workbench-style nav pattern. */
const SIDEBAR_SECTIONS = [
  { group: 'Overview', items: [
    { id: 'dashboard',      label: 'Dashboard',     icon: LayoutDashboard },
  ]},
  { group: 'Holdings', items: [
    { id: 'positions',      label: 'Positions',     icon: Layers },
    { id: 'exposures',      label: 'Exposures',     icon: PieChartIcon },
  ]},
  { group: 'Economics', items: [
    { id: 'fund-economics', label: 'Fund Economics', icon: DollarSign },
  ]},
];

const LeftSidebar = ({ subPage, setSubPage, hiddenItems = [], extraSections = [], onDrillFund, activeFundId = null }) => (
  <aside
    className="flex-shrink-0"
    style={{
      width: 220,
      borderRight: `1px solid ${BORDER}`,
      backgroundColor: PANEL,
      minHeight: 'calc(100vh - 96px)',
    }}>
    <div className="py-4">
      {SIDEBAR_SECTIONS.map((section) => (
        <div key={section.group} className="mb-4">
          <div
            className="px-4 pb-1 text-[10px] uppercase tracking-wider"
            style={{ color: TEXT_MUTE }}>
            {section.group}
          </div>
          {section.items.filter((it) => !hiddenItems.includes(it.id)).map((item) => {
            const active = subPage === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setSubPage(item.id)}
                className="w-full text-left px-4 py-2 text-xs flex items-center gap-2 transition-colors"
                style={{
                  color: active ? TEXT : TEXT_DIM,
                  backgroundColor: active ? ACCENT + '18' : 'transparent',
                  borderLeft: `2px solid ${active ? ACCENT : 'transparent'}`,
                }}>
                <Icon size={13} style={{ color: active ? ACCENT_2 : TEXT_MUTE }} />
                {item.label}
              </button>
            );
          })}
        </div>
      ))}

      {/* Dynamic sections: "Funds" list on manager view, underlying-funds list on FoF, etc. */}
      {extraSections.map((section) => (
        <div key={section.group} className="mb-4">
          <div className="px-4 pb-1 text-[10px] uppercase tracking-wider" style={{ color: TEXT_MUTE }}>
            {section.group}
          </div>
          {section.items.map((item) => {
            const active = item.id && activeFundId === item.id;
            return (
              <button
                key={item.id || item.label}
                onClick={() => item.onClick ? item.onClick() : (onDrillFund && item.id && onDrillFund(item.id))}
                className="w-full text-left px-4 py-2 text-xs flex items-center gap-2 transition-colors"
                style={{
                  color: active ? TEXT : TEXT_DIM,
                  backgroundColor: active ? ACCENT + '18' : 'transparent',
                  borderLeft: `2px solid ${active ? ACCENT : 'transparent'}`,
                }}>
                <Layers size={13} style={{ color: active ? ACCENT_2 : TEXT_MUTE, flexShrink: 0 }} />
                <div className="min-w-0 flex-1">
                  <div className="truncate">{item.label}</div>
                  {item.sub && <div className="text-[10px] truncate" style={{ color: TEXT_MUTE }}>{item.sub}</div>}
                </div>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  </aside>
);

/* Reusable empty-state panel for sub-pages that are not built out yet. */
const PlaceholderPage = ({ icon: Icon, title, description }) => (
  <Panel className="p-10 text-center">
    <div className="flex justify-center mb-4" style={{ color: TEXT_MUTE }}>
      <Icon size={28} />
    </div>
    <div className="text-base font-semibold mb-1" style={{ color: TEXT }}>{title}</div>
    <div className="text-xs max-w-md mx-auto" style={{ color: TEXT_DIM }}>{description}</div>
  </Panel>
);

const SectorBadge = ({ sectorId, size='sm' }) => {
  const s = sectorOf(sectorId);
  const px = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs';
  return (
    <span className={`rounded ${px} font-medium`}
      style={{ backgroundColor: s.color + '22', color: s.color, border: `1px solid ${s.color}44` }}>
      {s.label}
    </span>
  );
};

const LiquidityBadge = ({ liquid }) => (
  <span className="rounded px-1.5 py-0.5 text-[10px] font-medium"
    style={{
      backgroundColor: liquid ? GREEN + '22' : GOLD + '22',
      color: liquid ? GREEN : GOLD,
      border: `1px solid ${liquid ? GREEN+'44' : GOLD+'44'}`,
    }}>
    {liquid ? 'Liquid' : 'Illiquid'}
  </span>
);

const ChangeCell = ({ value, format='pct' }) => {
  if (value === null || value === undefined || isNaN(value)) return <span style={{color:TEXT_MUTE}}>–</span>;
  const color = value >= 0 ? GREEN : RED;
  const s = format === 'pct' ? fmtPctSigned(value) : (value >= 0 ? '+' : '') + fmtCurrency(value);
  return <span style={{ color }}>{s}</span>;
};

/* =============================================================================
   MAIN APP
   ============================================================================= */
export default function SOIDashboard() {
  const [store, setStore] = useState(() => {
    const loaded = loadStore();
    if (loaded && (loaded.soIs.length || loaded.clients.length)) return loaded;
    return seedStore();
  });
  // Sync module-level SECTORS ref to the live store list before any child render / useMemo.
  // If stored sectors lack the v5 'base-layer' bucket (e.g. HMR preserved an
  // older store in memory), force-use DEFAULT_SECTORS so breakdown labels and
  // colors reflect the current taxonomy regardless of persisted state.
  const _storedSectorsValid = store.sectors && store.sectors.length && store.sectors.some(sec => sec && sec.id === 'base-layer');
  SECTORS = _storedSectorsValid ? store.sectors : DEFAULT_SECTORS;
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
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
  }, [selection, drilldownSoi]); // eslint-disable-line react-hooks/exhaustive-deps
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
                apiKey={effectiveApiKey}
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
    {detailToken && <TokenDetailDrawer token={detailToken} onClose={() => setDetailToken(null)} apiKey={effectiveApiKey} store={store} />}
    </OpenTokenDetailContext.Provider></TokenImageContext.Provider>
  );
}

/* =============================================================================
   PORTFOLIO SELECTOR (dropdown)
   ============================================================================= */
function PortfolioSelector({ store, selection, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const label = useMemo(() => {
    if (selection.kind === 'firm') return 'All Clients';
    if (selection.kind === 'client') return store.clients.find(c=>c.id===selection.id)?.name || '—';
    if (selection.kind === 'manager') return store.managers.find(m=>m.id===selection.id)?.name + ' (all)';
    if (selection.kind === 'vintage') {
      const soi = store.soIs.find(s=>s.id===selection.id);
      const mgr = store.managers.find(m=>m.id===soi?.managerId);
      return `${mgr?.name || '?'} ${fundLabel(soi) || ''}`;
    }
    return '';
  }, [selection, store]);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)}
        className="px-3 py-1.5 rounded text-sm font-medium flex items-center gap-2"
        style={{ backgroundColor: PANEL_2, border: `1px solid ${BORDER}`, color: TEXT, minWidth: 220 }}>
        <Briefcase size={14} style={{ color: ACCENT }} />
        <span className="flex-1 text-left">{label}</span>
        <ChevronDown size={14} style={{ color: TEXT_DIM }} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 rounded-lg z-50"
          style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}`, minWidth: 280, boxShadow: '0 10px 30px rgba(0,0,0,0.4)' }}>
          <div className="p-1">
            <MenuItem
              active={selection.kind==='firm'}
              onClick={() => { onChange({ kind: 'firm' }); setOpen(false); }}
              icon={<Users size={14} />}>
              All Clients
              <span className="ml-auto text-[10px]" style={{ color: TEXT_MUTE }}>
                {store.soIs.length} funds
              </span>
            </MenuItem>
          </div>
          {store.clients.length > 0 && (
            <>
              <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider" style={{ color: TEXT_MUTE }}>Clients</div>
              <div className="p-1">
                {store.clients.map(c => {
                  const soiCount = store.commitments.filter(x => x.clientId === c.id).length;
                  return (
                    <MenuItem key={c.id}
                      active={selection.kind==='client' && selection.id===c.id}
                      onClick={() => { onChange({ kind: 'client', id: c.id }); setOpen(false); }}
                      icon={<Users size={14} />}>
                      {c.name}
                      <span className="ml-auto text-[10px]" style={{ color: TEXT_MUTE }}>{soiCount}</span>
                    </MenuItem>
                  );
                })}
              </div>
            </>
          )}
          {store.managers.length > 0 && (
            <>
              <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider" style={{ color: TEXT_MUTE }}>Managers</div>
              <div className="p-1 pb-2">
                {store.managers.map(m => {
                  const vintages = store.soIs.filter(s => s.managerId === m.id);
                  return (
                    <div key={m.id}>
                      <MenuItem
                        active={selection.kind==='manager' && selection.id===m.id}
                        onClick={() => { onChange({ kind: 'manager', id: m.id }); setOpen(false); }}
                        icon={<Building2 size={14} />}>
                        {m.name}
                        <span className="ml-auto text-[10px]" style={{ color: TEXT_MUTE }}>{vintages.length}</span>
                      </MenuItem>
                      {vintages.map(v => (
                        <MenuItem key={v.id} indent
                          active={selection.kind==='vintage' && selection.id===v.id}
                          onClick={() => { onChange({ kind: 'vintage', id: v.id }); setOpen(false); }}>
                          <span style={{ color: TEXT_DIM }}>{v.vintage}</span>
                        </MenuItem>
                      ))}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
function MenuItem({ active, onClick, children, icon, indent }) {
  return (
    <button onClick={onClick}
      className="w-full px-2.5 py-1.5 rounded text-sm flex items-center gap-2 transition-colors"
      style={{
        backgroundColor: active ? ACCENT + '22' : 'transparent',
        color: active ? ACCENT_2 : TEXT,
        paddingLeft: indent ? 28 : undefined,
      }}>
      {icon}
      {children}
    </button>
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
function PerformanceChart({ soiBundles, scaleFn, priceHistory, historyLoading, historyProgress, range, onRangeChange, onRequestFetch, apiKey, height=260, compact=false, title }) {
  const tokenIds = useMemo(() => {
    const ids = new Set();
    for (const b of soiBundles) for (const snap of snapshotsOf(b)) for (const p of (snap.positions||[])) if (isLiquid(p)&&p.cgTokenId) ids.add(p.cgTokenId);
    return [...ids];
  }, [soiBundles]);

  const allPositions = useMemo(() => soiBundles.flatMap(b => snapshotsOf(b).flatMap(s => s.positions||[])), [soiBundles]);
  const daysNeeded = useMemo(() => Math.min(rangeToDays(range, allPositions), 365), [range, allPositions]);

  // Trigger fetch if we're missing data
  useEffect(() => {
    if (!apiKey || !tokenIds.length) return;
    onRequestFetch?.(tokenIds, daysNeeded);
  }, [tokenIds.join(','), daysNeeded, apiKey]);

  // Build series
  const { series, earliestSnapshotMs, latestSnapshotMs, snapshotDates } = useMemo(() => {
    if (!soiBundles.length) return { series:[], earliestSnapshotMs:null, latestSnapshotMs:null, snapshotDates:[] };
    const startMs = rangeToStartMs(range, allPositions);
    return buildNAVSeries(soiBundles, priceHistory, startMs, Date.now(), scaleFn);
  }, [soiBundles, priceHistory, range, allPositions, scaleFn]);

  // Derive asOfMs from latestSnapshotMs for badge display
  const asOfMs = latestSnapshotMs;

  const startValue = series[0]?.value ?? 0;
  const endValue = series[series.length - 1]?.value ?? 0;
  const returnPct = startValue > 0 ? ((endValue - startValue) / startValue) * 100 : 0;
  const positive = returnPct >= 0;
  const lineColor = positive ? GREEN : RED;

  const tokensCovered = tokenIds.filter(id => priceHistory[id]).length;
  const needsData = apiKey && tokenIds.length > 0 && tokensCovered < tokenIds.length;

  const yMin = useMemo(() => {
    const vals = series.map(s => s.value).filter(v => v > 0);
    if (!vals.length) return 0;
    const min = Math.min(...vals), max = Math.max(...vals);
    return Math.max(0, min - (max - min) * 0.1);
  }, [series]);
  const yMax = useMemo(() => {
    const vals = series.map(s => s.value).filter(v => v > 0);
    if (!vals.length) return 1;
    const min = Math.min(...vals), max = Math.max(...vals);
    return max + (max - min) * 0.1;
  }, [series]);

  return (
    <Panel className={compact ? 'p-3' : 'p-5'}>
      {!compact && (
        <div className="flex items-start justify-between mb-3">
          <div>
            {title && <div className="text-xs uppercase tracking-wider" style={{color:TEXT_MUTE}}>{title}</div>}
            <div className="flex items-baseline gap-3 mt-0.5">
              <div className="text-xl font-semibold">{fmtCurrency(endValue)}</div>
              <div className="text-sm font-medium" style={{color: positive ? GREEN : RED}}>
                {positive ? '▲' : '▼'} {fmtPctSigned(returnPct, 2)}
                <span className="ml-1" style={{color:TEXT_DIM}}>{range}</span>
              </div>
              {asOfMs && (
                <div className="text-[10px] px-2 py-0.5 rounded" style={{color: GOLD, backgroundColor: GOLD+'11', border: `1px solid ${GOLD}44`}}>
                  As of {new Date(asOfMs).toLocaleDateString([], {year:'numeric', month:'short', day:'numeric'})}
                </div>
              )}
            </div>
          </div>
          {onRangeChange && (
            <div className="flex items-center gap-1">
              {RANGES.map(r => (
                <Pill key={r.id} active={range===r.id} onClick={()=>onRangeChange(r.id)}>{r.label}</Pill>
              ))}
            </div>
          )}
        </div>
      )}
      {!compact && snapshotDates && snapshotDates.length > 1 && (
        <div className="flex items-center gap-4 mb-2" style={{fontSize:10, color:TEXT_MUTE}}>
          <span>◼ <span style={{color:TEXT_DIM}}>Realized</span> (between snapshots)</span>
          <span>◻ Simulated (before / after holdings date)</span>
          <span style={{color:GOLD}}>━━</span><span>Snapshot date</span>
        </div>
      )}

      {!apiKey && (
        <div className="flex items-center justify-center text-xs p-6 rounded"
          style={{backgroundColor: PANEL_2, color: TEXT_DIM, border: `1px dashed ${BORDER}`, height}}>
          No CoinGecko API key configured. Set VITE_COINGECKO_API_KEY at build time, or paste an override in Settings.
        </div>
      )}

      {apiKey && historyLoading && (
        <div className="flex flex-col items-center justify-center text-xs rounded gap-2"
          style={{backgroundColor: PANEL_2, color: TEXT_DIM, border: `1px dashed ${BORDER}`, height}}>
          <RefreshCw size={16} className="animate-spin" style={{color:ACCENT}} />
          <div>Fetching history {historyProgress.current}/{historyProgress.total} — {historyProgress.token}</div>
          <div className="w-40 h-1 rounded-full overflow-hidden" style={{backgroundColor: BORDER}}>
            <div className="h-full" style={{width: `${(historyProgress.current/Math.max(1,historyProgress.total))*100}%`, backgroundColor: ACCENT}} />
          </div>
          <div className="text-[10px]" style={{color:TEXT_MUTE}}>~2s per token on Demo tier</div>
        </div>
      )}

      {apiKey && !historyLoading && needsData && (
        <div className="flex items-center justify-center text-xs p-6 rounded"
          style={{backgroundColor: PANEL_2, color: TEXT_DIM, border: `1px dashed ${BORDER}`, height}}>
          History not yet loaded for this range. Click "Refresh prices" to fetch.
        </div>
      )}

      {apiKey && !historyLoading && !needsData && series.length > 0 && (
        <div style={{width:'100%', height}}>
          <ResponsiveContainer>
            <AreaChart data={series} margin={{top: 8, right: 8, left: 0, bottom: 0}}>
              <defs>
                <linearGradient id={`grad-${positive?'up':'down'}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={lineColor} stopOpacity={0.35}/>
                  <stop offset="100%" stopColor={lineColor} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{fontSize: 10, fill: TEXT_MUTE}} axisLine={false} tickLine={false}
                tickFormatter={(ms) => {
                  const d = new Date(ms);
                  if (range === '1D') return d.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
                  if (range === 'MTD' || range === 'YTD') return d.toLocaleDateString([], {month: 'short', day: 'numeric'});
                  return d.toLocaleDateString([], {month: 'short', year: '2-digit'});
                }}
                minTickGap={60} />
              <YAxis domain={[yMin, yMax]} tick={{fontSize: 10, fill: TEXT_MUTE}} axisLine={false} tickLine={false}
                tickFormatter={(v) => fmtCurrency(v, 0)} width={60} />
              <Tooltip
                contentStyle={{backgroundColor: PANEL_2, border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 12}}
                labelStyle={{color: TEXT_DIM}}
                itemStyle={{color: TEXT}}
                labelFormatter={(ms) => new Date(ms).toLocaleDateString([], {year:'numeric', month: 'short', day: 'numeric'})}
                formatter={(v) => [fmtCurrency(v), 'NAV']} />
              <Area type="monotone" dataKey="value" stroke={lineColor} strokeWidth={1.5}
                fill={`url(#grad-${positive?'up':'down'})`} />
              {/* Backward-simulated (before earliest snapshot) */}
              {earliestSnapshotMs && series.length > 0 && earliestSnapshotMs > series[0].date && (
                <ReferenceArea
                  x1={series[0].date}
                  x2={Math.min(earliestSnapshotMs, series[series.length-1].date)}
                  fill={TEXT_MUTE} fillOpacity={0.12} stroke="none" />
              )}
              {/* Forward-simulated (after latest snapshot) */}
              {latestSnapshotMs && series.length > 0 && latestSnapshotMs < series[series.length-1].date && (
                <ReferenceArea
                  x1={Math.max(latestSnapshotMs, series[0].date)}
                  x2={series[series.length-1].date}
                  fill={GOLD} fillOpacity={0.08} stroke="none" />
              )}
              {/* Snapshot date markers */}
              {(snapshotDates||[]).filter(ms => series.length > 0 && ms >= series[0].date && ms <= series[series.length-1].date).map((ms,i) => (
                <ReferenceLine key={i} x={ms} stroke={GOLD} strokeWidth={1} strokeDasharray="3 3"
                  label={{ value: new Date(ms).toLocaleDateString([],{month:'short',year:'2-digit'}), position:'top', fill:GOLD, fontSize:9 }} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {apiKey && !historyLoading && !series.length && (
        <div className="flex items-center justify-center text-xs p-6 rounded"
          style={{backgroundColor: PANEL_2, color: TEXT_DIM, border: `1px dashed ${BORDER}`, height}}>
          No data in this range.
        </div>
      )}
    </Panel>
  );
}

function MiniSparkline({ series, width=120, height=32 }) {
  if (!series?.length || series.length < 2) {
    return <div style={{width, height}} />;
  }
  const vals = series.map(s => s.value);
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const positive = vals[vals.length - 1] >= vals[0];
  const color = positive ? GREEN : RED;
  const points = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg width={width} height={height} style={{display:'block'}}>
      <polyline fill="none" stroke={color} strokeWidth="1.25" points={points} />
    </svg>
  );
}

/* =============================================================================
   DASHBOARD / EXPOSURES / FUND ECONOMICS — helper components and pages.
   Dashboard is a compact summary; Exposures is the detailed exposure breakdown;
   Fund Economics is the commitment-level MOIC / TVPI / DPI view.
   ============================================================================= */

/* Compact sector tilt: horizontal bars only (no pie), used on Dashboard. */
const CompactSectorTilt = ({ breakdown }) => (
  <Panel className="p-4">
    <div className="flex items-baseline justify-between mb-3">
      <div>
        <div className="text-[10px] uppercase tracking-wider" style={{color:TEXT_MUTE}}>Sector allocation</div>
        <div className="text-sm font-semibold mt-0.5">Exposure by sector</div>
      </div>
    </div>
    <div className="space-y-2">
      {breakdown.length === 0 && (
        <div className="text-xs" style={{color: TEXT_DIM}}>No positions yet.</div>
      )}
      {breakdown.map(s => (
        <div key={s.id} className="flex items-center gap-2">
          <div style={{width: 8, height: 8, borderRadius: 2, backgroundColor: s.color, flexShrink: 0}} />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between text-xs">
              <span className="truncate">{s.label}</span>
              <span className="tabular-nums ml-2" style={{color: TEXT_DIM}}>{fmtPct(s.pct, 1)}</span>
            </div>
            <div className="h-1 rounded-full mt-0.5 overflow-hidden" style={{backgroundColor: PANEL_2}}>
              <div className="h-full" style={{width: `${s.pct}%`, backgroundColor: s.color}} />
            </div>
          </div>
        </div>
      ))}
    </div>
  </Panel>
);

/* Compact manager breakdown — one row per SOI with value + pct bar. */
const CompactManagerBreakdown = ({ managerBreakdown, groupLabel = 'Manager allocation', subtitle = 'Exposure by fund', showModeToggle = false }) => {
  const [mode, setMode] = useState('fund'); // 'fund' | 'firm'
  const items = useMemo(() => {
    if (mode === 'firm') {
      // Aggregate fund rows into firm rows (sum across vintages per manager).
      const byFirm = {};
      for (const m of (managerBreakdown || [])) {
        const k = m.managerId || m.managerName;
        if (!byFirm[k]) byFirm[k] = { soiId: k, managerId: m.managerId, managerName: m.managerName, vintage: '', value: 0, pct: 0, positionCount: 0 };
        byFirm[k].value += m.value || 0;
        byFirm[k].pct += m.pct || 0;
        byFirm[k].positionCount += m.positionCount || 0;
      }
      return Object.values(byFirm).sort((a, b) => b.value - a.value);
    }
    return managerBreakdown || [];
  }, [managerBreakdown, mode]);

  return (
  <Panel className="p-4">
    <div className="flex items-baseline justify-between mb-3 gap-2">
      <div>
        <div className="text-[10px] uppercase tracking-wider" style={{color:TEXT_MUTE}}>{groupLabel}</div>
        <div className="text-sm font-semibold mt-0.5">{mode === 'firm' ? 'Exposure by firm' : subtitle}</div>
      </div>
      {showModeToggle && (
        <label className="flex items-center gap-1 text-[10px] uppercase tracking-wider flex-shrink-0" style={{color: TEXT_MUTE}}>
          Group:
          <select value={mode} onChange={(e) => setMode(e.target.value)}
            className="text-xs rounded px-1.5 py-0.5 outline-none normal-case tracking-normal"
            style={{backgroundColor: PANEL_2, border: `1px solid ${BORDER}`, color: TEXT, colorScheme: 'dark'}}>
            <option value="fund">By fund</option>
            <option value="firm">By firm</option>
          </select>
        </label>
      )}
    </div>
    <div className="space-y-2">
      {items.length === 0 && (
        <div className="text-xs" style={{color: TEXT_DIM}}>No managers in selection.</div>
      )}
      {items.map(m => (
        <div key={m.soiId}>
          <div className="flex items-baseline justify-between text-xs">
            <div className="min-w-0 truncate">
              <span className="font-medium">{m.managerName}</span>
              {m.vintage && <span className="ml-1.5" style={{color: TEXT_DIM}}>{m.vintage}</span>}
            </div>
            <div className="tabular-nums ml-2">{fmtCurrency(m.value)}</div>
          </div>
          <div className="h-1 rounded-full mt-0.5 overflow-hidden" style={{backgroundColor: PANEL_2}}>
            <div className="h-full" style={{width: `${m.pct}%`, backgroundColor: ACCENT}} />
          </div>
          <div className="text-[10px] tabular-nums mt-0.5" style={{color: TEXT_MUTE}}>{fmtPct(m.pct, 1)} · {m.positionCount} positions</div>
        </div>
      ))}
    </div>
  </Panel>
  );
};

/* Largest liquid holdings. Right column stacks % of book on top, dollar
   value underneath. Count is user-toggleable (5 / 10) when there's enough
   data; otherwise the panel just shows whatever there is. */
const TopHoldingsPanel = ({ tokenRollup, asOf }) => {
  const openDetail = useContext(OpenTokenDetailContext);
  const allLiquid = (tokenRollup || []).filter(t => t.liquid);
  const showToggle = allLiquid.length > 5;
  const [count, setCount] = useState(5);
  const effectiveCount = Math.min(count, allLiquid.length);
  const liquidOnly = allLiquid.slice(0, effectiveCount);
  return (
    <Panel className="p-4">
      <div className="flex items-start justify-between mb-3 gap-2 flex-wrap">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider" style={{color:TEXT_MUTE}}>
            {allLiquid.length <= 5 ? 'Liquid holdings' : 'Largest liquid holdings'}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {showToggle && (
            <label className="flex items-center gap-1 text-[10px] uppercase tracking-wider" style={{color: TEXT_MUTE}}>
              Top:
              <select value={count} onChange={(e) => setCount(Number(e.target.value))}
                className="text-xs rounded px-1.5 py-0.5 outline-none normal-case tracking-normal"
                style={{backgroundColor: PANEL_2, border: `1px solid ${BORDER}`, color: TEXT, colorScheme: 'dark'}}>
                <option value={5}>Top 5</option>
                <option value={10}>Top {Math.min(10, allLiquid.length)}</option>
              </select>
            </label>
          )}
          {asOf && (
            <div className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0"
              style={{color: GOLD, backgroundColor: GOLD+'11', border: `1px solid ${GOLD}44`}}>
              As of {asOf}
            </div>
          )}
        </div>
      </div>
      <div className="space-y-1.5">
        {liquidOnly.length === 0 && (
          <div className="text-xs" style={{color: TEXT_DIM}}>No liquid tokens yet.</div>
        )}
        {liquidOnly.map((t, i) => (
          <button key={t.key} onClick={() => t.cgTokenId && openDetail({ cgTokenId: t.cgTokenId, symbol: t.symbol, name: t.name })}
            disabled={!t.cgTokenId}
            className="w-full flex items-center gap-2 py-1 px-1 rounded hover:bg-white/5 transition-colors text-left disabled:cursor-default disabled:hover:bg-transparent">
            <div className="text-[10px] tabular-nums w-4 text-right" style={{color: TEXT_MUTE}}>{i+1}</div>
            <TokenIcon ticker={t.symbol} name={t.name} size={22} />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate flex items-center gap-1">
                <span className="truncate">{t.symbol || t.name}</span>
                {t.throughFoF && (
                  <span className="text-[9px] px-1 rounded font-medium flex-shrink-0"
                    style={{ backgroundColor: VIOLET + '22', color: VIOLET, border: `1px solid ${VIOLET}44` }}>FoF</span>
                )}
              </div>
              {t.symbol && t.name !== t.symbol && <div className="text-[10px] truncate" style={{color: TEXT_MUTE}}>{t.name}</div>}
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-xs tabular-nums font-semibold">{fmtPct(t.pct, 1)}</div>
              <div className="text-[10px] tabular-nums" style={{color: TEXT_DIM}}>{fmtCurrency(t.value)}</div>
            </div>
          </button>
        ))}
      </div>
    </Panel>
  );
};

/* Top N movers (by absolute % change over selected range). Uses
   live prices for 1D, priceHistory for other ranges. */
const TopMoversPanel = ({ rollup, priceHistory }) => {
  const openDetail = useContext(OpenTokenDetailContext);
  const [range, setRange] = useState('1D');
  const [count, setCount] = useState(5);
  const movers = useMemo(() => {
    const items = [];
    if (range === '1D') {
      // 1D: use the change24h that computeRollup already baked onto each position.
      for (const p of rollup.positions || []) {
        if (!p.hasLivePrice || p.change24h == null) continue;
        items.push({
          key: p.id || `${p.cgTokenId}-${p.soiId || ''}`,
          cgTokenId: p.cgTokenId,
          symbol: p.ticker || p.positionName,
          name: p.positionName,
          change: p.change24h,
          value: p.currentValue || p.soiMarketValue,
        });
      }
    } else {
      // MTD/YTD/1Y/SI: compute from priceHistory
      const startMs = rangeToStartMs(range, rollup.positions || []);
      for (const p of rollup.positions || []) {
        if (!p.cgTokenId) continue;
        const hist = priceHistory[p.cgTokenId];
        if (!hist) continue;
        const days = Object.keys(hist).map(Number).sort((a,b)=>a-b);
        if (!days.length) continue;
        const startDay = days.find(d => d >= startMs) ?? days[0];
        const endDay = days[days.length - 1];
        const startPrice = hist[startDay];
        const endPrice = hist[endDay];
        if (!startPrice || !endPrice) continue;
        const change = ((endPrice - startPrice) / startPrice) * 100;
        items.push({
          key: p.id || `${p.cgTokenId}-${p.soiId || ''}`,
          cgTokenId: p.cgTokenId,
          symbol: p.ticker || p.positionName,
          name: p.positionName,
          change,
          value: p.currentValue || p.soiMarketValue,
        });
      }
    }
    // Dedup by symbol (one row per token, use largest absolute move)
    const bySymbol = {};
    for (const item of items) {
      const key = item.symbol;
      if (!bySymbol[key] || Math.abs(item.change) > Math.abs(bySymbol[key].change)) bySymbol[key] = item;
    }
    return Object.values(bySymbol)
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
      .slice(0, count);
  }, [rollup.positions, priceHistory, range, count]);

  return (
    <Panel className="p-4">
      <div className="mb-3">
        <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider" style={{color:TEXT_MUTE}}>Largest price moves</div>
            <div className="text-sm font-semibold mt-0.5">Biggest winners and losers</div>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <label className="flex items-center gap-1 text-[10px] uppercase tracking-wider" style={{color: TEXT_MUTE}}>
              Timeframe:
              <select value={range} onChange={(e) => setRange(e.target.value)}
                className="text-xs rounded px-1.5 py-0.5 outline-none normal-case tracking-normal"
                style={{backgroundColor: PANEL_2, border: `1px solid ${BORDER}`, color: TEXT, colorScheme: 'dark'}}>
                {MOVER_RANGES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-1 text-[10px] uppercase tracking-wider" style={{color: TEXT_MUTE}}>
              Top:
              <select value={count} onChange={(e) => setCount(Number(e.target.value))}
                className="text-xs rounded px-1.5 py-0.5 outline-none normal-case tracking-normal"
                style={{backgroundColor: PANEL_2, border: `1px solid ${BORDER}`, color: TEXT, colorScheme: 'dark'}}>
                <option value={5}>Top 5</option>
                <option value={10}>Top 10</option>
              </select>
            </label>
          </div>
        </div>
      </div>
      {movers.length === 0 ? (
        <div className="text-xs p-3 rounded" style={{backgroundColor: PANEL_2, color: TEXT_MUTE, border: `1px dashed ${BORDER}`}}>
          No mover data — enable Live prices and Refresh to populate this panel.
        </div>
      ) : (
        <div className="space-y-1.5">
          {movers.map((m, i) => {
            const positive = m.change >= 0;
            return (
              <button key={m.key} onClick={() => m.cgTokenId && openDetail({ cgTokenId: m.cgTokenId, symbol: m.symbol, name: m.name })}
                disabled={!m.cgTokenId}
                className="w-full flex items-center gap-2 py-1 px-1 rounded hover:bg-white/5 transition-colors text-left disabled:cursor-default disabled:hover:bg-transparent">
                <div className="text-[10px] tabular-nums w-5 text-right" style={{color: TEXT_MUTE}}>{i+1}</div>
                <TokenIcon ticker={m.symbol} name={m.name} size={20} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{m.symbol}</div>
                  {m.name && m.name !== m.symbol && <div className="text-[10px] truncate" style={{color: TEXT_MUTE}}>{m.name}</div>}
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xs tabular-nums font-medium" style={{color: positive ? GREEN : RED}}>
                    {positive ? '▲' : '▼'} {fmtPctSigned(m.change, 2)}
                  </div>
                  {m.value != null && <div className="text-[10px] tabular-nums" style={{color: TEXT_DIM}}>{fmtCurrency(m.value)}</div>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Panel>
  );
};

/* Full sector-tilt panel (with pie chart). Used on Exposures page. */
const FullSectorTiltPanel = ({ breakdown }) => (
  <Panel className="p-5">
    <div className="flex items-baseline justify-between mb-3">
      <div>
        <div className="text-xs uppercase tracking-wider" style={{color:TEXT_MUTE}}>Sector tilt (GICS-style)</div>
        <div className="text-base font-semibold mt-0.5">Exposure by bucket</div>
      </div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={breakdown.filter(s => s.value > 0)}
              dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={100} innerRadius={60}
              strokeWidth={0}>
              {breakdown.filter(s => s.value > 0).map((s, i) => (
                <Cell key={i} fill={s.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ backgroundColor: PANEL_2, border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 12 }}
              labelStyle={{ color: TEXT }}
              itemStyle={{ color: TEXT }}
              formatter={(v) => fmtCurrency(v)} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-2">
        {breakdown.map(s => (
          <div key={s.id} className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: s.color }} />
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate">{s.label}</div>
              <div className="h-1.5 rounded-full mt-1 overflow-hidden" style={{ backgroundColor: PANEL_2 }}>
                <div className="h-full" style={{ width: `${s.pct}%`, backgroundColor: s.color }} />
              </div>
            </div>
            <div className="text-right" style={{ minWidth: 100 }}>
              <div className="text-sm tabular-nums">{fmtCurrency(s.value)}</div>
              <div className="text-[10px] tabular-nums" style={{ color: TEXT_DIM }}>{fmtPct(s.pct,1)} • {s.count} pos</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </Panel>
);

/* Liquid vs illiquid split. */
const LiquidityBreakdownPanel = ({ rollup }) => {
  const liquidPct = rollup.liquidPct || 0;
  const illiquidPct = 100 - liquidPct;
  return (
    <Panel className="p-5">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <div className="text-xs uppercase tracking-wider" style={{color:TEXT_MUTE}}>Liquidity</div>
          <div className="text-base font-semibold mt-0.5">Liquid vs illiquid</div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div style={{ width: 120, height: 120 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie data={[{name:'Liquid', value: rollup.liquidNAV, color: ACCENT_2},
                          {name:'Illiquid', value: rollup.illiquidNAV, color: VIOLET}]}
                dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={56} innerRadius={36}
                strokeWidth={0}>
                <Cell fill={ACCENT_2} />
                <Cell fill={VIOLET} />
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: PANEL_2, border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 12 }}
                formatter={(v) => fmtCurrency(v)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-2">
          <div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2"><div style={{width:10, height:10, borderRadius:2, backgroundColor: ACCENT_2}} /> Liquid</div>
              <div className="tabular-nums">{fmtCurrency(rollup.liquidNAV)} • {fmtPct(liquidPct,1)}</div>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2"><div style={{width:10, height:10, borderRadius:2, backgroundColor: VIOLET}} /> Illiquid</div>
              <div className="tabular-nums">{fmtCurrency(rollup.illiquidNAV)} • {fmtPct(illiquidPct,1)}</div>
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
};

/* Full top-holdings table. Accepts a count cap (default 25). */
const FullTopHoldingsTable = ({ tokenRollup, count = 25 }) => {
  const openDetail = useContext(OpenTokenDetailContext);
  return (
    <Panel className="p-5">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <div className="text-xs uppercase tracking-wider" style={{color:TEXT_MUTE}}>Top-{count} holdings (rolled up)</div>
          <div className="text-base font-semibold mt-0.5">Aggregate token exposure across managers</div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ color: TEXT_MUTE, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <th className="text-left py-2 pr-3">Token</th>
              <th className="text-left py-2 pr-3">Sector</th>
              <th className="text-right py-2 pr-3">24h</th>
              <th className="text-right py-2 pr-3">Value</th>
              <th className="text-right py-2 pr-3">% of book</th>
              <th className="text-right py-2 pr-3">In funds</th>
              <th className="text-right py-2">Liquidity</th>
            </tr>
          </thead>
          <tbody>
            {tokenRollup.slice(0, count).map(t => (
              <tr key={t.key}
                onClick={() => t.cgTokenId && openDetail({ cgTokenId: t.cgTokenId, symbol: t.symbol, name: t.name })}
                style={{ borderTop: `1px solid ${BORDER}`, cursor: t.cgTokenId ? 'pointer' : 'default' }}
                className={t.cgTokenId ? 'hover:bg-white/5' : ''}>
                <td className="py-2.5 pr-3">
                  <div className="flex items-center gap-2.5">
                    <TokenIcon ticker={t.symbol} name={t.name} size={22} />
                    <div>
                      <div className="font-medium flex items-center gap-1.5">
                        <span>{t.symbol || t.name}</span>
                        {t.throughFoF && (
                          <span className="text-[9px] px-1 rounded font-medium"
                            style={{ backgroundColor: VIOLET + '22', color: VIOLET, border: `1px solid ${VIOLET}44` }}>FoF</span>
                        )}
                      </div>
                      {t.symbol && t.name !== t.symbol && <div className="text-[10px]" style={{color:TEXT_MUTE}}>{t.name}</div>}
                    </div>
                  </div>
                </td>
                <td className="py-2.5 pr-3"><SectorBadge sectorId={t.sectorId} /></td>
                <td className="py-2.5 pr-3 text-right tabular-nums"><ChangeCell value={t.change24h} /></td>
                <td className="py-2.5 pr-3 text-right tabular-nums font-medium">{fmtCurrency(t.value)}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{fmtPct(t.pct, 2)}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums" style={{color: TEXT_DIM}}>{t.managerCount}</td>
                <td className="py-2.5 text-right"><LiquidityBadge liquid={t.liquid} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
};

/* ExposuresPage — lives behind the Exposures sidebar item. */
function ExposuresPage({ rollup, selection }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <FullSectorTiltPanel breakdown={rollup.sectorBreakdown} />
        </div>
        <LiquidityBreakdownPanel rollup={rollup} />
      </div>
      <CompactManagerBreakdown
          managerBreakdown={rollup.managerBreakdown}
          groupLabel={selection.kind === 'manager' ? 'Fund allocation' : 'Manager allocation'}
          subtitle={selection.kind === 'manager' ? 'Exposure by fund' : 'Exposure by fund'}
          showModeToggle={selection.kind !== 'manager'} />
      <FullTopHoldingsTable tokenRollup={rollup.tokenRollup} count={25} />
    </div>
  );
}

/* FundEconomicsPage — lives behind the Fund Economics sidebar item.
   Shows client-level economics and a per-commitment table with MOIC / TVPI / DPI. */
function FundEconomicsPage({ rollup, store, selection, clientShareMode }) {
  const commits = useMemo(() => {
    let cc = store.commitments;
    if (selection.kind === 'client') cc = cc.filter(c => c.clientId === selection.id);
    // Decorate with current NAV from rollup.managerBreakdown where possible.
    const navBySoi = {};
    for (const m of (rollup.managerBreakdown || [])) navBySoi[m.soiId] = m.value;
    return cc.map(c => {
      const client = store.clients.find(x => x.id === c.clientId);
      const mgr = store.managers.find(x => x.id === c.managerId);
      const soi = store.soIs.find(x => x.id === c.soiId);
      const called = c.called || 0;
      const committed = c.committed || 0;
      const distributions = c.distributions || 0;
      const nav = navBySoi[c.soiId] || 0;
      return {
        id: c.id,
        clientName: client?.name || '?',
        managerName: mgr?.name || '?',
        vintage: fundLabel(soi),
        committed, called, distributions,
        uncalled: committed - called,
        pctInvested: committed > 0 ? (called / committed) * 100 : null,
        nav,
        unrealizedMoic: called > 0 ? nav / called : null,
        dpi: called > 0 ? distributions / called : null,
        tvpi: called > 0 ? (nav + distributions) / called : null,
      };
    });
  }, [store.commitments, store.clients, store.managers, store.soIs, rollup.managerBreakdown, selection]);

  const totals = useMemo(() => commits.reduce((t, c) => ({
    committed: t.committed + c.committed,
    called: t.called + c.called,
    distributions: t.distributions + c.distributions,
    nav: t.nav + c.nav,
  }), { committed: 0, called: 0, distributions: 0, nav: 0 }), [commits]);

  const pctInvested = totals.committed > 0 ? (totals.called / totals.committed) * 100 : null;
  const pooledMoic  = totals.called > 0 ? totals.nav / totals.called : null;
  const pooledTvpi  = totals.called > 0 ? (totals.nav + totals.distributions) / totals.called : null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Total Committed" value={fmtCurrency(totals.committed)} />
        <KPI label="Total Called" value={fmtCurrency(totals.called)}
             sub={`Uncalled ${fmtCurrency(totals.committed - totals.called)}`} />
        <KPI label="% Invested" value={pctInvested != null ? fmtPct(pctInvested, 1) : '—'} />
        <KPI label="Pooled Unrealized MOIC" value={fmtMoic(pooledMoic)}
             sub={clientShareMode && selection?.kind === 'client' ? 'Client NAV ÷ Called' : 'Current NAV ÷ Called'} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Distributions" value={fmtCurrency(totals.distributions)} />
        <KPI label="DPI" value={totals.called > 0 ? fmtMoic(totals.distributions/totals.called) : '—'}
             sub="Distributed ÷ Called" />
        <KPI label="TVPI" value={fmtMoic(pooledTvpi)} sub="(NAV + Dist) ÷ Called" />
        <KPI label="Commitments" value={commits.length} sub={`${new Set(commits.map(c=>c.managerName)).size} managers`} />
      </div>

      <Panel className="p-0 overflow-x-auto">
        <div className="px-5 pt-4 pb-1">
          <div className="text-xs uppercase tracking-wider" style={{color:TEXT_MUTE}}>Commitments</div>
          <div className="text-base font-semibold mt-0.5">Economics by commitment</div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ color: TEXT_MUTE, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {selection.kind !== 'client' && <th className="text-left py-2 pl-5 pr-3">Client</th>}
              <th className="text-left py-2 pr-3">Manager</th>
              <th className="text-left py-2 pr-3">Vintage</th>
              <th className="text-right py-2 pr-3">Committed</th>
              <th className="text-right py-2 pr-3">Called</th>
              <th className="text-right py-2 pr-3">Uncalled</th>
              <th className="text-right py-2 pr-3">Distributions</th>
              <th className="text-right py-2 pr-3">% Invested</th>
              <th className="text-right py-2 pr-3">NAV</th>
              <th className="text-right py-2 pr-3">Unreal MOIC</th>
              <th className="text-right py-2 pr-3">DPI</th>
              <th className="text-right py-2 pr-5">TVPI</th>
            </tr>
          </thead>
          <tbody>
            {commits.length === 0 && (
              <tr><td colSpan={12} className="py-6 text-center text-xs" style={{color: TEXT_DIM}}>No commitments for this selection.</td></tr>
            )}
            {commits.map(c => (
              <tr key={c.id} style={{ borderTop: `1px solid ${BORDER}` }}>
                {selection.kind !== 'client' && <td className="py-2.5 pl-5 pr-3">{c.clientName}</td>}
                <td className="py-2.5 pr-3 font-medium">{c.managerName}</td>
                <td className="py-2.5 pr-3" style={{color: TEXT_DIM}}>{c.vintage}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{fmtCurrency(c.committed)}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{fmtCurrency(c.called)}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums" style={{color: TEXT_DIM}}>{fmtCurrency(c.uncalled)}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{fmtCurrency(c.distributions)}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums" style={{color: TEXT_DIM}}>{c.pctInvested != null ? fmtPct(c.pctInvested, 1) : '—'}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums font-medium">{fmtCurrency(c.nav)}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{fmtMoic(c.unrealizedMoic)}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{fmtMoic(c.dpi)}</td>
                <td className="py-2.5 pr-5 text-right tabular-nums font-medium">{fmtMoic(c.tvpi)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

/* =============================================================================
   OVERVIEW TAB — the headline view (sector tilts, top tokens, concentration)
   ============================================================================= */
function OverviewTab({ rollup, store, selection, priceHistory, historyLoading, historyProgress, range, onRangeChange, onRequestFetch, apiKey, clientShareMode, scaleBy }) {
  // Latest snapshot date across the current selection — used as the "as of"
  // label on panels so an OCIO can see at a glance when the underlying holdings
  // data was last refreshed.
  const dataAsOf = useMemo(() => {
    const dates = (rollup.managerBreakdown || [])
      .map(m => m.asOfDate)
      .filter(Boolean)
      .sort();
    if (!dates.length) return null;
    const latest = dates[dates.length - 1];
    // Format to "Sep 30, 2025" style for display.
    const d = new Date(latest + 'T00:00:00Z');
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  }, [rollup.managerBreakdown]);

  const clientEconomics = useMemo(() => {
    if (selection?.kind !== 'client') return null;
    const commits = store.commitments.filter(c => c.clientId === selection.id);
    const totalCommitted = _.sumBy(commits, c => c.committed || 0);
    const totalCalled = _.sumBy(commits, c => c.called || 0);
    const pctInvested = totalCommitted > 0 ? (totalCalled / totalCommitted) * 100 : null;
    const pooledMoic = totalCalled > 0 ? rollup.totalNAV / totalCalled : null;
    return { totalCommitted, totalCalled, pctInvested, pooledMoic };
  }, [selection, store.commitments, rollup.totalNAV]);

  // Build scaleFn for chart (mirrors scaleBy but using the bundle object)
  const chartScaleFn = (clientShareMode && selection?.kind === 'client' && scaleBy) ? scaleBy : null;

  return (
    <div className="space-y-6">
      {/* PERFORMANCE CHART */}
      <PerformanceChart
        soiBundles={rollup.soIs}
        scaleFn={chartScaleFn}
        priceHistory={priceHistory}
        historyLoading={historyLoading}
        historyProgress={historyProgress}
        range={range}
        onRangeChange={onRangeChange}
        onRequestFetch={onRequestFetch}
        apiKey={apiKey}
        title="Portfolio performance"
        height={280}
      />

      {/* KPI ROW */}
      {rollup.fofLookThroughCount > 0 && (
        <div className="text-xs px-3 py-1.5 rounded flex items-center gap-2"
          style={{backgroundColor: VIOLET+'11', color: VIOLET, border: `1px solid ${VIOLET}33`}}>
          <TrendingUp size={12} />
          Look-through from {rollup.fofLookThroughCount} fund-of-fund{rollup.fofLookThroughCount===1?'':'s'} applied — positions reflect underlying exposure
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Total Exposure" value={fmtCurrency(rollup.totalNAV)}
             sub={`${rollup.positionCount} positions in ${rollup.soiCount} fund${rollup.soiCount===1?'':'s'}`} />
        <KPI label="Managers" value={rollup.managerCount}
             sub={`${rollup.soiCount} vintage${rollup.soiCount===1?'':'s'}`} />
        <KPI label="Liquid / Illiquid" value={fmtPct(rollup.liquidPct, 1)}
             sub={`${fmtCurrency(rollup.liquidNAV)} liquid • ${fmtCurrency(rollup.illiquidNAV)} illiquid`} />
        <KPI label="Top-10 concentration" value={fmtPct(rollup.top10, 1)}
             sub={`Top-25: ${fmtPct(rollup.top25, 1)}`} />
      </div>

      {/* Compact exposure + top-holdings + top-movers row — the main at-a-glance view. */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <CompactSectorTilt breakdown={rollup.sectorBreakdown} />
        <CompactManagerBreakdown managerBreakdown={rollup.managerBreakdown} />
        <TopHoldingsPanel tokenRollup={rollup.tokenRollup} asOf={dataAsOf} />
        <TopMoversPanel rollup={rollup} priceHistory={priceHistory} />
      </div>

      {/* Legacy grid — the Dashboard intentionally omits the large panels now;
          they live on the Exposures page. */}
      <div style={{ display: 'none' }}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel className="p-5 lg:col-span-2">
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <div className="text-xs uppercase tracking-wider" style={{color:TEXT_MUTE}}>Sector tilt (GICS-style)</div>
              <div className="text-base font-semibold mt-0.5">Exposure by bucket</div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={rollup.sectorBreakdown.filter(s => s.value > 0)}
                    dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={90} innerRadius={55}
                    strokeWidth={0}>
                    {rollup.sectorBreakdown.filter(s => s.value > 0).map((s, i) => (
                      <Cell key={i} fill={s.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: PANEL_2, border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 12 }}
                    labelStyle={{ color: TEXT }}
                    itemStyle={{ color: TEXT }}
                    formatter={(v) => fmtCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {rollup.sectorBreakdown.map(s => (
                <div key={s.id} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: s.color }} />
                  <div className="flex-1">
                    <div className="text-sm">{s.label}</div>
                    <div className="h-1.5 rounded-full mt-1 overflow-hidden" style={{ backgroundColor: PANEL_2 }}>
                      <div className="h-full" style={{ width: `${s.pct}%`, backgroundColor: s.color }} />
                    </div>
                  </div>
                  <div className="text-right" style={{ minWidth: 100 }}>
                    <div className="text-sm tabular-nums">{fmtCurrency(s.value)}</div>
                    <div className="text-[10px] tabular-nums" style={{ color: TEXT_DIM }}>{fmtPct(s.pct,1)} • {s.count} pos</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel className="p-5">
          <div className="text-xs uppercase tracking-wider mb-1" style={{color:TEXT_MUTE}}>Manager breakdown</div>
          <div className="text-base font-semibold mb-4">Exposure by vintage</div>
          <div className="space-y-3">
            {rollup.managerBreakdown.map(m => (
              <div key={m.soiId}>
                <div className="flex items-baseline justify-between text-sm">
                  <div>
                    <span className="font-medium">{m.managerName}</span>
                    <span className="text-xs ml-1.5" style={{color:TEXT_DIM}}>{m.vintage}</span>
                  </div>
                  <div className="tabular-nums">{fmtCurrency(m.value)}</div>
                </div>
                <div className="h-1.5 rounded-full mt-1 overflow-hidden" style={{ backgroundColor: PANEL_2 }}>
                  <div className="h-full" style={{ width: `${m.pct}%`, backgroundColor: ACCENT }} />
                </div>
                <div className="text-[10px] mt-0.5 tabular-nums" style={{color:TEXT_MUTE}}>{fmtPct(m.pct,1)} • {m.positionCount} positions</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      </div>

      {/* TOP TOKENS (hidden on Dashboard — kept only for legacy tooling) */}
      <Panel className="p-5" style={{ display: 'none' }}>
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <div className="text-xs uppercase tracking-wider" style={{color:TEXT_MUTE}}>Top-10 holdings (rolled up)</div>
            <div className="text-base font-semibold mt-0.5">Aggregate token exposure across managers</div>
          </div>
          {rollup.positions.some(p => p.hasLivePrice) && (
            <div className="text-xs" style={{ color: TEXT_DIM }}>
              <span style={{ color: GREEN }}>●</span> Live prices applied
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: TEXT_MUTE, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th className="text-left py-2 pr-3">Token</th>
                <th className="text-left py-2 pr-3">Sector</th>
                <th className="text-right py-2 pr-3">24h</th>
                <th className="text-right py-2 pr-3">Value</th>
                <th className="text-right py-2 pr-3">% of book</th>
                <th className="text-right py-2 pr-3">In funds</th>
                <th className="text-right py-2">Liquidity</th>
              </tr>
            </thead>
            <tbody>
              {rollup.tokenRollup.slice(0, 10).map(t => (
                <tr key={t.key} style={{ borderTop: `1px solid ${BORDER}` }}>
                  <td className="py-2.5 pr-3">
                    <div className="font-medium">{t.symbol || t.name}</div>
                    {t.symbol && t.name !== t.symbol && <div className="text-[10px]" style={{color:TEXT_MUTE}}>{t.name}</div>}
                  </td>
                  <td className="py-2.5 pr-3"><SectorBadge sectorId={t.sectorId} /></td>
                  <td className="py-2.5 pr-3 text-right tabular-nums"><ChangeCell value={t.change24h} /></td>
                  <td className="py-2.5 pr-3 text-right tabular-nums font-medium">{fmtCurrency(t.value)}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{fmtPct(t.pct, 2)}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums" style={{color: TEXT_DIM}}>{t.managerCount}</td>
                  <td className="py-2.5 text-right"><LiquidityBadge liquid={t.liquid} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

/* =============================================================================
   MANAGERS TAB — list of manager/vintage cards, click to drill into SOI detail
   ============================================================================= */
function ManagersTab({ rollup, store, onDrill, priceHistory, range, apiKey, clientShareMode, scaleBy }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {rollup.managerBreakdown.map(m => {
        const soi = store.soIs.find(s => s.id === m.soiId);
        const mgr = store.managers.find(mg => mg.id === m.managerId);
        const positions = (latestSnapshot(soi)?.positions || []).map(p => {
          const sectorId = resolveSector(p, store.sectorOverrides);
          const liquid = isLiquid(p);
          return { ...p, sectorId, liquid };
        });
        // Per-SOI sparkline
        const startMs = rangeToStartMs(range, positions);
        const series = apiKey && Object.keys(priceHistory).length > 0
          ? buildNAVSeriesSimple(positions, priceHistory, startMs, Date.now())
          : [];
        const startVal = series[0]?.value ?? 0;
        const endVal = series[series.length-1]?.value ?? 0;
        const retPct = startVal > 0 ? ((endVal - startVal) / startVal) * 100 : null;

        const bySector = _.groupBy(positions, 'sectorId');
        const sectorTop = Object.entries(bySector).map(([sid, items]) => {
          const val = _.sumBy(items, p => p.soiMarketValue || 0);
          return { id: sid, label: sectorOf(sid).label, color: sectorOf(sid).color, value: val };
        }).sort((a,b) => b.value - a.value).slice(0, 5);

        // Compute share % for client share mode display
        const sharePct = m._scale != null ? m._scale * 100 : null;

        return (
          <Panel key={m.soiId} className="p-5 hover:cursor-pointer transition-colors"
            style={{ borderColor: BORDER }}
            onClick={() => onDrill(m.soiId)}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="text-base font-semibold flex items-center gap-2">
                  {m.managerName}
                  {mgr?.type === 'fund_of_funds' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                      style={{backgroundColor: VIOLET+'22', color: VIOLET, border: `1px solid ${VIOLET}44`}}>FoF</span>
                  )}
                </div>
                <div className="text-xs" style={{color:TEXT_DIM}}>{m.vintage} • As of {m.asOfDate || '—'}</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold tabular-nums">{fmtCurrency(m.value)}</div>
                {clientShareMode && sharePct != null && (
                  <div className="text-[11px]" style={{color:TEXT_DIM}}>
                    {fmtPct(sharePct, 1)} share of fund
                  </div>
                )}
                <div className="text-xs" style={{color:TEXT_DIM}}>{fmtPct(m.pct, 1)} of book</div>
                {(() => {
                  const called = _.sumBy(store.commitments.filter(c => c.soiId === m.soiId), c => c.called || 0);
                  const moic = called > 0 ? m.value / called : null;
                  return <div className="text-xs mt-0.5 tabular-nums" style={{color:TEXT_DIM}}>MOIC {fmtMoic(moic)}</div>;
                })()}
              </div>
            </div>
            {series.length > 1 && (
              <div className="mt-3 flex items-center gap-3">
                <MiniSparkline series={series} width={140} height={34} />
                {retPct !== null && (
                  <div className="text-xs font-medium" style={{color: retPct >= 0 ? GREEN : RED}}>
                    {fmtPctSigned(retPct, 2)} <span style={{color:TEXT_MUTE}}>{range}</span>
                  </div>
                )}
              </div>
            )}
            <div className="mt-4 flex items-center gap-2 text-xs" style={{color:TEXT_DIM}}>
              <span>{m.positionCount} positions</span>
              <span style={{color:TEXT_MUTE}}>•</span>
              <span>Tap to drill in <ChevronRight size={12} className="inline" /></span>
            </div>
            <div className="mt-4">
              <div className="text-[10px] uppercase tracking-wider mb-1.5" style={{color:TEXT_MUTE}}>Sector tilt</div>
              <div className="flex h-2 rounded-full overflow-hidden" style={{backgroundColor: PANEL_2}}>
                {sectorTop.map(s => (
                  <div key={s.id} style={{ width: `${(s.value/m.value)*100}%`, backgroundColor: s.color }} title={s.label} />
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {sectorTop.slice(0, 3).map(s => (
                  <span key={s.id} className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: s.color+'22', color: s.color, border: `1px solid ${s.color}44` }}>
                    {s.label} {fmtPct((s.value/m.value)*100, 0)}
                  </span>
                ))}
              </div>
            </div>
          </Panel>
        );
      })}
    </div>
  );
}

/* =============================================================================
   POSITIONS TAB — flat rolled-up table of every underlying token
   ============================================================================= */
function PositionsTab({ rollup, store, updateStore }) {
  const [search, setSearch] = useState('');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [liquidityFilter, setLiquidityFilter] = useState('all');
  const [sortBy, setSortBy] = useState('value');
  const [sortDir, setSortDir] = useState('desc');

  const rows = useMemo(() => {
    let r = rollup.tokenRollup;
    if (search) {
      const s = search.toLowerCase();
      r = r.filter(x => String(x.symbol||'').toLowerCase().includes(s) || String(x.name||'').toLowerCase().includes(s));
    }
    if (sectorFilter !== 'all') r = r.filter(x => x.sectorId === sectorFilter);
    if (liquidityFilter === 'liquid') r = r.filter(x => x.liquid);
    if (liquidityFilter === 'illiquid') r = r.filter(x => !x.liquid);
    return _.orderBy(r, sortBy, sortDir);
  }, [rollup, search, sectorFilter, liquidityFilter, sortBy, sortDir]);

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  // Toggle liquidity on EVERY SAFT-type position with this ticker in the store
  const flipForceLiquid = (tokenKey, newValue) => {
    updateStore(s => ({
      ...s,
      soIs: s.soIs.map(soi => ({
        ...soi,
        snapshots: snapshotsOf(soi).map(snap => ({
          ...snap,
          positions: snap.positions.map(p => {
            const key = (p.ticker&&p.ticker.toUpperCase())||p.positionName;
            if (key !== tokenKey) return p;
            return { ...p, forceLiquid: newValue };
          }),
        })),
      })),
    }));
  };

  const changeSector = (tokenKey, sectorId) => {
    updateStore(s => {
      // Persist as a global override so future uploads with this ticker inherit it
      const newOverrides = { ...s.sectorOverrides };
      if (tokenKey && typeof tokenKey === 'string') newOverrides[tokenKey.toUpperCase()] = sectorId;
      return {
        ...s,
        sectorOverrides: newOverrides,
        soIs: s.soIs.map(soi => ({
          ...soi,
          snapshots: snapshotsOf(soi).map(snap => ({
            ...snap,
            positions: snap.positions.map(p => {
              const key = (p.ticker&&p.ticker.toUpperCase())||p.positionName;
              if (key !== tokenKey) return p;
              return { ...p, sectorId };
            }),
          })),
        })),
      };
    });
  };

  return (
    <div className="space-y-4">
      <Panel className="p-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-[220px]">
          <Search size={14} style={{ color: TEXT_DIM }} />
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search tokens…"
            className="flex-1 bg-transparent text-sm outline-none" style={{color:TEXT}} />
        </div>
        <select value={sectorFilter} onChange={e=>setSectorFilter(e.target.value)}
          className="text-xs px-2 py-1 rounded outline-none"
          style={{ backgroundColor: PANEL_2, color: TEXT, border: `1px solid ${BORDER}` }}>
          <option value="all">All sectors</option>
          {SECTORS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          <option value="unclassified">Unclassified</option>
        </select>
        <select value={liquidityFilter} onChange={e=>setLiquidityFilter(e.target.value)}
          className="text-xs px-2 py-1 rounded outline-none"
          style={{ backgroundColor: PANEL_2, color: TEXT, border: `1px solid ${BORDER}` }}>
          <option value="all">All liquidity</option>
          <option value="liquid">Liquid only</option>
          <option value="illiquid">Illiquid only</option>
        </select>
        <div className="text-xs" style={{color:TEXT_DIM}}>{rows.length} tokens</div>
      </Panel>
      <Panel className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: TEXT_MUTE, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `1px solid ${BORDER}` }}>
                <SortHead col="symbol"  by={sortBy} dir={sortDir} onClick={toggleSort} align="left">Token</SortHead>
                <SortHead col="sectorId" by={sortBy} dir={sortDir} onClick={toggleSort} align="left">Sector</SortHead>
                <SortHead col="change24h" by={sortBy} dir={sortDir} onClick={toggleSort} align="right">24h</SortHead>
                <SortHead col="value" by={sortBy} dir={sortDir} onClick={toggleSort} align="right">Value</SortHead>
                <SortHead col="pct" by={sortBy} dir={sortDir} onClick={toggleSort} align="right">% Book</SortHead>
                <SortHead col="managerCount" by={sortBy} dir={sortDir} onClick={toggleSort} align="right">In funds</SortHead>
                <th className="text-right px-3 py-2">Liquidity</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(t => (
                <tr key={t.key} style={{ borderBottom: `1px solid ${BORDER}` }}>
                  <td className="px-3 py-2.5">
                    <div className="font-medium">{t.symbol || t.name}</div>
                    {t.symbol && t.name !== t.symbol && <div className="text-[10px]" style={{color:TEXT_MUTE}}>{t.name}</div>}
                    <div className="text-[10px] mt-0.5" style={{color:TEXT_MUTE}}>
                      {t.managers.slice(0,2).join(' • ')}{t.managers.length>2 ? ` +${t.managers.length-2}` : ''}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <select value={t.sectorId} onChange={e=>changeSector(t.key, e.target.value)}
                      className="text-xs px-1.5 py-0.5 rounded outline-none"
                      style={{ backgroundColor: 'transparent', color: sectorOf(t.sectorId).color, border: `1px solid ${sectorOf(t.sectorId).color}44` }}>
                      {SECTORS.map(s => <option key={s.id} value={s.id} style={{backgroundColor:PANEL, color:TEXT}}>{s.label}</option>)}
                      <option value="unclassified" style={{backgroundColor:PANEL, color:TEXT}}>Unclassified</option>
                    </select>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums"><ChangeCell value={t.change24h} /></td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-medium">{fmtCurrency(t.value)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmtPct(t.pct, 2)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums" style={{color:TEXT_DIM}}>{t.managerCount}</td>
                  <td className="px-3 py-2.5 text-right">
                    <button onClick={()=>flipForceLiquid(t.key, !t.forceLiquid)}
                      className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: t.liquid ? GREEN+'22' : GOLD+'22',
                        color: t.liquid ? GREEN : GOLD,
                        border: `1px solid ${t.liquid ? GREEN+'44' : GOLD+'44'}`,
                      }}
                      title={t.forceLiquid ? 'Click to revert to snapshot treatment' : 'Mark as liquid (TGE\'d)'}>
                      {t.liquid ? 'Liquid' : 'Illiquid'}
                      {t.forceLiquid && <span style={{opacity:0.7}}>•</span>}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
function SortHead({ col, by, dir, onClick, align, children }) {
  const active = by === col;
  return (
    <th className={`px-3 py-2 ${align==='right'?'text-right':'text-left'} cursor-pointer select-none`}
      onClick={() => onClick(col)}
      style={{ color: active ? TEXT : TEXT_MUTE }}>
      {children}{active ? (dir==='asc' ? ' ▲' : ' ▼') : ''}
    </th>
  );
}

/* =============================================================================
   SOI DETAIL — drill into a single manager/vintage
   ============================================================================= */
function SOIDetail({ store, soiId, livePrices, onBack, updateStore, priceHistory, historyLoading, historyProgress, range, onRangeChange, onRequestFetch, apiKey }) {
  const soi = store.soIs.find(s => s.id === soiId);
  const manager = store.managers.find(m => m.id === soi?.managerId);
  const [editingPosition, setEditingPosition] = useState(null); // {mode: 'add'|'edit', position?}
  const [updatingSOI, setUpdatingSOI] = useState(false);

  const snaps = soi ? sortedSnapshots(soi) : [];
  const [selectedSnapId, setSelectedSnapId] = useState(() => latestSnapshot(soi)?.id ?? null);
  useEffect(() => { setSelectedSnapId(latestSnapshot(soi)?.id ?? null); }, [soiId]);

  if (!soi) return null;

  const selectedSnap = snaps.find(s => s.id === selectedSnapId) || latestSnapshot(soi) || snaps[0];

  // Build enriched positions for this one SOI
  const rows = useMemo(() => {
    return (selectedSnap?.positions || []).map(p => {
      const sectorId = resolveSector(p, store.sectorOverrides);
      const liquid = isLiquid(p);
      const live = p.cgTokenId && livePrices[p.cgTokenId];
      const useLive = !!live && liquid;
      const currentValue = useLive && p.quantity ? p.quantity * live.usd : p.soiMarketValue;
      return {
        ...p, sectorId, liquid, currentValue,
        livePrice: useLive ? live.usd : null,
        change24h: useLive ? live.change24h : null,
        hasLivePrice: useLive,
      };
    });
  }, [selectedSnap, store.sectorOverrides, livePrices]);

  const totalNAV = _.sumBy(rows, 'currentValue');
  const soiNAV = _.sumBy(rows, 'soiMarketValue');
  const liquidNAV = _.sumBy(rows.filter(r=>r.liquid), 'currentValue');
  const illiquidNAV = _.sumBy(rows.filter(r=>!r.liquid), 'currentValue');

  const bySector = _.groupBy(rows, 'sectorId');
  const sectorData = SECTORS.map(s => {
    const items = bySector[s.id] || [];
    const v = _.sumBy(items, 'currentValue');
    return { id: s.id, label: s.label, color: s.color, value: v, pct: totalNAV>0?(v/totalNAV)*100:0, count: items.length };
  }).filter(s => s.value > 0);

  const deleteSnapshot = (snapId) => {
    if (snaps.length <= 1) { alert('Cannot delete the only snapshot.'); return; }
    if (!confirm('Delete this snapshot? This cannot be undone.')) return;
    updateStore(s => ({
      ...s,
      soIs: s.soIs.map(x => x.id !== soiId ? x : {
        ...x,
        snapshots: snapshotsOf(x).filter(snap => snap.id !== snapId),
      }),
    }));
    const remaining = snaps.filter(s => s.id !== snapId);
    setSelectedSnapId(remaining[remaining.length - 1]?.id ?? null);
  };

  const cycleLiquidity = (posId) => {
    // auto → liquid → illiquid → auto
    const cur = rows.find(r => r.id === posId);
    const curOverride = liquidityOverrideOf(cur);
    const next = curOverride === 'auto' ? (cur.liquid ? 'illiquid' : 'liquid')
               : curOverride === 'liquid' ? 'illiquid' : 'auto';
    updateStore(s => ({
      ...s,
      soIs: s.soIs.map(x => x.id !== soiId ? x : {
        ...x,
        snapshots: snapshotsOf(x).map(snap =>
          snap.id !== selectedSnapId ? snap : {
            ...snap,
            positions: snap.positions.map(p => {
              if (p.id !== posId) return p;
              const copy = { ...p, liquidityOverride: next };
              delete copy.forceLiquid;
              return copy;
            }),
          }
        ),
      }),
    }));
  };

  const savePosition = (payload) => {
    updateStore(s => ({
      ...s,
      soIs: s.soIs.map(x => {
        if (x.id !== soiId) return x;
        return {
          ...x,
          snapshots: snapshotsOf(x).map(snap => {
            if (snap.id !== selectedSnapId) return snap;
            if (payload.id && snap.positions.find(p => p.id === payload.id)) {
              return { ...snap, positions: snap.positions.map(p => p.id === payload.id ? { ...p, ...payload } : p) };
            }
            return { ...snap, positions: [...snap.positions, { ...payload, id: payload.id || uid() }] };
          }),
        };
      }),
    }));
    setEditingPosition(null);
  };

  const deletePosition = (posId) => {
    if (!confirm('Delete this position?')) return;
    updateStore(s => ({
      ...s,
      soIs: s.soIs.map(x => x.id !== soiId ? x : {
        ...x,
        snapshots: snapshotsOf(x).map(snap =>
          snap.id !== selectedSnapId ? snap : { ...snap, positions: snap.positions.filter(p => p.id !== posId) }
        ),
      }),
    }));
  };

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-xs flex items-center gap-1 hover:underline" style={{color:TEXT_DIM}}>
        <ArrowLeft size={12} /> Back to managers
      </button>
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider" style={{color:TEXT_MUTE}}>Fund snapshot</div>
          <h2 className="text-xl font-semibold mt-0.5">{manager?.name} — {fundLabel(soi)}</h2>
          <div className="text-xs mt-1 flex items-center gap-2" style={{color:TEXT_DIM}}>
            {snaps.length >= 2 ? (
              <div className="flex items-center gap-2">
                <select value={selectedSnapId || ''} onChange={e => setSelectedSnapId(e.target.value)}
                  className="text-xs px-2 py-1 rounded outline-none"
                  style={{color:GOLD, backgroundColor:GOLD+'11', border:`1px solid ${GOLD}44`}}>
                  {[...snaps].reverse().map(snap => (
                    <option key={snap.id} value={snap.id}>
                      As of {snap.asOfDate || '—'}{snap.notes ? ` (${snap.notes})` : ''}
                    </option>
                  ))}
                </select>
                {snaps.length > 1 && (
                  <button onClick={() => deleteSnapshot(selectedSnapId)}
                    className="text-xs px-2 py-1 rounded flex items-center gap-1"
                    style={{color:RED, border:`1px solid ${RED}44`}}>
                    <Trash2 size={10}/> Delete snapshot
                  </button>
                )}
              </div>
            ) : (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded" style={{color:GOLD, backgroundColor:GOLD+'11', border:`1px solid ${GOLD}44`}}>
                As of {selectedSnap?.asOfDate || '—'}
              </span>
            )}
            <span>{rows.length} positions</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wider" style={{color:TEXT_MUTE}}>Fund NAV</div>
          <div className="text-xl font-semibold">{fmtCurrency(totalNAV)}</div>
          {totalNAV !== soiNAV && (
            <div className="text-[11px]" style={{color:TEXT_DIM}}>
              Snapshot: {fmtCurrency(soiNAV)} • <ChangeCell value={((totalNAV-soiNAV)/soiNAV)*100} />
            </div>
          )}
        </div>
      </div>

      {/* Performance chart */}
      <PerformanceChart
        soiBundles={[soi]}
        priceHistory={priceHistory}
        historyLoading={historyLoading}
        historyProgress={historyProgress}
        range={range}
        onRangeChange={onRangeChange}
        onRequestFetch={onRequestFetch}
        apiKey={apiKey}
        title={`${manager?.name} ${soi.vintage} performance`}
        height={240}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="NAV" value={fmtCurrency(totalNAV)} />
        <KPI label="Positions" value={rows.length} />
        <KPI label="Liquid" value={fmtCurrency(liquidNAV)} sub={fmtPct(totalNAV>0?(liquidNAV/totalNAV)*100:0,1)} />
        <KPI label="Illiquid" value={fmtCurrency(illiquidNAV)} sub={fmtPct(totalNAV>0?(illiquidNAV/totalNAV)*100:0,1)} />
      </div>

      {(() => {
        const commitment = store.commitments.find(c => c.soiId === soi.id);
        if (!commitment) {
          return (
            <Panel className="p-5">
              <div className="text-xs uppercase tracking-wider mb-2" style={{color:TEXT_MUTE}}>Fund economics</div>
              <div className="text-sm" style={{color:TEXT_DIM}}>No commitment linked to this SOI.</div>
            </Panel>
          );
        }
        const committed = commitment.committed || 0;
        const called = commitment.called || 0;
        const distributions = commitment.distributions || 0;
        const uncalled = committed - called;
        const pctInvested = committed > 0 ? (called / committed) * 100 : null;
        const unrealizedMoic = called > 0 ? totalNAV / called : null;
        const dpi = called > 0 ? distributions / called : null;
        const tvpi = called > 0 ? (totalNAV + distributions) / called : null;
        const updateCommitment = (patch) => updateStore(s => ({
          ...s, commitments: s.commitments.map(c => c.id === commitment.id ? { ...c, ...patch } : c),
        }));
        return (
          <Panel className="p-5">
            <div className="text-xs uppercase tracking-wider mb-3" style={{color:TEXT_MUTE}}>Fund economics</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <NumField label="Commitment" value={committed} onSave={v => updateCommitment({ committed: v })} />
              <NumField label="Called" value={called} onSave={v => updateCommitment({ called: v })} />
              <NumField label="Distributions" value={distributions} onSave={v => updateCommitment({ distributions: v })} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <Stat label="Uncalled" value={fmtCurrency(uncalled)} />
              <Stat label="% Invested" value={pctInvested != null ? fmtPct(pctInvested, 1) : '—'} />
              <Stat label="Unrealized MOIC" value={fmtMoic(unrealizedMoic)} />
              <Stat label="DPI" value={fmtMoic(dpi)} />
              <Stat label="TVPI" value={fmtMoic(tvpi)} />
            </div>
            {(() => {
              const fundTotalCalled = _.sumBy(latestSnapshot(soi)?.positions||[], p=>p.soiMarketValue||0);
              const shareOfFund = fundTotalCalled > 0 ? (called/fundTotalCalled)*100 : null;
              return (
                <div className="grid grid-cols-2 gap-2 pt-2 mt-2" style={{borderTop: `1px solid ${BORDER}`}}>
                  <Stat label="Fund Total NAV" value={fmtCurrency(fundTotalCalled)} />
                  <Stat label="Your Share of Fund" value={shareOfFund != null ? fmtPct(shareOfFund, 2) : '—'} />
                </div>
              );
            })()}
          </Panel>
        );
      })()}

      {/* Underlying Commitments — only shown for FoF SOIs */}
      {manager?.type === 'fund_of_funds' && (() => {
        const subCommitments = selectedSnap?.subCommitments || [];
        const fofTotalCalled = _.sumBy(subCommitments, s => s.called || 0);
        return (
          <Panel className="p-5">
            <div className="text-xs uppercase tracking-wider mb-3" style={{color:TEXT_MUTE}}>
              Underlying Manager Commitments ({subCommitments.length})
            </div>
            {subCommitments.length === 0 ? (
              <div className="text-sm" style={{color:TEXT_DIM}}>No sub-commitments in this snapshot.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{color:TEXT_MUTE, fontSize:11, textTransform:'uppercase', letterSpacing:'0.05em', borderBottom:`1px solid ${BORDER}`}}>
                      <th className="text-left px-3 py-2">Fund</th>
                      <th className="text-right px-3 py-2">Committed</th>
                      <th className="text-right px-3 py-2">Called</th>
                      <th className="text-right px-3 py-2">Distributions</th>
                      <th className="text-right px-3 py-2">Underlying NAV</th>
                      <th className="text-right px-3 py-2">FoF Share %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subCommitments.map(sub => {
                      const targetSoi = store.soIs.find(s => s.id === sub.toSoiId);
                      const targetMgr = targetSoi ? store.managers.find(mm => mm.id === targetSoi.managerId) : null;
                      const underlyingMV = _.sumBy(latestSnapshot(targetSoi)?.positions || [], p => p.soiMarketValue || 0);
                      const fofSharePct = underlyingMV > 0 ? (sub.called || 0) / underlyingMV * 100 : null;
                      const pctOfFoF = fofTotalCalled > 0 ? (sub.called || 0) / fofTotalCalled * 100 : null;
                      return (
                        <tr key={sub.id} style={{borderBottom:`1px solid ${BORDER}`}}>
                          <td className="px-3 py-2.5">
                            <div className="font-medium">{targetMgr?.name || '?'}</div>
                            <div className="text-[10px]" style={{color:TEXT_DIM}}>{targetSoi?.vintage || '—'}</div>
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{fmtCurrency(sub.committed)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            {fmtCurrency(sub.called)}
                            {pctOfFoF != null && <div className="text-[10px]" style={{color:TEXT_DIM}}>{fmtPct(pctOfFoF, 1)} of FoF</div>}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{fmtCurrency(sub.distributions)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{underlyingMV > 0 ? fmtCurrency(underlyingMV) : '—'}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            {fofSharePct != null ? <span style={{color: ACCENT_2}}>{fmtPct(fofSharePct, 2)}</span> : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        );
      })()}

      <Panel className="p-5">
        <div className="text-xs uppercase tracking-wider mb-3" style={{color:TEXT_MUTE}}>Sector tilt</div>
        <div className="flex h-3 rounded-full overflow-hidden mb-3" style={{backgroundColor:PANEL_2}}>
          {sectorData.map(s => (
            <div key={s.id} style={{width: `${s.pct}%`, backgroundColor: s.color}} title={`${s.label} ${fmtPct(s.pct,1)}`} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {sectorData.map(s => (
            <div key={s.id} className="text-xs px-2 py-1 rounded flex items-center gap-1.5"
              style={{backgroundColor: s.color+'22', color: s.color, border: `1px solid ${s.color}44`}}>
              <span className="w-1.5 h-1.5 rounded-full" style={{backgroundColor: s.color}} />
              {s.label} <span className="tabular-nums">{fmtPct(s.pct,1)}</span>
            </div>
          ))}
        </div>
      </Panel>

      {/* Positions table */}
      <Panel className="p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3" style={{borderBottom: `1px solid ${BORDER}`}}>
          <div className="text-sm font-semibold">Positions</div>
          <div className="flex items-center gap-2">
            <button onClick={() => setUpdatingSOI(true)}
              className="text-xs px-3 py-1.5 rounded font-medium flex items-center gap-1"
              style={{color: TEXT, backgroundColor: PANEL_2, border: `1px solid ${BORDER}`}}>
              <RefreshCw size={12} /> Update holdings
            </button>
            <button onClick={() => setEditingPosition({ mode: 'add' })}
              className="text-xs px-3 py-1.5 rounded font-medium flex items-center gap-1"
              style={{backgroundColor: ACCENT, color: BG}}>
              <Plus size={12} /> Add position
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: TEXT_MUTE, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `1px solid ${BORDER}` }}>
                <th className="text-left px-3 py-2">Position</th>
                <th className="text-left px-3 py-2">Sector</th>
                <th className="text-right px-3 py-2">Qty</th>
                <th className="text-right px-3 py-2">Snap Px</th>
                <th className="text-right px-3 py-2">Live Px</th>
                <th className="text-right px-3 py-2">24h</th>
                <th className="text-right px-3 py-2">Cost</th>
                <th className="text-right px-3 py-2">Value</th>
                <th className="text-right px-3 py-2">P&amp;L $</th>
                <th className="text-right px-3 py-2">P&amp;L %</th>
                <th className="text-right px-3 py-2">% NAV</th>
                <th className="text-right px-3 py-2">Liquidity</th>
                <th className="text-right px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {_.orderBy(rows, 'currentValue', 'desc').map(p => {
                const pct = totalNAV>0 ? (p.currentValue/totalNAV)*100 : 0;
                const plDollars = p.costBasis != null ? p.currentValue - p.costBasis : null;
                const plPct = (p.costBasis != null && p.costBasis !== 0) ? (plDollars / p.costBasis) * 100 : null;
                const override = liquidityOverrideOf(p);
                return (
                  <tr key={p.id} style={{borderBottom: `1px solid ${BORDER}`}}>
                    <td className="px-3 py-2.5">
                      <div className="font-medium">{p.positionName}</div>
                      <div className="text-[10px]" style={{color:TEXT_MUTE}}>
                        {p.ticker && <span>{p.ticker}</span>}
                        {p.assetType && <span> • {p.assetType}</span>}
                        {p.acquisitionDate && <span> • Acq {String(p.acquisitionDate).slice(0,10)}</span>}
                      </div>
                      {p.notes && <div className="text-[10px] mt-0.5" style={{color:TEXT_DIM}}>{p.notes}</div>}
                    </td>
                    <td className="px-3 py-2.5"><SectorBadge sectorId={p.sectorId} /></td>
                    <td className="px-3 py-2.5 text-right tabular-nums" style={{color: p.quantity ? TEXT : TEXT_MUTE}}>
                      {p.quantity ? p.quantity.toLocaleString(undefined,{maximumFractionDigits: 2}) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums" style={{color:TEXT_DIM}}>
                      {p.soiPrice ? `$${p.soiPrice.toLocaleString(undefined,{maximumFractionDigits: 4})}` : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {p.livePrice ? <span style={{color:GREEN}}>${p.livePrice.toLocaleString(undefined,{maximumFractionDigits: 4})}</span> : <span style={{color:TEXT_MUTE}}>—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums"><ChangeCell value={p.change24h} /></td>
                    <td className="px-3 py-2.5 text-right tabular-nums" style={{color:TEXT_DIM}}>
                      {p.costBasis != null ? fmtCurrency(p.costBasis) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium">{fmtCurrency(p.currentValue)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {plDollars != null ? <ChangeCell value={plDollars} format="currency" /> : <span style={{color:TEXT_MUTE}}>—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {plPct != null ? <ChangeCell value={plPct} /> : <span style={{color:TEXT_MUTE}}>—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{fmtPct(pct,2)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <button onClick={()=>cycleLiquidity(p.id)}
                        className="text-[10px] px-1.5 py-0.5 rounded inline-flex items-center gap-1"
                        style={{
                          backgroundColor: p.liquid ? GREEN+'22' : GOLD+'22',
                          color: p.liquid ? GREEN : GOLD,
                          border: `1px solid ${p.liquid ? GREEN+'44' : GOLD+'44'}`,
                        }}
                        title={
                          override === 'auto' ? 'Click to override (next: ' + (p.liquid ? 'Illiquid' : 'Liquid') + ')' :
                          override === 'liquid' ? 'Forced liquid. Click for Illiquid.' :
                          'Forced illiquid. Click to reset to auto.'
                        }>
                        {p.liquid ? 'Liquid' : 'Illiquid'}
                        {override !== 'auto' && <Check size={10} />}
                      </button>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={()=>setEditingPosition({mode:'edit', position: p})}
                          className="p-1 rounded" style={{color:TEXT_DIM}} title="Edit">
                          <Edit2 size={12} />
                        </button>
                        <button onClick={()=>deletePosition(p.id)}
                          className="p-1 rounded" style={{color:TEXT_DIM}} title="Delete">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {editingPosition && (
        <PositionEditor
          mode={editingPosition.mode}
          position={editingPosition.position}
          onCancel={() => setEditingPosition(null)}
          onSave={savePosition}
        />
      )}

      {updatingSOI && (
        <ImportWizard
          store={store}
          updateStore={updateStore}
          onClose={() => setUpdatingSOI(false)}
          onDone={() => setUpdatingSOI(false)}
          prefillTarget={{ soiId, managerId: soi.managerId, mode: 'replace' }}
        />
      )}
    </div>
  );
}

/* =============================================================================
   POSITION EDITOR MODAL — add or edit a single position
   ============================================================================= */
function PositionEditor({ mode, position, onCancel, onSave }) {
  const [form, setForm] = useState(() => ({
    id: position?.id || null,
    positionName: position?.positionName || '',
    ticker: position?.ticker || '',
    assetType: position?.assetType || 'Liquid Token',
    sectorId: position?.sectorId || 'infrastructure',
    quantity: position?.quantity ?? '',
    soiPrice: position?.soiPrice ?? '',
    soiMarketValue: position?.soiMarketValue ?? '',
    costBasis: position?.costBasis ?? '',
    acquisitionDate: position?.acquisitionDate || '',
    liquidityOverride: liquidityOverrideOf(position || {}),
    cgTokenId: position?.cgTokenId || '',
    notes: position?.notes || '',
  }));

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const canSave = form.positionName && form.soiMarketValue !== '' && parseNum(form.soiMarketValue) != null;

  const handleSave = () => {
    const qty = parseNum(form.quantity);
    const price = parseNum(form.soiPrice);
    let mv = parseNum(form.soiMarketValue);
    if ((mv == null || mv === 0) && qty != null && price != null) mv = qty * price;
    const payload = {
      id: form.id || undefined,
      positionName: form.positionName.trim(),
      ticker: form.ticker.trim(),
      assetType: form.assetType,
      sectorId: form.sectorId,
      quantity: qty,
      soiPrice: price,
      soiMarketValue: mv || 0,
      costBasis: parseNum(form.costBasis),
      acquisitionDate: form.acquisitionDate || null,
      liquidityOverride: form.liquidityOverride,
      cgTokenId: form.cgTokenId.trim() || null,
      chain: null, address: null,
      notes: form.notes,
    };
    onSave(payload);
  };

  return (
    <Modal title={mode === 'edit' ? `Edit: ${position?.positionName || 'Position'}` : 'Add position'} onClose={onCancel}>
      <div className="p-5 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Position Name *">
            <TextInput value={form.positionName} onChange={v=>set('positionName', v)} placeholder="e.g., Ethereum" />
          </Field>
          <Field label="Ticker / Symbol">
            <TextInput value={form.ticker} onChange={v=>set('ticker', v.toUpperCase())} placeholder="e.g., ETH" />
          </Field>
          <Field label="Asset Type">
            <Select value={form.assetType} onChange={v=>set('assetType', v)} options={[
              {value: 'Liquid Token', label: 'Liquid Token'},
              {value: 'SAFT', label: 'SAFT (pre-TGE)'},
              {value: 'SAFE', label: 'SAFE (equity)'},
              {value: 'Warrant', label: 'Warrant'},
              {value: 'LP Token', label: 'LP Token'},
              {value: 'Stablecoin', label: 'Stablecoin / Cash'},
              {value: 'Unclassified', label: 'Unclassified'},
            ]} />
          </Field>
          <Field label="Sector">
            <Select value={form.sectorId} onChange={v=>set('sectorId', v)} options={[
              ...SECTORS.map(s => ({value: s.id, label: s.label})),
              {value: 'unclassified', label: 'Unclassified'},
            ]} />
          </Field>
          <Field label="Quantity">
            <TextInput value={form.quantity} onChange={v=>set('quantity', v)} placeholder="e.g., 1000000" align="right" />
          </Field>
          <Field label="Price at snapshot (per unit)">
            <TextInput value={form.soiPrice} onChange={v=>set('soiPrice', v)} placeholder="e.g., 2200" align="right" />
          </Field>
          <Field label="Market Value at snapshot *">
            <TextInput value={form.soiMarketValue} onChange={v=>set('soiMarketValue', v)} placeholder="e.g., 2200000" align="right" />
          </Field>
          <Field label="Cost Basis ($)">
            <TextInput value={form.costBasis} onChange={v=>set('costBasis', v)} placeholder="e.g., 1500000" align="right" />
          </Field>
          <Field label="Acquisition Date">
            <TextInput type="date" value={form.acquisitionDate} onChange={v=>set('acquisitionDate', v)} />
          </Field>
          <Field label="Liquidity">
            <Select value={form.liquidityOverride} onChange={v=>set('liquidityOverride', v)} options={[
              {value: 'auto', label: 'Auto (based on asset type)'},
              {value: 'liquid', label: 'Force liquid'},
              {value: 'illiquid', label: 'Force illiquid'},
            ]} />
          </Field>
          <Field label="CoinGecko Token ID (for live prices)" full>
            <TextInput value={form.cgTokenId} onChange={v=>set('cgTokenId', v)} placeholder="e.g., ethereum, hyperliquid, ondo-finance" />
            <div className="text-[10px] mt-1" style={{color:TEXT_MUTE}}>
              Find this in the URL on coingecko.com (e.g., coingecko.com/en/coins/<strong style={{color:TEXT_DIM}}>ethereum</strong>)
            </div>
          </Field>
          <Field label="Notes" full>
            <TextInput value={form.notes} onChange={v=>set('notes', v)} placeholder="Optional — e.g., locked until 2027, side letter terms" />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-3" style={{borderTop: `1px solid ${BORDER}`}}>
          <button onClick={onCancel} className="text-xs px-3 py-1.5 rounded"
            style={{color:TEXT_DIM, border:`1px solid ${BORDER}`}}>Cancel</button>
          <button onClick={handleSave} disabled={!canSave}
            className="text-xs px-4 py-1.5 rounded font-medium flex items-center gap-1"
            style={{backgroundColor: ACCENT, color: BG, opacity: canSave?1:0.4}}>
            <Check size={12}/> {mode === 'edit' ? 'Save changes' : 'Add position'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, children, full }) {
  return (
    <div className={full ? 'md:col-span-2' : ''}>
      <label className="text-[10px] uppercase tracking-wider" style={{color:TEXT_MUTE}}>{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
function TextInput({ value, onChange, placeholder, type='text', align }) {
  return (
    <input type={type} value={value ?? ''} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
      className={`w-full px-3 py-2 rounded text-sm outline-none ${align==='right'?'text-right tabular-nums':''}`}
      style={{backgroundColor: PANEL_2, color: TEXT, border: `1px solid ${BORDER}`}} />
  );
}
function NumField({ label, value, onSave }) {
  const [text, setText] = useState(String(value ?? ''));
  useEffect(() => { setText(String(value ?? '')); }, [value]);
  const commit = () => {
    const n = parseNum(text);
    if (n == null) { setText(String(value ?? '')); return; }
    if (n !== value) onSave(n);
  };
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider mb-1" style={{color:TEXT_MUTE}}>{label}</div>
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setText(String(value ?? '')); e.currentTarget.blur(); } }}
        className="w-full px-3 py-2 rounded text-sm outline-none text-right tabular-nums"
        style={{backgroundColor: PANEL_2, color: TEXT, border: `1px solid ${BORDER}`}}
      />
    </div>
  );
}
function Stat({ label, value }) {
  return (
    <div className="px-3 py-2 rounded" style={{backgroundColor: PANEL_2, border: `1px solid ${BORDER}`}}>
      <div className="text-[10px] uppercase tracking-wider" style={{color:TEXT_MUTE}}>{label}</div>
      <div className="text-sm font-semibold mt-0.5 tabular-nums">{value}</div>
    </div>
  );
}
function Select({ value, onChange, options }) {
  return (
    <select value={value} onChange={e=>onChange(e.target.value)}
      className="w-full px-3 py-2 rounded text-sm outline-none"
      style={{backgroundColor: PANEL_2, color: TEXT, border: `1px solid ${BORDER}`}}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

/* =============================================================================
   IMPORT WIZARD — file upload → map cols → assign to manager/client → save
   Also supports manual entry from scratch.
   ============================================================================= */
function ImportWizard({ store, updateStore, onClose, onDone, prefillTarget }) {
  // If prefilled (quarterly update), jump straight to upload step and pre-select the target
  const isReplaceMode = !!prefillTarget;
  const prefilledSoi = prefillTarget ? store.soIs.find(s => s.id === prefillTarget.soiId) : null;
  const prefilledManager = prefillTarget ? store.managers.find(m => m.id === prefillTarget.managerId) : null;
  const prefilledClient = prefillTarget
    ? store.commitments.find(c => c.soiId === prefillTarget.soiId)?.clientId
    : null;

  const [mode, setMode] = useState(isReplaceMode ? 'upload' : 'choose'); // choose | upload | manual
  const [step, setStep] = useState(isReplaceMode ? 1 : 1); // 1 file, 2 map, 3 assign
  const [fileName, setFileName] = useState('');
  const [sheetName, setSheetName] = useState('');
  const [sheets, setSheets] = useState({});
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [columnMap, setColumnMap] = useState({});
  const [autoScores, setAutoScores] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Update behavior: 'new' | 'add_snapshot' | 'replace_latest'
  // Only relevant when user selects a manager that already has SOIs
  const [updateBehavior, setUpdateBehavior] = useState(isReplaceMode ? 'replace_latest' : 'new');
  const [replaceTargetSoiId, setReplaceTargetSoiId] = useState(isReplaceMode ? prefillTarget.soiId : '');

  // Assignment fields
  const [assignClientId, setAssignClientId] = useState(prefilledClient || store.clients[0]?.id || '');
  const [newClientName, setNewClientName] = useState('');
  const [assignManagerId, setAssignManagerId] = useState(prefilledManager?.id || '');
  const [newManagerName, setNewManagerName] = useState('');
  const [newManagerType, setNewManagerType] = useState('direct');
  const [vintage, setVintage] = useState(prefilledSoi?.vintage || '');
  const [asOfDate, setAsOfDate] = useState(today());
  const [committed, setCommitted] = useState('');

  // Manual entry state
  const [manualPositions, setManualPositions] = useState([{
    positionName: '', ticker: '', quantity: '', soiMarketValue: '', sectorId: 'infrastructure', acquisitionDate: '', assetType: 'Liquid Token',
  }]);

  const handleFile = async (file) => {
    setLoading(true); setError(''); setFileName(file.name);
    try {
      const ext = file.name.split('.').pop().toLowerCase();
      const out = {};
      if (ext === 'csv') {
        const text = await file.text();
        const parsed = Papa.parse(text, { header: false, dynamicTyping: false, skipEmptyLines: 'greedy' });
        const m = parsed.data; if (!m.length) throw new Error('CSV appears empty.');
        const hi = detectHeaderRow(m);
        const hdrs = dedupeHeaders((m[hi] || []).map(c => String(c ?? '')));
        const dataRows = m.slice(hi + 1).map(arr => { const o = {}; hdrs.forEach((h, i) => { o[h] = arr[i] ?? ''; }); return o; });
        out['Sheet1'] = { headers: hdrs, rows: dataRows };
      } else if (ext === 'xlsx' || ext === 'xls') {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array', cellDates: true });
        for (const name of wb.SheetNames) {
          const sheet = wb.Sheets[name];
          const m = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false, blankrows: false });
          if (!m.length) continue;
          const hi = detectHeaderRow(m);
          const hdrs = dedupeHeaders((m[hi] || []).map(c => String(c ?? '')));
          const dataRows = m.slice(hi + 1).map(arr => { const o = {}; hdrs.forEach((h, i) => { o[h] = arr[i] ?? ''; }); return o; });
          out[name] = { headers: hdrs, rows: dataRows };
        }
      } else throw new Error('Use .xlsx, .xls, or .csv.');
      if (!Object.keys(out).length) throw new Error('No readable sheets.');
      setSheets(out);
      // Auto-pick best-scoring sheet
      let best = Object.keys(out)[0], bestScore = -1;
      for (const n of Object.keys(out)) {
        const { scores } = autoMapColumns(out[n].headers);
        const total = Object.values(scores).reduce((a,b)=>a+b, 0);
        if (total > bestScore) { bestScore = total; best = n; }
      }
      setSheetName(best);
      const s = out[best];
      const { mapping, scores } = autoMapColumns(s.headers);
      setHeaders(s.headers); setRows(s.rows); setColumnMap(mapping); setAutoScores(scores);
      setStep(2);
    } catch (e) { setError(e.message || 'Failed to parse.'); }
    finally { setLoading(false); }
  };

  const switchSheet = (name) => {
    setSheetName(name);
    const s = sheets[name];
    const { mapping, scores } = autoMapColumns(s.headers);
    setHeaders(s.headers); setRows(s.rows); setColumnMap(mapping); setAutoScores(scores);
  };

  const parsedPositions = useMemo(() => {
    if (!columnMap.positionName) return [];
    const out = [];
    for (const row of rows) {
      const name = String(row[columnMap.positionName] ?? '').trim();
      if (!name || SUBTOTAL_PATTERNS.test(name)) continue;
      const qty = columnMap.quantity ? parseNum(row[columnMap.quantity]) : null;
      const price = columnMap.price ? parseNum(row[columnMap.price]) : null;
      let mv = columnMap.marketValue ? parseNum(row[columnMap.marketValue]) : null;
      if ((mv === null || mv === 0) && qty !== null && price !== null) mv = qty * price;
      if (mv === null) continue;
      const ticker = columnMap.ticker ? String(row[columnMap.ticker] ?? '').trim() : '';
      const assetType = columnMap.assetType ? (String(row[columnMap.assetType] ?? '').trim() || 'Unclassified') : 'Unclassified';
      const sector = columnMap.sector ? (String(row[columnMap.sector] ?? '').trim()) : '';
      const cost = columnMap.costBasis ? parseNum(row[columnMap.costBasis]) : null;
      const acq = columnMap.acquisitionDate ? parseDate(row[columnMap.acquisitionDate]) : null;

      // Sector: (1) user's column value mapped to our canonical ids if possible, (2) ticker→default, (3) unclassified
      let sectorId = UNCLASSIFIED.id;
      if (sector) {
        const n = normalize(sector);
        const match = SECTORS.find(s => n.includes(s.id) || s.label.toLowerCase().includes(n) || n.includes(s.label.toLowerCase()));
        if (match) sectorId = match.id;
      }
      if (sectorId === UNCLASSIFIED.id && ticker) {
        const sym = ticker.toUpperCase();
        if (DEFAULT_TOKEN_SECTOR[sym]) sectorId = DEFAULT_TOKEN_SECTOR[sym];
      }

      out.push({
        id: uid(),
        positionName: name,
        ticker, quantity: qty, soiPrice: price, costBasis: cost,
        soiMarketValue: mv,
        acquisitionDate: acq ? acq.toISOString().slice(0,10) : null,
        assetType, sectorId,
        forceLiquid: false,
        cgTokenId: null, chain: null, address: null, notes: '',
      });
    }
    return out;
  }, [rows, columnMap]);

  const finalize = () => {
    const positions = mode === 'manual'
      ? manualPositions.filter(p => p.positionName && p.soiMarketValue).map(p => ({
          id: uid(),
          positionName: p.positionName,
          ticker: p.ticker || '',
          quantity: parseNum(p.quantity),
          soiPrice: null,
          costBasis: null,
          soiMarketValue: parseNum(p.soiMarketValue) || 0,
          acquisitionDate: p.acquisitionDate || null,
          assetType: p.assetType || 'Unclassified',
          sectorId: p.sectorId,
          liquidityOverride: 'auto', cgTokenId: null, chain: null, address: null, notes: '',
        }))
      : parsedPositions;

    if (!positions.length) { setError('No valid positions to save.'); return; }

    // ADD SNAPSHOT PATH — add a new snapshot to existing SOI
    if (updateBehavior === 'add_snapshot' && replaceTargetSoiId) {
      const newSnap = { id: uid(), asOfDate: asOfDate || today(), notes: '', positions };
      updateStore(s => ({
        ...s,
        soIs: s.soIs.map(x => x.id !== replaceTargetSoiId ? x : {
          ...x, snapshots: [...snapshotsOf(x), newSnap],
        }),
      }));
      onDone(); return;
    }

    // REPLACE LATEST PATH — overwrite most recent snapshot
    if (updateBehavior === 'replace_latest' && replaceTargetSoiId) {
      const targetSoi = store.soIs.find(s => s.id === replaceTargetSoiId);
      const latestSnapId = latestSnapshot(targetSoi)?.id;
      updateStore(s => ({
        ...s,
        soIs: s.soIs.map(x => x.id !== replaceTargetSoiId ? x : {
          ...x,
          snapshots: snapshotsOf(x).map(snap => snap.id !== latestSnapId ? snap : {
            ...snap, asOfDate: asOfDate || today(), positions,
          }),
        }),
        commitments: s.commitments.map(c => c.soiId !== replaceTargetSoiId ? c : ({
          ...c, called: _.sumBy(positions, 'soiMarketValue'),
        })),
      }));
      onDone(); return;
    }

    // NEW PATH — create a new SOI + commitment
    let nextStore = { ...store };

    let clientId = assignClientId;
    if (clientId === '__new__') {
      clientId = uid();
      nextStore = { ...nextStore, clients: [...nextStore.clients, { id: clientId, name: newClientName || 'New Client', notes: '' }] };
    }
    let managerId = assignManagerId;
    if (managerId === '__new__' || !managerId) {
      managerId = uid();
      nextStore = { ...nextStore, managers: [...nextStore.managers, { id: managerId, name: newManagerName || 'New Manager', firm: '', type: newManagerType || 'direct' }] };
    }

    const soiId = uid();
    const soi = {
      id: soiId, managerId, vintage: vintage || 'Main Fund',
      snapshots: [{ id: uid(), asOfDate: asOfDate || today(), notes: '', positions }],
    };
    const commitment = {
      id: uid(), clientId, managerId, soiId,
      committed: parseNum(committed) || _.sumBy(positions, 'soiMarketValue'),
      called: _.sumBy(positions, 'soiMarketValue'),
      distributions: 0,
    };

    nextStore = {
      ...nextStore,
      soIs: [...nextStore.soIs, soi],
      commitments: [...nextStore.commitments, commitment],
    };
    updateStore(nextStore);
    onDone();
  };

  return (
    <Modal onClose={onClose} title={mode==='choose' ? 'Add fund holdings' : mode==='manual' ? 'Manual entry' : `Import — ${fileName || 'holdings file'}`}>
      {mode === 'choose' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-5">
          <ChoiceCard icon={FileSpreadsheet} title="Upload holdings file" desc="Excel or CSV. We'll auto-detect columns."
            onClick={() => { setMode('upload'); setStep(1); }} />
          <ChoiceCard icon={Edit2} title="Enter manually" desc="Type positions by hand — useful for small books."
            onClick={() => { setMode('manual'); setStep(3); setManualPositions([{ positionName: '', ticker: '', quantity: '', soiMarketValue: '', sectorId: 'infrastructure', acquisitionDate: '', assetType: 'Liquid Token' }]); }} />
        </div>
      )}

      {mode === 'upload' && step === 1 && (
        <div className="p-5">
          <DropZone onFile={handleFile} loading={loading} />
          {error && <div className="mt-3 text-xs" style={{color:RED}}>{error}</div>}
        </div>
      )}

      {mode === 'upload' && step === 2 && (
        <div className="p-5 space-y-4">
          {Object.keys(sheets).length > 1 && (
            <div>
              <label className="text-xs uppercase tracking-wider" style={{color:TEXT_MUTE}}>Sheet</label>
              <select value={sheetName} onChange={e=>switchSheet(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded text-sm outline-none"
                style={{backgroundColor: PANEL_2, color: TEXT, border: `1px solid ${BORDER}`}}>
                {Object.keys(sheets).map(n => <option key={n} value={n}>{n} ({sheets[n].rows.length} rows)</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {Object.entries(FIELDS).map(([field, def]) => (
              <div key={field}>
                <label className="text-xs flex items-center gap-2" style={{color:TEXT_DIM}}>
                  {def.label}
                  {def.required && <span style={{color:RED}}>*</span>}
                  {autoScores[field] && <span className="text-[10px]" style={{color:ACCENT_2}}>auto</span>}
                </label>
                <select value={columnMap[field] || ''} onChange={e=>setColumnMap({...columnMap, [field]: e.target.value})}
                  className="w-full mt-1 px-2 py-1.5 rounded text-sm outline-none"
                  style={{backgroundColor: PANEL_2, color: TEXT, border: `1px solid ${BORDER}`}}>
                  <option value="">— none —</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div className="text-xs p-3 rounded" style={{backgroundColor: PANEL_2, color: TEXT_DIM, border: `1px solid ${BORDER}`}}>
            Detected <strong style={{color:TEXT}}>{parsedPositions.length}</strong> valid position{parsedPositions.length===1?'':'s'}.
            {!columnMap.positionName && <span style={{color:RED}}> Missing Position Name.</span>}
            {!columnMap.marketValue && !(columnMap.quantity && columnMap.price) && <span style={{color:RED}}> Need Market Value OR (Quantity + Price).</span>}
          </div>
          <div className="flex justify-between">
            <button onClick={()=>setStep(1)} className="text-xs px-3 py-1.5 rounded flex items-center gap-1"
              style={{color:TEXT_DIM, border: `1px solid ${BORDER}`}}><ArrowLeft size={12}/> Back</button>
            <button onClick={()=>setStep(3)} disabled={!parsedPositions.length}
              className="text-xs px-4 py-1.5 rounded font-medium"
              style={{backgroundColor: ACCENT, color: BG, opacity: parsedPositions.length?1:0.4}}>
              Continue →
            </button>
          </div>
        </div>
      )}

      {((mode === 'upload' && step === 3) || mode === 'manual') && (
        <div className="p-5 space-y-4">
          {/* Update-vs-new chooser — shown when user picks an existing manager with existing SOIs */}
          {(() => {
            if (isReplaceMode) return null; // coming from "Update holdings" already; no choice
            const existingSois = assignManagerId && assignManagerId !== '__new__'
              ? store.soIs.filter(s => s.managerId === assignManagerId)
              : [];
            if (!existingSois.length) return null;
            const mgr = store.managers.find(m => m.id === assignManagerId);
            return (
              <div className="p-3 rounded" style={{backgroundColor: ACCENT+'11', border: `1px solid ${ACCENT}44`}}>
                <div className="text-xs font-medium mb-2" style={{color: ACCENT_2}}>
                  {mgr?.name} already has {existingSois.length} vintage{existingSois.length===1?'':'s'} in the store.
                </div>
                <div className="space-y-1.5">
                  <label className="flex items-start gap-2 text-xs cursor-pointer">
                    <input type="radio" checked={updateBehavior==='new'} onChange={()=>setUpdateBehavior('new')} />
                    <span>
                      <strong style={{color:TEXT}}>Create new fund/vintage</strong>
                      <span className="ml-1" style={{color:TEXT_DIM}}>— different fund (e.g., Fund V).</span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 text-xs cursor-pointer">
                    <input type="radio" checked={updateBehavior==='add_snapshot'} onChange={()=>setUpdateBehavior('add_snapshot')} />
                    <span>
                      <strong style={{color:TEXT}}>Add as new snapshot</strong>
                      <span className="ml-1" style={{color:TEXT_DIM}}>— newer quarter for an existing fund. Keeps history.</span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 text-xs cursor-pointer">
                    <input type="radio" checked={updateBehavior==='replace_latest'} onChange={()=>setUpdateBehavior('replace_latest')} />
                    <span>
                      <strong style={{color:TEXT}}>Replace latest snapshot</strong>
                      <span className="ml-1" style={{color:TEXT_DIM}}>— overwrite the most recent holdings.</span>
                    </span>
                  </label>
                </div>
                {(updateBehavior === 'add_snapshot' || updateBehavior === 'replace_latest') && (
                  <div className="mt-3">
                    <label className="text-[10px] uppercase tracking-wider" style={{color:TEXT_MUTE}}>Which vintage to target?</label>
                    <select value={replaceTargetSoiId} onChange={e=>setReplaceTargetSoiId(e.target.value)}
                      className="w-full mt-1 px-3 py-2 rounded text-sm outline-none"
                      style={{backgroundColor: PANEL_2, color: TEXT, border: `1px solid ${BORDER}`}}>
                      <option value="">— select —</option>
                      {existingSois.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.vintage} — {snapshotsOf(s).length} snapshot(s), latest {latestSnapshot(s)?.asOfDate || 'no date'}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Replace-mode banner (coming from "Update holdings" on SOI detail) */}
          {isReplaceMode && prefilledSoi && (
            <div className="p-3 rounded" style={{backgroundColor: GOLD+'11', border: `1px solid ${GOLD}44`}}>
              <div className="flex items-center gap-2 text-xs font-medium" style={{color:GOLD}}>
                <RefreshCw size={12} /> Updating holdings
              </div>
              <div className="text-xs mt-1" style={{color:TEXT_DIM}}>
                Replacing <strong style={{color:TEXT}}>{prefilledManager?.name} {prefilledSoi.vintage}</strong>'s latest snapshot
                (as of {latestSnapshot(prefilledSoi)?.asOfDate || '—'}).
                Set the new as-of date below.
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Hide client/manager/vintage/commitment fields in replace mode — they're fixed */}
            {updateBehavior !== 'replace_latest' && updateBehavior !== 'add_snapshot' && (
              <>
            <div>
              <label className="text-xs uppercase tracking-wider" style={{color:TEXT_MUTE}}>Client</label>
              <select value={assignClientId} onChange={e=>setAssignClientId(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded text-sm outline-none"
                style={{backgroundColor: PANEL_2, color: TEXT, border: `1px solid ${BORDER}`}}>
                {store.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                <option value="__new__">+ New client…</option>
              </select>
              {assignClientId === '__new__' && (
                <input value={newClientName} onChange={e=>setNewClientName(e.target.value)} placeholder="Client name"
                  className="w-full mt-2 px-3 py-2 rounded text-sm outline-none"
                  style={{backgroundColor: PANEL_2, color: TEXT, border: `1px solid ${BORDER}`}} />
              )}
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider" style={{color:TEXT_MUTE}}>Manager</label>
              <select value={assignManagerId} onChange={e=>setAssignManagerId(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded text-sm outline-none"
                style={{backgroundColor: PANEL_2, color: TEXT, border: `1px solid ${BORDER}`}}>
                <option value="">— select —</option>
                {store.managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                <option value="__new__">+ New manager…</option>
              </select>
              {(assignManagerId === '__new__' || (!assignManagerId && store.managers.length === 0)) && (
                <>
                  <input value={newManagerName} onChange={e=>setNewManagerName(e.target.value)} placeholder="Manager name (e.g., Dragonfly)"
                    className="w-full mt-2 px-3 py-2 rounded text-sm outline-none"
                    style={{backgroundColor: PANEL_2, color: TEXT, border: `1px solid ${BORDER}`}} />
                  <select value={newManagerType} onChange={e=>setNewManagerType(e.target.value)}
                    className="w-full mt-2 px-3 py-2 rounded text-sm outline-none"
                    style={{backgroundColor: PANEL_2, color: TEXT, border: `1px solid ${BORDER}`}}>
                    <option value="direct">Direct fund manager</option>
                    <option value="fund_of_funds">Fund-of-Funds manager</option>
                  </select>
                </>
              )}
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider" style={{color:TEXT_MUTE}}>Vintage / Fund Name</label>
              <input value={vintage} onChange={e=>setVintage(e.target.value)} placeholder="e.g., Fund III, 2024 Vintage"
                className="w-full mt-1 px-3 py-2 rounded text-sm outline-none"
                style={{backgroundColor: PANEL_2, color: TEXT, border: `1px solid ${BORDER}`}} />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider" style={{color:TEXT_MUTE}}>Client Commitment (USD, optional)</label>
              <input value={committed} onChange={e=>setCommitted(e.target.value)} placeholder="e.g., 25000000"
                className="w-full mt-1 px-3 py-2 rounded text-sm outline-none"
                style={{backgroundColor: PANEL_2, color: TEXT, border: `1px solid ${BORDER}`}} />
              <div className="text-[10px] mt-1" style={{color:TEXT_MUTE}}>Defaults to the sum of position MVs if empty.</div>
            </div>
              </>
            )}
            {/* As-of Date is always shown (new + replace both need it) */}
            <div>
              <label className="text-xs uppercase tracking-wider" style={{color:TEXT_MUTE}}>As-of Date</label>
              <input type="date" value={asOfDate} onChange={e=>setAsOfDate(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded text-sm outline-none"
                style={{backgroundColor: PANEL_2, color: TEXT, border: `1px solid ${BORDER}`}} />
            </div>
          </div>

          {mode === 'manual' && (
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wider" style={{color:TEXT_MUTE}}>Positions</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{color:TEXT_MUTE}}>
                      <th className="text-left px-2 py-1">Name *</th>
                      <th className="text-left px-2 py-1">Ticker</th>
                      <th className="text-right px-2 py-1">Qty</th>
                      <th className="text-right px-2 py-1">Market Value *</th>
                      <th className="text-left px-2 py-1">Sector</th>
                      <th className="text-left px-2 py-1">Acq Date</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {manualPositions.map((p, i) => (
                      <tr key={i}>
                        <td className="px-1 py-1"><input value={p.positionName} onChange={e=>setManualPositions(manualPositions.map((x,j)=>j===i?{...x,positionName:e.target.value}:x))} className="w-full px-2 py-1 rounded text-xs outline-none" style={{backgroundColor: PANEL_2, color: TEXT, border: `1px solid ${BORDER}`}} /></td>
                        <td className="px-1 py-1"><input value={p.ticker} onChange={e=>setManualPositions(manualPositions.map((x,j)=>j===i?{...x,ticker:e.target.value}:x))} className="w-20 px-2 py-1 rounded text-xs outline-none" style={{backgroundColor: PANEL_2, color: TEXT, border: `1px solid ${BORDER}`}} /></td>
                        <td className="px-1 py-1"><input value={p.quantity} onChange={e=>setManualPositions(manualPositions.map((x,j)=>j===i?{...x,quantity:e.target.value}:x))} className="w-24 px-2 py-1 rounded text-xs text-right outline-none tabular-nums" style={{backgroundColor: PANEL_2, color: TEXT, border: `1px solid ${BORDER}`}} /></td>
                        <td className="px-1 py-1"><input value={p.soiMarketValue} onChange={e=>setManualPositions(manualPositions.map((x,j)=>j===i?{...x,soiMarketValue:e.target.value}:x))} className="w-28 px-2 py-1 rounded text-xs text-right outline-none tabular-nums" style={{backgroundColor: PANEL_2, color: TEXT, border: `1px solid ${BORDER}`}} /></td>
                        <td className="px-1 py-1">
                          <select value={p.sectorId} onChange={e=>setManualPositions(manualPositions.map((x,j)=>j===i?{...x,sectorId:e.target.value}:x))}
                            className="px-1 py-1 rounded text-xs outline-none" style={{backgroundColor: PANEL_2, color: TEXT, border: `1px solid ${BORDER}`}}>
                            {SECTORS.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
                            <option value="unclassified">Unclassified</option>
                          </select>
                        </td>
                        <td className="px-1 py-1"><input type="date" value={p.acquisitionDate || ''} onChange={e=>setManualPositions(manualPositions.map((x,j)=>j===i?{...x,acquisitionDate:e.target.value}:x))} className="w-36 px-2 py-1 rounded text-xs outline-none" style={{backgroundColor: PANEL_2, color: TEXT, border: `1px solid ${BORDER}`}} /></td>
                        <td><button onClick={()=>setManualPositions(manualPositions.filter((_,j)=>j!==i))} className="px-1.5 py-1 rounded" style={{color:TEXT_DIM}}><X size={12}/></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button onClick={()=>setManualPositions([...manualPositions, { positionName: '', ticker: '', quantity: '', soiMarketValue: '', sectorId: 'infrastructure', acquisitionDate: '', assetType: 'Liquid Token' }])}
                className="text-xs px-3 py-1.5 rounded flex items-center gap-1"
                style={{color: TEXT_DIM, border: `1px dashed ${BORDER}`}}><Plus size={12}/> Add row</button>
            </div>
          )}

          {mode === 'upload' && parsedPositions.length > 0 && (
            <div className="text-xs p-3 rounded" style={{backgroundColor: PANEL_2, color: TEXT_DIM, border: `1px solid ${BORDER}`}}>
              Ready to save <strong style={{color:TEXT}}>{parsedPositions.length}</strong> positions, total MV <strong style={{color:TEXT}}>{fmtCurrency(_.sumBy(parsedPositions, 'soiMarketValue'))}</strong>.
            </div>
          )}

          {error && <div className="text-xs" style={{color:RED}}>{error}</div>}

          <div className="flex justify-between">
            <button onClick={() => isReplaceMode ? onClose() : (mode === 'upload' ? setStep(2) : setMode('choose'))}
              className="text-xs px-3 py-1.5 rounded flex items-center gap-1"
              style={{color:TEXT_DIM, border: `1px solid ${BORDER}`}}><ArrowLeft size={12}/> {isReplaceMode ? 'Cancel' : 'Back'}</button>
            <button onClick={finalize}
              disabled={
                (mode==='upload' && !parsedPositions.length) ||
                (mode==='manual' && !manualPositions.some(p=>p.positionName && p.soiMarketValue)) ||
                ((updateBehavior === 'replace_latest' || updateBehavior === 'add_snapshot') && !replaceTargetSoiId)
              }
              className="text-xs px-4 py-1.5 rounded font-medium flex items-center gap-1"
              style={{backgroundColor: updateBehavior === 'replace_latest' ? GOLD : ACCENT, color: BG}}>
              <Check size={12} /> {updateBehavior === 'replace_latest' ? 'Replace holdings' : updateBehavior === 'add_snapshot' ? 'Add snapshot' : 'Save to store'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{backgroundColor: 'rgba(0,0,0,0.7)'}}>
      <div className="rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        style={{backgroundColor: PANEL, border: `1px solid ${BORDER}`}}>
        <div className="flex items-center justify-between px-5 py-3 sticky top-0" style={{borderBottom: `1px solid ${BORDER}`, backgroundColor: PANEL}}>
          <div className="text-sm font-semibold">{title}</div>
          <button onClick={onClose} className="p-1 rounded" style={{color: TEXT_DIM}}><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
function ChoiceCard({ icon: Icon, title, desc, onClick }) {
  return (
    <button onClick={onClick}
      className="p-5 rounded-lg text-left transition-colors hover:border-opacity-80"
      style={{backgroundColor: PANEL_2, border: `1px solid ${BORDER}`}}>
      <Icon size={20} style={{color: ACCENT}} />
      <div className="text-sm font-semibold mt-2">{title}</div>
      <div className="text-xs mt-1" style={{color: TEXT_DIM}}>{desc}</div>
    </button>
  );
}
function DropZone({ onFile, loading }) {
  const ref = useRef(null);
  return (
    <div onDragOver={e=>{e.preventDefault();}} onDrop={e=>{e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFile(f);}}
      onClick={()=>ref.current?.click()}
      className="p-10 rounded-lg text-center cursor-pointer transition-colors"
      style={{border: `2px dashed ${BORDER}`, backgroundColor: PANEL_2}}>
      <Upload size={28} style={{color:ACCENT}} className="mx-auto" />
      <div className="mt-3 text-sm font-medium">{loading ? 'Parsing…' : 'Drop a holdings file here or click to browse'}</div>
      <div className="text-xs mt-1" style={{color:TEXT_DIM}}>.xlsx, .xls, or .csv — processed entirely in your browser</div>
      <input ref={ref} type="file" accept=".xlsx,.xls,.csv" className="hidden"
        onChange={e=>{const f = e.target.files?.[0]; if (f) onFile(f);}} />
    </div>
  );
}

/* =============================================================================
   SETTINGS DRAWER
   ============================================================================= */
function SettingsDrawer({ store, updateStore, selection, setSelection, onClose, onResetSeed }) {
  const managerById = useMemo(() => Object.fromEntries(store.managers.map(m => [m.id, m])), [store.managers]);

  const renameClient = (id, name) => updateStore(s => ({
    ...s, clients: s.clients.map(c => c.id === id ? { ...c, name } : c),
  }));
  const deleteClient = (id) => {
    updateStore(s => ({
      ...s,
      clients: s.clients.filter(c => c.id !== id),
      commitments: s.commitments.filter(c => c.clientId !== id),
    }));
    if (selection?.kind === 'client' && selection.id === id) setSelection({ kind: 'firm' });
  };

  const renameManager = (id, name) => updateStore(s => ({
    ...s, managers: s.managers.map(m => m.id === id ? { ...m, name } : m),
  }));
  const deleteManager = (id) => {
    const killedSoiIds = new Set(store.soIs.filter(x => x.managerId === id).map(x => x.id));
    updateStore(s => ({
      ...s,
      managers: s.managers.filter(m => m.id !== id),
      soIs: s.soIs.filter(x => x.managerId !== id),
      commitments: s.commitments.filter(c => c.managerId !== id && !killedSoiIds.has(c.soiId)),
    }));
    if (selection?.kind === 'manager' && selection.id === id) setSelection({ kind: 'firm' });
    if (selection?.kind === 'vintage' && killedSoiIds.has(selection.id)) setSelection({ kind: 'firm' });
  };

  const renameSOI = (id, vintage) => updateStore(s => ({
    ...s, soIs: s.soIs.map(x => x.id === id ? { ...x, vintage } : x),
  }));
  const deleteSOI = (id) => {
    updateStore(s => ({
      ...s,
      soIs: s.soIs.filter(x => x.id !== id),
      commitments: s.commitments.filter(c => c.soiId !== id),
    }));
    if (selection?.kind === 'vintage' && selection.id === id) setSelection({ kind: 'firm' });
  };

  const [apiKey, setApiKey] = useState(store.settings.cgApiKey || '');
  const [showKey, setShowKey] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [confirmingWipe, setConfirmingWipe] = useState(false);

  const saveKey = () => {
    updateStore(s => ({ ...s, settings: { ...s.settings, cgApiKey: apiKey.trim() } }));
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(store, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `catena-export-${today()}.json`;
    a.click(); URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const feRows = store.commitments.map(c => {
      const client = store.clients.find(x => x.id === c.clientId);
      const mgr = store.managers.find(x => x.id === c.managerId);
      const soi = store.soIs.find(x => x.id === c.soiId);
      // TODO: live-price-aware NAV; for now use SOI marked values (consistent with persisted store)
      const nav = _.sumBy(latestSnapshot(soi)?.positions || [], p => p.soiMarketValue || 0);
      const committed = c.committed || 0;
      const called = c.called || 0;
      const distributions = c.distributions || 0;
      return {
        'Client': client?.name || '',
        'Manager': mgr?.name || '',
        'Vintage': soi?.vintage || '',
        'Committed': committed,
        'Called': called,
        'Uncalled': committed - called,
        'Distributions': distributions,
        '% Invested': committed > 0 ? called / committed : 0,
        'Current NAV': nav,
        'Fund NAV (unscaled)': nav,
        'Client NAV (scaled)': nav > 0 ? (called / nav) * nav : nav,
        'Client Share %': nav > 0 ? (called / nav) * 100 : 0,
        'Unrealized MOIC': called > 0 ? nav / called : 0,
        'Realized MOIC': called > 0 ? distributions / called : 0,
        'TVPI': called > 0 ? (nav + distributions) / called : 0,
      };
    });
    const ws = XLSX.utils.json_to_sheet(feRows);
    XLSX.utils.book_append_sheet(wb, ws, 'Fund Economics');

    // FoF Commitments sheet — sub-commitments from all fund-of-funds managers
    const fofManagers = store.managers.filter(m => m.type === 'fund_of_funds');
    if (fofManagers.length > 0) {
      const fofRows = [];
      for (const fofMgr of fofManagers) {
        const fofSois = store.soIs.filter(s => s.managerId === fofMgr.id);
        for (const fofSoi of fofSois) {
          const snap = latestSnapshot(fofSoi);
          for (const sub of (snap?.subCommitments || [])) {
            const targetSoi = store.soIs.find(s => s.id === sub.toSoiId);
            const targetMgr = targetSoi ? store.managers.find(m => m.id === targetSoi.managerId) : null;
            const underlyingMV = _.sumBy(latestSnapshot(targetSoi)?.positions || [], p => p.soiMarketValue || 0);
            fofRows.push({
              'FoF Manager': fofMgr.name,
              'FoF Fund': fofSoi.vintage,
              'As-of Date': snap?.asOfDate || '',
              'Underlying Manager': targetMgr?.name || '?',
              'Underlying Fund': targetSoi?.vintage || '?',
              'Committed': sub.committed || 0,
              'Called': sub.called || 0,
              'Distributions': sub.distributions || 0,
              'Underlying NAV': underlyingMV,
              'FoF Share %': underlyingMV > 0 ? (sub.called || 0) / underlyingMV : 0,
            });
          }
        }
      }
      if (fofRows.length > 0) {
        const wsFof = XLSX.utils.json_to_sheet(fofRows);
        XLSX.utils.book_append_sheet(wb, wsFof, 'FoF Commitments');
      }
    }

    XLSX.writeFile(wb, `catena-export-${today()}.xlsx`);
  };

  const importJSON = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed.clients || !parsed.managers || !parsed.soIs) throw new Error('Invalid file');
        updateStore(parsed);
        onClose();
      } catch (e) { alert('Invalid Catena export file.'); }
    };
    reader.readAsText(file);
  };

  const wipe = () => {
    updateStore(emptyStore());
    onClose();
  };

  return (
    <Modal title="Settings" onClose={onClose}>
      <div className="p-5 space-y-6">
        {/* API Key — now usually unused because the app ships with an embedded key.
            Left in as an optional override for debugging / a different key without a rebuild. */}
        <div>
          <div className="text-xs uppercase tracking-wider mb-2" style={{color:TEXT_MUTE}}>
            CoinGecko Demo API Key
            {EMBEDDED_CG_API_KEY && (
              <span className="ml-2 normal-case tracking-normal" style={{color: ACCENT_2}}>
                (embedded key active)
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 rounded px-3 py-2" style={{backgroundColor: PANEL_2, border: `1px solid ${BORDER}`}}>
              <Lock size={12} style={{color:TEXT_DIM}} />
              <input type={showKey ? 'text' : 'password'} value={apiKey} onChange={e=>setApiKey(e.target.value)}
                placeholder={EMBEDDED_CG_API_KEY ? 'Optional override — leave blank to use embedded key' : 'CG-xxxxxxxxxxxxxxxxxxxxxxxx'}
                className="flex-1 bg-transparent text-sm outline-none" style={{color:TEXT}} />
              <button onClick={()=>setShowKey(!showKey)} style={{color:TEXT_DIM}}>
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <button onClick={saveKey} className="px-3 py-2 rounded text-xs font-medium"
              style={{backgroundColor: ACCENT, color: BG}}>Save</button>
          </div>
          <div className="text-xs mt-2" style={{color:TEXT_DIM}}>
            {EMBEDDED_CG_API_KEY
              ? 'This site ships with an embedded CoinGecko key, so no input is required. Paste a key above only if you want to override it for this browser.'
              : 'Get a free Demo key at '}
            {!EMBEDDED_CG_API_KEY && <span style={{color:ACCENT_2}}>coingecko.com/en/developers/dashboard</span>}
            {!EMBEDDED_CG_API_KEY && '.'}
            <br />
            Any override you save is stored in localStorage only — never transmitted to any server except CoinGecko.
          </div>
        </div>

        {/* Data */}
        <div>
          <div className="text-xs uppercase tracking-wider mb-2" style={{color:TEXT_MUTE}}>Data</div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={exportJSON}
              className="px-3 py-2 rounded text-xs flex items-center gap-1.5"
              style={{backgroundColor: PANEL_2, color: TEXT, border: `1px solid ${BORDER}`}}>
              <Download size={12} /> Export all data (JSON)
            </button>
            <label className="px-3 py-2 rounded text-xs flex items-center gap-1.5 cursor-pointer"
              style={{backgroundColor: PANEL_2, color: TEXT, border: `1px solid ${BORDER}`}}>
              <Upload size={12} /> Import data (JSON)
              <input type="file" accept=".json" className="hidden" onChange={e=>{const f = e.target.files?.[0]; if (f) importJSON(f);}} />
            </label>
            <button onClick={exportExcel}
              className="px-3 py-2 rounded text-xs flex items-center gap-1.5 col-span-2"
              style={{backgroundColor: PANEL_2, color: TEXT, border: `1px solid ${BORDER}`}}>
              <FileSpreadsheet size={12} /> Export Fund Economics (Excel)
            </button>
          </div>
          <div className="text-[11px] mt-2" style={{color:TEXT_MUTE}}>
            All your clients, managers, SOIs, and preferences in one file. Take it offline, share it with a colleague, back it up.
          </div>
        </div>

        {/* Danger zone */}
        <div>
          <div className="text-xs uppercase tracking-wider mb-2" style={{color:RED}}>Danger zone</div>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 rounded" style={{backgroundColor: PANEL_2, border: `1px solid ${BORDER}`}}>
              <div>
                <div className="text-sm">Reset to seed data</div>
                <div className="text-xs" style={{color:TEXT_DIM}}>Replace everything with the demo 4-vintage portfolio.</div>
              </div>
              {confirmingReset ? (
                <div className="flex gap-1">
                  <button onClick={onResetSeed} className="px-2 py-1 rounded text-xs font-medium" style={{backgroundColor: RED, color: TEXT}}>Confirm</button>
                  <button onClick={()=>setConfirmingReset(false)} className="px-2 py-1 rounded text-xs" style={{color: TEXT_DIM, border: `1px solid ${BORDER}`}}>Cancel</button>
                </div>
              ) : (
                <button onClick={()=>setConfirmingReset(true)} className="px-3 py-1.5 rounded text-xs"
                  style={{color: TEXT_DIM, border: `1px solid ${BORDER}`}}>Reset</button>
              )}
            </div>
            <div className="flex items-center justify-between p-3 rounded" style={{backgroundColor: PANEL_2, border: `1px solid ${BORDER}`}}>
              <div>
                <div className="text-sm">Wipe all data</div>
                <div className="text-xs" style={{color:TEXT_DIM}}>Remove all clients, managers, and SOIs. Cannot be undone.</div>
              </div>
              {confirmingWipe ? (
                <div className="flex gap-1">
                  <button onClick={wipe} className="px-2 py-1 rounded text-xs font-medium" style={{backgroundColor: RED, color: TEXT}}>Wipe</button>
                  <button onClick={()=>setConfirmingWipe(false)} className="px-2 py-1 rounded text-xs" style={{color: TEXT_DIM, border: `1px solid ${BORDER}`}}>Cancel</button>
                </div>
              ) : (
                <button onClick={()=>setConfirmingWipe(true)} className="px-3 py-1.5 rounded text-xs flex items-center gap-1"
                  style={{color: RED, border: `1px solid ${RED}44`}}>
                  <Trash2 size={12} /> Wipe
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Manage */}
        <div>
          <div className="text-xs uppercase tracking-wider mb-2" style={{color:TEXT_MUTE}}>Manage</div>

          {/* Clients */}
          <div className="mb-4">
            <div className="text-[11px] mb-1.5 flex items-center gap-1.5" style={{color: TEXT_DIM}}>
              <Users size={11} /> Clients ({store.clients.length})
            </div>
            <div className="space-y-1">
              {store.clients.length === 0 && (
                <div className="text-xs italic px-2 py-1" style={{color: TEXT_MUTE}}>No clients yet. Import an SOI to create one.</div>
              )}
              {store.clients.map(c => {
                const count = store.commitments.filter(x => x.clientId === c.id).length;
                return (
                  <ManageRow
                    key={c.id}
                    title={c.name}
                    subtitle={`${count} commitment${count===1?'':'s'}`}
                    editFields={[{ label: 'Name', value: c.name, placeholder: 'Client name' }]}
                    onSave={([name]) => { if (name) renameClient(c.id, name); }}
                    onDelete={() => deleteClient(c.id)}
                    deleteWarning={count > 0 ? `Also removes ${count} commitment${count===1?'':'s'}` : ''}
                  />
                );
              })}
            </div>
          </div>

          {/* Managers */}
          <div className="mb-4">
            <div className="text-[11px] mb-1.5 flex items-center gap-1.5" style={{color: TEXT_DIM}}>
              <Briefcase size={11} /> Managers ({store.managers.length})
            </div>
            <div className="space-y-1">
              {store.managers.length === 0 && (
                <div className="text-xs italic px-2 py-1" style={{color: TEXT_MUTE}}>No managers yet.</div>
              )}
              {store.managers.map(m => {
                const soiCount = store.soIs.filter(x => x.managerId === m.id).length;
                const commitCount = store.commitments.filter(x => x.managerId === m.id).length;
                const isFoF = m.type === 'fund_of_funds';
                const subtitle = [m.firm, `${soiCount} SOI${soiCount===1?'':'s'}`, `${commitCount} commitment${commitCount===1?'':'s'}`, isFoF ? 'Fund-of-Funds' : 'Direct'].filter(Boolean).join(' · ');
                return (
                  <div key={m.id} className="space-y-0.5">
                    <ManageRow
                      title={m.name}
                      subtitle={subtitle}
                      editFields={[
                        { label: 'Name', value: m.name, placeholder: 'Manager name' },
                        { label: 'Firm',  value: m.firm || '', placeholder: 'Firm (optional)' },
                      ]}
                      onSave={([name, firm]) => { if (name) updateStore(s => ({ ...s, managers: s.managers.map(x => x.id === m.id ? { ...x, name, firm } : x) })); }}
                      onDelete={() => deleteManager(m.id)}
                      deleteWarning={`Also removes ${soiCount} SOI${soiCount===1?'':'s'} and ${commitCount} commitment${commitCount===1?'':'s'}`}
                    />
                    <div className="flex items-center justify-end gap-1 px-1">
                      <span className="text-[10px]" style={{color:TEXT_MUTE}}>Type:</span>
                      <button
                        onClick={() => updateStore(s => ({ ...s, managers: s.managers.map(x => x.id === m.id ? { ...x, type: isFoF ? 'direct' : 'fund_of_funds' } : x) }))}
                        className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                        style={{
                          backgroundColor: isFoF ? VIOLET+'22' : PANEL_2,
                          color: isFoF ? VIOLET : TEXT_DIM,
                          border: `1px solid ${isFoF ? VIOLET+'44' : BORDER}`,
                        }}
                        title="Click to toggle between Direct and Fund-of-Funds">
                        {isFoF ? 'Fund-of-Funds ✓' : 'Direct — click to set as FoF'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SOIs */}
          <div className="mb-4">
            <div className="text-[11px] mb-1.5 flex items-center gap-1.5" style={{color: TEXT_DIM}}>
              <Building2 size={11} /> SOIs ({store.soIs.length})
            </div>
            <div className="space-y-1">
              {store.soIs.length === 0 && (
                <div className="text-xs italic px-2 py-1" style={{color: TEXT_MUTE}}>No SOIs yet.</div>
              )}
              {store.soIs.map(x => {
                const mgr = managerById[x.managerId];
                const commitCount = store.commitments.filter(c => c.soiId === x.id).length;
                const posCount = latestSnapshot(x)?.positions?.length || 0;
                const snapCount = snapshotsOf(x).length;
                return (
                  <ManageRow
                    key={x.id}
                    title={`${mgr?.name || 'Unknown manager'} — ${x.vintage || '(no vintage)'}`}
                    subtitle={`${snapCount} snapshot${snapCount===1?'':'s'} · ${posCount} positions (latest) · as of ${latestSnapshot(x)?.asOfDate || '—'} · ${commitCount} commitment${commitCount===1?'':'s'}`}
                    editFields={[{ label: 'Vintage label', value: x.vintage || '', placeholder: 'e.g. Fund III' }]}
                    onSave={([vintage]) => renameSOI(x.id, vintage)}
                    onDelete={() => deleteSOI(x.id)}
                    deleteWarning={commitCount > 0 ? `Also removes ${commitCount} commitment${commitCount===1?'':'s'}` : ''}
                  />
                );
              })}
            </div>
          </div>

          {/* Sectors */}
          <div>
            <div className="text-[11px] mb-1.5 flex items-center gap-1.5" style={{color: TEXT_DIM}}>
              <Layers size={11} /> Sectors ({(store.sectors || []).length})
            </div>
            <div className="space-y-1 mb-2">
              {(store.sectors || []).map(sec => (
                <SectorRow key={sec.id} sector={sec} store={store} updateStore={updateStore} />
              ))}
            </div>
            <SectorAddForm updateStore={updateStore} />
          </div>
        </div>
      </div>
    </Modal>
  );
}

function ManageRow({ title, subtitle, editFields, onSave, onDelete, deleteWarning }) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState(() => editFields.map(f => f.value ?? ''));
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const startEdit = () => { setValues(editFields.map(f => f.value ?? '')); setEditing(true); };
  const save = () => { onSave(values.map(v => String(v).trim())); setEditing(false); };
  const cancel = () => setEditing(false);

  if (editing) {
    return (
      <div className="p-2 rounded space-y-2" style={{backgroundColor: PANEL_2, border: `1px solid ${BORDER}`}}>
        {editFields.map((f, i) => (
          <div key={i}>
            <div className="text-[10px] uppercase tracking-wider mb-1" style={{color: TEXT_MUTE}}>{f.label}</div>
            <input
              autoFocus={i===0}
              value={values[i]}
              onChange={e => setValues(v => v.map((x, j) => j===i ? e.target.value : x))}
              onKeyDown={e => { if (e.key==='Enter') save(); if (e.key==='Escape') cancel(); }}
              placeholder={f.placeholder || ''}
              className="w-full px-2 py-1.5 rounded text-sm outline-none"
              style={{backgroundColor: PANEL, color: TEXT, border: `1px solid ${BORDER}`}}
            />
          </div>
        ))}
        <div className="flex justify-end gap-1">
          <button onClick={save} className="px-2.5 py-1 rounded text-xs font-medium" style={{backgroundColor: ACCENT, color: BG}}>Save</button>
          <button onClick={cancel} className="px-2.5 py-1 rounded text-xs" style={{color: TEXT_DIM, border: `1px solid ${BORDER}`}}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-2 rounded text-sm gap-2"
      style={{backgroundColor: PANEL_2, border: `1px solid ${BORDER}`}}>
      <div className="flex-1 min-w-0">
        <div className="truncate">{title}</div>
        {subtitle && <div className="text-[11px] truncate" style={{color: TEXT_DIM}}>{subtitle}</div>}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {confirmingDelete ? (
          <>
            {deleteWarning && <div className="text-[11px] mr-1" style={{color: TEXT_DIM}}>{deleteWarning}</div>}
            <button onClick={() => { onDelete(); setConfirmingDelete(false); }}
              className="px-2 py-1 rounded text-xs font-medium" style={{backgroundColor: RED, color: TEXT}}>Delete</button>
            <button onClick={() => setConfirmingDelete(false)} className="px-2 py-1 rounded text-xs"
              style={{color: TEXT_DIM, border: `1px solid ${BORDER}`}}>Cancel</button>
          </>
        ) : (
          <>
            <button onClick={startEdit} className="p-1 rounded" style={{color: TEXT_DIM}} title="Edit"><Edit2 size={14} /></button>
            <button onClick={() => setConfirmingDelete(true)} className="p-1 rounded" style={{color: RED}} title="Delete"><Trash2 size={14} /></button>
          </>
        )}
      </div>
    </div>
  );
}

function SectorRow({ sector, store, updateStore }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(sector.label);
  const [color, setColor] = useState(sector.color);
  const [desc, setDesc] = useState(sector.desc || '');
  const [deleting, setDeleting] = useState(false);
  const [replacementId, setReplacementId] = useState('');

  const useCount = useMemo(() => {
    let n = 0;
    for (const soi of store.soIs) {
      for (const snap of snapshotsOf(soi)) {
        for (const p of (snap.positions || [])) if (p.sectorId === sector.id) n++;
      }
    }
    for (const id of Object.values(store.sectorOverrides || {})) if (id === sector.id) n++;
    return n;
  }, [store, sector.id]);

  const otherSectors = (store.sectors || []).filter(s => s.id !== sector.id);

  const save = () => {
    const label = name.trim() || sector.label;
    updateStore(s => ({ ...s, sectors: (s.sectors || []).map(x => x.id === sector.id ? { ...x, label, color, desc } : x) }));
    setEditing(false);
  };

  const doDelete = () => {
    updateStore(s => {
      const repl = replacementId || null;
      const nextSoIs = s.soIs.map(soi => ({
        ...soi,
        snapshots: snapshotsOf(soi).map(snap => ({
          ...snap,
          positions: (snap.positions || []).map(p => p.sectorId === sector.id ? { ...p, sectorId: repl } : p),
        })),
      }));
      const nextOverrides = { ...(s.sectorOverrides || {}) };
      for (const [k, id] of Object.entries(nextOverrides)) {
        if (id === sector.id) { if (repl) nextOverrides[k] = repl; else delete nextOverrides[k]; }
      }
      return { ...s, sectors: (s.sectors || []).filter(x => x.id !== sector.id), soIs: nextSoIs, sectorOverrides: nextOverrides };
    });
    setDeleting(false);
  };

  if (editing) {
    return (
      <div className="p-2 rounded space-y-2" style={{backgroundColor: PANEL_2, border: `1px solid ${BORDER}`}}>
        <div className="flex items-center gap-2">
          <input type="color" value={color} onChange={e=>setColor(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer flex-shrink-0" style={{backgroundColor: PANEL_2, border: `1px solid ${BORDER}`}} />
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Name"
            className="flex-1 px-2 py-1.5 rounded text-sm outline-none"
            style={{backgroundColor: PANEL, color: TEXT, border: `1px solid ${BORDER}`}} />
        </div>
        <input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Description"
          className="w-full px-2 py-1.5 rounded text-sm outline-none"
          style={{backgroundColor: PANEL, color: TEXT, border: `1px solid ${BORDER}`}} />
        <div className="flex justify-end gap-1">
          <button onClick={save} className="px-2.5 py-1 rounded text-xs font-medium" style={{backgroundColor: ACCENT, color: BG}}>Save</button>
          <button onClick={()=>setEditing(false)} className="px-2.5 py-1 rounded text-xs" style={{color: TEXT_DIM, border: `1px solid ${BORDER}`}}>Cancel</button>
        </div>
      </div>
    );
  }

  if (deleting) {
    return (
      <div className="p-2 rounded space-y-2" style={{backgroundColor: PANEL_2, border: `1px solid ${RED}66`}}>
        <div className="text-sm">Delete <span style={{color: sector.color}}>{sector.label}</span>?</div>
        {useCount > 0 ? (
          <>
            <div className="text-xs" style={{color: TEXT_DIM}}>
              {useCount} position reference{useCount===1?'':'s'} will be reassigned.
            </div>
            <select value={replacementId} onChange={e=>setReplacementId(e.target.value)}
              className="w-full px-2 py-1.5 rounded text-sm outline-none"
              style={{backgroundColor: PANEL, color: TEXT, border: `1px solid ${BORDER}`}}>
              <option value="">Unclassified</option>
              {otherSectors.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </>
        ) : (
          <div className="text-xs" style={{color: TEXT_DIM}}>No positions use this sector.</div>
        )}
        <div className="flex justify-end gap-1">
          <button onClick={doDelete} className="px-2.5 py-1 rounded text-xs font-medium" style={{backgroundColor: RED, color: TEXT}}>Delete</button>
          <button onClick={()=>setDeleting(false)} className="px-2.5 py-1 rounded text-xs" style={{color: TEXT_DIM, border: `1px solid ${BORDER}`}}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-2 rounded text-sm gap-2"
      style={{backgroundColor: PANEL_2, border: `1px solid ${BORDER}`}}>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{backgroundColor: sector.color}} />
        <div className="min-w-0 flex-1">
          <div className="truncate">{sector.label}</div>
          {sector.desc && <div className="text-[11px] truncate" style={{color: TEXT_DIM}}>{sector.desc}</div>}
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <div className="text-[10px] mr-1" style={{color: TEXT_MUTE}}>{useCount} use{useCount===1?'':'s'}</div>
        <button onClick={()=>setEditing(true)} className="p-1 rounded" style={{color: TEXT_DIM}} title="Edit"><Edit2 size={14} /></button>
        <button onClick={()=>setDeleting(true)} className="p-1 rounded" style={{color: RED}} title="Delete"><Trash2 size={14} /></button>
      </div>
    </div>
  );
}

function SectorAddForm({ updateStore }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#4A9EFF');
  const [desc, setDesc] = useState('');
  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'sector';
    const id = `${slug}-${uid().slice(0, 4)}`;
    updateStore(s => ({ ...s, sectors: [...(s.sectors || []), { id, label: trimmed, color, desc }] }));
    setName(''); setDesc('');
  };
  return (
    <div className="p-2 rounded space-y-2" style={{backgroundColor: PANEL_2, border: `1px dashed ${BORDER}`}}>
      <div className="text-[11px]" style={{color: TEXT_DIM}}>Add a sector</div>
      <div className="flex items-center gap-2">
        <input type="color" value={color} onChange={e=>setColor(e.target.value)}
          className="w-8 h-8 rounded cursor-pointer flex-shrink-0" style={{backgroundColor: PANEL_2, border: `1px solid ${BORDER}`}} />
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Name"
          className="flex-1 px-2 py-1.5 rounded text-sm outline-none"
          style={{backgroundColor: PANEL, color: TEXT, border: `1px solid ${BORDER}`}} />
      </div>
      <input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Description (optional)"
        className="w-full px-2 py-1.5 rounded text-sm outline-none"
        style={{backgroundColor: PANEL, color: TEXT, border: `1px solid ${BORDER}`}} />
      <div className="flex justify-end">
        <button onClick={submit} disabled={!name.trim()}
          className="px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1"
          style={{backgroundColor: ACCENT, color: BG, opacity: name.trim() ? 1 : 0.5}}>
          <Plus size={12} /> Add sector
        </button>
      </div>
    </div>
  );
}
