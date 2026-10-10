import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConnection, requestModel, testConnection } from '../public/model-client.mjs';
import { EXAMPLES } from '../public/examples.mjs';

const config = { baseUrl: 'https://provider.example/v1/', apiKey: 'test-private-secret-12345', model: 'example-model' };
const example = EXAMPLES[0];
const originalGraph = () => structuredClone(example.graph);
const project = () => ({ ...structuredClone(example), version: 1, route: ['seed', ...example.graph.nodes.filter(node => node.id !== 'seed').slice(-2).map(node => node.id)], provenance: 'curated' });
const response = value => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(value) } }] }), { headers: { 'Content-Type': 'application/json' } });
const codeIs = code => error => { assert.equal(error.code, code); assert.equal(error.message.includes(config.apiKey), false); return true; };
const words = value => ({ en: value, zh: `中${value}` });
function delta() {
  return { delta: {
    clusters: [], nodes: [{ id: 'new-angle', label: words('New angle'), description: words('A different perspective'), cluster: example.graph.clusters[0].id, kind: 'concept' }],
    edges: [{ id: 'new-link', source: 'seed', target: 'new-angle', label: words('Analogy'), reason: words('A shared structure to explore'), kind: 'hypothesis' }]
  } };
}

test('connection normalization rejects unsafe transports and credential-bearing URLs', () => {
  const clean = normalizeConnection({ ...config, apiKey: ` ${config.apiKey} `, extra: 'discard' });
  assert.deepEqual(clean, { baseUrl: 'https://provider.example/v1', apiKey: config.apiKey, model: 'example-model' });
  assert.equal(normalizeConnection({ ...config, baseUrl: 'https://provider.example/v1/chat/completions/' }).baseUrl, 'https://provider.example/v1');
  for (const baseUrl of ['http://provider.example/v1', 'http://localhost.attacker.example/v1', 'javascript:alert(1)', 'file:///tmp/provider', 'https://user:password@provider.example', 'https://provider.example/v1?api_key=private', 'https://provider.example/v1#secret', 'https://provider.example/v1?']) {
    assert.throws(() => normalizeConnection({ ...config, baseUrl }), codeIs('CONFIG'), baseUrl);
  }
  assert.equal(normalizeConnection({ ...config, baseUrl: 'http://localhost:11434/v1' }).baseUrl, 'http://localhost:11434/v1');
  assert.equal(normalizeConnection({ ...config, baseUrl: 'http://127.0.0.1:11434/v1' }).baseUrl, 'http://127.0.0.1:11434/v1');
  assert.throws(() => normalizeConnection({ ...config, apiKey: 'secret\nInjected' }), codeIs('CONFIG'));
});

test('connection check performs a real JSON completion, keeps authentication out of data and never touches persistence', async t => {
  for (const key of ['localStorage', 'sessionStorage', 'indexedDB']) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, get() { throw new Error('Persistence must not be touched'); } });
    t.after(() => { if (previous) Object.defineProperty(globalThis, key, previous); else delete globalThis[key]; });
  }
  let calls = 0;
  const result = await testConnection(config, { fetchImpl: async (url, options) => {
    calls++;
    assert.equal(url, 'https://provider.example/v1/chat/completions');
    assert.equal(url.includes(config.apiKey), false);
    assert.equal(options.headers.Authorization, `Bearer ${config.apiKey}`);
    assert.equal(options.body.includes(config.apiKey), false);
    assert.equal(options.redirect, 'error');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.mode, 'cors');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.referrerPolicy, 'no-referrer');
    assert.equal(JSON.parse(options.body).response_format.type, 'json_object');
    return response({ ok: true });
  } });
  assert.equal(calls, 1);
  assert.deepEqual(result, { model: 'example-model' });
  assert.equal(JSON.stringify(result).includes(config.apiKey), false);
  await assert.rejects(testConnection(config, { fetchImpl: async () => response({ ok: 'true' }) }), codeIs('INVALID_RESPONSE'));
});

test('generation validates the full network and sends the actual task and constraints', async () => {
  const payload = { task: 'Build a better writing tool', seed: 'Lemon', constraints: 'One-person team', language: 'zh' };
  const result = await requestModel('generate', payload, config, { fetchImpl: async (_, options) => {
    const messages = JSON.parse(options.body).messages;
    assert.deepEqual(JSON.parse(messages[1].content), payload);
    return response(originalGraph());
  } });
  assert.equal(result.provenance, 'model');
  assert.equal(result.graph.nodes.length, 31);
  assert.deepEqual(result.graph, originalGraph());
  const broken = originalGraph();
  broken.edges = [];
  await assert.rejects(requestModel('generate', payload, config, { fetchImpl: async () => response(broken) }), codeIs('INVALID_GRAPH'));
  const seedless = await requestModel('generate', { task: 'Create an exhibition', seed: '' }, config, { fetchImpl: async (_, options) => {
    const messages = JSON.parse(options.body).messages;
    assert.equal(JSON.parse(messages[1].content).seed, '');
    assert.match(messages[0].content, /choose one concrete/);
    return response(originalGraph());
  } });
  assert.equal(seedless.graph.seedId, 'seed');
  const local = await requestModel('generate', payload, { ...config, baseUrl: 'http://localhost:11434/v1', apiKey: 'x' }, { fetchImpl: async () => response(originalGraph()) });
  assert.equal(local.graph.nodes.length, 31);
});

