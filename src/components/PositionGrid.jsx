import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Layers, Plus, Trash2 } from 'lucide-react';
import _ from 'lodash';

import {
  PANEL, PANEL_2, BORDER, TEXT, TEXT_DIM, TEXT_MUTE,
  ACCENT, GREEN, RED, GOLD, BG,
} from '../lib/theme';
import { fmtCurrency, fmtPct, fmtMoic } from '../lib/format';
import { getSectors, sectorOf } from '../lib/sectors';
import { parseNum } from '../lib/parsing';
import { isCashBucket } from '../lib/snapshotDraft';

import { Panel, SortHead } from './ui';

const VALUATION_METHOD_OPTIONS = [
  { value: '', label: '—' },
  { value: 'last_round', label: 'Last round' },
  { value: 'mark_to_market', label: 'Mark to market' },
  { value: 'gp_discretion', label: 'GP discretion' },
  { value: 'cost', label: 'Cost' },
];

/* Column spec. `get` pulls a value off an enriched position; `set` is the
   field name on the raw position we commit via onField (omitted for
   computed / non-editable columns). */
const COLUMNS = [
  { id: 'positionName',   label: 'Position',   type: 'text',    align: 'left',  minWidth: 170, editable: true,
    get: (p) => p.positionName, set: 'positionName' },
  { id: 'ticker',          label: 'Ticker',    type: 'text',    align: 'left',  minWidth: 80,  editable: true,
    get: (p) => p.ticker || '', set: 'ticker', transform: (v) => (v || '').toUpperCase() },
  { id: 'sectorId',        label: 'Sector',    type: 'sector',  align: 'left',  minWidth: 140, editable: true,
    get: (p) => p.sectorId || 'unclassified', set: 'sectorId' },
  { id: 'quantity',        label: 'Qty',       type: 'number',  align: 'right', minWidth: 90,  editable: true,
    get: (p) => p.quantity, set: 'quantity',
    fmt: (v) => (v == null ? '—' : v.toLocaleString(undefined, { maximumFractionDigits: 2 })) },
  { id: 'soiPrice',        label: 'Snap Px',   type: 'number',  align: 'right', minWidth: 90,  editable: true,
    get: (p) => p.soiPrice, set: 'soiPrice',
    fmt: (v) => (v == null ? '—' : '$' + v.toLocaleString(undefined, { maximumFractionDigits: 4 })) },
  { id: 'costBasis',       label: 'Cost',      type: 'number',  align: 'right', minWidth: 100, editable: true,
    get: (p) => p.costBasis, set: 'costBasis',
    fmt: (v) => (v == null ? '—' : fmtCurrency(v)) },
  { id: 'soiMarketValue',  label: 'Value',     type: 'number',  align: 'right', minWidth: 110, editable: true,
    get: (p) => p.soiMarketValue, set: 'soiMarketValue',
    fmt: (v) => (v == null ? '—' : fmtCurrency(v)) },
  { id: 'unrealizedMoic',  label: 'MOIC',      type: 'computed',align: 'right', minWidth: 70,  editable: false,
    get: (p) => (p.costBasis && p.costBasis > 0 ? (p.currentValue ?? p.soiMarketValue ?? 0) / p.costBasis : null),
    fmt: (v) => fmtMoic(v) },
  { id: 'pctOfNav',        label: '% NAV',     type: 'computed',align: 'right', minWidth: 70,  editable: false,
    get: (p, _totals, total) => (total > 0 ? ((p.currentValue ?? p.soiMarketValue ?? 0) / total) * 100 : 0),
    fmt: (v) => fmtPct(v, 2) },
  { id: 'acquisitionDate', label: 'Acq',       type: 'date',    align: 'left',  minWidth: 130, editable: true,
    get: (p) => (p.acquisitionDate ? String(p.acquisitionDate).slice(0, 10) : ''), set: 'acquisitionDate' },
  { id: 'lockup',          label: 'Lockup',    type: 'text',    align: 'left',  minWidth: 160, editable: true,
    get: (p) => p.lockup || '', set: 'lockup' },
  { id: 'valuationMethod', label: 'Val method',type: 'select',  align: 'left',  minWidth: 130, editable: true,
    get: (p) => p.valuationMethod || '', set: 'valuationMethod', options: VALUATION_METHOD_OPTIONS },
  { id: 'liquidity',       label: 'Liq',       type: 'liquidity',align:'right', minWidth: 85,  editable: false,
    get: (p) => p.liquid },
  { id: 'notes',           label: 'Notes',     type: 'text',    align: 'left',  minWidth: 180, editable: true,
    get: (p) => p.notes || '', set: 'notes' },
];

