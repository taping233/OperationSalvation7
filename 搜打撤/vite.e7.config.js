import base from './vite.config.js';
import { appendFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const dir = fileURLToPath(new URL('./docs/evidence/e7-integration-2026-09-27/', import.meta.url));
const prefix = '/@fs/' + fileURLToPath(new URL('./docs/previews/e7-integration-acceptance/', import.meta.url)).replaceAll('\\', '/');
let fault = { mode: 'none', hits: 0 };
const pending = new Set();
const event = value => { mkdirSync(dir, { recursive: true }); appendFileSync(dir + '/events.jsonl', JSON.stringify({ time: new Date().toISOString(), ...value }) + '\n'); };
export default {
  ...base,
  server: { ...base.server, host: '127.0.0.1', port: 52971, strictPort: true },
  plugins: [...base.plugins, {
    name: 'e7-isolated-acceptance', apply: 'serve',
    transformIndexHtml: { order: 'pre', handler(html, ctx) {
      if (!new URL(ctx.originalUrl || ctx.path, 'http://127.0.0.1:52971').searchParams.has('e7')) return html;
      return html.replace('<script type="module" src="./src/main.js"></script>', '<script type="module" src="/__e7__/entry.js"></script>');
    } },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.headers.host !== '127.0.0.1:52971') return next();
        const url = new URL(req.url, 'http://127.0.0.1:52971');
        if (url.pathname === '/__e7__/entry.js') {
          res.setHeader('Content-Type', 'text/javascript');
          res.end('import ' + JSON.stringify(prefix + 'bootstrap.js') + ';\nimport "/src/main.js";'); return;
        }
        if (url.pathname === '/__e7__/module') {
          const mode = url.searchParams.get('mode');
          if (mode && ['none', 'delay', 'fail', 'release'].includes(mode)) {
            if (mode === 'release' || mode === 'none') { for (const go of pending) go(); pending.clear(); }
            fault = { mode: mode === 'release' ? 'none' : mode, hits: 0 };
            event({ kind: 'module-arm', ...fault });
          }
          res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ ...fault, pending: pending.size })); return;
        }
        if (url.pathname === '/__e7__/evidence' && req.method === 'POST') {
          let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 2000000) { res.statusCode = 413; res.end(); return; } }
          try { event({ kind: 'browser', ...JSON.parse(body) }); res.end('ok'); }
          catch { res.statusCode = 400; res.end('invalid evidence'); } return;
        }
        if (url.pathname.endsWith('/battle.view.js') && fault.mode !== 'none') {
          fault.hits++; event({ kind: 'module-hit', mode: fault.mode, hits: fault.hits, url: req.url });
          if (fault.mode === 'fail') { fault.mode = 'none'; res.statusCode = 503; res.end('E7 controlled module failure'); return; }
          if (fault.mode === 'delay') { pending.add(() => { event({ kind: 'module-release', url: req.url }); next(); }); return; }
        }
        next();
      });
    },
  }],
};
