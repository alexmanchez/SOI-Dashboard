import { Calendar } from 'lucide-react';

import { GOLD } from '../lib/theme';

/**
 * Small gold pill showing the effective as-of date for a view.
 *
 * Pass `dates` — an array of every snapshot date contributing to the view.
 * If they disagree, the pill shows the oldest and says "Oldest data" with a
 * tooltip noting that some managers may be fresher; otherwise "Data as of".
 */
export function AsOfPill({ dates, label, onClick }) {
  const ds = (dates || []).filter(Boolean);
  if (!ds.length) return null;
  const sorted = [...ds].sort();
  const oldest = sorted[0];
  const isMulti = new Set(ds).size > 1;
  const displayLabel = label || (isMulti ? 'Oldest data' : 'Data as of');
  const pretty = new Date(oldest + 'T00:00:00Z').toLocaleDateString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded"
      style={{
        backgroundColor: GOLD + '22',
        color: GOLD,
        border: `1px solid ${GOLD}55`,
        cursor: onClick ? 'pointer' : 'default',
      }}
      title={
        isMulti
          ? "Some managers' data may be newer. See individual SOIs for details."
          : undefined
      }
      onClick={onClick}
    >
      <Calendar size={11} />
      {displayLabel}: {pretty}
    </span>
  );
}
