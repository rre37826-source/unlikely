# Public trial runtime

This module is server-only. It performs no model requests by default. Tests use
dummy keys, SQLite and mock HTTP responses; no real provider integration has
been claimed or performed.

## Host adapter

```js
import { handleTrialRequest } from './trial/index.mjs';
return handleTrialRequest(request, { env, db: env.DB });
```

Expose this handler only through Cloudflare Workers, on `/api/trial` and
`/api/trial/status`. The adapter must preserve the trusted request URL and
Cloudflare's `CF-Connecting-IP` header. Never synthesize that header from
`X-Forwarded-For` or accept it from an untrusted reverse proxy. A missing or
invalid header prevents admission. CORS is not authentication: scripted
clients can imitate an Origin; the ledger's global budget remains the hard
application admission limit.

Copy `trial/*.mjs` and the shared `public/core.mjs` and
`public/model-protocol.mjs` into the host. Pass the D1 binding, not a Drizzle
client, as `db`. All timestamps and quota buckets use UTC. D1 session reads
start on the primary when the binding supports `withSession`.

## Configuration

| Variable | Required value / default |
| --- | --- |
| `TRIAL_ENABLED` | Default `false`; only the literal `true` enables checks |
| `TRIAL_MONTHLY_BUDGET_MICROYUAN` | Default `0`; positive integer, 1 yuan = 1,000,000 microyuan |
| `TRIAL_MODEL_BASE_URL` | Exactly `https://api.moonshot.cn/v1` |
| `TRIAL_MODEL_NAME` | Exactly `kimi-k2.6` |
| `TRIAL_PRICING_ID` | Exactly `moonshot-cn-kimi-k2.6-2026-10-10` |
| `TRIAL_MODEL_API_KEY` | Server secret; absent by default |
| `TRIAL_HMAC_SECRET` | Random server secret, at least 32 characters; absent by default |
| `TRIAL_ALLOWED_ORIGINS` | Comma-separated exact HTTPS origins, including the GitHub Pages origin |
| `DB` | D1 binding with the migration applied |

The current request's own origin is also allowed. Origins have no path or
trailing slash. No credentials-enabled CORS is used. The budget, enable flag
and secrets must remain unconfigured until the owner explicitly approves
public spending. Changing or rotating the HMAC secret resets hashed-identity
quota continuity; do not rotate it to clear limits.

## API and limits

`GET /api/trial/status` returns `{available, reason?, dailyLimit:3,
remaining?, retryAfter?}`. Send optional `X-Trial-Session: UUID` to obtain
session/IP remaining allowance. This GET never reserves money or calls a model.

`POST /api/trial` accepts only `{action, requestId, sessionId, payload}`.
Both IDs must be UUIDs; `requestId` must be new for a deliberate new attempt.
Actions and payloads match the shared model protocol. Client provider settings
are rejected. A successful response includes the original graph or brief
fields and `trial:{remaining,dailyLimit:3}`.

Every admitted attempt consumes one of 3 attempts per UTC day for both its
session and its IP. The stricter allowance wins. This is an abuse constraint,
not proof of one unique human: a shared network shares an allowance. The global
daily ceiling is 100 attempts; one unexpired global lease is allowed at once.
The 120-second request deadline has a 150-second ledger lease. A network failure,
timeout or cancellation keeps the lease until expiry because the provider may
still be doing work. A definitive provider response releases it on completion.

| Action | Request body | Prepared messages | Output tokens | Upstream response bytes | Permanent reservation |
| --- | ---: | ---: | ---: | ---: | ---: |
| generate | 24,576 B | 16,384 B | 16,384 | 262,144 B | 555,520 microyuan |
| expand | 262,144 B | 131,072 B | 4,096 | 65,536 B | 969,216 microyuan |
| synthesize | 262,144 B | 49,152 B | 4,096 | 65,536 B | 436,736 microyuan |

