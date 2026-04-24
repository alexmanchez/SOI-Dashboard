import React, { useState } from 'react';
import {
  Home, Users, Briefcase, ChevronRight, ChevronDown, Globe, Twitter, Linkedin, ExternalLink, X,
} from 'lucide-react';

import {
  BG, PANEL, PANEL_2, BORDER, TEXT, TEXT_DIM, TEXT_MUTE,
  ACCENT, ACCENT_2, GREEN, RED, GOLD,
} from '../lib/theme';
import { fmtCurrency, fmtPctSigned } from '../lib/format';
import { parseNum } from '../lib/parsing';
import { sectorOf } from '../lib/sectors';

export const Panel = ({ children, className='', style={}, ...rest }) => (
  <div {...rest}
    className={`rounded-lg ${className}`}
    style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}`, ...style }}>
    {children}
  </div>
);


export const KPI = ({ label, value, sub, tone }) => {
  const toneColor = tone === 'up' ? GREEN : tone === 'down' ? RED : TEXT;
  return (
    <Panel className="p-4">
      <div className="text-[11px] uppercase tracking-wider" style={{ color: TEXT_MUTE }}>{label}</div>
      <div className="text-2xl font-semibold mt-1" style={{ color: toneColor }}>{value}</div>
      {sub && <div className="text-xs mt-1" style={{ color: TEXT_DIM }}>{sub}</div>}
    </Panel>
  );
};


export const Pill = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className="px-2.5 py-1 rounded text-xs font-medium transition-colors"
    style={{
      color: active ? BG : TEXT_DIM,
      backgroundColor: active ? ACCENT : 'transparent',
      border: `1px solid ${active ? ACCENT : BORDER}`,
    }}>
    {children}
  </button>
);


export const Tab = ({ active, onClick, children, icon: Icon }) => (
  <button onClick={onClick}
    className="px-4 py-2 text-sm font-medium flex items-center gap-2 transition-colors"
    style={{
      color: active ? TEXT : TEXT_DIM,
      borderBottom: `2px solid ${active ? ACCENT : 'transparent'}`,
    }}>
    {Icon && <Icon size={14} />}{children}
  </button>
);

/* Top-nav button — used in the primary header row for Home / Portfolios / Managers.
   Styled to echo the Portfolio Workbench nav: uppercase label, quiet until active,
   active state fills with the darker panel color. `hasCaret` shows a ChevronDown
   for buttons that open a dropdown (Portfolios / Managers). */
/* Read-only breadcrumb shown in the context row. Navigates via click on
   each crumb (except the leaf). Reflects the current selection + SOI drilldown. */


export const Breadcrumb = ({ store, selection, drilldownSoi, onCrumb }) => {
  const crumbs = [];
  if (selection.kind === 'firm') {
    crumbs.push({ label: 'Firm-wide', icon: Home, onClick: null });
  } else if (selection.kind === 'client') {
    const c = store.clients.find(x => x.id === selection.id);
    crumbs.push({ label: 'Portfolios', icon: Users, onClick: () => onCrumb({ kind: 'firm' }) });
    crumbs.push({ label: c?.name || '—', icon: null, onClick: null });
  } else if (selection.kind === 'manager') {
    const m = store.managers.find(x => x.id === selection.id);
    crumbs.push({ label: 'Managers', icon: Briefcase, onClick: () => onCrumb({ kind: 'firm' }) });
    crumbs.push({ label: m?.name || '—', icon: null, onClick: null });
  } else if (selection.kind === 'vintage') {
    const v = store.soIs.find(x => x.id === selection.id);
    const m = v ? store.managers.find(x => x.id === v.managerId) : null;
    crumbs.push({ label: 'Managers', icon: Briefcase, onClick: () => onCrumb({ kind: 'firm' }) });
    if (m) crumbs.push({ label: m.name, icon: null, onClick: () => onCrumb({ kind: 'manager', id: m.id }) });
    crumbs.push({ label: v?.vintage || '—', icon: null, onClick: null });
  }
  if (drilldownSoi) {
    const v = store.soIs.find(x => x.id === drilldownSoi);
    const m = v ? store.managers.find(x => x.id === v.managerId) : null;
    if (m && !crumbs.some(c => c.label === m.name)) crumbs.push({ label: m.name, icon: null, onClick: () => onCrumb({ kind: 'manager', id: m.id }) });
    if (v && !crumbs.some(c => c.label === v.vintage)) crumbs.push({ label: v.vintage, icon: null, onClick: null });
  }
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {crumbs.map((c, i) => {
        const isLeaf = i === crumbs.length - 1;
        const Icon = c.icon;
        const content = (
          <span className="flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors"
            style={{
              color: isLeaf ? TEXT : TEXT_DIM,
              backgroundColor: isLeaf ? PANEL_2 : 'transparent',
              fontWeight: isLeaf ? 600 : 400,
              cursor: c.onClick ? 'pointer' : 'default',
            }}>
            {Icon && <Icon size={12} style={{ color: isLeaf ? ACCENT_2 : TEXT_MUTE }} />}
            {c.label}
          </span>
        );
        return (
          <React.Fragment key={i}>
            {i > 0 && <ChevronRight size={10} style={{ color: TEXT_MUTE }} />}
            {c.onClick ? <button onClick={c.onClick}>{content}</button> : content}
          </React.Fragment>
        );
      })}
    </div>
  );
};


export const NavButton = ({ active, onClick, children, icon: Icon, hasCaret }) => (
  <button onClick={onClick}
    className="px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
    style={{
      color: active ? TEXT : TEXT_DIM,
      backgroundColor: active ? PANEL_2 : 'transparent',
    }}>
    {Icon && <Icon size={13} />}{children}{hasCaret && <ChevronDown size={12} style={{opacity: 0.7}} />}
  </button>
);

/* A row of small social-link chips for a manager. Returns null if no socials.
   Links open in a new tab with noopener/noreferrer. */


export const ManagerSocials = ({ socials }) => {
  if (!socials) return null;
  const items = [];
  if (socials.website)  items.push({ icon: Globe,    label: 'Website',  url: socials.website });
  if (socials.twitter)  items.push({ icon: Twitter,  label: 'X',        url: socials.twitter });
  if (socials.linkedin) items.push({ icon: Linkedin, label: 'LinkedIn', url: socials.linkedin });
  if (items.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5">
      {items.map((it, i) => (
        <a key={i} href={it.url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors"
          style={{ backgroundColor: PANEL_2, border: `1px solid ${BORDER}`, color: TEXT_DIM }}
          title={it.label}>
          <it.icon size={11} />
          <span>{it.label}</span>
          <ExternalLink size={9} style={{ opacity: 0.6 }} />
        </a>
      ))}
    </div>
  );
};

/* Click-to-edit text. Renders plain text until clicked; then becomes an
   inline input. Enter/blur saves; Escape cancels. Used for renaming the
   client portfolio title, manager names, etc. */


export const EditableText = ({ value, onCommit, placeholder, className, style, tag = 'span' }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  // Resync draft when the controlled `value` changes externally and we're
  // not mid-edit. setState-during-render (React's prop-reset pattern).
  const [_lastValue, _setLastValue] = useState(value || '');
  if (!editing && (value || '') !== _lastValue) {
    _setLastValue(value || '');
    setDraft(value || '');
  }

  const commit = () => {
    setEditing(false);
    const trimmed = (draft || '').trim();
    if (trimmed !== (value || '').trim()) onCommit?.(trimmed);
  };
  const cancel = () => { setDraft(value || ''); setEditing(false); };

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } if (e.key === 'Escape') { e.preventDefault(); cancel(); } }}
        className={className}
        style={{
          background: 'transparent',
          border: 'none',
          borderBottom: `2px solid ${ACCENT}`,
          outline: 'none',
          padding: 0,
          color: TEXT,
          width: '100%',
          font: 'inherit',
          ...style,
        }}
        placeholder={placeholder}
      />
    );
  }
  const Tag = tag;
  const displayValue = value && String(value).length ? value : (placeholder || 'Click to edit');
  const isPlaceholder = !value || String(value).length === 0;
  return (
    <Tag
      onClick={() => setEditing(true)}
      className={className}
      style={{
        cursor: 'text',
        borderBottom: `1px dashed transparent`,
        ...style,
        color: isPlaceholder ? TEXT_MUTE : (style && style.color) || undefined,
        fontStyle: isPlaceholder ? 'italic' : undefined,
      }}
      title="Click to edit"
      onMouseEnter={(e) => { e.currentTarget.style.borderBottomColor = BORDER; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderBottomColor = 'transparent'; }}
    >
      {displayValue}
    </Tag>
  );
};

/* Click-to-edit number. Like EditableText but parses on commit and can render
   the committed value through a custom formatter (currency / percent / raw).
   Enter/blur saves; Escape cancels. */
export const EditableNumber = ({
  value,
  onCommit,
  format = (v) => (v == null || Number.isNaN(v) ? '–' : String(v)),
  step,
  placeholder,
  align = 'right',
  className,
  style,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value == null ? '' : String(value));
  // Resync draft when controlled `value` changes externally and not editing.
  const _canonical = value == null ? '' : String(value);
  const [_lastValue, _setLastValue] = useState(_canonical);
  if (!editing && _canonical !== _lastValue) {
    _setLastValue(_canonical);
    setDraft(_canonical);
  }

  const commit = () => {
    setEditing(false);
    const trimmed = String(draft).trim();
    if (trimmed === '') {
      if (value != null) onCommit?.(null);
      return;
    }
    const n = parseNum(trimmed);
    if (n == null) return;
    if (n !== value) onCommit?.(n);
  };
  const cancel = () => {
    setDraft(value == null ? '' : String(value));
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        inputMode="decimal"
        step={step}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          if (e.key === 'Escape') { e.preventDefault(); cancel(); }
        }}
        onFocus={(e) => e.currentTarget.select()}
        className={className}
        style={{
          background: 'transparent',
          border: 'none',
          borderBottom: `2px solid ${ACCENT}`,
          outline: 'none',
          padding: 0,
          color: TEXT,
          width: '100%',
          textAlign: align,
          font: 'inherit',
          ...style,
        }}
        placeholder={placeholder}
      />
    );
  }
  const display = value == null ? (placeholder || '–') : format(value);
  const isPlaceholder = value == null;
  return (
    <span
      onClick={() => setEditing(true)}
      className={className}
      style={{
        cursor: 'text',
        borderBottom: `1px dashed transparent`,
        display: 'inline-block',
        minWidth: 10,
        textAlign: align,
        color: isPlaceholder ? TEXT_MUTE : (style && style.color) || undefined,
        fontStyle: isPlaceholder ? 'italic' : undefined,
        ...style,
      }}
      title="Click to edit"
      onMouseEnter={(e) => { e.currentTarget.style.borderBottomColor = BORDER; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderBottomColor = 'transparent'; }}
    >
      {display}
    </span>
  );
};

/* Click-to-edit dropdown. Options is [{value, label}]. Commits on change. */
export const EditableSelect = ({
  value,
  onCommit,
  options = [],
  placeholder = '—',
  className,
  style,
  renderValue,
}) => {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <select
        autoFocus
        value={value ?? ''}
        onChange={(e) => { const v = e.target.value; setEditing(false); if (v !== value) onCommit?.(v); }}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false); }}
        className={className}
        style={{
          background: PANEL_2,
          border: `1px solid ${ACCENT}`,
          color: TEXT,
          font: 'inherit',
          padding: '1px 4px',
          borderRadius: 3,
          outline: 'none',
          ...style,
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  }

  const current = options.find((o) => o.value === value);
  const display = renderValue ? renderValue(current?.value) : (current?.label || placeholder);
  return (
    <span
      onClick={() => setEditing(true)}
      className={className}
      style={{
        cursor: 'pointer',
        borderBottom: `1px dashed transparent`,
        ...style,
      }}
      title="Click to edit"
      onMouseEnter={(e) => { e.currentTarget.style.borderBottomColor = BORDER; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderBottomColor = 'transparent'; }}
    >
      {display}
    </span>
  );
};

/* Token logo. Tries three sources in order:
     1. CryptoRank image map (from TokenImageContext) — high-quality, matches
        CoinGecko / CoinMarketCap-style logos.
     2. atomiclabs/cryptocurrency-icons via jsdelivr (covers top ~500 tokens).
     3. Letter-in-a-circle chip fallback. */


export const PlaceholderPage = ({ icon: Icon, title, description }) => (
  <Panel className="p-10 text-center">
    <div className="flex justify-center mb-4" style={{ color: TEXT_MUTE }}>
      <Icon size={28} />
    </div>
    <div className="text-base font-semibold mb-1" style={{ color: TEXT }}>{title}</div>
    <div className="text-xs max-w-md mx-auto" style={{ color: TEXT_DIM }}>{description}</div>
  </Panel>
);


export const SectorBadge = ({ sectorId, size='sm' }) => {
  const s = sectorOf(sectorId);
  const px = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs';
  return (
    <span className={`rounded ${px} font-medium`}
      style={{ backgroundColor: s.color + '22', color: s.color, border: `1px solid ${s.color}44` }}>
      {s.label}
    </span>
  );
};


export const LiquidityBadge = ({ liquid }) => (
  <span className="rounded px-1.5 py-0.5 text-[10px] font-medium"
    style={{
      backgroundColor: liquid ? GREEN + '22' : GOLD + '22',
      color: liquid ? GREEN : GOLD,
      border: `1px solid ${liquid ? GREEN+'44' : GOLD+'44'}`,
    }}>
    {liquid ? 'Liquid' : 'Illiquid'}
  </span>
);


export const ChangeCell = ({ value, format='pct' }) => {
  if (value === null || value === undefined || isNaN(value)) return <span style={{color:TEXT_MUTE}}>–</span>;
  const color = value >= 0 ? GREEN : RED;
  const s = format === 'pct' ? fmtPctSigned(value) : (value >= 0 ? '+' : '') + fmtCurrency(value);
  return <span style={{ color }}>{s}</span>;
};


export function SortHead({ col, by, dir, onClick, align, children }) {
  const active = by === col;
  return (
    <th className={`px-3 py-2 ${align==='right'?'text-right':'text-left'} cursor-pointer select-none`}
      onClick={() => onClick(col)}
      style={{ color: active ? TEXT : TEXT_MUTE }}>
      {children}{active ? (dir==='asc' ? ' ▲' : ' ▼') : ''}
    </th>
  );
}


export function Field({ label, children, full }) {
  return (
    <div className={full ? 'md:col-span-2' : ''}>
      <label className="text-[10px] uppercase tracking-wider" style={{color:TEXT_MUTE}}>{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}


export function TextInput({ value, onChange, placeholder, type='text', align }) {
  return (
    <input type={type} value={value ?? ''} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
      className={`w-full px-3 py-2 rounded text-sm outline-none ${align==='right'?'text-right tabular-nums':''}`}
      style={{backgroundColor: PANEL_2, color: TEXT, border: `1px solid ${BORDER}`}} />
  );
}


export function NumField({ label, value, onSave }) {
  const [text, setText] = useState(String(value ?? ''));
  // Resync when controlled `value` changes (e.g. after save confirms from store).
  const _canonical = String(value ?? '');
  const [_lastValue, _setLastValue] = useState(_canonical);
  if (_canonical !== _lastValue) {
    _setLastValue(_canonical);
    setText(_canonical);
  }
  const commit = () => {
    const n = parseNum(text);
    if (n == null) { setText(String(value ?? '')); return; }
    if (n !== value) onSave(n);
  };
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider mb-1" style={{color:TEXT_MUTE}}>{label}</div>
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setText(String(value ?? '')); e.currentTarget.blur(); } }}
        className="w-full px-3 py-2 rounded text-sm outline-none text-right tabular-nums"
        style={{backgroundColor: PANEL_2, color: TEXT, border: `1px solid ${BORDER}`}}
      />
    </div>
  );
}


export function Stat({ label, value }) {
  return (
    <div className="px-3 py-2 rounded" style={{backgroundColor: PANEL_2, border: `1px solid ${BORDER}`}}>
      <div className="text-[10px] uppercase tracking-wider" style={{color:TEXT_MUTE}}>{label}</div>
      <div className="text-sm font-semibold mt-0.5 tabular-nums">{value}</div>
    </div>
  );
}


export function Select({ value, onChange, options }) {
  return (
    <select value={value} onChange={e=>onChange(e.target.value)}
      className="w-full px-3 py-2 rounded text-sm outline-none"
      style={{backgroundColor: PANEL_2, color: TEXT, border: `1px solid ${BORDER}`}}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}


export function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{backgroundColor: 'rgba(0,0,0,0.7)'}}>
      <div className="rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        style={{backgroundColor: PANEL, border: `1px solid ${BORDER}`}}>
        <div className="flex items-center justify-between px-5 py-3 sticky top-0" style={{borderBottom: `1px solid ${BORDER}`, backgroundColor: PANEL}}>
          <div className="text-sm font-semibold">{title}</div>
          <button onClick={onClose} className="p-1 rounded" style={{color: TEXT_DIM}}><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}


export function ChoiceCard({ icon: Icon, title, desc, onClick }) {
  return (
    <button onClick={onClick}
      className="p-5 rounded-lg text-left transition-colors hover:border-opacity-80"
      style={{backgroundColor: PANEL_2, border: `1px solid ${BORDER}`}}>
      <Icon size={20} style={{color: ACCENT}} />
      <div className="text-sm font-semibold mt-2">{title}</div>
      <div className="text-xs mt-1" style={{color: TEXT_DIM}}>{desc}</div>
    </button>
  );
}


export function MenuItem({ active, onClick, children, icon, indent }) {
  return (
    <button onClick={onClick}
      className="w-full px-2.5 py-1.5 rounded text-sm flex items-center gap-2 transition-colors"
      style={{
        backgroundColor: active ? ACCENT + '22' : 'transparent',
        color: active ? ACCENT_2 : TEXT,
        paddingLeft: indent ? 28 : undefined,
      }}>
      {icon}
      {children}
    </button>
  );
}

