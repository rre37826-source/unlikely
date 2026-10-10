const messages = {
  CONFIG: ['Check the API URL, model name, and key. Use HTTPS, or a local address when running locally.', '请检查服务地址、模型名称和密钥。使用 HTTPS 地址，本地运行时可使用本地地址。'],
  INPUT: ['Check the task or selected route.', '请检查任务或所选路线。'],
  AUTH: ['The provider rejected the key or model access. Check its permissions.', '服务商拒绝了密钥或模型权限，请检查配置。'],
  MODEL_RETIRED: ['This model has been retired by Moonshot. Choose a current model, such as kimi-k2.6 or kimi-k3. Your model has not been changed automatically.', '这个型号已被 Moonshot 下线。请改填当前可用型号，如 kimi-k2.6 或 kimi-k3；系统不会自动替换你的模型。'],
  MODEL_NOT_FOUND: ['The provider could not find this model or grant access to it. Check the exact model ID on your provider account.', '服务商找不到这个型号，或你的账户无权使用。请核对开放平台中的完整模型名称。'],
  JSON_UNSUPPORTED: ['The provider rejected the JSON-output setting. This model or mode needs a compatible JSON configuration.', '服务商拒绝了 JSON 输出参数，需要调整这个模型或模式的 JSON 配置。'],
  TOKEN_LIMIT: ['The provider rejected the token or context limit. Adjust the model settings or shorten the task.', '服务商拒绝了输出额度或上下文限制，需要调整模型参数或缩短任务。'],
  QUOTA: ['The provider reports insufficient balance or exhausted quota. Check the API account balance.', '服务商提示余额不足或调用额度已用完，请检查 API 账户额度。'],
  RATE_LIMIT: ['The provider is rate-limiting requests. Wait before trying again.', '服务商正在限流，请稍后再试。'],
  NETWORK: ['Could not reach the provider. Check the URL and network. If browser requests are blocked by CORS, use the local server.', '无法连接服务商，请检查地址和网络。如果服务商禁止浏览器直连（CORS），请使用本地服务器方式。'],
  PROVIDER: ['The provider rejected the request. Check the API address and the parameter shown below, if present.', '服务商拒绝了请求。请核对 API 地址，并检查下方显示的参数（如有）。'],
  PROVIDER_UNAVAILABLE: ['The provider is temporarily unavailable. Try again later; your previous work is preserved.', '服务商暂时不可用，请稍后再试；原来的探索仍然保留。'],
  OUTPUT_TRUNCATED: ['The model reached its output limit before finishing. Increase the output budget or use a model with less reasoning overhead.', '模型在完成结果前用尽了输出额度。需要增加输出预算，或使用推理开销较小的模式。'],
  INVALID_RESPONSE: ['The model returned an unreadable result. Try a model with JSON-output support.', '模型没有返回可读取的结构化结果，可尝试支持 JSON 输出的模型。'],
  INVALID_GRAPH: ['The model returned an incomplete map. Your previous map is unchanged.', '模型返回的网络不完整，原来的网络没有改变。'],
  TIMEOUT: ['The request timed out. Your previous work is preserved. Try a faster model or a shorter task.', '请求超时，原来的探索仍然保留。可以尝试更快的模型或缩短任务。'],
  ABORTED: ['Stopped. Your previous work is still here.', '已停止，原来的探索仍然保留。']
};
const parameters = new Set(['model', 'response_format', 'max_tokens', 'max_completion_tokens', 'thinking', 'reasoning_effort']);

/** Only controlled guidance, status numbers and known parameter names reach the UI. */
export function describeModelError(error, language = 'en') {
  const index = language === 'zh' ? 1 : 0;
  const code = error?.name === 'AbortError' ? 'ABORTED' : error?.code;
  const message = Object.hasOwn(messages, code) ? messages[code][index] : ['The request failed. Your previous work is still here.', '请求未能完成，原来的探索仍然保留。'][index];
  const detail = [];
  if (Number.isInteger(error?.httpStatus) && error.httpStatus >= 400 && error.httpStatus <= 599) detail.push(`HTTP ${error.httpStatus}`);
  const parameter = error?.providerDetails?.parameter;
  if (parameters.has(parameter)) detail.push(`${index ? '参数' : 'Parameter'}: ${parameter}`);
  return message + (detail.length ? ` (${detail.join(' · ')})` : '');
}