Generation asks for 31 nodes with short explanations. Expansion must be an
append-only delta with 3–5 nodes, at most 12 edges and at most 2 new clusters.
The shared validators enforce graph connectivity and preserve original content.
Requests are text only: no tools, browsing, image inputs, retries or follow-up
model calls. Output uses JSON mode, disabled thinking and fixed
`max_completion_tokens`. It may still fail to fit or validate; failure does not
silently trigger another paid attempt.

Errors contain only a fixed message and code, optional `retryAfter` seconds,
and, when available, `trial`. Codes are `TRIAL_DISABLED`, `TRIAL_CONFIG`,
`TRIAL_STORAGE`, `TRIAL_IDENTITY`, `TRIAL_ORIGIN`, `TRIAL_QUOTA`, `TRIAL_BUDGET`,
`TRIAL_RATE_LIMIT`, `TRIAL_BUSY`, `TRIAL_DUPLICATE`, `INPUT`, `TIMEOUT`, `ABORTED`,
`PROVIDER`, `INVALID_GRAPH`, `INVALID_RESPONSE`, and `OUTPUT_TRUNCATED`.

`TRIAL_DUPLICATE` is HTTP 409: the request is never sent again, including after
failure or a lost response. No result cache exists, so an interrupted successful
response cannot be recovered by replaying its ID. A new request ID means a new
intentional attempt and another reservation. Failed and cancelled attempts are
not refunded. The browser must disclose this before admission and must not
automatically retry.

## Accounting and pricing evidence

The single `INSERT ... SELECT` in `ledger.mjs` checks budget, day/session/IP
quotas, duplicate IDs and inflight leases in the same SQLite write statement.
Never replace it with independent read-then-write checks. Reservations are
positive integer microyuan and never change after insertion. All admitted
requests count, regardless of their outcome or expired lease. Monthly accounting
uses the UTC admission month; it is an intentionally conservative internal
allowance ledger, not a reconciliation of the provider's bill.

Prices were checked on 2026-10-10 against the official
[Kimi price table](https://platform.kimi.com/docs/pricing/chat) (the complete
MDX table is available at [chat.md](https://platform.kimi.com/docs/pricing/chat.md)).
K2.6 is 6.50 yuan per million uncached input tokens, 1.10 for cache hits and
27.00 for output. The separate 5-minute / 1-hour cache-write tariff belongs to
K3, which this runtime refuses. No cache discount is assumed. These are dated
prices: recheck provider pricing before enabling or changing the runtime;
unknown pricing IDs, other endpoints and other models fail closed.

The fixed reservation is `ceil((message-byte-ceiling + 1024) * 6.5 +
output-token-ceiling * 27)` microyuan. Each input UTF-8 byte is conservatively
treated as one token, with 1,024 extra tokens for the two message wrappers and
protocol framing. No model-reported usage lowers the reservation. Text-only
requests and fixed output caps are essential to this bound. See the official
[Chat API](https://platform.kimi.com/docs/api/chat) and
[K2.6 parameter table](https://platform.kimi.com/docs/api/models-overview).
Provider tariff changes or billing behavior outside those published limits
cannot be prevented by application accounting; use a separate provider-side
spending limit where available.

## Schema, privacy and tests

`schema.sql` is the migration source. In a Sites Vinext host, declare the same
table and indexes in `db/schema.ts` with Drizzle `sqliteTable`, `text`, `integer`,
`index` and the two SQL check constraints. Generate and inspect the migration
with `npm run db:generate`. Apply it using the Sites migration workflow before
serving requests. There is no request-time DDL.

Rows store request UUID, domain-separated HMAC-SHA256 session/IP hashes, action,
UTC buckets, reserved cost, timestamps and a controlled outcome code. They never
store prompts, graph contents, output, raw IP, session UUID, provider response
or key. Retain rows to preserve budget and idempotency; any later cleanup policy
must retain those guarantees. Hosting access logs and provider retention policies
remain separate from this module. Do not log request bodies in the route adapter.

Run `node --test tests/trial.test.mjs` on Node with `node:sqlite` available
(Node 22.13+ or current Node 24; earlier Node 22 builds require
`--experimental-sqlite`). Tests execute the actual SQL in an in-memory SQLite
database and use mock provider responses only.
