import {
  useEffect, useMemo, useState,
} from 'react';
import {
  RefreshCw, X, Globe, Twitter, ExternalLink, Maximize2, Minimize2,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
} from 'recharts';

import {
  PANEL, PANEL_2, BORDER, TEXT, TEXT_DIM, TEXT_MUTE, GREEN, RED,
} from '../lib/theme';
import { fmtCurrency, fmtNum, fmtPctSigned, fundLabel } from '../lib/format';
import { latestSnapshot } from '../lib/snapshots';
import { fetchCoinDetail, fetchCoinChart } from '../lib/api/coingecko';
import { fetchProtocols, findProtocolMatch } from '../lib/api/defillama';
import { DETAIL_RANGES } from '../lib/ranges';

import { Pill } from './ui';
import { TokenIcon } from './TokenIcon';

export function TokenDetailDrawer({ token, onClose, apiKey, store }) {
  const [coin, setCoin] = useState(null);
  const [chart, setChart] = useState(null);
  const [range, setRange] = useState('365');
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(() => {
    // If we land with #/token/:id already in the URL, open expanded.
    const m = typeof window !== 'undefined' && /#\/token\//.test(window.location.hash);
    return !!m;
  });

  // Drive the URL hash off `expanded` so an expanded view is shareable.
  useEffect(() => {
    if (!token?.cgTokenId) return;
    const target = expanded ? `#/token/${encodeURIComponent(token.cgTokenId)}` : '';
    if (window.location.hash !== target) {
      if (target) window.history.replaceState(null, '', target);
      else window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, [expanded, token?.cgTokenId]);

  useEffect(() => {
    // When token has no cgTokenId we surface an inline error; when it does,
    // we synchronously mark loading before kicking off the fetch. Both are
    // "sync external data" flows — the React-blessed alternative (deriving
    // loading/error from props) would duplicate the state machine.
    if (!token?.cgTokenId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
      setError('This position has no CoinGecko ID linked.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      const [coinRes, chartRes] = await Promise.all([
        fetchCoinDetail(token.cgTokenId, apiKey),
        fetchCoinChart(token.cgTokenId, '365', apiKey),
      ]);
      if (cancelled) return;
      if (coinRes.error) setError(coinRes.error);
      setCoin(coinRes.data);
      setChart(chartRes.data);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [token?.cgTokenId, apiKey]);

  useEffect(() => {
    if (!token?.cgTokenId || range === '365') return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pre-fetch spinner
    setChartLoading(true);
    (async () => {
      const r = await fetchCoinChart(token.cgTokenId, range, apiKey);
      if (!cancelled) {
        if (r.data) setChart(r.data);
        setChartLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token?.cgTokenId, range, apiKey]);

  // Protocol TVL — match this token to a DefiLlama protocol by symbol/name.
  // Fetched once per hour and cached in localStorage; the global list isn't
  // tied to apiKey since DefiLlama is unauthenticated.
  const [protocol, setProtocol] = useState(null);
  useEffect(() => {
    if (!token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on token cleared, no synchronous prop->state derivation possible
      setProtocol(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await fetchProtocols();
      if (cancelled) return;
      const match = findProtocolMatch(data, {
        symbol: token.symbol || token.ticker,
        name: token.name,
      });
      setProtocol(match);
    })();
    return () => { cancelled = true; };
  }, [token]);

  const m = coin?.market_data;
  const price = m?.current_price?.usd ?? null;
  const change24h = m?.price_change_percentage_24h ?? null;
  const positive = change24h != null ? change24h >= 0 : true;
  const lineColor = positive ? GREEN : RED;

  const series = useMemo(() => {
    if (!chart?.prices) return [];
    return chart.prices.map(([t, p]) => ({ t, p }));
  }, [chart]);

  const fmtPrice = (v) => {
    if (v == null || isNaN(v)) return '–';
    const abs = Math.abs(v);
    const digits = abs < 0.01 ? 6 : abs < 1 ? 4 : 2;
    return '$' + v.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  };

  return (
    <>
      <div onClick={onClose}
        style={{ position: 'fixed', inset: 0, backgroundColor: '#000', opacity: 0.55, zIndex: 90 }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: expanded ? 'min(1200px, 96vw)' : 540, maxWidth: '100vw',
        backgroundColor: PANEL, borderLeft: `1px solid ${BORDER}`, zIndex: 91,
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
        boxShadow: '-20px 0 60px rgba(0,0,0,0.5)',
        transition: 'width 200ms cubic-bezier(0.22, 1, 0.36, 1)',
      }}>
        <div style={{ padding: 20, borderBottom: `1px solid ${BORDER}`, position: 'sticky', top: 0, backgroundColor: PANEL, zIndex: 2 }}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <TokenIcon ticker={token.symbol || token.ticker} name={token.name} size={40} />
              <div className="min-w-0">
                <div className="text-lg font-bold truncate tracking-tight" style={{ color: TEXT }}>{coin?.name || token.name || token.symbol}</div>
                <div className="text-xs" style={{ color: TEXT_DIM }}>
                  {(token.symbol || token.ticker || '').toUpperCase()}
                  {coin?.market_cap_rank ? ` · Rank #${coin.market_cap_rank}` : ''}
                  {token.cgTokenId ? ` · ${token.cgTokenId}` : ''}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={() => setExpanded((v) => !v)} className="p-1.5 rounded"
                style={{ color: TEXT_DIM, backgroundColor: PANEL_2, border: `1px solid ${BORDER}` }}
                title={expanded ? 'Shrink drawer' : 'Expand drawer'}>
                {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
              <button onClick={onClose} className="p-1.5 rounded"
                style={{ color: TEXT_DIM, backgroundColor: PANEL_2, border: `1px solid ${BORDER}` }}
                title="Close"><X size={14}/></button>
            </div>
          </div>
          {price != null && (
            <div className="flex items-baseline gap-3 mt-4 flex-wrap">
              <div className="text-3xl font-bold tracking-tight tabular-nums"
                style={{ color: TEXT, textShadow: '0 0 1px rgba(255,255,255,0.08)' }}>
                {fmtPrice(price)}
              </div>
              {change24h != null && (
                <div style={{ color: positive ? GREEN : RED }} className="text-base font-semibold">
                  {positive ? '▲' : '▼'} {fmtPctSigned(change24h, 2)} <span style={{ color: TEXT_DIM }}>24h</span>
                </div>
              )}
            </div>
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-center p-10 text-xs gap-2" style={{ color: TEXT_DIM }}>
            <RefreshCw size={14} className="animate-spin" /> Loading from CoinGecko…
          </div>
        )}

        {error && !coin && (
          <div className="p-5 text-xs m-4 rounded" style={{ backgroundColor: RED + '11', color: RED, border: `1px solid ${RED}44` }}>
            {error}
          </div>
        )}

        {coin && (
          <>
            <div style={{ padding: 20, borderBottom: `1px solid ${BORDER}` }}>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs uppercase tracking-wider" style={{ color: TEXT_MUTE }}>Price history</div>
                <div className="flex items-center gap-1">
                  {DETAIL_RANGES.map(r => (
                    <Pill key={r.id} active={range === r.id} onClick={() => setRange(r.id)}>{r.label}</Pill>
                  ))}
                </div>
              </div>
              {series.length > 0 ? (
                <div style={{ height: 200, position: 'relative' }}>
                  {chartLoading && (
                    <div style={{ position: 'absolute', top: 4, right: 4, zIndex: 1 }}>
                      <RefreshCw size={12} className="animate-spin" style={{ color: TEXT_DIM }} />
                    </div>
                  )}
                  <ResponsiveContainer>
                    <AreaChart data={series} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="tokenDetailGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={lineColor} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="t" tick={{ fontSize: 10, fill: TEXT_MUTE }} axisLine={false} tickLine={false}
                        tickFormatter={(ms) => {
                          const d = new Date(ms);
                          if (range === '1') return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                          if (range === '7' || range === '30') return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
                          return d.toLocaleDateString([], { month: 'short', year: '2-digit' });
                        }} minTickGap={40} />
                      <YAxis tick={{ fontSize: 10, fill: TEXT_MUTE }} axisLine={false} tickLine={false} width={55}
                        tickFormatter={(v) => v >= 1 ? '$' + v.toFixed(0) : '$' + v.toFixed(3)} />
                      <Tooltip
                        contentStyle={{ backgroundColor: PANEL_2, border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 12 }}
                        labelStyle={{ color: TEXT_DIM }}
                        itemStyle={{ color: TEXT }}
                        labelFormatter={(ms) => new Date(ms).toLocaleString()}
                        formatter={(v) => [fmtPrice(v), 'Price']} />
                      <Area type="monotone" dataKey="p" stroke={lineColor} strokeWidth={1.5} fill="url(#tokenDetailGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-xs p-6 rounded text-center" style={{ backgroundColor: PANEL_2, color: TEXT_DIM, border: `1px dashed ${BORDER}` }}>
                  No chart data returned.
                </div>
              )}
            </div>

            {(() => {
              if (!store || !token) return null;
              const sym = (token.symbol || token.ticker || '').toUpperCase();
              const cg = token.cgTokenId;
              const rows = [];
              for (const soi of (store.soIs || [])) {
                const snap = latestSnapshot(soi);
                if (!snap) continue;
                const mgr = (store.managers || []).find(m => m.id === soi.managerId);
                for (const p of (snap.positions || [])) {
                  const match = (p.cgTokenId && cg && p.cgTokenId === cg) ||
                                (sym && (p.ticker || '').toUpperCase() === sym);
                  if (!match) continue;
                  rows.push({ manager: mgr, soi, position: p, asOfDate: snap.asOfDate });
                }
              }
              if (rows.length === 0) return null;
              const totalValue = rows.reduce((sum, r) => sum + (r.position.soiMarketValue || 0), 0);
              return (
                <div style={{ padding: 20, borderBottom: `1px solid ${BORDER}` }}>
                  <div className="flex items-baseline justify-between mb-3">
                    <div className="text-xs uppercase tracking-wider" style={{ color: TEXT_MUTE }}>Your exposure</div>
                    <div className="text-[10px]" style={{ color: TEXT_DIM }}>
                      {rows.length} {rows.length === 1 ? 'fund' : 'funds'} · {fmtCurrency(totalValue)}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {rows.map((r, i) => (
                      <div key={i} className="flex items-baseline justify-between gap-2 text-xs py-1"
                        style={{ borderBottom: i < rows.length - 1 ? `1px solid ${BORDER}` : 'none', paddingBottom: 8 }}>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate" style={{ color: TEXT }}>{r.manager?.name || '?'}</div>
                          <div className="text-[10px] truncate" style={{ color: TEXT_DIM }}>
                            {fundLabel(r.soi)}
                            {r.position.acquisitionDate && ` · as of ${r.position.acquisitionDate}`}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="tabular-nums font-semibold" style={{ color: TEXT }}>{fmtCurrency(r.position.soiMarketValue)}</div>
                          {r.position.quantity > 0 && (
                            <div className="text-[10px] tabular-nums" style={{ color: TEXT_DIM }}>
                              {fmtNum(r.position.quantity, 2)} {r.position.ticker}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            <div style={{ padding: 20, borderBottom: `1px solid ${BORDER}` }}>
              <div className="text-xs uppercase tracking-wider mb-3" style={{ color: TEXT_MUTE }}>Market</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <DetailStat label="Market Cap" value={fmtCurrency(m?.market_cap?.usd)} />
                <DetailStat label="24h Volume" value={fmtCurrency(m?.total_volume?.usd)} />
                <DetailStat label="FDV" value={fmtCurrency(m?.fully_diluted_valuation?.usd)} />
                <DetailStat label="Vol / Mkt Cap"
                  value={(m?.market_cap?.usd && m?.total_volume?.usd) ? ((m.total_volume.usd / m.market_cap.usd) * 100).toFixed(2) + '%' : '–'} />
                <DetailStat label="Supply"
                  value={m?.circulating_supply ? fmtNum(m.circulating_supply) : null}
                  sub={m?.total_supply && m.circulating_supply && m.total_supply !== m.circulating_supply ? `Total: ${fmtNum(m.total_supply)}` : null} />
                <DetailStat label="ATH"
                  value={m?.ath?.usd ? fmtPrice(m.ath.usd) : '–'}
                  sub={m?.ath_change_percentage?.usd != null ? fmtPctSigned(m.ath_change_percentage.usd, 1) + ' from ATH' : null} />
                <DetailStat label="ATL"
                  value={m?.atl?.usd ? fmtPrice(m.atl.usd) : '–'}
                  sub={m?.atl_change_percentage?.usd != null ? fmtPctSigned(m.atl_change_percentage.usd, 0) + ' from ATL' : null} />
                <DetailStat label="Change (7d)"
                  value={m?.price_change_percentage_7d != null ? fmtPctSigned(m.price_change_percentage_7d, 2) : '–'} />
              </div>
            </div>

            {protocol && (
              <div style={{ padding: 20, borderBottom: `1px solid ${BORDER}` }}>
                <div className="flex items-baseline justify-between mb-3">
                  <div className="text-xs uppercase tracking-wider" style={{ color: TEXT_MUTE }}>
                    Protocol TVL · DefiLlama
                  </div>
                  <div className="text-[10px]" style={{ color: TEXT_DIM }}>
                    {protocol.name}{protocol.category ? ` · ${protocol.category}` : ''}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider" style={{ color: TEXT_MUTE }}>TVL</div>
                    <div className="text-base font-semibold tabular-nums mt-0.5" style={{ color: TEXT }}>
                      {fmtCurrency(protocol.tvl)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider" style={{ color: TEXT_MUTE }}>1d</div>
                    <div className="text-base font-medium tabular-nums mt-0.5"
                      style={{ color: protocol.change_1d == null ? TEXT_DIM : (protocol.change_1d >= 0 ? GREEN : RED) }}>
                      {protocol.change_1d == null ? '—' : fmtPctSigned(protocol.change_1d, 2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider" style={{ color: TEXT_MUTE }}>7d</div>
                    <div className="text-base font-medium tabular-nums mt-0.5"
                      style={{ color: protocol.change_7d == null ? TEXT_DIM : (protocol.change_7d >= 0 ? GREEN : RED) }}>
                      {protocol.change_7d == null ? '—' : fmtPctSigned(protocol.change_7d, 2)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {coin.links && (
              <div style={{ padding: 20, borderBottom: `1px solid ${BORDER}` }}>
                <div className="text-xs uppercase tracking-wider mb-3" style={{ color: TEXT_MUTE }}>Links</div>
                <div className="flex flex-wrap gap-1.5">
                  {coin.links.homepage?.[0] && <DetailLink href={coin.links.homepage[0]} icon={Globe} label="Website" />}
                  {coin.links.twitter_screen_name && <DetailLink href={`https://twitter.com/${coin.links.twitter_screen_name}`} icon={Twitter} label="X" />}
                  {coin.links.subreddit_url && <DetailLink href={coin.links.subreddit_url} icon={Globe} label="Reddit" />}
                  {coin.links.telegram_channel_identifier && <DetailLink href={`https://t.me/${coin.links.telegram_channel_identifier}`} icon={Globe} label="Telegram" />}
                  {(coin.links.blockchain_site || []).filter(Boolean).slice(0, 2).map((url, i) => (
                    <DetailLink key={i} href={url} icon={ExternalLink} label="Explorer" />
                  ))}
                </div>
              </div>
            )}

            {coin.description?.en && (
              <div style={{ padding: 20 }}>
                <div className="text-xs uppercase tracking-wider mb-2" style={{ color: TEXT_MUTE }}>About</div>
                <div className="text-xs" style={{ color: TEXT_DIM, lineHeight: 1.55 }}>
                  {coin.description.en.split(/\s+/).slice(0, 120).join(' ').replace(/<[^>]+>/g, '')}
                  {coin.description.en.split(/\s+/).length > 120 && '…'}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}


export const DetailStat = ({ label, value, sub }) => {
  // Hide stats with no actual data so the grid doesn't advertise empty fields.
  if (value == null || value === '–' || value === '—' || value === '∞') return null;
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider" style={{ color: TEXT_MUTE }}>{label}</div>
      <div className="tabular-nums font-semibold text-base" style={{ color: TEXT }}>{value}</div>
      {sub && <div className="text-[10px] tabular-nums" style={{ color: TEXT_DIM }}>{sub}</div>}
    </div>
  );
};


export const DetailLink = ({ href, icon: Icon, label }) => (
  <a href={href} target="_blank" rel="noopener noreferrer"
    className="flex items-center gap-1 px-2 py-1 rounded text-[11px] hover:opacity-80 transition-opacity"
    style={{ backgroundColor: PANEL_2, border: `1px solid ${BORDER}`, color: TEXT_DIM }}>
    <Icon size={11} /> {label} <ExternalLink size={9} style={{ opacity: 0.6 }} />
  </a>
);

/* Left-hand sidebar for the portfolio / manager workspace. Shows sub-page
   navigation within the current entity (Dashboard / Positions / Exposures /
   Fund Economics), echoing the workbench-style nav pattern. */

