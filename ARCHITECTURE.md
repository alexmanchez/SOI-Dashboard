# Catena architecture

A single-page React app that lets an OCIO / family office see look-through crypto exposure across managers, funds (vintages), and positions. No backend — everything lives in `localStorage` under `STORE_KEY = 'catena.store.v5'`. Live prices come straight from CoinGecko; logos come from CoinMarketCap / CryptoRank / jsdelivr fallbacks.

## Domain model

```
Client                (a family office, foundation, etc.)
  └─ Commitment       (what the client committed to a fund)
      └─ SOI          (Statement of Investments — one fund / vintage)
          └─ Snapshot (one point-in-time set of positions)
              └─ Position  (BTC, ETH, a SAFT, …)
                  └─ sectorId  (base-layer / defi / gaming / …)
```

- A **Manager** runs one or more Funds (each Fund = one `soi` row in the store).
- A Manager can be `direct` (positions are tokens / SAFTs) or `fund_of_funds` (positions are `subCommitments` to other SOIs).
- Every SOI has one or more **Snapshots** (time series). `latestSnapshot(soi)` is the authoritative "as of today" view.

The full store shape is documented inline at the top of `src/lib/storage.js`. Migrations run on every load (`loadStore`) so old browsers keep working after taxonomy / schema changes.

## Data flow

```
localStorage  ──▶  loadStore()  ──▶  store state in App.jsx
                                          │
                                          ├─▶  computeRollup(store, selection, livePrices, scaleBy)
                                          │        rolls per-selection NAV, sector / manager / token breakdowns,
                                          │        liquidity buckets, top holdings, concentration metrics
                                          │
                                          └─▶  page components (OverviewTab, ExposuresPage, …)
                                                   consume the rollup plus the raw store for drill-in detail.
```

`computeRollup` lives in `src/lib/rollup.js`. It handles FoF look-through: if the selection is a client and one of their commitments points at a `fund_of_funds` manager, positions from each underlying SOI are scaled by the client's pro-rata share of the FoF's called capital, then by the FoF's pro-rata share of the underlying fund's MV.

## Rendering hierarchy

```
main.jsx
  └─ ErrorBoundary
      └─ App.jsx   (src/App.jsx)
          ├─ Top nav (Home / Portfolios / Managers / Create, search, settings cog)
          ├─ Breadcrumb row (client → manager → fund)
          ├─ LeftSidebar (sub-page nav: Dashboard / Positions / Exposures / Fund Economics)
          ├─ <subPage content>
          │     OverviewTab.jsx     — KPIs + PerformanceChart + compact panels
          │     PositionsTab.jsx    — full table of all positions in scope
          │     ExposuresPage.jsx   — full sector + liquidity + manager panels
          │     FundEconomicsPage.jsx — committed / called / MOIC per commitment
          │     SOIDetail.jsx       — drill into one manager/vintage
          ├─ ManagersTab.jsx        (when tab === 'managers' and nothing drilled)
          ├─ SettingsDrawer.jsx     (modal, slides from right)
          ├─ ImportWizard.jsx       (modal, 4-step file import flow)
          └─ TokenDetailDrawer.jsx  (modal, opens from any token reference)
```

## Directory layout

