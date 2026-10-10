import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import { handleTrialRequest } from '../trial/index.mjs';
import { admit, finish } from '../trial/ledger.mjs';
import { LIMITS, PRICING_ID, TIMEOUT_MS, LEASE_MS, reservation } from '../trial/limits.mjs';
import { EXAMPLES } from '../public/examples.mjs';

const schema = await readFile(new URL('../trial/schema.sql', import.meta.url), 'utf8');
const NOW = Date.parse('2026-10-10T12:00:00Z');
const ORIGIN = 'https://example.github.io';
const HOST = 'https://unlikely-test.example';
const KEY = 'dummy-trial-key-never-real';
const SECRET = 'dummy-hmac-secret-never-real-32-chars';
const SESSION = '10000000-0000-4000-8000-000000000001';
const uuid = n => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const env = (overrides = {}) => ({
  TRIAL_ENABLED: 'true', TRIAL_MONTHLY_BUDGET_MICROYUAN: '100000000',
  TRIAL_MODEL_BASE_URL: 'https://api.moonshot.cn/v1', TRIAL_MODEL_NAME: 'kimi-k2.6',
  TRIAL_PRICING_ID: PRICING_ID, TRIAL_MODEL_API_KEY: KEY,
  TRIAL_HMAC_SECRET: SECRET, TRIAL_ALLOWED_ORIGINS: ORIGIN, ...overrides
});

// D1-shaped adapter backed by real SQLite. No mocked quota/admission decisions.
function database(t) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(schema);
  t.after(() => sqlite.close());
  return {
    sqlite,
    withSession(mode) { assert.equal(mode, 'first-primary'); return this; },
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      return { bind(...values) {
        const bindings = Object.fromEntries(values.map((v, i) => [String(i + 1), v]));
        return { async first() { return statement.get(bindings) ?? null; }, async run() { return statement.run(bindings); } };
      } };
    }
  };
}

function request(n, { action = 'generate', sessionId = SESSION, payload = { task: 'Write a short film TASK_SENTINEL', seed: '', constraints: 'One location', language: 'zh' }, origin = ORIGIN, ip = '203.0.113.1', signal, extra } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (origin !== null) headers.Origin = origin;
  if (ip !== null) headers['CF-Connecting-IP'] = ip;
  return new Request(`${HOST}/api/trial`, { method: 'POST', headers, body: JSON.stringify({ action, requestId: uuid(n), sessionId, payload, ...extra }), signal });
}

function status(sessionId = SESSION, ip = '203.0.113.1') {
  return new Request(`${HOST}/api/trial/status`, { headers: { Origin: ORIGIN, 'X-Trial-Session': sessionId, 'CF-Connecting-IP': ip } });
}

const completion = (result, finish_reason = 'stop') => Response.json({ choices: [{ message: { content: JSON.stringify(result) }, finish_reason }] });
const graph = EXAMPLES[0].graph;
const project = { version: 1, ...EXAMPLES[0], route: EXAMPLES[0].curatedRoutes[0].nodeIds, provenance: 'curated' };
const context = (db, fetchImpl, extra = {}) => ({ db, env: env(), now: () => NOW, fetchImpl, ...extra });
const rows = db => db.sqlite.prepare('SELECT * FROM trial_requests').all();

test('trial defaults and unknown tariffs fail closed before DB or provider use', async () => {
  let calls = 0;
  const fetchImpl = () => { calls++; throw Error('must not call'); };
  for (const settings of [{}, env({ TRIAL_ENABLED: 'false' }), env({ TRIAL_MONTHLY_BUDGET_MICROYUAN: '0' }), env({ TRIAL_PRICING_ID: 'unknown' }), env({ TRIAL_MODEL_BASE_URL: 'https://api.moonshot.ai/v1' }), env({ TRIAL_MODEL_NAME: 'kimi-k3' })]) {
    const req = new Request(`${HOST}/api/trial/status`, { headers: { Origin: HOST, 'CF-Connecting-IP': '203.0.113.1' } });
    const res = await handleTrialRequest(req, { env: settings, fetchImpl });
    assert.equal((await res.json()).available, false);
  }
  assert.equal(calls, 0);
});

