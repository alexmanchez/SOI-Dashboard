/* @vitest-environment jsdom */
//
// Smoke tests — mount each critical render path and confirm no crash.
// Not exhaustive: these only catch "did it render at all" regressions
// (broken imports, undeclared refs, throw-on-mount bugs). Component-level
// behavior is covered by the unit tests in lib/.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

// Mock fetch globally so async fetches in components don't hit the real
// network during tests. Each test inspects this if needed.
// recharts' ResponsiveContainer observes its parent; jsdom ships no
// ResizeObserver, so any test that mounts a chart needs this stub.
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

beforeEach(() => {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
    })
  );
  // Drop any persisted store between tests so seed runs deterministically.
  localStorage.clear();
  // Reset URL hash so the drawer-via-URL effect doesn't fire.
  window.history.replaceState(null, '', window.location.pathname);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('App smoke', () => {
  it('mounts without throwing and renders the brand', async () => {
    const { default: App } = await import('./App.jsx');
    render(<App />);
    // Brand text appears in the top nav at every render path. Exact-match so
    // this doesn't also pick up the empty-state "Welcome to Catena." heading.
    expect(screen.getByText('Catena')).toBeTruthy();
  });

  it('starts empty and renders the onboarding checklist, not a seeded rollup', async () => {
    const { default: App } = await import('./App.jsx');
    render(<App />);
    // No auto-seed: a first-run store is empty and the welcome panel guides
    // the user through creating their first client / manager / commitment.
    expect(screen.getByText(/Welcome to Catena/i)).toBeTruthy();
    // Exact-match the checklist row; the CTA button also says "add a client".
    expect(screen.getByText('Add a client')).toBeTruthy();
    // OverviewTab's KPI grid must NOT be mounted with nothing to show. Match
    // exactly — ScopeHeader has its own lowercase "Total exposure" readout.
    expect(screen.queryByText('Total Exposure')).toBeNull();
  });

  it('renders the dashboard rollup for a store that already has data', async () => {
    const { seedStore } = await import('./lib/seed.js');
    const { STORE_KEY } = await import('./lib/storage.js');
    localStorage.setItem(STORE_KEY, JSON.stringify(seedStore()));
    const { default: App } = await import('./App.jsx');
    render(<App />);
    // "Total Exposure" is OverviewTab's KPI label — it only appears once the
    // persisted store loaded and computeRollup ran without throwing.
    expect(screen.getAllByText('Total Exposure').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Welcome to Catena/i)).toBeNull();
  });

  it('renders dashboard content for a commitment that has no positions yet', async () => {
    // Regression guard for the create-flow: after adding a client + manager +
    // fund/commitment there are still zero positions, but the commitment KPIs
    // must render rather than being replaced wholesale by the empty state.
    const { STORE_KEY, emptyStore } = await import('./lib/storage.js');
    const store = {
      ...emptyStore(),
      clients: [{ id: 'c1', name: 'Acme Family Office', notes: '' }],
      managers: [{ id: 'm1', name: 'Test Manager', firm: '', type: 'direct' }],
      soIs: [{
        id: 'soi1',
        managerId: 'm1',
        vintage: 'Fund I',
        snapshots: [{
          id: 'soi1_snap', asOfDate: '2026-01-01', notes: '',
          positions: [], subCommitments: [], status: 'finalized',
        }],
      }],
      commitments: [{
        id: 'cm1', clientId: 'c1', managerId: 'm1', soiId: 'soi1',
        committed: 5_000_000, called: 2_000_000, distributions: 0,
        asOfDate: '2026-01-01',
      }],
    };
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
    const { default: App } = await import('./App.jsx');
    render(<App />);
    // Client-scoped economics render off the commitment alone.
    expect(screen.getAllByText('Committed').length).toBeGreaterThan(0);
    // ...and the checklist stays up, because step 4 (positions) isn't done.
    expect(screen.getByText(/Welcome to Catena/i)).toBeTruthy();
  });
});

describe('SettingsDrawer wipe', () => {
  it('resets a client-scoped selection so the header cannot show "Unknown client"', async () => {
    const { SettingsDrawer } = await import('./pages/SettingsDrawer.jsx');
    const { emptyStore } = await import('./lib/storage.js');
    const setSelection = vi.fn();
    const store = {
      ...emptyStore(),
      clients: [{ id: 'c1', name: 'Doomed Client', notes: '' }],
    };
    render(
      <SettingsDrawer
        store={store}
        updateStore={() => {}}
        selection={{ kind: 'client', id: 'c1' }}
        setSelection={setSelection}
        onClose={() => {}}
        onResetSeed={() => {}}
      />
    );
    // Wipe is two-step: the first click arms the confirm, the second commits.
    fireEvent.click(screen.getByText('Wipe'));
    fireEvent.click(screen.getByText('Wipe'));
    expect(setSelection).toHaveBeenCalledWith({ kind: 'firm' });
  });
});

describe('SnapshotEditor smoke', () => {
  it('mounts with a minimal store + soiId and renders the cash row', async () => {
    const { SnapshotEditor } = await import('./pages/SnapshotEditor.jsx');
    const store = {
      managers: [{ id: 'm1', name: 'Test Manager', type: 'direct' }],
      soIs: [{
        id: 'soi1',
        managerId: 'm1',
        vintage: '2024',
        snapshots: [{
          id: 's1',
          asOfDate: '2025-01-01',
          notes: '',
          status: 'finalized',
          subCommitments: [],
          positions: [
            {
              id: 'cash_s1',
              isCashBucket: true,
              positionName: 'Cash',
              ticker: 'USD',
              sectorId: 'cash',
              soiMarketValue: 1_000_000,
              quantity: 0,
            },
            { id: 'p1', positionName: 'Bitcoin', ticker: 'BTC', soiMarketValue: 5_000_000, sectorId: 'base-layer' },
          ],
        }],
      }],
      clients: [],
      commitments: [],
      sectorOverrides: {},
      sectors: [
        { id: 'base-layer', label: 'Base Layer', color: '#22D3C5' },
        { id: 'cash', label: 'Cash', color: '#D4A64F' },
      ],
      settings: {},
    };
    render(
      <SnapshotEditor
        store={store}
        soiId="soi1"
        updateStore={() => {}}
        onClose={() => {}}
        apiKey=""
      />
    );
    // Cash row label and the Save button both visible.
    expect(screen.getAllByText(/Cash/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Save snapshot/i)).toBeTruthy();
  });
});

describe('TokenDetailDrawer smoke', () => {
  it('mounts and renders the loading state for a token with no cgTokenId', async () => {
    const { TokenDetailDrawer } = await import('./components/TokenDetailDrawer.jsx');
    render(
      <TokenDetailDrawer
        token={{ symbol: 'BTC', name: 'Bitcoin', ticker: 'BTC' }}
        onClose={() => {}}
        apiKey=""
        store={{ soIs: [], managers: [], commitments: [] }}
      />
    );
    // Heading shows the token name; without a cgTokenId, the inline error
    // path renders ("This position has no CoinGecko ID linked.").
    expect(screen.getAllByText(/Bitcoin/i).length).toBeGreaterThan(0);
  });
});
