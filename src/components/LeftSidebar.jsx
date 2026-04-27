import {
  LayoutDashboard, Layers, PieChart as PieChartIcon, DollarSign, TrendingUp,
} from 'lucide-react';

import { BORDER, PANEL, TEXT, TEXT_DIM, TEXT_MUTE, ACCENT, ACCENT_2 } from '../lib/theme';

// Top-level sidebar items for the firm/client/manager scope (no fund drilled).
// When a fund is drilled, the per-fund nested tabs (Holdings/Positions/Economics)
// take over from these — see the children rendering in extraSections below.
export const SIDEBAR_SECTIONS = [
  { group: 'Overview', items: [
    { id: 'dashboard',      label: 'Dashboard',     icon: LayoutDashboard },
    { id: 'rounds',         label: 'Recent Rounds', icon: TrendingUp },
  ]},
  { group: 'Holdings', items: [
    { id: 'positions',      label: 'Positions',     icon: Layers },
    { id: 'exposures',      label: 'Exposures',     icon: PieChartIcon },
  ]},
  { group: 'Economics', items: [
    { id: 'fund-economics', label: 'Fund Economics', icon: DollarSign },
  ]},
];

// Per-fund nested sub-tabs. App.jsx threads these in via the `children` field
// on each fund item in extraSections. Keeping the icon set here so the sidebar
// owns the visual treatment.
export const FUND_SUB_TABS = [
  { id: 'dashboard',      label: 'Holdings',  icon: LayoutDashboard },
  { id: 'positions',      label: 'Positions', icon: Layers },
  { id: 'fund-economics', label: 'Economics', icon: DollarSign },
];

export const LeftSidebar = ({
  subPage,
  setSubPage,
  hiddenItems = [],
  extraSections = [],
  onDrillFund,
  activeFundId = null,
  setDrilldownSoi,
}) => (
  <aside
    className="flex-shrink-0"
    style={{
      width: 220,
      borderRight: `1px solid ${BORDER}`,
      backgroundColor: PANEL,
      minHeight: 'calc(100vh - 96px)',
    }}>
    <div className="py-4">
      {/* Top-level firm/client/manager-scoped sections. Always visible — clicking
          any static item also un-drills, so the user can step back out of a fund
          without using the breadcrumb. */}
      {SIDEBAR_SECTIONS.map((section) => (
        <div key={section.group} className="mb-4">
          <div
            className="px-4 pb-1 text-[10px] uppercase tracking-wider"
            style={{ color: TEXT_MUTE }}>
            {section.group}
          </div>
          {section.items.filter((it) => !hiddenItems.includes(it.id)).map((item) => {
            // While drilled into a fund, top-level items should never appear
            // active — the per-fund nested sub-tab is the real current location.
            const active = !activeFundId && subPage === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setSubPage(item.id);
                  if (setDrilldownSoi) setDrilldownSoi(null);
                }}
                className="w-full text-left px-4 py-2 text-xs flex items-center gap-2 transition-colors"
                style={{
                  color: active ? TEXT : TEXT_DIM,
                  backgroundColor: active ? ACCENT + '18' : 'transparent',
                  borderLeft: `2px solid ${active ? ACCENT : 'transparent'}`,
                }}>
                <Icon size={13} style={{ color: active ? ACCENT_2 : TEXT_MUTE }} />
                {item.label}
              </button>
            );
          })}
        </div>
      ))}

      {/* Dynamic sections — "Funds" list. When a fund is the active drill-down
          target, render its nested sub-tabs (Holdings / Positions / Economics)
          underneath, indented. */}
      {extraSections.map((section) => (
        <div key={section.group} className="mb-4">
          <div className="px-4 pb-1 text-[10px] uppercase tracking-wider" style={{ color: TEXT_MUTE }}>
            {section.group}
          </div>
          {section.items.map((item) => {
            const active = item.id && activeFundId === item.id;
            const showChildren = active && Array.isArray(item.children) && item.children.length > 0;
            return (
              <div key={item.id || item.label}>
                <button
                  onClick={() => item.onClick ? item.onClick() : (onDrillFund && item.id && onDrillFund(item.id))}
                  className="w-full text-left px-4 py-2 text-xs flex items-center gap-2 transition-colors"
                  style={{
                    color: active ? TEXT : TEXT_DIM,
                    backgroundColor: active ? ACCENT + '18' : 'transparent',
                    borderLeft: `2px solid ${active ? ACCENT : 'transparent'}`,
                  }}>
                  <Layers size={13} style={{ color: active ? ACCENT_2 : TEXT_MUTE, flexShrink: 0 }} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{item.label}</div>
                    {item.sub && <div className="text-[10px] truncate" style={{ color: TEXT_MUTE }}>{item.sub}</div>}
                  </div>
                </button>
                {showChildren && (
                  <div>
                    {item.children.map((child) => {
                      if (hiddenItems.includes(child.id)) return null;
                      const childActive = subPage === child.id;
                      const ChildIcon = child.icon;
                      return (
                        <button
                          key={child.id}
                          onClick={() => (child.onClick ? child.onClick() : setSubPage(child.id))}
                          className="w-full text-left text-xs flex items-center gap-2 transition-colors"
                          style={{
                            color: childActive ? TEXT : TEXT_DIM,
                            backgroundColor: childActive ? ACCENT + '14' : 'transparent',
                            borderLeft: `2px solid ${childActive ? ACCENT : 'transparent'}`,
                            paddingLeft: 32,
                            paddingRight: 16,
                            paddingTop: 6,
                            paddingBottom: 6,
                          }}>
                          {ChildIcon && <ChildIcon size={11} style={{ color: childActive ? ACCENT_2 : TEXT_MUTE }} />}
                          {child.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  </aside>
);

/* Reusable empty-state panel for sub-pages that are not built out yet. */