test('trial origin and trusted identity are exact; status preflight has no credentials', async t => {
  const db = database(t);
  let calls = 0;
  const ctx = context(db, () => { calls++; return completion(graph); });
  for (const origin of [null, 'null', 'https://example.github.io.attacker.invalid']) {
    const res = await handleTrialRequest(request(1, { origin }), ctx);
    assert.equal(res.status, 403);
    assert.equal(res.headers.get('access-control-allow-origin'), null);
  }
  for (const ip of [null, '1.2.3.4, 5.6.7.8', '999.1.1.1']) {
    assert.equal((await (await handleTrialRequest(request(1, { ip }), ctx)).json()).code, 'TRIAL_IDENTITY');
  }
  const preflight = await handleTrialRequest(new Request(`${HOST}/api/trial/status`, { method: 'OPTIONS', headers: { Origin: ORIGIN } }), ctx);
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), ORIGIN);
  assert.equal(preflight.headers.get('access-control-allow-credentials'), null);
  assert.match(preflight.headers.get('access-control-allow-headers'), /X-Trial-Session/);
  assert.equal(calls, 0);
  assert.equal(rows(db).length, 0);
});

test('generate sends one server-fixed nonthinking JSON request and stores only HMAC metadata', async t => {
  const db = database(t);
  let calls = 0;
  const ctx = context(db, async (url, options) => {
    calls++;
    assert.equal(url, 'https://api.moonshot.cn/v1/chat/completions');
    assert.equal(options.headers.Authorization, `Bearer ${KEY}`);
    assert.equal(options.redirect, 'error');
    assert.equal(options.credentials, 'omit');
    const input = JSON.parse(options.body);
    assert.equal(input.max_completion_tokens, 16_384);
    assert.equal(input.max_tokens, undefined);
    assert.deepEqual(input.thinking, { type: 'disabled' });
    assert.deepEqual(input.response_format, { type: 'json_object' });
    assert.equal(input.model, 'kimi-k2.6');
    assert.equal(input.tools, undefined);
    assert.equal(JSON.parse(input.messages[1].content).seed, '');
    return completion(graph);
  });
  const res = await handleTrialRequest(request(1), ctx);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.graph.nodes.length, 31);
  assert.deepEqual(body.trial, { remaining: 2, dailyLimit: 3 });
  assert.equal(calls, 1);
  const row = rows(db)[0];
  assert.match(row.session_hash, /^[a-f0-9]{64}$/);
  assert.match(row.ip_hash, /^[a-f0-9]{64}$/);
  assert.equal(row.reserved_microyuan, 555520);
  assert.equal(row.outcome, 'success');
  assert.equal(row.lease_until, NOW);
  const stored = JSON.stringify(rows(db));
  for (const sensitive of [KEY, SECRET, SESSION, '203.0.113.1', 'TASK_SENTINEL']) assert.ok(!stored.includes(sensitive));
  assert.equal(res.headers.get('cache-control'), 'no-store');
});

test('client provider settings and oversized inputs are rejected before admission', async t => {
  const db = database(t);
  let calls = 0;
  const ctx = context(db, () => { calls++; });
  for (const params of [{ extra: { model: 'expensive' } }, { payload: { task: 'x', apiKey: 'untrusted' } }, { payload: { task: '界'.repeat(6000), seed: '', constraints: '界'.repeat(4000) } }]) {
    const res = await handleTrialRequest(request(1, params), ctx);
    assert.equal((await res.json()).code, 'INPUT');
  }
  assert.equal(calls, 0);
  assert.equal(rows(db).length, 0);
});

test('concurrent POSTs admit only one provider call; duplicate ID never causes a second bill', async t => {
  const db = database(t);
  let calls = 0;
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let started;
  const start = new Promise(resolve => { started = resolve; });
  const ctx = context(db, async () => { calls++; started(); await gate; return completion(graph); });
  const first = handleTrialRequest(request(1), ctx);
  await start;
  const attempts = await Promise.all(Array.from({ length: 8 }, (_, i) => handleTrialRequest(request(i + 2, { sessionId: uuid(i + 50), ip: `203.0.113.${i + 2}` }), ctx)));
  for (const res of attempts) assert.equal((await res.json()).code, 'TRIAL_BUSY');
  const duplicate = await handleTrialRequest(request(1), ctx);
  assert.equal(duplicate.status, 409);
  assert.equal((await duplicate.json()).code, 'TRIAL_DUPLICATE');
  assert.equal(calls, 1);
  release();
  assert.equal((await first).status, 200);
  assert.equal((await handleTrialRequest(request(1), ctx)).status, 409);
  assert.equal(calls, 1);
  assert.equal(rows(db).length, 1);
});

