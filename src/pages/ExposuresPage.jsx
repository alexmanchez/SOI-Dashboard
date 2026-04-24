import React from 'react';

import {
  FullSectorTiltPanel, LiquidityBreakdownPanel, FullTopHoldingsTable,
  CompactManagerBreakdown,
} from '../components/DashboardPanels';

export function ExposuresPage({ rollup, selection }) {
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

