import { Plus, Upload, Users, Briefcase } from 'lucide-react';

import { BG, PANEL_2, BORDER, TEXT, TEXT_MUTE, ACCENT, ACCENT_2 } from '../lib/theme';

/**
 * Primary-nav "+ Create" pill with a dropdown that offers Portfolio /
 * Manager / Holdings-snapshot entry points. All three hand off to
 * callers — Portfolio and Manager currently open SettingsDrawer,
 * Holdings opens ImportWizard.
 */
export function CreateMenu({ open, onToggle, onClose, onCreatePortfolio, onCreateManager, onImport }) {
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={onToggle}
        className="ml-2 px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5"
        style={{ backgroundColor: ACCENT, color: BG }}
      >
        <Plus size={12} /> Create
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 42 }}>
          <div
            className="rounded shadow-xl py-1"
            style={{ backgroundColor: PANEL_2, border: `1px solid ${BORDER}`, minWidth: 220 }}
          >
            <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider" style={{ color: TEXT_MUTE }}>
              New
            </div>
            <button
              onClick={() => { onClose(); onCreatePortfolio(); }}
              className="w-full text-left px-3 py-2 text-xs flex items-center gap-2"
              style={{ color: TEXT }}
            >
              <Users size={13} style={{ color: ACCENT_2 }} /> Portfolio (client)
            </button>
            <button
              onClick={() => { onClose(); onCreateManager(); }}
              className="w-full text-left px-3 py-2 text-xs flex items-center gap-2"
              style={{ color: TEXT }}
            >
              <Briefcase size={13} style={{ color: ACCENT_2 }} /> Manager
            </button>
            <button
              onClick={() => { onClose(); onImport(); }}
              className="w-full text-left px-3 py-2 text-xs flex items-center gap-2"
              style={{ color: TEXT }}
            >
              <Upload size={13} style={{ color: ACCENT_2 }} /> Holdings snapshot (import)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
