import { ModelError, prepareModelRequest, validateModelResult } from './model-protocol.mjs';

export { ModelError } from './model-protocol.mjs';
const TIMEOUT_MS = 120_000;
const MAX_RESPONSE_BYTES = 1024 * 1024;

/** Return a clean in-memory connection. This module never uses browser persistence. */
export function normalizeConnection(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ModelError('CONFIG', 'Enter a base URL, API key and model.', 400);
  const config = {};
  for (const [field, limit] of [['baseUrl', 2048], ['apiKey', 4096], ['model', 200]]) {
    if (typeof input[field] !== 'string' || !input[field].trim() || input[field].length > limit || /[\r\n\0]/.test(input[field])) throw new ModelError('CONFIG', 'Enter a valid base URL, API key and model.', 400);
    config[field] = input[field].trim();
  }
  let url;
  try { url = new URL(config.baseUrl); } catch { throw new ModelError('CONFIG', 'The base URL is invalid.', 400); }
  const local = ['localhost', '127.0.0.1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) throw new ModelError('CONFIG', 'Use HTTPS for model providers. HTTP is allowed only for localhost or loopback addresses.', 400);
  if (url.username || url.password || config.baseUrl.includes('?') || config.baseUrl.includes('#')) throw new ModelError('CONFIG', 'The base URL must not include credentials, query parameters or a fragment.', 400);
  url.pathname = url.pathname.replace(/\/+$/, '').replace(/\/chat\/completions$/, '');
  config.baseUrl = url.href.replace(/\/$/, '');
  return config;
}

async function readProviderJson(response) {
  const length = response.headers?.get?.('content-length');
  if (length && Number(length) > MAX_RESPONSE_BYTES) throw new ModelError('INVALID_RESPONSE', 'The model response exceeded the size limit.');
  let data;
  try {
    if (response.body?.getReader) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let size = 0;
      let content = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > MAX_RESPONSE_BYTES) { await reader.cancel(); throw new ModelError('INVALID_RESPONSE', 'The model response exceeded the size limit.'); }
          content += decoder.decode(value, { stream: true });
        }
        content += decoder.decode();
        data = JSON.parse(content);
      } finally { reader.releaseLock(); }
    } else {
      data = await response.json();
      if (new TextEncoder().encode(JSON.stringify(data)).byteLength > MAX_RESPONSE_BYTES) throw new ModelError('INVALID_RESPONSE', 'The model response exceeded the size limit.');
    }
  } catch (error) {
    if (error instanceof ModelError) throw error;
    throw new ModelError('INVALID_RESPONSE', 'The provider returned an invalid JSON response.');
  }
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new ModelError('INVALID_RESPONSE', 'The model response contained no JSON message.');
  let result;
  try { result = JSON.parse(content); } catch { throw new ModelError('INVALID_RESPONSE', 'The model did not return valid JSON. Use a model with JSON response support.'); }
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new ModelError('INVALID_RESPONSE', 'The model did not return a JSON object.');
  return result;
}

async function callProvider(config, request, { signal, fetchImpl = fetch } = {}) {
  if (signal?.aborted) throw new ModelError('ABORTED', 'The request was cancelled.', 499);
  const controller = new AbortController();
  let timeout;
  let onAbort;
  const cancellation = new Promise((_, reject) => {
    onAbort = () => { reject(new ModelError('ABORTED', 'The request was cancelled.', 499)); controller.abort(); };
    signal?.addEventListener('abort', onAbort, { once: true });
    timeout = setTimeout(() => { reject(new ModelError('TIMEOUT', 'The model request exceeded 120 seconds. Try a faster model.', 504)); controller.abort(); }, TIMEOUT_MS);
  });
  const operation = (async () => {
    let response;
    try {
      response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
        method: 'POST', mode: 'cors', credentials: 'omit', redirect: 'error', cache: 'no-store', referrerPolicy: 'no-referrer',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify({ model: config.model, response_format: { type: 'json_object' }, ...(request.maxTokens ? { max_tokens: request.maxTokens } : {}), messages: [{ role: 'system', content: request.system }, { role: 'user', content: JSON.stringify(request.input) }] }),
        signal: controller.signal
      });
    } catch {
      if (controller.signal.aborted) throw new ModelError(signal?.aborted ? 'ABORTED' : 'TIMEOUT', signal?.aborted ? 'The request was cancelled.' : 'The model request exceeded 120 seconds.', signal?.aborted ? 499 : 504);
      throw new ModelError('NETWORK', 'Could not reach the provider. Check the URL, network and browser CORS support. Redirects are not allowed.');
    }
    if (response.redirected || response.status >= 300 && response.status < 400) throw new ModelError('NETWORK', 'Provider redirects are not allowed. Use the final HTTPS API base URL.');
    if (!response.ok) {
      if ([401, 403].includes(response.status)) throw new ModelError('AUTH', 'The model provider rejected authentication. Check the API key, model and access.');
      if (response.status === 429) throw new ModelError('RATE_LIMIT', 'The model provider is rate-limited or out of quota. Try again later.', 429);
      throw new ModelError('PROVIDER', 'The model provider rejected the request or is unavailable. Check the model and API compatibility.');
    }
    const result = await readProviderJson(response);
    // A proxy must never be able to echo the submitted credential into graph data or UI.
    if (config.apiKey.length >= 8 && JSON.stringify(result).includes(config.apiKey)) throw new ModelError('INVALID_RESPONSE', 'The provider returned an unsafe response.');
    return result;
  })();
  try { return await Promise.race([operation, cancellation]); }
  finally { clearTimeout(timeout); signal?.removeEventListener('abort', onAbort); }
}

/** One minimal paid request; verifies authentication, model and JSON-response compatibility. */
export async function testConnection(input, options = {}) {
  const config = normalizeConnection(input);
  const result = await callProvider(config, { system: 'Return exactly one JSON object: {"ok":true}. No other fields or text.', input: { check: 'json-connectivity' }, maxTokens: 64 }, options);
  if (result.ok !== true) throw new ModelError('INVALID_RESPONSE', 'The model did not return the expected JSON connection check.');
  return { model: config.model };
}

/** No retries: one explicit user action makes at most one potentially paid request. */
export async function requestModel(operation, payload, input, options = {}) {
  const config = normalizeConnection(input);
  let snapshot;
  try { snapshot = structuredClone(payload); } catch { throw new ModelError('INPUT', 'The request must contain plain project data.', 400); }
  const request = prepareModelRequest(operation, snapshot);
  const result = await callProvider(config, request, options);
  return validateModelResult(operation, snapshot, result);
}
