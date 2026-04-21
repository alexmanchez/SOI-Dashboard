import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import _ from 'lodash';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, AreaChart, ReferenceLine } from 'recharts';
import { Upload, Shield, RefreshCw, AlertCircle, TrendingUp, TrendingDown, DollarSign, Layers, Search, Lock, CheckCircle2, ArrowLeft, FileSpreadsheet, Link2, Activity, Clock, Zap, Copy } from 'lucide-react';

const CA_BLUE = '#1A3B5C';
const CA_SKY = '#EFF6FC';
const CA_ACCENT = '#2E6CA6';
const CA_GOLD = '#B8893A';
const CA_GREEN = '#3E7A5C';
const CA_RED = '#A63E3E';
const CA_SLATE = '#4A5968';

const CHART_PALETTE = [CA_BLUE, CA_ACCENT, CA_GOLD, CA_GREEN, CA_SLATE, '#6B9BD1', '#C4A366', '#5E8B73', '#7A8A99', '#8FB3DB', '#3D5A7A', '#9A7438'];

const FIELDS = {
  positionName: { label: 'Position Name', required: true, synonyms: ['position name', 'position', 'name', 'asset', 'asset name', 'security', 'security name', 'holding', 'holdings', 'investment', 'investment name', 'company', 'company name', 'issuer', 'description', 'token name', 'instrument', 'portfolio company'] },
  ticker: { label: 'Ticker / Symbol', required: false, synonyms: ['ticker', 'symbol', 'ticker/symbol', 'token', 'token symbol', 'cusip'] },
  assetType: { label: 'Asset Type', required: false, synonyms: ['asset type', 'type', 'instrument type', 'security type', 'instrument', 'asset class', 'investment type', 'holding type'] },
  sector: { label: 'Sector / Category', required: false, synonyms: ['sector', 'category', 'sector/category', 'industry', 'vertical', 'theme', 'classification', 'gics sector', 'sub-sector', 'sub sector', 'strategy'] },
  quantity: { label: 'Quantity', required: false, synonyms: ['quantity', 'qty', 'shares', 'units', 'tokens', 'coins', 'position size', 'number of shares', '# shares', 'par', 'par value', 'principal', 'notional'] },
  price: { label: 'Price (at SOI)', required: false, synonyms: ['price', 'unit price', 'price per share', 'mark', 'mark price', 'last price', 'nav per unit', 'price per unit', 'current price'] },
  costBasis: { label: 'Cost Basis', required: false, synonyms: ['cost basis', 'cost', 'book value', 'invested capital', 'basis', 'acquisition cost', 'total cost', 'original cost', 'cost ($)', 'investment cost'] },
  marketValue: { label: 'Market Value (at SOI)', required: true, synonyms: ['market value', 'mv', 'fair value', 'fv', 'value', 'nav contribution', 'current value', 'mkt value', 'market val', 'fmv', 'ending value', 'ending mv', 'ending market value', 'value ($)', 'gross market value', 'gross exposure', 'net asset value', 'nav', 'position value'] },
  unrealizedPL: { label: 'Unrealized P&L (at SOI)', required: false, synonyms: ['unrealized gain/loss', 'unrealized p&l', 'unrealized pnl', 'unrealized gain (loss)', 'ugl', 'gain/loss', 'p&l', 'pnl', 'unrealized', 'unrealized profit', 'unrealized gain', 'u/g/l', 'gain loss'] },
  pctNav: { label: '% of NAV', required: false, synonyms: ['% of nav', 'pct of nav', '% nav', 'percent of nav', 'weight', '% of portfolio', 'portfolio %', 'allocation', 'pct', '% weight', '% of total', 'portfolio weight', '% of aum', '% of fund'] },
  acquisitionDate: { label: 'Acquisition Date', required: false, synonyms: ['acquisition date', 'date', 'purchase date', 'entry date', 'invested date', 'buy date', 'date acquired', 'initial investment date', 'trade date'] },
  liquidity: { label: 'Liquidity', required: false, synonyms: ['liquidity', 'liquidity tier', 'lockup', 'vesting', 'liquid/locked', 'liquid', 'liquidity profile', 'lock-up'] },
};

const REQUIRED_FOR_DASHBOARD = ['positionName', 'marketValue'];
const SUBTOTAL_PATTERNS = /^(total|subtotal|sub-total|grand total|sum|net total|fund total|portfolio total|aggregate)/i;

const CHAINS = [
  { id: 'ethereum', label: 'Ethereum', gt: 'eth' },
  { id: 'solana', label: 'Solana', gt: 'solana' },
  { id: 'base', label: 'Base', gt: 'base' },
  { id: 'arbitrum', label: 'Arbitrum', gt: 'arbitrum' },
  { id: 'optimism', label: 'Optimism', gt: 'optimism' },
  { id: 'polygon', label: 'Polygon', gt: 'polygon_pos' },
  { id: 'bsc', label: 'BNB Chain', gt: 'bsc' },
  { id: 'avalanche', label: 'Avalanche', gt: 'avax' },
  { id: 'blast', label: 'Blast', gt: 'blast' },
  { id: 'sui', label: 'Sui', gt: 'sui-network' },
  { id: 'aptos', label: 'Aptos', gt: 'aptos' },
  { id: 'sei', label: 'Sei', gt: 'sei-v2' },
  { id: 'berachain', label: 'Berachain', gt: 'berachain' },
];
const gtChainFor = (dsChain) => CHAINS.find(c => c.id === dsChain)?.gt || dsChain;

