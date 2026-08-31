import { useEffect, useRef, useState } from 'react';

import { PANEL, BORDER, TEXT, TEXT_DIM, ACCENT } from '../lib/theme';
import { fetchAllCoins, searchCoins, searchCoinsRemote, mergeCoinMatches } from '../lib/api/coingecko';

/* Inline coin-search input. As the user types, hits a 24h-cached
   CoinGecko /coins/list and surfaces up to 8 matches in a dropdown.
   - Picking a match calls onSelect({ id, symbol, name }) so the caller
     can populate cgTokenId / ticker / positionName in one shot.
   - Free-text fallback: typing something with no match (or pressing
     Enter on a non-match) calls onSelect({ id: null, symbol: '', name })
     so warrants/SAFTs not on CoinGecko still flow through.
   - Keyboard nav: ↑ ↓ to highlight, Enter to pick, Esc to close. */
export function TokenSearch({
  value,
  onChange,
  onSelect,
  apiKey,
  autoFocus,
  placeholder,
}) {
  const [coins, setCoins] = useState(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await fetchAllCoins(apiKey);
      if (!cancelled && data) setCoins(data);
    })();
    return () => { cancelled = true; };
  }, [apiKey]);

  useEffect(() => {
    if (autoFocus && inputRef.current) inputRef.current.focus();
  }, [autoFocus]);

  /* Local list gives instant, offline-safe matches; CoinGecko's /search adds
     market-cap ordering, which is the only thing that reliably breaks ticker
     collisions ("btc" is shared by hundreds of coins). Remote is debounced and
     purely additive — if it's slow, rate-limited, or offline, the local list
     still drives the dropdown. */
  const [remote, setRemote] = useState([]);
  const localMatches = coins ? searchCoins(coins, value, 8) : [];

  useEffect(() => {
    const q = (value || '').trim();
    let cancelled = false;
    // All state writes happen inside the debounce callback, never synchronously
    // in the effect body.
    const t = setTimeout(async () => {
      if (cancelled) return;
      if (q.length < 2) { setRemote([]); return; }
      const hits = await searchCoinsRemote(q, apiKey);
      if (!cancelled) setRemote(hits);
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [value, apiKey]);

  const matches = mergeCoinMatches(remote, localMatches, 8);

  const pickCoin = (coin) => {
    onSelect({
      id: coin.id,
      symbol: (coin.symbol || '').toUpperCase(),
      name: coin.name,
    });
    setOpen(false);
  };

  const commitFreeText = () => {
    const txt = (value || '').trim();
    if (!txt) return;
    onSelect({ id: null, symbol: '', name: txt });
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (open && matches.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlight((h) => Math.min(matches.length - 1, h + 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlight((h) => Math.max(0, h - 1));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        pickCoin(matches[highlight]);
        return;
      }
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      commitFreeText();
    }
  };

  return (
    <div className="relative w-full">
      <input
        ref={inputRef}
        type="text"
        value={value || ''}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setHighlight(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
        onKeyDown={onKeyDown}
        placeholder={placeholder || 'Search tokens or type a custom name…'}
        className="bg-transparent border-none outline-none w-full text-sm"
        style={{ color: TEXT }}
      />
      {open && (matches.length > 0 || value) && (
        <div
          className="absolute rounded shadow-lg overflow-hidden"
          style={{
            backgroundColor: PANEL,
            border: `1px solid ${BORDER}`,
            minWidth: 320,
            maxHeight: 320,
            overflowY: 'auto',
            left: 0,
            top: '100%',
            marginTop: 4,
            zIndex: 1000,
          }}
        >
          {matches.map((c, i) => (
            <div
              key={c.id}
              onMouseDown={() => pickCoin(c)}
              onMouseEnter={() => setHighlight(i)}
              className="px-3 py-2 cursor-pointer flex items-baseline gap-2"
              style={{
                backgroundColor: i === highlight ? ACCENT + '14' : 'transparent',
                borderBottom: `1px solid ${BORDER}`,
              }}
            >
              <span className="text-xs font-semibold" style={{ color: TEXT, minWidth: 50 }}>
                {(c.symbol || '').toUpperCase()}
              </span>
              <span className="text-xs truncate" style={{ color: TEXT_DIM }}>
                {c.name}
              </span>
            </div>
          ))}
          {value && (
            <div
              onMouseDown={commitFreeText}
              className="px-3 py-2 cursor-pointer flex items-baseline gap-2 text-xs"
              style={{
                backgroundColor: matches.length === 0 ? ACCENT + '14' : 'transparent',
                color: TEXT_DIM,
              }}
            >
              <span style={{ color: ACCENT }}>+</span>
              Add as custom: <span style={{ color: TEXT }}>"{value}"</span>
            </div>
          )}
          {!coins && (
            <div className="px-3 py-2 text-[10px]" style={{ color: TEXT_DIM }}>
              Loading token list…
            </div>
          )}
        </div>
      )}
    </div>
  );
}