```
src/
├── App.jsx                  main app component (routing + top nav + data wiring)
├── main.jsx                 React 18 entry
├── ErrorBoundary.jsx        catches render-phase errors
├── contexts.js              TokenImageContext + OpenTokenDetailContext
├── index.css                Tailwind base layer
├── assets/                  logo images
│
├── lib/                     pure, non-UI modules (no React imports)
│   ├── theme.js             dark palette constants (BG / PANEL / TEXT / ACCENT / …)
│   ├── format.js            fmtCurrency / fmtPct / fmtMoic / fmtNum / uid / today / fundLabel
│   ├── sectors.js           DEFAULT_SECTORS (11 buckets), resolveSector, getSectors/setSectors
│   ├── ranges.js            time-range pills + rangeToStartMs / rangeToDays
│   ├── parsing.js           FIELDS, parseNum, parseDate, header detection, column auto-mapping
│   ├── snapshots.js         snapshotsOf, latestSnapshot, isLiquid, liquidityOverrideOf
│   ├── rollup.js            getSelectedSOIs, computeRollup, buildNAVSeries
│   ├── seed.js              seedStore (3 managers, 5 funds — all fictional names)
│   ├── storage.js           STORE_KEY, loadStore (with migrations), saveStore, emptyStore
│   └── api/
│       ├── coingecko.js     live prices + coin detail + historical chart
│       ├── cryptorank.js    ticker → logo URL map (fallback source)
│       └── coinmarketcap.js ticker → CMC id → animated GIF / static PNG
│
├── components/              reusable UI, topic-per-file
│   ├── ui.jsx               Panel / KPI / Pill / Tab / NavButton / Breadcrumb / EditableText
│   │                        / badges (Sector, Liquidity, Change) / SortHead / Field / TextInput
│   │                        / NumField / Stat / Select / Modal / ChoiceCard / MenuItem
│   │                        / PlaceholderPage / ManagerSocials
│   ├── TokenIcon.jsx        CMC-gif → CMC-png → CryptoRank → jsdelivr → letter fallback
│   ├── TokenDetailDrawer.jsx shared drawer for any position (CG detail + chart + your exposure)
│   ├── LeftSidebar.jsx      workspace sub-page nav + per-manager funds list
│   ├── PortfolioSelector.jsx client selector dropdown
│   ├── PerformanceChart.jsx NAV area chart with snapshot markers
│   ├── MiniSparkline.jsx    inline sparkline for manager rows
│   └── DashboardPanels.jsx  CompactSectorTilt / CompactManagerBreakdown
│                            / TopHoldingsPanel / TopMoversPanel
│                            / FullSectorTiltPanel / LiquidityBreakdownPanel
│                            / FullTopHoldingsTable
│
├── pages/                   one page component per visible sub-view
│   ├── OverviewTab.jsx
│   ├── ExposuresPage.jsx
│   ├── FundEconomicsPage.jsx
│   ├── ManagersTab.jsx
│   ├── PositionsTab.jsx
│   ├── SOIDetail.jsx
│   ├── PositionEditor.jsx   modal form for add/edit a single position
│   └── SettingsDrawer.jsx   + ManageRow + SectorRow + SectorAddForm
│
└── import/
    └── ImportWizard.jsx     + DropZone   (file upload → CSV/XLSX parse → column map → save)
```

## Common tasks — where the change lives

### Add a new sector
1. Open `src/lib/sectors.js`.
2. Add an entry to `DEFAULT_SECTORS` (pick an id, label, color, description).
3. Optional: add tickers to `DEFAULT_TOKEN_SECTOR` so positions without an explicit override pick it up.
4. Bump `STORE_KEY` in `src/lib/storage.js` to force re-seed (or write a migration that merges the new bucket into stored `sectors`).

### Add a new page to the sidebar
1. Create `src/pages/MyPage.jsx`.
2. Register the entry in `SIDEBAR_SECTIONS` inside `src/components/LeftSidebar.jsx`.
3. In `src/App.jsx`, render it inside the `<subPage content>` switch alongside the existing pages.

### Add a new dashboard panel
1. Add a component to `src/components/DashboardPanels.jsx` (or spin off its own file if large).
2. Import and slot it into `OverviewTab` / `SOIDetail` / `ExposuresPage` as appropriate.

### Wire a new CoinGecko-style field
1. Extend the fetch helpers in `src/lib/api/coingecko.js`.
2. Read the new data in `App.jsx` (the price-refresh hook area) or in whichever drawer needs it.

### Use the TokenDetailDrawer from another list/table
1. Wrap your list in `<OpenTokenDetailContext.Consumer>` or call `useContext(OpenTokenDetailContext)`.
2. On click of a row, call the function with `{ cgTokenId, symbol, name }`.
3. `App.jsx` owns the drawer state (`detailToken`) and renders `TokenDetailDrawer` at the top level, so any open request from anywhere gets picked up.

## FoF look-through

`computeRollup` handles this in `src/lib/rollup.js`:

- For each SOI the selected client committed to, if the manager is `fund_of_funds`, iterate over the snapshot's `subCommitments`.
- For each underlying commitment, pull the target SOI's latest positions and scale each position by `clientShare * fofShare` where:
  - `clientShare = client.called / fofTotalCalled`
  - `fofShare    = sub.called / underlyingMV`
- Positions carry a `fromFoF: true` flag plus a modified `managerName` (`"FoF → Underlying"`) for display.

The rollup intentionally limits to **one level** of look-through — nested FoFs are skipped with a console warning.

## Theme

All colors live in `src/lib/theme.js`. The palette is institutional-cypherpunk: near-black backgrounds, quiet navy-violet borders, electric teal (ACCENT `#22D3C5`) as the signature pop. Lime / Punch / Gold are positive / negative / highlight accents. Violet is reserved for FoF.

Alpha variants are produced by concatenating hex suffixes in-line (e.g., `ACCENT + '22'`). This is incompatible with CSS variables, so Task 5's planned light/dark toggle will need an `ALPHA` constants file.

## API credentials

CoinGecko, CryptoRank, and CoinMarketCap keys are all currently embedded in `src/lib/api/*.js` with a `VITE_*_API_KEY` env var override. Live price fetches are gated by `store.settings.useLivePrices` (off by default) so we don't burn demo credits on load.

## Run

```
npm install
npm run dev      # vite, localhost:5173
npm run lint
npx vite build
```