const TOKEN_PRESETS = {
  'bitcoin': { isCex: true, symbol: 'BTC' },
  'btc': { isCex: true, symbol: 'BTC' },
  'ethereum': { chain: 'ethereum', address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', symbol: 'WETH' },
  'eth': { chain: 'ethereum', address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', symbol: 'WETH' },
  'weth': { chain: 'ethereum', address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', symbol: 'WETH' },
  'solana': { chain: 'solana', address: 'So11111111111111111111111111111111111111112', symbol: 'SOL' },
  'sol': { chain: 'solana', address: 'So11111111111111111111111111111111111111112', symbol: 'SOL' },
  'usdc': { chain: 'ethereum', address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', symbol: 'USDC' },
  'usdt': { chain: 'ethereum', address: '0xdac17f958d2ee523a2206206994597c13d831ec7', symbol: 'USDT' },
  'dai': { chain: 'ethereum', address: '0x6b175474e89094c44da98b954eedeac495271d0f', symbol: 'DAI' },
};

const DS_BASE = 'https://api.coingecko.com/api/v3';
const GT_BASE = 'https://api.coingecko.com/api/v3/onchain';

const normalize = (s) => String(s ?? '').toLowerCase().trim().replace(/[_\-\/]/g, ' ').replace(/[()]/g, '').replace(/\s+/g, ' ');

const matchScore = (header, candidates) => {
  const n = normalize(header);
  if (!n) return 0;
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
    seen[base]++;
    return `${base} (${seen[base]})`;
  });
};

const isContractAddress = (s) => {
  if (!s) return false;
  const t = String(s).trim();
  if (/^0x[a-fA-F0-9]{40}$/.test(t)) return 'evm';
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(t) && !t.startsWith('0x')) return 'solana';
  return false;
};

const fmtCurrency = (v) => {
  if (v === null || v === undefined || isNaN(v)) return '–';
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${v < 0 ? '-' : ''}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${v < 0 ? '-' : ''}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${v < 0 ? '-' : ''}$${(abs / 1e3).toFixed(1)}K`;
  return `${v < 0 ? '-' : ''}$${abs.toFixed(0)}`;
};
const fmtPct = (v) => (v === null || v === undefined || isNaN(v)) ? '–' : `${v.toFixed(2)}%`;
const daysBetween = (a, b) => Math.max(0, Math.round((b - a) / 86400000));
const shortAddr = (a) => !a ? '' : `${a.slice(0, 6)}…${a.slice(-4)}`;

const STAGES = { UPLOAD: 'upload', SHEET_PICK: 'sheet_pick', MAP: 'map', TOKENS: 'tokens', DASHBOARD: 'dashboard' };

export default function SOIDashboard() {
  const [stage, setStage] = useState(STAGES.UPLOAD);
  const [fileName, setFileName] = useState('');
  const [workbook, setWorkbook] = useState(null);
  const [activeSheet, setActiveSheet] = useState('');
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [columnMap, setColumnMap] = useState({});
  const [autoScores, setAutoScores] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [apiKey, setApiKey] = useState('');
  const withKey = useCallback((url) => {
    if (!apiKey) return url;
    return url + (url.includes('?') ? '&' : '?') + `x_cg_demo_api_key=${encodeURIComponent(apiKey)}`;
  }, [apiKey]);

  const [tokenMap, setTokenMap] = useState({});
  const [resolvingTokens, setResolvingTokens] = useState(false);
  const [apiStatus, setApiStatus] = useState('unknown');

  const [livePrices, setLivePrices] = useState({});
  const [historicalPrices, setHistoricalPrices] = useState({});
  const [portfolioSeries, setPortfolioSeries] = useState([]);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState({ current: 0, total: 0, task: '' });
  const [priceErrors, setPriceErrors] = useState([]);

  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('currentValue');
  const [sortDir, setSortDir] = useState('desc');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const loadSheet = useCallback((sheetData) => {
    const { headers: hdrs, rows: rws } = sheetData;
    const { mapping, scores } = autoMapColumns(hdrs);
    setHeaders(hdrs); setRows(rws); setColumnMap(mapping); setAutoScores(scores);
    setStage(STAGES.MAP);
  }, []);

  const handleFile = useCallback(async (file) => {
    setLoading(true); setError(''); setFileName(file.name);
    try {
      const ext = file.name.split('.').pop().toLowerCase();
      const sheets = {};
      if (ext === 'csv') {
        const text = await file.text();
        const parsed = Papa.parse(text, { header: false, dynamicTyping: false, skipEmptyLines: 'greedy' });
        const matrix = parsed.data;
        if (!matrix.length) throw new Error('CSV appears empty.');
        const hi = detectHeaderRow(matrix);
        const hdrs = dedupeHeaders((matrix[hi] || []).map(c => String(c ?? '')));
        const dataRows = matrix.slice(hi + 1).map(arr => { const o = {}; hdrs.forEach((h, i) => { o[h] = arr[i] ?? ''; }); return o; });
        sheets['Sheet1'] = { headers: hdrs, rows: dataRows, headerRowIndex: hi };
      } else if (ext === 'xlsx' || ext === 'xls') {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array', cellDates: true });
        for (const name of wb.SheetNames) {
          const sheet = wb.Sheets[name];
          const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false, blankrows: false });
          if (!matrix.length) continue;
          const hi = detectHeaderRow(matrix);
          const hdrs = dedupeHeaders((matrix[hi] || []).map(c => String(c ?? '')));
          const dataRows = matrix.slice(hi + 1).map(arr => { const o = {}; hdrs.forEach((h, i) => { o[h] = arr[i] ?? ''; }); return o; });
          sheets[name] = { headers: hdrs, rows: dataRows, headerRowIndex: hi };
        }
      } else throw new Error('Unsupported file type. Use .xlsx, .xls, or .csv.');

      const names = Object.keys(sheets);
      if (!names.length) throw new Error('No readable sheets found.');
      setWorkbook({ sheets });
      if (names.length === 1) { setActiveSheet(names[0]); loadSheet(sheets[names[0]]); }
      else {
        let bestName = names[0], bestScore = -1;
        for (const n of names) {
          const { scores } = autoMapColumns(sheets[n].headers);
          const total = Object.values(scores).reduce((a, b) => a + b, 0);
          if (total > bestScore) { bestScore = total; bestName = n; }
        }
        setActiveSheet(bestName);
        if (bestScore > 400) loadSheet(sheets[bestName]); else setStage(STAGES.SHEET_PICK);
      }
    } catch (e) { setError(e.message || 'Failed to parse file.'); }
    finally { setLoading(false); }
  }, [loadSheet]);

  const onDrop = (e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); };

  const reset = () => {
    setStage(STAGES.UPLOAD); setWorkbook(null); setActiveSheet(''); setHeaders([]); setRows([]);
    setColumnMap({}); setAutoScores({}); setFileName(''); setError('');
    setTokenMap({}); setLivePrices({}); setHistoricalPrices({}); setPortfolioSeries([]);
    setLastRefresh(null); setPriceErrors([]);
    setSearch(''); setSectorFilter('all'); setTypeFilter('all');
  };

  const soiPositions = useMemo(() => {
    if (!rows.length || !columnMap.positionName) return [];
    const out = [];
    for (const row of rows) {
      const name = String(row[columnMap.positionName] ?? '').trim();
      if (!name || SUBTOTAL_PATTERNS.test(name)) continue;
      const qty = columnMap.quantity ? parseNum(row[columnMap.quantity]) : null;
      const price = columnMap.price ? parseNum(row[columnMap.price]) : null;
      let soiMV = columnMap.marketValue ? parseNum(row[columnMap.marketValue]) : null;
      if ((soiMV === null || soiMV === 0) && qty !== null && price !== null) soiMV = qty * price;
      const cost = columnMap.costBasis ? parseNum(row[columnMap.costBasis]) : null;
      const pct = columnMap.pctNav ? parseNum(row[columnMap.pctNav]) : null;
      const acq = columnMap.acquisitionDate ? parseDate(row[columnMap.acquisitionDate]) : null;
      if (soiMV === null && pct === null) continue;

      out.push({
        id: out.length,
        positionName: name,
        ticker: columnMap.ticker ? String(row[columnMap.ticker] ?? '').trim() : '',
        assetType: columnMap.assetType ? (String(row[columnMap.assetType] ?? '').trim() || 'Unclassified') : 'Unclassified',
        sector: columnMap.sector ? (String(row[columnMap.sector] ?? '').trim() || 'Unclassified') : 'Unclassified',
        quantity: qty, soiPrice: price, costBasis: cost, soiMarketValue: soiMV ?? 0,
        pctNavRaw: pct, acquisitionDate: acq,
        liquidity: columnMap.liquidity ? (String(row[columnMap.liquidity] ?? '').trim() || 'Unclassified') : 'Unclassified',
      });
    }
    return out;
  }, [rows, columnMap]);

  const confirmMapping = () => {
    if (!columnMap.positionName) { setError('Map the Position Name column.'); return; }
    if (!columnMap.marketValue && !(columnMap.quantity && columnMap.price)) {
      setError('Map Market Value (or both Quantity and Price).'); return;
    }
    if (!columnMap.quantity) { setError('Quantity is required for live price tracking.'); return; }
    setError('');

    const seeded = {};
    for (const p of soiPositions) {
      const keys = [p.ticker, p.positionName].map(s => normalize(s)).filter(Boolean);
      let preset = null;
      for (const k of keys) { if (TOKEN_PRESETS[k]) { preset = TOKEN_PRESETS[k]; break; } }
      const nm = (p.positionName + ' ' + (p.assetType || '')).toLowerCase();
      if (/safe|saft|warrant/.test(nm)) {
        seeded[p.id] = { status: 'skip', reason: 'instrument-type' };
      } else if (preset?.isCex) {
        seeded[p.id] = { status: 'cex', symbol: preset.symbol };
      } else if (preset) {
        seeded[p.id] = { status: 'resolved', chain: preset.chain, address: preset.address, symbol: preset.symbol, name: p.positionName };
      } else {
        seeded[p.id] = { status: 'unresolved' };
      }
    }
    setTokenMap(seeded);
    setStage(STAGES.TOKENS);
  };

  const searchDexScreener = useCallback(async (query) => {
    const q = String(query || '').trim();
    if (!q || q.length < 2) return { results: [], error: null };
    if (!apiKey) return { results: [], error: 'Paste your free CoinGecko Demo key at the top to enable search.' };
    try {
      const res = await fetch(withKey(`${GT_BASE}/search/pools?query=${encodeURIComponent(q)}`));
      if (res.status === 401 || res.status === 403) { setApiStatus('bad_key'); return { results: [], error: 'Invalid API key. Double-check you pasted your Demo key correctly.' }; }
      if (res.status === 429) { setApiStatus('rate_limited'); return { results: [], error: 'Rate limit (30/min for Demo tier). Wait a moment.' }; }
      if (!res.ok) { setApiStatus('error'); return { results: [], error: `CoinGecko returned ${res.status}.` }; }
      const data = await res.json();
      setApiStatus('ok');
      const pools = data.data || [];
      const included = data.included || [];
      const tokenById = {};
      for (const inc of included) { if (inc.type === 'token') tokenById[inc.id] = inc; }

      const byToken = {};
      for (const pool of pools) {
        const attrs = pool.attributes || {};
        const rel = pool.relationships || {};
        const baseId = rel.base_token?.data?.id;
        if (!baseId) continue;
        const baseTok = tokenById[baseId];
        const underscore = baseId.indexOf('_');
        if (underscore < 0) continue;
        const chain = baseId.slice(0, underscore);
        const address = baseId.slice(underscore + 1);
        const liq = parseFloat(attrs.reserve_in_usd) || 0;
        const key = `${chain}:${address.toLowerCase()}`;
        if (!byToken[key] || liq > (byToken[key].liquidity || 0)) {
          byToken[key] = {
            chain, address,
            name: baseTok?.attributes?.name || attrs.name?.split('/')[0]?.trim() || '',
            symbol: baseTok?.attributes?.symbol || '',
            priceUsd: parseFloat(attrs.base_token_price_usd) || null,
            liquidity: liq,
            fdv: parseFloat(attrs.fdv_usd) || null,
            marketCap: parseFloat(attrs.market_cap_usd) || null,
            dex: rel.dex?.data?.id || '',
            pairAddress: attrs.address,
            imageUrl: baseTok?.attributes?.image_url,
          };
        }
      }
      const results = Object.values(byToken).sort((a, b) => b.liquidity - a.liquidity).slice(0, 10);
      return { results, error: null };
    } catch (e) {
      setApiStatus('blocked');
      return { results: [], error: 'Network error. Check your connection.' };
    }
  }, [apiKey, withKey]);

  const lookupByAddress = useCallback(async (chain, address) => {
    if (!apiKey) return null;
    try {
      const gtChain = gtChainFor(chain);
      const res = await fetch(withKey(`${GT_BASE}/networks/${gtChain}/tokens/${address}?include=top_pools`));
      if (!res.ok) return null;
      const data = await res.json();
      const attrs = data.data?.attributes || {};
      const included = data.included || [];
      const topPool = included.find(i => i.type === 'pool');
      return {
        chain, address: attrs.address || address,
        name: attrs.name || '', symbol: attrs.symbol || '',
        priceUsd: parseFloat(attrs.price_usd) || null,
        liquidity: parseFloat(topPool?.attributes?.reserve_in_usd) || 0,
        fdv: parseFloat(attrs.fdv_usd) || null,
        marketCap: parseFloat(attrs.market_cap_usd) || null,
        dex: topPool?.relationships?.dex?.data?.id || '',
        pairAddress: topPool?.attributes?.address,
      };
    } catch { return null; }
  }, [apiKey, withKey]);

  useEffect(() => {
    if (stage !== STAGES.TOKENS) return;
    if (!apiKey) return;
    let cancelled = false;
    const run = async () => {
      setResolvingTokens(true);
      const updates = {};
      for (const p of soiPositions) {
        if (cancelled) break;
        const cur = tokenMap[p.id];
        if (!cur || cur.status !== 'unresolved') continue;
        const queries = [p.ticker, p.positionName].map(s => String(s || '').trim()).filter(Boolean);
        let best = null;
        for (const q of queries) {
          const { results } = await searchDexScreener(q);
          if (!results.length) continue;
          const qn = normalize(q);
          const exactSym = results.find(r => normalize(r.symbol) === qn);
          const exactName = results.find(r => normalize(r.name) === qn);
          best = exactSym || exactName || results[0];
          if (best) break;
        }
        if (best && best.liquidity > 500) {
          updates[p.id] = { status: 'resolved', chain: best.chain, address: best.address, symbol: best.symbol, name: best.name, dex: best.dex, liquidity: best.liquidity };
        }
        await new Promise(r => setTimeout(r, 200));
      }
      if (!cancelled && Object.keys(updates).length) setTokenMap(prev => ({ ...prev, ...updates }));
      if (!cancelled) setResolvingTokens(false);
    };
    run();
    return () => { cancelled = true; };
  }, [stage, soiPositions, searchDexScreener, apiKey]);

  const refreshPrices = useCallback(async () => {
    setRefreshing(true); setPriceErrors([]);
    const errors = [];

    const byChain = {};
    for (const [posId, t] of Object.entries(tokenMap)) {
      if (t?.status !== 'resolved' || !t.chain || !t.address) continue;
      if (!byChain[t.chain]) byChain[t.chain] = new Set();
      byChain[t.chain].add(t.address);
    }
    const needBTC = Object.values(tokenMap).some(t => t?.status === 'cex' && t.symbol === 'BTC');

    const newLive = {};
    const chainEntries = Object.entries(byChain);
    setRefreshProgress({ current: 0, total: chainEntries.length + (needBTC ? 1 : 0), task: 'Fetching live prices' });

    for (let i = 0; i < chainEntries.length; i++) {
      const [chain, addrSet] = chainEntries[i];
      const addrs = [...addrSet];
      const gtChain = gtChainFor(chain);
      const batches = _.chunk(addrs, 30);
      for (const batch of batches) {
        try {
          const res = await fetch(withKey(`${GT_BASE}/simple/networks/${gtChain}/token_price/${batch.join(',')}?include_24hr_price_change=true&include_24hr_vol=true&include_total_reserve_in_usd=true`));
          if (!res.ok) { errors.push(`${chain} batch: ${res.status}`); continue; }
          const data = await res.json();
          const prices = data.data?.attributes?.token_prices || {};
          const changes = data.data?.attributes?.h24_price_change_percentage || {};
          const vols = data.data?.attributes?.h24_volume_usd || {};
          const reserves = data.data?.attributes?.total_reserve_in_usd || {};
          for (const addr of batch) {
            const lower = addr.toLowerCase();
            const price = parseFloat(prices[lower] ?? prices[addr]);
            if (!isNaN(price)) {
              newLive[`${chain}:${lower}`] = {
                usd: price,
                change24h: parseFloat(changes[lower] ?? changes[addr]) || null,
                liquidity: parseFloat(reserves[lower] ?? reserves[addr]) || 0,
                volume24h: parseFloat(vols[lower] ?? vols[addr]) || null,
              };
            }
          }
        } catch (e) { errors.push(`${chain} fetch error`); }
        await new Promise(r => setTimeout(r, 2100));
      }
      setRefreshProgress({ current: i + 1, total: chainEntries.length + (needBTC ? 1 : 0), task: 'Fetching live prices' });
    }

    if (needBTC) {
      try {
        const wbtc = '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599';
        const res = await fetch(withKey(`${GT_BASE}/simple/networks/eth/token_price/${wbtc}?include_24hr_price_change=true`));
        if (res.ok) {
          const data = await res.json();
          const prices = data.data?.attributes?.token_prices || {};
          const changes = data.data?.attributes?.h24_price_change_percentage || {};
          const p = parseFloat(prices[wbtc] ?? prices[wbtc.toLowerCase()]);
          if (!isNaN(p)) newLive['cex:BTC'] = { usd: p, change24h: parseFloat(changes[wbtc] ?? changes[wbtc.toLowerCase()]) || null, liquidity: 0 };
        }
      } catch { errors.push('BTC fetch error'); }
    }
    setLivePrices(newLive);

    setRefreshProgress({ current: 0, total: 0, task: 'Resolving pool addresses' });
    const needHist = [];
    for (const p of soiPositions) {
      const t = tokenMap[p.id];
      if (t?.status !== 'resolved' || !t.chain || !t.address || !p.acquisitionDate) continue;
      const dateStr = p.acquisitionDate.toISOString().slice(0, 10);
      const cacheKey = `${t.chain}:${t.address.toLowerCase()}:${dateStr}`;
      if (historicalPrices[cacheKey] !== undefined) continue;
      needHist.push({ posId: p.id, chain: t.chain, address: t.address, dateStr, ts: Math.floor(p.acquisitionDate.getTime() / 1000) });
    }

    const poolCache = {};
    const newHist = { ...historicalPrices };
    setRefreshProgress({ current: 0, total: needHist.length, task: 'Fetching historical prices' });

    for (let i = 0; i < needHist.length; i++) {
      const { chain, address, dateStr, ts } = needHist[i];
      const gtChain = gtChainFor(chain);
      const poolKey = `${chain}:${address.toLowerCase()}`;
      const cacheKey = `${chain}:${address.toLowerCase()}:${dateStr}`;
      try {
        if (!poolCache[poolKey]) {
          const poolRes = await fetch(withKey(`${GT_BASE}/networks/${gtChain}/tokens/${address}/pools?page=1`));
          if (poolRes.ok) {
            const pd = await poolRes.json();
            const top = pd.data?.[0];
            if (top?.attributes?.address) poolCache[poolKey] = top.attributes.address;
          }
          await new Promise(r => setTimeout(r, 250));
        }
        const poolAddr = poolCache[poolKey];
        if (!poolAddr) { newHist[cacheKey] = null; continue; }
        const beforeTs = ts + 86400 * 3;
        const ohlcvRes = await fetch(withKey(`${GT_BASE}/networks/${gtChain}/pools/${poolAddr}/ohlcv/day?aggregate=1&before_timestamp=${beforeTs}&limit=10`));
        if (!ohlcvRes.ok) { newHist[cacheKey] = null; continue; }
        const od = await ohlcvRes.json();
        const list = od.data?.attributes?.ohlcv_list || [];
        let closest = null; let bestDiff = Infinity;
        for (const c of list) {
          const [cts, open, high, low, close] = c;
          const diff = Math.abs(cts - ts);
          if (cts <= ts + 86400 && diff < bestDiff) { bestDiff = diff; closest = close; }
        }
        if (closest === null && list.length) closest = list[list.length - 1][4];
        newHist[cacheKey] = closest;
      } catch { newHist[cacheKey] = null; }
      await new Promise(r => setTimeout(r, 250));
      if (i % 3 === 0) setRefreshProgress({ current: i + 1, total: needHist.length, task: 'Fetching historical prices' });
    }
    setHistoricalPrices(newHist);

    const earliestAcq = _.min(soiPositions.map(p => p.acquisitionDate).filter(Boolean));
    if (earliestAcq) {
      setRefreshProgress({ current: 0, total: 0, task: 'Building NAV series' });
      const dayMs = 86400000;
      const start = Math.floor(earliestAcq.getTime() / dayMs) * dayMs;
      const end = Math.floor(Date.now() / dayMs) * dayMs;

      const uniqTokens = {};
      for (const [posId, t] of Object.entries(tokenMap)) {
        if (t?.status !== 'resolved' || !t.chain || !t.address) continue;
        const k = `${t.chain}:${t.address.toLowerCase()}`;
        if (!uniqTokens[k]) uniqTokens[k] = { chain: t.chain, address: t.address };
      }

      const seriesByToken = {};
      const tokenEntries = Object.entries(uniqTokens);
      for (let i = 0; i < tokenEntries.length; i++) {
        const [key, { chain, address }] = tokenEntries[i];
        setRefreshProgress({ current: i + 1, total: tokenEntries.length, task: 'Building NAV series' });
        const gtChain = gtChainFor(chain);
        const poolAddr = poolCache[key];
        if (!poolAddr) continue;

        const allCandles = [];
        let before = Math.floor(Date.now() / 1000) + 86400;
        const startTs = Math.floor(start / 1000);
        for (let attempt = 0; attempt < 4; attempt++) {
          try {
            const res = await fetch(withKey(`${GT_BASE}/networks/${gtChain}/pools/${poolAddr}/ohlcv/day?aggregate=1&before_timestamp=${before}&limit=180`));
            if (!res.ok) break;
            const d = await res.json();
            const list = d.data?.attributes?.ohlcv_list || [];
            if (!list.length) break;
            allCandles.push(...list);
            const oldestTs = list[list.length - 1][0];
            if (oldestTs <= startTs) break;
            before = oldestTs;
            await new Promise(r => setTimeout(r, 250));
          } catch { break; }
        }
        const byDay = {};
        for (const [cts, , , , close] of allCandles) {
          const dayKey = Math.floor(cts * 1000 / dayMs) * dayMs;
          byDay[dayKey] = close;
        }
        seriesByToken[key] = byDay;
        await new Promise(r => setTimeout(r, 200));
      }

      const filled = {};
      for (const [key, byDay] of Object.entries(seriesByToken)) {
        filled[key] = {};
        let last = null;
        for (let d = start; d <= end; d += dayMs) {
          if (byDay[d] !== undefined) last = byDay[d];
          filled[key][d] = last;
        }
      }

      const series = [];
      for (let d = start; d <= end; d += dayMs) {
        let total = 0;
        for (const p of soiPositions) {
          if (!p.acquisitionDate || p.quantity === null) continue;
          const acqDay = Math.floor(p.acquisitionDate.getTime() / dayMs) * dayMs;
          if (d < acqDay) continue;
          const t = tokenMap[p.id];
          if (t?.status === 'resolved' && t.chain && t.address) {
            const key = `${t.chain}:${t.address.toLowerCase()}`;
            const price = filled[key]?.[d];
            if (price !== null && price !== undefined) total += p.quantity * price;
            else total += p.soiMarketValue;
          } else if (t?.status === 'cash') {
            total += p.soiMarketValue;
          } else {
            total += p.soiMarketValue;
          }
        }
        series.push({ date: d, value: total });
      }
      setPortfolioSeries(series);
    }

    setLastRefresh(new Date());
    setRefreshing(false);
    setRefreshProgress({ current: 0, total: 0, task: '' });
    if (errors.length) setPriceErrors(errors);
  }, [tokenMap, soiPositions, historicalPrices, withKey]);

  useEffect(() => { if (stage === STAGES.DASHBOARD && !lastRefresh) refreshPrices(); }, [stage, lastRefresh, refreshPrices]);

  const livePositions = useMemo(() => {
    if (stage !== STAGES.DASHBOARD) return [];
    return soiPositions.map(p => {
      const t = tokenMap[p.id];
      let priceKey = null;
      if (t?.status === 'resolved') priceKey = `${t.chain}:${t.address.toLowerCase()}`;
      else if (t?.status === 'cex' && t.symbol === 'BTC') priceKey = 'cex:BTC';

      const live = priceKey ? livePrices[priceKey] : null;
      const hasLive = !!live && live.usd !== null;
      const isCash = t?.status === 'cash';

      const livePrice = hasLive ? live.usd : (isCash ? 1 : null);
      const change24h = hasLive ? live.change24h : null;
      const currentValue = (livePrice !== null && p.quantity !== null)
        ? p.quantity * livePrice
        : p.soiMarketValue;

      const dateStr = p.acquisitionDate ? p.acquisitionDate.toISOString().slice(0, 10) : null;
      const histKey = (priceKey && dateStr) ? `${priceKey}:${dateStr}` : null;
      const entryPrice = histKey ? historicalPrices[histKey] ?? null : null;
      const entryValue = (entryPrice !== null && p.quantity !== null) ? p.quantity * entryPrice : p.costBasis;

      const plSinceEntry = (entryValue !== null) ? currentValue - entryValue : null;
      const returnSinceEntry = (entryValue !== null && entryValue !== 0) ? (plSinceEntry / entryValue) * 100 : null;
      const plSinceSOI = currentValue - p.soiMarketValue;
      const returnSinceSOI = p.soiMarketValue ? (plSinceSOI / p.soiMarketValue) * 100 : null;
      const daysHeld = p.acquisitionDate ? daysBetween(p.acquisitionDate, new Date()) : null;

      return {
        ...p, hasLive, isCash, livePrice, change24h, currentValue,
        entryPrice, entryValue, plSinceEntry, returnSinceEntry,
        plSinceSOI, returnSinceSOI, daysHeld,
        status: t?.status || 'unresolved',
        chain: t?.chain, address: t?.address, tokenSymbol: t?.symbol, dex: t?.dex,
        liquidity: live?.liquidity,
      };
    });
  }, [soiPositions, tokenMap, livePrices, historicalPrices, stage]);

  const totals = useMemo(() => {
    if (!livePositions.length) return null;
    const currentNAV = _.sumBy(livePositions, 'currentValue');
    const soiNAV = _.sumBy(livePositions, 'soiMarketValue');
    const hasCost = livePositions.some(p => p.costBasis !== null);
    const costTotal = livePositions.reduce((s, p) => s + (p.costBasis ?? 0), 0);
    const entryTotal = livePositions.reduce((s, p) => s + (p.entryValue ?? p.soiMarketValue), 0);
    const withPct = livePositions.map(p => ({ ...p, pctNav: currentNAV > 0 ? (p.currentValue / currentNAV) * 100 : 0 }));
    const sorted = _.orderBy(withPct, 'currentValue', 'desc');
    return {
      currentNAV, soiNAV, costTotal: hasCost ? costTotal : null, entryTotal,
      plVsSOI: currentNAV - soiNAV,
      returnVsSOI: soiNAV ? ((currentNAV - soiNAV) / soiNAV) * 100 : null,
      plVsCost: hasCost ? currentNAV - costTotal : null,
      returnVsCost: hasCost && costTotal > 0 ? ((currentNAV - costTotal) / costTotal) * 100 : null,
      plVsEntry: currentNAV - entryTotal,
      returnVsEntry: entryTotal ? ((currentNAV - entryTotal) / entryTotal) * 100 : null,
      positionCount: livePositions.length,
      liveCount: livePositions.filter(p => p.hasLive).length,
      top10: _.sumBy(sorted.slice(0, 10), 'pctNav'),
      top25: _.sumBy(sorted.slice(0, 25), 'pctNav'),
      positions: withPct,
      hasCost,
    };
  }, [livePositions]);

  const breakdown = (key) => {
    if (!totals) return [];
    const grouped = _.groupBy(totals.positions, key);
    return _.orderBy(Object.entries(grouped).map(([k, items]) => ({
      name: k || 'Unclassified', value: _.sumBy(items, 'currentValue'),
      pct: _.sumBy(items, 'pctNav'), count: items.length,
    })), 'value', 'desc');
  };

  const sectorBreakdown = useMemo(() => breakdown('sector'), [totals]);
  const typeBreakdown = useMemo(() => breakdown('assetType'), [totals]);
  const liquidityBreakdown = useMemo(() => breakdown('liquidity'), [totals]);
  const topHoldings = useMemo(() => totals ? _.orderBy(totals.positions, 'currentValue', 'desc').slice(0, 10) : [], [totals]);

  const filteredTable = useMemo(() => {
    if (!totals) return [];
    let r = totals.positions;
    if (sectorFilter !== 'all') r = r.filter(x => x.sector === sectorFilter);
    if (typeFilter !== 'all') r = r.filter(x => x.assetType === typeFilter);
    if (search) {
      const s = search.toLowerCase();
      r = r.filter(x => String(x.positionName).toLowerCase().includes(s) || String(x.ticker).toLowerCase().includes(s) || String(x.sector).toLowerCase().includes(s));
    }
    return _.orderBy(r, sortBy, sortDir);
  }, [totals, search, sortBy, sortDir, sectorFilter, typeFilter]);

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  const sectorOptions = useMemo(() => totals ? ['all', ..._.uniq(totals.positions.map(p => p.sector)).sort()] : ['all'], [totals]);
  const typeOptions = useMemo(() => totals ? ['all', ..._.uniq(totals.positions.map(p => p.assetType)).sort()] : ['all'], [totals]);

  const containerStyle = { minHeight: '100vh', backgroundColor: CA_SKY, fontFamily: 'system-ui, -apple-system, sans-serif' };

  if (stage === STAGES.UPLOAD) {
    return (
      <div style={containerStyle}>
        <div className="max-w-5xl mx-auto px-6 py-8">
          <Header />
          <ApiKeyPanel apiKey={apiKey} setApiKey={setApiKey} />
          <div onDragOver={(e) => e.preventDefault()} onDrop={onDrop} className="border-2 border-dashed rounded-lg p-16 text-center bg-white hover:bg-blue-50 mt-4" style={{ borderColor: CA_BLUE + '60' }}>
            <Upload size={48} style={{ color: CA_BLUE, margin: '0 auto 16px' }} />
            <div className="text-lg font-semibold mb-2" style={{ color: CA_BLUE }}>Drop SOI file here</div>
            <div className="text-sm mb-4" style={{ color: CA_SLATE }}>or</div>
            <label className="inline-block px-6 py-2.5 rounded cursor-pointer font-medium text-white hover:opacity-90" style={{ backgroundColor: CA_BLUE }}>
              Browse files
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])} />
            </label>
            <div className="text-xs mt-6" style={{ color: CA_SLATE }}>
              Live on-chain pricing via <strong>CoinGecko /onchain</strong> · Uniswap, Jupiter, Raydium, PancakeSwap + 1,500 more across 200+ chains · Fully client-side
            </div>
          </div>
          {loading && <div className="mt-6 flex items-center justify-center gap-3 p-4 rounded" style={{ backgroundColor: 'white', color: CA_BLUE }}><RefreshCw size={16} className="animate-spin" /> Parsing…</div>}
          {error && <ErrorBanner msg={error} />}
          <SecurityPanel />
        </div>
      </div>
    );
  }

  if (stage === STAGES.SHEET_PICK && workbook) {
    const names = Object.keys(workbook.sheets);
    return (
      <div style={containerStyle}>
        <div className="max-w-3xl mx-auto px-6 py-8">
          <Header fileName={fileName} />
          <div className="bg-white rounded p-6" style={{ border: `1px solid ${CA_BLUE}20` }}>
            <div className="flex items-center gap-2 mb-4"><FileSpreadsheet size={18} style={{ color: CA_BLUE }} /><div className="font-semibold" style={{ color: CA_BLUE }}>Select sheet</div></div>
            <div className="space-y-2">
              {names.map(n => {
                const s = workbook.sheets[n];
                const { scores } = autoMapColumns(s.headers);
                const matched = Object.keys(scores).length;
                const isBest = n === activeSheet;
                return (
                  <button key={n} onClick={() => { setActiveSheet(n); loadSheet(s); }} className="w-full text-left p-3 rounded border hover:bg-blue-50 flex items-center justify-between" style={{ borderColor: isBest ? CA_BLUE : CA_BLUE + '30', backgroundColor: isBest ? CA_SKY : 'white' }}>
                    <div><div className="font-medium text-sm" style={{ color: CA_BLUE }}>{n}</div><div className="text-xs" style={{ color: CA_SLATE }}>{s.rows.length} rows · {s.headers.length} columns</div></div>
                    <div className="text-xs px-2 py-1 rounded" style={{ backgroundColor: matched >= 3 ? CA_GREEN + '20' : CA_GOLD + '20', color: matched >= 3 ? CA_GREEN : CA_GOLD }}>{matched} matched{isBest && ' · recommended'}</div>
                  </button>
                );
              })}
            </div>
            <button onClick={reset} className="mt-4 text-sm flex items-center gap-1 hover:underline" style={{ color: CA_SLATE }}><ArrowLeft size={14} /> Upload different file</button>
          </div>
        </div>
      </div>
    );
  }

  if (stage === STAGES.MAP) {
    const mapped = Object.keys(columnMap).length;
    const previewRows = rows.slice(0, 3);
    return (
      <div style={containerStyle}>
        <div className="max-w-6xl mx-auto px-6 py-8">
          <Header fileName={fileName} />
          <div className="bg-white rounded p-6 mb-4" style={{ border: `1px solid ${CA_BLUE}20` }}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="font-semibold text-base" style={{ color: CA_BLUE }}>Confirm column mapping</div>
                <div className="text-sm mt-1" style={{ color: CA_SLATE }}>Auto-detected {mapped} of {Object.keys(FIELDS).length} fields. <span style={{ color: CA_GOLD }}>Quantity and Acquisition Date drive live MTM and return-since-entry.</span></div>
              </div>
              <div className="flex items-center gap-2">
                {workbook && Object.keys(workbook.sheets).length > 1 && <button onClick={() => setStage(STAGES.SHEET_PICK)} className="text-xs flex items-center gap-1 px-3 py-1.5 rounded border hover:bg-blue-50" style={{ color: CA_SLATE, borderColor: CA_BLUE + '30' }}><ArrowLeft size={12} /> Change sheet</button>}
                <button onClick={reset} className="text-xs flex items-center gap-1 px-3 py-1.5 rounded border hover:bg-blue-50" style={{ color: CA_SLATE, borderColor: CA_BLUE + '30' }}><ArrowLeft size={12} /> New file</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {Object.entries(FIELDS).map(([field, def]) => {
                const isReq = REQUIRED_FOR_DASHBOARD.includes(field) || field === 'quantity' || field === 'acquisitionDate';
                const selected = columnMap[field] || '';
                return (
                  <div key={field} className="flex items-center gap-3">
                    <div className="w-44 flex-shrink-0">
                      <div className="text-sm font-medium" style={{ color: CA_BLUE }}>{def.label}{isReq && <span style={{ color: CA_RED }}> *</span>}</div>
                      {autoScores[field] && <div className="text-xs" style={{ color: CA_GREEN }}>auto-matched</div>}
                    </div>
                    <select value={selected} onChange={(e) => setColumnMap({ ...columnMap, [field]: e.target.value || undefined })} className="flex-1 px-2 py-1.5 text-sm rounded border outline-none" style={{ borderColor: selected ? CA_BLUE + '60' : CA_BLUE + '20', backgroundColor: selected ? CA_SKY : 'white' }}>
                      <option value="">— not mapped —</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                );
              })}
            </div>
            {error && <ErrorBanner msg={error} />}
            <div className="mt-5 flex items-center justify-between">
              <div className="text-xs" style={{ color: CA_SLATE }}>{rows.length} data rows · subtotals auto-filtered</div>
              <button onClick={confirmMapping} className="px-5 py-2 rounded font-medium text-white hover:opacity-90 flex items-center gap-2" style={{ backgroundColor: CA_BLUE }}><CheckCircle2 size={16} /> Continue to token resolution</button>
            </div>
          </div>
          <div className="bg-white rounded p-4" style={{ border: `1px solid ${CA_BLUE}20` }}>
            <div className="text-sm font-semibold mb-2" style={{ color: CA_BLUE }}>Data preview</div>
            <div className="overflow-x-auto">
              <table className="text-xs w-full">
                <thead style={{ backgroundColor: CA_SKY, color: CA_BLUE }}>
                  <tr>{headers.map(h => { const mt = Object.entries(columnMap).find(([_, v]) => v === h); return <th key={h} className="px-2 py-1.5 text-left font-semibold whitespace-nowrap">{h}{mt && <div className="text-[10px] font-normal" style={{ color: CA_GREEN }}>→ {FIELDS[mt[0]].label}</div>}</th>; })}</tr>
                </thead>
                <tbody>{previewRows.map((r, i) => <tr key={i} style={{ backgroundColor: i % 2 ? 'white' : '#FAFCFE' }}>{headers.map(h => <td key={h} className="px-2 py-1.5 whitespace-nowrap" style={{ color: CA_SLATE }}>{String(r[h] ?? '').slice(0, 60)}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (stage === STAGES.TOKENS) {
    const resolved = soiPositions.filter(p => tokenMap[p.id]?.status === 'resolved').length;
    const cex = soiPositions.filter(p => tokenMap[p.id]?.status === 'cex').length;
    const cash = soiPositions.filter(p => tokenMap[p.id]?.status === 'cash').length;
    const skip = soiPositions.filter(p => tokenMap[p.id]?.status === 'skip').length;
    const unresolved = soiPositions.length - resolved - cex - cash - skip;

    return (
      <div style={containerStyle}>
        <div className="max-w-6xl mx-auto px-6 py-8">
          <Header fileName={fileName} />
          <div className="bg-white rounded p-6 mb-4" style={{ border: `1px solid ${CA_BLUE}20` }}>
            {!apiKey && <div className="mb-4"><ApiKeyPanel apiKey={apiKey} setApiKey={setApiKey} /></div>}
            {apiKey && <ApiKeyPanel apiKey={apiKey} setApiKey={setApiKey} compact />}
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="font-semibold text-base flex items-center gap-2" style={{ color: CA_BLUE }}><Link2 size={18} /> Token resolution</div>
                <div className="text-sm mt-1" style={{ color: CA_SLATE }}>Match positions to on-chain tokens via <strong>CoinGecko /onchain</strong>. Paste a contract address or search by name.</div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {resolved > 0 && <div className="text-xs px-2 py-1 rounded" style={{ backgroundColor: CA_GREEN + '20', color: CA_GREEN }}>{resolved} DEX</div>}
                {cex > 0 && <div className="text-xs px-2 py-1 rounded" style={{ backgroundColor: CA_BLUE + '20', color: CA_BLUE }}>{cex} CEX</div>}
                {cash > 0 && <div className="text-xs px-2 py-1 rounded" style={{ backgroundColor: CA_ACCENT + '20', color: CA_ACCENT }}>{cash} cash</div>}
                {skip > 0 && <div className="text-xs px-2 py-1 rounded" style={{ backgroundColor: CA_SLATE + '20', color: CA_SLATE }}>{skip} flat</div>}
                {unresolved > 0 && <div className="text-xs px-2 py-1 rounded" style={{ backgroundColor: CA_GOLD + '20', color: CA_GOLD }}>{unresolved} unresolved</div>}
                <button onClick={() => setStage(STAGES.MAP)} className="text-xs flex items-center gap-1 px-3 py-1.5 rounded border hover:bg-blue-50" style={{ color: CA_SLATE, borderColor: CA_BLUE + '30' }}><ArrowLeft size={12} /> Back</button>
              </div>
            </div>

            {resolvingTokens && <div className="mb-4 text-xs flex items-center gap-2" style={{ color: CA_ACCENT }}><RefreshCw size={12} className="animate-spin" /> Auto-resolving…</div>}
            {apiStatus === 'blocked' && <ErrorBanner msg="Network error reaching CoinGecko. Check network/extensions." />}
            {apiStatus === 'bad_key' && <ErrorBanner msg="API key rejected. Double-check your Demo key (starts with CG-)." />}
            {apiStatus === 'rate_limited' && <div className="mb-4 p-3 rounded text-xs" style={{ backgroundColor: '#FFF8E6', color: CA_GOLD, border: `1px solid ${CA_GOLD}40` }}>Rate limit hit (30/min). Wait a moment.</div>}

            <div className="mb-3 flex items-center gap-2 flex-wrap">
              <button onClick={() => {
                const u = {};
                for (const p of soiPositions) if (tokenMap[p.id]?.status !== 'resolved' && tokenMap[p.id]?.status !== 'cex' && tokenMap[p.id]?.status !== 'cash') u[p.id] = { status: 'skip' };
                setTokenMap(prev => ({ ...prev, ...u }));
              }} className="text-xs px-3 py-1.5 rounded border hover:bg-blue-50" style={{ color: CA_SLATE, borderColor: CA_BLUE + '30' }}>
                Hold all remaining flat
              </button>
              <div className="text-xs" style={{ color: CA_SLATE }}>SAFEs / SAFTs / Warrants pre-flagged as flat</div>
            </div>

            <div className="space-y-2 max-h-[560px] overflow-y-auto">
              {soiPositions.map(p => (
                <TokenRow
                  key={p.id}
                  position={p}
                  entry={tokenMap[p.id] || { status: 'unresolved' }}
                  onUpdate={(upd) => setTokenMap(prev => ({ ...prev, [p.id]: upd }))}
                  searchDexScreener={searchDexScreener}
                  lookupByAddress={lookupByAddress}
                />
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between">
              <div className="text-xs" style={{ color: CA_SLATE }}>Unresolved = held flat at SOI mark.</div>
              <button onClick={() => setStage(STAGES.DASHBOARD)} className="px-5 py-2 rounded font-medium text-white hover:opacity-90 flex items-center gap-2" style={{ backgroundColor: CA_BLUE }}><Zap size={16} /> Build live dashboard</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!totals) {
    return <div style={containerStyle}><div className="max-w-3xl mx-auto p-8"><ErrorBanner msg="No valid positions." /><button onClick={() => setStage(STAGES.MAP)} className="mt-4 px-4 py-2 rounded text-white" style={{ backgroundColor: CA_BLUE }}>Back</button></div></div>;
  }

  return (
    <div style={containerStyle}>
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-6 pb-4 border-b" style={{ borderColor: CA_BLUE + '30' }}>
          <div>
            <div className="text-xs tracking-widest font-semibold" style={{ color: CA_ACCENT }}>CAMBRIDGE ASSOCIATES</div>
            <h1 className="text-xl font-bold" style={{ color: CA_BLUE }}>SOI Live Monitoring</h1>
            <div className="text-xs mt-0.5" style={{ color: CA_SLATE }}>
              {fileName}{activeSheet && ` · ${activeSheet}`} · {totals.positionCount} positions · {totals.liveCount} live-priced
            </div>
          </div>
          <div className="flex items-center gap-2">
            {lastRefresh && <div className="text-xs flex items-center gap-1" style={{ color: CA_SLATE }}><Clock size={11} /> {lastRefresh.toLocaleTimeString()}</div>}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium" style={{ backgroundColor: 'white', color: CA_GREEN, border: `1px solid ${CA_GREEN}40` }}><Lock size={12} /> In-browser</div>
            <button onClick={refreshPrices} disabled={refreshing} className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium text-white hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: CA_ACCENT }}><RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} /> {refreshing ? 'Updating…' : 'Refresh'}</button>
            <button onClick={() => setStage(STAGES.TOKENS)} className="text-xs px-3 py-1.5 rounded border hover:bg-blue-50" style={{ color: CA_BLUE, borderColor: CA_BLUE + '30' }}>Remap</button>
            <button onClick={reset} className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium text-white hover:opacity-90" style={{ backgroundColor: CA_BLUE }}>New upload</button>
          </div>
        </div>

        {refreshing && refreshProgress.total > 0 && (
          <div className="mb-4 p-3 rounded text-xs flex items-center gap-3" style={{ backgroundColor: 'white', color: CA_ACCENT, border: `1px solid ${CA_ACCENT}40` }}>
            <RefreshCw size={12} className="animate-spin" />
            <div className="flex-1">
              <div className="font-semibold">{refreshProgress.task}</div>
              <div className="mt-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: CA_SKY }}>
                <div className="h-full rounded-full transition-all" style={{ backgroundColor: CA_ACCENT, width: `${(refreshProgress.current / refreshProgress.total) * 100}%` }} />
              </div>
            </div>
            <div className="tabular-nums">{refreshProgress.current} / {refreshProgress.total}</div>
          </div>
        )}

        {priceErrors.length > 0 && (
          <div className="mb-4 p-3 rounded text-xs flex items-start gap-2" style={{ backgroundColor: '#FFF8E6', color: CA_GOLD, border: `1px solid ${CA_GOLD}40` }}>
            <AlertCircle size={14} /> <div><span className="font-semibold">Warnings:</span> {priceErrors.slice(0, 3).join(' · ')}{priceErrors.length > 3 && ` +${priceErrors.length - 3}`}</div>
          </div>
        )}

        <div className="grid grid-cols-5 gap-3 mb-6">
          <KPI label="Current NAV" value={fmtCurrency(totals.currentNAV)} sub={`SOI: ${fmtCurrency(totals.soiNAV)}`} icon={<DollarSign size={14} />} />
          <KPI label="P&L vs Entry" value={fmtCurrency(totals.plVsEntry)} sub={totals.returnVsEntry !== null ? fmtPct(totals.returnVsEntry) : undefined} positive={totals.plVsEntry >= 0} icon={totals.plVsEntry >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />} />
          <KPI label="P&L vs SOI" value={fmtCurrency(totals.plVsSOI)} sub={totals.returnVsSOI !== null ? fmtPct(totals.returnVsSOI) : undefined} positive={totals.plVsSOI >= 0} icon={totals.plVsSOI >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />} />
          <KPI label="P&L vs Cost" value={totals.hasCost ? fmtCurrency(totals.plVsCost) : 'n/a'} sub={totals.returnVsCost !== null ? fmtPct(totals.returnVsCost) : undefined} positive={totals.plVsCost >= 0} icon={<Activity size={14} />} />
          <KPI label="Top 10 Conc." value={fmtPct(totals.top10)} sub={`Top 25: ${fmtPct(totals.top25)}`} icon={<Layers size={14} />} />
        </div>

        <Panel title="Portfolio NAV — Since Earliest Acquisition" right={<div className="text-xs" style={{ color: CA_SLATE }}>DEX-priced positions live · illiquid held flat at SOI mark</div>}>
          {portfolioSeries.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={portfolioSeries} margin={{ left: 0, right: 20, top: 10 }}>
                <defs><linearGradient id="navGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={CA_BLUE} stopOpacity={0.3} /><stop offset="95%" stopColor={CA_BLUE} stopOpacity={0.02} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E9EE" />
                <XAxis dataKey="date" tickFormatter={(d) => new Date(d).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })} tick={{ fontSize: 10, fill: CA_SLATE }} />
                <YAxis tickFormatter={fmtCurrency} tick={{ fontSize: 10, fill: CA_SLATE }} />
                <Tooltip formatter={(v) => fmtCurrency(v)} labelFormatter={(d) => new Date(d).toLocaleDateString()} />
                <Area type="monotone" dataKey="value" stroke={CA_BLUE} strokeWidth={2} fill="url(#navGrad)" />
                <ReferenceLine y={totals.soiNAV} stroke={CA_GOLD} strokeDasharray="4 4" label={{ value: 'SOI NAV', fontSize: 10, fill: CA_GOLD, position: 'right' }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="py-12 text-center text-sm" style={{ color: CA_SLATE }}>{refreshing ? <><RefreshCw size={16} className="inline animate-spin mr-2" /> Building series…</> : 'Click Refresh'}</div>
          )}
        </Panel>

        <div className="grid grid-cols-3 gap-4 my-6">
          <DonutPanel title="Sector" data={sectorBreakdown} />
          <DonutPanel title="Asset Type" data={typeBreakdown} />
          <DonutPanel title="Liquidity" data={liquidityBreakdown} />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <Panel title="Top 10 by Current Value">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topHoldings} layout="vertical" margin={{ left: 0, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E9EE" />
                <XAxis type="number" tickFormatter={fmtCurrency} tick={{ fontSize: 10, fill: CA_SLATE }} />
                <YAxis type="category" dataKey="positionName" width={130} tick={{ fontSize: 10, fill: CA_SLATE }} />
                <Tooltip formatter={(v) => fmtCurrency(v)} />
                <Bar dataKey="currentValue" fill={CA_BLUE} radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Panel>
          <Panel title="Return Since Entry — Winners & Losers">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={_.orderBy(totals.positions.filter(p => p.returnSinceEntry !== null), 'returnSinceEntry', 'desc').slice(0, 5).concat(_.orderBy(totals.positions.filter(p => p.returnSinceEntry !== null), 'returnSinceEntry', 'asc').slice(0, 5))} layout="vertical" margin={{ left: 0, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E9EE" />
                <XAxis type="number" tickFormatter={(v) => `${v.toFixed(0)}%`} tick={{ fontSize: 10, fill: CA_SLATE }} />
                <YAxis type="category" dataKey="positionName" width={130} tick={{ fontSize: 10, fill: CA_SLATE }} />
                <Tooltip formatter={(v) => fmtPct(v)} />
                <Bar dataKey="returnSinceEntry" radius={[0, 3, 3, 0]}>
                  {_.orderBy(totals.positions.filter(p => p.returnSinceEntry !== null), 'returnSinceEntry', 'desc').slice(0, 5).concat(_.orderBy(totals.positions.filter(p => p.returnSinceEntry !== null), 'returnSinceEntry', 'asc').slice(0, 5)).map((p, i) => <Cell key={i} fill={p.returnSinceEntry >= 0 ? CA_GREEN : CA_RED} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Panel>
        </div>

        <Panel title="All Positions — Live">
          <div className="flex gap-2 mb-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: CA_SLATE }} />
              <input type="text" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-8 pr-3 py-2 text-sm rounded border outline-none" style={{ borderColor: CA_BLUE + '30' }} />
            </div>
            <select value={sectorFilter} onChange={(e) => setSectorFilter(e.target.value)} className="px-3 py-2 text-sm rounded border outline-none" style={{ borderColor: CA_BLUE + '30' }}>{sectorOptions.map(s => <option key={s} value={s}>{s === 'all' ? 'All sectors' : s}</option>)}</select>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-3 py-2 text-sm rounded border outline-none" style={{ borderColor: CA_BLUE + '30' }}>{typeOptions.map(t => <option key={t} value={t}>{t === 'all' ? 'All types' : t}</option>)}</select>
            <div className="px-3 py-2 text-xs rounded flex items-center" style={{ backgroundColor: CA_SKY, color: CA_BLUE }}>{filteredTable.length} of {totals.positionCount}</div>
          </div>
          <div className="overflow-x-auto" style={{ maxHeight: 520 }}>
            <table className="w-full text-xs">
              <thead style={{ backgroundColor: CA_BLUE, color: 'white', position: 'sticky', top: 0 }}>
                <tr>
                  <Th label="Position" col="positionName" sortBy={sortBy} sortDir={sortDir} onClick={toggleSort} />
                  <Th label="Src" col="status" sortBy={sortBy} sortDir={sortDir} onClick={toggleSort} />
                  <Th label="Qty" col="quantity" sortBy={sortBy} sortDir={sortDir} onClick={toggleSort} align="right" />
                  <Th label="Entry $" col="entryPrice" sortBy={sortBy} sortDir={sortDir} onClick={toggleSort} align="right" />
                  <Th label="Live $" col="livePrice" sortBy={sortBy} sortDir={sortDir} onClick={toggleSort} align="right" />
                  <Th label="24h" col="change24h" sortBy={sortBy} sortDir={sortDir} onClick={toggleSort} align="right" />
                  <Th label="Current MV" col="currentValue" sortBy={sortBy} sortDir={sortDir} onClick={toggleSort} align="right" />
                  <Th label="P&L vs Entry" col="plSinceEntry" sortBy={sortBy} sortDir={sortDir} onClick={toggleSort} align="right" />
                  <Th label="Return" col="returnSinceEntry" sortBy={sortBy} sortDir={sortDir} onClick={toggleSort} align="right" />
                  <Th label="Days" col="daysHeld" sortBy={sortBy} sortDir={sortDir} onClick={toggleSort} align="right" />
                  <Th label="% NAV" col="pctNav" sortBy={sortBy} sortDir={sortDir} onClick={toggleSort} align="right" />
                </tr>
              </thead>
              <tbody>
                {filteredTable.map((p, i) => (
                  <tr key={p.id} style={{ backgroundColor: i % 2 ? 'white' : '#FAFCFE' }} className="hover:bg-blue-50">
                    <td className="px-3 py-2 font-medium" style={{ color: CA_BLUE }}>
                      {p.positionName}
                      {p.tokenSymbol && <span className="ml-1 text-[10px] font-normal" style={{ color: CA_SLATE }}>({p.tokenSymbol})</span>}
                    </td>
                    <td className="px-3 py-2"><StatusBadge status={p.status} chain={p.chain} dex={p.dex} /></td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: CA_SLATE }}>{p.quantity !== null ? p.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 }) : '–'}</td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: CA_SLATE }}>{p.entryPrice !== null ? `$${p.entryPrice.toFixed(p.entryPrice < 1 ? 4 : 2)}` : '–'}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium" style={{ color: CA_BLUE }}>{p.livePrice !== null ? `$${p.livePrice.toFixed(p.livePrice < 1 ? 4 : 2)}` : '–'}</td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: p.change24h === null ? CA_SLATE : (p.change24h >= 0 ? CA_GREEN : CA_RED) }}>{p.change24h !== null ? `${p.change24h >= 0 ? '+' : ''}${p.change24h.toFixed(2)}%` : '–'}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium" style={{ color: CA_BLUE }}>{fmtCurrency(p.currentValue)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium" style={{ color: p.plSinceEntry === null ? CA_SLATE : (p.plSinceEntry >= 0 ? CA_GREEN : CA_RED) }}>{p.plSinceEntry !== null ? fmtCurrency(p.plSinceEntry) : '–'}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium" style={{ color: p.returnSinceEntry === null ? CA_SLATE : (p.returnSinceEntry >= 0 ? CA_GREEN : CA_RED) }}>{p.returnSinceEntry !== null ? fmtPct(p.returnSinceEntry) : '–'}</td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: CA_SLATE }}>{p.daysHeld !== null ? p.daysHeld : '–'}</td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: CA_SLATE }}>{fmtPct(p.pctNav)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="mt-6 text-xs text-center" style={{ color: CA_SLATE }}>
          Cambridge Associates · On-chain pricing via CoinGecko · All data client-side
        </div>
      </div>
    </div>
  );
}

function TokenRow({ position, entry, onUpdate, searchDexScreener, lookupByAddress }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searchError, setSearchError] = useState(null);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [addrInput, setAddrInput] = useState('');
  const [addrChain, setAddrChain] = useState('ethereum');
  const [addrLoading, setAddrLoading] = useState(false);
  const timer = useRef();

  useEffect(() => {
    if (!open) { setResults([]); setSearchError(null); return; }
    if (!query || query.length < 2) { setResults([]); setSearchError(null); return; }
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setSearching(true); setSearchError(null);
      const { results: r, error } = await searchDexScreener(query);
      setResults(r); setSearchError(error); setSearching(false);
    }, 350);
    return () => clearTimeout(timer.current);
  }, [query, open, searchDexScreener]);

  const resolveByAddress = async () => {
    if (!addrInput.trim()) return;
    setAddrLoading(true);
    const addrType = isContractAddress(addrInput.trim());
    const chain = addrType === 'solana' ? 'solana' : addrChain;
    const res = await lookupByAddress(chain, addrInput.trim());
    setAddrLoading(false);
    if (res) {
      onUpdate({ status: 'resolved', chain: res.chain, address: res.address, symbol: res.symbol, name: res.name, dex: res.dex, liquidity: res.liquidity });
      setOpen(false); setAddrInput('');
    } else {
      setSearchError(`No liquid pool found for ${shortAddr(addrInput.trim())} on ${chain}`);
    }
  };

  return (
    <div className="flex items-start gap-3 p-3 rounded border" style={{ borderColor: CA_BLUE + '20', backgroundColor: 'white' }}>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate" style={{ color: CA_BLUE }}>{position.positionName}</div>
        <div className="text-xs" style={{ color: CA_SLATE }}>
          {position.ticker && <span>{position.ticker} · </span>}
          {position.assetType} · Qty {position.quantity !== null ? position.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 }) : 'n/a'} · SOI MV {fmtCurrency(position.soiMarketValue)}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 relative" style={{ width: 440 }}>
        {entry.status === 'resolved' && (
          <div className="text-xs px-2 py-1 rounded flex items-center gap-1 truncate max-w-[260px]" style={{ backgroundColor: CA_GREEN + '15', color: CA_GREEN }}>
            <CheckCircle2 size={11} />
            <span className="truncate">{entry.symbol || entry.name} · {entry.chain} · {shortAddr(entry.address)}</span>
          </div>
        )}
        {entry.status === 'cex' && <div className="text-xs px-2 py-1 rounded" style={{ backgroundColor: CA_BLUE + '15', color: CA_BLUE }}>{entry.symbol} (CEX)</div>}
        {entry.status === 'cash' && <div className="text-xs px-2 py-1 rounded" style={{ backgroundColor: CA_ACCENT + '15', color: CA_ACCENT }}>Cash / $1</div>}
        {entry.status === 'skip' && <div className="text-xs px-2 py-1 rounded" style={{ backgroundColor: CA_SLATE + '15', color: CA_SLATE }}>Held flat</div>}
        <div className="relative">
          <button onClick={() => { setOpen(!open); setQuery(''); setAddrInput(''); setSearchError(null); }} className="text-xs px-2 py-1 rounded border hover:bg-blue-50" style={{ color: CA_BLUE, borderColor: CA_BLUE + '30' }}>
            {entry.status === 'unresolved' ? 'Find' : 'Change'}
          </button>
          {open && (
            <div className="absolute right-0 top-8 w-[420px] bg-white rounded shadow-lg border z-20 p-3" style={{ borderColor: CA_BLUE + '30' }}>
              <div className="mb-3">
                <div className="text-[10px] font-semibold mb-1" style={{ color: CA_SLATE }}>PASTE CONTRACT ADDRESS (fastest)</div>
                <div className="flex gap-1">
                  <select value={addrChain} onChange={(e) => setAddrChain(e.target.value)} className="px-2 py-1.5 text-xs rounded border outline-none" style={{ borderColor: CA_BLUE + '30', width: 110 }}>
                    {CHAINS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                  <input type="text" placeholder="0x… or Solana address" value={addrInput} onChange={(e) => setAddrInput(e.target.value)} className="flex-1 px-2 py-1.5 text-xs rounded border outline-none font-mono" style={{ borderColor: CA_BLUE + '30' }} />
                  <button onClick={resolveByAddress} disabled={addrLoading || !addrInput.trim()} className="text-xs px-2 py-1 rounded text-white disabled:opacity-50" style={{ backgroundColor: CA_BLUE }}>
                    {addrLoading ? '…' : 'Go'}
                  </button>
                </div>
              </div>

              <div className="border-t pt-3" style={{ borderColor: CA_BLUE + '15' }}>
                <div className="text-[10px] font-semibold mb-1" style={{ color: CA_SLATE }}>OR SEARCH BY NAME/SYMBOL</div>
                <input autoFocus type="text" placeholder="e.g. plasma, XPL, bonk…" value={query} onChange={(e) => setQuery(e.target.value)} className="w-full px-2 py-1.5 text-sm rounded border outline-none" style={{ borderColor: CA_BLUE + '30' }} />
              </div>

              <div className="max-h-60 overflow-y-auto mt-2">
                {query.length > 0 && query.length < 2 && <div className="text-xs p-2" style={{ color: CA_SLATE }}>2+ chars to search…</div>}
                {searching && <div className="text-xs p-2 flex items-center gap-2" style={{ color: CA_ACCENT }}><RefreshCw size={11} className="animate-spin" /> Searching…</div>}
                {searchError && <div className="text-xs p-2 rounded" style={{ backgroundColor: '#FDECEC', color: CA_RED }}><AlertCircle size={11} className="inline mr-1" /> {searchError}</div>}
                {!searching && !searchError && query.length >= 2 && results.length === 0 && <div className="text-xs p-2" style={{ color: CA_SLATE }}>No liquid pools found for "{query}"</div>}
                {results.map(r => (
                  <button
                    key={`${r.chain}:${r.address}`}
                    onClick={() => { onUpdate({ status: 'resolved', chain: r.chain, address: r.address, symbol: r.symbol, name: r.name, dex: r.dex, liquidity: r.liquidity }); setOpen(false); setQuery(''); }}
                    className="w-full text-left p-2 hover:bg-blue-50 rounded flex items-center gap-2 text-xs"
                  >
                    {r.imageUrl && <img src={r.imageUrl} alt="" className="w-5 h-5 rounded-full flex-shrink-0" onError={(e) => e.target.style.display = 'none'} />}
                    <div className="flex-1 min-w-0">
                      <div className="truncate" style={{ color: CA_BLUE }}><strong>{r.symbol}</strong> · {r.name}</div>
                      <div className="truncate" style={{ color: CA_SLATE }}>{r.chain} · {r.dex} · liq {fmtCurrency(r.liquidity)} · {shortAddr(r.address)}</div>
                    </div>
                    {r.priceUsd && <div className="text-right tabular-nums" style={{ color: CA_BLUE }}>${r.priceUsd < 1 ? r.priceUsd.toFixed(4) : r.priceUsd.toFixed(2)}</div>}
                  </button>
                ))}
              </div>

              <div className="border-t mt-2 pt-2 flex gap-2 flex-wrap" style={{ borderColor: CA_BLUE + '15' }}>
                <button onClick={() => { onUpdate({ status: 'cex', symbol: 'BTC' }); setOpen(false); }} className="text-xs px-2 py-1 rounded hover:bg-blue-50" style={{ color: CA_BLUE }}>Is BTC</button>
                <button onClick={() => { onUpdate({ status: 'cash' }); setOpen(false); }} className="text-xs px-2 py-1 rounded hover:bg-blue-50" style={{ color: CA_ACCENT }}>Cash</button>
                <button onClick={() => { onUpdate({ status: 'skip' }); setOpen(false); }} className="text-xs px-2 py-1 rounded hover:bg-blue-50" style={{ color: CA_SLATE }}>Hold flat</button>
                {entry.status !== 'unresolved' && <button onClick={() => { onUpdate({ status: 'unresolved' }); setOpen(false); }} className="text-xs px-2 py-1 rounded hover:bg-blue-50" style={{ color: CA_GOLD }}>Clear</button>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status, chain, dex }) {
  if (status === 'resolved') return <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: CA_GREEN + '20', color: CA_GREEN }} title={`${chain} · ${dex || 'DEX'}`}>{chain?.slice(0, 3).toUpperCase() || 'DEX'}</span>;
  if (status === 'cex') return <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: CA_BLUE + '20', color: CA_BLUE }}>CEX</span>;
  if (status === 'cash') return <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: CA_ACCENT + '20', color: CA_ACCENT }}>Cash</span>;
  if (status === 'skip') return <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: CA_SLATE + '20', color: CA_SLATE }}>Flat</span>;
  return <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: CA_GOLD + '20', color: CA_GOLD }}>?</span>;
}

function ApiKeyPanel({ apiKey, setApiKey, compact }) {
  const [local, setLocal] = useState(apiKey);
  const [showHelp, setShowHelp] = useState(false);
  const isSet = !!apiKey;

  if (compact && isSet) return (
    <div className="mb-3 flex items-center justify-between p-2 rounded text-xs" style={{ backgroundColor: CA_GREEN + '10', border: `1px solid ${CA_GREEN}30` }}>
      <div className="flex items-center gap-2" style={{ color: CA_GREEN }}>
        <CheckCircle2 size={12} /> API key set · {apiKey.slice(0, 6)}…{apiKey.slice(-4)}
      </div>
      <button onClick={() => setApiKey('')} className="text-xs hover:underline" style={{ color: CA_SLATE }}>Change</button>
    </div>
  );

  return (
    <div className="rounded p-4" style={{ backgroundColor: isSet ? 'white' : '#FFF8E6', border: `1px solid ${isSet ? CA_GREEN : CA_GOLD}40` }}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {isSet ? <CheckCircle2 size={18} style={{ color: CA_GREEN }} /> : <AlertCircle size={18} style={{ color: CA_GOLD }} />}
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold mb-1" style={{ color: isSet ? CA_GREEN : CA_GOLD }}>
            {isSet ? 'CoinGecko Demo API key set' : 'Paste your free CoinGecko Demo API key'}
          </div>
          {!isSet && (
            <div className="text-xs mb-2" style={{ color: CA_SLATE }}>
              Required for live prices. <strong>Free, no credit card</strong> — sign up at <a href="https://www.coingecko.com/en/api/pricing" target="_blank" rel="noreferrer" className="underline" style={{ color: CA_ACCENT }}>coingecko.com/api</a>, copy your key (starts with <code>CG-</code>), paste below. Stored only in-memory for this session; cleared on reload.
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="password"
              placeholder="CG-xxxxxxxxxxxxxxxxxxxx"
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && local.trim()) setApiKey(local.trim()); }}
              className="flex-1 px-3 py-2 text-sm rounded border outline-none font-mono"
              style={{ borderColor: CA_BLUE + '30' }}
            />
            <button
              onClick={() => setApiKey(local.trim())}
              disabled={!local.trim()}
              className="px-4 py-2 rounded text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
              style={{ backgroundColor: CA_BLUE }}
            >
              {isSet ? 'Update' : 'Save'}
            </button>
            {isSet && (
              <button onClick={() => { setApiKey(''); setLocal(''); }} className="px-3 py-2 rounded text-xs border hover:bg-blue-50" style={{ color: CA_SLATE, borderColor: CA_BLUE + '30' }}>Clear</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Header({ fileName }) {
  return (
    <div className="flex items-center justify-between mb-6 pb-4 border-b" style={{ borderColor: CA_BLUE + '30' }}>
      <div>
        <div className="text-xs tracking-widest font-semibold mb-1" style={{ color: CA_ACCENT }}>CAMBRIDGE ASSOCIATES</div>
        <h1 className="text-2xl font-bold" style={{ color: CA_BLUE }}>SOI Live Monitoring</h1>
        <div className="text-sm mt-1" style={{ color: CA_SLATE }}>{fileName ? <>File: <span className="font-medium">{fileName}</span></> : 'On-chain pricing via CoinGecko · Uniswap, Jupiter, Raydium + 1,500 more DEXs'}</div>
      </div>
      <div className="flex items-center gap-2 px-3 py-2 rounded text-xs font-medium" style={{ backgroundColor: 'white', color: CA_GREEN, border: `1px solid ${CA_GREEN}40` }}><Lock size={14} /> Client-side only</div>
    </div>
  );
}

function ErrorBanner({ msg }) { return <div className="mt-4 flex items-start gap-3 p-4 rounded" style={{ backgroundColor: '#FDECEC', color: CA_RED, border: `1px solid ${CA_RED}40` }}><AlertCircle size={18} /><div><div className="font-semibold">Issue</div><div className="text-sm">{msg}</div></div></div>; }

function SecurityPanel() {
  return (
    <div className="mt-8 p-6 rounded" style={{ backgroundColor: 'white', border: `1px solid ${CA_BLUE}20` }}>
      <div className="flex items-start gap-3">
        <Shield size={18} style={{ color: CA_GREEN, marginTop: 2 }} />
        <div className="text-sm" style={{ color: CA_SLATE }}>
          <div className="font-semibold mb-1" style={{ color: CA_BLUE }}>Data source</div>
          <strong>CoinGecko /onchain</strong> indexes every pool across 1,500+ DEXs on 200+ chains. Free Demo tier, CORS-enabled with API key, 30 calls/min. Provides both live prices and historical OHLCV. SOI parsing stays fully client-side; outbound calls are anonymous token/pool queries only.
        </div>
      </div>
    </div>
  );
}

function KPI({ label, value, sub, positive, icon }) {
  return (
    <div className="bg-white rounded p-4" style={{ border: `1px solid ${CA_BLUE}20` }}>
      <div className="flex items-center gap-1.5 text-xs mb-2" style={{ color: CA_SLATE }}>{icon} {label}</div>
      <div className="text-xl font-bold" style={{ color: CA_BLUE }}>{value}</div>
      {sub && <div className="text-xs mt-0.5 font-medium" style={{ color: positive === undefined ? CA_SLATE : (positive ? CA_GREEN : CA_RED) }}>{sub}</div>}
    </div>
  );
}

function Panel({ title, children, right }) {
  return (
    <div className="bg-white rounded p-4" style={{ border: `1px solid ${CA_BLUE}20` }}>
      <div className="flex items-center justify-between mb-3"><div className="text-sm font-semibold" style={{ color: CA_BLUE }}>{title}</div>{right}</div>
      {children}
    </div>
  );
}

function DonutPanel({ title, data }) {
  return (
    <Panel title={title}>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} innerRadius={50} paddingAngle={1}>
            {data.map((_e, i) => <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />)}
          </Pie>
          <Tooltip formatter={(v, _n, p) => [`${fmtCurrency(v)} (${fmtPct(p.payload.pct)})`, p.payload.name]} />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
        {data.slice(0, 6).map((d, i) => (
          <div key={d.name} className="flex items-center gap-1.5 truncate">
            <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: CHART_PALETTE[i % CHART_PALETTE.length] }} />
            <span className="truncate" style={{ color: CA_SLATE }}>{d.name}</span>
            <span className="ml-auto tabular-nums font-medium" style={{ color: CA_BLUE }}>{fmtPct(d.pct)}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Th({ label, col, sortBy, sortDir, onClick, align = 'left' }) {
  const active = sortBy === col;
  return <th onClick={() => onClick(col)} className="px-3 py-2 text-xs font-semibold cursor-pointer select-none hover:opacity-80" style={{ textAlign: align }}>{label}{active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</th>;
}
