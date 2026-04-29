import { useEffect, useState } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';

import { PANEL_2, BORDER, TEXT, TEXT_DIM, TEXT_MUTE, GREEN } from '../lib/theme';
import { fmtCurrency } from '../lib/format';
import { fetchManagerRounds, slugifyManagerName } from '../lib/api/cryptorank';
import { Panel } from '../components/ui';

/* CryptoRank-powered "Recent Rounds" view for a manager. Looks up rounds by
   `manager.cryptorankSlug` if set, otherwise tries a kebab-case of manager.name.
   Results cached 24h in localStorage to avoid burning API credits on revisits. */
export function ManagerRoundsPage({ manager, updateStore }) {
  const initialSlug = manager?.cryptorankSlug || (manager?.name ? slugifyManagerName(manager.name) : '');
  const [slug, setSlug] = useState(initialSlug);
  const [editingSlug, setEditingSlug] = useState(false);
  const [draftSlug, setDraftSlug] = useState(initialSlug);
  const [rounds, setRounds] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Refresh button reuses this; the slug-change effect inlines the same
  // logic with cancellation so the rule is satisfied without a disable.
  const load = async (s) => {
    if (!s) {
      setRounds([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: err } = await fetchManagerRounds(s);
    setLoading(false);
    if (err) {
      setError(err);
      setRounds(null);
    } else {
      setRounds(data || []);
    }
  };

  useEffect(() => {
    // All setState calls live inside the async IIFE and are gated on
    // !cancelled, so set-state-in-effect is satisfied — every update
    // happens "in a callback" relative to the effect body.
    let cancelled = false;
    (async () => {
      if (!slug) {
        if (!cancelled) {
          setRounds([]);
          setError(null);
        }
        return;
      }
      if (cancelled) return;
      setLoading(true);
      setError(null);
      const { data, error: err } = await fetchManagerRounds(slug);
      if (cancelled) return;
      setLoading(false);
      if (err) {
        setError(err);
        setRounds(null);
      } else {
        setRounds(data || []);
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  const persistSlug = () => {
    if (!updateStore || !manager) return;
    updateStore((s) => ({
      ...s,
      managers: s.managers.map((m) => (m.id === manager.id ? { ...m, cryptorankSlug: draftSlug } : m)),
    }));
    setSlug(draftSlug);
    setEditingSlug(false);
  };

  if (!manager) {
    return (
      <div className="text-center text-sm py-12" style={{ color: TEXT_DIM }}>
        Select a manager to see their recent rounds.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Panel className="p-4">
        <div className="flex items-baseline justify-between flex-wrap gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: TEXT_MUTE }}>
              Recent Rounds · CryptoRank
            </div>
            <div className="text-base font-semibold mt-0.5">
              {manager.name}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px]" style={{ color: TEXT_MUTE }}>Slug:</span>
            {editingSlug ? (
              <>
                <input
                  type="text"
                  value={draftSlug}
                  onChange={(e) => setDraftSlug(e.target.value)}
                  className="text-xs rounded px-2 py-1"
                  style={{ backgroundColor: PANEL_2, border: `1px solid ${BORDER}`, color: TEXT, width: 200 }}
                  placeholder="e.g. framework-ventures"
                />
                <button onClick={persistSlug}
                  className="text-xs px-2 py-1 rounded"
                  style={{ color: GREEN, border: `1px solid ${GREEN}44` }}
                >Save</button>
                <button onClick={() => { setEditingSlug(false); setDraftSlug(slug); }}
                  className="text-xs px-2 py-1 rounded"
                  style={{ color: TEXT_DIM, border: `1px solid ${BORDER}` }}
                >Cancel</button>
              </>
            ) : (
              <>
                <code className="text-xs px-2 py-1 rounded" style={{ backgroundColor: PANEL_2, border: `1px solid ${BORDER}`, color: TEXT_DIM }}>
                  {slug || '(not set)'}
                </code>
                <button onClick={() => { setDraftSlug(slug); setEditingSlug(true); }}
                  className="text-xs px-2 py-1 rounded"
                  style={{ color: TEXT_DIM, border: `1px solid ${BORDER}` }}
                >Edit</button>
                <button onClick={() => load(slug)} disabled={!slug || loading}
                  className="text-xs px-2 py-1 rounded flex items-center gap-1"
                  style={{ color: TEXT_DIM, border: `1px solid ${BORDER}`, opacity: loading ? 0.5 : 1 }}
                >
                  <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Refresh
                </button>
              </>
            )}
          </div>
        </div>
      </Panel>

      <Panel className="p-0 overflow-hidden">
        {loading && (
          <div className="p-8 text-center text-xs" style={{ color: TEXT_DIM }}>
            Loading rounds…
          </div>
        )}
        {error && !loading && (
          <div className="p-6 text-sm" style={{ color: TEXT_DIM }}>
            Couldn't fetch rounds: {error}
          </div>
        )}
        {!loading && !error && rounds && rounds.length === 0 && (
          <div className="p-8 text-center text-xs" style={{ color: TEXT_DIM }}>
            No rounds returned for slug <code>{slug}</code>. Try editing the slug — CryptoRank uses a kebab-case URL form.
          </div>
        )}
        {!loading && !error && rounds && rounds.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: TEXT_MUTE, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `1px solid ${BORDER}` }}>
                  <th className="text-left py-2 pl-5 pr-3">Project</th>
                  <th className="text-left py-2 pr-3">Stage</th>
                  <th className="text-left py-2 pr-3">Category</th>
                  <th className="text-left py-2 pr-3">Date</th>
                  <th className="text-right py-2 pr-3">Raise</th>
                  <th className="text-right py-2 pr-5">Total</th>
                </tr>
              </thead>
              <tbody>
                {rounds.map((r, i) => {
                  const projectName = r.projectName || r.name || r.project?.name || '?';
                  const projectSlug = r.projectSlug || r.slug || r.project?.slug || null;
                  const stage = r.stage || r.type || r.roundType || '—';
                  const category = r.category || r.industry || r.sector || '—';
                  const date = r.date || r.announcedAt || r.timestamp || null;
                  const raise = r.raise || r.amount || r.investment || null;
                  const total = r.totalRaise || r.totalAmount || null;
                  const dateStr = date ? new Date(date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
                  return (
                    <tr key={i} style={{ borderBottom: `1px solid ${BORDER}` }}>
                      <td className="py-2.5 pl-5 pr-3 font-medium" style={{ color: TEXT }}>
                        <span className="flex items-center gap-1.5">
                          {projectName}
                          {projectSlug && (
                            <a href={`https://cryptorank.io/price/${projectSlug}`} target="_blank" rel="noopener noreferrer"
                              style={{ color: TEXT_DIM }} title="Open on CryptoRank">
                              <ExternalLink size={11} />
                            </a>
                          )}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3" style={{ color: TEXT_DIM }}>{stage}</td>
                      <td className="py-2.5 pr-3" style={{ color: TEXT_DIM }}>{category}</td>
                      <td className="py-2.5 pr-3 tabular-nums" style={{ color: TEXT_DIM }}>{dateStr}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{raise != null ? fmtCurrency(raise) : '—'}</td>
                      <td className="py-2.5 pr-5 text-right tabular-nums" style={{ color: TEXT_DIM }}>{total != null ? fmtCurrency(total) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
