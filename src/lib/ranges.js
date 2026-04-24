// Time range pills for performance charts + helpers to turn them into ms windows.
export const RANGES = [
  { id: '1D',  label: '1D',  days: 1 },
  { id: 'MTD', label: 'MTD', days: null },
  { id: 'YTD', label: 'YTD', days: null },
  { id: '1Y',  label: '1Y',  days: 365 },
  { id: 'SI',  label: 'SI',  days: null },
];

export const MOVER_RANGES = [
  { id: '1D',  label: '1D'  },
  { id: 'MTD', label: 'MTD' },
  { id: 'YTD', label: 'YTD' },
  { id: '1Y',  label: '1Y'  },
  { id: '5Y',  label: '5Y'  },
];

export const DETAIL_RANGES = [
  { id: '1',   label: '24h' },
  { id: '7',   label: '7D'  },
  { id: '30',  label: '1M'  },
  { id: '90',  label: '3M'  },
  { id: '365', label: '1Y'  },
  { id: 'max', label: 'All' },
];

export const rangeToStartMs = (rangeId, positions) => {
  const now = Date.now();
  const dayMs = 86400000;
  if (rangeId === '1D') return now - dayMs;
  if (rangeId === 'MTD') {
    const d = new Date();
    d.setUTCDate(1); d.setUTCHours(0, 0, 0, 0);
    return d.getTime();
  }
  if (rangeId === 'YTD') {
    const d = new Date();
    d.setUTCMonth(0, 1); d.setUTCHours(0, 0, 0, 0);
    return d.getTime();
  }
  if (rangeId === '1Y') return now - 365 * dayMs;
  if (rangeId === '5Y') return now - 5 * 365 * dayMs;
  if (rangeId === 'SI') {
    const dates = positions
      .map((p) => (p.acquisitionDate ? new Date(p.acquisitionDate).getTime() : null))
      .filter(Boolean);
    return dates.length ? Math.min(...dates) : now - 365 * dayMs;
  }
  return now - 30 * dayMs;
};

export const rangeToDays = (rangeId, positions) => {
  const startMs = rangeToStartMs(rangeId, positions);
  return Math.max(2, Math.ceil((Date.now() - startMs) / 86400000));
};
