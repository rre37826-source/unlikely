import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { createAppServer } from '../server.mjs';

const words = value => ({ en: value, zh: `中${value}` });
const env = { MODEL_BASE_URL: 'https://provider.example/v1/', MODEL_API_KEY: 'test-private-secret', MODEL_NAME: 'test-model' };
function graph() {
  return {
    seedId: 'n0', clusters: Array.from({ length: 6 }, (_, i) => ({ id: `c${i}`, label: words(`Domain ${i}`) })),
    nodes: Array.from({ length: 31 }, (_, i) => ({ id: `n${i}`, label: words(`Idea ${i}`), description: words(`Useful perspective ${i}`), cluster: `c${i % 6}`, kind: i ? 'concept' : 'seed' })),
    edges: Array.from({ length: 30 }, (_, i) => ({ id: `e${i}`, source: 'n0', target: `n${i + 1}`, label: words('Analogy'), reason: words('A shared structure'), kind: 'analogy' }))
  };
}
const project = () => ({ version: 1, title: 'A film', task: 'Write a film about home', seed: 'Lemon', constraints: '', graph: graph(), route: ['n1', 'n2'], provenance: 'model' });
const provider = data => async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(data) } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
async function withServer(t, options = {}) {
  const server = createAppServer(options);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  return `http://127.0.0.1:${server.address().port}`;
}
const post = (url, path, body, headers = {}) => fetch(url + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
function rawStatus(url, headers) {
  return new Promise((resolve, reject) => {
    const req = request(url, { headers }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
    req.on('error', reject);
    req.end();
  });
}

test('no model configuration is clearly reported and cannot pretend to generate', async t => {
  const url = await withServer(t, { env: {} });
  const status = await fetch(url + '/api/status');
  assert.deepEqual(await status.json(), { configured: false, model: null });
  const result = await post(url, '/api/generate', { task: 'Write', seed: 'Lemon' });
  assert.equal(result.status, 503);
  assert.match((await result.json()).error, /not configured/);
});

test('static whitelist and local-origin boundary protect files and provider quota', async t => {
  const url = await withServer(t, { env, fetchImpl: provider(graph()) });
  const core = await fetch(url + '/core.mjs');
  assert.equal(core.status, 200);
  assert.match(core.headers.get('content-security-policy'), /script-src 'self'/);
  assert.doesNotMatch(core.headers.get('content-security-policy'), /script-src[^;]*unsafe-inline/);
  for (const path of ['/.env', '/server.mjs', '/package.json', '/%2e%2e%2fserver.mjs', '/%252e%252e%252f.env', '/core.mjs%00']) {
    assert.equal((await fetch(url + path)).status, 404, path);
  }
  const crossOrigin = await post(url, '/api/generate', { task: 'Write', seed: 'Lemon' }, { Origin: 'https://malicious.example' });
  assert.equal(crossOrigin.status, 403);
  assert.equal(crossOrigin.headers.get('access-control-allow-origin'), null);
  assert.equal(await rawStatus(url + '/api/status', { Host: 'attacker.example:4317' }), 403);
  assert.equal(await rawStatus(url + '/api/status', { Host: '127.0.0.1:1' }), 403);
  assert.equal((await post(url, '/api/generate', {}, { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
  assert.equal((await fetch(url + '/api/generate', { method: 'OPTIONS', headers: { Origin: 'https://malicious.example' } })).status, 403);
  assert.equal((await fetch(url + '/api/status', { headers: { Origin: 'null' } })).status, 403);
  assert.equal((await fetch(url + '/api/status', { headers: { Origin: url } })).status, 200);
});

test('live generation calls the configured provider and validates returned topology', async t => {
  let call;
  const url = await withServer(t, { env, fetchImpl: async (address, options) => { call = { address, options }; return provider(graph())(); } });
  const result = await post(url, '/api/generate', { task: 'Write a short film', seed: 'Lemon', language: 'zh' });
  assert.equal(result.status, 200);
  const data = await result.json();
  assert.equal(data.provenance, 'model');
  assert.equal(data.graph.nodes.length, 31);
  assert.equal(call.address, 'https://provider.example/v1/chat/completions');
  assert.equal(call.options.headers.Authorization, 'Bearer test-private-secret');
  assert.equal(JSON.parse(call.options.body).model, 'test-model');
  assert.equal(JSON.parse(JSON.parse(call.options.body).messages[1].content).language, 'zh');
  assert.equal(JSON.stringify(data).includes(env.MODEL_API_KEY), false);
  const invalid = graph();
  invalid.edges = invalid.edges.slice(1);
  const brokenUrl = await withServer(t, { env, fetchImpl: provider(invalid) });
  const broken = await post(brokenUrl, '/api/generate', { task: 'Write', seed: 'Lemon' });
  assert.equal(broken.status, 502);
  assert.match((await broken.json()).error, /connected to the seed/);
});

test('synthesis carries exact selected route and explicitly retains unsupported connections', async t => {
  let input;
  const url = await withServer(t, { env, fetchImpl: async (_, options) => {
    input = JSON.parse(JSON.parse(options.body).messages[1].content);
    return provider({ title: 'A new film', body: 'One person mixes a drink.', assumptions: 'Creative draft only.' })();
  } });
  const result = await post(url, '/api/synthesize', { project: project(), language: 'en' });
  assert.equal(result.status, 200);
  const draft = await result.json();
  assert.deepEqual(input.route.map(node => node.id), ['n1', 'n2']);
  assert.equal(input.relationships[0].edge, null);
  assert.match(draft.assumptions, /Idea 1 → Idea 2/);
  assert.match(draft.assumptions, /No direct relationship established/);
  const empty = { ...project(), route: [] };
  assert.equal((await post(url, '/api/synthesize', { project: empty })).status, 400);
});

test('model failures never return provider secrets or untrusted raw error bodies', async t => {
  const url = await withServer(t, { env, fetchImpl: async () => new Response(`credentials: ${env.MODEL_API_KEY}`, { status: 401 }) });
  const result = await post(url, '/api/generate', { task: 'Write', seed: 'Lemon' });
  assert.equal(result.status, 502);
  const message = await result.text();
  assert.match(message, /rejected authentication/);
  assert.equal(message.includes(env.MODEL_API_KEY), false);
});

test('invalid content type, payload, oversized bodies, and unknown operations fail before provider calls', async t => {
  let calls = 0;
  const url = await withServer(t, { env, fetchImpl: async () => { calls++; return provider(graph())(); } });
  assert.equal((await fetch(url + '/api/generate', { method: 'POST', body: '{}' })).status, 415);
  assert.equal((await fetch(url + '/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' })).status, 400);
  assert.equal((await post(url, '/api/generate', { task: 'x'.repeat(270000), seed: 'x' })).status, 413);
  assert.equal((await post(url, '/api/generate', { task: '', seed: 'x' })).status, 400);
  assert.equal((await post(url, '/api/generate', { task: 'x', seed: 'x', language: 'xx' })).status, 400);
  assert.equal((await post(url, '/api/expand', { project: project(), nodeId: 'n0', operation: 'execute' })).status, 400);
  assert.equal((await fetch(url + '/api/generate')).status, 405);
  assert.equal(calls, 0);
  const chunked = await new Promise((resolve, reject) => {
    const req = request(url + '/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Transfer-Encoding': 'chunked' } }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
    req.on('error', reject);
    req.write('{"task":"');
    req.write('x'.repeat(270000));
    req.end('","seed":"x"}');
  });
  assert.equal(chunked, 413);
  assert.equal(calls, 0);
});

test('only one provider operation runs at once and the lock releases after completion', async t => {
  let release;
  let entered;
  const started = new Promise(resolve => { entered = resolve; });
  const pending = new Promise(resolve => { release = resolve; });
  const url = await withServer(t, { env, fetchImpl: async () => { entered(); await pending; return provider(graph())(); } });
  const first = post(url, '/api/generate', { task: 'Write', seed: 'Lemon' });
  await started;
  const second = await post(url, '/api/generate', { task: 'Write', seed: 'Lemon' });
  assert.equal(second.status, 429);
  release();
  assert.equal((await first).status, 200);
  assert.equal((await post(url, '/api/generate', { task: 'Write', seed: 'Lemon' })).status, 200);
});

test('expansion adds nodes but refuses to rewrite existing human-selected content', async t => {
  const expanded = graph();
  expanded.nodes.push({ id: 'new', label: words('New'), description: words('A new angle'), cluster: 'c1', kind: 'concept' });
  expanded.edges.push({ id: 'new-edge', source: 'n2', target: 'new', label: words('Transfer'), reason: words('A new structure'), kind: 'hypothesis' });
  const url = await withServer(t, { env, fetchImpl: provider(expanded) });
  const result = await post(url, '/api/expand', { project: project(), nodeId: 'n2', operation: 'analogy' });
  assert.equal(result.status, 200);
  assert.equal((await result.json()).graph.nodes.length, 32);
  expanded.nodes[1].description.en = 'Silently changed';
  const changed = await post(url, '/api/expand', { project: project(), nodeId: 'n2', operation: 'analogy' });
  assert.equal(changed.status, 502);
  assert.match((await changed.json()).error, /modify existing content/);
});
