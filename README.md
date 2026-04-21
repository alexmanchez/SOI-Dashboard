# Catena — Crypto Portfolio Exposure Dashboard

LP-style portfolio dashboard for digital-asset fund-of-funds exposure. All data
is processed and persisted client-side in `localStorage` — nothing is
transmitted except direct requests to CoinGecko for price data.

Live: https://soi-dashboard.vercel.app

## Features

- **Overview tab** — firm-wide or client-scoped rollup with total exposure,
  liquid/illiquid split, top-10/25 concentration, sector tilt, and an
  aggregated top-token table across managers.
- **Managers tab** — per-vintage cards with NAV, MOIC, sector tilt, and a
  sparkline over the selected time range. Drill into any card for a full SOI
  detail view.
- **Positions tab** — flat searchable/filterable view of every position across
  the current selection, with inline liquidity override.
- **SOI Detail** — per-vintage drill-down with editable positions, fund
  economics panel, and sector tilt.
- **Three-region performance chart** — pre-acquisition / historical /
  post-as-of regions, with range pills (1D, MTD, YTD, 1Y, SI).
- **Fund economics + MOIC** — editable Committed / Called / Distributions per
  commitment, with Uncalled, % Invested, Unrealized MOIC, DPI, and TVPI
  computed live. Client-scoped overview shows pooled totals. Managers-tab
  cards show MOIC.
- **Custom user-defined sectors** — the 5-bucket GICS-style taxonomy is
  user-editable: add, rename, recolor, or remove sectors. Deleting a sector
  with existing references prompts for a replacement before it reassigns.
- **Direct CRUD** — manage clients, managers, SOIs, and sectors from the
  Settings drawer (rename inline; delete cascades through commitments and
  SOIs with an explicit preview of what gets removed).
- **Snapshot-based data model** — each SOI is a snapshot of a manager's
  positions on an as-of date. Quarterly updates overwrite in place or create a
  new vintage.
- **Client share toggle**: scales all NAV figures to the client's pro-rata called capital fraction, so client-scoped views show true economic exposure.
- **Excel export** — Fund Economics workbook with Client, Manager, Vintage,
  Committed, Called, Uncalled, Distributions, % Invested, Current NAV,
  Unrealized MOIC, Realized MOIC, and TVPI.
- **CoinGecko integration** — live prices (Demo API key, stored locally) and
  historical price series for charts, cached in-memory per session.
- **JSON import/export** — round-trip the full store for backup or sharing.

## Stack

React 18 · Vite · Tailwind · Recharts · lucide-react · lodash · SheetJS ·
PapaParse.

## Run locally

```bash
npm install
npm run dev
```
