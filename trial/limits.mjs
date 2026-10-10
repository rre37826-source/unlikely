export const DAILY_LIMIT = 3;
export const GLOBAL_DAILY_LIMIT = 100;
export const MAX_INFLIGHT = 1;
export const TIMEOUT_MS = 120_000;
export const LEASE_MS = 150_000;
export const PRICING_ID = 'moonshot-cn-kimi-k2.6-2026-10-10';
export const MODEL_BASE_URL = 'https://api.moonshot.cn/v1';
export const MODEL_NAME = 'kimi-k2.6';

// Verified 2026-10-10: https://platform.kimi.com/docs/pricing/chat
// Complete price table: https://platform.kimi.com/docs/pricing/chat.md
// K2.6 has no separate cache-write tariff; the TTL write tariff is for K3.
// https://platform.kimi.com/docs/api/chat documents max_completion_tokens.
// 6.50 CNY / 1M input tokens = 6.5 microyuan / token; output = 27.
// Each UTF-8 byte is conservatively charged as one input token, plus a
// 1,024-token framing allowance. Reservations use the full operation ceiling.
// Cached discounts and the provider's usage reports never reduce a reservation.
export const LIMITS = Object.freeze({
  generate: Object.freeze({ bodyBytes: 24_576, messageBytes: 16_384, outputTokens: 16_384, outputBytes: 262_144 }),
  expand: Object.freeze({ bodyBytes: 262_144, messageBytes: 131_072, outputTokens: 4_096, outputBytes: 65_536 }),
  synthesize: Object.freeze({ bodyBytes: 262_144, messageBytes: 49_152, outputTokens: 4_096, outputBytes: 65_536 })
});
export function reservation(action) {
  const limit = LIMITS[action];
  return Math.ceil((limit.messageBytes + 1_024) * 13 / 2 + limit.outputTokens * 27);
}

export function readConfig(env = {}) {
  if (env.TRIAL_ENABLED !== 'true') return { reason: 'TRIAL_DISABLED' };
  const rawBudget = env.TRIAL_MONTHLY_BUDGET_MICROYUAN;
  const budget = Number(rawBudget);
  if (typeof rawBudget !== 'string' || !/^[1-9]\d{0,11}$/.test(rawBudget) || !Number.isSafeInteger(budget)) return { reason: 'TRIAL_CONFIG' };
  if (env.TRIAL_MODEL_BASE_URL !== MODEL_BASE_URL || env.TRIAL_MODEL_NAME !== MODEL_NAME || env.TRIAL_PRICING_ID !== PRICING_ID) return { reason: 'TRIAL_CONFIG' };
  if (typeof env.TRIAL_MODEL_API_KEY !== 'string' || !env.TRIAL_MODEL_API_KEY.trim() || env.TRIAL_MODEL_API_KEY.length > 1024 || /[\r\n]/.test(env.TRIAL_MODEL_API_KEY)) return { reason: 'TRIAL_CONFIG' };
  if (typeof env.TRIAL_HMAC_SECRET !== 'string' || env.TRIAL_HMAC_SECRET.length < 32 || env.TRIAL_HMAC_SECRET.length > 1024) return { reason: 'TRIAL_CONFIG' };
  const allowedOrigins = [];
  if (typeof env.TRIAL_ALLOWED_ORIGINS !== 'string' || !env.TRIAL_ALLOWED_ORIGINS.trim()) return { reason: 'TRIAL_CONFIG' };
  for (const item of env.TRIAL_ALLOWED_ORIGINS.split(',')) {
    const value = item.trim();
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.origin !== value || url.username || url.password) return { reason: 'TRIAL_CONFIG' };
      allowedOrigins.push(value);
    } catch { return { reason: 'TRIAL_CONFIG' }; }
  }
  return { budget, allowedOrigins, apiKey: env.TRIAL_MODEL_API_KEY, hmacSecret: env.TRIAL_HMAC_SECRET };
}
