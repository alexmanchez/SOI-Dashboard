import { uid } from './format';
import { DEFAULT_SECTORS } from './sectors';

/* Seed data: 1 client, 3 managers (2 direct + 1 FoF), 5 vintages, realistic overlap.
   All manager names, funds, and values are fictional. */
export const seedStore = () => {
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