test('atomic SQL enforces monthly money, daily session/IP and global limits after lease expiry', async t => {
  const db = database(t);
  const cost = reservation('generate');
  const args = { sessionHash: 's', ipHash: 'ip', action: 'generate', cost, budget: cost * 2, now: NOW };
  const competing = await Promise.all(Array.from({ length: 12 }, (_, i) => admit(db, { ...args, requestId: uuid(i) })));
  assert.equal(competing.filter(Boolean).length, 1);
  const id = rows(db)[0].request_id;
  await finish(db, id, 'success', NOW, true);
  assert.equal(await admit(db, { ...args, requestId: uuid(20) }), true);
  await finish(db, uuid(20), 'PROVIDER', NOW, true);
  assert.equal(await admit(db, { ...args, requestId: uuid(21), now: NOW + LEASE_MS }), false);
  assert.equal(rows(db).reduce((sum, row) => sum + row.reserved_microyuan, 0), cost * 2);
  assert.equal(await admit(db, { ...args, budget: cost * 100, requestId: uuid(22) }), true);
  await finish(db, uuid(22), 'success', NOW, true);
  assert.equal(await admit(db, { ...args, budget: cost * 100, requestId: uuid(23), sessionHash: 'new-session' }), false);
  assert.equal(await admit(db, { ...args, budget: cost * 100, requestId: uuid(24), ipHash: 'new-ip' }), false);
  const nextDay = NOW + 86_400_000;
  assert.equal(await admit(db, { ...args, budget: cost * 100, requestId: uuid(25), now: nextDay }), true);
  // New day still belongs to the same month, so a lowered monthly budget denies.
  await finish(db, uuid(25), 'success', nextDay, true);
  assert.equal(await admit(db, { ...args, requestId: uuid(26), now: nextDay }), false);
});

test('three attempts exhaust both session and IP, and status reports the UTC reset', async t => {
  const db = database(t);
  let calls = 0;
  const ctx = context(db, () => { calls++; return completion(graph); });
  for (let i = 1; i <= 3; i++) assert.equal((await handleTrialRequest(request(i), ctx)).status, 200);
  for (const params of [{ sessionId: uuid(20) }, { ip: '203.0.113.2' }]) {
    const res = await handleTrialRequest(request(4, params), ctx);
    assert.equal((await res.json()).code, 'TRIAL_QUOTA');
  }
  const current = await (await handleTrialRequest(status(), ctx)).json();
  assert.deepEqual(current, { available: false, reason: 'TRIAL_QUOTA', retryAfter: 43200, dailyLimit: 3, remaining: 0 });
  const tomorrow = await (await handleTrialRequest(status(), { ...ctx, now: () => NOW + 86_400_000 })).json();
  assert.equal(tomorrow.available, true);
  assert.equal(tomorrow.remaining, 3);
  assert.equal(calls, 3);
});

test('the global daily ceiling applies across different sessions and IPs', async t => {
  const db = database(t);
  for (let i = 0; i < 100; i++) {
    const ok = await admit(db, { requestId: uuid(i), sessionHash: `s-${i}`, ipHash: `ip-${i}`, action: 'generate', cost: reservation('generate'), budget: 100_000_000, now: NOW });
    assert.equal(ok, true);
    await finish(db, uuid(i), 'success', NOW, true);
  }
  const ctx = context(db, () => { throw Error('global quota must prevent a model call'); });
  const res = await handleTrialRequest(request(500), ctx);
  assert.equal((await res.json()).code, 'TRIAL_RATE_LIMIT');
  assert.equal(rows(db).length, 100);
});

