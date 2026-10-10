import { createServer } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { normalizeConnection, requestModel, ModelError } from './public/model-client.mjs';

const PUBLIC = fileURLToPath(new URL('./public/', import.meta.url));
const LIMIT = 256 * 1024;
const STATIC = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']], ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/app.mjs', ['app.mjs', 'text/javascript; charset=utf-8']], ['/core.mjs', ['core.mjs', 'text/javascript; charset=utf-8']],
  ['/examples.mjs', ['examples.mjs', 'text/javascript; charset=utf-8']], ['/style.css', ['style.css', 'text/css; charset=utf-8']],
  ['/config.mjs', ['config.mjs', 'text/javascript; charset=utf-8']],
  ['/layout.mjs', ['layout.mjs', 'text/javascript; charset=utf-8']],
  ['/model-errors.mjs', ['model-errors.mjs', 'text/javascript; charset=utf-8']],
  ['/model-client.mjs', ['model-client.mjs', 'text/javascript; charset=utf-8']],
  ['/model-protocol.mjs', ['model-protocol.mjs', 'text/javascript; charset=utf-8']],
  ['/social-preview.png', ['social-preview.png', 'image/png']],
  ['/favicon.svg', ['favicon.svg', 'image/svg+xml']], ['/social-card.svg', ['social-card.svg', 'image/svg+xml']]
]);

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function response(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(payload));
}

async function readJson(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) throw new HttpError(415, 'Use Content-Type: application/json.');
  const length = req.headers['content-length'];
  if (length && (!/^\d+$/.test(length) || Number(length) > LIMIT)) {
    req.resume();
    throw new HttpError(413, 'Request body is limited to 256 KB.');
  }
  const chunks = [];
  let size = 0;
  await new Promise((accept, reject) => {
    let rejected = false;
    req.on('data', chunk => {
      if (rejected) return;
      size += chunk.length;
      if (size > LIMIT) { rejected = true; chunks.length = 0; reject(new HttpError(413, 'Request body is limited to 256 KB.')); }
      else chunks.push(chunk);
    });
    req.on('end', accept);
    req.on('error', reject);
    req.on('aborted', () => reject(new HttpError(400, 'The request was interrupted.')));
  });
  let body;
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new HttpError(400, 'Request body must be valid JSON.'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Request body must be a JSON object.');
  return body;
}

function enforceLocalRequest(req) {
  const port = req.socket.localPort;
  const host = req.headers.host;
  const allowed = new Set([`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`]);
  if (typeof host !== 'string' || !allowed.has(host.toLowerCase())) throw new HttpError(403, 'This server accepts requests through its local address only.');
  const origin = req.headers.origin;
  if (origin && origin !== `http://${host.toLowerCase()}`) throw new HttpError(403, 'Cross-origin API requests are not allowed.');
  if (req.headers['sec-fetch-site'] === 'cross-site') throw new HttpError(403, 'Cross-site API requests are not allowed.');
}

function configuration(env) {
  try { return normalizeConnection({ baseUrl: env.MODEL_BASE_URL, apiKey: env.MODEL_API_KEY, model: env.MODEL_NAME }); }
  catch { return null; }
}

/** A local-only, optional model proxy. A fresh instance has its own request lock. */
export function createAppServer({ fetchImpl = fetch, env = process.env } = {}) {
  let busy = false;
  const config = configuration(env);

  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https: http://localhost:* http://127.0.0.1:*; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    try {
      let pathname;
      try { pathname = decodeURIComponent((req.url || '/').split('?')[0]); } catch { throw new HttpError(404, 'Not found.'); }
      if (pathname.includes('..') || pathname.includes('\\') || pathname.includes('\0')) throw new HttpError(404, 'Not found.');
      enforceLocalRequest(req);
      if (pathname === '/api/status' && req.method === 'GET') return response(res, 200, { configured: !!config, model: config?.model || null });
      if (pathname.startsWith('/api/')) {
        if (!['/api/generate', '/api/synthesize', '/api/expand'].includes(pathname)) throw new HttpError(404, 'Unknown API endpoint.');
        if (req.method !== 'POST') throw new HttpError(405, 'Use POST for this endpoint.');
        if (!config) throw new HttpError(503, 'Live generation is not configured. Set MODEL_BASE_URL, MODEL_API_KEY and MODEL_NAME in your local .env file. Curated examples remain available.');
        if (busy) throw new HttpError(429, 'A model request is already running. Wait for it to finish.');
        busy = true;
        try {
          const body = await readJson(req);
          const controller = new AbortController();
          const onClose = () => { if (!res.writableEnded) controller.abort(); };
          res.once('close', onClose);
          try {
            const result = await requestModel(pathname.slice('/api/'.length), body, config, { fetchImpl, signal: controller.signal });
            return response(res, 200, result);
          } finally { res.removeListener('close', onClose); }
        } finally { busy = false; }
      }
      if (!['GET', 'HEAD'].includes(req.method)) throw new HttpError(405, 'Use GET or HEAD for static files.');
      const asset = STATIC.get(pathname);
      if (!asset) throw new HttpError(404, 'Not found.');
      let file;
      try {
        file = await realpath(resolve(PUBLIC, asset[0]));
        if (!file.startsWith(PUBLIC.endsWith(sep) ? PUBLIC : PUBLIC + sep)) throw new Error('Outside public');
        const bytes = await readFile(file);
        res.writeHead(200, { 'Content-Type': asset[1], 'Cache-Control': 'no-cache', 'Content-Length': bytes.length });
        return res.end(req.method === 'HEAD' ? undefined : bytes);
      } catch { throw new HttpError(404, 'Not found.'); }
    } catch (error) {
      if (!res.headersSent && !res.destroyed) {
        const known = error instanceof HttpError || error instanceof ModelError;
        response(res, known ? error.status : 500, { error: known ? error.message : 'An unexpected server error occurred. Please try again.', ...(error instanceof ModelError ? { code: error.code, ...(Number.isInteger(error.httpStatus) ? { httpStatus: error.httpStatus } : {}), ...(error.providerDetails ? { providerDetails: error.providerDetails } : {}) } : {}) });
      }
      else res.end();
    }
  });
  server.requestTimeout = 125_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 5_000;
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.env.PORT || 4317);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535.');
  const server = createAppServer();
  server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? `Port ${port} is already in use. Choose another PORT.` : 'Could not start the local server.'); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`Unlikely is available at http://127.0.0.1:${port}\nLive model: ${configuration(process.env) ? 'configured' : 'not configured (curated examples work offline)'}`));
}
