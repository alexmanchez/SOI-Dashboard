/* @vitest-environment jsdom */
//
// Smoke tests — mount each critical render path and confirm no crash.
// Not exhaustive: these only catch "did it render at all" regressions
// (broken imports, undeclared refs, throw-on-mount bugs). Component-level
// behavior is covered by the unit tests in lib/.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

// Mock fetch globally so async fetches in components don't hit the real
// network during tests. Each test inspects this if needed.
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
    // Brand text appears in the top nav at every render path.
    expect(screen.getByText(/Catena/i)).toBeTruthy();
  });

  it('seeds and renders the dashboard rollup', async () => {
    const { default: App } = await import('./App.jsx');
    render(<App />);
    // The rollup pane renders KPI labels — these only appear once the seed
    // has loaded and computeRollup has run, so "Total Exposure" is a good
    // signal that the full mount path completed without throwing.
    expect(screen.getAllByText(/Total Exposure/i).length).toBeGreaterThan(0);
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
