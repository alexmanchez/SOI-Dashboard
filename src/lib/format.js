// Currency / percent / number formatters and tiny id helpers.
export const fmtCurrency = (v, digits) => {
  if (v === null || v === undefined || isNaN(v)) return '\u2013';
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  const d = digits !== undefined ? digits : (abs >= 1e6 ? 2 : abs >= 1e3 ? 1 : 0);
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(d)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(d)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(d)}K`;
  return `${sign}$${abs.toFixed(d)}`;
};
export const fmtPct = (v, d = 2) =>
  v === null || v === undefined || isNaN(v) ? '\u2013' : `${v.toFixed(d)}%`;
export const fmtPctSigned = (v, d = 2) => {
  if (v === null || v === undefined || isNaN(v)) return '\u2013';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(d)}%`;
};
export const fmtMoic = (v) =>
  v === null || v === undefined || isNaN(v) || !isFinite(v) ? '\u2014' : `${v.toFixed(2)}\u00d7`;
export const uid = () => Math.random().toString(36).slice(2, 10);

export const fmtNum = (v, digits) => {
  if (v === null || v === undefined || isNaN(v)) return '\u2013';
  const abs = Math.abs(v);
  const d = digits !== undefined ? digits : 2;
  if (abs >= 1e12) return (v / 1e12).toFixed(d) + 'T';
  if (abs >= 1e9) return (v / 1e9).toFixed(d) + 'B';
  if (abs >= 1e6) return (v / 1e6).toFixed(d) + 'M';
  if (abs >= 1e3) return (v / 1e3).toFixed(d) + 'K';
  return Math.round(v).toLocaleString();
};

// Human-friendly fund label: "Fund Name (2023)" when both are present.
export const fundLabel = (soi) => {
  if (!soi) return '\u2014';
  const fund = soi.fundName;
  const year = soi.vintage;
  if (fund && year) return `${fund} (${year})`;
  return fund || year || '\u2014';
};
export const today = () => new Date().toISOString().slice(0, 10);
