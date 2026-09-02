/**
 * CoinMarketCap proxy (Vercel serverless function).
 *
 * CMC rejects browser-origin requests (CORS) and a key shipped to the client
 * would be readable by anyone with devtools, so every CMC call goes through
 * here. The key is read from the CMC_API_KEY environment variable and never
 * leaves the server.
 *
 * Only the endpoints below are reachable — without a whitelist this would be an
 * open proxy that anyone could point at any CMC endpoint using our credits.
 */

const ALLOWED = {
  // Live prices. ~1 credit per 100 symbols.
  quotes: { path: '/v2/cryptocurrency/quotes/latest', params: ['symbol', 'convert'] },
  // Logos, descriptions, links.
  info:   { path: '/v2/cryptocurrency/info',          params: ['symbol'] },
  // Symbol -> CMC id resolution.
  map:    { path: '/v1/cryptocurrency/map',           params: ['symbol', 'limit'] },
};

const BASE = 'https://pro-api.coinmarketcap.com';

export default async function handler(req, res) {
  const apiKey = process.env.CMC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'CMC_API_KEY is not set on the server.',
      hint: 'Add it in your Vercel project settings, or to .env.local for local dev.',
    });
  }

  const { endpoint, ...rest } = req.query || {};
  const spec = ALLOWED[endpoint];
  if (!spec) {
    return res.status(400).json({
      error: `Unknown endpoint "${endpoint ?? ''}".`,
      allowed: Object.keys(ALLOWED),
    });
  }

  // Forward only the parameters this endpoint declares.
  const qs = new URLSearchParams();
  for (const p of spec.params) {
    if (rest[p] != null && rest[p] !== '') qs.set(p, String(rest[p]));
  }

  try {
    const upstream = await fetch(`${BASE}${spec.path}?${qs}`, {
      headers: { 'X-CMC_PRO_API_KEY': apiKey, Accept: 'application/json' },
    });
    const body = await upstream.json();

    if (!upstream.ok) {
      // Surface CMC's own message; it explains quota and plan errors precisely.
      return res.status(upstream.status).json({
        error: body?.status?.error_message || 'CoinMarketCap request failed.',
        code: body?.status?.error_code ?? null,
      });
    }

    // Quotes move constantly; metadata does not. Cache accordingly at the edge.
    res.setHeader('Cache-Control', endpoint === 'quotes'
      ? 's-maxage=60, stale-while-revalidate=120'
      : 's-maxage=86400, stale-while-revalidate=604800');

    return res.status(200).json(body);
  } catch (err) {
    return res.status(502).json({ error: 'Could not reach CoinMarketCap.', detail: String(err) });
  }
}
