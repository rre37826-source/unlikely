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
  for (const [status, code] of [[401, 'AUTH'], [403, 'AUTH'], [429, 'RATE_LIMIT'], [500, 'PROVIDER_UNAVAILABLE'], [302, 'NETWORK']]) {
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

test('official Kimi connection checks use model-specific reasoning options without changing real task settings', async () => {
  const models = [
    ['kimi-k2.6', { max_tokens: 1024, thinking: { type: 'disabled' } }],
    ['kimi-k3', { max_tokens: 4096, reasoning_effort: 'low' }],
    ['kimi-k2.7-code', { max_tokens: 4096 }],
    ['kimi-k2.7-code-highspeed', { max_tokens: 4096 }]
  ];
  for (const host of ['api.moonshot.cn', 'api.moonshot.ai']) for (const [model, expected] of models) {
    let calls = 0;
    const connection = { ...config, baseUrl: `https://${host}/v1`, model };
    await testConnection(connection, { fetchImpl: async (_, options) => {
      calls++;
      const request = JSON.parse(options.body);
      const actual = Object.fromEntries(['max_tokens', 'thinking', 'reasoning_effort'].filter(key => key in request).map(key => [key, request[key]]));
      assert.deepEqual(actual, expected, `${host}/${model}`);
      assert.deepEqual(request.response_format, { type: 'json_object' });
      assert.equal('temperature' in request, false);
      return response({ ok: true });
    } });
    assert.equal(calls, 1);
    await requestModel('generate', { task: 'Make a film', seed: 'Lemon' }, connection, { fetchImpl: async (_, options) => {
      calls++;
      const request = JSON.parse(options.body);
      assert.equal('thinking' in request, false);
      assert.equal('reasoning_effort' in request, false);
      assert.equal('max_tokens' in request, false);
      return response(originalGraph());
    } });
    assert.equal(calls, 2, 'One connection check plus one explicit generation; never a hidden retry.');
  }
});

test('retired official model IDs fail locally while third-party aliases and unknown models are not guessed', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; return response({ ok: true }); };
  for (const host of ['api.moonshot.cn', 'api.moonshot.ai']) {
    const retired = { ...config, baseUrl: `https://${host}/v1`, model: 'kimi-k2.5' };
    for (const attempt of [
      () => testConnection(retired, { fetchImpl }),
      () => requestModel('generate', { task: 'Make a film' }, retired, { fetchImpl })
    ]) await assert.rejects(attempt(), error => {
      assert.equal(error.code, 'MODEL_RETIRED');
      assert.equal(error.httpStatus, undefined, 'A local preflight must not fabricate an HTTP response.');
      assert.deepEqual(error.providerDetails, { parameter: 'model' });
      return true;
    });
  }
  assert.equal(calls, 0);
  for (const [baseUrl, model] of [
    ['https://provider.example/v1', 'kimi-k2.5'],
    ['https://provider.example/v1', 'kimi-k2.6'],
    ['https://api.moonshot.cn.attacker.example/v1', 'kimi-k2.6'],
    ['https://api.moonshot.cn/v1/proxy', 'kimi-k2.6'],
    ['https://api.moonshot.cn/v1', 'kimi-k2.6-unverified-alias']
  ]) await testConnection({ ...config, baseUrl, model }, { fetchImpl: async (_, options) => {
    const request = JSON.parse(options.body);
    assert.equal('thinking' in request, false);
    assert.equal('reasoning_effort' in request, false);
    assert.equal(request.max_tokens, 4096);
    return response({ ok: true });
  } });
});

