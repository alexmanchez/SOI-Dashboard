// Import-wizard helpers: column inference, header detection, number/date parsing.
export const FIELDS = {
  positionName:    { label: 'Position Name',          required: true,  synonyms: ['position name','position','name','asset','asset name','security','security name','holding','holdings','investment','investment name','company','company name','issuer','description','token name','instrument','portfolio company'] },
  ticker:          { label: 'Ticker / Symbol',        required: false, synonyms: ['ticker','symbol','ticker/symbol','token','token symbol','cusip'] },
  assetType:       { label: 'Asset Type',             required: false, synonyms: ['asset type','type','instrument type','security type','instrument','asset class','investment type','holding type'] },
  sector:          { label: 'Sector / Category',      required: false, synonyms: ['sector','category','sector/category','industry','vertical','theme','classification','gics sector','sub-sector','sub sector','strategy'] },
  quantity:        { label: 'Quantity',               required: false, synonyms: ['quantity','qty','shares','units','tokens','coins','position size','number of shares','# shares','par','par value','principal','notional'] },
  price:           { label: 'Price (at SOI)',         required: false, synonyms: ['price','unit price','price per share','mark','mark price','last price','nav per unit','price per unit','current price'] },
  costBasis:       { label: 'Cost Basis',             required: false, synonyms: ['cost basis','cost','book value','invested capital','basis','acquisition cost','total cost','original cost','cost ($)','investment cost'] },
  marketValue:     { label: 'Market Value (at SOI)',  required: true,  synonyms: ['market value','mv','fair value','fv','value','nav contribution','current value','mkt value','market val','fmv','ending value','ending mv','ending market value','value ($)','gross market value','gross exposure','net asset value','nav','position value'] },
  unrealizedPL:    { label: 'Unrealized P&L',         required: false, synonyms: ['unrealized gain/loss','unrealized p&l','unrealized pnl','unrealized gain (loss)','ugl','gain/loss','p&l','pnl','unrealized','unrealized profit','unrealized gain','u/g/l','gain loss'] },
  pctNav:          { label: '% of NAV',               required: false, synonyms: ['% of nav','pct of nav','% nav','percent of nav','weight','% of portfolio','portfolio %','allocation','pct','% weight','% of total','portfolio weight','% of aum','% of fund'] },
  acquisitionDate: { label: 'Acquisition Date',       required: false, synonyms: ['acquisition date','date','purchase date','entry date','invested date','buy date','date acquired','initial investment date','trade date'] },
  liquidity:       { label: 'Liquidity',              required: false, synonyms: ['liquidity','liquidity tier','lockup','vesting','liquid/locked','liquid','liquidity profile','lock-up'] },
};

export const SUBTOTAL_PATTERNS = /^(total|subtotal|sub-total|grand total|sum|net total|fund total|portfolio total|aggregate)/i;

export const normalize = (s) =>
  String(s ?? '')
    .toLowerCase()
    .trim()
    .replace(/[_\-\/]/g, ' ')
    .replace(/[()]/g, '')
    .replace(/\s+/g, ' ');

export const parseNum = (v) => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return isNaN(v) ? null : v;
  let s = String(v).trim();
  if (!s || s === '-' || s === '\u2013' || s === 'N/A' || s === 'n/a') return null;
  const isNegParen = /^\(.+\)$/.test(s);
  s = s.replace(/[$,%\s\u20ac\u00a3\u00a5]/g, '').replace(/[()]/g, '');
  const n = parseFloat(s);
  if (isNaN(n)) return null;
  return isNegParen ? -n : n;
};

export const parseDate = (v) => {
  if (!v) return null;
  if (v instanceof Date && !isNaN(v)) return v;
  if (typeof v === 'number' && v > 10000 && v < 60000) {
    const ms = (v - 25569) * 86400 * 1000;
    const d = new Date(ms);
    return isNaN(d) ? null : d;
  }
  const d = new Date(v);
  return isNaN(d) ? null : d;
};

export const matchScore = (header, candidates) => {
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

export const autoMapColumns = (headers) => {
  const mapping = {};
  const scores = {};
  const used = new Set();
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
    mapping[c.field] = c.header;
    scores[c.field] = c.score;
    used.add(c.header);
  }
  return { mapping, scores };
};

export const detectHeaderRow = (rows) => {
  const allSynonyms = Object.values(FIELDS).flatMap((f) => f.synonyms);
  const limit = Math.min(25, rows.length);
  let bestRow = 0;
  let bestScore = 0;
  for (let i = 0; i < limit; i++) {
    const row = rows[i] || [];
    const cells = row.map((c) => normalize(c)).filter(Boolean);
    if (cells.length < 3) continue;
    let hits = 0;
    for (const cell of cells) {
      for (const syn of allSynonyms) {
        if (cell === syn || cell.includes(syn) || syn.includes(cell)) {
          hits++;
          break;
        }
      }
    }
    const textCells = row.filter((c) => c && typeof c === 'string' && isNaN(parseNum(c))).length;
    const score = hits * 3 + textCells;
    if (score > bestScore && hits >= 2) {
      bestScore = score;
      bestRow = i;
    }
  }
  return bestRow;
};

export const dedupeHeaders = (headers) => {
  const seen = {};
  return headers.map((h, i) => {
    const base = h && String(h).trim() ? String(h).trim() : `Column ${i + 1}`;
    if (seen[base] === undefined) {
      seen[base] = 0;
      return base;
    }
    seen[base]++;
    return `${base} (${seen[base]})`;
  });
};
