import { AlertCircle, Upload } from 'lucide-react';

import { BG, TEXT_DIM, TEXT_MUTE, ACCENT, RED } from '../lib/theme';
import { fmtCurrency } from '../lib/format';

import { Panel, EditableText } from './ui';

/**
 * Page header showing what the current selection is (firm / client / manager
 * / vintage), the editable client name (when a client is selected), the
 * headline NAV, a price-error banner, and an empty-state CTA when the scope
 * has no positions.
 *
 * Pulled out of App.jsx to keep the main component under the 500-line budget;
 * all rendering is controlled entirely via props so it's a leaf.
 */
export function ScopeHeader({
  selection,
  selectionLabel,
  rollup,
  clientShareMode,
  priceError,
  onRenameClient,
  onImport,
}) {
  return (
    <>
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <div className="text-xs uppercase tracking-wider" style={{ color: TEXT_MUTE }}>
            {selection.kind === 'firm'
              ? 'Firm-wide rollup (all clients, all managers)'
              : selection.kind === 'client'
                ? 'Client portfolio'
                : selection.kind === 'manager'
                  ? 'Manager (all vintages, across clients)'
                  : 'Single fund vintage'}
          </div>
          {selection.kind === 'client' ? (
            <EditableText
              tag="h1"
              className="text-2xl font-semibold mt-0.5"
              style={{ display: 'inline-block', minWidth: 180 }}
              value={selectionLabel}
              placeholder="Name this portfolio…"
              onCommit={(nextName) => { if (nextName) onRenameClient(nextName); }}
            />
          ) : (
            <h1 className="text-2xl font-semibold mt-0.5">{selectionLabel}</h1>
          )}
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wider" style={{ color: TEXT_MUTE }}>Total exposure</div>
          <div className="text-2xl font-semibold">{fmtCurrency(rollup.totalNAV)}</div>
          {clientShareMode && selection?.kind === 'client' && (
            <div className="text-[10px] mt-0.5" style={{ color: TEXT_DIM }}>
              Scaled to client&apos;s pro-rata share of called capital
            </div>
          )}
        </div>
      </div>

      {priceError && (
        <Panel
          className="p-3 mb-4 flex items-center gap-2"
          style={{ borderColor: RED + '66', backgroundColor: RED + '11' }}
        >
          <AlertCircle size={14} style={{ color: RED }} />
          <span className="text-xs" style={{ color: RED }}>{priceError}</span>
        </Panel>
      )}

      {rollup.positionCount === 0 && (
        <Panel className="p-12 text-center">
          <div className="text-sm" style={{ color: TEXT_DIM }}>No positions in this selection yet.</div>
          <button
            onClick={onImport}
            className="mt-4 px-4 py-2 rounded text-xs font-medium inline-flex items-center gap-1.5"
            style={{ backgroundColor: ACCENT, color: BG }}
          >
            <Upload size={12} /> Import a snapshot
          </button>
        </Panel>
      )}
    </>
  );
}
