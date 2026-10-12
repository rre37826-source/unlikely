# Public trial

**Status: limited public trial enabled; live generation verified once.** The gateway is deployed with `TRIAL_ENABLED=true`, operator credentials, and a configured monthly budget. Visitors do not need an account or their own API key. On 2026-10-12, a real public-webpage request generated a map that could be explored and added to a route. See the [v0.3.2 verification record](verification-v0.3.2.md) for the scope and limitations. Three curated examples remain free and do not consume trial allowance.

## Experience

The default custom-task path uses a hosted gateway without asking visitors for their own key. BYOK remains a separate advanced option.

| State | What the visitor sees |
| --- | --- |
| Ready | A task can be submitted with a visible trial allowance. |
| Quota exhausted | Keep the current map; offer existing exploration and curated examples. |
| Disabled or not configured | Explain that public generation is preparing to open; offer complete examples. |
| Temporarily unavailable | Preserve existing work, explain the failure, and offer an appropriate retry or examples. |

None of these states automatically opens an API-key form. A retry with the same request ID does not make another provider call, and does not replay a saved model result.

## Architecture and status

GitHub Pages continues to serve the frontend. The public API uses a separate gateway. `trial/index.mjs` exports `handleTrialRequest`; the [Sites/Vinext hosting adapter](../hosting/sites/README.md) is included as a source overlay. Deployment of an adapter is not evidence that model generation is enabled.

D1 is mandatory for persistent quota and accounting state. The service defaults to disabled with a zero budget and must not fall back to unmetered operation if configuration or D1 is unavailable. The public model is fixed to **Kimi K2.6 on the China endpoint**; visitors cannot override the provider, model, credentials, token limits, or pricing through this API.

The adapter passes the D1 binding as `{ db: env.DB }` to `handleTrialRequest`. Apply `trial/schema.sql` through the host's D1 migration workflow, not from a request handler. Trusted visitor IP information must come from the Cloudflare hosting boundary (`CF-Connecting-IP`), not an arbitrary client-supplied forwarding header.

Configuration is separate from browser BYOK and the local `.env` adapter:

| Setting | Required value or behavior |
| --- | --- |
| `DB` | D1 binding passed by the hosting adapter. |
| `TRIAL_ENABLED` | Defaults to `false`; only the exact value `true` can enable admission. |
| `TRIAL_MONTHLY_BUDGET_MICROYUAN` | Defaults to `0`; activation requires a positive integer. One CNY equals 1,000,000 microyuan. |
| `TRIAL_MODEL_BASE_URL` | Exactly `https://api.moonshot.cn/v1`. |
| `TRIAL_MODEL_NAME` | Exactly `kimi-k2.6`. |
| `TRIAL_PRICING_ID` | Exactly `moonshot-cn-kimi-k2.6-2026-10-10`, matching `trial/limits.mjs`. |
| `TRIAL_MODEL_API_KEY` | An intentionally supplied server secret; never exposed to the client. |
| `TRIAL_HMAC_SECRET` | A random secret of at least 32 characters for quota identifiers. |
| `TRIAL_ALLOWED_ORIGINS` | Comma-separated exact HTTPS origins, for example `https://rre37826-source.github.io`, without `/unlikely/` or a trailing slash. The gateway's own origin is also accepted. |

Do not infer or copy an existing local API key. A pricing ID is a configuration match, not a live check of the provider's prices.

## API contract

### Status

```http
GET /api/trial/status
X-Trial-Session: 56b571a8-9f72-48e9-923a-e575cd0e9c57
```

The session UUID header is optional. The response shape is `{ available, reason?, dailyLimit: 3, remaining?, retryAfter? }`; `remaining` is available when a valid session is supplied. `retryAfter`, when present, is in seconds. Status checks do not call the model or consume an operation. They must not expose keys or return task content. Availability is a snapshot, not a reservation of the next call.

### Model operation

```http
POST /api/trial
Content-Type: application/json
```

```json
{
  "action": "generate",
  "requestId": "c0a32c64-468d-4279-926c-0ad0327fe11b",
  "sessionId": "56b571a8-9f72-48e9-923a-e575cd0e9c57",
  "payload": {
    "task": "Explore a short-film premise with two actors and one kitchen.",
    "seed": "Lemon concentrate",
    "constraints": "Eight minutes; no visual effects.",
    "language": "en"
  }
}
```

Allowed actions are `generate`, `expand`, and `synthesize`. Their payloads follow the shared model-operation protocol. Generation accepts an optional seed and explicit constraints; expansion and synthesis operate on the submitted project and selected content. Both IDs must be valid UUIDs; create a fresh request UUID for an intentionally new operation. The example IDs above are illustrative, not production constants.

