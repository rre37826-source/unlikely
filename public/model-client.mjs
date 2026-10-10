import { ModelError, prepareModelRequest, validateModelResult } from './model-protocol.mjs';

export { ModelError } from './model-protocol.mjs';
const TIMEOUT_MS = 120_000;
const MAX_RESPONSE_BYTES = 1024 * 1024;
const MAX_ERROR_BYTES = 16 * 1024;
const PROVIDER_CODES = new Set([
  'invalid_request_error', 'invalid_request', 'invalid_parameter', 'unsupported_parameter', 'unsupported_value',
  'model_not_found', 'model_not_available', 'invalid_model', 'resource_not_found_error',
  'invalid_response_format', 'unsupported_response_format', 'context_length_exceeded', 'max_tokens_exceeded',
  'insufficient_quota', 'insufficient_balance', 'exceeded_current_quota_error', 'billing_hard_limit_reached',
  'rate_limit_exceeded', 'rate_limit_reached_error', 'engine_overloaded_error',
  'invalid_api_key', 'invalid_authentication_error', 'incorrect_api_key_error', 'authentication_error',
  'permission_denied_error', 'server_error', 'api_error', 'server_unavailable', 'unexpected_output', 'content_filter'
]);
const PARAMETER_NAMES = new Set(['model', 'response_format', 'max_tokens', 'max_completion_tokens', 'thinking', 'reasoning_effort']);
// Verified against both official model lists on 2026-10-10. No alias/prefix guessing.
// https://platform.kimi.com/docs/models · https://platform.kimi.ai/docs/models
const RETIRED_KIMI_MODELS = new Set([
  'kimi-k2.5', 'moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k', 'moonshot-v1-auto',
  'moonshot-v1-8k-vision-preview', 'moonshot-v1-32k-vision-preview', 'moonshot-v1-128k-vision-preview',
  'kimi-k2-0905-preview', 'kimi-k2-0711-preview', 'kimi-k2-turbo-preview',
  'kimi-k2-thinking', 'kimi-k2-thinking-turbo', 'kimi-latest', 'kimi-thinking-preview'
]);

function officialMoonshot(config) {
  return config.baseUrl === 'https://api.moonshot.cn/v1' || config.baseUrl === 'https://api.moonshot.ai/v1';
}

function connectionTestParameters(config) {
  // Keep provider-specific options out of unknown endpoints and unverified aliases.
  // https://platform.kimi.com/docs/api/models-overview
  if (officialMoonshot(config)) {
    if (config.model === 'kimi-k2.6') return { max_tokens: 1024, thinking: { type: 'disabled' } };
    if (config.model === 'kimi-k3') return { max_tokens: 4096, reasoning_effort: 'low' };
    if (['kimi-k2.7-code', 'kimi-k2.7-code-highspeed'].includes(config.model)) return { max_tokens: 4096 };
  }
  return { max_tokens: 4096 };
}

/** No response text, model name, task, credential, or arbitrary provider field escapes here. */
function providerError(code, message, response, details = {}) {
  const error = new ModelError(code, message, code === 'RATE_LIMIT' ? 429 : 502);
  if (Number.isInteger(response.status) && response.status >= 100 && response.status <= 599) error.httpStatus = response.status;
  const safe = {};
  if (PROVIDER_CODES.has(details.errorCode)) safe.errorCode = details.errorCode;
  if (PARAMETER_NAMES.has(details.parameter)) safe.parameter = details.parameter;
  if (Object.keys(safe).length) error.providerDetails = safe;
  return error;
}

async function readErrorObject(response) {
  const length = Number(response.headers?.get?.('content-length') || 0);
  if (length > MAX_ERROR_BYTES) { response.body?.cancel?.().catch(() => {}); return {}; }
  if (!response.body?.getReader) return {};
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let content = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_ERROR_BYTES) { await reader.cancel(); return {}; }
      content += decoder.decode(value, { stream: true });
    }
    const data = JSON.parse(content + decoder.decode());
    return data?.error && typeof data.error === 'object' && !Array.isArray(data.error) ? data.error : {};
  } catch { return {}; }
  finally { reader.releaseLock(); }
}

