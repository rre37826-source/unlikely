import { prepareModelRequest, validateModelResult } from '../public/model-protocol.mjs';
import { DAILY_LIMIT, LIMITS, MODEL_BASE_URL, MODEL_NAME, TIMEOUT_MS, readConfig, reservation } from './limits.mjs';
import { admit, blocked, finish, isDuplicate, remaining, snapshot } from './ledger.mjs';

const encoder = new TextEncoder();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MESSAGES = Object.freeze({
  TRIAL_DISABLED: 'Public trial is not enabled.', TRIAL_CONFIG: 'Public trial is not configured.',
  TRIAL_QUOTA: 'The daily trial allowance has been used.', TRIAL_BUDGET: 'The public trial budget is exhausted.',
  TRIAL_RATE_LIMIT: 'The public trial daily capacity has been reached.', TRIAL_BUSY: 'Another trial request is running.',
  TRIAL_DUPLICATE: 'This request was already admitted. It will not be sent again.',
  TRIAL_ORIGIN: 'This origin is not allowed.', TRIAL_IDENTITY: 'A trusted visitor identity is required.',
  TRIAL_STORAGE: 'The trial ledger is temporarily unavailable.', INPUT: 'The trial input is invalid or too large.',
  TIMEOUT: 'The trial request timed out.', ABORTED: 'The trial request was cancelled.',
  PROVIDER: 'The trial model is temporarily unavailable.', INVALID_GRAPH: 'The model returned an invalid map.',
  INVALID_RESPONSE: 'The model returned an invalid response.', OUTPUT_TRUNCATED: 'The model output reached its limit.'
});

class TrialError extends Error {
  constructor(code, status = 400) { super(MESSAGES[code]); this.code = code; this.status = status; }
}

function controlled(error) {
  const code = Object.hasOwn(MESSAGES, error?.code) ? error.code : 'PROVIDER';
  return { error: MESSAGES[code], code };
}

function response(body, status, origin, retryAfter) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Vary': 'Origin', 'X-Content-Type-Options': 'nosniff' };
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  if (retryAfter) headers['Retry-After'] = String(retryAfter);
  return new Response(body === null ? null : JSON.stringify(body), { status, headers });
}

function allowedOrigin(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin) return null;
  const own = new URL(request.url).origin;
  // Called only from the Cloudflare-hosted route, whose URL origin is trusted.
  const allowed = typeof env.TRIAL_ALLOWED_ORIGINS === 'string' ? env.TRIAL_ALLOWED_ORIGINS.split(',').map(v => v.trim()) : [];
  return origin !== 'null' && (origin === own || allowed.includes(origin)) ? origin : null;
}

function canonicalIp(raw) {
  if (typeof raw !== 'string' || raw.length > 45 || /[^0-9a-fA-F:.]/.test(raw)) return null;
  if (raw.includes(':')) {
    try { return new URL(`http://[${raw}]/`).hostname.toLowerCase(); } catch { return null; }
  }
  const parts = raw.split('.');
  if (parts.length !== 4 || parts.some(p => !/^(0|[1-9]\d{0,2})$/.test(p) || Number(p) > 255)) return null;
  return parts.join('.');
}

async function identity(request, sessionId, secret) {
  const ip = canonicalIp(request.headers.get('CF-Connecting-IP'));
  if (!ip || sessionId !== undefined && !UUID.test(sessionId)) throw new TrialError('TRIAL_IDENTITY', 403);
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const hash = async value => Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value))), b => b.toString(16).padStart(2, '0')).join('');
  return { ipHash: await hash(`ip:${ip}`), sessionHash: sessionId === undefined ? '' : await hash(`session:${sessionId.toLowerCase()}`) };
}

function checkSignal(signal) {
  if (signal.aborted) throw new TrialError(signal.reason === 'trial-timeout' ? 'TIMEOUT' : 'ABORTED', 408);
}

function withSignal(promise, signal) {
  checkSignal(signal);
  return new Promise((resolve, reject) => {
    const abort = () => reject(new TrialError(signal.reason === 'trial-timeout' ? 'TIMEOUT' : 'ABORTED', 408));
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve(promise).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

async function readBounded(body, maxBytes, signal, code) {
  if (!body) throw new TrialError(code);
  const reader = body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await withSignal(reader.read(), signal);
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new TrialError(code, code === 'INPUT' ? 413 : 502);
      chunks.push(value);
    }
  } finally { void reader.cancel().catch(() => {}); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return { value: JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)), size }; }
  catch { throw new TrialError(code, code === 'INPUT' ? 400 : 502); }
}