Success returns the operation result plus `trial: { remaining, dailyLimit: 3 }`. Failures return a controlled `code` and `error`, with quota metadata when available. Relevant codes include `TRIAL_DISABLED`, `TRIAL_CONFIG`, `TRIAL_QUOTA`, `TRIAL_BUDGET`, `TRIAL_BUSY`, `TRIAL_RATE_LIMIT`, `TRIAL_DUPLICATE`, `TRIAL_ORIGIN`, `TRIAL_IDENTITY`, `TRIAL_STORAGE`, `INPUT`, `TIMEOUT`, `ABORTED`, `PROVIDER`, `INVALID_GRAPH`, `INVALID_RESPONSE`, and `OUTPUT_TRUNCATED`.

## Limits and retries

- Each anonymous session and each IP address has **three model operations per UTC day**, shared by `generate`, `expand`, and `synthesize`; the tighter remaining allowance wins. People sharing a public IP therefore share its limit.
- The gateway also permits at most **100 operations per UTC day globally** and **one in-flight operation globally**, subject to the monthly budget. Daily buckets reset at 00:00 UTC; monthly accounting uses UTC calendar months. Rotating session IDs does not remove the other limits.
- Quota and budget reservations occur before a provider call. **Reservations are not refunded**, including when an accepted operation later fails, times out, or returns invalid output.
- An already admitted request UUID is never sent upstream again. A valid repeat while the service is enabled returns **409 `TRIAL_DUPLICATE`**. There is no result cache: a response lost in transit cannot be recovered by replaying the same ID. Starting a new request is a new operation and can consume another allowance.
- Disabled configuration, exhausted limits, or unavailable required storage stop public generation rather than bypassing controls.

Do not describe three operations as three completed projects or three successful results. Use returned `remaining`, `reason`, and `retryAfter` when presenting the current state; do not infer that a daily reset resolves a monthly budget limit or an outage.

## Cost controls

The configured budget is an application admission control, **not an absolute guarantee about the provider's bill**. Its correctness depends on the fixed endpoint, currency, current model pricing, request bounds, and reservation calculation. It also does not automatically cover hosting or database charges.

`trial/limits.mjs` contains a dated pricing snapshot and fixed operation ceilings. Reservations use those ceilings, include the framed request and output allowance, and do not discount cached input or refund based on reported usage. The snapshot does not update automatically.

Before activation, the operator must recheck the snapshot against applicable pricing, including input, output/reasoning, and cache treatment; configure a positive explicit monthly budget; and set an appropriate provider-side spending cap where available. Do not assume a price from an older model or a different regional endpoint. If those assumptions cannot be established, keep the service disabled.

A stopped browser request does not prove that upstream computation or billing stopped. Keeping a reservation after failure is a conservative accounting rule, not proof that every possible charge is bounded.

## Data handling

The browser sends the submitted task, graph, and relevant route content through the gateway to the fixed model provider. This content is needed for generation; it is not kept as task or graph records in the gateway database.

D1 stores the quota, reservation, concurrency, and idempotency metadata needed to enforce limits. Quota identifiers are HMAC-derived. The application does not persist raw IP addresses, prompts, or full graphs in that storage. This is data minimization, not a claim that a session cannot be linked or that infrastructure is log-free. Hosting and model providers may maintain their own logs and policies.

Frontend project persistence remains separate: tasks and graphs may be saved in the visitor's browser `localStorage`. Advanced BYOK credentials, endpoint, and model stay in page memory and are not exported. Public server credentials never go to the browser.

## Verification boundary

After two failed public-browser attempts on 2026-10-12, one request succeeded against the deployed compatibility fix. The returned map rendered in the public webpage, node and relationship details were usable, and a three-node route was assembled. This verifies one live generation flow, not reliability across arbitrary tasks or the accuracy of its suggestions. Real expansion, synthesis, and browser BYOK remain unverified. Diagnostics record fixed structural codes without task or graph content.

Describe the trial as enabled and limited, and record the operations actually tested. Operator setup includes D1, an intentionally supplied server credential, quota/HMAC configuration, current price verification, an explicit monthly budget, and a provider-side spending limit where available. Mock tests, a healthy status endpoint, or a successful deployment alone are insufficient evidence of a successful real generation.

Do not advertise unlimited use, a guaranteed result, or a guaranteed bill ceiling. Curated examples remain available when public operations are exhausted or unavailable.