async function classifyProviderError(response) {
  const raw = await readErrorObject(response);
  const errorCode = [raw.code, raw.type].find(value => typeof value === 'string' && PROVIDER_CODES.has(value));
  let parameter = typeof raw.param === 'string' && PARAMETER_NAMES.has(raw.param) ? raw.param : typeof raw.parameter === 'string' && PARAMETER_NAMES.has(raw.parameter) ? raw.parameter : undefined;
  // Examine bounded text only to select fixed categories; never return or attach it.
  const message = typeof raw.message === 'string' ? raw.message.toLowerCase() : '';
  if (!parameter && [400, 422].includes(response.status)) {
    for (const name of PARAMETER_NAMES) {
      if (name === 'model') continue;
      if (new RegExp(`\\b${name}\\b`).test(message)) { parameter = name; break; }
    }
  }
  const details = { errorCode, parameter };
  const fail = (code, text) => providerError(code, text, response, details);
  if (response.status === 401) return fail('AUTH', 'The model provider rejected authentication. Check the API key and its regional endpoint.');
  if (response.status >= 500) return fail('PROVIDER_UNAVAILABLE', 'The model provider is temporarily unavailable. Try again later.');
  if (response.status === 402 || ['insufficient_quota', 'insufficient_balance', 'exceeded_current_quota_error', 'billing_hard_limit_reached'].includes(errorCode) || [400, 403, 429].includes(response.status) && /insufficient (?:quota|balance|credit)|(?:quota|balance|credit)[^\n]{0,40}(?:exhausted|insufficient)|account[^\n]{0,40}(?:arrears|overdue)|余额不足|额度不足|账户欠费/.test(message)) return fail('QUOTA', 'The provider reports insufficient account balance or quota. Check billing before retrying.');
  if (response.status === 403) return fail('AUTH', 'The model provider rejected authentication or access. Check the API key, model and permissions.');
  if (errorCode === 'engine_overloaded_error') return fail('PROVIDER_UNAVAILABLE', 'The model provider is overloaded. Try again later.');
  if (response.status === 429) return fail('RATE_LIMIT', 'The model provider rate limit was reached. Wait before trying again.');
  if (['model_not_found', 'model_not_available', 'invalid_model', 'resource_not_found_error'].includes(errorCode) || parameter === 'model' || [400, 404, 422].includes(response.status) && /(?:model[^\n]{0,100}(?:not found|does not exist|not available|unavailable|not supported|discontinued|retired)|(?:unknown|invalid) model|模型[^\n]{0,40}(?:不存在|已下线|不支持|不可用))/.test(message)) return fail('MODEL_NOT_FOUND', 'The requested model is unavailable or inaccessible. Check the exact model ID and account access.');
  if (parameter === 'response_format' || ['invalid_response_format', 'unsupported_response_format'].includes(errorCode)) return fail('JSON_UNSUPPORTED', 'The provider rejected the JSON response-format parameter for this model.');
  if (['max_tokens', 'max_completion_tokens'].includes(parameter) || ['context_length_exceeded', 'max_tokens_exceeded'].includes(errorCode) || /input token length too long|maximum context length|context length exceeded/.test(message)) return fail('TOKEN_LIMIT', 'The provider rejected the output-token budget or context length. Check the model limits.');
  return fail('PROVIDER', 'The provider rejected this request. Check the model and the reported parameter, if any.');
}

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
  const choice = data?.choices?.[0];
  if (choice?.finish_reason === 'length') throw providerError('OUTPUT_TRUNCATED', 'The model output reached its token limit before completing. No partial result was applied.', response);
  const content = choice?.message?.content;
  if (typeof content !== 'string') throw new ModelError('INVALID_RESPONSE', 'The model response contained no JSON message.');
  let result;
  try { result = JSON.parse(content); } catch { throw new ModelError('INVALID_RESPONSE', 'The model did not return valid JSON. Use a model with JSON response support.'); }
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new ModelError('INVALID_RESPONSE', 'The model did not return a JSON object.');
  return result;
}

async function callProvider(config, request, { signal, fetchImpl = fetch } = {}) {
  if (signal?.aborted) throw new ModelError('ABORTED', 'The request was cancelled.', 499);
  if (officialMoonshot(config) && RETIRED_KIMI_MODELS.has(config.model)) {
    const error = new ModelError('MODEL_RETIRED', 'This model has been retired by the official Kimi API. Choose a currently supported model; no request was sent.', 400);
    error.providerDetails = { parameter: 'model' };
    throw error;
  }
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
        body: JSON.stringify({ model: config.model, response_format: { type: 'json_object' }, ...(request.connectionTest ? connectionTestParameters(config) : {}), messages: [{ role: 'system', content: request.system }, { role: 'user', content: JSON.stringify(request.input) }] }),
        signal: controller.signal
      });
    } catch {
      if (controller.signal.aborted) throw new ModelError(signal?.aborted ? 'ABORTED' : 'TIMEOUT', signal?.aborted ? 'The request was cancelled.' : 'The model request exceeded 120 seconds.', signal?.aborted ? 499 : 504);
      throw new ModelError('NETWORK', 'Could not reach the provider. Check the URL, network and browser CORS support. Redirects are not allowed.');
    }
    if (response.redirected || response.status >= 300 && response.status < 400) throw new ModelError('NETWORK', 'Provider redirects are not allowed. Use the final HTTPS API base URL.');
    if (!response.ok) throw await classifyProviderError(response);
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
  const result = await callProvider(config, { system: 'Return exactly one JSON object: {"ok":true}. No other fields or text.', input: { check: 'json-connectivity' }, connectionTest: true }, options);
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