test('provider diagnostics distinguish models, JSON parameters, token limits, quota, rate limits and outages', async () => {
  const cases = [
    [404, { type: 'resource_not_found_error', message: 'Model unavailable' }, 'MODEL_NOT_FOUND', { errorCode: 'resource_not_found_error' }],
    [400, { code: 'model_not_found', param: 'model', message: 'Private model name' }, 'MODEL_NOT_FOUND', { errorCode: 'model_not_found', parameter: 'model' }],
    [400, { type: 'invalid_request_error', param: 'response_format', message: 'Invalid parameter' }, 'JSON_UNSUPPORTED', { errorCode: 'invalid_request_error', parameter: 'response_format' }],
    [400, { type: 'invalid_request_error', message: 'response_format is not supported' }, 'JSON_UNSUPPORTED', { errorCode: 'invalid_request_error', parameter: 'response_format' }],
    [400, { type: 'invalid_request_error', param: 'max_tokens', message: 'Too small' }, 'TOKEN_LIMIT', { errorCode: 'invalid_request_error', parameter: 'max_tokens' }],
    [400, { type: 'invalid_request_error', message: 'max_completion_tokens is too large' }, 'TOKEN_LIMIT', { errorCode: 'invalid_request_error', parameter: 'max_completion_tokens' }],
    [400, { code: 'context_length_exceeded', message: 'Too long' }, 'TOKEN_LIMIT', { errorCode: 'context_length_exceeded' }],
    [400, { type: 'invalid_request_error', message: 'Input token length too long' }, 'TOKEN_LIMIT', { errorCode: 'invalid_request_error' }],
    [429, { type: 'exceeded_current_quota_error', message: 'Balance too low' }, 'QUOTA', { errorCode: 'exceeded_current_quota_error' }],
    [429, { code: 'insufficient_quota', message: 'Quota exceeded' }, 'QUOTA', { errorCode: 'insufficient_quota' }],
    [402, { message: 'Balance too low' }, 'QUOTA', undefined],
    [429, { type: 'rate_limit_reached_error', message: 'RPM limit' }, 'RATE_LIMIT', { errorCode: 'rate_limit_reached_error' }],
    [429, { type: 'engine_overloaded_error', message: 'Busy' }, 'PROVIDER_UNAVAILABLE', { errorCode: 'engine_overloaded_error' }],
    [503, { type: 'server_unavailable', message: 'Unavailable' }, 'PROVIDER_UNAVAILABLE', { errorCode: 'server_unavailable' }],
    [401, { type: 'incorrect_api_key_error', message: 'Wrong key' }, 'AUTH', { errorCode: 'incorrect_api_key_error' }],
    [403, { type: 'permission_denied_error', message: 'Forbidden' }, 'AUTH', { errorCode: 'permission_denied_error' }],
    [400, { type: 'invalid_request_error', param: 'thinking', message: 'Unsupported setting' }, 'PROVIDER', { errorCode: 'invalid_request_error', parameter: 'thinking' }]
  ];
  for (const [status, providerError, expectedCode, expectedDetails] of cases) {
    let calls = 0;
    await assert.rejects(testConnection(config, { fetchImpl: async () => {
      calls++;
      return new Response(JSON.stringify({ error: providerError }), { status });
    } }), error => {
      assert.equal(error.code, expectedCode, `${status}/${JSON.stringify(providerError)}`);
      assert.equal(error.httpStatus, status);
      assert.deepEqual(error.providerDetails, expectedDetails);
      return true;
    });
    assert.equal(calls, 1);
  }
});

test('diagnostic fields are allowlisted and never include provider messages, credentials, tasks or unknown parameters', async () => {
  const privateTask = 'UNIQUE_PRIVATE_TASK_CONTENT';
  const providerError = { code: config.apiKey, type: 'invalid_request_error', param: privateTask, message: `${config.apiKey} ${privateTask}`, debug: { task: privateTask, authorization: config.apiKey } };
  await assert.rejects(requestModel('generate', { task: privateTask }, config, { fetchImpl: async () => new Response(JSON.stringify({ error: providerError, request: { task: privateTask } }), { status: 400 }) }), error => {
    assert.equal(error.code, 'PROVIDER');
    assert.deepEqual(error.providerDetails, { errorCode: 'invalid_request_error' });
    for (const value of [JSON.stringify(error), error.message, error.stack]) {
      assert.equal(value.includes(config.apiKey), false);
      assert.equal(value.includes(privateTask), false);
    }
    assert.equal('cause' in error, false);
    return true;
  });
});

test('oversized or non-JSON error bodies are bounded and do not become diagnostic text', async () => {
  let cancelled = false;
  const stream = new ReadableStream({
    start(controller) { controller.enqueue(new TextEncoder().encode('x'.repeat(17 * 1024))); },
    cancel() { cancelled = true; }
  });
  await assert.rejects(testConnection(config, { fetchImpl: async () => new Response(stream, { status: 400 }) }), error => {
    assert.equal(error.code, 'PROVIDER');
    assert.equal(error.providerDetails, undefined);
    assert.equal(error.httpStatus, 400);
    return true;
  });
  assert.equal(cancelled, true);
  await assert.rejects(testConnection(config, { fetchImpl: async () => new Response(`<html>${config.apiKey}</html>`, { status: 503 }) }), codeIs('PROVIDER_UNAVAILABLE'));
});

test('finish_reason length is reported before parsing incomplete or superficially valid JSON, without retry', async () => {
  for (const content of ['{"ok":', '{"ok":true}', '']) {
    let calls = 0;
    await assert.rejects(testConnection(config, { fetchImpl: async () => {
      calls++;
      return new Response(JSON.stringify({ choices: [{ finish_reason: 'length', message: { content, reasoning_content: 'Private reasoning that must not be surfaced' } }] }));
    } }), error => {
      assert.equal(error.code, 'OUTPUT_TRUNCATED');
      assert.equal(error.httpStatus, 200);
      assert.equal(error.providerDetails, undefined);
      assert.equal(JSON.stringify(error).includes('Private reasoning'), false);
      return true;
    });
    assert.equal(calls, 1);
  }
});
