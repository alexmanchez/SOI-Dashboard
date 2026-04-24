import React, { useEffect, useMemo, useState } from 'react';
import _ from 'lodash';
import {
  X, Plus, Edit2, Check, Trash2, Upload, Download, Eye, EyeOff,
  RefreshCw, AlertCircle, Calendar, ChevronDown,
  Building2, Users, Briefcase,
} from 'lucide-react';

import {
  BG, PANEL, PANEL_2, BORDER, TEXT, TEXT_DIM, TEXT_MUTE,
  ACCENT, ACCENT_2, GREEN, RED, GOLD, VIOLET,
} from '../lib/theme';
import {
  fmtCurrency, fmtPct, fmtPctSigned, fmtNum, fundLabel, uid, today,
} from '../lib/format';
import {
  DEFAULT_SECTORS, DEFAULT_TOKEN_SECTOR, UNCLASSIFIED, getSectors, sectorOf,
} from '../lib/sectors';
import { STORE_KEY, emptyStore, loadStore, saveStore } from '../lib/storage';
import { seedStore } from '../lib/seed';
import { snapshotsOf, latestSnapshot } from '../lib/snapshots';

import { Panel, Pill, EditableText, SectorBadge } from '../components/ui';

export function SettingsDrawer({ store, updateStore, selection, setSelection, onClose, onResetSeed }) {
  const managerById = useMemo(() => Object.fromEntries(store.managers.map(m => [m.id, m])), [store.managers]);

  const renameClient = (id, name) => updateStore(s => ({
    ...s, clients: s.clients.map(c => c.id === id ? { ...c, name } : c),
  }));
  const deleteClient = (id) => {
    updateStore(s => ({
      ...s,
      clients: s.clients.filter(c => c.id !== id),
      commitments: s.commitments.filter(c => c.clientId !== id),
    }));
    if (selection?.kind === 'client' && selection.id === id) setSelection({ kind: 'firm' });
  };

  const renameManager = (id, name) => updateStore(s => ({
    ...s, managers: s.managers.map(m => m.id === id ? { ...m, name } : m),
  }));
  const deleteManager = (id) => {
    const killedSoiIds = new Set(store.soIs.filter(x => x.managerId === id).map(x => x.id));
    updateStore(s => ({
      ...s,
      managers: s.managers.filter(m => m.id !== id),
      soIs: s.soIs.filter(x => x.managerId !== id),
      commitments: s.commitments.filter(c => c.managerId !== id && !killedSoiIds.has(c.soiId)),
    }));
    if (selection?.kind === 'manager' && selection.id === id) setSelection({ kind: 'firm' });
    if (selection?.kind === 'vintage' && killedSoiIds.has(selection.id)) setSelection({ kind: 'firm' });
  };

  const renameSOI = (id, vintage) => updateStore(s => ({
    ...s, soIs: s.soIs.map(x => x.id === id ? { ...x, vintage } : x),
  }));
  const deleteSOI = (id) => {
    updateStore(s => ({
      ...s,
      soIs: s.soIs.filter(x => x.id !== id),
      commitments: s.commitments.filter(c => c.soiId !== id),
    }));
    if (selection?.kind === 'vintage' && selection.id === id) setSelection({ kind: 'firm' });
  };

  const [apiKey, setApiKey] = useState(store.settings.cgApiKey || '');
  const [showKey, setShowKey] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [confirmingWipe, setConfirmingWipe] = useState(false);

  const saveKey = () => {
    updateStore(s => ({ ...s, settings: { ...s.settings, cgApiKey: apiKey.trim() } }));
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(store, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `catena-export-${today()}.json`;
    a.click(); URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const feRows = store.commitments.map(c => {
      const client = store.clients.find(x => x.id === c.clientId);
      const mgr = store.managers.find(x => x.id === c.managerId);
      const soi = store.soIs.find(x => x.id === c.soiId);
      // TODO: live-price-aware NAV; for now use SOI marked values (consistent with persisted store)
      const nav = _.sumBy(latestSnapshot(soi)?.positions || [], p => p.soiMarketValue || 0);
      const committed = c.committed || 0;
      const called = c.called || 0;
      const distributions = c.distributions || 0;
      return {
        'Client': client?.name || '',
        'Manager': mgr?.name || '',
        'Vintage': soi?.vintage || '',
        'Committed': committed,
        'Called': called,
        'Uncalled': committed - called,
        'Distributions': distributions,
        '% Invested': committed > 0 ? called / committed : 0,
        'Current NAV': nav,
        'Fund NAV (unscaled)': nav,
        'Client NAV (scaled)': nav > 0 ? (called / nav) * nav : nav,
        'Client Share %': nav > 0 ? (called / nav) * 100 : 0,
        'Unrealized MOIC': called > 0 ? nav / called : 0,
        'Realized MOIC': called > 0 ? distributions / called : 0,
        'TVPI': called > 0 ? (nav + distributions) / called : 0,
      };
    });
    const ws = XLSX.utils.json_to_sheet(feRows);
    XLSX.utils.book_append_sheet(wb, ws, 'Fund Economics');

    // FoF Commitments sheet — sub-commitments from all fund-of-funds managers
    const fofManagers = store.managers.filter(m => m.type === 'fund_of_funds');
    if (fofManagers.length > 0) {
      const fofRows = [];
      for (const fofMgr of fofManagers) {
        const fofSois = store.soIs.filter(s => s.managerId === fofMgr.id);
        for (const fofSoi of fofSois) {
          const snap = latestSnapshot(fofSoi);
          for (const sub of (snap?.subCommitments || [])) {
            const targetSoi = store.soIs.find(s => s.id === sub.toSoiId);
            const targetMgr = targetSoi ? store.managers.find(m => m.id === targetSoi.managerId) : null;
            const underlyingMV = _.sumBy(latestSnapshot(targetSoi)?.positions || [], p => p.soiMarketValue || 0);
            fofRows.push({
              'FoF Manager': fofMgr.name,
              'FoF Fund': fofSoi.vintage,
              'As-of Date': snap?.asOfDate || '',
              'Underlying Manager': targetMgr?.name || '?',
              'Underlying Fund': targetSoi?.vintage || '?',
              'Committed': sub.committed || 0,
              'Called': sub.called || 0,
              'Distributions': sub.distributions || 0,
              'Underlying NAV': underlyingMV,
              'FoF Share %': underlyingMV > 0 ? (sub.called || 0) / underlyingMV : 0,
            });
          }
        }
      }
      if (fofRows.length > 0) {
        const wsFof = XLSX.utils.json_to_sheet(fofRows);
        XLSX.utils.book_append_sheet(wb, wsFof, 'FoF Commitments');
      }
    }

    XLSX.writeFile(wb, `catena-export-${today()}.xlsx`);
  };

  const importJSON = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed.clients || !parsed.managers || !parsed.soIs) throw new Error('Invalid file');
        updateStore(parsed);
        onClose();
      } catch (e) { alert('Invalid Catena export file.'); }
    };
    reader.readAsText(file);
  };

  const wipe = () => {
    updateStore(emptyStore());
    onClose();
  };

  return (
    <Modal title="Settings" onClose={onClose}>
      <div className="p-5 space-y-6">
        {/* API Key — now usually unused because the app ships with an embedded key.
            Left in as an optional override for debugging / a different key without a rebuild. */}
        <div>
          <div className="text-xs uppercase tracking-wider mb-2" style={{color:TEXT_MUTE}}>
            CoinGecko Demo API Key
            {EMBEDDED_CG_API_KEY && (
              <span className="ml-2 normal-case tracking-normal" style={{color: ACCENT_2}}>
                (embedded key active)
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 rounded px-3 py-2" style={{backgroundColor: PANEL_2, border: `1px solid ${BORDER}`}}>
              <Lock size={12} style={{color:TEXT_DIM}} />
              <input type={showKey ? 'text' : 'password'} value={apiKey} onChange={e=>setApiKey(e.target.value)}
                placeholder={EMBEDDED_CG_API_KEY ? 'Optional override — leave blank to use embedded key' : 'CG-xxxxxxxxxxxxxxxxxxxxxxxx'}
                className="flex-1 bg-transparent text-sm outline-none" style={{color:TEXT}} />
              <button onClick={()=>setShowKey(!showKey)} style={{color:TEXT_DIM}}>
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <button onClick={saveKey} className="px-3 py-2 rounded text-xs font-medium"
              style={{backgroundColor: ACCENT, color: BG}}>Save</button>
          </div>
          <div className="text-xs mt-2" style={{color:TEXT_DIM}}>
            {EMBEDDED_CG_API_KEY
              ? 'This site ships with an embedded CoinGecko key, so no input is required. Paste a key above only if you want to override it for this browser.'
              : 'Get a free Demo key at '}
            {!EMBEDDED_CG_API_KEY && <span style={{color:ACCENT_2}}>coingecko.com/en/developers/dashboard</span>}
            {!EMBEDDED_CG_API_KEY && '.'}
            <br />
            Any override you save is stored in localStorage only — never transmitted to any server except CoinGecko.
          </div>
        </div>

        {/* Data */}
        <div>
          <div className="text-xs uppercase tracking-wider mb-2" style={{color:TEXT_MUTE}}>Data</div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={exportJSON}
              className="px-3 py-2 rounded text-xs flex items-center gap-1.5"
              style={{backgroundColor: PANEL_2, color: TEXT, border: `1px solid ${BORDER}`}}>
              <Download size={12} /> Export all data (JSON)
            </button>
            <label className="px-3 py-2 rounded text-xs flex items-center gap-1.5 cursor-pointer"
              style={{backgroundColor: PANEL_2, color: TEXT, border: `1px solid ${BORDER}`}}>
              <Upload size={12} /> Import data (JSON)
              <input type="file" accept=".json" className="hidden" onChange={e=>{const f = e.target.files?.[0]; if (f) importJSON(f);}} />
            </label>
            <button onClick={exportExcel}
              className="px-3 py-2 rounded text-xs flex items-center gap-1.5 col-span-2"
              style={{backgroundColor: PANEL_2, color: TEXT, border: `1px solid ${BORDER}`}}>
              <FileSpreadsheet size={12} /> Export Fund Economics (Excel)
            </button>
          </div>
          <div className="text-[11px] mt-2" style={{color:TEXT_MUTE}}>
            All your clients, managers, SOIs, and preferences in one file. Take it offline, share it with a colleague, back it up.
          </div>
        </div>

        {/* Danger zone */}
        <div>
          <div className="text-xs uppercase tracking-wider mb-2" style={{color:RED}}>Danger zone</div>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 rounded" style={{backgroundColor: PANEL_2, border: `1px solid ${BORDER}`}}>
              <div>
                <div className="text-sm">Reset to seed data</div>
                <div className="text-xs" style={{color:TEXT_DIM}}>Replace everything with the demo 4-vintage portfolio.</div>
              </div>
              {confirmingReset ? (
                <div className="flex gap-1">
                  <button onClick={onResetSeed} className="px-2 py-1 rounded text-xs font-medium" style={{backgroundColor: RED, color: TEXT}}>Confirm</button>
                  <button onClick={()=>setConfirmingReset(false)} className="px-2 py-1 rounded text-xs" style={{color: TEXT_DIM, border: `1px solid ${BORDER}`}}>Cancel</button>
                </div>
              ) : (
                <button onClick={()=>setConfirmingReset(true)} className="px-3 py-1.5 rounded text-xs"
                  style={{color: TEXT_DIM, border: `1px solid ${BORDER}`}}>Reset</button>
              )}
            </div>
            <div className="flex items-center justify-between p-3 rounded" style={{backgroundColor: PANEL_2, border: `1px solid ${BORDER}`}}>
              <div>
                <div className="text-sm">Wipe all data</div>
                <div className="text-xs" style={{color:TEXT_DIM}}>Remove all clients, managers, and SOIs. Cannot be undone.</div>
              </div>
              {confirmingWipe ? (
                <div className="flex gap-1">
                  <button onClick={wipe} className="px-2 py-1 rounded text-xs font-medium" style={{backgroundColor: RED, color: TEXT}}>Wipe</button>
                  <button onClick={()=>setConfirmingWipe(false)} className="px-2 py-1 rounded text-xs" style={{color: TEXT_DIM, border: `1px solid ${BORDER}`}}>Cancel</button>
                </div>
              ) : (
                <button onClick={()=>setConfirmingWipe(true)} className="px-3 py-1.5 rounded text-xs flex items-center gap-1"
                  style={{color: RED, border: `1px solid ${RED}44`}}>
                  <Trash2 size={12} /> Wipe
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Manage */}
        <div>
          <div className="text-xs uppercase tracking-wider mb-2" style={{color:TEXT_MUTE}}>Manage</div>

          {/* Clients */}
          <div className="mb-4">
            <div className="text-[11px] mb-1.5 flex items-center gap-1.5" style={{color: TEXT_DIM}}>
              <Users size={11} /> Clients ({store.clients.length})
            </div>
            <div className="space-y-1">
              {store.clients.length === 0 && (
                <div className="text-xs italic px-2 py-1" style={{color: TEXT_MUTE}}>No clients yet. Import an SOI to create one.</div>
              )}
              {store.clients.map(c => {
                const count = store.commitments.filter(x => x.clientId === c.id).length;
                return (
                  <ManageRow
                    key={c.id}
                    title={c.name}
                    subtitle={`${count} commitment${count===1?'':'s'}`}
                    editFields={[{ label: 'Name', value: c.name, placeholder: 'Client name' }]}
                    onSave={([name]) => { if (name) renameClient(c.id, name); }}
                    onDelete={() => deleteClient(c.id)}
                    deleteWarning={count > 0 ? `Also removes ${count} commitment${count===1?'':'s'}` : ''}
                  />
                );
              })}
            </div>
          </div>

          {/* Managers */}
          <div className="mb-4">
            <div className="text-[11px] mb-1.5 flex items-center gap-1.5" style={{color: TEXT_DIM}}>
              <Briefcase size={11} /> Managers ({store.managers.length})
            </div>
            <div className="space-y-1">
              {store.managers.length === 0 && (
                <div className="text-xs italic px-2 py-1" style={{color: TEXT_MUTE}}>No managers yet.</div>
              )}
              {store.managers.map(m => {
                const soiCount = store.soIs.filter(x => x.managerId === m.id).length;
                const commitCount = store.commitments.filter(x => x.managerId === m.id).length;
                const isFoF = m.type === 'fund_of_funds';
                const subtitle = [m.firm, `${soiCount} SOI${soiCount===1?'':'s'}`, `${commitCount} commitment${commitCount===1?'':'s'}`, isFoF ? 'Fund-of-Funds' : 'Direct'].filter(Boolean).join(' · ');
                return (
                  <div key={m.id} className="space-y-0.5">
                    <ManageRow
                      title={m.name}
                      subtitle={subtitle}
                      editFields={[
                        { label: 'Name', value: m.name, placeholder: 'Manager name' },
                        { label: 'Firm',  value: m.firm || '', placeholder: 'Firm (optional)' },
                      ]}
                      onSave={([name, firm]) => { if (name) updateStore(s => ({ ...s, managers: s.managers.map(x => x.id === m.id ? { ...x, name, firm } : x) })); }}
                      onDelete={() => deleteManager(m.id)}
                      deleteWarning={`Also removes ${soiCount} SOI${soiCount===1?'':'s'} and ${commitCount} commitment${commitCount===1?'':'s'}`}
                    />
                    <div className="flex items-center justify-end gap-1 px-1">
                      <span className="text-[10px]" style={{color:TEXT_MUTE}}>Type:</span>
                      <button
                        onClick={() => updateStore(s => ({ ...s, managers: s.managers.map(x => x.id === m.id ? { ...x, type: isFoF ? 'direct' : 'fund_of_funds' } : x) }))}
                        className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                        style={{
                          backgroundColor: isFoF ? VIOLET+'22' : PANEL_2,
                          color: isFoF ? VIOLET : TEXT_DIM,
                          border: `1px solid ${isFoF ? VIOLET+'44' : BORDER}`,
                        }}
                        title="Click to toggle between Direct and Fund-of-Funds">
                        {isFoF ? 'Fund-of-Funds ✓' : 'Direct — click to set as FoF'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SOIs */}
          <div className="mb-4">
            <div className="text-[11px] mb-1.5 flex items-center gap-1.5" style={{color: TEXT_DIM}}>
              <Building2 size={11} /> SOIs ({store.soIs.length})
            </div>
            <div className="space-y-1">
              {store.soIs.length === 0 && (
                <div className="text-xs italic px-2 py-1" style={{color: TEXT_MUTE}}>No SOIs yet.</div>
              )}
              {store.soIs.map(x => {
                const mgr = managerById[x.managerId];
                const commitCount = store.commitments.filter(c => c.soiId === x.id).length;
                const posCount = latestSnapshot(x)?.positions?.length || 0;
                const snapCount = snapshotsOf(x).length;
                return (
                  <ManageRow
                    key={x.id}
                    title={`${mgr?.name || 'Unknown manager'} — ${x.vintage || '(no vintage)'}`}
                    subtitle={`${snapCount} snapshot${snapCount===1?'':'s'} · ${posCount} positions (latest) · as of ${latestSnapshot(x)?.asOfDate || '—'} · ${commitCount} commitment${commitCount===1?'':'s'}`}
                    editFields={[{ label: 'Vintage label', value: x.vintage || '', placeholder: 'e.g. Fund III' }]}
                    onSave={([vintage]) => renameSOI(x.id, vintage)}
                    onDelete={() => deleteSOI(x.id)}
                    deleteWarning={commitCount > 0 ? `Also removes ${commitCount} commitment${commitCount===1?'':'s'}` : ''}
                  />
                );
              })}
            </div>
          </div>

          {/* Sectors */}
          <div>
            <div className="text-[11px] mb-1.5 flex items-center gap-1.5" style={{color: TEXT_DIM}}>
              <Layers size={11} /> Sectors ({(store.sectors || []).length})
            </div>
            <div className="space-y-1 mb-2">
              {(store.sectors || []).map(sec => (
                <SectorRow key={sec.id} sector={sec} store={store} updateStore={updateStore} />
              ))}
            </div>
            <SectorAddForm updateStore={updateStore} />
          </div>
        </div>
      </div>
    </Modal>
  );
}


export function ManageRow({ title, subtitle, editFields, onSave, onDelete, deleteWarning }) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState(() => editFields.map(f => f.value ?? ''));
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const startEdit = () => { setValues(editFields.map(f => f.value ?? '')); setEditing(true); };
  const save = () => { onSave(values.map(v => String(v).trim())); setEditing(false); };
  const cancel = () => setEditing(false);

  if (editing) {
    return (
      <div className="p-2 rounded space-y-2" style={{backgroundColor: PANEL_2, border: `1px solid ${BORDER}`}}>
        {editFields.map((f, i) => (
          <div key={i}>
            <div className="text-[10px] uppercase tracking-wider mb-1" style={{color: TEXT_MUTE}}>{f.label}</div>
            <input
              autoFocus={i===0}
              value={values[i]}
              onChange={e => setValues(v => v.map((x, j) => j===i ? e.target.value : x))}
              onKeyDown={e => { if (e.key==='Enter') save(); if (e.key==='Escape') cancel(); }}
              placeholder={f.placeholder || ''}
              className="w-full px-2 py-1.5 rounded text-sm outline-none"
              style={{backgroundColor: PANEL, color: TEXT, border: `1px solid ${BORDER}`}}
            />
          </div>
        ))}
        <div className="flex justify-end gap-1">
          <button onClick={save} className="px-2.5 py-1 rounded text-xs font-medium" style={{backgroundColor: ACCENT, color: BG}}>Save</button>
          <button onClick={cancel} className="px-2.5 py-1 rounded text-xs" style={{color: TEXT_DIM, border: `1px solid ${BORDER}`}}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-2 rounded text-sm gap-2"
      style={{backgroundColor: PANEL_2, border: `1px solid ${BORDER}`}}>
      <div className="flex-1 min-w-0">
        <div className="truncate">{title}</div>
        {subtitle && <div className="text-[11px] truncate" style={{color: TEXT_DIM}}>{subtitle}</div>}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {confirmingDelete ? (
          <>
            {deleteWarning && <div className="text-[11px] mr-1" style={{color: TEXT_DIM}}>{deleteWarning}</div>}
            <button onClick={() => { onDelete(); setConfirmingDelete(false); }}
              className="px-2 py-1 rounded text-xs font-medium" style={{backgroundColor: RED, color: TEXT}}>Delete</button>
            <button onClick={() => setConfirmingDelete(false)} className="px-2 py-1 rounded text-xs"
              style={{color: TEXT_DIM, border: `1px solid ${BORDER}`}}>Cancel</button>
          </>
        ) : (
          <>
            <button onClick={startEdit} className="p-1 rounded" style={{color: TEXT_DIM}} title="Edit"><Edit2 size={14} /></button>
            <button onClick={() => setConfirmingDelete(true)} className="p-1 rounded" style={{color: RED}} title="Delete"><Trash2 size={14} /></button>
          </>
        )}
      </div>
    </div>
  );
}


export function SectorRow({ sector, store, updateStore }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(sector.label);
  const [color, setColor] = useState(sector.color);
  const [desc, setDesc] = useState(sector.desc || '');
  const [deleting, setDeleting] = useState(false);
  const [replacementId, setReplacementId] = useState('');

  const useCount = useMemo(() => {
    let n = 0;
    for (const soi of store.soIs) {
      for (const snap of snapshotsOf(soi)) {
        for (const p of (snap.positions || [])) if (p.sectorId === sector.id) n++;
      }
    }
    for (const id of Object.values(store.sectorOverrides || {})) if (id === sector.id) n++;
    return n;
  }, [store, sector.id]);

  const otherSectors = (store.sectors || []).filter(s => s.id !== sector.id);

  const save = () => {
    const label = name.trim() || sector.label;
    updateStore(s => ({ ...s, sectors: (s.sectors || []).map(x => x.id === sector.id ? { ...x, label, color, desc } : x) }));
    setEditing(false);
  };

  const doDelete = () => {
    updateStore(s => {
      const repl = replacementId || null;
      const nextSoIs = s.soIs.map(soi => ({
        ...soi,
        snapshots: snapshotsOf(soi).map(snap => ({
          ...snap,
          positions: (snap.positions || []).map(p => p.sectorId === sector.id ? { ...p, sectorId: repl } : p),
        })),
      }));
      const nextOverrides = { ...(s.sectorOverrides || {}) };
      for (const [k, id] of Object.entries(nextOverrides)) {
        if (id === sector.id) { if (repl) nextOverrides[k] = repl; else delete nextOverrides[k]; }
      }
      return { ...s, sectors: (s.sectors || []).filter(x => x.id !== sector.id), soIs: nextSoIs, sectorOverrides: nextOverrides };
    });
    setDeleting(false);
  };

  if (editing) {
    return (
      <div className="p-2 rounded space-y-2" style={{backgroundColor: PANEL_2, border: `1px solid ${BORDER}`}}>
        <div className="flex items-center gap-2">
          <input type="color" value={color} onChange={e=>setColor(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer flex-shrink-0" style={{backgroundColor: PANEL_2, border: `1px solid ${BORDER}`}} />
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Name"
            className="flex-1 px-2 py-1.5 rounded text-sm outline-none"
            style={{backgroundColor: PANEL, color: TEXT, border: `1px solid ${BORDER}`}} />
        </div>
        <input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Description"
          className="w-full px-2 py-1.5 rounded text-sm outline-none"
          style={{backgroundColor: PANEL, color: TEXT, border: `1px solid ${BORDER}`}} />
        <div className="flex justify-end gap-1">
          <button onClick={save} className="px-2.5 py-1 rounded text-xs font-medium" style={{backgroundColor: ACCENT, color: BG}}>Save</button>
          <button onClick={()=>setEditing(false)} className="px-2.5 py-1 rounded text-xs" style={{color: TEXT_DIM, border: `1px solid ${BORDER}`}}>Cancel</button>
        </div>
      </div>
    );
  }

  if (deleting) {
    return (
      <div className="p-2 rounded space-y-2" style={{backgroundColor: PANEL_2, border: `1px solid ${RED}66`}}>
        <div className="text-sm">Delete <span style={{color: sector.color}}>{sector.label}</span>?</div>
        {useCount > 0 ? (
          <>
            <div className="text-xs" style={{color: TEXT_DIM}}>
              {useCount} position reference{useCount===1?'':'s'} will be reassigned.
            </div>
            <select value={replacementId} onChange={e=>setReplacementId(e.target.value)}
              className="w-full px-2 py-1.5 rounded text-sm outline-none"
              style={{backgroundColor: PANEL, color: TEXT, border: `1px solid ${BORDER}`}}>
              <option value="">Unclassified</option>
              {otherSectors.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </>
        ) : (
          <div className="text-xs" style={{color: TEXT_DIM}}>No positions use this sector.</div>
        )}
        <div className="flex justify-end gap-1">
          <button onClick={doDelete} className="px-2.5 py-1 rounded text-xs font-medium" style={{backgroundColor: RED, color: TEXT}}>Delete</button>
          <button onClick={()=>setDeleting(false)} className="px-2.5 py-1 rounded text-xs" style={{color: TEXT_DIM, border: `1px solid ${BORDER}`}}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-2 rounded text-sm gap-2"
      style={{backgroundColor: PANEL_2, border: `1px solid ${BORDER}`}}>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{backgroundColor: sector.color}} />
        <div className="min-w-0 flex-1">
          <div className="truncate">{sector.label}</div>
          {sector.desc && <div className="text-[11px] truncate" style={{color: TEXT_DIM}}>{sector.desc}</div>}
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <div className="text-[10px] mr-1" style={{color: TEXT_MUTE}}>{useCount} use{useCount===1?'':'s'}</div>
        <button onClick={()=>setEditing(true)} className="p-1 rounded" style={{color: TEXT_DIM}} title="Edit"><Edit2 size={14} /></button>
        <button onClick={()=>setDeleting(true)} className="p-1 rounded" style={{color: RED}} title="Delete"><Trash2 size={14} /></button>
      </div>
    </div>
  );
}


export function SectorAddForm({ updateStore }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#4A9EFF');
  const [desc, setDesc] = useState('');
  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'sector';
    const id = `${slug}-${uid().slice(0, 4)}`;
    updateStore(s => ({ ...s, sectors: [...(s.sectors || []), { id, label: trimmed, color, desc }] }));
    setName(''); setDesc('');
  };
  return (
    <div className="p-2 rounded space-y-2" style={{backgroundColor: PANEL_2, border: `1px dashed ${BORDER}`}}>
      <div className="text-[11px]" style={{color: TEXT_DIM}}>Add a sector</div>
      <div className="flex items-center gap-2">
        <input type="color" value={color} onChange={e=>setColor(e.target.value)}
          className="w-8 h-8 rounded cursor-pointer flex-shrink-0" style={{backgroundColor: PANEL_2, border: `1px solid ${BORDER}`}} />
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Name"
          className="flex-1 px-2 py-1.5 rounded text-sm outline-none"
          style={{backgroundColor: PANEL, color: TEXT, border: `1px solid ${BORDER}`}} />
      </div>
      <input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Description (optional)"
        className="w-full px-2 py-1.5 rounded text-sm outline-none"
        style={{backgroundColor: PANEL, color: TEXT, border: `1px solid ${BORDER}`}} />
      <div className="flex justify-end">
        <button onClick={submit} disabled={!name.trim()}
          className="px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1"
          style={{backgroundColor: ACCENT, color: BG, opacity: name.trim() ? 1 : 0.5}}>
          <Plus size={12} /> Add sector
        </button>
      </div>
    </div>
  );
}