test('invalid output and provider errors retain reservations without revealing raw errors or retrying', async t => {
  for (const [expected, mock] of [
    ['PROVIDER', () => Response.json({ error: { message: `secret ${KEY} TASK_SENTINEL` } }, { status: 500 })],
    ['INVALID_GRAPH', () => completion({ seedId: 'broken' })],
    ['INVALID_RESPONSE', () => new Response('not JSON')],
    ['OUTPUT_TRUNCATED', () => completion(graph, 'length')]
  ]) {
    const db = database(t);
    let calls = 0;
    const res = await handleTrialRequest(request(1), context(db, () => { calls++; return mock(); }));
    const body = await res.json();
    assert.equal(body.code, expected);
    assert.equal(body.trial.remaining, 2);
    assert.ok(!JSON.stringify(body).includes(KEY));
    assert.ok(!JSON.stringify(body).includes('TASK_SENTINEL'));
    assert.equal(rows(db)[0].reserved_microyuan, reservation('generate'));
    assert.equal(calls, 1);
  }
});

test('cancellation and the 120s deadline cannot refund, retry, or shorten an uncertain lease', async t => {
  for (const kind of ['cancel', 'timeout']) {
    const db = database(t);
    const abort = new AbortController();
    let started;
    const start = new Promise(resolve => { started = resolve; });
    let calls = 0;
    if (kind === 'timeout') t.mock.timers.enable({ apis: ['setTimeout'] });
    const pending = handleTrialRequest(request(1, { signal: abort.signal }), context(db, () => { calls++; started(); return new Promise(() => {}); }));
    await start;
    if (kind === 'timeout') t.mock.timers.tick(TIMEOUT_MS); else abort.abort();
    const body = await (await pending).json();
    assert.equal(body.code, kind === 'timeout' ? 'TIMEOUT' : 'ABORTED');
    assert.equal(rows(db)[0].lease_until, NOW + LEASE_MS);
    assert.equal(rows(db)[0].reserved_microyuan, reservation('generate'));
    assert.equal(calls, 1);
    if (kind === 'timeout') t.mock.timers.reset();
  }
});

test('synthesis keeps unresolved gaps and expansion appends without modifying the original graph', async t => {
  const db = database(t);
  const gapProject = structuredClone(project);
  gapProject.route = [graph.nodes[0].id, graph.nodes.at(-1).id];
  gapProject.graph.edges = gapProject.graph.edges.filter(edge => !((edge.source === gapProject.route[0] && edge.target === gapProject.route[1]) || (edge.target === gapProject.route[0] && edge.source === gapProject.route[1])));
  const brief = await handleTrialRequest(request(1, { action: 'synthesize', payload: { project: gapProject, language: 'en' } }), context(db, () => completion({ title: 'Test', body: 'A fixture draft.', assumptions: 'Creative suggestions.' })));
  const body = await brief.json();
  assert.equal(brief.status, 200);
  assert.match(body.assumptions, /No direct relationship/);
  const delta = { clusters: [], nodes: [1, 2, 3].map(i => ({ id: `new-node-${i}`, cluster: graph.clusters[0].id, label: { en: 'New', zh: '新' }, description: { en: 'A new idea', zh: '新想法' }, kind: 'concept' })), edges: [1, 2, 3].map(i => ({ id: `new-edge-${i}`, source: graph.seedId, target: `new-node-${i}`, label: { en: 'Link', zh: '联系' }, reason: { en: 'An analogy', zh: '类比' }, kind: 'analogy' })) };
  const expanded = await handleTrialRequest(request(2, { action: 'expand', payload: { project, nodeId: graph.seedId, operation: 'analogy', language: 'en' } }), context(db, () => completion({ delta })));
  const result = await expanded.json();
  assert.equal(expanded.status, 200);
  assert.deepEqual(result.graph.nodes.slice(0, graph.nodes.length), graph.nodes);
  assert.equal(result.graph.nodes.length, graph.nodes.length + 3);
  assert.equal(rows(db)[1].reserved_microyuan, reservation('expand'));
});

test('output byte ceiling is enforced even without a Content-Length header', async t => {
  const db = database(t);
  const res = await handleTrialRequest(request(1), context(db, () => new Response('x'.repeat(LIMITS.generate.outputBytes + 1))));
  assert.equal((await res.json()).code, 'INVALID_RESPONSE');
  assert.equal(rows(db).length, 1);
});

test('missing or broken D1 never sends a provider request', async t => {
  const db = database(t);
  db.sqlite.exec('DROP TABLE trial_requests');
  let calls = 0;
  const ctx = context(db, () => { calls++; });
  const res = await handleTrialRequest(request(1), ctx);
  assert.equal(res.status, 503);
  assert.equal((await res.json()).code, 'TRIAL_STORAGE');
  assert.equal(calls, 0);
});