/**
 * Spreadsheet-style position editor for a single SOI snapshot.
 *
 * Navigation (view mode): sort + read-only.
 * Navigation (edit mode):
 *   - click cell: focus; double-click / F2 / typing: enter edit mode
 *   - Tab / Shift+Tab: commit + move right / left (wraps rows)
 *   - Enter: commit + move down; Shift+Enter: commit + add row below, focus its first cell
 *   - Escape (while editing): revert + exit edit mode
 *   - Arrow keys (while focused, not editing): move focus
 */
export function PositionGrid({
  positions,
  editMode,
  onToggleEdit,
  onField,
  onDelete,
  onAdd,
  onCycleLiquidity,
  totalNAV,
  headerExtras,
}) {
  const [sortBy, setSortBy] = useState('soiMarketValue');
  const [sortDir, setSortDir] = useState('desc');
  const [focus, setFocus] = useState(null);     // { rowId, colId }
  const [editing, setEditing] = useState(null); // { rowId, colId }
  const [draft, setDraft] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [groupBySector, setGroupBySector] = useState(false);
  const inputRef = useRef(null);
  const gridRef = useRef(null);

  // Sort positions by the user's chosen column. The "sorted" list is the
  // basic sort; when grouping is on the navigable list (`navList`) regroups
  // these so Tab order matches visual order.
  const sorted = useMemo(() => {
    const col = COLUMNS.find((c) => c.id === sortBy);
    const keyFn = col && col.get ? (p) => col.get(p, null, totalNAV) : (p) => p[sortBy];
    return _.orderBy(positions, [(p) => {
      const v = keyFn(p);
      if (v == null) return sortDir === 'asc' ? Infinity : -Infinity;
      return v;
    }], [sortDir]);
  }, [positions, sortBy, sortDir, totalNAV]);

  // Group rows by sector, sort sectors by aggregate value desc, cash bucket
  // pinned at the head. Used for both rendering (with section headers) and
  // navigation (flat order). Each group includes a `total` for the summary.
  const grouped = useMemo(() => {
    if (!groupBySector) return null;
    const cash = sorted.filter(isCashBucket);
    const nonCash = sorted.filter((p) => !isCashBucket(p));
    const byId = {};
    for (const r of nonCash) {
      const id = r.sectorId || 'unclassified';
      if (!byId[id]) byId[id] = { id, rows: [], total: 0 };
      byId[id].rows.push(r);
      byId[id].total += r.soiMarketValue || 0;
    }
    const groups = Object.values(byId)
      .map((g) => ({ ...g, sectorObj: sectorOf(g.id) }))
      .sort((a, b) => b.total - a.total);
    return { cash, groups };
  }, [sorted, groupBySector]);

  // Flat navigation list — keyboard Tab order. When grouping is on, this
  // reflects the visual top-to-bottom order (cash first, then each group's
  // rows in sequence). When off, it's just the sorted list as-is. Group
  // headers are not in this list, so navigation naturally skips them.
  const navList = useMemo(() => {
    if (!groupBySector || !grouped) return sorted;
    return [...grouped.cash, ...grouped.groups.flatMap((g) => g.rows)];
  }, [sorted, groupBySector, grouped]);

  const editableCols = COLUMNS.filter((c) => c.editable);

  const toggleSort = (col) => {
    if (sortBy === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
  };

  /* Commit the draft back to the store. Returns `true` if committed (or
     no-op because the value didn't change), `false` if invalid. */
  const commit = () => {
    if (!editing) return true;
    const col = COLUMNS.find((c) => c.id === editing.colId);
    if (!col || !col.editable || !col.set) return true;
    let value;
    if (col.type === 'number') {
      const trimmed = draft.trim();
      if (trimmed === '') {
        value = null;
      } else {
        const n = parseNum(trimmed);
        if (n == null) {
          setInvalid(true);
          return false;
        }
        value = n;
      }
    } else if (col.type === 'date') {
      value = draft.trim() || null;
    } else if (col.type === 'text') {
      const v = col.transform ? col.transform(draft) : draft;
      value = v.trim();
    } else {
      value = draft;
    }
    onField(editing.rowId, col.set, value);
    setEditing(null);
    setDraft('');
    setInvalid(false);
    return true;
  };

  const cancel = () => {
    setEditing(null);
    setDraft('');
    setInvalid(false);
  };

  const beginEdit = (rowId, colId) => {
    const col = COLUMNS.find((c) => c.id === colId);
    if (!col || !col.editable) return;
    const pos = navList.find((p) => p.id === rowId);
    if (!pos) return;
    const rawVal = col.get(pos);
    setEditing({ rowId, colId });
    setDraft(rawVal == null ? '' : String(rawVal));
    setInvalid(false);
    // Focus the input on next tick.
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const moveFocus = (rowId, colId, dx, dy, { commit: shouldCommit = true } = {}) => {
    if (shouldCommit && editing) {
      if (!commit()) return;
    }
    // navList drives Tab order so that, when grouping is on, the user moves
    // from the last cell of group A's last row directly into the first cell
    // of group B's first row — group headers aren't in this list, so they're
    // naturally skipped.
    const rowIdx = navList.findIndex((p) => p.id === rowId);
    const visibleCols = editableCols;
    const colIdx = visibleCols.findIndex((c) => c.id === colId);
    let nextRow = rowIdx + dy;
    let nextCol = colIdx + dx;
    // Wrap columns; bump row when wrapping.
    while (nextCol >= visibleCols.length) {
      nextCol -= visibleCols.length;
      nextRow += 1;
    }
    while (nextCol < 0) {
      nextCol += visibleCols.length;
      nextRow -= 1;
    }
    if (nextRow < 0 || nextRow >= navList.length) return;
    const nextColId = visibleCols[nextCol].id;
    const nextRowId = navList[nextRow].id;
    setFocus({ rowId: nextRowId, colId: nextColId });
  };

  /* React to Edit mode turning off — commit any pending edit. */
  useEffect(() => {
    if (!editMode && editing) {
      commit();
      setFocus(null);
    }
  }, [editMode]);

  /* Grid-level keyboard handler. Placed on the wrapper so we capture
     events even before a cell input is focused. */
  const handleKeyDown = (e) => {
    if (!editMode) return;
    if (!focus) return;

    // While editing — only handle commit/cancel keys; let the input keep typing.
    if (editing) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (commit()) moveFocus(focus.rowId, focus.colId, 0, 1, { commit: false });
        return;
      }
      if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        if (commit()) {
          const newId = onAdd();
          if (newId) setFocus({ rowId: newId, colId: editableCols[0].id });
        }
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        if (commit()) moveFocus(focus.rowId, focus.colId, e.shiftKey ? -1 : 1, 0, { commit: false });
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
        return;
      }
      return;
    }

    // Not editing — arrow navigation, enter-to-edit, etc.
    if (e.key === 'Tab') {
      e.preventDefault();
      moveFocus(focus.rowId, focus.colId, e.shiftKey ? -1 : 1, 0);
      return;
    }
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      const newId = onAdd();
      if (newId) setFocus({ rowId: newId, colId: editableCols[0].id });
      return;
    }
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      moveFocus(focus.rowId, focus.colId, 0, 1);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveFocus(focus.rowId, focus.colId, 0, -1);
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      moveFocus(focus.rowId, focus.colId, -1, 0);
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      moveFocus(focus.rowId, focus.colId, 1, 0);
      return;
    }
    if (e.key === 'F2') {
      e.preventDefault();
      beginEdit(focus.rowId, focus.colId);
      return;
    }
    // Typeable chars → start editing with the character.
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      beginEdit(focus.rowId, focus.colId);
      setDraft(e.key);
    }
  };

  const headerRow = (
    <tr
      style={{
        color: TEXT_MUTE, fontSize: 11, textTransform: 'uppercase',
        letterSpacing: '0.05em', borderBottom: `1px solid ${BORDER}`,
      }}
    >
      {COLUMNS.map((c) => (
        <SortHead
          key={c.id}
          col={c.id}
          by={sortBy}
          dir={sortDir}
          onClick={toggleSort}
          align={c.align}
        >
          {c.label}
        </SortHead>
      ))}
      {editMode && <th />}
    </tr>
  );

  const renderCell = (p, col) => {
    const rawVal = col.get(p, null, totalNAV);
    const isFocused = focus && focus.rowId === p.id && focus.colId === col.id;
    const isEditing = editing && editing.rowId === p.id && editing.colId === col.id;
    const baseTd = {
      padding: '8px 12px',
      textAlign: col.align,
      borderBottom: `1px solid ${BORDER}`,
      borderRight: isFocused && editMode ? `2px solid ${ACCENT}` : 'none',
      backgroundColor: isFocused && editMode ? ACCENT + '11' : 'transparent',
      cursor: editMode && col.editable ? 'cell' : 'default',
      whiteSpace: 'nowrap',
      fontFamily: col.type === 'number' || col.type === 'computed' ? 'inherit' : undefined,
    };
    const tdCls = col.type === 'number' || col.type === 'computed' ? 'tabular-nums' : '';
    const td = (inner) => (
      <td
        key={col.id}
        className={tdCls}
        style={baseTd}
        onClick={() => {
          if (!editMode) return;
          setFocus({ rowId: p.id, colId: col.id });
          if (editing && !isEditing) commit();
        }}
        onDoubleClick={() => {
          if (!editMode) return;
          if (col.editable) beginEdit(p.id, col.id);
        }}
      >
        {inner}
      </td>
    );

    if (isEditing) {
      if (col.type === 'sector') {
        return td(
          <select
            ref={inputRef}
            value={draft}
            onChange={(e) => { onField(p.id, col.set, e.target.value); setEditing(null); setDraft(''); }}
            onBlur={() => { setEditing(null); setDraft(''); }}
            style={editInputStyle(col)}
          >
            {getSectors().map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            <option value="unclassified">Unclassified</option>
          </select>
        );
      }
      if (col.type === 'select') {
        return td(
          <select
            ref={inputRef}
            value={draft}
            onChange={(e) => { onField(p.id, col.set, e.target.value); setEditing(null); setDraft(''); }}
            onBlur={() => { setEditing(null); setDraft(''); }}
            style={editInputStyle(col)}
          >
            {col.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        );
      }
      const inputType = col.type === 'date' ? 'date' : col.type === 'number' ? 'text' : 'text';
      return td(
        <input
          ref={inputRef}
          type={inputType}
          inputMode={col.type === 'number' ? 'decimal' : undefined}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setInvalid(false);
          }}
          onBlur={() => commit()}
          style={{
            ...editInputStyle(col),
            borderColor: invalid ? RED : ACCENT,
            textAlign: col.align,
          }}
        />
      );
    }

    // Non-editing display for this cell.
    let inner;
    if (col.type === 'sector') {
      const s = sectorOf(rawVal);
      inner = (
        <span
          className="text-[10px] font-medium rounded px-1.5 py-0.5"
          style={{ backgroundColor: s.color + '22', color: s.color, border: `1px solid ${s.color}44` }}
        >
          {s.label}
        </span>
      );
    } else if (col.type === 'liquidity') {
      inner = (
        <button
          onClick={() => onCycleLiquidity(p.id)}
          className="text-[10px] px-1.5 py-0.5 rounded inline-flex items-center gap-1"
          style={{
            backgroundColor: p.liquid ? GREEN + '22' : GOLD + '22',
            color: p.liquid ? GREEN : GOLD,
            border: `1px solid ${p.liquid ? GREEN + '44' : GOLD + '44'}`,
          }}
        >
          {p.liquid ? 'Liquid' : 'Illiquid'}
        </button>
      );
    } else if (col.type === 'computed') {
      inner = <span style={{ color: TEXT_DIM }}>{col.fmt(rawVal)}</span>;
    } else if (col.type === 'select') {
      const opt = col.options.find((o) => o.value === rawVal);
      inner = <span style={{ color: rawVal ? TEXT : TEXT_MUTE }}>{opt?.label || '—'}</span>;
    } else if (col.fmt) {
      const formatted = col.fmt(rawVal);
      inner = <span style={{ color: rawVal == null ? TEXT_MUTE : undefined }}>{formatted}</span>;
    } else if (rawVal === '' || rawVal == null) {
      inner = <span style={{ color: TEXT_MUTE }}>—</span>;
    } else {
      inner = <span>{rawVal}</span>;
    }
    return td(inner);
  };

  return (
    <Panel className="p-0 overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: `1px solid ${BORDER}` }}
      >
        <div className="flex items-center gap-3">
          <div className="text-sm font-semibold">Positions</div>
          <div className="text-[10px]" style={{ color: TEXT_MUTE }}>
            {positions.length} rows
          </div>
        </div>
        <div className="flex items-center gap-2">
          {headerExtras}
          <button
            onClick={() => setGroupBySector((g) => !g)}
            className="text-xs px-2 py-1 rounded flex items-center gap-1"
            style={{
              backgroundColor: groupBySector ? GOLD + '22' : 'transparent',
              color: groupBySector ? GOLD : TEXT_DIM,
              border: `1px solid ${groupBySector ? GOLD + '44' : BORDER}`,
            }}
            title="Group rows by sector"
          >
            <Layers size={12} /> {groupBySector ? 'Grouped' : 'Group by sector'}
          </button>
          <button
            onClick={() => onToggleEdit(!editMode)}
            className="text-xs px-3 py-1.5 rounded font-medium flex items-center gap-1"
            style={{
              backgroundColor: editMode ? ACCENT : PANEL_2,
              color: editMode ? BG : TEXT,
              border: `1px solid ${editMode ? ACCENT : BORDER}`,
              fontWeight: 600,
            }}
          >
            {editMode ? 'Done editing' : 'Edit'}
          </button>
          {editMode && (
            <button
              onClick={() => {
                const newId = onAdd();
                if (newId) setFocus({ rowId: newId, colId: editableCols[0].id });
              }}
              className="text-xs px-3 py-1.5 rounded font-medium flex items-center gap-1"
              style={{ backgroundColor: ACCENT, color: BG }}
            >
              <Plus size={12} /> Add position
            </button>
          )}
        </div>
      </div>

      <div
        className="overflow-x-auto"
        ref={gridRef}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <table className="w-full text-sm" style={{ backgroundColor: PANEL }}>
          <thead>{headerRow}</thead>
          <tbody>
            {/* Flat (ungrouped) rendering — original layout. */}
            {!groupBySector && sorted.map((p) => renderPositionRow(p, {
              renderCell, editMode, onDelete, COLUMNS,
            }))}

            {/* Grouped rendering — cash bucket pinned at the head, then a
                section per sector with a non-editable summary header row,
                position rows, and (in editMode) a per-group "Add asset"
                row at the bottom of the group (Cambridge UX). */}
            {groupBySector && grouped && grouped.cash.map((p) => renderPositionRow(p, {
              renderCell, editMode, onDelete, COLUMNS,
            }))}
            {groupBySector && grouped && grouped.groups.map((g) => (
              <Fragment key={g.id}>
                <tr style={{
                  backgroundColor: g.sectorObj.color + '11',
                  borderTop: `2px solid ${g.sectorObj.color}55`,
                  borderBottom: `1px solid ${BORDER}`,
                }}>
                  <td className="px-3 py-2" colSpan={3}>
                    <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: g.sectorObj.color }}>
                      {g.sectorObj.label}
                    </span>
                    <span className="text-[10px] ml-2" style={{ color: TEXT_MUTE }}>
                      {g.rows.length} {g.rows.length === 1 ? 'position' : 'positions'}
                    </span>
                  </td>
                  <td colSpan={3} />
                  <td className="px-3 py-2 text-right tabular-nums font-medium" style={{ color: TEXT }}>
                    {fmtCurrency(g.total)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums" style={{ color: TEXT_DIM }}>
                    {totalNAV > 0 ? fmtPct((g.total / totalNAV) * 100, 2) : '—'}
                  </td>
                  <td colSpan={COLUMNS.length - 8 + (editMode ? 1 : 0)} />
                </tr>
                {g.rows.map((p) => renderPositionRow(p, {
                  renderCell, editMode, onDelete, COLUMNS,
                }))}
                {editMode && (
                  <tr>
                    <td colSpan={COLUMNS.length + 1} className="px-3 py-2" style={{ borderBottom: `1px solid ${BORDER}` }}>
                      <button
                        onClick={() => {
                          const newId = onAdd(g.id);
                          if (newId) setFocus({ rowId: newId, colId: editableCols[0].id });
                        }}
                        className="text-[11px] px-2 py-0.5 rounded inline-flex items-center gap-1"
                        style={{ color: g.sectorObj.color, border: `1px solid ${g.sectorObj.color}44` }}
                        title={`Add a position to ${g.sectorObj.label}`}
                      >
                        <Plus size={10} /> Add asset to {g.sectorObj.label}
                      </button>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}

            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={COLUMNS.length + (editMode ? 1 : 0)}
                  className="px-4 py-8 text-center text-xs"
                  style={{ color: TEXT_DIM }}
                >
                  No positions yet.
                  {editMode && (
                    <>
                      {' '}
                      <button
                        onClick={() => {
                          const newId = onAdd();
                          if (newId) setFocus({ rowId: newId, colId: editableCols[0].id });
                        }}
                        className="underline"
                        style={{ color: ACCENT }}
                      >
                        Add your first row
                      </button>
                      .
                    </>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {sorted.some((p) => p.hasLivePrice) && (
        <div
          className="px-4 py-2 text-[10px] flex items-center gap-2"
          style={{ color: TEXT_MUTE, borderTop: `1px solid ${BORDER}` }}
        >
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, backgroundColor: ACCENT + '33', border: `1px solid ${ACCENT}55` }} />
          Tinted rows use live prices — MOIC and % NAV are simulated; Snap Px / Cost / Value remain manager-marked from the snapshot.
        </div>
      )}
      {editMode && (
        <div
          className="px-4 py-2 text-[10px]"
          style={{ color: TEXT_MUTE, borderTop: `1px solid ${BORDER}` }}
        >
          Tab / Shift+Tab move across columns · Enter moves down · Shift+Enter adds a row · Escape cancels · F2 / double-click to edit
        </div>
      )}
    </Panel>
  );
}

function editInputStyle(col) {
  return {
    background: PANEL_2,
    border: `1.5px solid ${ACCENT}`,
    borderRadius: 3,
    padding: '2px 6px',
    color: TEXT,
    font: 'inherit',
    width: '100%',
    minWidth: col.minWidth,
    outline: 'none',
  };
}

/* One row's <tr>. Extracted so flat and grouped tbody paths share the same
   markup (live-price tint + per-row delete button when editing). */
function renderPositionRow(p, { renderCell, editMode, onDelete, COLUMNS }) {
  return (
    <tr
      key={p.id}
      style={{
        // Subtle accent tint when this row's current value is computed from
        // a live price (simulated) rather than the snapshot's recorded
        // soiMarketValue (manager-marked). MOIC and % NAV use live-derived
        // current values when available.
        backgroundColor: p.hasLivePrice ? ACCENT + '0c' : 'transparent',
      }}
      title={p.hasLivePrice
        ? 'Simulated · MOIC and % NAV computed from live price for this token. Snapshot values (Snap Px / Cost / Value) remain manager-marked.'
        : 'Manager-marked · all values from this snapshot.'}
    >
      {COLUMNS.map((col) => renderCell(p, col))}
      {editMode && (
        <td className="px-3 py-2 text-right" style={{ borderBottom: `1px solid ${BORDER}` }}>
          <button
            onClick={() => {
              if (window.confirm(`Delete position "${p.positionName}"?`)) onDelete(p.id);
            }}
            className="p-1 rounded"
            style={{ color: TEXT_DIM }}
            title="Delete row"
          >
            <Trash2 size={12} />
          </button>
        </td>
      )}
    </tr>
  );
}
