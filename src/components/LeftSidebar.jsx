import React from 'react';
import {
  LayoutDashboard, Layers, PieChart as PieChartIcon, DollarSign,
} from 'lucide-react';

import { BORDER, PANEL, TEXT, TEXT_DIM, TEXT_MUTE, ACCENT, ACCENT_2 } from '../lib/theme';

export const SIDEBAR_SECTIONS = [
  { group: 'Overview', items: [
    { id: 'dashboard',      label: 'Dashboard',     icon: LayoutDashboard },
  ]},
  { group: 'Holdings', items: [
    { id: 'positions',      label: 'Positions',     icon: Layers },
    { id: 'exposures',      label: 'Exposures',     icon: PieChartIcon },
  ]},
  { group: 'Economics', items: [
    { id: 'fund-economics', label: 'Fund Economics', icon: DollarSign },
  ]},
];


export const LeftSidebar = ({ subPage, setSubPage, hiddenItems = [], extraSections = [], onDrillFund, activeFundId = null }) => (
  <aside
    className="flex-shrink-0"
    style={{
      width: 220,
      borderRight: `1px solid ${BORDER}`,
      backgroundColor: PANEL,
      minHeight: 'calc(100vh - 96px)',
    }}>
    <div className="py-4">
      {SIDEBAR_SECTIONS.map((section) => (
        <div key={section.group} className="mb-4">
          <div
            className="px-4 pb-1 text-[10px] uppercase tracking-wider"
            style={{ color: TEXT_MUTE }}>
            {section.group}
          </div>
          {section.items.filter((it) => !hiddenItems.includes(it.id)).map((item) => {
            const active = subPage === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setSubPage(item.id)}
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

      {/* Dynamic sections: "Funds" list on manager view, underlying-funds list on FoF, etc. */}
      {extraSections.map((section) => (
        <div key={section.group} className="mb-4">
          <div className="px-4 pb-1 text-[10px] uppercase tracking-wider" style={{ color: TEXT_MUTE }}>
            {section.group}
          </div>
          {section.items.map((item) => {
            const active = item.id && activeFundId === item.id;
            return (
              <button
                key={item.id || item.label}
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
            );
          })}
        </div>
      ))}
    </div>
  </aside>
);

/* Reusable empty-state panel for sub-pages that are not built out yet. */

