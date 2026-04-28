// Sector taxonomy + token->sector resolution.
// SECTORS is mutable at runtime (loaded from the store). Access it via
// getSectors() so other modules see live updates when setSectors() runs.
export const DEFAULT_SECTORS = [
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
  { id: 'cash',             label: 'Cash',                    color: '#D4A64F', desc: 'USD cash bucket held by the fund' },
];

export const UNCLASSIFIED = { id: 'unclassified', label: 'Unclassified', color: '#6B7280' };

// Legacy sectorIds from the pre-v5 taxonomy.
export const LEGACY_SECTOR_MAP = {
  middleware:   'infrastructure',
  applications: 'consumer-media',
};

// Canonical ticker -> sectorId (seed; user overrides live in store.sectorOverrides).
export const DEFAULT_TOKEN_SECTOR = {
  'BTC': 'base-layer', 'ETH': 'base-layer', 'SOL': 'base-layer',
  'SUI': 'base-layer', 'APT': 'base-layer', 'SEI': 'base-layer',
  'TIA': 'base-layer', 'NEAR': 'base-layer', 'AVAX': 'base-layer',
  'TON': 'base-layer', 'ADA': 'base-layer', 'DOT': 'base-layer',
  'INJ': 'base-layer', 'BERA': 'base-layer', 'MNT': 'base-layer',
  'MOVE': 'base-layer', 'MONAD': 'base-layer',
  'ARB': 'infrastructure', 'OP': 'infrastructure', 'STRK': 'infrastructure',
  'MATIC': 'infrastructure', 'POL': 'infrastructure', 'BASE': 'infrastructure',
  'LINK': 'infrastructure', 'GRT': 'infrastructure', 'AXL': 'infrastructure',
  'AR': 'infrastructure', 'ATH': 'infrastructure',
  'UNI': 'defi', 'AAVE': 'defi', 'COMP': 'defi', 'CRV': 'defi',
  'LDO': 'defi', 'PENDLE': 'defi', 'GMX': 'defi', 'DYDX': 'defi',
  'HYPE': 'defi', 'ENA': 'defi', 'MORPHO': 'defi', 'JUP': 'defi',
  'IMX': 'gaming', 'RON': 'gaming', 'SAND': 'gaming', 'MANA': 'gaming',
  'AXS': 'gaming', 'PRIME': 'gaming', 'GAME': 'gaming',
  'GRASS': 'depin', 'RNDR': 'depin', 'RENDER': 'depin', 'FIL': 'depin',
  'HNT': 'depin', 'IOT': 'depin', 'OCEAN': 'depin',
  'FET': 'ai-compute', 'TAO': 'ai-compute', 'AGIX': 'ai-compute',
  'WLD': 'ai-compute', 'ICP': 'ai-compute',
  'STORY': 'consumer-media',
  'XMR': 'security-privacy', 'ZEC': 'security-privacy',
  'USDC': 'stablecoins', 'USDT': 'stablecoins', 'DAI': 'stablecoins',
  'FRAX': 'stablecoins', 'USDE': 'stablecoins', 'PYUSD': 'stablecoins', 'USD': 'stablecoins',
  'ONDO': 'rwa-credit', 'MKR': 'rwa-credit',
  'EIGEN': 'staking', 'JTO': 'staking', 'RPL': 'staking',
  'ETHFI': 'staking', 'REZ': 'staking', 'KMNO': 'staking',
};

// Try to preseed the ref from localStorage at module load so the very
// first render sees the user's custom sectors (if any). Silent-fail if
// localStorage is unavailable (SSR, tests) — DEFAULT_SECTORS is the fallback.
const _initialSectors = (() => {
  try {
    if (typeof localStorage === 'undefined') return DEFAULT_SECTORS;
    const raw = localStorage.getItem('catena.store.v5');
    if (!raw) return DEFAULT_SECTORS;
    const parsed = JSON.parse(raw);
    const list = parsed?.sectors;
    if (Array.isArray(list) && list.length && list.some((s) => s?.id === 'base-layer')) {
      return list;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_SECTORS;
})();

let _sectorsRef = _initialSectors;
export const setSectors = (arr) => {
  _sectorsRef = Array.isArray(arr) && arr.length ? arr : DEFAULT_SECTORS;
};
export const getSectors = () => _sectorsRef;
export const sectorOf = (id) => _sectorsRef.find((s) => s.id === id) || UNCLASSIFIED;

export const resolveSector = (position, overrides) => {
  const sym = String(position.ticker || '').toUpperCase().trim();
  if (sym && overrides[sym]) return overrides[sym];
  if (sym && DEFAULT_TOKEN_SECTOR[sym]) return DEFAULT_TOKEN_SECTOR[sym];
  if (position.sectorId) return LEGACY_SECTOR_MAP[position.sectorId] || position.sectorId;
  return UNCLASSIFIED.id;
};
