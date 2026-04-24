import { Home, Layers, Briefcase, Users, ChevronRight } from 'lucide-react';

import { BORDER, PANEL_2, TEXT, TEXT_MUTE, ACCENT_2 } from '../lib/theme';
import { fmtCurrency, fundLabel } from '../lib/format';
import { latestSnapshot } from '../lib/snapshots';

import { NavButton } from './ui';
import { CreateMenu } from './CreateMenu';

/**
 * Primary header row: brand + Home / Portfolios / Managers nav + Create menu.
 * Holds ONLY the nav buttons — search/settings/context-row stay in App.jsx.
 *
 * Stateless w.r.t. its own UI (the `openMenu` + flyout state lives in App so
 * the surrounding dropdown-dismiss overlay can coordinate), but encapsulates
 * the per-dropdown JSX + navigation side effects.
 */
export function TopNav({
  store,
  selection,
  tab,
  openMenu,
  flyoutManagerId,
  flyoutSoiId,
  setSelection,
  setTab,
  setDrilldownSoi,
  setSubPage,
  setOpenMenu,
  setFlyoutManagerId,
  setFlyoutSoiId,
  onCreatePortfolio,
  onCreateManager,
  onImport,
}) {
  const goHome = () => {
    setSelection({ kind: 'firm' });
    setTab('overview');
    setDrilldownSoi(null);
    setOpenMenu(null);
    setSubPage('dashboard');
  };

  const openClient = (id) => {
    setOpenMenu(null);
    setSelection({ kind: 'client', id });
    setTab('overview');
    setDrilldownSoi(null);
  };

  const openAllManagers = () => {
    setOpenMenu(null);
    setFlyoutManagerId(null);
    setFlyoutSoiId(null);
    setTab('managers');
    setDrilldownSoi(null);
  };

  return (
    <div className="flex items-center gap-1 ml-6">
      <NavButton
        active={tab === 'overview' && selection.kind === 'firm'}
        onClick={goHome}
        icon={Home}
      >
        Home
      </NavButton>

      {/* Portfolios dropdown */}
      <div style={{ position: 'relative' }}>
        <NavButton
          active={tab === 'positions' || openMenu === 'portfolios'}
          onClick={() => setOpenMenu(openMenu === 'portfolios' ? null : 'portfolios')}
          icon={Layers}
          hasCaret
        >
          Portfolios
        </NavButton>
        {openMenu === 'portfolios' && (
          <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 42 }}>
            <div
              className="rounded shadow-xl py-1"
              style={{ backgroundColor: PANEL_2, border: `1px solid ${BORDER}`, minWidth: 220 }}
            >
              <button
                onClick={goHome}
                className="w-full text-left px-3 py-2 text-xs flex items-center gap-2"
                style={{ color: TEXT }}
              >
                <Users size={13} style={{ color: ACCENT_2 }} />
                <span>All portfolios</span>
              </button>
              <div style={{ height: 1, backgroundColor: BORDER, margin: '4px 0' }} />
              {store.clients.length === 0 && (
                <div className="px-3 py-2 text-xs" style={{ color: TEXT_MUTE }}>No portfolios yet.</div>
              )}
              {store.clients.map((c) => (
                <button
                  key={c.id}
                  onClick={() => openClient(c.id)}
                  className="w-full text-left px-3 py-2 text-xs flex items-center gap-2"
                  style={{ color: TEXT }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ACCENT_2, flexShrink: 0 }} />
                  <span className="truncate">{c.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Managers cascading dropdown */}
      <div style={{ position: 'relative' }}>
        <NavButton
          active={tab === 'managers' || openMenu === 'managers'}
          onClick={() => {
            setOpenMenu(openMenu === 'managers' ? null : 'managers');
            setFlyoutManagerId(null);
            setFlyoutSoiId(null);
          }}
          icon={Briefcase}
          hasCaret
        >
          Managers
        </NavButton>
        {openMenu === 'managers' && (
          <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 42 }}>
            <div
              className="rounded shadow-xl py-1"
              style={{ backgroundColor: PANEL_2, border: `1px solid ${BORDER}`, minWidth: 260 }}
            >
              <button
                onClick={openAllManagers}
                className="w-full text-left px-3 py-2 text-xs flex items-center gap-2"
                style={{ color: TEXT }}
              >
                <Briefcase size={13} style={{ color: ACCENT_2 }} />
                <span>All managers</span>
              </button>
              <div style={{ height: 1, backgroundColor: BORDER, margin: '4px 0' }} />
              {store.managers.length === 0 && (
                <div className="px-3 py-2 text-xs" style={{ color: TEXT_MUTE }}>No managers yet.</div>
              )}
              {store.managers.map((m) => {
                const mSois = store.soIs.filter((x) => x.managerId === m.id);
                const isFoF = m.type === 'fund_of_funds';
                const isMOpen = flyoutManagerId === m.id;
                return (
                  <div key={m.id} style={{ position: 'relative' }}>
                    <button
                      onClick={() => {
                        // Clicking the manager name navigates to the manager's
                        // overview AND opens the vintage flyout so the user can
                        // optionally drill further.
                        setSelection({ kind: 'manager', id: m.id });
                        setTab('managers');
                        setDrilldownSoi(null);
                        setSubPage('dashboard');
                        if (mSois.length > 0) {
                          setFlyoutManagerId(isMOpen ? null : m.id);
                          setFlyoutSoiId(null);
                        } else {
                          setOpenMenu(null);
                          setFlyoutManagerId(null);
                          setFlyoutSoiId(null);
                        }
                      }}
                      className="w-full text-left px-3 py-2 text-xs flex items-center gap-2"
                      style={{ color: TEXT, backgroundColor: isMOpen ? BORDER + '66' : 'transparent' }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ACCENT_2, flexShrink: 0 }} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate flex items-center gap-1.5">
                          <span className="truncate">{m.name}</span>
                          {isFoF && (
                            <span
                              className="text-[9px] px-1 rounded flex-shrink-0"
                              style={{ backgroundColor: ACCENT_2 + '22', color: ACCENT_2 }}
                            >
                              FoF
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] truncate" style={{ color: TEXT_MUTE }}>
                          {mSois.length} {mSois.length === 1 ? 'vintage' : 'vintages'}
                        </div>
                      </div>
                      {mSois.length > 0 && <ChevronRight size={12} style={{ color: TEXT_MUTE, flexShrink: 0 }} />}
                    </button>

                    {/* Level 2: manager's vintages */}
                    {isMOpen && (
                      <div style={{ position: 'absolute', top: 0, left: '100%', marginLeft: 4 }}>
                        <div
                          className="rounded shadow-xl py-1"
                          style={{ backgroundColor: PANEL_2, border: `1px solid ${BORDER}`, minWidth: 260 }}
                        >
                          <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider" style={{ color: TEXT_MUTE }}>
                            {m.name} · funds
                          </div>
                          {mSois.map((soi) => {
                            const snap = latestSnapshot(soi);
                            const subs = snap?.subCommitments || [];
                            const hasSubs = isFoF && subs.length > 0;
                            const isVOpen = flyoutSoiId === soi.id;
                            return (
                              <div key={soi.id} style={{ position: 'relative' }}>
                                <button
                                  onClick={() => {
                                    if (hasSubs) {
                                      setFlyoutSoiId(isVOpen ? null : soi.id);
                                    } else {
                                      setOpenMenu(null);
                                      setFlyoutManagerId(null);
                                      setFlyoutSoiId(null);
                                      setTab('managers');
                                      setDrilldownSoi(soi.id);
                                    }
                                  }}
                                  className="w-full text-left px-3 py-2 text-xs flex items-center gap-2"
                                  style={{ color: TEXT, backgroundColor: isVOpen ? BORDER + '66' : 'transparent' }}
                                >
                                  <Layers size={13} style={{ color: ACCENT_2, flexShrink: 0 }} />
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate">{soi.fundName || soi.vintage}</div>
                                    <div className="text-[10px] truncate" style={{ color: TEXT_MUTE }}>
                                      {snap?.asOfDate ? `as of ${snap.asOfDate}` : 'no snapshot'}
                                      {hasSubs && ` · ${subs.length} underlying`}
                                    </div>
                                  </div>
                                  {hasSubs && <ChevronRight size={12} style={{ color: TEXT_MUTE, flexShrink: 0 }} />}
                                </button>

                                {/* Level 3: FoF underlying commitments */}
                                {isVOpen && hasSubs && (
                                  <div style={{ position: 'absolute', top: 0, left: '100%', marginLeft: 4 }}>
                                    <div
                                      className="rounded shadow-xl py-1"
                                      style={{ backgroundColor: PANEL_2, border: `1px solid ${BORDER}`, minWidth: 280 }}
                                    >
                                      <div
                                        className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider"
                                        style={{ color: TEXT_MUTE }}
                                      >
                                        {fundLabel(soi)} · underlying
                                      </div>
                                      {subs.map((sub, i) => {
                                        const subSoi = store.soIs.find((x) => x.id === sub.toSoiId);
                                        const subMgr = subSoi
                                          ? store.managers.find((mm) => mm.id === subSoi.managerId)
                                          : null;
                                        return (
                                          <button
                                            key={sub.toSoiId || i}
                                            onClick={() => {
                                              if (!subSoi) return;
                                              setOpenMenu(null);
                                              setFlyoutManagerId(null);
                                              setFlyoutSoiId(null);
                                              setTab('managers');
                                              setDrilldownSoi(subSoi.id);
                                            }}
                                            disabled={!subSoi}
                                            className="w-full text-left px-3 py-2 text-xs flex items-center gap-2"
                                            style={{ color: subSoi ? TEXT : TEXT_MUTE, opacity: subSoi ? 1 : 0.5 }}
                                          >
                                            <span
                                              style={{
                                                width: 6, height: 6, borderRadius: 3,
                                                backgroundColor: ACCENT_2, flexShrink: 0,
                                              }}
                                            />
                                            <div className="min-w-0 flex-1">
                                              <div className="truncate">
                                                {subMgr?.name || '(missing manager)'} — {fundLabel(subSoi)}
                                              </div>
                                              <div className="text-[10px] truncate" style={{ color: TEXT_MUTE }}>
                                                {fmtCurrency(sub.committed || 0)} committed
                                              </div>
                                            </div>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <CreateMenu
        open={openMenu === 'create'}
        onToggle={() => setOpenMenu(openMenu === 'create' ? null : 'create')}
        onClose={() => setOpenMenu(null)}
        onCreatePortfolio={onCreatePortfolio}
        onCreateManager={onCreateManager}
        onImport={onImport}
      />
    </div>
  );
}
