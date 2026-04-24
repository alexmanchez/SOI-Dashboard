import React, { useCallback, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import _ from 'lodash';
import {
  Upload, FileSpreadsheet, ArrowLeft, Check, X, AlertCircle,
  ChevronDown, ChevronRight,
} from 'lucide-react';

import {
  BG, PANEL, PANEL_2, BORDER, TEXT, TEXT_DIM, TEXT_MUTE,
  ACCENT, ACCENT_2, GREEN, RED, GOLD,
} from '../lib/theme';
import { fmtCurrency, fmtNum, uid, today, fundLabel } from '../lib/format';
import { getSectors } from '../lib/sectors';
import {
  FIELDS, SUBTOTAL_PATTERNS, normalize, parseNum, parseDate,
  autoMapColumns, detectHeaderRow, dedupeHeaders,
} from '../lib/parsing';
import { latestSnapshot } from '../lib/snapshots';

import { Modal, ChoiceCard } from '../components/ui';

export function ImportWizard({ store, updateStore, onClose, onDone, prefillTarget }) {
  // If prefilled (quarterly update), jump straight to upload step and pre-select the target
  const isReplaceMode = !!prefillTarget;
  const prefilledSoi = prefillTarget ? store.soIs.find(s => s.id === prefillTarget.soiId) : null;
  const prefilledManager = prefillTarget ? store.managers.find(m => m.id === prefillTarget.managerId) : null;
  const prefilledClient = prefillTarget
    ? store.commitments.find(c => c.soiId === prefillTarget.soiId)?.clientId
    : null;

  const [mode, setMode] = useState(isReplaceMode ? 'upload' : 'choose'); // choose | upload | manual
  const [step, setStep] = useState(isReplaceMode ? 1 : 1); // 1 file, 2 map, 3 assign
  const [fileName, setFileName] = useState('');
  const [sheetName, setSheetName] = useState('');
  const [sheets, setSheets] = useState({});
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [columnMap, setColumnMap] = useState({});
  const [autoScores, setAutoScores] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Update behavior: 'new' | 'add_snapshot' | 'replace_latest'
  // Only relevant when user selects a manager that already has SOIs
  const [updateBehavior, setUpdateBehavior] = useState(isReplaceMode ? 'replace_latest' : 'new');
  const [replaceTargetSoiId, setReplaceTargetSoiId] = useState(isReplaceMode ? prefillTarget.soiId : '');

  // Assignment fields
  const [assignClientId, setAssignClientId] = useState(prefilledClient || store.clients[0]?.id || '');
  const [newClientName, setNewClientName] = useState('');
  const [assignManagerId, setAssignManagerId] = useState(prefilledManager?.id || '');
  const [newManagerName, setNewManagerName] = useState('');
  const [newManagerType, setNewManagerType] = useState('direct');
  const [vintage, setVintage] = useState(prefilledSoi?.vintage || '');
  const [asOfDate, setAsOfDate] = useState(today());
  const [committed, setCommitted] = useState('');

  // Manual entry state
  const [manualPositions, setManualPositions] = useState([{
    positionName: '', ticker: '', quantity: '', soiMarketValue: '', sectorId: 'infrastructure', acquisitionDate: '', assetType: 'Liquid Token',
  }]);

  const handleFile = async (file) => {
    setLoading(true); setError(''); setFileName(file.name);
    try {
      const ext = file.name.split('.').pop().toLowerCase();
      const out = {};
      if (ext === 'csv') {
        const text = await file.text();
        const parsed = Papa.parse(text, { header: false, dynamicTyping: false, skipEmptyLines: 'greedy' });
        const m = parsed.data; if (!m.length) throw new Error('CSV appears empty.');
        const hi = detectHeaderRow(m);
        const hdrs = dedupeHeaders((m[hi] || []).map(c => String(c ?? '')));
        const dataRows = m.slice(hi + 1).map(arr => { const o = {}; hdrs.forEach((h, i) => { o[h] = arr[i] ?? ''; }); return o; });
        out['Sheet1'] = { headers: hdrs, rows: dataRows };
      } else if (ext === 'xlsx' || ext === 'xls') {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array', cellDates: true });
        for (const name of wb.SheetNames) {
          const sheet = wb.Sheets[name];
          const m = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false, blankrows: false });
          if (!m.length) continue;
          const hi = detectHeaderRow(m);
          const hdrs = dedupeHeaders((m[hi] || []).map(c => String(c ?? '')));
          const dataRows = m.slice(hi + 1).map(arr => { const o = {}; hdrs.forEach((h, i) => { o[h] = arr[i] ?? ''; }); return o; });
          out[name] = { headers: hdrs, rows: dataRows };
        }
      } else throw new Error('Use .xlsx, .xls, or .csv.');
      if (!Object.keys(out).length) throw new Error('No readable sheets.');
      setSheets(out);
      // Auto-pick best-scoring sheet
      let best = Object.keys(out)[0], bestScore = -1;
      for (const n of Object.keys(out)) {
        const { scores } = autoMapColumns(out[n].headers);
        const total = Object.values(scores).reduce((a,b)=>a+b, 0);
        if (total > bestScore) { bestScore = total; best = n; }
      }
      setSheetName(best);
      const s = out[best];
      const { mapping, scores } = autoMapColumns(s.headers);
      setHeaders(s.headers); setRows(s.rows); setColumnMap(mapping); setAutoScores(scores);
      setStep(2);
    } catch (e) { setError(e.message || 'Failed to parse.'); }
    finally { setLoading(false); }
  };

  const switchSheet = (name) => {
    setSheetName(name);
    const s = sheets[name];
    const { mapping, scores } = autoMapColumns(s.headers);
    setHeaders(s.headers); setRows(s.rows); setColumnMap(mapping); setAutoScores(scores);
  };

  const parsedPositions = useMemo(() => {
    if (!columnMap.positionName) return [];
    const out = [];
    for (const row of rows) {
      const name = String(row[columnMap.positionName] ?? '').trim();
      if (!name || SUBTOTAL_PATTERNS.test(name)) continue;
      const qty = columnMap.quantity ? parseNum(row[columnMap.quantity]) : null;
      const price = columnMap.price ? parseNum(row[columnMap.price]) : null;
      let mv = columnMap.marketValue ? parseNum(row[columnMap.marketValue]) : null;
      if ((mv === null || mv === 0) && qty !== null && price !== null) mv = qty * price;
      if (mv === null) continue;
      const ticker = columnMap.ticker ? String(row[columnMap.ticker] ?? '').trim() : '';
      const assetType = columnMap.assetType ? (String(row[columnMap.assetType] ?? '').trim() || 'Unclassified') : 'Unclassified';
      const sector = columnMap.sector ? (String(row[columnMap.sector] ?? '').trim()) : '';
      const cost = columnMap.costBasis ? parseNum(row[columnMap.costBasis]) : null;
      const acq = columnMap.acquisitionDate ? parseDate(row[columnMap.acquisitionDate]) : null;

      // Sector: (1) user's column value mapped to our canonical ids if possible, (2) ticker→default, (3) unclassified
      let sectorId = UNCLASSIFIED.id;
      if (sector) {
        const n = normalize(sector);
        const match = getSectors().find(s => n.includes(s.id) || s.label.toLowerCase().includes(n) || n.includes(s.label.toLowerCase()));
        if (match) sectorId = match.id;
      }
      if (sectorId === UNCLASSIFIED.id && ticker) {
        const sym = ticker.toUpperCase();
        if (DEFAULT_TOKEN_SECTOR[sym]) sectorId = DEFAULT_TOKEN_SECTOR[sym];
      }

      out.push({
        id: uid(),
        positionName: name,
        ticker, quantity: qty, soiPrice: price, costBasis: cost,
        soiMarketValue: mv,
        acquisitionDate: acq ? acq.toISOString().slice(0,10) : null,
        assetType, sectorId,
        forceLiquid: false,
        cgTokenId: null, chain: null, address: null, notes: '',
      });
    }
    return out;
  }, [rows, columnMap]);

  const finalize = () => {
    const positions = mode === 'manual'
      ? manualPositions.filter(p => p.positionName && p.soiMarketValue).map(p => ({
          id: uid(),
          positionName: p.positionName,
          ticker: p.ticker || '',
          quantity: parseNum(p.quantity),
          soiPrice: null,
          costBasis: null,
          soiMarketValue: parseNum(p.soiMarketValue) || 0,
          acquisitionDate: p.acquisitionDate || null,
          assetType: p.assetType || 'Unclassified',
          sectorId: p.sectorId,
          liquidityOverride: 'auto', cgTokenId: null, chain: null, address: null, notes: '',
        }))
      : parsedPositions;

    if (!positions.length) { setError('No valid positions to save.'); return; }

    // ADD SNAPSHOT PATH — add a new snapshot to existing SOI
    if (updateBehavior === 'add_snapshot' && replaceTargetSoiId) {
      const newSnap = { id: uid(), asOfDate: asOfDate || today(), notes: '', positions };
      updateStore(s => ({
        ...s,
        soIs: s.soIs.map(x => x.id !== replaceTargetSoiId ? x : {
          ...x, snapshots: [...snapshotsOf(x), newSnap],
        }),
      }));
      onDone(); return;
    }

    // REPLACE LATEST PATH — overwrite most recent snapshot
    if (updateBehavior === 'replace_latest' && replaceTargetSoiId) {
      const targetSoi = store.soIs.find(s => s.id === replaceTargetSoiId);
      const latestSnapId = latestSnapshot(targetSoi)?.id;
      updateStore(s => ({
        ...s,
        soIs: s.soIs.map(x => x.id !== replaceTargetSoiId ? x : {
          ...x,
          snapshots: snapshotsOf(x).map(snap => snap.id !== latestSnapId ? snap : {
            ...snap, asOfDate: asOfDate || today(), positions,
          }),
        }),
        commitments: s.commitments.map(c => c.soiId !== replaceTargetSoiId ? c : ({
          ...c, called: _.sumBy(positions, 'soiMarketValue'),
        })),
      }));
      onDone(); return;
    }

    // NEW PATH — create a new SOI + commitment
    let nextStore = { ...store };

    let clientId = assignClientId;
    if (clientId === '__new__') {
      clientId = uid();
      nextStore = { ...nextStore, clients: [...nextStore.clients, { id: clientId, name: newClientName || 'New Client', notes: '' }] };
    }
    let managerId = assignManagerId;
    if (managerId === '__new__' || !managerId) {
      managerId = uid();
      nextStore = { ...nextStore, managers: [...nextStore.managers, { id: managerId, name: newManagerName || 'New Manager', firm: '', type: newManagerType || 'direct' }] };
    }

    const soiId = uid();
    const soi = {
      id: soiId, managerId, vintage: vintage || 'Main Fund',
      snapshots: [{ id: uid(), asOfDate: asOfDate || today(), notes: '', positions }],
    };
    const commitment = {
      id: uid(), clientId, managerId, soiId,
      committed: parseNum(committed) || _.sumBy(positions, 'soiMarketValue'),
      called: _.sumBy(positions, 'soiMarketValue'),
      distributions: 0,
    };

    nextStore = {
      ...nextStore,
      soIs: [...nextStore.soIs, soi],
      commitments: [...nextStore.commitments, commitment],
    };
    updateStore(nextStore);
    onDone();
  };

  return (
    <Modal onClose={onClose} title={mode==='choose' ? 'Add fund holdings' : mode==='manual' ? 'Manual entry' : `Import — ${fileName || 'holdings file'}`}>
      {mode === 'choose' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-5">
          <ChoiceCard icon={FileSpreadsheet} title="Upload holdings file" desc="Excel or CSV. We'll auto-detect columns."
            onClick={() => { setMode('upload'); setStep(1); }} />
          <ChoiceCard icon={Edit2} title="Enter manually" desc="Type positions by hand — useful for small books."
            onClick={() => { setMode('manual'); setStep(3); setManualPositions([{ positionName: '', ticker: '', quantity: '', soiMarketValue: '', sectorId: 'infrastructure', acquisitionDate: '', assetType: 'Liquid Token' }]); }} />
        </div>
      )}

      {mode === 'upload' && step === 1 && (
        <div className="p-5">
          <DropZone onFile={handleFile} loading={loading} />
          {error && <div className="mt-3 text-xs" style={{color:RED}}>{error}</div>}
        </div>
      )}

      {mode === 'upload' && step === 2 && (
        <div className="p-5 space-y-4">
          {Object.keys(sheets).length > 1 && (
            <div>
              <label className="text-xs uppercase tracking-wider" style={{color:TEXT_MUTE}}>Sheet</label>
              <select value={sheetName} onChange={e=>switchSheet(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded text-sm outline-none"
                style={{backgroundColor: PANEL_2, color: TEXT, border: `1px solid ${BORDER}`}}>
                {Object.keys(sheets).map(n => <option key={n} value={n}>{n} ({sheets[n].rows.length} rows)</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {Object.entries(FIELDS).map(([field, def]) => (
              <div key={field}>
                <label className="text-xs flex items-center gap-2" style={{color:TEXT_DIM}}>
                  {def.label}
                  {def.required && <span style={{color:RED}}>*</span>}
                  {autoScores[field] && <span className="text-[10px]" style={{color:ACCENT_2}}>auto</span>}
                </label>
                <select value={columnMap[field] || ''} onChange={e=>setColumnMap({...columnMap, [field]: e.target.value})}
                  className="w-full mt-1 px-2 py-1.5 rounded text-sm outline-none"
                  style={{backgroundColor: PANEL_2, color: TEXT, border: `1px solid ${BORDER}`}}>
                  <option value="">— none —</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div className="text-xs p-3 rounded" style={{backgroundColor: PANEL_2, color: TEXT_DIM, border: `1px solid ${BORDER}`}}>
            Detected <strong style={{color:TEXT}}>{parsedPositions.length}</strong> valid position{parsedPositions.length===1?'':'s'}.
            {!columnMap.positionName && <span style={{color:RED}}> Missing Position Name.</span>}
            {!columnMap.marketValue && !(columnMap.quantity && columnMap.price) && <span style={{color:RED}}> Need Market Value OR (Quantity + Price).</span>}
          </div>
          <div className="flex justify-between">
            <button onClick={()=>setStep(1)} className="text-xs px-3 py-1.5 rounded flex items-center gap-1"
              style={{color:TEXT_DIM, border: `1px solid ${BORDER}`}}><ArrowLeft size={12}/> Back</button>
            <button onClick={()=>setStep(3)} disabled={!parsedPositions.length}
              className="text-xs px-4 py-1.5 rounded font-medium"
              style={{backgroundColor: ACCENT, color: BG, opacity: parsedPositions.length?1:0.4}}>
              Continue →
            </button>
          </div>
        </div>
      )}

      {((mode === 'upload' && step === 3) || mode === 'manual') && (
        <div className="p-5 space-y-4">
          {/* Update-vs-new chooser — shown when user picks an existing manager with existing SOIs */}
          {(() => {
            if (isReplaceMode) return null; // coming from "Update holdings" already; no choice
            const existingSois = assignManagerId && assignManagerId !== '__new__'
              ? store.soIs.filter(s => s.managerId === assignManagerId)
              : [];
            if (!existingSois.length) return null;
            const mgr = store.managers.find(m => m.id === assignManagerId);
            return (
              <div className="p-3 rounded" style={{backgroundColor: ACCENT+'11', border: `1px solid ${ACCENT}44`}}>
                <div className="text-xs font-medium mb-2" style={{color: ACCENT_2}}>
                  {mgr?.name} already has {existingSois.length} vintage{existingSois.length===1?'':'s'} in the store.
                </div>
                <div className="space-y-1.5">
                  <label className="flex items-start gap-2 text-xs cursor-pointer">
                    <input type="radio" checked={updateBehavior==='new'} onChange={()=>setUpdateBehavior('new')} />
                    <span>
                      <strong style={{color:TEXT}}>Create new fund/vintage</strong>
                      <span className="ml-1" style={{color:TEXT_DIM}}>— different fund (e.g., Fund V).</span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 text-xs cursor-pointer">
                    <input type="radio" checked={updateBehavior==='add_snapshot'} onChange={()=>setUpdateBehavior('add_snapshot')} />
                    <span>
                      <strong style={{color:TEXT}}>Add as new snapshot</strong>
                      <span className="ml-1" style={{color:TEXT_DIM}}>— newer quarter for an existing fund. Keeps history.</span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 text-xs cursor-pointer">
                    <input type="radio" checked={updateBehavior==='replace_latest'} onChange={()=>setUpdateBehavior('replace_latest')} />
                    <span>
                      <strong style={{color:TEXT}}>Replace latest snapshot</strong>
                      <span className="ml-1" style={{color:TEXT_DIM}}>— overwrite the most recent holdings.</span>
                    </span>
                  </label>
                </div>
                {(updateBehavior === 'add_snapshot' || updateBehavior === 'replace_latest') && (
                  <div className="mt-3">
                    <label className="text-[10px] uppercase tracking-wider" style={{color:TEXT_MUTE}}>Which vintage to target?</label>
                    <select value={replaceTargetSoiId} onChange={e=>setReplaceTargetSoiId(e.target.value)}
                      className="w-full mt-1 px-3 py-2 rounded text-sm outline-none"
                      style={{backgroundColor: PANEL_2, color: TEXT, border: `1px solid ${BORDER}`}}>
                      <option value="">— select —</option>
                      {existingSois.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.vintage} — {snapshotsOf(s).length} snapshot(s), latest {latestSnapshot(s)?.asOfDate || 'no date'}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Replace-mode banner (coming from "Update holdings" on SOI detail) */}
          {isReplaceMode && prefilledSoi && (
            <div className="p-3 rounded" style={{backgroundColor: GOLD+'11', border: `1px solid ${GOLD}44`}}>
              <div className="flex items-center gap-2 text-xs font-medium" style={{color:GOLD}}>
                <RefreshCw size={12} /> Updating holdings
              </div>
              <div className="text-xs mt-1" style={{color:TEXT_DIM}}>
                Replacing <strong style={{color:TEXT}}>{prefilledManager?.name} {prefilledSoi.vintage}</strong>'s latest snapshot
                (as of {latestSnapshot(prefilledSoi)?.asOfDate || '—'}).
                Set the new as-of date below.
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Hide client/manager/vintage/commitment fields in replace mode — they're fixed */}
            {updateBehavior !== 'replace_latest' && updateBehavior !== 'add_snapshot' && (
              <>
            <div>
              <label className="text-xs uppercase tracking-wider" style={{color:TEXT_MUTE}}>Client</label>
              <select value={assignClientId} onChange={e=>setAssignClientId(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded text-sm outline-none"
                style={{backgroundColor: PANEL_2, color: TEXT, border: `1px solid ${BORDER}`}}>
                {store.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                <option value="__new__">+ New client…</option>
              </select>
              {assignClientId === '__new__' && (
                <input value={newClientName} onChange={e=>setNewClientName(e.target.value)} placeholder="Client name"
                  className="w-full mt-2 px-3 py-2 rounded text-sm outline-none"
                  style={{backgroundColor: PANEL_2, color: TEXT, border: `1px solid ${BORDER}`}} />
              )}
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider" style={{color:TEXT_MUTE}}>Manager</label>
              <select value={assignManagerId} onChange={e=>setAssignManagerId(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded text-sm outline-none"
                style={{backgroundColor: PANEL_2, color: TEXT, border: `1px solid ${BORDER}`}}>
                <option value="">— select —</option>
                {store.managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                <option value="__new__">+ New manager…</option>
              </select>
              {(assignManagerId === '__new__' || (!assignManagerId && store.managers.length === 0)) && (
                <>
                  <input value={newManagerName} onChange={e=>setNewManagerName(e.target.value)} placeholder="Manager name (e.g., Dragonfly)"
                    className="w-full mt-2 px-3 py-2 rounded text-sm outline-none"
                    style={{backgroundColor: PANEL_2, color: TEXT, border: `1px solid ${BORDER}`}} />
                  <select value={newManagerType} onChange={e=>setNewManagerType(e.target.value)}
                    className="w-full mt-2 px-3 py-2 rounded text-sm outline-none"
                    style={{backgroundColor: PANEL_2, color: TEXT, border: `1px solid ${BORDER}`}}>
                    <option value="direct">Direct fund manager</option>
                    <option value="fund_of_funds">Fund-of-Funds manager</option>
                  </select>
                </>
              )}
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider" style={{color:TEXT_MUTE}}>Vintage / Fund Name</label>
              <input value={vintage} onChange={e=>setVintage(e.target.value)} placeholder="e.g., Fund III, 2024 Vintage"
                className="w-full mt-1 px-3 py-2 rounded text-sm outline-none"
                style={{backgroundColor: PANEL_2, color: TEXT, border: `1px solid ${BORDER}`}} />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider" style={{color:TEXT_MUTE}}>Client Commitment (USD, optional)</label>
              <input value={committed} onChange={e=>setCommitted(e.target.value)} placeholder="e.g., 25000000"
                className="w-full mt-1 px-3 py-2 rounded text-sm outline-none"
                style={{backgroundColor: PANEL_2, color: TEXT, border: `1px solid ${BORDER}`}} />
              <div className="text-[10px] mt-1" style={{color:TEXT_MUTE}}>Defaults to the sum of position MVs if empty.</div>
            </div>
              </>
            )}
            {/* As-of Date is always shown (new + replace both need it) */}
            <div>
              <label className="text-xs uppercase tracking-wider" style={{color:TEXT_MUTE}}>As-of Date</label>
              <input type="date" value={asOfDate} onChange={e=>setAsOfDate(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded text-sm outline-none"
                style={{backgroundColor: PANEL_2, color: TEXT, border: `1px solid ${BORDER}`}} />
            </div>
          </div>

          {mode === 'manual' && (
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wider" style={{color:TEXT_MUTE}}>Positions</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{color:TEXT_MUTE}}>
                      <th className="text-left px-2 py-1">Name *</th>
                      <th className="text-left px-2 py-1">Ticker</th>
                      <th className="text-right px-2 py-1">Qty</th>
                      <th className="text-right px-2 py-1">Market Value *</th>
                      <th className="text-left px-2 py-1">Sector</th>
                      <th className="text-left px-2 py-1">Acq Date</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {manualPositions.map((p, i) => (
                      <tr key={i}>
                        <td className="px-1 py-1"><input value={p.positionName} onChange={e=>setManualPositions(manualPositions.map((x,j)=>j===i?{...x,positionName:e.target.value}:x))} className="w-full px-2 py-1 rounded text-xs outline-none" style={{backgroundColor: PANEL_2, color: TEXT, border: `1px solid ${BORDER}`}} /></td>
                        <td className="px-1 py-1"><input value={p.ticker} onChange={e=>setManualPositions(manualPositions.map((x,j)=>j===i?{...x,ticker:e.target.value}:x))} className="w-20 px-2 py-1 rounded text-xs outline-none" style={{backgroundColor: PANEL_2, color: TEXT, border: `1px solid ${BORDER}`}} /></td>
                        <td className="px-1 py-1"><input value={p.quantity} onChange={e=>setManualPositions(manualPositions.map((x,j)=>j===i?{...x,quantity:e.target.value}:x))} className="w-24 px-2 py-1 rounded text-xs text-right outline-none tabular-nums" style={{backgroundColor: PANEL_2, color: TEXT, border: `1px solid ${BORDER}`}} /></td>
                        <td className="px-1 py-1"><input value={p.soiMarketValue} onChange={e=>setManualPositions(manualPositions.map((x,j)=>j===i?{...x,soiMarketValue:e.target.value}:x))} className="w-28 px-2 py-1 rounded text-xs text-right outline-none tabular-nums" style={{backgroundColor: PANEL_2, color: TEXT, border: `1px solid ${BORDER}`}} /></td>
                        <td className="px-1 py-1">
                          <select value={p.sectorId} onChange={e=>setManualPositions(manualPositions.map((x,j)=>j===i?{...x,sectorId:e.target.value}:x))}
                            className="px-1 py-1 rounded text-xs outline-none" style={{backgroundColor: PANEL_2, color: TEXT, border: `1px solid ${BORDER}`}}>
                            {getSectors().map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
                            <option value="unclassified">Unclassified</option>
                          </select>
                        </td>
                        <td className="px-1 py-1"><input type="date" value={p.acquisitionDate || ''} onChange={e=>setManualPositions(manualPositions.map((x,j)=>j===i?{...x,acquisitionDate:e.target.value}:x))} className="w-36 px-2 py-1 rounded text-xs outline-none" style={{backgroundColor: PANEL_2, color: TEXT, border: `1px solid ${BORDER}`}} /></td>
                        <td><button onClick={()=>setManualPositions(manualPositions.filter((_,j)=>j!==i))} className="px-1.5 py-1 rounded" style={{color:TEXT_DIM}}><X size={12}/></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button onClick={()=>setManualPositions([...manualPositions, { positionName: '', ticker: '', quantity: '', soiMarketValue: '', sectorId: 'infrastructure', acquisitionDate: '', assetType: 'Liquid Token' }])}
                className="text-xs px-3 py-1.5 rounded flex items-center gap-1"
                style={{color: TEXT_DIM, border: `1px dashed ${BORDER}`}}><Plus size={12}/> Add row</button>
            </div>
          )}

          {mode === 'upload' && parsedPositions.length > 0 && (
            <div className="text-xs p-3 rounded" style={{backgroundColor: PANEL_2, color: TEXT_DIM, border: `1px solid ${BORDER}`}}>
              Ready to save <strong style={{color:TEXT}}>{parsedPositions.length}</strong> positions, total MV <strong style={{color:TEXT}}>{fmtCurrency(_.sumBy(parsedPositions, 'soiMarketValue'))}</strong>.
            </div>
          )}

          {error && <div className="text-xs" style={{color:RED}}>{error}</div>}

          <div className="flex justify-between">
            <button onClick={() => isReplaceMode ? onClose() : (mode === 'upload' ? setStep(2) : setMode('choose'))}
              className="text-xs px-3 py-1.5 rounded flex items-center gap-1"
              style={{color:TEXT_DIM, border: `1px solid ${BORDER}`}}><ArrowLeft size={12}/> {isReplaceMode ? 'Cancel' : 'Back'}</button>
            <button onClick={finalize}
              disabled={
                (mode==='upload' && !parsedPositions.length) ||
                (mode==='manual' && !manualPositions.some(p=>p.positionName && p.soiMarketValue)) ||
                ((updateBehavior === 'replace_latest' || updateBehavior === 'add_snapshot') && !replaceTargetSoiId)
              }
              className="text-xs px-4 py-1.5 rounded font-medium flex items-center gap-1"
              style={{backgroundColor: updateBehavior === 'replace_latest' ? GOLD : ACCENT, color: BG}}>
              <Check size={12} /> {updateBehavior === 'replace_latest' ? 'Replace holdings' : updateBehavior === 'add_snapshot' ? 'Add snapshot' : 'Save to store'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}


export function DropZone({ onFile, loading }) {
  const ref = useRef(null);
  return (
    <div onDragOver={e=>{e.preventDefault();}} onDrop={e=>{e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFile(f);}}
      onClick={()=>ref.current?.click()}
      className="p-10 rounded-lg text-center cursor-pointer transition-colors"
      style={{border: `2px dashed ${BORDER}`, backgroundColor: PANEL_2}}>
      <Upload size={28} style={{color:ACCENT}} className="mx-auto" />
      <div className="mt-3 text-sm font-medium">{loading ? 'Parsing…' : 'Drop a holdings file here or click to browse'}</div>
      <div className="text-xs mt-1" style={{color:TEXT_DIM}}>.xlsx, .xls, or .csv — processed entirely in your browser</div>
      <input ref={ref} type="file" accept=".xlsx,.xls,.csv" className="hidden"
        onChange={e=>{const f = e.target.files?.[0]; if (f) onFile(f);}} />
    </div>
  );
}

