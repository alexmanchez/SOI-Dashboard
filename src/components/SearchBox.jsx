import { Search, Users, Briefcase } from 'lucide-react';

import { PANEL_2, BORDER, TEXT, TEXT_DIM, TEXT_MUTE, ACCENT_2 } from '../lib/theme';
import { fundLabel } from '../lib/format';
import { TokenIcon } from './TokenIcon';

/**
 * Global search input with a grouped dropdown (Portfolios / Managers / Tokens).
 * Stateless — receives searchQuery + searchResults + a bundle of navigation
 * callbacks, returns the rendered input + dropdown. Empty `searchResults`
 * (null) means "no query entered yet", which suppresses the dropdown.
 */
export function SearchBox({
  searchQuery,
  setSearchQuery,
  searchResults,
  store,
  onOpenClient,
  onOpenManager,
  onOpenToken,
}) {
  return (
    <div style={{ position: 'relative' }}>
      <Search
        size={12}
        style={{
          position: 'absolute', left: 8, top: '50%',
          transform: 'translateY(-50%)', color: TEXT_MUTE, pointerEvents: 'none',
        }}
      />
      <input
        type="search"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search portfolios, managers, positions…"
        className="pl-7 pr-3 py-1.5 rounded text-xs outline-none"
        style={{ backgroundColor: PANEL_2, border: `1px solid ${BORDER}`, color: TEXT, width: 260 }}
      />
      {searchResults && (
        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 43, width: 360 }}>
          <div
            className="rounded shadow-xl py-1"
            style={{ backgroundColor: PANEL_2, border: `1px solid ${BORDER}`, maxHeight: 460, overflowY: 'auto' }}
          >
            {searchResults.clients.length === 0 &&
              searchResults.managers.length === 0 &&
              searchResults.positions.length === 0 && (
                <div className="px-3 py-3 text-xs" style={{ color: TEXT_MUTE }}>No matches.</div>
              )}
            {searchResults.clients.length > 0 && (
              <>
                <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider" style={{ color: TEXT_MUTE }}>
                  Portfolios
                </div>
                {searchResults.clients.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onOpenClient(c)}
                    className="w-full text-left px-3 py-2 text-xs flex items-center gap-2"
                    style={{ color: TEXT }}
                  >
                    <Users size={13} style={{ color: ACCENT_2 }} />
                    <span className="truncate">{c.name}</span>
                  </button>
                ))}
              </>
            )}
            {searchResults.managers.length > 0 && (
              <>
                <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider" style={{ color: TEXT_MUTE }}>
                  Managers
                </div>
                {searchResults.managers.map((m) => {
                  const mSois = store.soIs.filter((x) => x.managerId === m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() => onOpenManager(m, mSois)}
                      className="w-full text-left px-3 py-2 text-xs flex items-center gap-2"
                      style={{ color: TEXT }}
                    >
                      <Briefcase size={13} style={{ color: ACCENT_2 }} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate">{m.name}</div>
                        {m.firm && <div className="text-[10px] truncate" style={{ color: TEXT_MUTE }}>{m.firm}</div>}
                      </div>
                    </button>
                  );
                })}
              </>
            )}
            {searchResults.positions.length > 0 && (
              <>
                <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider" style={{ color: TEXT_MUTE }}>
                  Tokens
                </div>
                {searchResults.positions.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => onOpenToken(t)}
                    className="w-full text-left px-3 py-2 text-xs flex items-center gap-2"
                    style={{ color: TEXT }}
                  >
                    <TokenIcon ticker={t.ticker} name={t.name} size={20} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate">
                        <span style={{ fontWeight: 600 }}>{t.ticker || t.name}</span>
                        {t.ticker && t.name !== t.ticker && (
                          <span style={{ color: TEXT_DIM }}> · {t.name}</span>
                        )}
                      </div>
                      <div className="text-[10px] truncate" style={{ color: TEXT_MUTE }}>
                        {t.exposures.length === 1
                          ? `1 fund: ${t.exposures[0].manager?.name || '?'} · ${fundLabel(t.exposures[0].soi)}`
                          : `${t.exposures.length} funds`}
                      </div>
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
