import test from 'node:test';
import assert from 'node:assert/strict';
import { describeModelError } from '../public/model-errors.mjs';

test('model diagnostics explain the actionable category and safe provider context in either language', () => {
  const error = { code: 'JSON_UNSUPPORTED', httpStatus: 400, providerDetails: { parameter: 'response_format' } };
  assert.match(describeModelError(error, 'zh'), /拒绝了 JSON 输出参数.*HTTP 400.*response_format/);
  assert.match(describeModelError(error), /rejected the JSON-output setting.*HTTP 400/);
  assert.match(describeModelError({ code: 'MODEL_RETIRED' }, 'zh'), /已被 Moonshot 下线/);
  assert.match(describeModelError({ code: 'OUTPUT_TRUNCATED' }, 'zh'), /用尽了输出额度/);
});

test('unknown or hostile diagnostic fields cannot echo private response content into the UI', () => {
  const secret = 'private-key-or-task-text';
  const result = describeModelError({ code: secret, message: secret, httpStatus: secret, providerDetails: { errorCode: secret, parameter: secret } }, 'zh');
  assert.equal(result.includes(secret), false);
  assert.doesNotThrow(() => describeModelError({ code: '__proto__' }));
  assert.match(describeModelError({ name: 'AbortError', message: secret }, 'zh'), /已停止/);
});
