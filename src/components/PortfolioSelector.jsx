import {
  useState, useRef, useEffect, useMemo,
} from 'react';
import {
  Users, Briefcase, ChevronDown, Building2,
} from 'lucide-react';

import {
  PANEL, PANEL_2, BORDER, TEXT, TEXT_DIM, TEXT_MUTE, ACCENT,
} from '../lib/theme';
import { fundLabel } from '../lib/format';
import { MenuItem } from './ui';

export function PortfolioSelector({ store, selection, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const label = useMemo(() => {
    if (selection.kind === 'firm') return 'All Clients';
    if (selection.kind === 'client') return store.clients.find(c=>c.id===selection.id)?.name || '—';
    if (selection.kind === 'manager') return store.managers.find(m=>m.id===selection.id)?.name + ' (all)';
    if (selection.kind === 'vintage') {
      const soi = store.soIs.find(s=>s.id===selection.id);
      const mgr = store.managers.find(m=>m.id===soi?.managerId);
      return `${mgr?.name || '?'} ${fundLabel(soi) || ''}`;
    }
    return '';
  }, [selection, store]);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)}
        className="px-3 py-1.5 rounded text-sm font-medium flex items-center gap-2"
        style={{ backgroundColor: PANEL_2, border: `1px solid ${BORDER}`, color: TEXT, minWidth: 220 }}>
        <Briefcase size={14} style={{ color: ACCENT }} />
        <span className="flex-1 text-left">{label}</span>
        <ChevronDown size={14} style={{ color: TEXT_DIM }} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 rounded-lg z-50"
          style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}`, minWidth: 280, boxShadow: '0 10px 30px rgba(0,0,0,0.4)' }}>
          <div className="p-1">
            <MenuItem
              active={selection.kind==='firm'}
              onClick={() => { onChange({ kind: 'firm' }); setOpen(false); }}
              icon={<Users size={14} />}>
              All Clients
              <span className="ml-auto text-[10px]" style={{ color: TEXT_MUTE }}>
                {store.soIs.length} funds
              </span>
            </MenuItem>
          </div>
          {store.clients.length > 0 && (
            <>
              <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider" style={{ color: TEXT_MUTE }}>Clients</div>
              <div className="p-1">
                {store.clients.map(c => {
                  const soiCount = store.commitments.filter(x => x.clientId === c.id).length;
                  return (
                    <MenuItem key={c.id}
                      active={selection.kind==='client' && selection.id===c.id}
                      onClick={() => { onChange({ kind: 'client', id: c.id }); setOpen(false); }}
                      icon={<Users size={14} />}>
                      {c.name}
                      <span className="ml-auto text-[10px]" style={{ color: TEXT_MUTE }}>{soiCount}</span>
                    </MenuItem>
                  );
                })}
              </div>
            </>
          )}
          {store.managers.length > 0 && (
            <>
              <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider" style={{ color: TEXT_MUTE }}>Managers</div>
              <div className="p-1 pb-2">
                {store.managers.map(m => {
                  const vintages = store.soIs.filter(s => s.managerId === m.id);
                  return (
                    <div key={m.id}>
                      <MenuItem
                        active={selection.kind==='manager' && selection.id===m.id}
                        onClick={() => { onChange({ kind: 'manager', id: m.id }); setOpen(false); }}
                        icon={<Building2 size={14} />}>
                        {m.name}
                        <span className="ml-auto text-[10px]" style={{ color: TEXT_MUTE }}>{vintages.length}</span>
                      </MenuItem>
                      {vintages.map(v => (
                        <MenuItem key={v.id} indent
                          active={selection.kind==='vintage' && selection.id===v.id}
                          onClick={() => { onChange({ kind: 'vintage', id: v.id }); setOpen(false); }}>
                          <span style={{ color: TEXT_DIM }}>{v.vintage}</span>
                        </MenuItem>
                      ))}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

