import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Serves /api/* from the same handlers Vercel runs in production, so `npm run dev`
 * behaves like the deployed app without needing the Vercel CLI. The key is read
 * from .env.local here and stays in the dev server process — it is never bundled
 * into client code (only VITE_-prefixed vars reach the browser, and this is not one).
 */
function apiRoutes(env) {
  return {
    name: 'catena-api-routes',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();

        const url = new URL(req.url, 'http://localhost');
        const name = url.pathname.replace(/^\/api\//, '').replace(/\/$/, '');

        let handler;
        try {
          // Cache-busted so edits to the handler take effect without a restart.
          ({ default: handler } = await server.ssrLoadModule(`/api/${name}.js`));
        } catch {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: `No API route /api/${name}` }));
        }

        // Minimal shims for the bits of the Vercel req/res contract we use.
        const vreq = { query: Object.fromEntries(url.searchParams), method: req.method, headers: req.headers };
        const vres = {
          statusCode: 200,
          status(code) { this.statusCode = code; return this; },
          setHeader(k, v) { res.setHeader(k, v); return this; },
          json(body) {
            res.statusCode = this.statusCode;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(body));
          },
        };

        // The handler reads process.env; .env.local is loaded into it below.
        try {
          await handler(vreq, vres);
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // '' prefix loads every var, not just VITE_ ones — these are for the dev
  // server process only and are not exposed to client code.
  const env = loadEnv(mode, process.cwd(), '');
  Object.assign(process.env, env);

  return {
    plugins: [react(), apiRoutes(env)],
    resolve: {
      alias: { '@': path.resolve(__dirname, './src') },
    },
    server: { port: 5173, open: true },
  };
});