function validateEnvelope(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k => !['action', 'requestId', 'sessionId', 'payload'].includes(k))) throw new TrialError('INPUT');
  if (!Object.hasOwn(LIMITS, body.action) || !UUID.test(body.requestId) || !UUID.test(body.sessionId)) throw new TrialError('INPUT');
  if (!body.payload || typeof body.payload !== 'object' || Array.isArray(body.payload)) throw new TrialError('INPUT');
  const allowed = body.action === 'generate' ? ['task', 'seed', 'constraints', 'language'] : body.action === 'expand' ? ['project', 'nodeId', 'operation', 'language'] : ['project', 'language'];
  if (Object.keys(body.payload).some(k => !allowed.includes(k))) throw new TrialError('INPUT');
  return { ...body, requestId: body.requestId.toLowerCase(), sessionId: body.sessionId.toLowerCase() };
}

async function storage(promise) {
  try { return await promise; } catch { throw new TrialError('TRIAL_STORAGE', 503); }
}

async function callProvider(action, payload, messages, config, fetchImpl, signal, remote) {
  checkSignal(signal);
  const limit = LIMITS[action];
  let res;
  try {
    res = await withSignal(fetchImpl(`${MODEL_BASE_URL}/chat/completions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
      body: JSON.stringify({ model: MODEL_NAME, messages, response_format: { type: 'json_object' }, thinking: { type: 'disabled' }, max_completion_tokens: limit.outputTokens, stream: false }),
      signal, redirect: 'error', credentials: 'omit', cache: 'no-store'
    }), signal);
  } catch (error) {
    checkSignal(signal);
    throw error instanceof TrialError ? error : new TrialError('PROVIDER', 502);
  }
  if (!res.ok) {
    remote.definitive = true;
    void res.body?.cancel().catch(() => {});
    throw new TrialError('PROVIDER', 502);
  }
  // No upstream headers, errors, usage, IDs, or arbitrary fields are returned.
  const { value: data } = await readBounded(res.body, limit.outputBytes, signal, 'INVALID_RESPONSE');
  remote.definitive = true;
  const choice = data?.choices?.[0];
  if (choice?.finish_reason === 'length') throw new TrialError('OUTPUT_TRUNCATED', 502);
  if (choice?.finish_reason !== 'stop' || typeof choice?.message?.content !== 'string') throw new TrialError('INVALID_RESPONSE', 502);
  let result;
  try { result = JSON.parse(choice.message.content); } catch { throw new TrialError('INVALID_RESPONSE', 502); }
  if (action === 'expand' && (!Array.isArray(result?.delta?.nodes) || result.delta.nodes.length < 3 || result.delta.nodes.length > 5 || !Array.isArray(result.delta.edges) || result.delta.edges.length > 12 || (result.delta.clusters?.length || 0) > 2)) throw new TrialError('INVALID_GRAPH', 502);
  checkSignal(signal);
  return validateModelResult(action, payload, result);
}

/** Cloudflare/D1 adapter. No runtime DDL, persistence of prompts, or provider retries. */
export async function handleTrialRequest(request, { env = {}, db, fetchImpl = fetch, now = Date.now } = {}) {
  const url = new URL(request.url);
  const isStatusPath = url.pathname === '/api/trial/status';
  const isStatus = isStatusPath && request.method === 'GET';
  const isTrial = url.pathname === '/api/trial';
  const origin = allowedOrigin(request, env);
  if (!isStatusPath && !isTrial) return response({ error: 'Not found.', code: 'INPUT' }, 404, origin);
  if (request.method === 'OPTIONS') {
    if (!origin) return response(controlled(new TrialError('TRIAL_ORIGIN')), 403, null);
    const res = response(null, 204, origin);
    res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, X-Trial-Session');
    res.headers.set('Access-Control-Max-Age', '600');
    return res;
  }
  if (!isStatus && (!isTrial || request.method !== 'POST')) return response({ error: 'Method not allowed.', code: 'INPUT' }, 405, origin);
  if (!origin && (!isStatus || request.headers.has('Origin'))) return response(controlled(new TrialError('TRIAL_ORIGIN')), 403, null);
  const config = readConfig(env);
  if (config.reason) return response(isStatus ? { available: false, reason: config.reason, dailyLimit: DAILY_LIMIT } : controlled(new TrialError(config.reason)), isStatus ? 200 : 503, origin);
  if (!db?.prepare) return response(isStatus ? { available: false, reason: 'TRIAL_STORAGE', dailyLimit: DAILY_LIMIT } : controlled(new TrialError('TRIAL_STORAGE')), isStatus ? 200 : 503, origin);
  // Primary reads prevent stale replica state around write admission/idempotency.
  const ledger = db.withSession ? db.withSession('first-primary') : db;
  const controller = new AbortController();
  const cancel = () => controller.abort('client-abort');
  request.signal.addEventListener('abort', cancel, { once: true });
  if (request.signal.aborted) cancel();
  const timer = setTimeout(() => controller.abort('trial-timeout'), TIMEOUT_MS);
  const signal = controller.signal;
  let admittedId = null;
  let visitor;
  const remote = { definitive: false };
  let outcome = 'PROVIDER';
  try {
    checkSignal(signal);
    if (isStatus) {
      const sessionId = request.headers.get('X-Trial-Session') ?? undefined;
      visitor = await identity(request, sessionId, config.hmacSecret);
      const state = await storage(snapshot(ledger, visitor, now()));
      const denial = blocked(state, reservation('generate'), config.budget, now());
      return response({ available: !denial, ...(denial ? { reason: denial.code, ...(denial.retryAfter ? { retryAfter: denial.retryAfter } : {}) } : {}), dailyLimit: DAILY_LIMIT, ...(sessionId ? { remaining: remaining(state) } : {}) }, 200, origin, denial?.retryAfter);
    }
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || '') || request.headers.has('Content-Encoding')) throw new TrialError('INPUT', 415);
    const raw = await readBounded(request.body, 262_144, signal, 'INPUT');
    const body = validateEnvelope(raw.value);
    const limit = LIMITS[body.action];
    if (raw.size > limit.bodyBytes) throw new TrialError('INPUT', 413);
    visitor = await identity(request, body.sessionId, config.hmacSecret);
    let prepared;
    try { prepared = prepareModelRequest(body.action, body.payload); } catch { throw new TrialError('INPUT'); }
    const trialHint = body.action === 'generate' ? ' For this public trial, use exactly 31 nodes and 42–54 edges. Keep each description and reason to one concise sentence so the complete JSON fits the output limit.' : body.action === 'expand' ? ' Add 3–5 nodes, no more than 12 edges and at most 2 new clusters.' : '';
    const messages = [{ role: 'system', content: prepared.system + trialHint }, { role: 'user', content: JSON.stringify(prepared.input) }];
    if (encoder.encode(JSON.stringify(messages)).byteLength > limit.messageBytes) throw new TrialError('INPUT', 413);
    checkSignal(signal);
    const accepted = await storage(admit(ledger, { ...visitor, requestId: body.requestId, action: body.action, cost: reservation(body.action), budget: config.budget, now: now() }));
    if (!accepted) {
      const duplicate = await storage(isDuplicate(ledger, body.requestId));
      const state = await storage(snapshot(ledger, visitor, now()));
      const denial = duplicate ? { code: 'TRIAL_DUPLICATE' } : blocked(state, reservation(body.action), config.budget, now()) || { code: 'TRIAL_BUSY', retryAfter: 1 };
      return response({ ...controlled(denial), ...denial, trial: { remaining: remaining(state), dailyLimit: DAILY_LIMIT } }, duplicate ? 409 : 429, origin, denial.retryAfter);
    }
    admittedId = body.requestId;
    const result = await callProvider(body.action, body.payload, messages, config, fetchImpl, signal, remote);
    const state = await storage(snapshot(ledger, visitor, now()));
    checkSignal(signal);
    outcome = 'success';
    return response({ ...result, trial: { remaining: remaining(state), dailyLimit: DAILY_LIMIT } }, 200, origin);
  } catch (error) {
    const safe = controlled(error);
    outcome = safe.code;
    if (isStatus) return response({ available: false, reason: safe.code, dailyLimit: DAILY_LIMIT }, 200, origin);
    const status = error instanceof TrialError ? error.status : 502;
    let trial;
    if (admittedId && visitor) {
      try { trial = { remaining: remaining(await snapshot(ledger, visitor, now())), dailyLimit: DAILY_LIMIT }; } catch { /* Never retry a paid request because reporting failed. */ }
    }
    return response({ ...safe, ...(trial ? { trial } : {}) }, status, origin);
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener('abort', cancel);
    if (admittedId) {
      try { await finish(ledger, admittedId, outcome, now(), remote.definitive); } catch { /* The retained lease expires, but the reservation never does. */ }
    }
  }
}
