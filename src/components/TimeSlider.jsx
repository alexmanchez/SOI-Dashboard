import { ArrowLeft } from 'lucide-react';

import { PANEL, PANEL_2, BORDER, TEXT, TEXT_DIM, TEXT_MUTE, ACCENT, GOLD } from '../lib/theme';
import { today } from '../lib/format';

/**
 * Horizontal slider with one tick per distinct snapshot date in the current
 * scope, plus a "Today" tick at the right end.
 *
 * Value model: the `value` prop is an ISO date string. When the rightmost
 * tick is selected ("Today"), the value stays at today's ISO — the rollup
 * treats that as "use latest snapshot per SOI" via snapshotAsOf.
 *
 * Renders nothing when there's 0 or 1 distinct historical date (the brief
 * asks us to hide it in those cases).
 */
export function TimeSlider({ dates, value, onChange }) {
  const todayStr = today();
  // Full tick list: each distinct historical date + Today (unless today is
  // already in the list, in which case we collapse).
  const sorted = [...(dates || [])].sort();
  const hasToday = sorted.includes(todayStr);
  const allTicks = hasToday ? sorted : [...sorted, todayStr];
  if (allTicks.length <= 1) return null;

  const historicalCount = allTicks.length - 1;
  // If current value is after every tick, clamp to last (Today).
  let index = allTicks.findIndex((d) => d === value);
  if (index < 0) {
    // Pick the largest tick <= value, else 0.
    let best = 0;
    for (let i = 0; i < allTicks.length; i++) {
      if (allTicks[i] <= (value || todayStr)) best = i;
    }
    index = best;
  }

  const isToday = allTicks[index] === todayStr;

  const handleSlide = (e) => {
    const next = Number(e.target.value);
    const nextDate = allTicks[next];
    onChange(nextDate);
  };

  const prettyDate = (iso) =>
    new Date(iso + 'T00:00:00Z').toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  return (
    <div
      className="rounded-lg p-3"
      style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}` }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider" style={{ color: TEXT_MUTE }}>
            Time travel
          </span>
          <span
            className="text-[11px] font-medium px-2 py-0.5 rounded"
            style={{
              backgroundColor: isToday ? ACCENT + '22' : GOLD + '22',
              color: isToday ? ACCENT : GOLD,
              border: `1px solid ${(isToday ? ACCENT : GOLD) + '55'}`,
            }}
          >
            {isToday ? 'Today · latest snapshots' : `Viewing as of ${prettyDate(allTicks[index])} — historical snapshot`}
          </span>
        </div>
        {!isToday && (
          <button
            onClick={() => onChange(todayStr)}
            className="text-[11px] px-2 py-0.5 rounded flex items-center gap-1"
            style={{ color: TEXT, backgroundColor: PANEL_2, border: `1px solid ${BORDER}` }}
          >
            <ArrowLeft size={11} /> Return to latest
          </button>
        )}
      </div>
      <input
        type="range"
        min={0}
        max={allTicks.length - 1}
        step={1}
        value={index}
        onChange={handleSlide}
        style={{
          width: '100%',
          accentColor: isToday ? ACCENT : GOLD,
          cursor: 'pointer',
        }}
      />
      <div
        className="relative mt-1"
        style={{ height: 14, marginLeft: 4, marginRight: 4 }}
      >
        {allTicks.map((tick, i) => {
          const pct = allTicks.length === 1 ? 50 : (i / (allTicks.length - 1)) * 100;
          const isNow = i === historicalCount;
          const isActive = i === index;
          return (
            <span
              key={tick}
              style={{
                position: 'absolute',
                left: `${pct}%`,
                transform: 'translateX(-50%)',
                fontSize: 10,
                whiteSpace: 'nowrap',
                color: isActive ? (isToday ? ACCENT : GOLD) : TEXT_DIM,
                fontWeight: isActive ? 600 : 400,
              }}
            >
              {isNow ? 'Today' : prettyDate(tick).replace(/, \d{4}$/, '')}
            </span>
          );
        })}
      </div>
    </div>
  );
}