test('synthesis preserves the selected order and makes missing relationships visible even if the model ignores them', async () => {
  const p = project();
  const first = p.graph.nodes[1].id;
  const target = p.graph.nodes.find(node => node.id !== first && !p.graph.edges.some(edge => edge.source === first && edge.target === node.id || edge.target === first && edge.source === node.id)).id;
  p.route = [first, target];
  const result = await requestModel('synthesize', { project: p, language: 'en' }, config, { fetchImpl: async (_, options) => {
    const input = JSON.parse(JSON.parse(options.body).messages[1].content);
    assert.deepEqual(input.route.map(node => node.id), [first, target]);
    assert.equal(input.relationships[0].edge, null);
    return response({ title: 'New direction', body: 'A proposed story.', assumptions: 'Creative interpretation.' });
  } });
  assert.match(result.assumptions, /No direct relationship established/);
});

test('append-only expansion combines the delta while preserving the original graph', async () => {
  const p = project();
  const before = JSON.stringify(p);
  const result = await requestModel('expand', { project: p, nodeId: 'seed', operation: 'analogy' }, config, { fetchImpl: async (_, options) => {
    assert.match(JSON.parse(options.body).messages[0].content, /append-only delta/);
    return response(delta());
  } });
  assert.equal(result.graph.nodes.length, 32);
  assert.deepEqual(result.graph.nodes.slice(0, 31), p.graph.nodes);
  assert.equal(JSON.stringify(p), before);
  const rewritten = delta();
  rewritten.delta.nodes[0].id = 'seed';
  await assert.rejects(requestModel('expand', { project: p, nodeId: 'seed', operation: 'analogy' }, config, { fetchImpl: async () => response(rewritten) }), codeIs('INVALID_GRAPH'));
  const disconnected = delta();
  disconnected.delta.edges = [];
  await assert.rejects(requestModel('expand', { project: p, nodeId: 'seed', operation: 'analogy' }, config, { fetchImpl: async () => response(disconnected) }), codeIs('INVALID_GRAPH'));
});

test('provider errors are classified, redact raw responses and never trigger paid retries', async () => {
  for (const [status, code] of [[401, 'AUTH'], [403, 'AUTH'], [429, 'RATE_LIMIT'], [500, 'PROVIDER'], [302, 'NETWORK']]) {
    let calls = 0;
    await assert.rejects(testConnection(config, { fetchImpl: async () => { calls++; return new Response(`Provider error contains ${config.apiKey}`, { status }); } }), codeIs(code));
    assert.equal(calls, 1);
  }
  await assert.rejects(testConnection(config, { fetchImpl: async () => { throw new Error(`CORS blocked ${config.apiKey}`); } }), codeIs('NETWORK'));
  const redirect = response({ ok: true });
  Object.defineProperty(redirect, 'redirected', { value: true });
  await assert.rejects(testConnection(config, { fetchImpl: async () => redirect }), codeIs('NETWORK'));
});

test('malformed, oversized or credential-echoing output cannot reach the UI', async () => {
  for (const make of [
    () => new Response('not JSON'),
    () => new Response(JSON.stringify({ choices: [{ message: { content: '```json\n{"ok":true}\n```' } }] })),
    () => response([1, 2]),
    () => response({ ok: true, credential: config.apiKey }),
    () => new Response('x'.repeat(1024 * 1024 + 1))
  ]) await assert.rejects(testConnection(config, { fetchImpl: async () => make() }), codeIs('INVALID_RESPONSE'));
  await assert.rejects(requestModel('synthesize', { project: project() }, config, { fetchImpl: async () => response({ title: 'Only a title' }) }), codeIs('INVALID_RESPONSE'));
});

test('cancellation stops an in-flight request, and an already-cancelled action makes no request', async () => {
  const controller = new AbortController();
  let transportSignal;
  const pending = testConnection(config, { signal: controller.signal, fetchImpl: async (_, options) => {
    transportSignal = options.signal;
    return new Promise(() => {});
  } });
  controller.abort();
  await assert.rejects(pending, codeIs('ABORTED'));
  assert.equal(transportSignal.aborted, true);
  let calls = 0;
  await assert.rejects(testConnection(config, { signal: controller.signal, fetchImpl: async () => { calls++; return response({ ok: true }); } }), codeIs('ABORTED'));
  assert.equal(calls, 0);
});

test('the 120-second total timeout aborts transport without automatic retries', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let transportSignal;
  let calls = 0;
  const pending = testConnection(config, { fetchImpl: async (_, options) => { calls++; transportSignal = options.signal; return new Promise(() => {}); } });
  const rejected = assert.rejects(pending, codeIs('TIMEOUT'));
  t.mock.timers.tick(120_000);
  await rejected;
  assert.equal(transportSignal.aborted, true);
  assert.equal(calls, 1);
});

test('request validation uses the original snapshot even when the caller edits the route while waiting', async () => {
  const p = project();
  const expectedIds = [...p.route];
  const result = await requestModel('synthesize', { project: p }, config, { fetchImpl: async () => {
    p.route = [];
    return response({ title: 'Snapshot', body: 'The original route.', assumptions: 'Creative interpretation.' });
  } });
  assert.equal(result.title, 'Snapshot');
  assert.ok(expectedIds.length >= 2);
});
